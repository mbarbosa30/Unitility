import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, RotateCcw } from "lucide-react";

export default function FDVSimulator() {
  const [totalSupply, setTotalSupply] = useState<string>("1000000000"); // 1B default
  const [ethBurned, setEthBurned] = useState<number>(0);
  const [tokensAccrued, setTokensAccrued] = useState<number>(0);
  const [transferCount, setTransferCount] = useState<number>(0);

  const gasCostPerTransfer = 0.002; // ~$8 at 4000 ETH/USD
  const feePercentage = 0.005; // 0.5%
  const avgTransferAmount = 1000; // tokens

  const impliedPrice = tokensAccrued > 0 ? ethBurned / tokensAccrued : 0;
  const impliedFDV = impliedPrice * parseFloat(totalSupply || "0");

  const simulateTransfer = () => {
    const newEthBurned = ethBurned + gasCostPerTransfer;
    const tokenFee = avgTransferAmount * feePercentage;
    const newTokensAccrued = tokensAccrued + tokenFee;
    
    setEthBurned(newEthBurned);
    setTokensAccrued(newTokensAccrued);
    setTransferCount(transferCount + 1);
  };

  const simulateMultiple = (count: number) => {
    let newEthBurned = ethBurned;
    let newTokensAccrued = tokensAccrued;
    
    for (let i = 0; i < count; i++) {
      newEthBurned += gasCostPerTransfer;
      const tokenFee = avgTransferAmount * feePercentage;
      newTokensAccrued += tokenFee;
    }
    
    setEthBurned(newEthBurned);
    setTokensAccrued(newTokensAccrued);
    setTransferCount(transferCount + count);
  };

  const reset = () => {
    setEthBurned(0);
    setTokensAccrued(0);
    setTransferCount(0);
  };

  return (
    <section className="relative py-24 md:py-32 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
              The Economic Oracle: <span className="text-primary">Usage Reveals Value</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Every gasless transfer burns ETH and earns tokens. The ratio reveals intended FDV.
            </p>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Token Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="total-supply" className="text-base">Total Supply</Label>
                <Input
                  id="total-supply"
                  type="number"
                  value={totalSupply}
                  onChange={(e) => setTotalSupply(e.target.value)}
                  placeholder="1000000000"
                  className="font-mono"
                  data-testid="input-total-supply"
                />
                <p className="text-sm text-muted-foreground">
                  {parseFloat(totalSupply || "0").toLocaleString()} tokens
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Gas per Transfer</p>
                  <p className="text-2xl font-bold tabular-nums">{gasCostPerTransfer} ETH</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Fee Rate</p>
                  <p className="text-2xl font-bold tabular-nums">{(feePercentage * 100).toFixed(2)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            <Button
              size="lg"
              onClick={() => simulateTransfer()}
              className="font-bold"
              data-testid="button-simulate-one"
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              Send 1 Transfer
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => simulateMultiple(10)}
              className="font-bold"
              data-testid="button-simulate-ten"
            >
              Send 10 Transfers
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => simulateMultiple(100)}
              className="font-bold"
              data-testid="button-simulate-hundred"
            >
              Send 100 Transfers
            </Button>
          </div>

          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="pt-6 space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Transfers</p>
                  <p className="text-3xl md:text-4xl font-extrabold tabular-nums text-primary" data-testid="text-transfer-count">
                    {transferCount}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">ETH Burned</p>
                  <p className="text-3xl md:text-4xl font-extrabold tabular-nums text-primary" data-testid="text-eth-burned">
                    {ethBurned.toFixed(3)}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Tokens Accrued</p>
                  <p className="text-3xl md:text-4xl font-extrabold tabular-nums text-primary" data-testid="text-tokens-accrued">
                    {tokensAccrued.toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Implied Price per Token</p>
                  <p className="text-2xl md:text-3xl font-extrabold tabular-nums font-mono" data-testid="text-implied-price">
                    {impliedPrice > 0 ? impliedPrice.toFixed(8) : "0.00000000"} ETH
                  </p>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-base font-bold text-foreground">Intended FDV</p>
                  <p className="text-3xl md:text-4xl font-extrabold tabular-nums text-primary" data-testid="text-implied-fdv">
                    {impliedFDV > 0 ? impliedFDV.toFixed(2) : "0.00"} ETH
                  </p>
                </div>
                {impliedFDV > 0 && (
                  <p className="text-sm text-muted-foreground text-right">
                    ≈ ${(impliedFDV * 4000).toLocaleString()} USD @ $4,000/ETH
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={reset}
              className="gap-2"
              data-testid="button-reset"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Simulator
            </Button>
          </div>

          <div className="bg-card/50 border-2 border-dashed rounded-lg p-6 md:p-8">
            <p className="text-center text-muted-foreground leading-relaxed">
              <span className="font-bold">How it works:</span> Each transfer burns ~0.002 ETH in gas and earns the sponsor 0.5% of the token amount as a fee. 
              The ratio of ETH burned to tokens accrued reveals the <span className="font-bold text-primary">implied price</span>. 
              Multiply by total supply to get <span className="font-bold text-primary">Intended FDV</span>—the market cap justified by real utility, not hype.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
