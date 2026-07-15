import { Router, type IRouter } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import {
  db,
  proofRecordsTable,
  matchesTable,
  marketsTable,
  positionsTable,
  insurancePoliciesTable,
  insuranceProductsTable,
} from "@workspace/db";
import {
  ListProofRecordsQueryParams,
  ListProofRecordsResponse,
  GetProofRecordParams,
  GetProofRecordResponse,
  GetProofRecordDetailsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/proofs", async (req, res): Promise<void> => {
  const parsed = ListProofRecordsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.matchId) {
    conditions.push(eq(proofRecordsTable.matchId, parsed.data.matchId));
  }
  if (parsed.data.status) {
    conditions.push(
      eq(proofRecordsTable.validationStatus, parsed.data.status),
    );
  }

  const proofs = await db
    .select()
    .from(proofRecordsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(proofRecordsTable.createdAt));

  res.json(ListProofRecordsResponse.parse(proofs));
});

router.get("/proofs/:proofId", async (req, res): Promise<void> => {
  const params = GetProofRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [proof] = await db
    .select()
    .from(proofRecordsTable)
    .where(eq(proofRecordsTable.id, params.data.proofId));

  if (!proof) {
    res.status(404).json({ error: "Proof record not found" });
    return;
  }

  res.json(GetProofRecordResponse.parse(proof));
});

router.get("/proofs/:proofId/details", async (req, res): Promise<void> => {
  const params = GetProofRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [proof] = await db
    .select()
    .from(proofRecordsTable)
    .where(eq(proofRecordsTable.id, params.data.proofId));

  if (!proof) {
    res.status(404).json({ error: "Proof record not found" });
    return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, proof.matchId));

  const markets = match
    ? await db.select().from(marketsTable).where(eq(marketsTable.matchId, match.id))
    : [];

  const marketSummaries = await Promise.all(
    markets.map(async (market) => {
      const positions = await db
        .select({ status: positionsTable.status })
        .from(positionsTable)
        .where(eq(positionsTable.marketId, market.id));

      const winningSelection =
        market.selections.find((s) => s.id === market.winningSelectionId) ?? null;

      return {
        id: market.id,
        type: market.type,
        title: market.title,
        status: market.status,
        selections: market.selections,
        winningSelectionId: market.winningSelectionId,
        winningSelectionLabel: winningSelection?.label ?? null,
        totalPositions: positions.length,
        wonPositions: positions.filter((p) => p.status === "won").length,
        lostPositions: positions.filter((p) => p.status === "lost").length,
        claimedPositions: positions.filter((p) => p.status === "claimed").length,
      };
    }),
  );

  const policiesWithProduct = match
    ? await db
        .select({
          id: insurancePoliciesTable.id,
          walletAddress: insurancePoliciesTable.walletAddress,
          status: insurancePoliciesTable.status,
          coverageLamports: insurancePoliciesTable.coverageLamports,
          selectedTeam: insurancePoliciesTable.selectedTeam,
          claimTxSig: insurancePoliciesTable.claimTxSig,
          productName: insuranceProductsTable.name,
          productType: insuranceProductsTable.type,
        })
        .from(insurancePoliciesTable)
        .innerJoin(
          insuranceProductsTable,
          eq(insurancePoliciesTable.productId, insuranceProductsTable.id),
        )
        .where(eq(insurancePoliciesTable.matchId, match.id))
    : [];

  let marketCountRow: { value: number } | undefined;
  if (match) {
    [marketCountRow] = await db
      .select({ value: count() })
      .from(marketsTable)
      .where(eq(marketsTable.matchId, match.id));
  }

  res.json(
    GetProofRecordDetailsResponse.parse({
      ...proof,
      match: match
        ? { ...match, marketCount: marketCountRow?.value ?? 0, proofStatus: proof.validationStatus }
        : null,
      markets: marketSummaries,
      insurancePolicies: policiesWithProduct,
    }),
  );
});

export default router;
