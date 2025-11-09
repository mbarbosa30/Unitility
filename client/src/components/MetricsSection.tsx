import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, DollarSign, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Pool } from "@shared/schema";

export default function MetricsSection() {
  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  const totalPools = pools.length;
  const totalVolume = pools.reduce((sum: number, pool: Pool) => sum + parseFloat(pool.volume || "0"), 0);
  const totalETH = pools.reduce((sum: number, pool: Pool) => sum + parseFloat(pool.ethDeposited || "0"), 0);
  const avgAPY = pools.length > 0 
    ? pools.reduce((sum: number, pool: Pool) => sum + parseFloat(pool.apy || "0"), 0) / pools.length 
    : 0;

  return (
    <section className="relative py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="text-center space-y-6">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              Traction <span className="text-primary">Speaks</span>
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              The Market Is Moving
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 hover-elevate">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold tabular-nums text-primary" data-testid="text-total-pools">
                    {totalPools}+
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">
                    Pools Live
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold tabular-nums text-primary" data-testid="text-total-sends">
                    {totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(0)}K` : totalVolume.toFixed(0)}+
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">
                    Gasless Sends
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold tabular-nums text-primary" data-testid="text-avg-apy">
                    {avgAPY.toFixed(0)}%
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">
                    Avg Yield
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-4xl font-extrabold tabular-nums text-primary" data-testid="text-total-eth">
                    {totalETH.toFixed(1)}
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">
                    ETH Sponsored
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-card border-2 rounded-lg p-8 md:p-12 max-w-4xl mx-auto">
            <div className="space-y-6">
              <div className="flex items-start gap-4" data-testid="card-testimonial-sponsor">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg md:text-xl italic text-muted-foreground leading-relaxed">
                    "Turned 2 ETH into 1K $BRETT + 25% APY. Utility {'>'} HODL."
                  </p>
                  <p className="text-sm font-bold text-foreground/60">
                    — Anon Sponsor
                  </p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-start gap-4" data-testid="card-testimonial-user">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg md:text-xl italic text-muted-foreground leading-relaxed">
                    "Sent $USDC to fam. No gas. Game-changer."
                  </p>
                  <p className="text-sm font-bold text-foreground/60">
                    — Retail User
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
