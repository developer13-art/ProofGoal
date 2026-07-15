import { useState, useEffect, useCallback } from "react";
import { useListMatches, useListMarkets, useListInsuranceProducts, useListGovernanceProposals, useListLiquidityPools } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatLamports, shortenAddress } from "@/lib/format";
import {
  RefreshCw, ShieldCheck, TrendingUp, Trophy, Scale, CheckCircle2, Lock,
  Wallet, Users, Landmark, Droplets, LayoutDashboard, Gavel,
} from "lucide-react";

const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || "proofgoal-admin";
const API = "/api";

function apiFetch(path: string, body?: object) {
  return fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState("");
  const { toast } = useToast();
  const tryAuth = () => {
    if (pw === ADMIN_KEY) { onAuth(); }
    else toast({ title: "Wrong password", variant: "destructive" });
  };
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock size={18} /> Admin Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Enter the admin password to manage the platform.</p>
          <Input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryAuth()}
          />
          <Button className="w-full" onClick={tryAuth}>Unlock</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function Stat({ label, value, color = "" }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-secondary rounded-lg p-3 text-center">
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon size={16} /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── Treasury wallet card ──────────────────────────────────────────────────────
interface TreasuryInfo {
  configured: boolean;
  address: string | null;
  balanceSol: number;
  network: string | null;
  error?: string;
}

function TreasuryCard() {
  const [treasury, setTreasury] = useState<TreasuryInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/admin/treasury");
      const d = await r.json();
      if (!r.ok) { setTreasury({ configured: true, address: null, balanceSol: 0, network: null, error: d.error }); return; }
      setTreasury(d);
    } catch {
      setTreasury({ configured: false, address: null, balanceSol: 0, network: null, error: "Failed to reach server" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 sm:p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Landmark size={12} /> Treasury Wallet {treasury?.network && `(${treasury.network})`}
          </p>
          {treasury?.error ? (
            <p className="text-sm text-red-500">{treasury.error}</p>
          ) : treasury && !treasury.configured ? (
            <p className="text-sm text-muted-foreground">Not configured — set TREASURY_WALLET_PRIVATE_KEY.</p>
          ) : (
            <p className="text-2xl sm:text-3xl font-bold font-mono">
              {treasury ? `${treasury.balanceSol.toFixed(4)} SOL` : "Loading…"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {treasury?.address && (
            <span className="text-[10px] font-mono text-muted-foreground bg-secondary rounded px-2 py-1">
              {shortenAddress(treasury.address)}
            </span>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main admin panel ──────────────────────────────────────────────────────────
function AdminPanel() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [creatingAll, setCreatingAll] = useState(false);

  const { data: matchesRaw, refetch: refetchMatches } = useListMatches();
  const { data: marketsRaw, refetch: refetchMarkets } = useListMarkets({});
  const { data: productsRaw, refetch: refetchProducts } = useListInsuranceProducts({});
  const { data: proposalsRaw, refetch: refetchProposals } = useListGovernanceProposals({});
  const { data: poolsRaw, refetch: refetchPools } = useListLiquidityPools();

  const matches = Array.isArray(matchesRaw) ? matchesRaw : [];
  const markets = Array.isArray(marketsRaw) ? marketsRaw : [];
  const products = Array.isArray(productsRaw) ? productsRaw : [];
  const proposals = Array.isArray(proposalsRaw) ? proposalsRaw : [];
  const pools = Array.isArray(poolsRaw) ? poolsRaw : [];

  const loadStats = useCallback(async () => {
    const r = await apiFetch("/admin/stats");
    if (r.ok) setStats(await r.json());
  }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Sync ────────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await apiFetch("/admin/sync");
      const d = await r.json();
      toast({ title: "Sync complete", description: d.message });
      await loadStats();
      refetchMatches();
      refetchMarkets();
    } catch { toast({ title: "Sync failed", variant: "destructive" }); }
    finally { setSyncing(false); }
  };

  // ── Create all markets ──────────────────────────────────────────────────────
  const handleCreateAll = async () => {
    setCreatingAll(true);
    try {
      const r = await apiFetch("/admin/markets/create-all");
      const d = await r.json();
      toast({ title: "Markets created", description: d.message });
      refetchMarkets();
      await loadStats();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setCreatingAll(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage every action and feature on ProofGoal</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={14} className={`mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync TxLINE"}
          </Button>
          <Button size="sm" onClick={handleCreateAll} disabled={creatingAll}>
            <TrendingUp size={14} className="mr-1" />
            {creatingAll ? "Creating…" : "Create All Markets"}
          </Button>
        </div>
      </div>

      {/* Treasury */}
      <TreasuryCard />

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          <Stat label="Matches" value={stats.matches ?? 0} />
          <Stat label="Markets" value={stats.markets ?? 0} />
          <Stat label="Open" value={stats.openMarkets ?? 0} color="text-green-600" />
          <Stat label="Settled" value={stats.settledMarkets ?? 0} color="text-blue-600" />
          <Stat label="Positions" value={stats.positions ?? 0} />
          <Stat label="Users" value={stats.users ?? 0} />
          <Stat label="Ins. Products" value={stats.insuranceProducts ?? 0} />
          <Stat label="Policies" value={stats.insurancePolicies ?? 0} />
          <Stat label="Proposals" value={stats.governanceProposals ?? 0} />
          <Stat label="Liquidity Pools" value={stats.liquidityPools ?? 0} />
          <Stat label="Proofs" value={stats.proofs ?? 0} color="text-primary" />
          <Stat label="Total Volume" value={`${formatLamports(stats.totalVolumeLamports ?? 0)} SOL`} color="text-amber-600" />
        </div>
      )}

      <Tabs defaultValue="markets" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="markets" className="text-xs gap-1"><TrendingUp size={13} /> Markets</TabsTrigger>
          <TabsTrigger value="matches" className="text-xs gap-1"><Trophy size={13} /> Matches &amp; Proofs</TabsTrigger>
          <TabsTrigger value="insurance" className="text-xs gap-1"><ShieldCheck size={13} /> Insurance</TabsTrigger>
          <TabsTrigger value="governance" className="text-xs gap-1"><Scale size={13} /> Governance</TabsTrigger>
          <TabsTrigger value="liquidity" className="text-xs gap-1"><Droplets size={13} /> Liquidity</TabsTrigger>
          <TabsTrigger value="users" className="text-xs gap-1"><Users size={13} /> Users</TabsTrigger>
          <TabsTrigger value="positions" className="text-xs gap-1"><LayoutDashboard size={13} /> All Positions</TabsTrigger>
        </TabsList>

        {/* Markets */}
        <TabsContent value="markets" className="space-y-4 mt-4">
          <Section title="Markets" icon={TrendingUp}>
            <div className="space-y-4">
              {markets.filter((m) => m.status === "open").length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Open Markets — click to settle</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {markets.filter((m) => m.status === "open").map((market) => (
                      <SettleMarketRow key={market.id} market={market} onSettled={() => { refetchMarkets(); loadStats(); }} />
                    ))}
                  </div>
                </div>
              )}
              <CreateMarketForm matches={matches} onCreated={() => { refetchMarkets(); loadStats(); }} />
            </div>
          </Section>
        </TabsContent>

        {/* Matches & proofs */}
        <TabsContent value="matches" className="space-y-4 mt-4">
          <Section title="Matches & Proofs" icon={Trophy}>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {matches.map((match) => (
                <MatchProofRow key={match.id} match={match} onProofGenerated={loadStats} />
              ))}
            </div>
          </Section>
        </TabsContent>

        {/* Insurance */}
        <TabsContent value="insurance" className="space-y-4 mt-4">
          <Section title="Insurance Products" icon={ShieldCheck}>
            <div className="space-y-4">
              {products.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {products.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs p-2 bg-secondary rounded">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground">{(p.premiumRateBps / 100).toFixed(1)}% premium</span>
                    </div>
                  ))}
                </div>
              )}
              <CreateInsuranceForm onCreated={() => { refetchProducts(); loadStats(); }} />
            </div>
          </Section>
          <Section title="All Insurance Policies" icon={ShieldCheck}>
            <PoliciesTable />
          </Section>
        </TabsContent>

        {/* Governance */}
        <TabsContent value="governance" className="space-y-4 mt-4">
          <Section title="Governance Proposals" icon={Scale}>
            <div className="space-y-4">
              {proposals.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {proposals.map((p) => (
                    <ProposalRow key={p.id} proposal={p} onResolved={() => { refetchProposals(); loadStats(); }} />
                  ))}
                </div>
              )}
              <CreateProposalForm onCreated={() => { refetchProposals(); loadStats(); }} />
            </div>
          </Section>
        </TabsContent>

        {/* Liquidity */}
        <TabsContent value="liquidity" className="space-y-4 mt-4">
          <Section title="Liquidity Pools" icon={Droplets}>
            <div className="space-y-4">
              {pools.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {pools.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs p-2 bg-secondary rounded">
                      <span className="font-medium">{String(p.marketType).replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground font-mono">
                        {formatLamports(p.totalLiquidityLamports)} SOL · {(p.aprBps / 100).toFixed(1)}% APR · {p.providerCount} LPs
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <CreateLiquidityPoolForm onCreated={() => { refetchPools(); loadStats(); }} />
            </div>
          </Section>
          <Section title="All Liquidity Positions" icon={Droplets}>
            <LiquidityPositionsTable />
          </Section>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Section title="Registered Users" icon={Users}>
            <UsersTable />
          </Section>
        </TabsContent>

        {/* Positions */}
        <TabsContent value="positions" className="space-y-4 mt-4">
          <Section title="All Positions (every wallet)" icon={LayoutDashboard}>
            <PositionsTable />
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Generic admin list table hook ─────────────────────────────────────────────
function useAdminList<T>(path: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(path);
      if (r.ok) setRows(await r.json());
    } finally { setLoading(false); }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load };
}

// ── Users table ────────────────────────────────────────────────────────────────
interface AdminUser { id: string; walletAddress: string; createdAt: string }

function UsersTable() {
  const { rows, loading } = useAdminList<AdminUser>("/admin/users");
  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No users yet.</p>;
  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {rows.map((u) => (
        <div key={u.id} className="flex justify-between items-center text-xs p-2 bg-secondary rounded">
          <span className="font-mono">{shortenAddress(u.walletAddress)}</span>
          <span className="text-muted-foreground">{new Date(u.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── Positions table (platform-wide) ───────────────────────────────────────────
interface AdminPosition {
  id: string; walletAddress: string; marketTitle: string | null;
  stakeLamports: number; potentialPayoutLamports: number; status: string; placedAt: string;
}

const POSITION_STATUS_COLOR: Record<string, string> = {
  pending: "secondary", won: "default", lost: "outline", claimed: "default", void: "outline",
};

function PositionsTable() {
  const { rows, loading } = useAdminList<AdminPosition>("/admin/positions");
  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No positions yet.</p>;
  return (
    <div className="space-y-1 max-h-[32rem] overflow-y-auto">
      {rows.map((p) => (
        <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-secondary rounded gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{p.marketTitle ?? "—"}</p>
            <p className="font-mono text-muted-foreground">{shortenAddress(p.walletAddress)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono">{formatLamports(p.stakeLamports)} SOL</span>
            <Badge variant={(POSITION_STATUS_COLOR[p.status] as any) ?? "secondary"} className="text-[10px]">{p.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Insurance policies table (platform-wide) ──────────────────────────────────
interface AdminPolicy {
  id: string; walletAddress: string; productName: string | null;
  premiumPaidLamports: number; coverageLamports: number; status: string; purchasedAt: string;
}

function PoliciesTable() {
  const { rows, loading } = useAdminList<AdminPolicy>("/admin/insurance/policies");
  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No policies purchased yet.</p>;
  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {rows.map((p) => (
        <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-secondary rounded gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{p.productName ?? "—"}</p>
            <p className="font-mono text-muted-foreground">{shortenAddress(p.walletAddress)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono">{formatLamports(p.coverageLamports)} SOL cover</span>
            <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Liquidity positions table (platform-wide) ─────────────────────────────────
interface AdminLiquidityPosition {
  id: string; walletAddress: string; marketType: string | null;
  depositedLamports: number; accruedYieldLamports: number; depositedAt: string;
}

function LiquidityPositionsTable() {
  const { rows, loading } = useAdminList<AdminLiquidityPosition>("/admin/liquidity/positions");
  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No liquidity positions yet.</p>;
  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {rows.map((p) => (
        <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-secondary rounded gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{p.marketType?.replace(/_/g, " ") ?? "—"}</p>
            <p className="font-mono text-muted-foreground">{shortenAddress(p.walletAddress)}</p>
          </div>
          <span className="font-mono shrink-0">
            {formatLamports(p.depositedLamports)} SOL + {formatLamports(p.accruedYieldLamports)} yield
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Settle market row ─────────────────────────────────────────────────────────
function SettleMarketRow({
  market,
  onSettled,
}: {
  market: { id: string; title: string; selections: { id: string; label: string; odds: number }[] };
  onSettled: () => void;
}) {
  const { toast } = useToast();
  const [settling, setSettling] = useState(false);

  const handleSettle = async (selectionId: string) => {
    setSettling(true);
    try {
      const r = await apiFetch(`/admin/markets/${market.id}/settle`, { winningSelectionId: selectionId });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Market settled", description: `Winner: ${market.selections.find(s => s.id === selectionId)?.label}` });
      onSettled();
    } catch (err) {
      toast({ title: "Settle failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSettling(false); }
  };

  return (
    <div className="p-3 border rounded bg-card space-y-2">
      <p className="text-xs font-medium">{market.title}</p>
      <div className="flex flex-wrap gap-1">
        {market.selections.map((s) => (
          <Button key={s.id} size="sm" variant="outline" className="text-xs h-7 px-2" disabled={settling} onClick={() => handleSettle(s.id)}>
            <CheckCircle2 size={11} className="mr-1" /> {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ── Match proof row ────────────────────────────────────────────────────────────
function MatchProofRow({ match, onProofGenerated }: { match: { id: string; homeTeam: string; awayTeam: string; status: string; homeScore: number | null; awayScore: number | null }; onProofGenerated: () => void }) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await apiFetch("/admin/proofs/generate", { matchId: match.id });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Proof generated", description: `${match.homeTeam} vs ${match.awayTeam}` });
      onProofGenerated();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  return (
    <div className="flex items-center justify-between p-2 bg-secondary rounded text-xs">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${match.status === "live" ? "bg-green-500 animate-pulse" : match.status === "finished" ? "bg-blue-500" : "bg-muted-foreground"}`} />
        <span className="font-medium">{match.homeTeam} vs {match.awayTeam}</span>
        {match.homeScore !== null && (
          <span className="font-mono text-muted-foreground">{match.homeScore}:{match.awayScore}</span>
        )}
      </div>
      {match.status === "finished" && (
        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" disabled={generating} onClick={handleGenerate}>
          {generating ? "…" : "Gen Proof"}
        </Button>
      )}
    </div>
  );
}

// ── Governance proposal row (with force-resolve) ──────────────────────────────
function ProposalRow({ proposal, onResolved }: { proposal: { id: string; title: string; status: string; votesFor: number; votesAgainst: number }; onResolved: () => void }) {
  const { toast } = useToast();
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    try {
      const r = await apiFetch(`/admin/governance/proposals/${proposal.id}/resolve`, {});
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast({ title: "Proposal resolved", description: `${proposal.title} → ${d.status}` });
      onResolved();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setResolving(false); }
  };

  return (
    <div className="flex justify-between items-center text-xs p-2 bg-secondary rounded gap-2">
      <span className="font-medium truncate">{proposal.title}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-mono ${proposal.status === "active" ? "text-green-600" : "text-muted-foreground"}`}>
          {proposal.status} · {proposal.votesFor}↑ {proposal.votesAgainst}↓
        </span>
        {proposal.status === "active" && (
          <Button size="sm" variant="ghost" className="text-xs h-6 px-2" disabled={resolving} onClick={handleResolve}>
            <Gavel size={11} className="mr-1" /> {resolving ? "…" : "Resolve now"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Create market form ────────────────────────────────────────────────────────
function CreateMarketForm({ matches, onCreated }: { matches: Array<{ id: string; homeTeam: string; awayTeam: string }>; onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ matchId: "", type: "match_winner", title: "", selections: "Team A,2.10|Draw,3.30|Team B,2.80" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    setSaving(true);
    try {
      const selections = form.selections.split("|").map((s) => {
        const [label, odds] = s.split(",");
        return { label: label?.trim() ?? "", odds: parseFloat(odds ?? "2") };
      });
      const r = await apiFetch("/admin/markets", {
        matchId: form.matchId || undefined,
        type: form.type,
        title: form.title,
        selections,
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Market created" });
      setOpen(false);
      onCreated();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!open) return (
    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setOpen(true)}>
      + Create Custom Market
    </Button>
  );

  return (
    <div className="border rounded p-3 space-y-3 bg-card">
      <p className="text-xs font-semibold">New Market</p>
      <div className="space-y-2">
        <div>
          <Label className="text-[10px]">Fixture (optional)</Label>
          <select className="w-full text-xs border rounded h-8 px-2 bg-background mt-0.5" value={form.matchId} onChange={(e) => setForm((p) => ({ ...p, matchId: e.target.value }))}>
            <option value="">No fixture</option>
            {matches.map((m) => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[10px]">Market Type</Label>
          <select className="w-full text-xs border rounded h-8 px-2 bg-background mt-0.5" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            {["match_winner","over_under_goals","both_teams_score","double_chance","exact_score","first_scorer","corners","cards","tournament_winner","group_winner","custom"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px]">Title</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="Market title…" value={form.title} onChange={set("title")} />
        </div>
        <div>
          <Label className="text-[10px]">Selections (Label,Odds|Label,Odds)</Label>
          <Input className="text-xs h-8 mt-0.5 font-mono" placeholder="Home,2.1|Draw,3.3|Away,2.8" value={form.selections} onChange={set("selections")} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Create insurance form ─────────────────────────────────────────────────────
function CreateInsuranceForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", type: "favorite_team_loss", description: "", premiumRateBps: "500", maxCoverageLamports: "5000000000", triggerCondition: "home_team_loses" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    setSaving(true);
    try {
      const r = await apiFetch("/admin/insurance/products", {
        ...form,
        premiumRateBps: parseInt(form.premiumRateBps),
        maxCoverageLamports: parseInt(form.maxCoverageLamports),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Insurance product created" });
      setOpen(false);
      onCreated();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!open) return (
    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setOpen(true)}>
      + Create Insurance Product
    </Button>
  );

  return (
    <div className="border rounded p-3 space-y-3 bg-card">
      <p className="text-xs font-semibold">New Insurance Product</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-[10px]">Name</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="e.g. Favourite Team Loss Cover" value={form.name} onChange={set("name")} />
        </div>
        <div>
          <Label className="text-[10px]">Type</Label>
          <select className="w-full text-xs border rounded h-8 px-2 bg-background mt-0.5" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            {["favorite_team_loss","tournament_exit","qualification","goal_insurance","event_triggered","custom"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px]">Premium Rate (bps)</Label>
          <Input className="text-xs h-8 mt-0.5 font-mono" placeholder="500 = 5%" value={form.premiumRateBps} onChange={set("premiumRateBps")} />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px]">Max Coverage (lamports)</Label>
          <Input className="text-xs h-8 mt-0.5 font-mono" placeholder="5000000000 = 5 SOL" value={form.maxCoverageLamports} onChange={set("maxCoverageLamports")} />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px]">Description</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="What this policy covers…" value={form.description} onChange={set("description")} />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px]">Trigger Condition</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="e.g. home_team_loses" value={form.triggerCondition} onChange={set("triggerCondition")} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Create proposal form ──────────────────────────────────────────────────────
function CreateProposalForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", endsAt: "" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    if (!form.title || !form.description) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await apiFetch("/admin/governance/proposals", form);
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Proposal created" });
      setOpen(false);
      setForm({ title: "", description: "", endsAt: "" });
      onCreated();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!open) return (
    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setOpen(true)}>
      + Create Proposal
    </Button>
  );

  return (
    <div className="border rounded p-3 space-y-3 bg-card">
      <p className="text-xs font-semibold">New Governance Proposal</p>
      <div className="space-y-2">
        <div>
          <Label className="text-[10px]">Title</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="Proposal title…" value={form.title} onChange={set("title")} />
        </div>
        <div>
          <Label className="text-[10px]">Description</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="Describe the proposal…" value={form.description} onChange={set("description")} />
        </div>
        <div>
          <Label className="text-[10px]">Ends At (optional)</Label>
          <Input className="text-xs h-8 mt-0.5" type="datetime-local" value={form.endsAt} onChange={set("endsAt")} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Create liquidity pool form ────────────────────────────────────────────────
function CreateLiquidityPoolForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ marketType: "match_winner", aprBps: "500" });

  const handleCreate = async () => {
    setSaving(true);
    try {
      const r = await apiFetch("/admin/liquidity/pools", {
        marketType: form.marketType,
        aprBps: parseInt(form.aprBps),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Liquidity pool created" });
      setOpen(false);
      onCreated();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!open) return (
    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setOpen(true)}>
      + Create Liquidity Pool
    </Button>
  );

  return (
    <div className="border rounded p-3 space-y-3 bg-card">
      <p className="text-xs font-semibold">New Liquidity Pool</p>
      <div className="space-y-2">
        <div>
          <Label className="text-[10px]">Market Type</Label>
          <select className="w-full text-xs border rounded h-8 px-2 bg-background mt-0.5" value={form.marketType} onChange={(e) => setForm((p) => ({ ...p, marketType: e.target.value }))}>
            {["match_winner","over_under_goals","both_teams_score","double_chance","exact_score","first_scorer","corners","cards","tournament_winner","group_winner","custom"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px]">APR (bps)</Label>
          <Input className="text-xs h-8 mt-0.5 font-mono" placeholder="500 = 5%" value={form.aprBps} onChange={(e) => setForm((p) => ({ ...p, aprBps: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export function AdminPage() {
  const [authed, setAuthed] = useState(() => {
    try { return localStorage.getItem("pg_admin_authed") === "1"; } catch { return false; }
  });

  const handleAuth = () => {
    try { localStorage.setItem("pg_admin_authed", "1"); } catch {}
    setAuthed(true);
  };

  if (!authed) return <AuthGate onAuth={handleAuth} />;
  return <AdminPanel />;
}
