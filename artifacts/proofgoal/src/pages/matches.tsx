import { useState } from "react";
import { useListMatches } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "finished", label: "Finished" },
];

export function MatchesPage() {
  const [status, setStatus] = useState("");
  const { data: matchesRaw, isLoading } = useListMatches(
    status ? { status: status as "live" | "scheduled" | "finished" } : undefined,
  );
  const matches = Array.isArray(matchesRaw) ? matchesRaw : [];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Matches</h1>
          <p className="text-sm text-muted-foreground">
            World Cup fixtures synced via TxLINE oracle.
          </p>
        </div>
        {/* Status filter pill tabs */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1 self-start sm:self-auto">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                status === opt.value
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
          Loading matches…
        </div>
      ) : !matches.length ? (
        <div className="text-sm text-muted-foreground py-10 text-center border rounded border-dashed bg-card">
          <p className="font-medium mb-1">
            {status ? `No ${status} matches` : "No match data yet"}
          </p>
          <p className="text-xs">Waiting for TxLINE oracle sync.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {matches.map((match) => (
            <Link key={match.id} href={`/matches/${match.id}`}>
              <Card
                className={`hover:border-primary transition-colors cursor-pointer h-full ${
                  match.status === "live" ? "border-accent" : ""
                }`}
              >
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none max-w-[60%] truncate">
                      {match.tournament}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                        match.status === "live"
                          ? "bg-accent/10 text-accent animate-pulse"
                          : match.status === "finished"
                            ? "bg-secondary text-muted-foreground"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      {match.status}
                    </span>
                  </div>

                  {/* Teams & scores */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm sm:text-base truncate max-w-[70%]">
                        {match.homeTeam}
                      </span>
                      <span className="text-xl font-mono font-bold tabular-nums">
                        {match.homeScore ?? "–"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm sm:text-base truncate max-w-[70%]">
                        {match.awayTeam}
                      </span>
                      <span className="text-xl font-mono font-bold tabular-nums">
                        {match.awayScore ?? "–"}
                      </span>
                    </div>
                  </div>

                  {/* Kickoff */}
                  <div className="mt-3 pt-3 border-t text-[10px] text-muted-foreground font-mono">
                    {new Date(match.kickoffAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
