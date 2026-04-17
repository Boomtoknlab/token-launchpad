import { useState, useEffect } from "react";
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { useLocation } from "wouter";
import { FACTORY_ADDRESS, FACTORY_ABI, BASE_PRICE, SLOPE } from "@/lib/web3";
import { saveTokenMetadata } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BondingCurveChart } from "@/components/BondingCurveChart";
import { TokenAvatar } from "@/components/TokenAvatar";
import {
  Zap,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ChevronDown,
  ArrowRight,
  Twitter,
  Globe,
  Send,
  ImageIcon,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function CreatePage() {
  const [, setLocation] = useLocation();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [seedEth, setSeedEth] = useState("");
  const [metaSaved, setMetaSaved] = useState(false);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  const isFactoryDeployed = FACTORY_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const deployedTokenAddress = isSuccess && receipt?.logs?.[0]?.address
    ? receipt.logs[0].address
    : null;

  useEffect(() => {
    if (deployedTokenAddress && address && !metaSaved) {
      setMetaSaved(true);
      saveTokenMetadata(deployedTokenAddress, {
        name,
        symbol,
        description,
        imageUrl,
        twitter,
        telegram,
        website,
        creatorAddress: address,
      });
    }
  }, [deployedTokenAddress, address, metaSaved]);

  const handleDeploy = async () => {
    if (!name || !symbol) {
      toast({ title: "Missing fields", description: "Enter a token name and symbol.", variant: "destructive" });
      return;
    }
    if (!isFactoryDeployed) {
      toast({ title: "Factory not deployed", variant: "destructive" });
      return;
    }
    if (!isConnected) {
      toast({ title: "Connect wallet", variant: "destructive" });
      return;
    }
    const seedWei = seedEth ? parseEther(seedEth) : BigInt(0);
    const fee = (seedWei * BigInt(1)) / BigInt(100);
    const totalValue = seedWei + fee;
    writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "createToken",
      args: [name, symbol],
      value: totalValue,
    });
  };

  const demoSupply = BigInt(0);

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-primary uppercase tracking-widest">Launch</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Deploy a Token</h1>
          <p className="text-sm text-muted-foreground">
            One transaction. No liquidity pool. Price set by math.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-lg border border-border/40 bg-card/60 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Token Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="token-name" className="text-xs text-muted-foreground mb-1.5 block">
                      Token Name *
                    </Label>
                    <Input
                      id="token-name"
                      placeholder="e.g. Moon Rocket"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9 text-sm bg-background/50"
                      disabled={isPending || isConfirming}
                    />
                  </div>
                  <div>
                    <Label htmlFor="token-symbol" className="text-xs text-muted-foreground mb-1.5 block">
                      Symbol * (max 8)
                    </Label>
                    <Input
                      id="token-symbol"
                      placeholder="MOON"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      className="h-9 text-sm bg-background/50 font-mono"
                      maxLength={8}
                      disabled={isPending || isConfirming}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Description
                  </Label>
                  <Textarea
                    placeholder="What's this token about? Tell the community..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                    className="min-h-[80px] text-sm bg-background/50 resize-none"
                    disabled={isPending || isConfirming}
                  />
                  <p className="text-xs text-muted-foreground text-right mt-1">{description.length}/500</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" /> Token Image URL
                  </Label>
                  <Input
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="h-9 text-sm bg-background/50"
                    disabled={isPending || isConfirming}
                  />
                  {imageUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <TokenAvatar name={name || "?"} symbol={symbol || "?"} imageUrl={imageUrl} size="md" />
                      <span className="text-xs text-muted-foreground">Preview</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-card/60 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Social Links</h2>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Twitter className="w-3 h-3" /> Twitter / X
                  </Label>
                  <Input
                    placeholder="https://twitter.com/..."
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    className="h-9 text-sm bg-background/50"
                    disabled={isPending || isConfirming}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Send className="w-3 h-3" /> Telegram
                  </Label>
                  <Input
                    placeholder="https://t.me/..."
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    className="h-9 text-sm bg-background/50"
                    disabled={isPending || isConfirming}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3 h-3" /> Website
                  </Label>
                  <Input
                    placeholder="https://..."
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="h-9 text-sm bg-background/50"
                    disabled={isPending || isConfirming}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-card/60 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Seed Buy (optional)</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Buy tokens at launch price to seed the curve. +1% fee on top.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="0.0"
                  value={seedEth}
                  onChange={(e) => setSeedEth(e.target.value)}
                  className="h-9 text-sm bg-background/50 font-mono"
                  type="number"
                  min="0"
                  step="0.001"
                  disabled={isPending || isConfirming}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">ETH to seed</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {name && symbol && (
              <div className="rounded-lg border border-border/40 bg-card/60 p-4">
                <h2 className="text-sm font-semibold text-foreground mb-3">Preview</h2>
                <div className="flex items-center gap-3">
                  <TokenAvatar name={name} symbol={symbol} imageUrl={imageUrl} size="lg" />
                  <div>
                    <p className="font-bold text-foreground">{name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{symbol}</p>
                    {description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border/40 bg-card/60 p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Price Curve Preview</h2>
              <BondingCurveChart currentSupply={demoSupply} height={200} />
              <p className="text-xs text-muted-foreground text-center mt-2">
                Price rises as more tokens are bought.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card/80 p-4 space-y-3">
              {isSuccess && deployedTokenAddress ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Token Launched!</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {deployedTokenAddress}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-primary text-primary-foreground"
                      onClick={() => setLocation(`/token/${deployedTokenAddress}`)}
                    >
                      Trade Now <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                      <a href={`https://basescan.org/address/${deployedTokenAddress}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {!isFactoryDeployed && (
                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20">
                      <AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-destructive">Factory not deployed.</p>
                    </div>
                  )}
                  {txHash && isConfirming && (
                    <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/10 border border-primary/20">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      <p className="text-xs text-primary">Confirming on Base...</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: "Curve", value: "Linear" },
                      { label: "Base Price", value: `${Number(BASE_PRICE) / 1e18} ETH` },
                      { label: "Fee", value: "1% / trade" },
                      { label: "Rug Risk", value: "Zero" },
                    ].map((r) => (
                      <div key={r.label} className="rounded-md bg-background/40 px-2 py-1.5">
                        <p className="text-muted-foreground text-xs">{r.label}</p>
                        <p className="font-semibold text-foreground">{r.value}</p>
                      </div>
                    ))}
                  </div>

                  {isConnected ? (
                    <Button
                      className="w-full h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                      onClick={handleDeploy}
                      disabled={!name || !symbol || isPending || isConfirming || !isFactoryDeployed}
                    >
                      {isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Waiting for wallet...</>
                      ) : isConfirming ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deploying...</>
                      ) : (
                        <><Zap className="w-4 h-4 mr-2" />Deploy Token{seedEth ? ` + ${seedEth} ETH seed` : ""}</>
                      )}
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="w-full h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                          Connect Wallet to Deploy <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-52">
                        {connectors.map((c) => (
                          <DropdownMenuItem key={c.uid} onClick={() => connect({ connector: c })}>
                            {c.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Deploys to Base mainnet. Requires ETH for gas.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
