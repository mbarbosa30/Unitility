import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import PaymasterPoolABI from "@/contracts/PaymasterPool.json";
import type { Pool } from "@shared/schema";

export default function SponsorDepositModal() {
  const [open, setOpen] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [amount, setAmount] = useState("");
  const { address } = useAccount();
  const { toast } = useToast();

  const { data: pools } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  const myPools = pools?.filter(
    (p) => p.sponsor?.toLowerCase() === address?.toLowerCase()
  );

  const selectedPool = pools?.find((p) => p.id === selectedPoolId);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess && hash) {
      queryClient.invalidateQueries({ queryKey: ["/api/pools"] });
      toast({
        title: "Deposit Successful",
        description: `${amount} ETH deposited to pool`,
      });
      setOpen(false);
      setAmount("");
      setSelectedPoolId("");
    }
  }, [isSuccess, hash, amount, toast]);

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

  const handleDeposit = () => {
    if (!selectedPool?.contractAddress || !amount) {
      toast({
        title: "Missing Information",
        description: "Please select a pool and enter an amount",
        variant: "destructive",
      });
      return;
    }

    try {
      const value = parseEther(amount);
      
      writeContract({
        address: selectedPool.contractAddress as `0x${string}`,
        abi: PaymasterPoolABI.abi,
        functionName: "deposit",
        value,
      });
    } catch (error: any) {
      toast({
        title: "Invalid Amount",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="sm"
          data-testid="button-deposit-eth"
        >
          <Plus className="h-4 w-4 mr-2" />
          Deposit ETH
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" data-testid="modal-deposit">
        <DialogHeader>
          <DialogTitle>Deposit ETH to Pool</DialogTitle>
          <DialogDescription>
            Add ETH to sponsor gas fees for your pool
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pool">Select Pool</Label>
            <Select value={selectedPoolId} onValueChange={setSelectedPoolId}>
              <SelectTrigger id="pool" data-testid="select-pool">
                <SelectValue placeholder="Choose your pool" />
              </SelectTrigger>
              <SelectContent>
                {myPools?.map((pool) => (
                  <SelectItem key={pool.id} value={pool.id}>
                    {pool.tokenSymbol} Pool - {pool.ethDeposited} ETH
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (ETH)</Label>
            <Input
              id="amount"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-deposit-amount"
            />
          </div>

          {selectedPool && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Balance:</span>
                <span className="font-mono">{selectedPool.ethDeposited} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Balance:</span>
                <span className="font-mono">
                  {(parseFloat(selectedPool.ethDeposited) + parseFloat(amount || "0")).toFixed(6)} ETH
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleDeposit}
            disabled={!selectedPool || !amount || isPending || isConfirming}
            data-testid="button-confirm-deposit"
          >
            {isPending || isConfirming ? "Depositing..." : "Deposit ETH"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
