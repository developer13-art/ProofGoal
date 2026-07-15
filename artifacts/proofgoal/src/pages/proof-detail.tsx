import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetProofRecordDetails,
  getGetProofRecordDetailsQueryKey,
  type ProofRecordDetail,
  type SettledMarketSummary,
  type SettledInsurancePolicySummary,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatLamports, shortenAddress } from "@/lib/format";

// ── Small building blocks ───────────────────────────────────────────────────

function CopyableHash({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] font-medium text-primary hover:underline shrink-0"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <div className="bg-secondary/60 rounded px-3 py-2 font-mono text-xs break-all">{value}</div>
    </div>
  );
}

function StatusPill({
  status,
  tone,
}: {
  status: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const classes =
    tone === "positive"
      ? "bg-primary/10 text-primary"
      : tone === "negative"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold ${classes}`}>
      {status}
    </span>
  );
}

function validationTone(status: string): "positive" | "negative" | "neutral" {
  if (status === "verified") return "positive";
  if (status === "failed") return "negative";
  return "neutral";
}

function marketStatusTone(status: string): "positive" | "negative" | "neutral" {
  if (status === "settled") return "positive";
  if (status === "void") return "negative";
  return "neutral";
}

function policyStatusTone(status: string): "positive" | "negative" | "neutral" {
  if (status === "claimed" || status === "triggered") return "positive";
  if (status === "expired" || status === "void") return "neutral";
  return "neutral";
}

// ── Settled market card ──────────────────────────────────────────────────────

function SettledMarketCard({ market }: { market: SettledMarketSummary }) {
  const resolvedCount = market.wonPositions + market.lostPositions + market.claimedPositions;
  return (
    <Card>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2 bg-secondary/50 rounded-t-lg">
        <CardTitle className="text-sm leading-tight">{market.title}</CardTitle>
        <StatusPill status={market.status} tone={marketStatusTone(market.status)} />
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Winning selection:</span>
          <span className="text-sm font-bold text-primary">
            {market.winningSelectionLabel ?? "—"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded border">
            <div className="text-lg font-mono font-bold">{market.totalPositions}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Positions</div>
          </div>
          <div className="p-2 rounded border">
            <div className="text-lg font-mono font-bold text-primary">{market.wonPositions}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Won</div>
          </div>
          <div className="p-2 rounded border">
            <div className="text-lg font-mono font-bold text-muted-foreground">{market.lostPositions}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Lost</div>
          </div>
        </div>
        {resolvedCount > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {market.claimedPositions} of {market.wonPositions} winning position
            {market.wonPositions !== 1 ? "s" : ""} claimed so far.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Settled insurance policy row ─────────────────────────────────────────────

function SettledPolicyRow({ policy }: { policy: SettledInsurancePolicySummary }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-lg p-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{policy.productName}</span>
          <StatusPill status={policy.status} tone={policyStatusTone(policy.status)} />
        </div>
        <p className="text-[11px] text-muted-foreground font-mono">
          {shortenAddress(policy.walletAddress)}
          {policy.selectedTeam ? ` · backed ${policy.selectedTeam}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-mono font-bold">{formatLamports(policy.coverageLamports)} SOL</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Coverage</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProofDetailPage() {
  const { proofId } = useParams();

  const { data, isLoading } = useGetProofRecordDetails(proofId!, {
    query: { enabled: !!proofId, queryKey: getGetProofRecordDetailsQueryKey(proofId!) },
  });
  const proof = data as ProofRecordDetail | undefined;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-8 space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-16 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!proof) {
    return (
      <div className="text-center py-10 text-muted-foreground space-y-2">
        <p className="font-medium">Proof record not found.</p>
        <Link href="/proofs">
          <Button variant="link" size="sm">← Back to Proofs</Button>
        </Link>
      </div>
    );
  }

  const match = proof.match;

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <Link href="/proofs">
        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground">
          ← All proofs
        </Button>
      </Link>

      {/* ── Header: match result this proof commits to ──────────────── */}
      <Card className="border-t-4 border-t-primary overflow-hidden">
        <CardContent className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>
              {match ? `${match.tournament} · ${match.stage}` : "Match unavailable"}
            </span>
            <StatusPill status={proof.validationStatus} tone={validationTone(proof.validationStatus)} />
          </div>

          {match ? (
            <>
              <div className="flex justify-center items-center gap-4 sm:gap-8 md:gap-16">
                <div className="flex-1 text-right min-w-0">
                  <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold leading-tight">
                    {match.homeTeam}
                  </h2>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 bg-secondary px-5 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-inner shrink-0">
                  <span className="text-3xl sm:text-4xl md:text-6xl font-mono font-black tabular-nums">
                    {match.homeScore ?? "–"}
                  </span>
                  <span className="text-lg text-muted-foreground font-thin">:</span>
                  <span className="text-3xl sm:text-4xl md:text-6xl font-mono font-black tabular-nums">
                    {match.awayScore ?? "–"}
                  </span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold leading-tight">
                    {match.awayTeam}
                  </h2>
                </div>
              </div>
              <div className="flex justify-center gap-3 text-xs text-muted-foreground">
                <span>
                  Kicked off{" "}
                  {new Date(match.kickoffAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <Link href={`/matches/${match.id}`}>
                  <span className="text-primary hover:underline cursor-pointer">View match →</span>
                </Link>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              The underlying match record could not be found (it may have been removed).
            </p>
          )}

          <div className="pt-4 border-t text-center text-xs text-muted-foreground">
            Proof generated{" "}
            {new Date(proof.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Cryptographic detail ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Proof Artifact</CardTitle>
          <p className="text-xs text-muted-foreground">
            A tamper-evident fingerprint of this match's final result — recomputing{" "}
            <code className="text-[11px] bg-secondary px-1 rounded">
              sha256(matchId:home:away:homeScore:awayScore)
            </code>{" "}
            must match the proof hash below, or the record has been altered.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <CopyableHash label="Proof ID" value={proof.id} />
          <CopyableHash label="Proof Hash" value={proof.proofHash} />
          <CopyableHash label="Merkle Root" value={proof.merkleRoot} />
          {proof.merklePath.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Merkle Path ({proof.merklePath.length} node{proof.merklePath.length !== 1 ? "s" : ""})
              </span>
              <div className="space-y-1">
                {proof.merklePath.map((node, i) => (
                  <div
                    key={i}
                    className="bg-secondary/60 rounded px-3 py-1.5 font-mono text-[11px] break-all"
                  >
                    {node}
                  </div>
                ))}
              </div>
            </div>
          )}
          <CopyableHash label="Signature" value={proof.signature} />
          {proof.settlementTxSig && (
            <CopyableHash label="Settlement Tx Signature" value={proof.settlementTxSig} />
          )}
          {proof.verificationReceiptUrl && (
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Verification Receipt
              </span>
              <a
                href={proof.verificationReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-xs text-primary hover:underline break-all"
              >
                {proof.verificationReceiptUrl} ↗
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Markets settled off this proof ───────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-bold">Markets Settled</h3>
          <span className="text-xs text-muted-foreground font-mono">
            {proof.markets.length} market{proof.markets.length !== 1 ? "s" : ""}
          </span>
        </div>
        {proof.markets.length === 0 ? (
          <div className="p-6 text-center bg-card border rounded text-sm text-muted-foreground">
            No markets were created for this match.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {proof.markets.map((market) => (
              <SettledMarketCard key={market.id} market={market} />
            ))}
          </div>
        )}
      </div>

      {/* ── Insurance policies resolved off this proof ───────────────── */}
      {proof.insurancePolicies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-bold">Insurance Policies Resolved</h3>
            <span className="text-xs text-muted-foreground font-mono">
              {proof.insurancePolicies.length} polic{proof.insurancePolicies.length !== 1 ? "ies" : "y"}
            </span>
          </div>
          <div className="space-y-2">
            {proof.insurancePolicies.map((policy) => (
              <SettledPolicyRow key={policy.id} policy={policy} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
