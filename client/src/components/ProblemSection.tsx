import { Lock, TrendingDown, DollarSign } from "lucide-react";

export default function ProblemSection() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center space-y-6 mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              The ETH Tax <span className="text-destructive">Kills Utility</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-16">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-destructive/10 flex items-center justify-center border-4 border-destructive/20">
                  <Lock className="w-24 h-24 md:w-32 md:h-32 text-destructive" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-full font-bold text-sm">
                  Locked
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <p className="text-xl md:text-2xl leading-relaxed">
                You hold $DOGGO. Love it. But can't send it without ETH.
              </p>
              <p className="text-xl md:text-2xl leading-relaxed">
                Gas eats 5-10%. Transfers die. Tokens stagnate.
              </p>
              <p className="text-xl md:text-2xl leading-relaxed">
                Market caps? Hype bubbles, not real use.
              </p>
              <p className="text-2xl md:text-3xl font-bold mt-8">
                <span className="text-destructive">Result:</span> 90% of tokens unused. $150B TVL trapped.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="text-lg font-bold">Gas Barrier</h3>
              </div>
              <div className="text-4xl font-extrabold text-destructive" data-testid="text-gas-barrier-stat">70%</div>
              <p className="text-muted-foreground">abandoned sends</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="text-lg font-bold">No Yield</h3>
              </div>
              <div className="text-4xl font-extrabold text-destructive" data-testid="text-no-yield-stat">0%</div>
              <p className="text-muted-foreground">Sponsors HODL, not earn</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="text-lg font-bold">Fake Caps</h3>
              </div>
              <div className="text-2xl font-extrabold text-destructive" data-testid="text-fake-caps-stat">Speculation</div>
              <p className="text-muted-foreground">&gt; Utility</p>
            </div>
          </div>

          <div className="text-center mt-16">
            <p className="text-3xl md:text-4xl font-extrabold text-foreground/80">
              Until now.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
