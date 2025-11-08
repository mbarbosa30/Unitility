import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Settings, TrendingUp } from "lucide-react";
import TokenIcon from "./TokenIcon";
import { useQuery } from "@tanstack/react-query";
import type { Pool } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function SponsorDashboard() {
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: pools } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  //todo: remove mock functionality - user's pools
  const myPools = pools?.slice(0, 2) || [];

  const handleCreatePool = () => {
    console.log("Creating new pool");
    toast({
      title: "Pool Created",
      description: "Your sponsorship pool is now active",
    });
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6" data-testid="section-sponsor-dashboard">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ETH</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">7.3</div>
            <p className="text-xs text-muted-foreground">
              Across {myPools.length} pools
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">1,329</div>
            <p className="text-xs text-green-500">
              +18% this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg APY</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">11.0%</div>
            <p className="text-xs text-muted-foreground">
              Annualized return
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>My Sponsorships</CardTitle>
              <CardDescription>
                Pools you're earning from
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-create-pool">
                  <Plus className="h-4 w-4" />
                  Create Pool
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Sponsorship Pool</DialogTitle>
                  <DialogDescription>
                    Deposit ETH and earn fees in your favorite token
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="token-symbol">Token Symbol</Label>
                    <Input id="token-symbol" placeholder="e.g., DOGGO" data-testid="input-token-symbol" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eth-amount">ETH Amount</Label>
                    <Input id="eth-amount" type="number" placeholder="0.00" data-testid="input-eth-amount" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fee">Fee Percentage</Label>
                    <Input id="fee" type="number" placeholder="0.5" step="0.1" data-testid="input-fee" />
                  </div>
                  <Button onClick={handleCreatePool} className="w-full" data-testid="button-confirm-create">
                    Create Pool
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">ETH In</TableHead>
                  <TableHead className="text-right">Fees Earned</TableHead>
                  <TableHead className="text-right">APY</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myPools.map((pool) => (
                  <TableRow key={pool.id} data-testid={`row-sponsor-${pool.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <TokenIcon symbol={pool.tokenSymbol} />
                        <span className="font-semibold">{pool.tokenSymbol}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {pool.ethDeposited}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {pool.feesEarned}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={parseFloat(pool.apy) > 10 ? "default" : "secondary"}>
                        {pool.apy}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" data-testid={`button-adjust-${pool.tokenSymbol.toLowerCase()}`}>
                          <Settings className="h-3 w-3 mr-1" />
                          Adjust
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {myPools.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No active sponsorships. Create your first pool to start earning.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
