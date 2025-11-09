import { Moon, Sun, BarChart3, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";

export default function Header() {
  const [darkMode, setDarkMode] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle("dark", newMode);
  };

  const isActive = (path: string) => location === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-lg font-bold">P</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold leading-none">Paymaster Market</h1>
              <p className="text-xs text-muted-foreground">Gasless Transfers</p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 md:gap-4">
            <Link href="/app" data-testid="link-pools">
              <Button
                variant={isActive("/app") ? "default" : "ghost"}
                size="sm"
                className="gap-1 md:gap-2"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Pools</span>
              </Button>
            </Link>
            <Link href="/analytics" data-testid="link-analytics">
              <Button
                variant={isActive("/analytics") ? "default" : "ghost"}
                size="sm"
                className="gap-1 md:gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </Button>
            </Link>
          </nav>
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
          
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
