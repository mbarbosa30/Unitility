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
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Pool } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function SponsorDashboard() {
  const [createOpen, setCreateOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [ethAmount, setEthAmount] = useState("");
  const [feePercentage, setFeePercentage] = useState("");
  const [newFeePercentage, setNewFeePercentage] = useState("");
  const { toast } = useToast();

  const { data: pools } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  //todo: remove mock functionality - in production, filter pools by current user's wallet address
  const myPools = pools || [];

  // Calculate stats from all pools
  const totalEth = myPools.reduce((sum, pool) => sum + parseFloat(pool.ethDeposited || "0"), 0).toFixed(1);
  const totalFees = myPools.reduce((sum, pool) => sum + parseFloat(pool.feesEarned || "0"), 0).toFixed(0);
  const avgApy = myPools.length > 0
    ? (myPools.reduce((sum, pool) => sum + parseFloat(pool.apy || "0"), 0) / myPools.length).toFixed(1)
    : "0.0";

  const createPoolMutation = useMutation({
    mutationFn: async (newPool: any) => {
      const res = await apiRequest("POST", "/api/pools", newPool);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pools"] });
      toast({
        title: "Pool Created",
        description: "Your sponsorship pool is now active",
      });
      setCreateOpen(false);
      resetCreateForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create pool",
        variant: "destructive",
      });
    },
  });

  const updatePoolMutation = useMutation({
    mutationFn: async ({ id, fee }: { id: string; fee: string }) => {
      const res = await apiRequest("PATCH", `/api/pools/${id}`, { feePercentage: fee });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pools"] });
      toast({
        title: "Pool Updated",
        description: "Fee percentage has been adjusted",
      });
      setAdjustOpen(false);
      setSelectedPool(null);
      setNewFeePercentage("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pool",
        variant: "destructive",
      });
    },
  });

  const resetCreateForm = () => {
    setTokenSymbol("");
    setTokenName("");
    setEthAmount("");
    setFeePercentage("");
  };

  const handleCreatePool = () => {
    if (!tokenSymbol || !tokenName || !ethAmount || !feePercentage) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    createPoolMutation.mutate({
      tokenSymbol: tokenSymbol.toUpperCase(),
      tokenName,
      feePercentage,
      ethDeposited: ethAmount,
      feesEarned: "0",
      volume: "0",
      discount: "0",
      apy: "0",
      gasPrice: "0.001",
    });
  };

  const handleAdjustPool = (pool: Pool) => {
    setSelectedPool(pool);
    setNewFeePercentage(pool.feePercentage);
    setAdjustOpen(true);
  };

  const handleUpdateFee = () => {
    if (!selectedPool || !newFeePercentage) return;
    updatePoolMutation.mutate({ id: selectedPool.id, fee: newFeePercentage });
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
            <div className="text-2xl font-bold tabular-nums">{totalEth}</div>
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
            <div className="text-2xl font-bold tabular-nums">{totalFees}</div>
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
            <div className="text-2xl font-bold tabular-nums">{avgApy}%</div>
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
                    <Input
                      id="token-symbol"
                      placeholder="e.g., DOGGO"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      data-testid="input-token-symbol"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="token-name">Token Name</Label>
                    <Input
                      id="token-name"
                      placeholder="e.g., Doggo Token"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      data-testid="input-token-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eth-amount">ETH Amount</Label>
                    <Input
                      id="eth-amount"
                      type="number"
                      placeholder="0.00"
                      value={ethAmount}
                      onChange={(e) => setEthAmount(e.target.value)}
                      data-testid="input-eth-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fee">Fee Percentage</Label>
                    <Input
                      id="fee"
                      type="number"
                      placeholder="0.5"
                      step="0.1"
                      value={feePercentage}
                      onChange={(e) => setFeePercentage(e.target.value)}
                      data-testid="input-fee"
                    />
                  </div>
                  <Button
                    onClick={handleCreatePool}
                    className="w-full"
                    disabled={createPoolMutation.isPending}
                    data-testid="button-confirm-create"
                  >
                    {createPoolMutation.isPending ? "Creating..." : "Create Pool"}
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAdjustPool(pool)}
                          data-testid={`button-adjust-${pool.tokenSymbol.toLowerCase()}`}
                        >
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

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Pool Fee</DialogTitle>
            <DialogDescription>
              Update the fee percentage for {selectedPool?.tokenSymbol} pool
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-fee">New Fee Percentage</Label>
              <Input
                id="new-fee"
                type="number"
                placeholder="0.5"
                step="0.1"
                value={newFeePercentage}
                onChange={(e) => setNewFeePercentage(e.target.value)}
                data-testid="input-new-fee"
              />
            </div>
            <Button
              onClick={handleUpdateFee}
              className="w-full"
              disabled={updatePoolMutation.isPending}
              data-testid="button-confirm-adjust"
            >
              {updatePoolMutation.isPending ? "Updating..." : "Update Fee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
