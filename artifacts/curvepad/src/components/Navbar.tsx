import { Link, useLocation } from "wouter";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shortenAddress, formatEth } from "@/lib/web3";
import { Zap, ChevronDown, LogOut, Copy, ExternalLink } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group" data-testid="link-logo">
              <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors neon-glow">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="font-bold text-sm tracking-tight text-foreground">
                Curve<span className="text-primary">Pad</span>
              </span>
            </div>
          </Link>

          <div className="hidden sm:flex items-center gap-1">
            <Link href="/">
              <span
                data-testid="link-explore"
                className={`text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                  location === "/" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Explore
              </span>
            </Link>
            <Link href="/create">
              <span
                data-testid="link-launch"
                className={`text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                  location === "/create" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Launch
              </span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-primary/30 hover:border-primary/60 hover:bg-primary/5 gap-2"
                  data-testid="button-wallet-connected"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {balance && (
                    <span className="text-muted-foreground hidden sm:inline">
                      {formatEth(balance.value, 4)} ETH
                    </span>
                  )}
                  <span className="font-mono">{shortenAddress(address)}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={copyAddress} data-testid="menu-copy-address">
                  <Copy className="w-3.5 h-3.5 mr-2" />
                  {copied ? "Copied!" : "Copy address"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={`https://basescan.org/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-basescan"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-2" />
                    View on BaseScan
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => disconnect()}
                  className="text-destructive focus:text-destructive"
                  data-testid="button-disconnect"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  data-testid="button-connect-wallet"
                >
                  Connect Wallet
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {connectors.map((connector) => (
                  <DropdownMenuItem
                    key={connector.uid}
                    onClick={() => connect({ connector })}
                    data-testid={`connect-${connector.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {connector.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Link href="/create">
            <Button
              size="sm"
              className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-semibold hidden sm:flex"
              data-testid="button-launch-token"
            >
              + Launch Token
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
