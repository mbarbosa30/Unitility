import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export default function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Sponsor Deposits ETH",
      description: "A sponsor deposits ETH into a pool for $DOGGO and sets a 0.5% fee",
    },
    {
      number: "02",
      title: "User Sends Token",
      description: "User sends 100 $DOGGO to a friend and selects the $DOGGO pool",
    },
    {
      number: "03",
      title: "Pool Pays Gas",
      description: "Pool pays gas in ETH while user pays 0.5 $DOGGO fee",
    },
    {
      number: "04",
      title: "Sponsor Earns Fees",
      description: "Sponsor earns 0.5 $DOGGO and user sends 99.5 $DOGGO",
    },
    {
      number: "05",
      title: "Rebalancer Profits",
      description: "When discounts emerge, rebalancers buy $DOGGO via pool and system rebalances",
    },
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <Badge variant="secondary" className="text-sm">
            The 30-Second Flow
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A decentralized marketplace of gas sponsorship pools built on ERC-4337
          </p>
        </div>

        <div className="max-w-5xl mx-auto space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <Card className="hover-elevate" data-testid={`card-step-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <span className="text-2xl font-bold">{step.number}</span>
                      </div>
                    </div>
                    <div className="flex-1 pt-2">
                      <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                      <p className="text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {index < steps.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
