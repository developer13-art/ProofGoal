import { useListMatches } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export function MatchesPage() {
  const { data: matchesRaw, isLoading } = useListMatches();
  const matches = Array.isArray(matchesRaw) ? matchesRaw : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Matches</h1>
        <p className="text-muted-foreground">World Cup fixtures and live scores synced via TxLINE.</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading matches...
        </div>
      ) : !matches?.length ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
          Waiting for match data from the oracle.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((match) => (
            <Link key={match.id} href={`/matches/${match.id}`}>
              <Card className={`hover:border-primary transition-colors cursor-pointer h-full ${match.status === 'live' ? 'border-accent' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                      {match.tournament} - {match.stage}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                      match.status === 'live' ? 'bg-accent/10 text-accent animate-pulse' : 
                      match.status === 'finished' ? 'bg-secondary text-muted-foreground' : 'bg-primary/10 text-primary'
                    }`}>
                      {match.status}
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">{match.homeTeam}</span>
                      <span className="text-2xl font-mono font-bold">{match.homeScore ?? "-"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">{match.awayTeam}</span>
                      <span className="text-2xl font-mono font-bold">{match.awayScore ?? "-"}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground font-mono">
                    KO: {new Date(match.kickoffAt).toLocaleString()}
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
