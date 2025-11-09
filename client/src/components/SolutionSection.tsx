import { Wallet, Send, TrendingUp, Users, DollarSign, Target, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SolutionSection() {
  return (
    <section className="relative py-24 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl space-y-16">
          <div className="text-center space-y-6">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              Paymaster Market: <span className="text-primary">Usage = Valuation</span>
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              One System. Infinite Utility.
            </p>
          </div>

          <div className="prose prose-lg md:prose-xl max-w-4xl mx-auto dark:prose-invert text-center">
            <p className="text-lg md:text-xl leading-relaxed">
              Deposit ETH. Pick a token. Set fee (0.1-1%). Users send gasless—pay tiny slice in-token. 
              You earn traction yield. Rebalancers arb discounts. Over time: ETH burned vs. fees accrued = <span className="font-bold text-primary">intended marketcap</span>. 
              Tokens price themselves.
            </p>
            <p className="text-2xl md:text-3xl font-bold mt-8">
              No ETH? No excuse. Send like text.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 hover-elevate active-elevate-2" data-testid="card-users">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Send className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Users</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Gasless sends. Zero ETH needed. +99.5% of your token arrives.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate active-elevate-2" data-testid="card-sponsors">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Sponsors</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Yield from usage. Earn tokens at discount. APY: 15-40%.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate active-elevate-2" data-testid="card-rebalancers">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Rebalancers</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Hunt 5-20% edges. Buy low via pools, sell on DEX.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate active-elevate-2" data-testid="card-projects">
              <CardContent className="pt-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Projects</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Bootstrap utility. Watch FDV rise with every transfer.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-24 space-y-12">
            <div className="text-center space-y-4">
              <h3 className="text-3xl md:text-4xl font-extrabold">
                The Flywheel in <span className="text-primary">3 Steps</span>
              </h3>
              <p className="text-xl md:text-2xl text-muted-foreground">
                Burn ETH. Accrue Power.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="relative" data-testid="card-flywheel-sponsor">
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                  1
                </div>
                <Card className="border-2 pt-8">
                  <CardContent className="space-y-4">
                    <div className="flex justify-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Wallet className="w-8 h-8 text-primary" />
                      </div>
                    </div>
                    <h4 className="text-2xl font-bold text-center">Sponsor</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Deposit ETH. Choose $DOGGO. Fee: 0.5%. Min: 10 tokens.
                    </p>
                    <p className="text-lg font-bold text-primary text-center">
                      "Bet on its sends."
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="relative" data-testid="card-flywheel-send">
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                  2
                </div>
                <Card className="border-2 pt-8">
                  <CardContent className="space-y-4">
                    <div className="flex justify-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Send className="w-8 h-8 text-primary" />
                      </div>
                    </div>
                    <h4 className="text-2xl font-bold text-center">Send</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      User transfers 100 $DOGGO gasless. Pays 0.5 fee. You cover gas.
                    </p>
                    <p className="text-lg font-bold text-primary text-center">
                      "Tokens flow free."
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="relative" data-testid="card-flywheel-evolve">
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                  3
                </div>
                <Card className="border-2 pt-8">
                  <CardContent className="space-y-4">
                    <div className="flex justify-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="w-8 h-8 text-primary" />
                      </div>
                    </div>
                    <h4 className="text-2xl font-bold text-center">Evolve</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Fees pile up. ETH burns down. Ratio implies FDV: 2M ETH. Arbs tighten it.
                    </p>
                    <p className="text-lg font-bold text-primary text-center">
                      "Usage prices the cap."
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="bg-card border-2 border-primary/20 rounded-lg p-8 max-w-3xl mx-auto">
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                  The Formula
                </p>
                <p className="text-2xl md:text-3xl font-bold font-mono">
                  Implied FDV = (ETH Burned / Tokens Accrued) × Supply
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  $DOGGO: 500 ETH / 200K tokens × 1B supply = 2.5M ETH (~$10M)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
