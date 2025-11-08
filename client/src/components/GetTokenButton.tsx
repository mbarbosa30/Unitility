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
import { Sparkles, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TokenIcon from "./TokenIcon";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Pool } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function GetTokenButton() {
  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState("DOGGO");
  const [ethAmount, setEthAmount] = useState("");
  const { toast } = useToast();

  const { data: pools } = useQuery<Pool[]>({
    queryKey: ["/api/pools"],
  });

  const discountedPools = pools?.filter(p => parseFloat(p.discount) < 0) || [];
  const selectedPool = discountedPools.find(p => p.tokenSymbol === selectedToken);
  const savings = selectedPool ? Math.abs(parseFloat(selectedPool.discount)) : 0;

  const getTokenMutation = useMutation({
    mutationFn: async ({ poolId, ethValue }: { poolId: string; ethValue: string }) => {
      // Use atomic increment so backend calculates new volume based on current state
      const volumeIncrease = (parseFloat(ethValue) * 2000).toString();
      const res = await apiRequest("PATCH", `/api/pools/${poolId}`, {
        incrementVolume: volumeIncrease,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pools"] });
      toast({
        title: "Token Acquired",
        description: `You saved ${savings.toFixed(1)}% vs. Uniswap!`,
      });
      setOpen(false);
      setEthAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to acquire token",
        variant: "destructive",
      });
    },
  });

  const handleGetToken = () => {
    if (!ethAmount || !selectedPool) {
      toast({
        title: "Validation Error",
        description: "Please enter ETH amount",
        variant: "destructive",
      });
      return;
    }
    
    // Capture current values to avoid stale closures
    const currentPoolId = selectedPool.id;
    const currentEthAmount = ethAmount;
    
    getTokenMutation.mutate({
      poolId: currentPoolId,
      ethValue: currentEthAmount,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2" data-testid="button-get-token">
          <Sparkles className="h-4 w-4" />
          Get Token at Discount
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="modal-get-token">
        <DialogHeader>
          <DialogTitle>Get Token Exposure</DialogTitle>
          <DialogDescription>
            Buy tokens at a discount through sponsor pools
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-select">Token</Label>
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger id="token-select" data-testid="select-discount-token">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {discountedPools.map((pool) => (
                  <SelectItem key={pool.id} value={pool.tokenSymbol}>
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={pool.tokenSymbol} size="sm" />
                      <div className="flex flex-col">
                        <span className="font-medium">{pool.tokenSymbol}</span>
                        <span className="text-xs text-green-500">
                          {Math.abs(parseFloat(pool.discount)).toFixed(1)}% discount
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eth-input">ETH Amount</Label>
            <Input
              id="eth-input"
              type="number"
              placeholder="0.00"
              value={ethAmount}
              onChange={(e) => setEthAmount(e.target.value)}
              className="font-mono text-lg"
              data-testid="input-eth-for-token"
            />
          </div>

          {savings > 0 && ethAmount && (
            <div className="rounded-lg border bg-green-500/10 border-green-500/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-500">
                  You're saving {savings.toFixed(1)}% vs. Uniswap
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Routes through cheapest {selectedToken} pool
              </div>
            </div>
          )}

          <Button
            onClick={handleGetToken}
            className="w-full"
            size="lg"
            disabled={!ethAmount || getTokenMutation.isPending}
            data-testid="button-confirm-get-token"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {getTokenMutation.isPending ? "Acquiring..." : `Get ${selectedToken} Now`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
