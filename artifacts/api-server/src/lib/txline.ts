import { logger } from "./logger";
import { db, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TXLINE_NETWORK = process.env["TXLINE_NETWORK"] ?? "mainnet";
const TXLINE_BASE_URL =
  TXLINE_NETWORK === "devnet"
    ? "https://txline-dev.txodds.com"
    : "https://txline.txodds.com";

// ── Guest JWT cache ───────────────────────────────────────────────────────────
// The fixtures/snapshot endpoint requires BOTH a guest JWT and the X-Api-Token.
// Guest JWTs are short-lived (~30 min); we cache and refresh as needed.
let cachedJwt: string | null = null;
let jwtExpiresAt = 0;

async function getGuestJwt(): Promise<string> {
  const now = Date.now();
  if (cachedJwt && now < jwtExpiresAt) return cachedJwt;
  const res = await fetch(`${TXLINE_BASE_URL}/auth/guest/start`, { method: "POST" });
  if (!res.ok) throw new Error(`Guest JWT fetch failed: ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  cachedJwt = token;
  jwtExpiresAt = now + 20 * 60 * 1000; // refresh every 20 min (JWT likely valid 30)
  return token;
}

async function txlineHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env["TXLINE_API_KEY"];
  if (!apiKey) throw new Error("TXLINE_API_KEY not set");
  const jwt = await getGuestJwt();
  return { "X-Api-Token": apiKey, Authorization: `Bearer ${jwt}` };
}

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
    const headers = await txlineHeaders();
    const res = await fetch(`${TXLINE_BASE_URL}/api/fixtures/snapshot`, { headers });

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

// TxLINE API returns PascalCase fields in the fixtures/snapshot response.
interface TxlineFixture {
  FixtureId: number;
  Competition?: string;
  CompetitionId?: number;
  Participant1?: string;   // home team (when Participant1IsHome is true)
  Participant2?: string;   // away team
  Participant1IsHome?: boolean;
  StartTime?: number;      // epoch milliseconds
  Ts?: number;             // record timestamp ms
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
    const headers = await txlineHeaders();
    const res = await fetch(`${TXLINE_BASE_URL}/api/fixtures/snapshot`, { headers });

    if (!res.ok) {
      logger.warn({ status: res.status }, "TxLINE fixtures fetch failed");
      return { synced: 0, errors: 1, message: `TxLINE responded ${res.status}` };
    }

    // The snapshot endpoint returns a plain array of fixture objects.
    const raw = await res.json();
    const fixtures: TxlineFixture[] = Array.isArray(raw) ? raw : (raw as { fixtures?: TxlineFixture[] }).fixtures ?? [];

    for (const fix of fixtures) {
      try {
        const fixtureId = String(fix.FixtureId);

        // Determine home/away based on Participant1IsHome flag.
        const homeTeam = fix.Participant1IsHome !== false
          ? (fix.Participant1 ?? "TBA")
          : (fix.Participant2 ?? "TBA");
        const awayTeam = fix.Participant1IsHome !== false
          ? (fix.Participant2 ?? "TBA")
          : (fix.Participant1 ?? "TBA");

        const kickoffAt = fix.StartTime ? new Date(fix.StartTime) : new Date();
        const now = new Date();
        // Determine status from kickoff time; score updates come from the scores endpoint.
        const matchStatus: "scheduled" | "live" | "finished" =
          kickoffAt > now ? "scheduled"
          : kickoffAt.getTime() > now.getTime() - 2 * 60 * 60 * 1000 ? "live"
          : "finished";

        const existing = await db
          .select({ id: matchesTable.id })
          .from(matchesTable)
          .where(eq(matchesTable.txlineFixtureId, fixtureId));

        if (existing.length === 0) {
          await db.insert(matchesTable).values({
            txlineFixtureId: fixtureId,
            tournament: fix.Competition ?? "FIFA World Cup 2026",
            stage: "Group Stage",
            homeTeam,
            awayTeam,
            kickoffAt,
            status: matchStatus,
            homeScore: null,
            awayScore: null,
          });
        } else {
          await db
            .update(matchesTable)
            .set({ status: matchStatus, homeTeam, awayTeam })
            .where(eq(matchesTable.txlineFixtureId, fixtureId));
        }
        synced++;
      } catch (err) {
        logger.warn({ err, fixtureId: fix.FixtureId }, "Failed to upsert fixture");
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
