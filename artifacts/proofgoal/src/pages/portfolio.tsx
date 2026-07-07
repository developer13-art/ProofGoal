import { useGetPortfolioSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLamports } from "@/lib/format";
import { useAppWallet as useWallet } from "@/lib/wallet";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PortfolioSummary } from "@workspace/api-zod";

export function PortfolioPage() {
  const { walletAddress } = useWallet();
  const { setVisible } = useWalletModal();
  const { data: portfolio, isLoading } = useGetPortfolioSummary<PortfolioSummary>(
    walletAddress ?? "",
    { query: { enabled: Boolean(walletAddress) } as never },
  );

  if (!walletAddress) {
    return (
      <div className="text-center py-20 border rounded border-dashed bg-card space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-muted-foreground">Connect your wallet to view positions and policies.</p>
        </div>
        <Button onClick={() => setVisible(true)}>Connect Wallet</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground">Your positions and insurance policies.</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading portfolio...
        </div>
      ) : portfolio ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Staked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatLamports(portfolio.totalStakedLamports)} SOL</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Premium Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatLamports(portfolio.totalPremiumPaidLamports)} SOL</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Open Positions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{portfolio.openPositions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Policies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{portfolio.activePolicies}</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">Positions</h2>
            {!portfolio.positions.length ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
                No positions placed yet. <Link href="/markets" className="text-primary hover:underline">Browse markets →</Link>
              </div>
            ) : (
              portfolio.positions.map((position) => (
                <Card key={position.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <Link href={`/markets/${position.marketId}`} className="text-sm font-medium hover:text-primary">
                        Market: {position.marketId}
                      </Link>
                      <span className="text-xs text-muted-foreground font-mono">
                        Stake: {formatLamports(position.stakeLamports)} SOL · Potential: {formatLamports(position.potentialPayoutLamports)} SOL
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full uppercase tracking-wider font-bold shrink-0 ${
                      position.status === "won" ? "bg-primary/10 text-primary" :
                      position.status === "lost" ? "bg-destructive/10 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {position.status}
                    </span>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">Insurance Policies</h2>
            {!portfolio.policies.length ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
                No insurance policies yet. <Link href="/insurance" className="text-primary hover:underline">Browse insurance →</Link>
              </div>
            ) : (
              portfolio.policies.map((policy) => (
                <Card key={policy.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">Product: {policy.productId}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        Premium: {formatLamports(policy.premiumPaidLamports)} SOL · Coverage: {formatLamports(policy.coverageLamports)} SOL
                      </span>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full uppercase tracking-wider font-bold shrink-0 bg-muted text-muted-foreground">
                      {policy.status}
                    </span>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
