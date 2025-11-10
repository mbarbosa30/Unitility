import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Info, Zap, CheckCircle2, Loader2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TokenIcon from "./TokenIcon";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Pool } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAccount, useSignMessage, usePublicClient } from "wagmi";
import { parseEther, type Address, type Hex } from "viem";
import { buildUserOp, getUserOpHash, signUserOp, ENTRY_POINT_ADDRESS } from "@/lib/userOp";
import { bundlerClient } from "@/lib/bundler";
import { setupSimpleAccount } from "@/lib/simpleAccount";
import { base } from "viem/chains";
import { useSmartWalletStatus } from "@/hooks/useSmartWalletStatus";
import { selectBestPool } from "@/lib/poolSelection";

interface SendTokenModalProps {
  preselectedToken?: string;
  triggerButton?: React.ReactNode;
}

export default function SendTokenModal({ preselectedToken, triggerButton }: SendTokenModalProps = {}) {
  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState(preselectedToken || "");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const { toast } = useToast();

  // Wagmi hooks for wallet connection
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();
  
  // Smart wallet status detection
  const { walletType, smartAccountAddress, smartAccountStatus, isLoading: isLoadingWalletStatus } = useSmartWalletStatus();

  const { data: pools } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  // Set default token when pools load or when preselectedToken changes
  useEffect(() => {
    if (preselectedToken) {
      setSelectedToken(preselectedToken);
    } else if (pools && pools.length > 0 && !selectedToken) {
      setSelectedToken(pools[0].tokenSymbol);
    }
  }, [pools, selectedToken, preselectedToken]);

  // Use intelligent pool selection to find the best pool for this transfer
  const { data: poolSelection } = useQuery({
    queryKey: ['pool-selection', selectedToken, amount, pools?.length],
    queryFn: async () => {
      if (!pools || !amount || parseFloat(amount) <= 0) {
        return { bestPool: null, allCandidates: [] };
      }
      return await selectBestPool({
        tokenSymbol: selectedToken,
        amount,
        pools,
        estimatedGasInETH: "0.001", // ~$3-4 on Base
      });
    },
    enabled: !!pools && !!amount && parseFloat(amount) > 0,
    staleTime: 10000, // 10 seconds
  });

  const currentPool = poolSelection?.bestPool || null;
  const feePercentage = currentPool ? currentPool.effectiveCostBreakdown.baseFee : 0;
  const fee = amount ? (parseFloat(amount) * feePercentage / 100).toFixed(4) : "0.00";
  const youSend = amount ? (parseFloat(amount) - parseFloat(fee)).toFixed(4) : "0.00";

  const sendTokenMutation = useMutation({
    mutationFn: async ({ 
      recipientAddress, 
      tokenAddress, 
      paymasterAddress,
      amountInTokens,
      poolId 
    }: { 
      recipientAddress: Address;
      tokenAddress: Address;
      paymasterAddress: Address;
      amountInTokens: string;
      poolId: string;
    }) => {
      if (!address || !isConnected || !publicClient) {
        throw new Error("Please connect your wallet to send tokens");
      }

      // Setup SimpleAccount: get address, nonce, and initCode (if not deployed)
      const { accountAddress, initCode, nonce, isDeployed } = await setupSimpleAccount(
        address,
        publicClient
      );
      
      // Convert token amount to bigint (assuming 18 decimals)
      const amountBigInt = parseEther(amountInTokens);
      
      // Step 1: Build unsigned UserOperation
      const unsignedUserOp = buildUserOp({
        account: accountAddress,
        nonce,
        tokenAddress,
        recipientAddress,
        amount: amountBigInt,
        paymasterAddress,
      });
      
      // Override initCode if account not deployed
      if (!isDeployed) {
        unsignedUserOp.initCode = initCode;
      }
      
      // Step 2: Get hash for signing
      const userOpHash = getUserOpHash(unsignedUserOp, ENTRY_POINT_ADDRESS, base.id);
      
      // Step 3: Sign the hash with connected wallet
      const signature = await signMessageAsync({ message: { raw: userOpHash as Hex } });
      
      // Step 4: Attach signature to create complete UserOperation
      const signedUserOp = signUserOp(unsignedUserOp, signature);
      
      // Step 5: Submit to bundler
      const userOpHashResult = await bundlerClient.sendUserOperation(
        signedUserOp,
        ENTRY_POINT_ADDRESS
      );
      
      // Step 6: Wait for receipt (with 30s timeout)
      const receipt = await bundlerClient.waitForUserOperationReceipt(userOpHashResult);
      
      if (!receipt.success) {
        throw new Error(receipt.reason || "UserOperation failed");
      }
      
      // Step 7: Record transaction in backend for tracking
      await apiRequest("POST", "/api/transactions", {
        fromAddress: accountAddress,
        toAddress: recipientAddress,
        tokenSymbol: selectedToken,
        amount: amountInTokens,
        fee: fee,
        poolId,
        transactionHash: receipt.receipt.transactionHash,
        blockNumber: receipt.receipt.blockNumber.toString(),
      });
      
      return receipt;
    },
    onSuccess: (receipt) => {
      // Invalidate queries in useEffect to avoid state update during render
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/pools"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      }, 0);
      
      toast({
        title: "Transaction Confirmed",
        description: `Sent ${youSend} ${selectedToken} (${fee} ${selectedToken} fee)`,
      });
      
      setOpen(false);
      setAmount("");
      setRecipient("");
    },
    onError: (error: any) => {
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to send transaction",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    console.log("Send clicked - Debug info:", {
      recipient,
      amount,
      selectedToken,
      currentPool: currentPool ? "Found" : "Missing",
      poolsLoaded: pools ? pools.length : 0,
      isConnected,
    });

    if (!recipient || !amount || !currentPool) {
      const missing = [];
      if (!recipient) missing.push("recipient address");
      if (!amount) missing.push("amount");
      if (!currentPool) missing.push("active pool for this token");
      
      toast({
        title: "Missing Information",
        description: `Please provide: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (!isConnected || !address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to send tokens",
        variant: "destructive",
      });
      return;
    }

    // Validate recipient address format
    if (!recipient.startsWith("0x") || recipient.length !== 42) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address (0x...)",
        variant: "destructive",
      });
      return;
    }

    sendTokenMutation.mutate({
      recipientAddress: recipient as Address,
      tokenAddress: currentPool.tokenAddress as Address,
      paymasterAddress: currentPool.contractAddress as Address,
      amountInTokens: amount,
      poolId: currentPool.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button size="lg" className="gap-2" data-testid="button-send-token">
            <Send className="h-4 w-4" />
            Send Token
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="modal-send-token">
        <DialogHeader>
          <DialogTitle>Send Token</DialogTitle>
          <DialogDescription>
            Send any token without ETH for gas
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Smart Wallet Status Banner */}
          {isConnected && walletType === 'eoa' && (
            <div className="rounded-lg border bg-muted/30 p-3" data-testid="banner-smart-wallet-status">
              <div className="flex items-start gap-3">
                {isLoadingWalletStatus ? (
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin mt-0.5" />
                ) : smartAccountStatus === 'deployed' ? (
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                ) : (
                  <Wallet className="h-5 w-5 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {isLoadingWalletStatus 
                        ? "Checking smart wallet..." 
                        : smartAccountStatus === 'deployed'
                        ? "Smart wallet ready"
                        : "Smart wallet setup"
                      }
                    </p>
                    {smartAccountStatus === 'deployed' && (
                      <Badge variant="success" className="text-xs">Ready</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isLoadingWalletStatus
                      ? "Detecting your wallet configuration..."
                      : smartAccountStatus === 'deployed'
                      ? `Your smart wallet is deployed and ready for gasless transfers`
                      : `Your smart wallet will be created automatically on first send`
                    }
                  </p>
                  {smartAccountAddress && !isLoadingWalletStatus && (
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {smartAccountAddress}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {isConnected && walletType === 'smart-contract' && (
            <div className="rounded-lg border bg-success/10 border-success/20 p-3" data-testid="banner-smart-contract-wallet">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-success-foreground">Smart contract wallet detected</p>
                  <p className="text-xs text-muted-foreground">
                    Your wallet supports gasless transactions natively
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="recipient">To</Label>
            <Input
              id="recipient"
              placeholder="0x1234...abcd or ENS name"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="h-12"
              disabled={sendTokenMutation.isPending}
              data-testid="input-recipient"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Select value={selectedToken} onValueChange={setSelectedToken} disabled={sendTokenMutation.isPending}>
              <SelectTrigger id="token" className="h-12" data-testid="select-token">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pools?.map((pool) => (
                  <SelectItem key={pool.tokenSymbol} value={pool.tokenSymbol}>
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={pool.tokenSymbol} size="sm" />
                      <span className="font-medium">{pool.tokenSymbol}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-lg h-12"
              disabled={sendTokenMutation.isPending}
              data-testid="input-amount"
            />
          </div>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Gas Paid by {selectedToken} Pool</span>
            </div>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-mono">{fee} {selectedToken}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>You send</span>
                <span className="font-mono text-lg">{youSend} {selectedToken}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSend}
            className="w-full h-12"
            size="lg"
            disabled={!amount || !recipient || sendTokenMutation.isPending}
            data-testid="button-confirm-send"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendTokenMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
