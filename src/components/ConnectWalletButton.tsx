import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

export function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <Button variant="hero" size="sm" onClick={openConnectModal}>
              <Wallet className="h-4 w-4" />
              Connect wallet
            </Button>
          );
        }

        if (chain.unsupported) {
          return (
            <Button variant="destructive" size="sm" onClick={openChainModal}>
              Wrong network
            </Button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openChainModal} className="hidden sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-primary mr-1.5" />
              {chain.name}
            </Button>
            <Button variant="outline" size="sm" onClick={openAccountModal}>
              {account.displayName}
              {account.displayBalance ? ` · ${account.displayBalance}` : ""}
            </Button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
