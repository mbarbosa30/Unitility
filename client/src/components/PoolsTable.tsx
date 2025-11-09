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
import { ArrowUpDown, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Pool } from "@shared/schema";

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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>
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
                <TableHead>Gas</TableHead>
                <TableHead>
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
                <TableHead className="text-right">
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPools.map((pool) => (
                <TableRow key={pool.id} className="hover-elevate" data-testid={`row-pool-${pool.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol={pool.tokenSymbol} />
                      <div className="flex flex-col">
                        <span className="font-semibold">{pool.tokenSymbol}</span>
                        <span className="text-xs text-muted-foreground">
                          {pool.tokenName}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{pool.feePercentage}%</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{pool.gasPrice}</span>
                  </TableCell>
                  <TableCell>
                    <DiscountBadge discount={parseFloat(pool.discount)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono font-semibold">
                      {formatVolume(pool.volume)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" data-testid={`button-send-${pool.tokenSymbol.toLowerCase()}`}>
                      <Send className="h-3 w-3 mr-1" />
                      Send
                    </Button>
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
