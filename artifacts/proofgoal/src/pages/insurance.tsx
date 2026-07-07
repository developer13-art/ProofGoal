import { useState } from "react";
import { useListInsuranceProducts, usePurchaseInsurancePolicy } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLamports } from "@/lib/format";
import { useAppWallet as useWallet } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";

export function InsurancePage() {
  const { data: productsRaw, isLoading } = useListInsuranceProducts({});
  const products = Array.isArray(productsRaw) ? productsRaw : [];
  const { walletAddress } = useWallet();
  const purchaseMutation = usePurchaseInsurancePolicy();
  const { toast } = useToast();
  const [coverageByProduct, setCoverageByProduct] = useState<Record<string, string>>({});

  const handlePurchase = async (productId: string, maxCoverageLamports: number) => {
    if (!walletAddress) {
      toast({ title: "Connect your wallet first", variant: "destructive" });
      return;
    }

    const coverageSol = coverageByProduct[productId];
    const coverageLamports = Math.round(Number(coverageSol || 0) * 1e9);

    if (!coverageLamports || coverageLamports <= 0) {
      toast({ title: "Enter a valid coverage amount", variant: "destructive" });
      return;
    }
    if (coverageLamports > maxCoverageLamports) {
      toast({ title: "Coverage exceeds product maximum", variant: "destructive" });
      return;
    }

    try {
      await purchaseMutation.mutateAsync({
        data: { walletAddress, productId, coverageLamports },
      });
      toast({ title: "Policy purchased successfully" });
    } catch (err) {
      toast({ title: "Failed to purchase policy", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insurance</h1>
        <p className="text-muted-foreground">
          Protect your positions and travel plans with on-chain coverage.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading insurance products...
        </div>
      ) : !products?.length ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
          No insurance products available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{product.type}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">{product.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-secondary rounded p-2">
                    <div className="text-muted-foreground">Premium</div>
                    <div className="font-bold">{(product.premiumRateBps / 100).toFixed(2)}%</div>
                  </div>
                  <div className="bg-secondary rounded p-2">
                    <div className="text-muted-foreground">Max Coverage</div>
                    <div className="font-bold">{formatLamports(product.maxCoverageLamports)} SOL</div>
                  </div>
                </div>
                <div className="mt-auto space-y-2">
                  <Input
                    type="number"
                    placeholder="Coverage amount (SOL)"
                    value={coverageByProduct[product.id] || ""}
                    onChange={(e) =>
                      setCoverageByProduct((prev) => ({ ...prev, [product.id]: e.target.value }))
                    }
                  />
                  <Button
                    className="w-full"
                    disabled={purchaseMutation.isPending}
                    onClick={() => handlePurchase(product.id, product.maxCoverageLamports)}
                  >
                    Purchase Policy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
