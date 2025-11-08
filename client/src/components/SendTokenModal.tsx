import { useState } from "react";
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
import { Send, Info, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TokenIcon from "./TokenIcon";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Pool } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function SendTokenModal() {
  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState("DOGGO");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const { toast } = useToast();

  const { data: pools } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  //todo: remove mock functionality - wallet balances
  const mockBalances: Record<string, string> = {
    DOGGO: "1240.00",
    USDC: "500.00",
    RARE: "89.50",
  };

  const currentPool = pools?.find(p => p.tokenSymbol === selectedToken);
  const feePercentage = currentPool ? parseFloat(currentPool.feePercentage) : 0;
  const fee = amount ? (parseFloat(amount) * feePercentage / 100).toFixed(4) : "0.00";
  const youSend = amount ? (parseFloat(amount) - parseFloat(fee)).toFixed(4) : "0.00";

  const sendTokenMutation = useMutation({
    mutationFn: async ({ transaction }: { transaction: any }) => {
      // Backend handles pool updates atomically
      const res = await apiRequest("POST", "/api/transactions", transaction);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Transaction Submitted",
        description: `Sending ${youSend} ${selectedToken} (${fee} ${selectedToken} fee)`,
      });
      setOpen(false);
      setAmount("");
      setRecipient("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send transaction",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!recipient || !amount || !currentPool) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields and select a token with an active pool",
        variant: "destructive",
      });
      return;
    }

    // Capture current values to avoid stale closures
    const currentFee = fee;
    const currentYouSend = youSend;
    const currentRecipient = recipient;
    const currentPoolId = currentPool.id;
    const currentToken = selectedToken;

    sendTokenMutation.mutate({
      transaction: {
        fromAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // Mock wallet address
        toAddress: currentRecipient,
        tokenSymbol: currentToken,
        amount: currentYouSend,
        fee: currentFee,
        poolId: currentPoolId,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2" data-testid="button-send-token">
          <Send className="h-4 w-4" />
          Send Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="modal-send-token">
        <DialogHeader>
          <DialogTitle>Send Token</DialogTitle>
          <DialogDescription>
            Send any token without ETH for gas
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">To</Label>
            <Input
              id="recipient"
              placeholder="0x1234...abcd or ENS name"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              data-testid="input-recipient"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger id="token" data-testid="select-token">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pools?.map((pool) => (
                  <SelectItem key={pool.tokenSymbol} value={pool.tokenSymbol}>
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={pool.tokenSymbol} size="sm" />
                      <div className="flex flex-col">
                        <span className="font-medium">{pool.tokenSymbol}</span>
                        <span className="text-xs text-muted-foreground">
                          Balance: {mockBalances[pool.tokenSymbol] || "0.00"}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAmount(mockBalances[selectedToken]?.replace(/,/g, "") || "")}
                data-testid="button-max"
              >
                Max
              </Button>
            </div>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-lg"
              data-testid="input-amount"
            />
          </div>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Gas Paid by {selectedToken} Pool</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto">
                <Info className="h-3 w-3" />
              </Button>
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
            className="w-full"
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
