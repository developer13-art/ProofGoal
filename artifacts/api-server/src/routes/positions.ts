import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, marketsTable, positionsTable } from "@workspace/db";
import {
  ListPositionsQueryParams,
  ListPositionsResponse,
  CreatePositionBody,
  CreatePositionResponse,
  GetPositionParams,
  GetPositionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/positions", async (req, res): Promise<void> => {
  const parsed = ListPositionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const positions = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.walletAddress, parsed.data.walletAddress))
    .orderBy(positionsTable.placedAt);

  res.json(ListPositionsResponse.parse(positions));
});

router.post("/positions", async (req, res): Promise<void> => {
  const parsed = CreatePositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [market] = await db
    .select()
    .from(marketsTable)
    .where(eq(marketsTable.id, parsed.data.marketId));

  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  if (market.status !== "open") {
    res.status(400).json({ error: "Market is not open for new positions" });
    return;
  }

  const selection = market.selections.find(
    (s: { id: string; odds: number }) => s.id === parsed.data.selectionId,
  );
  if (!selection) {
    res.status(400).json({ error: "Selection not found on this market" });
    return;
  }

  const potentialPayoutLamports = Math.round(
    parsed.data.stakeLamports * selection.odds,
  );

  const [created] = await db
    .insert(positionsTable)
    .values({
      walletAddress: parsed.data.walletAddress,
      marketId: parsed.data.marketId,
      selectionId: parsed.data.selectionId,
      stakeLamports: parsed.data.stakeLamports,
      potentialPayoutLamports,
    })
    .returning();

  await db
    .update(marketsTable)
    .set({
      liquidityLamports: market.liquidityLamports + parsed.data.stakeLamports,
    })
    .where(eq(marketsTable.id, market.id));

  res.status(201).json(CreatePositionResponse.parse(created));
});

router.get("/positions/:positionId", async (req, res): Promise<void> => {
  const params = GetPositionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [position] = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.id, params.data.positionId));

  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  res.json(GetPositionResponse.parse(position));
});

export default router;
