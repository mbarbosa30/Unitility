import { Wallet, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function Header() {
  const [darkMode, setDarkMode] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle("dark", newMode);
  };

  const connectWallet = () => {
    // Mock wallet connection
    if (!walletConnected) {
      setWalletConnected(true);
      setWalletAddress("0x1234...abcd");
      console.log("Wallet connected");
    } else {
      setWalletConnected(false);
      setWalletAddress("");
      console.log("Wallet disconnected");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-lg font-bold">P</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold leading-none">Paymaster Market</h1>
            <p className="text-xs text-muted-foreground">Gasless Transfers</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            data-testid="button-theme-toggle"
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={walletConnected ? "secondary" : "default"}
            onClick={connectWallet}
            data-testid="button-connect-wallet"
            className="gap-2"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">
              {walletConnected ? walletAddress : "Connect Wallet"}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
