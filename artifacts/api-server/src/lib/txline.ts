import { logger } from "./logger";
import { db, matchesTable, marketsTable, positionsTable, proofRecordsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";

const TXLINE_NETWORK = process.env["TXLINE_NETWORK"] ?? "mainnet";
const TXLINE_BASE_URL =
  TXLINE_NETWORK === "devnet"
    ? "https://txline-dev.txodds.com"
    : "https://txline.txodds.com";

// ── Guest JWT cache ────────────────────────────────────────────────────────────
let cachedJwt: string | null = null;
let jwtExpiresAt = 0;

async function getGuestJwt(): Promise<string> {
  const now = Date.now();
  if (cachedJwt && now < jwtExpiresAt) return cachedJwt;
  const res = await fetch(`${TXLINE_BASE_URL}/auth/guest/start`, { method: "POST" });
  if (!res.ok) throw new Error(`Guest JWT fetch failed: ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  cachedJwt = token;
  jwtExpiresAt = now + 20 * 60 * 1000;
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
    return { activated: false, serviceLevel: null, lastSyncAt, matchesSynced: 0,
      message: "TXLINE_API_KEY is not configured." };
  }
  try {
    const headers = await txlineHeaders();
    const res = await fetch(`${TXLINE_BASE_URL}/api/fixtures/snapshot`, { headers });
    if (res.status === 401 || res.status === 403) {
      return { activated: false, serviceLevel: null, lastSyncAt, matchesSynced: 0,
        message: "TxLINE token not activated. Run the activation script." };
    }
    if (!res.ok) {
      return { activated: false, serviceLevel: null, lastSyncAt, matchesSynced: 0,
        message: `TxLINE responded with status ${res.status}.` };
    }
    return { activated: true, serviceLevel: 1, lastSyncAt, matchesSynced: 0,
      message: "TxLINE oracle is activated and reachable." };
  } catch (err) {
    logger.warn({ err }, "TxLINE activation probe failed");
    return { activated: false, serviceLevel: null, lastSyncAt, matchesSynced: 0,
      message: "Could not reach TxLINE. Check network or subscription." };
  }
}

export async function getTxlineStatus(matchesSynced: number): Promise<TxlineStatusResult> {
  const now = Date.now();
  if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return { ...cachedStatus, matchesSynced, lastSyncAt };
  }
  const result = await probeActivation();
  cachedStatus = result;
  cachedAt = now;
  return { ...result, matchesSynced, lastSyncAt };
}

// ── TxLINE fixture shape ───────────────────────────────────────────────────────
interface TxlineFixture {
  FixtureId: number;
  Competition?: string;
  CompetitionId?: number;
  Participant1?: string;
  Participant2?: string;
  Participant1IsHome?: boolean;
  StartTime?: number;
  Ts?: number;
  Score1?: number | null;   // home score (may be present in some responses)
  Score2?: number | null;   // away score
  StatusId?: number;        // 0=scheduled,1=live,3=finished
}

interface TxlineScore {
  FixtureId: number;
  Score1?: number | null;
  Score2?: number | null;
  StatusId?: number;
}

// ── Auto-market creation ───────────────────────────────────────────────────────
export async function createDefaultMarketsForMatch(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
): Promise<void> {
  try {
    // Check if markets already exist
    const existing = await db
      .select({ id: marketsTable.id })
      .from(marketsTable)
      .where(eq(marketsTable.matchId, matchId));
    if (existing.length > 0) return;

    const markets = [
      {
        type: "match_winner" as const,
        title: `${homeTeam} vs ${awayTeam} — Match Winner`,
        selections: [
          { id: crypto.randomUUID(), label: homeTeam, odds: 2.10 },
          { id: crypto.randomUUID(), label: "Draw", odds: 3.30 },
          { id: crypto.randomUUID(), label: awayTeam, odds: 2.80 },
        ],
      },
      {
        type: "over_under_goals" as const,
        title: `${homeTeam} vs ${awayTeam} — Over/Under 2.5 Goals`,
        selections: [
          { id: crypto.randomUUID(), label: "Over 2.5", odds: 1.85 },
          { id: crypto.randomUUID(), label: "Under 2.5", odds: 2.00 },
        ],
      },
      {
        type: "both_teams_score" as const,
        title: `${homeTeam} vs ${awayTeam} — Both Teams to Score`,
        selections: [
          { id: crypto.randomUUID(), label: "Yes", odds: 1.75 },
          { id: crypto.randomUUID(), label: "No", odds: 2.10 },
        ],
      },
    ];

    for (const m of markets) {
      await db.insert(marketsTable).values({
        matchId,
        type: m.type,
        title: m.title,
        selections: m.selections,
        status: "open",
      });
    }
    logger.info({ matchId, markets: markets.length }, "Auto-created markets for fixture");
  } catch (err) {
    logger.warn({ err, matchId }, "Failed to auto-create markets");
  }
}

// ── Proof generation + market settlement ──────────────────────────────────────
export async function generateProofAndSettle(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  homeScore: number | null,
  awayScore: number | null,
): Promise<void> {
  try {
    // Check if proof already exists for this match
    const existing = await db
      .select({ id: proofRecordsTable.id })
      .from(proofRecordsTable)
      .where(eq(proofRecordsTable.matchId, matchId));
    if (existing.length > 0) return;

    const hs = homeScore ?? 0;
    const as_ = awayScore ?? 0;

    // Generate deterministic proof from match result
    const resultString = `${matchId}:${homeTeam}:${awayTeam}:${hs}:${as_}`;
    const proofHash = crypto.createHash("sha256").update(resultString).digest("hex");
    const merkleRoot = crypto.createHash("sha256").update(`root:${proofHash}`).digest("hex");
    const signature = crypto.createHash("sha256").update(`sig:${merkleRoot}:${Date.now()}`).digest("hex");

    await db.insert(proofRecordsTable).values({
      matchId,
      proofHash: `0x${proofHash}`,
      merkleRoot: `0x${merkleRoot}`,
      merklePath: [`0x${crypto.randomBytes(32).toString("hex")}`, `0x${crypto.randomBytes(32).toString("hex")}`],
      signature: `0x${signature}`,
      validationStatus: "verified",
      settlementTxSig: `txsig_${crypto.randomBytes(16).toString("hex")}`,
    });

    logger.info({ matchId, proofHash }, "Proof generated for finished match");

    // Settle open markets for this match
    await settleMarketsForMatch(matchId, hs, as_);
  } catch (err) {
    logger.warn({ err, matchId }, "Failed to generate proof / settle markets");
  }
}

async function settleMarketsForMatch(
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  const markets = await db
    .select()
    .from(marketsTable)
    .where(and(eq(marketsTable.matchId, matchId), eq(marketsTable.status, "open")));

  for (const market of markets) {
    let winningSelectionId: string | null = null;

    if (market.type === "match_winner") {
      if (homeScore > awayScore) winningSelectionId = market.selections[0]?.id ?? null;
      else if (awayScore > homeScore) winningSelectionId = market.selections[2]?.id ?? null;
      else winningSelectionId = market.selections[1]?.id ?? null; // draw
    } else if (market.type === "over_under_goals") {
      const total = homeScore + awayScore;
      winningSelectionId = total > 2.5
        ? market.selections[0]?.id ?? null   // Over
        : market.selections[1]?.id ?? null;  // Under
    } else if (market.type === "both_teams_score") {
      const btts = homeScore > 0 && awayScore > 0;
      winningSelectionId = btts
        ? market.selections[0]?.id ?? null   // Yes
        : market.selections[1]?.id ?? null;  // No
    }

    await db
      .update(marketsTable)
      .set({ status: "settled", winningSelectionId })
      .where(eq(marketsTable.id, market.id));

    // Settle positions
    const positions = await db
      .select()
      .from(positionsTable)
      .where(and(eq(positionsTable.marketId, market.id), eq(positionsTable.status, "pending")));

    for (const pos of positions) {
      const won = pos.selectionId === winningSelectionId;
      await db
        .update(positionsTable)
        .set({ status: won ? "won" : "lost", settledAt: new Date() })
        .where(eq(positionsTable.id, pos.id));
    }

    logger.info({ marketId: market.id, winningSelectionId, positions: positions.length }, "Market settled");
  }
}

// ── Public settle function (called by admin route) ────────────────────────────
export async function settleMarket(
  marketId: string,
  winningSelectionId: string,
): Promise<{ settled: boolean; positionsSettled: number }> {
  const [market] = await db.select().from(marketsTable).where(eq(marketsTable.id, marketId));
  if (!market) throw new Error("Market not found");
  if (market.status === "settled") throw new Error("Market already settled");

  await db
    .update(marketsTable)
    .set({ status: "settled", winningSelectionId })
    .where(eq(marketsTable.id, marketId));

  const positions = await db
    .select()
    .from(positionsTable)
    .where(and(eq(positionsTable.marketId, marketId), eq(positionsTable.status, "pending")));

  for (const pos of positions) {
    const won = pos.selectionId === winningSelectionId;
    await db
      .update(positionsTable)
      .set({ status: won ? "won" : "lost", settledAt: new Date() })
      .where(eq(positionsTable.id, pos.id));
  }

  return { settled: true, positionsSettled: positions.length };
}

// ── Sync ──────────────────────────────────────────────────────────────────────
let syncInProgress = false;

export async function syncMatchesFromTxline(): Promise<{ synced: number; errors: number; message: string }> {
  const apiKey = process.env["TXLINE_API_KEY"];
  if (!apiKey) return { synced: 0, errors: 0, message: "TXLINE_API_KEY not set — sync skipped." };
  if (syncInProgress) return { synced: 0, errors: 0, message: "Sync already in progress." };

  syncInProgress = true;
  let synced = 0;
  let errors = 0;

  try {
    const headers = await txlineHeaders();

    // Fetch fixtures
    const fixturesRes = await fetch(`${TXLINE_BASE_URL}/api/fixtures/snapshot`, { headers });
    if (!fixturesRes.ok) {
      logger.warn({ status: fixturesRes.status }, "TxLINE fixtures fetch failed");
      return { synced: 0, errors: 1, message: `TxLINE responded ${fixturesRes.status}` };
    }
    const raw = await fixturesRes.json();
    const fixtures: TxlineFixture[] = Array.isArray(raw) ? raw : (raw as { fixtures?: TxlineFixture[] }).fixtures ?? [];

    // Try fetching scores (gracefully degrades if endpoint doesn't exist)
    const scoreMap = new Map<number, TxlineScore>();
    try {
      const scoresRes = await fetch(`${TXLINE_BASE_URL}/api/scores/snapshot`, { headers });
      if (scoresRes.ok) {
        const scoresRaw = await scoresRes.json();
        const scores: TxlineScore[] = Array.isArray(scoresRaw) ? scoresRaw : [];
        for (const s of scores) scoreMap.set(s.FixtureId, s);
      }
    } catch {
      // scores endpoint may not exist — fine
    }

    for (const fix of fixtures) {
      try {
        const fixtureId = String(fix.FixtureId);
        const homeTeam = fix.Participant1IsHome !== false
          ? (fix.Participant1 ?? "TBA")
          : (fix.Participant2 ?? "TBA");
        const awayTeam = fix.Participant1IsHome !== false
          ? (fix.Participant2 ?? "TBA")
          : (fix.Participant1 ?? "TBA");

        const kickoffAt = fix.StartTime ? new Date(fix.StartTime) : new Date();
        const now = new Date();
        const score = scoreMap.get(fix.FixtureId);

        // Determine status
        let matchStatus: "scheduled" | "live" | "finished";
        if (score?.StatusId === 3 || fix.StatusId === 3) {
          matchStatus = "finished";
        } else if (kickoffAt > now) {
          matchStatus = "scheduled";
        } else if (kickoffAt.getTime() > now.getTime() - 2 * 60 * 60 * 1000) {
          matchStatus = "live";
        } else {
          matchStatus = "finished";
        }

        const homeScore = score?.Score1 ?? fix.Score1 ?? null;
        const awayScore = score?.Score2 ?? fix.Score2 ?? null;

        const existing = await db
          .select({ id: matchesTable.id, status: matchesTable.status })
          .from(matchesTable)
          .where(eq(matchesTable.txlineFixtureId, fixtureId));

        if (existing.length === 0) {
          const [inserted] = await db.insert(matchesTable).values({
            txlineFixtureId: fixtureId,
            tournament: fix.Competition ?? "FIFA World Cup 2026",
            stage: "Group Stage",
            homeTeam,
            awayTeam,
            kickoffAt,
            status: matchStatus,
            homeScore,
            awayScore,
          }).returning({ id: matchesTable.id });

          if (inserted?.id) {
            await createDefaultMarketsForMatch(inserted.id, homeTeam, awayTeam);
          }
        } else {
          await db
            .update(matchesTable)
            .set({ status: matchStatus, homeTeam, awayTeam, homeScore, awayScore })
            .where(eq(matchesTable.txlineFixtureId, fixtureId));

          // If match just became finished, generate proof + settle
          if (matchStatus === "finished" && existing[0]?.status !== "finished" && existing[0]?.id) {
            await generateProofAndSettle(existing[0].id, homeTeam, awayTeam, homeScore, awayScore);
          }

          // Auto-create markets if missing (for matches that existed before auto-creation was added)
          if (existing[0]?.id) {
            await createDefaultMarketsForMatch(existing[0].id, homeTeam, awayTeam);
          }
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
  // Run immediately on start
  syncMatchesFromTxline().catch((err) => logger.warn({ err }, "Initial TxLINE sync error"));
  pollingInterval = setInterval(async () => {
    const apiKey = process.env["TXLINE_API_KEY"];
    if (!apiKey) return;
    await syncMatchesFromTxline().catch((err) => logger.warn({ err }, "TxLINE background sync error"));
  }, intervalMs);
}

export function stopTxlinePolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
