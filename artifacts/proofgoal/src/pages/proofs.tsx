import { useState } from "react";
import { Link } from "wouter";
import { useListProofRecords } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ValidationStatus } from "@workspace/api-zod";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: ValidationStatus.pending, label: "Pending" },
  { value: ValidationStatus.verified, label: "Verified" },
  { value: ValidationStatus.failed, label: "Failed" },
];

export function ProofsPage() {
  const [filterStatus, setFilterStatus] = useState<ValidationStatus | "">("");
  const { data: proofsRaw, isLoading } = useListProofRecords({
    status: filterStatus ? (filterStatus as ValidationStatus) : undefined,
  });
  const proofs = Array.isArray(proofsRaw) ? proofsRaw : [];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Proof Records</h1>
          <p className="text-sm text-muted-foreground">
            Oracle-attested match results used to settle markets and policies.
          </p>
        </div>
        {/* Status filter pills */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1 self-start sm:self-auto">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value as ValidationStatus | "")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStatus === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading proof records…
        </div>
      ) : !proofs.length ? (
        <div className="text-sm text-muted-foreground py-10 text-center border rounded border-dashed bg-card">
          <p className="font-medium mb-1">No proof records yet</p>
          <p className="text-xs">Proofs are generated once matches settle from oracle data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {proofs.map((proof) => (
            <Link key={proof.id} href={`/proofs/${proof.id}`}>
              <Card className="cursor-pointer transition-colors hover:border-primary/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                        Match ID
                      </span>
                      <span className="text-xs font-mono truncate">{proof.matchId}</span>

                      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-1">
                        Proof Hash
                      </span>
                      <span
                        className="text-xs font-mono truncate max-w-full"
                        title={proof.proofHash}
                      >
                        {proof.proofHash}
                      </span>

                      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-1">
                        Merkle Root
                      </span>
                      <span
                        className="text-xs font-mono truncate max-w-full"
                        title={proof.merkleRoot}
                      >
                        {proof.merkleRoot}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold ${
                          proof.validationStatus === "verified"
                            ? "bg-primary/10 text-primary"
                            : proof.validationStatus === "failed"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {proof.validationStatus}
                      </span>
                      <span className="text-primary text-xs font-medium hidden sm:inline">View →</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
