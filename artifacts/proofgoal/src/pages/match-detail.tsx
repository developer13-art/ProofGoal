import { useParams, Link } from "wouter";
import { useGetMatch, useListMatchEvents, useListMarkets, getGetMatchQueryKey, getListMatchEventsQueryKey, getListMarketsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function MatchDetailPage() {
  const { matchId } = useParams();

  const { data: match, isLoading: matchLoading } = useGetMatch(matchId!, {
    query: { enabled: !!matchId, queryKey: getGetMatchQueryKey(matchId!) }
  });

  const { data: events, isLoading: eventsLoading } = useListMatchEvents(matchId!, {
    query: { enabled: !!matchId, queryKey: getListMatchEventsQueryKey(matchId!) }
  });

  const { data: markets, isLoading: marketsLoading } = useListMarkets({ matchId }, {
    query: { enabled: !!matchId, queryKey: getListMarketsQueryKey({ matchId }) }
  });

  if (matchLoading) return <div className="text-center py-10">Loading match details...</div>;
  if (!match) return <div className="text-center py-10">Match not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Match Header */}
      <Card className="border-t-4 border-t-primary">
        <CardContent className="p-8 text-center space-y-6">
          <div className="flex justify-between items-center text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <span>{match.tournament} - {match.stage}</span>
            <span className={match.status === 'live' ? 'text-accent animate-pulse' : ''}>{match.status}</span>
            <span>{new Date(match.kickoffAt).toLocaleString()}</span>
          </div>

          <div className="flex justify-center items-center gap-8 md:gap-16">
            <div className="flex-1 text-right">
              <h2 className="text-3xl md:text-5xl font-bold">{match.homeTeam}</h2>
            </div>
            <div className="flex items-center gap-4 bg-secondary px-6 py-4 rounded-xl shadow-inner">
              <span className="text-5xl md:text-7xl font-mono font-bold">{match.homeScore ?? "-"}</span>
              <span className="text-2xl text-muted-foreground">:</span>
              <span className="text-5xl md:text-7xl font-mono font-bold">{match.awayScore ?? "-"}</span>
            </div>
            <div className="flex-1 text-left">
              <h2 className="text-3xl md:text-5xl font-bold">{match.awayTeam}</h2>
            </div>
          </div>
          
          {match.proofStatus && (
            <div className="pt-6 border-t inline-flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Proof Status:</span>
              <span className="text-sm font-mono font-bold bg-secondary px-2 py-1 rounded">{match.proofStatus}</span>
              <Link href={`/proofs?matchId=${match.id}`}>
                <Button variant="link" size="sm">View Proofs</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <h3 className="text-2xl font-bold">Markets</h3>
          {marketsLoading ? (
            <div>Loading markets...</div>
          ) : !markets?.length ? (
            <div className="p-8 text-center bg-card border rounded text-muted-foreground">No markets found for this match.</div>
          ) : (
            <div className="space-y-4">
              {markets.map(market => (
                <Card key={market.id}>
                  <CardHeader className="py-3 flex flex-row items-center justify-between bg-secondary/50">
                    <CardTitle className="text-base">{market.title}</CardTitle>
                    <Link href={`/markets/${market.id}`}>
                      <Button size="sm" variant="secondary">Trade</Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {market.selections.slice(0, 4).map(sel => (
                      <div key={sel.id} className="text-center p-2 border rounded">
                        <div className="text-xs text-muted-foreground truncate">{sel.label}</div>
                        <div className="font-mono font-bold">{sel.odds.toFixed(2)}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-bold">Timeline</h3>
          {eventsLoading ? (
            <div>Loading events...</div>
          ) : !events?.length ? (
            <div className="p-8 text-center bg-card border rounded text-muted-foreground">No events recorded yet.</div>
          ) : (
            <div className="space-y-4">
              {events.map(event => (
                <div key={event.id} className="flex gap-4 p-3 border rounded bg-card items-start">
                  <div className="font-mono font-bold text-primary min-w-[40px]">{event.minute}'</div>
                  <div>
                    <div className="font-bold text-sm">{event.type} {event.team ? `(${event.team})` : ''}</div>
                    <div className="text-sm text-muted-foreground">{event.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
