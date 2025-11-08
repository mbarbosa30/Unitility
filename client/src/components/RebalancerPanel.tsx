import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Zap } from "lucide-react";
import TokenIcon from "./TokenIcon";
import { useQuery } from "@tanstack/react-query";
import type { Pool } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function RebalancerPanel() {
  const { toast } = useToast();
  
  const { data: pools } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  //todo: remove mock functionality - filter only discounted pools
  const opportunities = pools?.filter(p => parseFloat(p.discount) < 0) || [];

  const calculateProfit = (pool: Pool) => {
    const discount = Math.abs(parseFloat(pool.discount));
    const volume = parseFloat(pool.volume);
    // Simplified profit calculation
    return ((volume * discount) / 100 / 1000).toFixed(0);
  };

  const handleExecute = (pool: Pool) => {
    console.log("Executing rebalance for", pool.tokenSymbol);
    toast({
      title: "Rebalance Executed",
      description: `Arbitrage opportunity captured for ${pool.tokenSymbol}`,
    });
  };

  return (
    <Card data-testid="card-rebalancer">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Arbitrage Opportunities</CardTitle>
            <CardDescription>
              Profitable rebalancing across pools
            </CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1">
            <TrendingDown className="h-3 w-3" />
            {opportunities.length} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {opportunities.map((pool) => (
            <div
              key={pool.id}
              className="flex items-center justify-between gap-4 rounded-lg border p-4 hover-elevate"
              data-testid={`card-opportunity-${pool.id}`}
            >
              <div className="flex items-center gap-3">
                <TokenIcon symbol={pool.tokenSymbol} />
                <div className="flex flex-col">
                  <span className="font-semibold">{pool.tokenSymbol} Pool</span>
                  <span className="text-sm text-muted-foreground">
                    {Math.abs(parseFloat(pool.discount)).toFixed(1)}% below market
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Est. Profit</div>
                  <div className="text-lg font-bold text-green-500 tabular-nums">
                    +${calculateProfit(pool)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Gas Cost</div>
                  <div className="text-sm font-mono tabular-nums">
                    ${(parseFloat(pool.gasPrice) * 2000).toFixed(0)}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => handleExecute(pool)}
                  data-testid={`button-execute-${pool.tokenSymbol.toLowerCase()}`}
                >
                  <Zap className="h-3 w-3" />
                  Execute
                </Button>
              </div>
            </div>
          ))}
          
          {opportunities.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No arbitrage opportunities available at the moment.
              <br />
              Check back when pool prices deviate from market rates.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
