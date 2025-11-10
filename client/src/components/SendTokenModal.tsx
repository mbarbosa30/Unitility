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
import { useAccount, useSignMessage, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther, type Address, type Hex, maxUint256 } from "viem";
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
  const [needsApproval, setNeedsApproval] = useState(false);
  const { toast } = useToast();

  // Wagmi hooks for wallet connection
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();
  const { writeContract, data: approvalTxHash, isPending: isApprovePending } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });
  
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
      
      console.log('[SendToken] Smart account setup:', {
        accountAddress,
        initCode: initCode.substring(0, 50) + '...',
        initCodeLength: initCode.length,
        nonce: nonce.toString(),
        isDeployed,
      });
      
      // Convert token amount to bigint (assuming 18 decimals)
      const amountBigInt = parseEther(amountInTokens);
      
      // Get pool fee percentage from the current pool
      const pool = await publicClient.readContract({
        address: paymasterAddress,
        abi: [{
          name: 'feePct',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'feePct',
      }) as bigint;
      const feePercentageBasisPoints = Number(pool);
      
      // Step 1: Check if EOA has approved smart account to spend tokens
      const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: [{
          name: 'allowance',
          type: 'function',
          stateMutability: 'view',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
          ],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'allowance',
        args: [address, accountAddress],
      }) as bigint;
      
      // Calculate required balance (amount + fee)
      const tokenFee = (amountBigInt * BigInt(feePercentageBasisPoints)) / BigInt(10000);
      const requiredAllowance = amountBigInt + tokenFee;
      
      // If allowance is insufficient, set flag to show approval button
      if (currentAllowance < requiredAllowance) {
        setNeedsApproval(true);
        throw new Error(
          `Approval needed: Please approve your smart account to spend ${selectedToken} tokens. ` +
          `This is a one-time setup (like approving Uniswap).`
        );
      }
      
      // Reset approval flag if we have sufficient allowance
      setNeedsApproval(false);
      
      // Step 2: Build unsigned UserOperation
      // Use higher gas limits for account deployment
      const unsignedUserOp = buildUserOp({
        account: accountAddress,
        eoaOwner: address, // EOA wallet address
        nonce,
        tokenAddress,
        recipientAddress,
        amount: amountBigInt,
        paymasterAddress,
        feePercentage: feePercentageBasisPoints,
        // Increase gas limits for account deployment
        validationGasLimit: !isDeployed ? BigInt(500000) : BigInt(100000),
        callGasLimit: !isDeployed ? BigInt(200000) : BigInt(50000),
        preVerificationGas: !isDeployed ? BigInt(100000) : BigInt(21000),
      });
      
      // Override initCode if account not deployed
      if (!isDeployed) {
        console.log('[SendToken] Account not deployed, adding initCode with higher gas limits');
        unsignedUserOp.initCode = initCode;
      } else {
        console.log('[SendToken] Account already deployed, no initCode needed');
      }
      
      // Step 3: Get hash for signing
      const userOpHash = getUserOpHash(unsignedUserOp, ENTRY_POINT_ADDRESS, base.id);
      
      // Step 4: Sign the hash with connected wallet
      const signature = await signMessageAsync({ message: { raw: userOpHash as Hex } });
      
      // Step 5: Attach signature to create complete UserOperation
      const signedUserOp = signUserOp(unsignedUserOp, signature);
      
      // Step 6: Submit to bundler
      const userOpHashResult = await bundlerClient.sendUserOperation(
        signedUserOp,
        ENTRY_POINT_ADDRESS
      );
      
      // Step 7: Wait for receipt (with 30s timeout)
      const receipt = await bundlerClient.waitForUserOperationReceipt(userOpHashResult);
      
      if (!receipt.success) {
        throw new Error(receipt.reason || "UserOperation failed");
      }
      
      // Step 8: Record transaction in backend for tracking
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

  // Handle token approval
  const handleApprove = async () => {
    if (!address || !isConnected || !currentPool || !publicClient) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get smart account address
      const { accountAddress } = await setupSimpleAccount(address, publicClient);

      // Approve unlimited tokens to smart account (like Uniswap does)
      writeContract({
        address: currentPool.tokenAddress as Address,
        abi: [{
          name: 'approve',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        }],
        functionName: 'approve',
        args: [accountAddress, maxUint256],
      });

      toast({
        title: "Approval Transaction Sent",
        description: "Please confirm in your wallet...",
      });
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve tokens",
        variant: "destructive",
      });
    }
  };

  // Auto-retry send after successful approval (only for current approval tx)
  useEffect(() => {
    if (isApprovalSuccess && approvalTxHash) {
      toast({
        title: "Approval Successful",
        description: `Your smart account can now spend ${selectedToken} tokens`,
      });
      setNeedsApproval(false);
      
      // Auto-retry the send
      setTimeout(() => {
        if (recipient && amount && currentPool) {
          sendTokenMutation.mutate({
            recipientAddress: recipient as Address,
            tokenAddress: currentPool.tokenAddress as Address,
            paymasterAddress: currentPool.contractAddress as Address,
            amountInTokens: amount,
            poolId: currentPool.id,
          });
        }
      }, 1000);
    }
  }, [isApprovalSuccess, approvalTxHash]);

  // Reset needsApproval when switching tokens
  useEffect(() => {
    setNeedsApproval(false);
  }, [selectedToken]);

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

          {needsApproval ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-warning/20 bg-warning/10 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-warning mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-warning-foreground">Approval Required</p>
                    <p className="text-xs text-muted-foreground">
                      First-time setup: Approve your smart account to spend {selectedToken}. This is a one-time transaction.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleApprove}
                className="w-full h-12"
                size="lg"
                disabled={isApprovePending || isApprovalConfirming}
                data-testid="button-approve-tokens"
              >
                {isApprovePending || isApprovalConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isApprovalConfirming ? "Confirming..." : "Approving..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve {selectedToken}
                  </>
                )}
              </Button>
            </div>
          ) : (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
