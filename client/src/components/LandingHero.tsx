import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LandingHeroProps {
  onGetStarted: () => void;
}

export default function LandingHero({ onGetStarted }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
      
      <div className="container relative mx-auto px-4 py-20 md:py-32">
        <div className="mx-auto max-w-4xl text-center space-y-8">
          <Badge variant="secondary" className="gap-2 px-4 py-2 text-sm">
            <Zap className="h-4 w-4" />
            Powered by ERC-4337 Account Abstraction
          </Badge>
          
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Every token should be as easy to send as a{" "}
            <span className="text-primary">text message</span>
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
            Send any token without ETH for gas. Paymaster Market turns every token into a 
            self-sustaining, gasless utility layer where users send like Venmo, 
            sponsors earn yield, and rebalancers profit.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="gap-2 text-lg px-8 py-6"
              onClick={onGetStarted}
              data-testid="button-hero-get-started"
            >
              Get Started
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-lg px-8 py-6"
              data-testid="button-hero-learn-more"
            >
              Learn How It Works
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12">
            <div className="space-y-2">
              <div className="text-3xl font-bold tabular-nums">100K+</div>
              <div className="text-sm text-muted-foreground">Gasless Transfers</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold tabular-nums">50+</div>
              <div className="text-sm text-muted-foreground">Active Pools</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold tabular-nums">500+</div>
              <div className="text-sm text-muted-foreground">ETH Sponsored</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold tabular-nums">$1M+</div>
              <div className="text-sm text-muted-foreground">Arb Volume</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
