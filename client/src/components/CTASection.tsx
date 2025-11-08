import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

interface CTASectionProps {
  onGetStarted: () => void;
}

export default function CTASection({ onGetStarted }: CTASectionProps) {
  return (
    <section className="py-20 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Usability is the new liquidity
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Paymaster Market doesn't compete with DEXs. It completes them. 
              Uniswap gives you price. We give you permission to use.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="gap-2 text-lg px-8 py-6"
              onClick={onGetStarted}
              data-testid="button-cta-launch"
            >
              <Sparkles className="h-5 w-5" />
              Launch App
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="pt-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              Built on ERC-4337 Account Abstraction
            </p>
            <p className="text-xs text-muted-foreground">
              Testnet MVP available now on Sepolia
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
