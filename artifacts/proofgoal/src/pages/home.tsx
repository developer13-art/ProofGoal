import { useGetAnalyticsSummary, useListLiveMatches } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLamports } from "@/lib/format";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsSummary();
  const { data: liveMatches, isLoading: matchesLoading } = useListLiveMatches();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Terminal Overview</h1>
        <p className="text-muted-foreground">Platform analytics and live market status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {analyticsLoading ? "---" : `${formatLamports(analytics?.totalVolumeLamports || 0)} SOL`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Open Interest</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {analyticsLoading ? "---" : `${formatLamports(analytics?.openInterestLamports || 0)} SOL`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Markets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {analyticsLoading ? "---" : analytics?.activeMarkets || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {analyticsLoading ? "---" : analytics?.totalUsers || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Live Matches</h2>
          <Link href="/matches">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>
        
        {matchesLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
            Loading live matches...
          </div>
        ) : liveMatches?.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
            Waiting for live match data from the oracle.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveMatches?.map(match => (
              <Card key={match.id} className="border-l-4 border-l-accent">
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">{match.tournament} - {match.stage}</span>
                    <span className="font-bold">{match.homeTeam} vs {match.awayTeam}</span>
                  </div>
                  <div className="text-xl font-bold font-mono bg-secondary px-3 py-1 rounded">
                    {match.homeScore ?? 0} - {match.awayScore ?? 0}
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
