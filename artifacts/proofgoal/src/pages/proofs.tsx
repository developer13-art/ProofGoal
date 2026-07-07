import { useState } from "react";
import { useListProofRecords } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationStatus } from "@workspace/api-zod";

export function ProofsPage() {
  const [filterStatus, setFilterStatus] = useState<ValidationStatus | undefined>();
  const { data: proofsRaw, isLoading } = useListProofRecords({ status: filterStatus });
  const proofs = Array.isArray(proofsRaw) ? proofsRaw : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proof Records</h1>
          <p className="text-muted-foreground">
            Oracle-attested match results used to settle markets and policies.
          </p>
        </div>
        <select
          className="flex h-9 w-full md:w-auto items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
          value={filterStatus || ""}
          onChange={(e) => setFilterStatus((e.target.value as ValidationStatus) || undefined)}
        >
          <option value="">All Statuses</option>
          <option value={ValidationStatus.pending}>Pending</option>
          <option value={ValidationStatus.verified}>Verified</option>
          <option value={ValidationStatus.failed}>Failed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading proof records...
        </div>
      ) : !proofs?.length ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
          No proof records yet. Proofs are generated once matches settle from oracle data.
        </div>
      ) : (
        <div className="space-y-3">
          {proofs.map((proof) => (
            <Card key={proof.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground font-mono">
                    Match: {proof.matchId}
                  </span>
                  <span className="text-sm font-mono truncate max-w-md" title={proof.proofHash}>
                    Proof Hash: {proof.proofHash}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-md" title={proof.merkleRoot}>
                    Merkle Root: {proof.merkleRoot}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full uppercase tracking-wider font-bold shrink-0 ${
                    proof.validationStatus === "verified"
                      ? "bg-primary/10 text-primary"
                      : proof.validationStatus === "failed"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {proof.validationStatus}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
