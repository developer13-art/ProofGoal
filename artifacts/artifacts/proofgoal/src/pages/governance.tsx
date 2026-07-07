import { useState } from "react";
import { useListGovernanceProposals, useCastVote, useListLiquidityPools } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatLamports } from "@/lib/format";
import { useAppWallet as useWallet } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { ProposalStatus } from "@workspace/api-zod";

export function GovernancePage() {
  const [filterStatus, setFilterStatus] = useState<ProposalStatus | undefined>();
  const { data: proposals, isLoading } = useListGovernanceProposals({ status: filterStatus });
  const { data: pools, isLoading: poolsLoading } = useListLiquidityPools();
  const { walletAddress } = useWallet();
  const castVoteMutation = useCastVote();
  const { toast } = useToast();

  const handleVote = async (proposalId: string, choice: "for" | "against") => {
    if (!walletAddress) {
      toast({ title: "Connect your wallet first", variant: "destructive" });
      return;
    }
    try {
      await castVoteMutation.mutateAsync({
        proposalId,
        data: { walletAddress, choice, weight: 1 },
      });
      toast({ title: "Vote cast successfully" });
    } catch (err) {
      toast({ title: "Failed to cast vote", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Governance & Liquidity</h1>
        <p className="text-muted-foreground">Vote on platform proposals and browse liquidity pools.</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-bold">Proposals</h2>
          <select
            className="flex h-9 w-full md:w-auto items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
            value={filterStatus || ""}
            onChange={(e) => setFilterStatus((e.target.value as ProposalStatus) || undefined)}
          >
            <option value="">All Statuses</option>
            <option value={ProposalStatus.active}>Active</option>
            <option value={ProposalStatus.passed}>Passed</option>
            <option value={ProposalStatus.rejected}>Rejected</option>
            <option value={ProposalStatus.expired}>Expired</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
            Loading proposals...
          </div>
        ) : !proposals?.length ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
            No governance proposals yet.
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((proposal) => (
              <Card key={proposal.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg">{proposal.title}</CardTitle>
                    <span className="text-xs px-2 py-1 rounded-full uppercase tracking-wider font-bold bg-muted text-muted-foreground shrink-0">
                      {proposal.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{proposal.description}</p>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span>For: {proposal.votesFor}</span>
                    <span>Against: {proposal.votesAgainst}</span>
                  </div>
                  {proposal.status === "active" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={castVoteMutation.isPending}
                        onClick={() => handleVote(proposal.id, "for")}
                      >
                        Vote For
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={castVoteMutation.isPending}
                        onClick={() => handleVote(proposal.id, "against")}
                      >
                        Vote Against
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Liquidity Pools</h2>
        {poolsLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
            Loading liquidity pools...
          </div>
        ) : !pools?.length ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
            No liquidity pools available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.map((pool) => (
              <Card key={pool.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base uppercase tracking-wider">{pool.marketType.replace(/_/g, " ")}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="bg-secondary rounded p-2 text-center">
                    <div className="text-muted-foreground">Liquidity</div>
                    <div className="font-bold">{formatLamports(pool.totalLiquidityLamports)}</div>
                  </div>
                  <div className="bg-secondary rounded p-2 text-center">
                    <div className="text-muted-foreground">APR</div>
                    <div className="font-bold">{(pool.aprBps / 100).toFixed(2)}%</div>
                  </div>
                  <div className="bg-secondary rounded p-2 text-center">
                    <div className="text-muted-foreground">Providers</div>
                    <div className="font-bold">{pool.providerCount}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
