import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import TokenIcon from "./TokenIcon";
import DiscountBadge from "./DiscountBadge";
import { ArrowUpDown, Send, Inbox } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { formatEther } from "viem";
import PaymasterPoolABI from "@/contracts/PaymasterPool.json";
import type { Pool } from "@shared/schema";

// Component for individual pool row that reads blockchain data
function PoolRow({ pool, formatVolume }: { pool: Pool; formatVolume: (v: string) => string }) {
  const publicClient = usePublicClient();
  
  // Read ETH balance
  const { data: ethBalance } = useQuery({
    queryKey: ['pool-balance', pool.contractAddress],
    queryFn: async () => {
      if (!publicClient || !pool.contractAddress) return undefined;
      try {
        const balance = await publicClient.getBalance({ 
          address: pool.contractAddress as `0x${string}` 
        });
        return formatEther(balance);
      } catch (error) {
        console.error('Error reading ETH balance for', pool.tokenSymbol, error);
        return undefined;
      }
    },
    enabled: !!publicClient && !!pool.contractAddress,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });

  // Read unclaimed fees
  const { data: unclaimedFees } = useQuery({
    queryKey: ['pool-fees', pool.contractAddress],
    queryFn: async () => {
      if (!publicClient || !pool.contractAddress) return undefined;
      try {
        const fees = await publicClient.readContract({
          address: pool.contractAddress as `0x${string}`,
          abi: PaymasterPoolABI.abi,
          functionName: 'unclaimedFees',
        });
        return formatEther(fees as bigint);
      } catch (error) {
        console.error('Error reading unclaimed fees for', pool.tokenSymbol, error);
        return undefined;
      }
    },
    enabled: !!publicClient && !!pool.contractAddress,
    staleTime: 30000,
    retry: 2,
  });

  // Use blockchain data if available, otherwise fall back to database values
  const displayEthBalance = ethBalance !== undefined 
    ? parseFloat(ethBalance).toFixed(2) 
    : pool.ethDeposited;
  const displayFees = unclaimedFees !== undefined 
    ? parseFloat(unclaimedFees).toFixed(2) 
    : pool.feesEarned;

  return (
    <TableRow key={pool.id} data-testid={`row-pool-${pool.tokenSymbol}`}>
      <TableCell>
        <div className="flex items-center gap-3">
          <TokenIcon symbol={pool.tokenSymbol} />
          <div className="flex flex-col">
            <span className="font-semibold" data-testid={`text-token-${pool.tokenSymbol}`}>
              {pool.tokenSymbol}
            </span>
            <span className="text-xs text-muted-foreground">
              {pool.tokenName}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <Badge variant="secondary" data-testid={`text-fee-${pool.tokenSymbol}`}>
            {pool.feePercentage}%
          </Badge>
          <span className="text-xs text-muted-foreground">
            Min: {parseFloat(pool.minTokensPerTransfer)} {pool.tokenSymbol}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground" data-testid={`text-gas-${pool.tokenSymbol}`}>
        {pool.gasPrice} gwei
      </TableCell>
      <TableCell>
        <DiscountBadge discount={parseFloat(pool.discount)} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono" data-testid={`text-volume-${pool.tokenSymbol}`}>
            ${formatVolume(pool.volume)}
          </span>
          <span className="text-xs text-muted-foreground">
            {displayEthBalance} ETH
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button 
          size="sm" 
          className="gap-2" 
          data-testid={`button-send-${pool.tokenSymbol}`}
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function PoolsTable() {
  const [sortBy, setSortBy] = useState<"volume" | "discount" | "fee">("volume");
  const [sortDesc, setSortDesc] = useState(true);

  const { data: pools, isLoading } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  const sortedPools = pools ? [...pools].sort((a, b) => {
    let aVal: number, bVal: number;
    
    switch (sortBy) {
      case "volume":
        aVal = parseFloat(a.volume);
        bVal = parseFloat(b.volume);
        break;
      case "discount":
        aVal = parseFloat(a.discount);
        bVal = parseFloat(b.discount);
        break;
      case "fee":
        aVal = parseFloat(a.feePercentage);
        bVal = parseFloat(b.feePercentage);
        break;
    }
    
    return sortDesc ? bVal - aVal : aVal - bVal;
  }) : [];

  const formatVolume = (volume: string) => {
    const num = parseFloat(volume);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const hasNoPools = !isLoading && sortedPools.length === 0;

  if (isLoading) {
    return (
      <Card data-testid="card-pools">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Pool Discovery</CardTitle>
              <CardDescription>Loading pools...</CardDescription>
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Gas</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex flex-col gap-1.5">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-md" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-12 ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-16 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasNoPools) {
    return (
      <Card data-testid="card-pools">
        <CardHeader>
          <CardTitle>Pool Discovery</CardTitle>
          <CardDescription>Find sponsored pools for gasless transfers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Pools Available</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              There are no sponsorship pools yet. Be the first to create a pool and enable gasless transfers for your favorite token.
            </p>
            <Button variant="default" data-testid="button-empty-create-pool">
              Create First Pool
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-pools">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Pool Discovery</CardTitle>
            <CardDescription>
              Top pools by volume and discount
            </CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1">
            🔥 {pools?.length || 0} Active Pools
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop table view */}
        <div className="hidden md:block rounded-md border overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 z-50 bg-card">Token</TableHead>
                <TableHead className="sticky top-0 z-50 bg-card">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("fee")}
                    className="gap-1 h-8"
                    data-testid="button-sort-fee"
                  >
                    Fee
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="sticky top-0 z-50 bg-card">Gas</TableHead>
                <TableHead className="sticky top-0 z-50 bg-card">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("discount")}
                    className="gap-1 h-8"
                    data-testid="button-sort-discount"
                  >
                    Discount
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="sticky top-0 z-50 text-right bg-card">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("volume")}
                    className="gap-1 h-8"
                    data-testid="button-sort-volume"
                  >
                    Volume
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="sticky top-0 z-50 text-right bg-card">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPools.map((pool) => (
                <PoolRow key={pool.id} pool={pool} formatVolume={formatVolume} />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {sortedPools.map((pool) => (
            <Card key={pool.id} className="hover-elevate" data-testid={`card-pool-${pool.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={pool.tokenSymbol} />
                    <div className="flex flex-col">
                      <span className="font-semibold">{pool.tokenSymbol}</span>
                      <span className="text-xs text-muted-foreground">
                        {pool.tokenName}
                      </span>
                    </div>
                  </div>
                  <DiscountBadge discount={parseFloat(pool.discount)} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Fee</p>
                    <p className="font-mono text-sm font-medium">{pool.feePercentage}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Gas Price</p>
                    <p className="font-mono text-sm font-medium">{pool.gasPrice}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Volume</p>
                    <p className="font-mono text-sm font-semibold">
                      {formatVolume(pool.volume)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">APY</p>
                    <p className="font-mono text-sm font-medium">{pool.apy}%</p>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  variant="default" 
                  data-testid={`button-send-mobile-${pool.tokenSymbol.toLowerCase()}`}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send {pool.tokenSymbol}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
