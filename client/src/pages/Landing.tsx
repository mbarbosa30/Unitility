import LandingHero from "@/components/LandingHero";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import FDVSimulator from "@/components/FDVSimulator";
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
      <FDVSimulator />
      <MetricsSection />
      <CTASection onGetStarted={handleGetStarted} />
    </div>
  );
}
