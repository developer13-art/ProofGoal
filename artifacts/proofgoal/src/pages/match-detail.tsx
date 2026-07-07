import { useParams, Link } from "wouter";
import {
  useGetMatch,
  useListMatchEvents,
  useListMarkets,
  getGetMatchQueryKey,
  getListMatchEventsQueryKey,
  getListMarketsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function MatchDetailPage() {
  const { matchId } = useParams();

  const { data: match, isLoading: matchLoading } = useGetMatch(matchId!, {
    query: { enabled: !!matchId, queryKey: getGetMatchQueryKey(matchId!) },
  });

  const { data: eventsRaw, isLoading: eventsLoading } = useListMatchEvents(matchId!, {
    query: { enabled: !!matchId, queryKey: getListMatchEventsQueryKey(matchId!) },
  });
  const events = Array.isArray(eventsRaw) ? eventsRaw : [];

  const { data: marketsRaw, isLoading: marketsLoading } = useListMarkets(
    { matchId },
    { query: { enabled: !!matchId, queryKey: getListMarketsQueryKey({ matchId }) } },
  );
  const markets = Array.isArray(marketsRaw) ? marketsRaw : [];

  if (matchLoading) return <div className="text-center py-10">Loading match details…</div>;
  if (!match) return <div className="text-center py-10">Match not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
      {/* Match header card */}
      <Card className="border-t-4 border-t-primary overflow-hidden">
        <CardContent className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          {/* Meta row */}
          <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="truncate max-w-[50%]">
              {match.tournament} · {match.stage}
            </span>
            <span
              className={`px-2 py-0.5 rounded ${
                match.status === "live"
                  ? "text-accent animate-pulse bg-accent/10"
                  : "bg-secondary"
              }`}
            >
              {match.status}
            </span>
            <span>
              {new Date(match.kickoffAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Score display */}
          <div className="flex justify-center items-center gap-4 sm:gap-8 md:gap-16">
            <div className="flex-1 text-right min-w-0">
              <h2 className="text-xl sm:text-3xl md:text-5xl font-bold leading-tight truncate">
                {match.homeTeam}
              </h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 bg-secondary px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-inner shrink-0">
              <span className="text-4xl sm:text-5xl md:text-7xl font-mono font-bold tabular-nums">
                {match.homeScore ?? "–"}
              </span>
              <span className="text-xl text-muted-foreground">:</span>
              <span className="text-4xl sm:text-5xl md:text-7xl font-mono font-bold tabular-nums">
                {match.awayScore ?? "–"}
              </span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <h2 className="text-xl sm:text-3xl md:text-5xl font-bold leading-tight truncate">
                {match.awayTeam}
              </h2>
            </div>
          </div>

          {/* Proof status */}
          {match.proofStatus && (
            <div className="pt-4 border-t inline-flex items-center gap-2 w-full justify-center flex-wrap">
              <span className="text-sm text-muted-foreground">Proof Status:</span>
              <span className="text-sm font-mono font-bold bg-secondary px-2 py-1 rounded">
                {match.proofStatus}
              </span>
              <Link href={`/proofs?matchId=${match.id}`}>
                <Button variant="link" size="sm">
                  View Proofs
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Markets + Timeline — stack on mobile, 3-col grid on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {/* Markets list (2/3 width on desktop) */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-xl sm:text-2xl font-bold">Markets</h3>
          {marketsLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center border rounded">
              Loading markets…
            </div>
          ) : !markets.length ? (
            <div className="p-6 text-center bg-card border rounded text-sm text-muted-foreground">
              No markets found for this match.
            </div>
          ) : (
            <div className="space-y-3">
              {markets.map((market) => (
                <Card key={market.id}>
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2 bg-secondary/50">
                    <CardTitle className="text-sm leading-tight">{market.title}</CardTitle>
                    <Link href={`/markets/${market.id}`}>
                      <Button size="sm" variant="secondary" className="shrink-0">
                        Trade
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {market.selections.slice(0, 4).map((sel) => (
                      <div key={sel.id} className="text-center p-2 border rounded">
                        <div className="text-[10px] text-muted-foreground truncate">{sel.label}</div>
                        <div className="font-mono font-bold text-sm">{sel.odds.toFixed(2)}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h3 className="text-xl sm:text-2xl font-bold">Timeline</h3>
          {eventsLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center border rounded">
              Loading events…
            </div>
          ) : !events.length ? (
            <div className="p-6 text-center bg-card border rounded text-sm text-muted-foreground">
              No events recorded yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-3 p-3 border rounded bg-card items-start"
                >
                  <div className="font-mono font-bold text-primary min-w-[36px] text-sm">
                    {event.minute}'
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs uppercase tracking-wider">
                      {event.type} {event.team ? `(${event.team})` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{event.description}</div>
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
