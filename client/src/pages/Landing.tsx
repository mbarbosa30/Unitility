import LandingHero from "@/components/LandingHero";
import ValuePropositionSection from "@/components/ValuePropositionSection";
import HowItWorksSection from "@/components/HowItWorksSection";
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
      <ValuePropositionSection />
      <HowItWorksSection />
      <CTASection onGetStarted={handleGetStarted} />
    </div>
  );
}
