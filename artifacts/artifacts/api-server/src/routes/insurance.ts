import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  insuranceProductsTable,
  insurancePoliciesTable,
} from "@workspace/db";
import {
  ListInsuranceProductsQueryParams,
  ListInsuranceProductsResponse,
  CreateInsuranceProductBody,
  CreateInsuranceProductResponse,
  GetInsuranceProductParams,
  GetInsuranceProductResponse,
  ListInsurancePoliciesQueryParams,
  ListInsurancePoliciesResponse,
  PurchaseInsurancePolicyBody,
  PurchaseInsurancePolicyResponse,
  GetInsurancePolicyParams,
  GetInsurancePolicyResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/insurance/products", async (req, res): Promise<void> => {
  const parsed = ListInsuranceProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const products = await db
    .select()
    .from(insuranceProductsTable)
    .where(
      parsed.data.type
        ? eq(insuranceProductsTable.type, parsed.data.type)
        : undefined,
    )
    .orderBy(insuranceProductsTable.createdAt);

  res.json(ListInsuranceProductsResponse.parse(products));
});

router.post("/insurance/products", async (req, res): Promise<void> => {
  const parsed = CreateInsuranceProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(insuranceProductsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(CreateInsuranceProductResponse.parse(created));
});

router.get(
  "/insurance/products/:productId",
  async (req, res): Promise<void> => {
    const params = GetInsuranceProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [product] = await db
      .select()
      .from(insuranceProductsTable)
      .where(eq(insuranceProductsTable.id, params.data.productId));

    if (!product) {
      res.status(404).json({ error: "Insurance product not found" });
      return;
    }

    res.json(GetInsuranceProductResponse.parse(product));
  },
);

router.get("/insurance/policies", async (req, res): Promise<void> => {
  const parsed = ListInsurancePoliciesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const policies = await db
    .select()
    .from(insurancePoliciesTable)
    .where(eq(insurancePoliciesTable.walletAddress, parsed.data.walletAddress))
    .orderBy(insurancePoliciesTable.purchasedAt);

  res.json(ListInsurancePoliciesResponse.parse(policies));
});

router.post("/insurance/policies", async (req, res): Promise<void> => {
  const parsed = PurchaseInsurancePolicyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(insuranceProductsTable)
    .where(eq(insuranceProductsTable.id, parsed.data.productId));

  if (!product) {
    res.status(404).json({ error: "Insurance product not found" });
    return;
  }

  if (parsed.data.coverageLamports > product.maxCoverageLamports) {
    res
      .status(400)
      .json({ error: "Requested coverage exceeds product maximum" });
    return;
  }

  const premiumPaidLamports = Math.round(
    (parsed.data.coverageLamports * product.premiumRateBps) / 10_000,
  );

  const [created] = await db
    .insert(insurancePoliciesTable)
    .values({
      walletAddress: parsed.data.walletAddress,
      productId: parsed.data.productId,
      matchId: parsed.data.matchId ?? null,
      premiumPaidLamports,
      coverageLamports: parsed.data.coverageLamports,
    })
    .returning();

  res.status(201).json(PurchaseInsurancePolicyResponse.parse(created));
});

router.get(
  "/insurance/policies/:policyId",
  async (req, res): Promise<void> => {
    const params = GetInsurancePolicyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [policy] = await db
      .select()
      .from(insurancePoliciesTable)
      .where(eq(insurancePoliciesTable.id, params.data.policyId));

    if (!policy) {
      res.status(404).json({ error: "Insurance policy not found" });
      return;
    }

    res.json(GetInsurancePolicyResponse.parse(policy));
  },
);

export default router;
