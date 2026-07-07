import { useState } from "react";
import { useListMarkets } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { formatLamports, formatOdds } from "@/lib/format";
import { MarketStatus, MarketType } from "@workspace/api-zod";

export function MarketsPage() {
  const [filterType, setFilterType] = useState<MarketType | undefined>();
  const [filterStatus, setFilterStatus] = useState<MarketStatus | undefined>();

  const { data: marketsRaw, isLoading } = useListMarkets({
    type: filterType,
    status: filterStatus,
  });
  const markets = Array.isArray(marketsRaw) ? marketsRaw : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
          <p className="text-muted-foreground">Browse and trade prediction markets.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {/* Simple filter stand-ins, can use Select component later */}
          <select 
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={filterStatus || ""}
            onChange={(e) => setFilterStatus(e.target.value as MarketStatus || undefined)}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="suspended">Suspended</option>
            <option value="settled">Settled</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading markets...
        </div>
      ) : !markets?.length ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
          No markets found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((market) => (
            <Link key={market.id} href={`/markets/${market.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg leading-tight">{market.title}</CardTitle>
                    <span className={`text-xs px-2 py-1 rounded-full uppercase tracking-wider font-bold ${
                      market.status === 'open' ? 'bg-primary/10 text-primary' :
                      market.status === 'settled' ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {market.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end mt-4">
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {market.selections.slice(0, 2).map(sel => (
                      <div key={sel.id} className="bg-secondary rounded p-2 text-center">
                        <div className="text-xs text-muted-foreground truncate" title={sel.label}>{sel.label}</div>
                        <div className="font-mono font-bold text-lg">{formatOdds(sel.odds)}</div>
                      </div>
                    ))}
                    {market.selections.length > 2 && (
                      <div className="col-span-2 text-center text-xs text-muted-foreground">
                        + {market.selections.length - 2} more options
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground font-mono mt-auto border-t pt-2">
                    <span>Liq: {formatLamports(market.liquidityLamports)} SOL</span>
                    <span>Type: {market.type}</span>
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
