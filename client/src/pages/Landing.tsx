import LandingHero from "@/components/LandingHero";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import TokenFDVCard from "@/components/TokenFDVCard";
import MetricsSection from "@/components/MetricsSection";
import CTASection from "@/components/CTASection";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    setLocation("/app");
  };

  return (
    <div className="min-h-screen">
      <LandingHero onGetStarted={handleGetStarted} />
      <ProblemSection />
      <SolutionSection />
      <section 
        className="relative py-24 md:py-32 bg-muted/50"
        data-testid="section-economic-oracle"
      >
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl space-y-12">
            <div className="text-center space-y-4">
              <h2 
                className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight"
                data-testid="heading-economic-oracle"
              >
                The Economic Oracle: <span className="text-primary">Live FDV from Gasless Transfers</span>
              </h2>
              <p 
                className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
                data-testid="text-economic-oracle-subtitle"
              >
                Every gasless transfer burns ETH and earns tokens. The ratio reveals intended FDV—live from the blockchain.
              </p>
            </div>

            <TokenFDVCard />

            <div 
              className="bg-card/50 border-2 border-dashed rounded-lg p-6 md:p-8"
              data-testid="card-how-it-works"
            >
              <p 
                className="text-center text-muted-foreground leading-relaxed"
                data-testid="text-how-it-works"
              >
                <span className="font-bold">How it works:</span> Each gasless transfer burns ETH in gas costs and pays a small fee in tokens to the sponsor. 
                The ratio of ETH burned to tokens accrued reveals the <span className="font-bold text-primary">implied price</span>. 
                Multiply by total supply to get <span className="font-bold text-primary">Intended FDV</span>—the market cap justified by real utility, not speculation.
              </p>
            </div>
          </div>
        </div>
      </section>
      <MetricsSection />
      <CTASection onGetStarted={handleGetStarted} />
    </div>
  );
}
