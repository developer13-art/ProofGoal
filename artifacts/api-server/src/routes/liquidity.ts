import { Router, type IRouter } from "express";
import { db, liquidityPoolsTable } from "@workspace/db";
import { ListLiquidityPoolsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/liquidity/pools", async (_req, res): Promise<void> => {
  const pools = await db.select().from(liquidityPoolsTable);
  res.json(ListLiquidityPoolsResponse.parse(pools));
});

export default router;
