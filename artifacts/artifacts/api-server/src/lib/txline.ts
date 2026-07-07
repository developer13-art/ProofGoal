import { logger } from "./logger";
import { db, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TXLINE_NETWORK = process.env["TXLINE_NETWORK"] ?? "mainnet";
const TXLINE_BASE_URL =
  TXLINE_NETWORK === "devnet"
    ? "https://txline-dev.txodds.com"
    : "https://txline.txodds.com";

export interface TxlineStatusResult {
  activated: boolean;
  serviceLevel: number | null;
  lastSyncAt: string | null;
  matchesSynced: number;
  message: string;
}

let cachedStatus: TxlineStatusResult | null = null;
let cachedAt = 0;
let lastSyncAt: string | null = null;
const CACHE_TTL_MS = 30_000;

async function probeActivation(): Promise<TxlineStatusResult> {
  const apiKey = process.env["TXLINE_API_KEY"];

  if (!apiKey) {
    return {
      activated: false,
      serviceLevel: null,
      lastSyncAt,
      matchesSynced: 0,
      message:
        "TXLINE_API_KEY is not configured. Complete the on-chain TxLINE subscription and activation to enable live World Cup data.",
    };
  }

  try {
    const res = await fetch(`${TXLINE_BASE_URL}/api/fixtures`, {
      headers: { "X-Api-Token": apiKey },
    });

    if (res.status === 401 || res.status === 403) {
      return {
        activated: false,
        serviceLevel: null,
        lastSyncAt,
        matchesSynced: 0,
        message:
          "TxLINE token is present but not activated. Run the activation script against the on-chain subscription program with your wallet, then update TXLINE_API_KEY with the returned activated token.",
      };
    }

    if (!res.ok) {
      return {
        activated: false,
        serviceLevel: null,
        lastSyncAt,
        matchesSynced: 0,
        message: `TxLINE responded with an unexpected status (${res.status}). Data sync is paused until this resolves.`,
      };
    }

    return {
      activated: true,
      serviceLevel: 1,
      lastSyncAt,
      matchesSynced: 0,
      message: "TxLINE oracle is activated and reachable.",
    };
  } catch (err) {
    logger.warn({ err }, "TxLINE activation probe failed");
    return {
      activated: false,
      serviceLevel: null,
      lastSyncAt,
      matchesSynced: 0,
      message:
        "Could not reach TxLINE. This can be transient network failure or an unactivated subscription.",
    };
  }
}

export async function getTxlineStatus(
  matchesSynced: number,
): Promise<TxlineStatusResult> {
  const now = Date.now();
  if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return { ...cachedStatus, matchesSynced, lastSyncAt };
  }

  const result = await probeActivation();
  cachedStatus = result;
  cachedAt = now;
  return { ...result, matchesSynced, lastSyncAt };
}

interface TxlineFixture {
  id: string;
  competition?: { name?: string };
  round?: { name?: string };
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  kickoff?: string;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
}

function normalizeStatus(raw: string | undefined): "scheduled" | "live" | "finished" | "postponed" {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("live") || s.includes("inprogress") || s === "1h" || s === "2h" || s === "ht") return "live";
  if (s.includes("finish") || s.includes("ft") || s.includes("ended") || s.includes("complete")) return "finished";
  if (s.includes("postpone") || s.includes("cancel") || s.includes("suspend")) return "postponed";
  return "scheduled";
}

let syncInProgress = false;

export async function syncMatchesFromTxline(): Promise<{ synced: number; errors: number; message: string }> {
  const apiKey = process.env["TXLINE_API_KEY"];
  if (!apiKey) {
    return { synced: 0, errors: 0, message: "TXLINE_API_KEY not set — sync skipped." };
  }

  if (syncInProgress) {
    return { synced: 0, errors: 0, message: "Sync already in progress." };
  }

  syncInProgress = true;
  let synced = 0;
  let errors = 0;

  try {
    const res = await fetch(`${TXLINE_BASE_URL}/api/fixtures?competition=FIFA_WORLD_CUP`, {
      headers: { "X-Api-Token": apiKey },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "TxLINE fixtures fetch failed");
      return { synced: 0, errors: 1, message: `TxLINE responded ${res.status}` };
    }

    const body = await res.json() as { fixtures?: TxlineFixture[]; data?: TxlineFixture[] };
    const fixtures: TxlineFixture[] = body.fixtures ?? body.data ?? [];

    for (const fix of fixtures) {
      try {
        const fixtureId = String(fix.id);
        const matchStatus = normalizeStatus(fix.status);

        const existing = await db
          .select({ id: matchesTable.id })
          .from(matchesTable)
          .where(eq(matchesTable.txlineFixtureId, fixtureId));

        if (existing.length === 0) {
          await db.insert(matchesTable).values({
            txlineFixtureId: fixtureId,
            tournament: fix.competition?.name ?? "FIFA World Cup 2026",
            stage: fix.round?.name ?? "Group Stage",
            homeTeam: fix.homeTeam?.name ?? "TBA",
            awayTeam: fix.awayTeam?.name ?? "TBA",
            kickoffAt: fix.kickoff ? new Date(fix.kickoff) : new Date(),
            status: matchStatus,
            homeScore: fix.homeScore ?? null,
            awayScore: fix.awayScore ?? null,
          });
        } else {
          await db
            .update(matchesTable)
            .set({
              status: matchStatus,
              homeScore: fix.homeScore ?? null,
              awayScore: fix.awayScore ?? null,
              homeTeam: fix.homeTeam?.name ?? "TBA",
              awayTeam: fix.awayTeam?.name ?? "TBA",
              stage: fix.round?.name ?? "Group Stage",
            })
            .where(eq(matchesTable.txlineFixtureId, fixtureId));
        }
        synced++;
      } catch (err) {
        logger.warn({ err, fixtureId: fix.id }, "Failed to upsert fixture");
        errors++;
      }
    }

    lastSyncAt = new Date().toISOString();
    cachedStatus = null;
    logger.info({ synced, errors }, "TxLINE sync complete");
    return { synced, errors, message: `Synced ${synced} fixtures (${errors} errors).` };
  } catch (err) {
    logger.error({ err }, "TxLINE sync failed");
    return { synced, errors: errors + 1, message: "Sync failed with network/parse error." };
  } finally {
    syncInProgress = false;
  }
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function startTxlinePolling(intervalMs = 60_000): void {
  if (pollingInterval) return;
  logger.info({ intervalMs }, "Starting TxLINE background polling");
  pollingInterval = setInterval(async () => {
    const apiKey = process.env["TXLINE_API_KEY"];
    if (!apiKey) return;
    await syncMatchesFromTxline().catch((err) =>
      logger.warn({ err }, "TxLINE background sync error"),
    );
  }, intervalMs);
}

export function stopTxlinePolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
