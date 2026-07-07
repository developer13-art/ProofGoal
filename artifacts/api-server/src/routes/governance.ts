import { Router, type IRouter } from "express";
import { and, count, eq } from "drizzle-orm";
import { db, governanceProposalsTable, votesTable } from "@workspace/db";
import {
  ListGovernanceProposalsQueryParams,
  ListGovernanceProposalsResponse,
  CreateGovernanceProposalBody,
  CreateGovernanceProposalResponse,
  GetGovernanceProposalParams,
  GetGovernanceProposalResponse,
  CastVoteParams,
  CastVoteBody,
  CastVoteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/governance/proposals", async (req, res): Promise<void> => {
  const parsed = ListGovernanceProposalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const proposals = await db
    .select()
    .from(governanceProposalsTable)
    .where(
      parsed.data.status
        ? eq(governanceProposalsTable.status, parsed.data.status)
        : undefined,
    )
    .orderBy(governanceProposalsTable.createdAt);

  res.json(ListGovernanceProposalsResponse.parse(proposals));
});

router.post("/governance/proposals", async (req, res): Promise<void> => {
  const parsed = CreateGovernanceProposalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(governanceProposalsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(CreateGovernanceProposalResponse.parse(created));
});

router.get(
  "/governance/proposals/:proposalId",
  async (req, res): Promise<void> => {
    const params = GetGovernanceProposalParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [proposal] = await db
      .select()
      .from(governanceProposalsTable)
      .where(eq(governanceProposalsTable.id, params.data.proposalId));

    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }

    res.json(GetGovernanceProposalResponse.parse(proposal));
  },
);

router.post(
  "/governance/proposals/:proposalId/votes",
  async (req, res): Promise<void> => {
    const params = CastVoteParams.safeParse(req.params);
    const body = CastVoteBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [proposal] = await db
      .select()
      .from(governanceProposalsTable)
      .where(eq(governanceProposalsTable.id, params.data.proposalId));

    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }

    const [existingVote] = await db
      .select()
      .from(votesTable)
      .where(
        and(
          eq(votesTable.proposalId, params.data.proposalId),
          eq(votesTable.walletAddress, body.data.walletAddress),
        ),
      );

    if (existingVote) {
      res.status(400).json({ error: "Wallet has already voted on this proposal" });
      return;
    }

    const [created] = await db
      .insert(votesTable)
      .values({
        proposalId: params.data.proposalId,
        walletAddress: body.data.walletAddress,
        choice: body.data.choice,
        weight: 1,
      })
      .returning();

    const [forVotesRow] = await db
      .select({ value: count() })
      .from(votesTable)
      .where(
        and(
          eq(votesTable.proposalId, params.data.proposalId),
          eq(votesTable.choice, "for"),
        ),
      );
    const [againstVotesRow] = await db
      .select({ value: count() })
      .from(votesTable)
      .where(
        and(
          eq(votesTable.proposalId, params.data.proposalId),
          eq(votesTable.choice, "against"),
        ),
      );

    await db
      .update(governanceProposalsTable)
      .set({
        votesFor: forVotesRow?.value ?? 0,
        votesAgainst: againstVotesRow?.value ?? 0,
      })
      .where(eq(governanceProposalsTable.id, params.data.proposalId));

    res.status(201).json(CastVoteResponse.parse(created));
  },
);

export default router;
