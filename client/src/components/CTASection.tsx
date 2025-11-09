import { Button } from "@/components/ui/button";
import { Wallet, Target, Code } from "lucide-react";

interface CTASectionProps {
  onGetStarted: () => void;
}

export default function CTASection({ onGetStarted }: CTASectionProps) {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(120,119,198,0.15),transparent_50%)]" />
      
      <div className="container relative mx-auto px-4">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              Ready to <span className="text-primary">Price the Future?</span>
            </h2>
            <p className="text-2xl md:text-3xl font-bold text-foreground/80">
              Enter the Market.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="gap-2 text-lg px-10 py-7 font-bold"
              onClick={onGetStarted}
              data-testid="button-connect-wallet"
            >
              <Wallet className="h-5 w-5" />
              Connect Wallet
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-lg px-10 py-7 font-bold"
              onClick={onGetStarted}
              data-testid="button-explore-pools"
            >
              <Target className="h-5 w-5" />
              Explore Pools
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-lg px-10 py-7 font-bold"
              onClick={onGetStarted}
              data-testid="button-build-on-us"
            >
              <Code className="h-5 w-5" />
              Build on Us
            </Button>
          </div>

          <div className="pt-8 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Built on Base. Scaling to Ethereum.
            </p>
            <div className="flex gap-6 justify-center text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors" data-testid="link-privacy">Privacy</a>
              <span>·</span>
              <a href="#" className="hover:text-foreground transition-colors" data-testid="link-docs">Docs</a>
              <span>·</span>
              <a href="#" className="hover:text-foreground transition-colors" data-testid="link-discord">Discord</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
