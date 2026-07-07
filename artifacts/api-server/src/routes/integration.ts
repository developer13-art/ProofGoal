import { Router, type IRouter } from "express";
import { count } from "drizzle-orm";
import { db, matchesTable } from "@workspace/db";
import { GetTxlineStatusResponse } from "@workspace/api-zod";
import { getTxlineStatus, syncMatchesFromTxline } from "../lib/txline";

const router: IRouter = Router();

router.get("/integration/txline", async (_req, res): Promise<void> => {
  const [row] = await db.select({ value: count() }).from(matchesTable);
  const status = await getTxlineStatus(row?.value ?? 0);
  res.json(GetTxlineStatusResponse.parse(status));
});

router.post("/integration/txline/sync", async (_req, res): Promise<void> => {
  const result = await syncMatchesFromTxline();
  res.json(result);
});

export default router;
