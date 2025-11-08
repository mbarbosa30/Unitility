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

export default function SendTokenModal() {
  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState("DOGGO");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const { toast } = useToast();

  //todo: remove mock functionality
  const tokens = [
    { symbol: "DOGGO", name: "Doggo Token", balance: "1,240.00", fee: "0.4%" },
    { symbol: "USDC", name: "USD Coin", balance: "500.00", fee: "0.1%" },
    { symbol: "RARE", name: "Rare Token", balance: "89.50", fee: "0.8%" },
  ];

  const currentToken = tokens.find(t => t.symbol === selectedToken);
  const fee = amount ? (parseFloat(amount) * parseFloat(currentToken?.fee || "0") / 100).toFixed(2) : "0.00";
  const youSend = amount ? (parseFloat(amount) - parseFloat(fee)).toFixed(2) : "0.00";

  const handleSend = () => {
    console.log("Sending", amount, selectedToken, "to", recipient);
    toast({
      title: "Transaction Submitted",
      description: `Sending ${youSend} ${selectedToken} (${fee} ${selectedToken} fee)`,
    });
    setOpen(false);
    setAmount("");
    setRecipient("");
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
                {tokens.map((token) => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={token.symbol} size="sm" />
                      <div className="flex flex-col">
                        <span className="font-medium">{token.symbol}</span>
                        <span className="text-xs text-muted-foreground">
                          Balance: {token.balance}
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
                onClick={() => setAmount(currentToken?.balance.replace(/,/g, "") || "")}
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
            disabled={!amount || !recipient}
            data-testid="button-confirm-send"
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
