import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Coins, Zap } from "lucide-react";

export default function ValuePropositionSection() {
  const benefits = [
    {
      icon: Users,
      title: "For Users",
      description: "Send any token. No ETH. No gas.",
      detail: "Transfer tokens as easily as sending a text message. Zero friction, zero complexity.",
    },
    {
      icon: TrendingUp,
      title: "For Sponsors",
      description: "Earn yield in tokens you believe in",
      detail: "Deposit ETH, earn fees in your favorite tokens without buying them directly.",
    },
    {
      icon: Coins,
      title: "For Token Projects",
      description: "Your token becomes usable",
      detail: "Remove the ETH barrier. More usability means more adoption means more value.",
    },
    {
      icon: Zap,
      title: "For Rebalancers",
      description: "Buy tokens at a discount",
      detail: "Capture arbitrage opportunities by helping rebalance pools and profit from price differences.",
    },
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One System. Four Winners.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Paymaster Market creates value for everyone in the ecosystem
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <Card key={index} className="hover-elevate" data-testid={`card-benefit-${index}`}>
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                  <CardDescription className="font-medium text-foreground">
                    {benefit.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{benefit.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
