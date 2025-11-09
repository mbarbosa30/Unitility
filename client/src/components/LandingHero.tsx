import { ArrowRight, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LandingHeroProps {
  onGetStarted: () => void;
}

export default function LandingHero({ onGetStarted }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)]" />
      
      <div className="container relative mx-auto px-4 py-16">
        <div className="mx-auto max-w-5xl text-center space-y-10">
          <div className="space-y-6">
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl leading-[1.1]">
              Tokens Die in Wallets.
              <br />
              <span className="text-primary">Revive Them.</span>
            </h1>
            
            <p className="mx-auto max-w-3xl text-xl text-foreground/90 md:text-2xl font-medium leading-relaxed">
              Send any token gasless. Earn yield from every transfer. Price its true worth.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button
              size="lg"
              className="gap-2 text-lg px-10 py-7 font-bold"
              onClick={onGetStarted}
              data-testid="button-connect-send"
            >
              <Wallet className="h-5 w-5" />
              Connect & Send
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-lg px-10 py-7 font-bold"
              onClick={onGetStarted}
              data-testid="button-sponsor-pool"
            >
              <TrendingUp className="h-5 w-5" />
              Sponsor a Pool
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-12 pt-16 max-w-3xl mx-auto">
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-extrabold tabular-nums text-primary" data-testid="text-proof-transfers">1M+</div>
              <div className="text-sm md:text-base font-medium text-muted-foreground">transfers</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-extrabold tabular-nums text-primary" data-testid="text-proof-sponsored">$5M</div>
              <div className="text-sm md:text-base font-medium text-muted-foreground">ETH sponsored</div>
            </div>
            <div className="space-y-2 col-span-2 md:col-span-1">
              <div className="text-4xl md:text-5xl font-extrabold tabular-nums text-primary" data-testid="text-proof-apy">25%</div>
              <div className="text-sm md:text-base font-medium text-muted-foreground">avg APY</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
