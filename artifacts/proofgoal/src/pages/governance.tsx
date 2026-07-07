import { useState } from "react";
import {
  useListGovernanceProposals,
  useCastVote,
  useListLiquidityPools,
  useCreateGovernanceProposal,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLamports } from "@/lib/format";
import { useAppWallet as useWallet } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { ProposalStatus } from "@workspace/api-zod";
import { useQueryClient } from "@tanstack/react-query";

const PROPOSAL_STATUSES = [
  { value: "", label: "All" },
  { value: ProposalStatus.active, label: "Active" },
  { value: ProposalStatus.passed, label: "Passed" },
  { value: ProposalStatus.rejected, label: "Rejected" },
  { value: ProposalStatus.expired, label: "Expired" },
];

export function GovernancePage() {
  const [filterStatus, setFilterStatus] = useState<ProposalStatus | "">("");
  const { data: proposalsRaw, isLoading } = useListGovernanceProposals({
    status: filterStatus ? (filterStatus as ProposalStatus) : undefined,
  });
  const { data: poolsRaw, isLoading: poolsLoading } = useListLiquidityPools();
  const proposals = Array.isArray(proposalsRaw) ? proposalsRaw : [];
  const pools = Array.isArray(poolsRaw) ? poolsRaw : [];
  const { walletAddress } = useWallet();
  const castVoteMutation = useCastVote();
  const createProposalMutation = useCreateGovernanceProposal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create proposal form state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");

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
      queryClient.invalidateQueries({ queryKey: ["governance"] });
    } catch {
      toast({ title: "Failed to cast vote — you may have already voted", variant: "destructive" });
    }
  };

  const handleCreateProposal = async () => {
    if (!walletAddress) {
      toast({ title: "Connect your wallet first", variant: "destructive" });
      return;
    }
    if (!newTitle.trim() || !newDesc.trim()) {
      toast({ title: "Title and description are required", variant: "destructive" });
      return;
    }
    try {
      await createProposalMutation.mutateAsync({
        data: {
          title: newTitle.trim(),
          description: newDesc.trim(),
          status: ProposalStatus.active,
          endsAt: newEndsAt ? new Date(newEndsAt).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          votesFor: 0,
          votesAgainst: 0,
        },
      });
      toast({ title: "Proposal created" });
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      setNewEndsAt("");
      queryClient.invalidateQueries({ queryKey: ["governance"] });
    } catch {
      toast({ title: "Failed to create proposal", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Governance & Liquidity</h1>
        <p className="text-sm text-muted-foreground">
          Vote on platform proposals and browse liquidity pools.
        </p>
      </div>

      {/* Proposals section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold">Proposals</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter pills */}
            <div className="flex flex-wrap gap-1 bg-secondary rounded-lg p-1">
              {PROPOSAL_STATUSES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilterStatus(opt.value as ProposalStatus | "")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filterStatus === opt.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Cancel" : "+ New Proposal"}
            </Button>
          </div>
        </div>

        {/* Create proposal form */}
        {showCreate && (
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold">Create Governance Proposal</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input
                    className="mt-1 text-sm"
                    placeholder="Proposal title…"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    className="mt-1 text-sm"
                    placeholder="Describe what you're proposing and why…"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Voting ends (optional)</Label>
                  <Input
                    type="datetime-local"
                    className="mt-1 text-sm"
                    value={newEndsAt}
                    onChange={(e) => setNewEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleCreateProposal}
                  disabled={createProposalMutation.isPending}
                >
                  {createProposalMutation.isPending ? "Submitting…" : "Submit Proposal"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
              {!walletAddress && (
                <p className="text-xs text-muted-foreground text-center">Connect your wallet to submit a proposal</p>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
            Loading proposals…
          </div>
        ) : !proposals.length ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
            No governance proposals yet. Be the first to submit one.
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((proposal) => {
              const totalVotes = proposal.votesFor + proposal.votesAgainst;
              const forPct = totalVotes > 0 ? Math.round((proposal.votesFor / totalVotes) * 100) : 0;
              const againstPct = totalVotes > 0 ? 100 - forPct : 0;
              return (
                <Card key={proposal.id}>
                  <CardHeader className="pb-2 p-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                      <CardTitle className="text-sm sm:text-base leading-snug">
                        {proposal.title}
                      </CardTitle>
                      <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold shrink-0 self-start ${
                        proposal.status === "active" ? "bg-green-500/10 text-green-600"
                        : proposal.status === "passed" ? "bg-blue-500/10 text-blue-600"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {proposal.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {proposal.description}
                    </p>

                    {/* Progress bar */}
                    {totalVotes > 0 && (
                      <div className="space-y-1">
                        <div className="flex h-2 rounded overflow-hidden bg-secondary">
                          <div className="bg-primary transition-all" style={{ width: `${forPct}%` }} />
                          <div className="bg-destructive/50 transition-all" style={{ width: `${againstPct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span className="text-primary">For: {proposal.votesFor} ({forPct}%)</span>
                          <span className="text-destructive/70">Against: {proposal.votesAgainst} ({againstPct}%)</span>
                        </div>
                      </div>
                    )}

                    {totalVotes === 0 && (
                      <div className="text-xs text-muted-foreground font-mono">No votes yet</div>
                    )}

                    {proposal.status === "active" && (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="flex-1 sm:flex-none bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/30"
                          variant="outline"
                          disabled={castVoteMutation.isPending}
                          onClick={() => handleVote(proposal.id, "for")}
                        >
                          👍 Vote For
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          disabled={castVoteMutation.isPending}
                          onClick={() => handleVote(proposal.id, "against")}
                        >
                          👎 Vote Against
                        </Button>
                        {proposal.endsAt && (
                          <span className="text-[10px] text-muted-foreground self-center ml-auto">
                            Ends {new Date(proposal.endsAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Liquidity Pools section */}
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold">Liquidity Pools</h2>
        {poolsLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
            Loading liquidity pools…
          </div>
        ) : !pools.length ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
            No liquidity pools available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {pools.map((pool) => (
              <Card key={pool.id}>
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-xs sm:text-sm uppercase tracking-wider">
                    {pool.marketType.replace(/_/g, " ")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="bg-secondary rounded p-2 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1">Liquidity</div>
                    <div className="font-bold">{formatLamports(pool.totalLiquidityLamports)}</div>
                  </div>
                  <div className="bg-secondary rounded p-2 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1">APR</div>
                    <div className="font-bold text-primary">{(pool.aprBps / 100).toFixed(1)}%</div>
                  </div>
                  <div className="bg-secondary rounded p-2 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1">LPs</div>
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
