import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp } from "lucide-react";

interface TokenAnalytics {
  tokenSymbol: string;
  totalEthBurned: string;
  totalTokensAccrued: string;
  totalTransfers: number;
  avgTransferAmount: string;
  avgFeePercentage: string;
  impliedPrice: string | null;
  intendedFdv: string | null;
  totalSupply: string | null;
}

interface TokenFDVCardProps {
  tokenSymbol?: string;
}

export default function TokenFDVCard({ tokenSymbol }: TokenFDVCardProps) {
  const { data: analytics, isLoading, error } = useQuery<TokenAnalytics[]>({
    queryKey: tokenSymbol ? ['/api/analytics/tokens', tokenSymbol] : ['/api/analytics/tokens'],
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <Card className="border-2" data-testid="card-token-analytics-loading">
        <CardHeader>
          <Skeleton className="h-8 w-48" data-testid="skeleton-title" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" data-testid={`skeleton-label-${i}`} />
                <Skeleton className="h-10 w-full" data-testid={`skeleton-value-${i}`} />
              </div>
            ))}
          </div>
          <Skeleton className="h-px w-full" data-testid="skeleton-divider" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" data-testid="skeleton-price" />
            <Skeleton className="h-12 w-full" data-testid="skeleton-fdv" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-2 border-destructive/20 bg-destructive/5" data-testid="card-token-analytics-error">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive" data-testid="text-error-message">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">Failed to load analytics data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.length === 0) {
    return (
      <Card className="border-2 border-dashed" data-testid="card-token-analytics-empty">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 text-muted-foreground text-center py-8">
            <TrendingUp className="w-12 h-12 opacity-20" />
            <div>
              <p className="font-medium text-foreground" data-testid="text-empty-heading">
                No transaction data yet
              </p>
              <p className="text-sm mt-2" data-testid="text-empty-description">
                {tokenSymbol 
                  ? `No transfers have been made for ${tokenSymbol} tokens yet.`
                  : 'No gasless transfers have been made yet.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Display all tokens or single token
  return (
    <div className="space-y-6">
      {analytics.map((token) => {
        const ethBurned = parseFloat(token.totalEthBurned);
        const tokensAccrued = parseFloat(token.totalTokensAccrued);
        const impliedPrice = token.impliedPrice ? parseFloat(token.impliedPrice) : null;
        const intendedFdv = token.intendedFdv ? parseFloat(token.intendedFdv) : null;
        const avgFee = parseFloat(token.avgFeePercentage);
        const avgAmount = parseFloat(token.avgTransferAmount);

        return (
          <Card 
            key={token.tokenSymbol} 
            className="border-2 border-primary/20 bg-primary/5"
            data-testid={`card-token-analytics-${token.tokenSymbol}`}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle 
                  className="text-2xl flex items-center gap-3"
                  data-testid={`text-token-symbol-${token.tokenSymbol}`}
                >
                  {token.tokenSymbol}
                  <Badge 
                    variant="secondary" 
                    className="text-sm font-normal"
                    data-testid={`badge-transfer-count-${token.tokenSymbol}`}
                  >
                    {token.totalTransfers} transfers
                  </Badge>
                </CardTitle>
                <Badge 
                  variant="success" 
                  className="font-mono text-xs"
                  data-testid={`badge-real-data-${token.tokenSymbol}`}
                >
                  REAL DATA
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p 
                    className="text-sm font-medium text-muted-foreground"
                    data-testid={`label-eth-burned-${token.tokenSymbol}`}
                  >
                    ETH Burned
                  </p>
                  <p 
                    className="text-3xl md:text-4xl font-extrabold tabular-nums text-primary font-mono"
                    data-testid={`text-eth-burned-${token.tokenSymbol}`}
                  >
                    {ethBurned.toFixed(6)}
                  </p>
                  <p 
                    className="text-xs text-muted-foreground"
                    data-testid={`desc-eth-burned-${token.tokenSymbol}`}
                  >
                    Gas costs paid by sponsors
                  </p>
                </div>
                <div className="space-y-2">
                  <p 
                    className="text-sm font-medium text-muted-foreground"
                    data-testid={`label-tokens-accrued-${token.tokenSymbol}`}
                  >
                    Tokens Accrued
                  </p>
                  <p 
                    className="text-3xl md:text-4xl font-extrabold tabular-nums text-primary font-mono"
                    data-testid={`text-tokens-accrued-${token.tokenSymbol}`}
                  >
                    {tokensAccrued.toFixed(2)}
                  </p>
                  <p 
                    className="text-xs text-muted-foreground"
                    data-testid={`desc-tokens-accrued-${token.tokenSymbol}`}
                  >
                    Fees earned by sponsors
                  </p>
                </div>
                <div className="space-y-2">
                  <p 
                    className="text-sm font-medium text-muted-foreground"
                    data-testid={`label-avg-transfer-${token.tokenSymbol}`}
                  >
                    Avg Transfer
                  </p>
                  <p 
                    className="text-3xl md:text-4xl font-extrabold tabular-nums text-primary font-mono"
                    data-testid={`text-avg-transfer-${token.tokenSymbol}`}
                  >
                    {avgAmount.toFixed(2)}
                  </p>
                  <p 
                    className="text-xs text-muted-foreground"
                    data-testid={`desc-avg-transfer-${token.tokenSymbol}`}
                  >
                    {token.tokenSymbol} per tx
                  </p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-4">
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <p 
                    className="text-sm font-medium text-muted-foreground"
                    data-testid={`label-implied-price-${token.tokenSymbol}`}
                  >
                    Implied Price per Token
                  </p>
                  <p 
                    className="text-2xl md:text-3xl font-extrabold tabular-nums font-mono"
                    data-testid={`text-implied-price-${token.tokenSymbol}`}
                  >
                    {impliedPrice !== null 
                      ? `${impliedPrice.toFixed(10)} ETH`
                      : 'N/A'}
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <p 
                    className="text-base font-bold text-foreground"
                    data-testid={`label-intended-fdv-${token.tokenSymbol}`}
                  >
                    Intended FDV
                  </p>
                  <p 
                    className="text-3xl md:text-4xl font-extrabold tabular-nums text-primary font-mono"
                    data-testid={`text-intended-fdv-${token.tokenSymbol}`}
                  >
                    {intendedFdv !== null 
                      ? `${intendedFdv.toFixed(2)} ETH`
                      : 'N/A'}
                  </p>
                </div>
                {intendedFdv !== null && (
                  <div className="flex items-baseline justify-end gap-2">
                    <p 
                      className="text-sm text-muted-foreground"
                      data-testid={`text-fdv-usd-${token.tokenSymbol}`}
                    >
                      ≈ ${(intendedFdv * 4000).toLocaleString(undefined, { 
                        minimumFractionDigits: 0, 
                        maximumFractionDigits: 0 
                      })} USD
                    </p>
                    <p 
                      className="text-xs text-muted-foreground/70"
                      data-testid={`text-eth-price-${token.tokenSymbol}`}
                    >
                      @ $4,000/ETH
                    </p>
                  </div>
                )}
              </div>

              <div 
                className="bg-card/50 border rounded-lg p-4 space-y-2"
                data-testid={`info-panel-${token.tokenSymbol}`}
              >
                <div className="flex items-baseline justify-between text-sm">
                  <span 
                    className="text-muted-foreground"
                    data-testid={`label-avg-fee-${token.tokenSymbol}`}
                  >
                    Avg Fee Rate:
                  </span>
                  <span 
                    className="font-mono font-bold"
                    data-testid={`text-avg-fee-${token.tokenSymbol}`}
                  >
                    {(avgFee * 100).toFixed(3)}%
                  </span>
                </div>
                {token.totalSupply && (
                  <div className="flex items-baseline justify-between text-sm">
                    <span 
                      className="text-muted-foreground"
                      data-testid={`label-total-supply-${token.tokenSymbol}`}
                    >
                      Total Supply:
                    </span>
                    <span 
                      className="font-mono font-bold"
                      data-testid={`text-total-supply-${token.tokenSymbol}`}
                    >
                      {parseFloat(token.totalSupply).toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
