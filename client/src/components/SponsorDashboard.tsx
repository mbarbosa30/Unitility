import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Settings, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Wallet, ArrowDownToLine, Gift } from "lucide-react";
import TokenIcon from "./TokenIcon";
import SponsorDepositModal from "./SponsorDepositModal";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Pool } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PaymasterPoolABI from "@/contracts/PaymasterPool.json";

export default function SponsorDashboard() {
  const [createOpen, setCreateOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [ethAmount, setEthAmount] = useState("");
  const [feePercentage, setFeePercentage] = useState("");
  const [newFeePercentage, setNewFeePercentage] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const { address } = useAccount();
  const { toast } = useToast();

  const { data: pools, isLoading } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  const myPools = pools?.filter(
    (p) => p.sponsor?.toLowerCase() === address?.toLowerCase()
  ) || [];

  const { writeContract, data: txHash, isPending: isTxPending, error: writeError } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isTxSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Calculate stats from all pools
  const totalEth = myPools.reduce((sum, pool) => sum + parseFloat(pool.ethDeposited || "0"), 0).toFixed(1);
  const totalFees = myPools.reduce((sum, pool) => sum + parseFloat(pool.feesEarned || "0"), 0).toFixed(0);
  const avgApy = myPools.length > 0
    ? (myPools.reduce((sum, pool) => sum + parseFloat(pool.apy || "0"), 0) / myPools.length).toFixed(1)
    : "0.0";
  
  // Mock trend calculations - in production, compare to previous period
  const ethTrend = myPools.length > 0 ? "+12.5" : "0";
  const feesTrend = parseFloat(totalFees) > 0 ? "+18.2" : "0";
  const apyTrend = parseFloat(avgApy) > 5 ? "+2.4" : "-1.2";

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

  const handleWithdraw = () => {
    if (!selectedPool?.contractAddress || !withdrawAmount) {
      toast({
        title: "Missing Information",
        description: "Please enter an amount to withdraw",
        variant: "destructive",
      });
      return;
    }

    try {
      const value = parseEther(withdrawAmount);
      
      writeContract({
        address: selectedPool.contractAddress as `0x${string}`,
        abi: PaymasterPoolABI.abi,
        functionName: "withdraw",
        args: [value],
      });
    } catch (error: any) {
      toast({
        title: "Invalid Amount",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleClaimFees = () => {
    if (!selectedPool?.contractAddress || !claimAmount) {
      toast({
        title: "Missing Information",
        description: "Please enter an amount to claim",
        variant: "destructive",
      });
      return;
    }

    try {
      const value = parseEther(claimAmount);
      
      writeContract({
        address: selectedPool.contractAddress as `0x${string}`,
        abi: PaymasterPoolABI.abi,
        functionName: "claimFees",
        args: [value],
      });
    } catch (error: any) {
      toast({
        title: "Invalid Amount",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle successful transactions
  useEffect(() => {
    if (isTxSuccess && txHash) {
      queryClient.invalidateQueries({ queryKey: ["/api/pools"] });
      toast({
        title: "Transaction Successful",
        description: withdrawOpen ? "ETH withdrawn successfully" : "Fees claimed successfully",
      });
      setWithdrawOpen(false);
      setClaimOpen(false);
      setWithdrawAmount("");
      setClaimAmount("");
      setSelectedPool(null);
    }
  }, [isTxSuccess, txHash, withdrawOpen, toast]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      toast({
        title: "Transaction Failed",
        description: writeError.message,
        variant: "destructive",
      });
    }
    if (receiptError) {
      toast({
        title: "Transaction Failed",
        description: "Transaction was reverted on-chain",
        variant: "destructive",
      });
    }
  }, [writeError, receiptError, toast]);

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="section-sponsor-dashboard">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>My Sponsorships</CardTitle>
                <CardDescription>Loading your pools...</CardDescription>
              </div>
              <Skeleton className="h-9 w-28" />
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
                  {[...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-12 ml-auto" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-12 ml-auto" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-6 w-16 ml-auto rounded-md" />
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
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="section-sponsor-dashboard">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ETH</CardTitle>
            <div className="rounded-full bg-muted p-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{totalEth}</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUp className="h-3 w-3 text-success" />
              <p className="text-xs text-success font-medium">
                {ethTrend}% this week
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Earned</CardTitle>
            <div className="rounded-full bg-muted p-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{totalFees}</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUp className="h-3 w-3 text-success" />
              <p className="text-xs text-success font-medium">
                {feesTrend}% this week
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg APY</CardTitle>
            <div className="rounded-full bg-muted p-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{avgApy}%</div>
            <div className="flex items-center gap-1 mt-1">
              {parseFloat(apyTrend) > 0 ? (
                <>
                  <ArrowUp className="h-3 w-3 text-success" />
                  <p className="text-xs text-success font-medium">
                    {apyTrend}% vs last week
                  </p>
                </>
              ) : (
                <>
                  <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">
                    {apyTrend}% vs last week
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>My Sponsorships</CardTitle>
              <CardDescription>
                Pools you're earning from
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <SponsorDepositModal />
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
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPool(pool);
                            setWithdrawOpen(true);
                          }}
                          data-testid={`button-withdraw-${pool.tokenSymbol.toLowerCase()}`}
                        >
                          <ArrowDownToLine className="h-3 w-3 mr-1" />
                          Withdraw
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPool(pool);
                            setClaimOpen(true);
                          }}
                          data-testid={`button-claim-${pool.tokenSymbol.toLowerCase()}`}
                        >
                          <Gift className="h-3 w-3 mr-1" />
                          Claim
                        </Button>
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
                    <TableCell colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="rounded-full bg-muted p-3 mb-4">
                          <Wallet className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No Active Sponsorships</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                          Create your first pool to start earning fees in tokens you believe in. Deposit ETH and earn yield as users make gasless transfers.
                        </p>
                        <Button onClick={() => setCreateOpen(true)} data-testid="button-empty-sponsor-create">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Pool
                        </Button>
                      </div>
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

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw ETH</DialogTitle>
            <DialogDescription>
              Withdraw ETH from {selectedPool?.tokenSymbol} pool
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">Amount (ETH)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                step="0.001"
                min="0"
                placeholder="0.1"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                data-testid="input-withdraw-amount"
              />
            </div>
            {selectedPool && (
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available:</span>
                  <span className="font-mono">{selectedPool.ethDeposited} ETH</span>
                </div>
              </div>
            )}
            <Button
              onClick={handleWithdraw}
              className="w-full"
              disabled={!withdrawAmount || isTxPending || isConfirming}
              data-testid="button-confirm-withdraw"
            >
              {isTxPending || isConfirming ? "Withdrawing..." : "Withdraw ETH"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Claim Fees</DialogTitle>
            <DialogDescription>
              Claim token fees from {selectedPool?.tokenSymbol} pool
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claim-amount">Amount ({selectedPool?.tokenSymbol})</Label>
              <Input
                id="claim-amount"
                type="number"
                step="0.001"
                min="0"
                placeholder="100"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                data-testid="input-claim-amount"
              />
            </div>
            {selectedPool && (
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fees Available:</span>
                  <span className="font-mono">{selectedPool.feesEarned} {selectedPool.tokenSymbol}</span>
                </div>
              </div>
            )}
            <Button
              onClick={handleClaimFees}
              className="w-full"
              disabled={!claimAmount || isTxPending || isConfirming}
              data-testid="button-confirm-claim"
            >
              {isTxPending || isConfirming ? "Claiming..." : "Claim Fees"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
