import { Link } from "@tanstack/react-router";
import { Hexagon, LayoutDashboard, Compass, Shield, Wallet, BarChart3, Droplets, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export function Header() {
  const { isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Hexagon className="h-4 w-4 text-primary-foreground" />
          </div>
          <span>ProofFlow<span className="text-primary">.AI</span></span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link to="/marketplace">
            <Button variant="ghost" size="sm"><Compass className="h-4 w-4" />Marketplace</Button>
          </Link>
          {isConnected && (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm"><LayoutDashboard className="h-4 w-4" />Dashboard</Button>
              </Link>
              <Link to="/payouts">
                <Button variant="ghost" size="sm"><Wallet className="h-4 w-4" />Wallet</Button>
              </Link>
              <Link to="/analytics">
                <Button variant="ghost" size="sm"><BarChart3 className="h-4 w-4" />Analytics</Button>
              </Link>
              <Link to="/admin">
                <Button variant="ghost" size="sm"><Shield className="h-4 w-4" />Admin</Button>
              </Link>
              <Link to="/settings">
                <Button variant="ghost" size="sm"><Settings className="h-4 w-4" /></Button>
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/faucet">
            <Button variant="outline" size="sm">
              <Droplets className="h-4 w-4" />
              <span className="hidden sm:inline">Faucet</span>
            </Button>
          </Link>
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}
