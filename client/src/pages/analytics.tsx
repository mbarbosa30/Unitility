import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface TokenValuationData {
  tokenSymbol: string;
  tokenName: string;
  totalPools: number;
  aggregateGasBurned: string;
  aggregateFeesEarned: string;
  aggregateVolume: string;
  impliedPrice: string;
  intendedFdv: string | null;
  totalSupply: string | null;
  spotPrice: string | null;
  spotFdv: string | null;
  arbitrageSignal: number | null;
  timestamp: string;
}

export default function Analytics() {
  const [selectedToken, setSelectedToken] = useState<string>("");

  // Fetch all pools to get available tokens
  const { data: pools, isLoading: isLoadingPools, isError: isErrorPools } = useQuery<Array<{ tokenSymbol: string }>>({
    queryKey: ["/api/pools"],
  });

  // Get unique tokens from pools
  const availableTokens = pools
    ? Array.from(new Set(pools.map((p) => p.tokenSymbol)))
    : [];

  // Auto-select first available token when pools load (in useEffect to avoid setState in render)
  useEffect(() => {
    if (!selectedToken && availableTokens.length > 0) {
      setSelectedToken(availableTokens[0]);
    }
  }, [selectedToken, availableTokens]);

  // Fetch token valuation data
  const { data: valuationData, isLoading: isLoadingValuation, isError: isErrorValuation } = useQuery<TokenValuationData>({
    queryKey: ["/api/tokens", selectedToken, "valuation"],
    enabled: !!selectedToken,
  });

  const formatETH = (value: string | null) => {
    if (!value || value === "0") return "0";
    const num = parseFloat(value);
    if (num < 0.0001) return num.toExponential(2);
    return num.toFixed(6);
  };

  const formatLargeNumber = (value: string | null) => {
    if (!value) return "N/A";
    const num = parseFloat(value);
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(0);
  };

  // Don't show arbitrage signal until we have spot price integration
  const renderArbitrageSignal = () => {
    return (
      <Badge variant="outline" data-testid="badge-arbitrage-status">
        Coming Soon
      </Badge>
    );
  };

  // Handle loading and error states
  if (isLoadingPools) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="page-analytics">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isErrorPools || availableTokens.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="page-analytics">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">Economic Oracle Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground" data-testid="text-page-description">
            Utility-derived token valuations based on gas burn and fee accrual
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
            <p className="text-muted-foreground">
              {isErrorPools ? "Failed to load pools. Please try again." : "No pools available yet."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6" data-testid="page-analytics">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">Economic Oracle</h1>
          <p className="text-sm md:text-base text-muted-foreground" data-testid="text-page-description">
            Utility-derived token valuations
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <label htmlFor="token-select" className="text-sm font-medium">
            Token:
          </label>
          <Select value={selectedToken} onValueChange={setSelectedToken}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-token">
              <SelectValue placeholder="Select token" />
            </SelectTrigger>
            <SelectContent>
              {availableTokens.map((token: string) => (
                <SelectItem key={token} value={token} data-testid={`select-option-${token}`}>
                  {token}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoadingValuation ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isErrorValuation ? (
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">Failed to load valuation data. Please try again.</p>
          </CardContent>
        </Card>
      ) : valuationData ? (
        <>
          {/* Key Metrics Cards - Mobile-first single column */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {/* Implied Price (P) */}
            <Card data-testid="card-implied-price">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Implied Price (P)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-implied-price">
                  {formatETH(valuationData.impliedPrice)} ETH
                </div>
                <p className="text-xs text-muted-foreground">
                  B / T = Gas Burned / Fees Earned
                </p>
              </CardContent>
            </Card>

            {/* Intended FDV (V) */}
            <Card data-testid="card-intended-fdv">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Intended FDV (V)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-intended-fdv">
                  {valuationData.intendedFdv && valuationData.intendedFdv !== "0"
                    ? `${formatETH(valuationData.intendedFdv)} ETH`
                    : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  P × Total Supply
                </p>
              </CardContent>
            </Card>

            {/* Cumulative Gas Burned (B) */}
            <Card data-testid="card-gas-burned">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gas Burned (B)</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-gas-burned">
                  {formatETH(valuationData.aggregateGasBurned)} ETH
                </div>
                <p className="text-xs text-muted-foreground">
                  Cumulative across {valuationData.totalPools} pool{valuationData.totalPools !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            {/* Token Fees Earned (T) */}
            <Card data-testid="card-fees-earned">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fees Earned (T)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-fees-earned">
                  {formatLargeNumber(valuationData.aggregateFeesEarned)} {valuationData.tokenSymbol}
                </div>
                <p className="text-xs text-muted-foreground">
                  Token fees collected
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Economic Insight Card */}
          <Card data-testid="card-economic-insight">
            <CardHeader>
              <CardTitle>Economic Insight</CardTitle>
              <CardDescription>
                Understanding the utility-derived valuation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Valuation Model</h3>
                <p className="text-sm text-muted-foreground">
                  This token's <span className="font-medium">Intended FDV</span> is calculated
                  from real usage: sponsors have burned{" "}
                  <span className="font-medium">{formatETH(valuationData.aggregateGasBurned)} ETH</span> on gas
                  to earn <span className="font-medium">{formatLargeNumber(valuationData.aggregateFeesEarned)} {valuationData.tokenSymbol}</span> in fees.
                  This implies an effective price of{" "}
                  <span className="font-medium">{formatETH(valuationData.impliedPrice)} ETH</span> per token.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-2">
                <div>
                  <p className="text-sm font-medium">Arbitrage Signal</p>
                  <p className="text-xs text-muted-foreground">
                    DEX spot price integration
                  </p>
                </div>
                {renderArbitrageSignal()}
              </div>

              {valuationData.totalSupply && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Supply</p>
                    <p className="font-medium" data-testid="text-total-supply">
                      {formatLargeNumber(valuationData.totalSupply)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Volume</p>
                    <p className="font-medium" data-testid="text-total-volume">
                      {formatLargeNumber(valuationData.aggregateVolume)} {valuationData.tokenSymbol}
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground italic">
                  Note: Spot price integration coming soon. Current metrics show utility-based
                  valuation from gas sponsorship activity.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">No valuation data available for this token</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
