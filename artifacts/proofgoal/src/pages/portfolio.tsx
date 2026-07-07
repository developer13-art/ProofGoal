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
      <div className="text-center py-16 border rounded border-dashed bg-card space-y-4 px-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to view positions and policies.
          </p>
        </div>
        <Button onClick={() => setVisible(true)}>Connect Wallet</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Your positions and insurance policies.</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading portfolio…
        </div>
      ) : portfolio ? (
        <>
          {/* Stats — 2×2 on mobile, 4 cols on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: "Total Staked", value: `${formatLamports(portfolio.totalStakedLamports)} SOL` },
              { label: "Premium Paid", value: `${formatLamports(portfolio.totalPremiumPaidLamports)} SOL` },
              { label: "Open Positions", value: portfolio.openPositions },
              { label: "Active Policies", value: portfolio.activePolicies },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="pb-1 p-3 sm:p-6">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Positions */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold">Positions</h2>
            {!portfolio.positions.length ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
                No positions yet.{" "}
                <Link href="/markets" className="text-primary hover:underline">
                  Browse markets →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {portfolio.positions.map((position) => (
                  <Card key={position.id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start sm:items-center justify-between gap-3">
                        <div className="flex flex-col gap-1 min-w-0">
                          <Link
                            href={`/markets/${position.marketId}`}
                            className="text-sm font-medium hover:text-primary truncate"
                          >
                            Market: {position.marketId}
                          </Link>
                          <span className="text-xs text-muted-foreground font-mono">
                            Stake: {formatLamports(position.stakeLamports)} SOL · Payout:{" "}
                            {formatLamports(position.potentialPayoutLamports)} SOL
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold shrink-0 ${
                            position.status === "won"
                              ? "bg-primary/10 text-primary"
                              : position.status === "lost"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {position.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Insurance Policies */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold">Insurance Policies</h2>
            {!portfolio.policies.length ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
                No policies yet.{" "}
                <Link href="/insurance" className="text-primary hover:underline">
                  Browse insurance →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {portfolio.policies.map((policy) => (
                  <Card key={policy.id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start sm:items-center justify-between gap-3">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-medium truncate">
                            Product: {policy.productId}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            Premium: {formatLamports(policy.premiumPaidLamports)} SOL · Coverage:{" "}
                            {formatLamports(policy.coverageLamports)} SOL
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold shrink-0 bg-muted text-muted-foreground">
                          {policy.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
