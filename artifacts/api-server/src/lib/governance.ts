/**
 * Governance background job: auto-resolve expired proposals.
 *
 * Finds all "active" proposals where endsAt <= now and sets:
 *   - "passed"   if votesFor > votesAgainst
 *   - "rejected" if votesAgainst >= votesFor AND votesFor > 0
 *   - "expired"  if there are zero votes
 */
import { lte, eq } from "drizzle-orm";
import { db, governanceProposalsTable } from "@workspace/db";
import { logger } from "./logger";

export async function resolveExpiredProposals(): Promise<void> {
  const now = new Date();

  const active = await db
    .select()
    .from(governanceProposalsTable)
    .where(eq(governanceProposalsTable.status, "active"));

  const expired = active.filter((p) => new Date(p.endsAt) <= now);

  for (const proposal of expired) {
    const { votesFor, votesAgainst } = proposal;

    let newStatus: "passed" | "rejected" | "expired";
    if (votesFor === 0 && votesAgainst === 0) {
      newStatus = "expired";
    } else if (votesFor > votesAgainst) {
      newStatus = "passed";
    } else {
      newStatus = "rejected";
    }

    await db
      .update(governanceProposalsTable)
      .set({ status: newStatus })
      .where(eq(governanceProposalsTable.id, proposal.id));

    logger.info(
      { proposalId: proposal.id, title: proposal.title, votesFor, votesAgainst, newStatus },
      "Governance proposal auto-resolved",
    );
  }
}

/**
 * Force-resolves a single proposal immediately, regardless of its `endsAt` time.
 * Used by admin tooling to close out a proposal early. Throws if the proposal
 * doesn't exist or isn't currently active.
 */
export async function forceResolveProposal(
  proposalId: string,
): Promise<{ id: string; status: "passed" | "rejected" | "expired" }> {
  const [proposal] = await db
    .select()
    .from(governanceProposalsTable)
    .where(eq(governanceProposalsTable.id, proposalId));

  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "active") throw new Error(`Proposal is already "${proposal.status}"`);

  const { votesFor, votesAgainst } = proposal;
  let newStatus: "passed" | "rejected" | "expired";
  if (votesFor === 0 && votesAgainst === 0) {
    newStatus = "expired";
  } else if (votesFor > votesAgainst) {
    newStatus = "passed";
  } else {
    newStatus = "rejected";
  }

  await db
    .update(governanceProposalsTable)
    .set({ status: newStatus })
    .where(eq(governanceProposalsTable.id, proposalId));

  logger.info({ proposalId, votesFor, votesAgainst, newStatus }, "Governance proposal force-resolved by admin");
  return { id: proposalId, status: newStatus };
}

let resolutionInterval: ReturnType<typeof setInterval> | null = null;

export function startGovernanceResolution(intervalMs = 60_000): void {
  if (resolutionInterval) return;
  logger.info({ intervalMs }, "Starting governance resolution background job");
  resolveExpiredProposals().catch((err) =>
    logger.warn({ err }, "Initial governance resolution error"),
  );
  resolutionInterval = setInterval(async () => {
    await resolveExpiredProposals().catch((err) =>
      logger.warn({ err }, "Governance resolution background error"),
    );
  }, intervalMs);
}

export function stopGovernanceResolution(): void {
  if (resolutionInterval) {
    clearInterval(resolutionInterval);
    resolutionInterval = null;
  }
}
