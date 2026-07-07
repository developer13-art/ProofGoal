import { useState } from "react";
import { useParams } from "wouter";
import { useGetMarket, useCreatePosition, getGetMarketQueryKey } from "@workspace/api-client-react";
import { useAppWallet as useWallet } from "@/lib/wallet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLamports, formatOdds } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function MarketDetailPage() {
  const { marketId } = useParams();
  const { walletAddress } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: market, isLoading } = useGetMarket(marketId!, {
    query: { enabled: !!marketId, queryKey: getGetMarketQueryKey(marketId!) }
  });

  const placePosition = useCreatePosition();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stake, setStake] = useState("1"); // SOL

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      toast({ title: "Wallet not connected", description: "Connect wallet to trade.", variant: "destructive" });
      return;
    }
    if (!selectedId) {
      toast({ title: "Selection required", description: "Choose an outcome.", variant: "destructive" });
      return;
    }
    const stakeLamports = parseFloat(stake) * 1e9;
    if (isNaN(stakeLamports) || stakeLamports <= 0) return;

    try {
      await placePosition.mutateAsync({
        data: {
          walletAddress,
          marketId: marketId!,
          selectionId: selectedId,
          stakeLamports
        }
      });
      toast({ title: "Trade placed", description: "Position successfully opened." });
      queryClient.invalidateQueries({ queryKey: getGetMarketQueryKey(marketId!) });
    } catch (err) {
      toast({ title: "Trade failed", description: "Could not place position.", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-center py-10">Loading market...</div>;
  if (!market) return <div className="text-center py-10">Market not found.</div>;

  const selectedSelection = market.selections.find(s => s.id === selectedId);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">{market.title}</h1>
        <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
          <span className="uppercase px-2 py-1 rounded bg-secondary">{market.status}</span>
          <span>{market.type}</span>
          <span>Liq: {formatLamports(market.liquidityLamports)} SOL</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">Selections</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {market.selections.map(sel => (
              <Card 
                key={sel.id} 
                className={`cursor-pointer transition-colors ${selectedId === sel.id ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}
                onClick={() => setSelectedId(sel.id)}
              >
                <CardContent className="p-4 flex justify-between items-center">
                  <span className="font-medium">{sel.label}</span>
                  <span className="text-lg font-bold font-mono">{formatOdds(sel.odds)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Trade</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTrade} className="space-y-4">
                <div className="space-y-2">
                  <Label>Selected Outcome</Label>
                  <div className="text-sm p-2 bg-secondary rounded border font-medium">
                    {selectedSelection ? selectedSelection.label : "None"}
                    {selectedSelection && <span className="float-right font-mono">{formatOdds(selectedSelection.odds)}</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stake">Stake (SOL)</Label>
                  <Input 
                    id="stake" 
                    type="number" 
                    step="0.1" 
                    min="0.1" 
                    value={stake} 
                    onChange={e => setStake(e.target.value)} 
                    className="font-mono"
                  />
                </div>
                <div className="pt-2 border-t flex justify-between items-center text-sm font-medium">
                  <span>Est. Payout</span>
                  <span className="font-mono text-primary">
                    {selectedSelection && parseFloat(stake) > 0 
                      ? (parseFloat(stake) * selectedSelection.odds).toFixed(2)
                      : "0.00"} SOL
                  </span>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={!selectedId || placePosition.isPending || market.status !== 'open'}
                >
                  {placePosition.isPending ? "Placing..." : market.status !== 'open' ? "Market Closed" : "Place Trade"}
                </Button>
                {!walletAddress && <p className="text-xs text-center text-destructive">Connect wallet to trade</p>}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
