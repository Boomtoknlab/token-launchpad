import { useState, useEffect, useMemo } from "react";
import { usePublicClient } from "wagmi";
import { Link } from "wouter";
import { base } from "wagmi/chains";
import {
  FACTORY_ADDRESS,
  FACTORY_ABI,
  BONDING_CURVE_ABI,
  formatEth,
  formatTokens,
  shortenAddress,
} from "@/lib/web3";
import { getTokenMetadata, type TokenMeta } from "@/lib/api";
import { TokenAvatar } from "@/components/TokenAvatar";
import { GraduationBar } from "@/components/GraduationBar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  TrendingUp,
  Clock,
  Zap,
  ArrowUpRight,
  Crown,
  Rocket,
  Flame,
} from "lucide-react";

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  currentPrice: bigint;
  totalSupply: bigint;
  marketCap: bigint;
  creator: string;
  creatorFees: bigint;
  reserveEth: bigint;
  meta?: TokenMeta | null;
}

const GRADUATION_TARGET = BigInt(10) * BigInt(1e18);

function isGraduated(reserve: bigint) {
  return reserve >= GRADUATION_TARGET;
}

function progressPct(reserve: bigint): number {
  return Math.min(100, Number((reserve * BigInt(10000)) / GRADUATION_TARGET) / 100);
}

export default function ExplorePage() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "marketcap" | "trending">("newest");
  const publicClient = usePublicClient({ chainId: base.id });

  useEffect(() => {
    let cancelled = false;

    async function fetchTokens() {
      if (!publicClient) return;
      try {
        let addresses: string[] = [];
        if (FACTORY_ADDRESS !== "0x0000000000000000000000000000000000000000") {
          const result = await publicClient.readContract({
            address: FACTORY_ADDRESS,
            abi: FACTORY_ABI,
            functionName: "getTokens",
          });
          addresses = result as string[];
        }

        if (addresses.length === 0) {
          if (!cancelled) { setTokens([]); setLoading(false); }
          return;
        }

        const infos: TokenInfo[] = [];
        for (const addr of addresses) {
          try {
            const [name, symbol, currentPrice, totalSupply, marketCap, creator, creatorFees] =
              await Promise.all([
                publicClient.readContract({ address: addr as `0x${string}`, abi: BONDING_CURVE_ABI, functionName: "name" }),
                publicClient.readContract({ address: addr as `0x${string}`, abi: BONDING_CURVE_ABI, functionName: "symbol" }),
                publicClient.readContract({ address: addr as `0x${string}`, abi: BONDING_CURVE_ABI, functionName: "getCurrentPrice" }),
                publicClient.readContract({ address: addr as `0x${string}`, abi: BONDING_CURVE_ABI, functionName: "totalSupply" }),
                publicClient.readContract({ address: addr as `0x${string}`, abi: BONDING_CURVE_ABI, functionName: "getMarketCap" }),
                publicClient.readContract({ address: addr as `0x${string}`, abi: BONDING_CURVE_ABI, functionName: "creator" }),
                publicClient.readContract({ address: addr as `0x${string}`, abi: BONDING_CURVE_ABI, functionName: "creatorFeesEarned" }),
              ]);
            const reserveEth = await publicClient.getBalance({ address: addr as `0x${string}` });
            const meta = await getTokenMetadata(addr);
            infos.push({
              address: addr,
              name: name as string,
              symbol: symbol as string,
              currentPrice: currentPrice as bigint,
              totalSupply: totalSupply as bigint,
              marketCap: marketCap as bigint,
              creator: creator as string,
              creatorFees: creatorFees as bigint,
              reserveEth,
              meta,
            });
          } catch { /* skip */ }
        }

        if (!cancelled) { setTokens(infos); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTokens();
    const interval = setInterval(fetchTokens, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [publicClient]);

  const kingOfTheHill = useMemo(() => {
    if (tokens.length === 0) return null;
    return tokens.reduce((best, t) => t.marketCap > best.marketCap ? t : best, tokens[0]);
  }, [tokens]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = tokens.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        (t.meta?.description ?? "").toLowerCase().includes(q)
    );
    if (sortBy === "marketcap") return [...list].sort((a, b) => Number(b.marketCap - a.marketCap));
    if (sortBy === "trending") return [...list].sort((a, b) => Number(b.creatorFees - a.creatorFees));
    return [...list].reverse();
  }, [tokens, search, sortBy]);

  const isFactoryDeployed = FACTORY_ADDRESS !== "0x0000000000000000000000000000000000000000";

  return (
    <div className="min-h-screen grid-bg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-primary uppercase tracking-widest">Base Network</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Token Launchpad</h1>
          <p className="text-sm text-muted-foreground">
            Permissionless bonding curve tokens. Price is a function, not a negotiation.
          </p>
        </div>

        {kingOfTheHill && tokens.length > 1 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">King of the Hill</span>
            </div>
            <Link href={`/token/${kingOfTheHill.address}`}>
              <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-card/60 to-card/60 p-5 hover:border-yellow-400/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <TokenAvatar
                      name={kingOfTheHill.name}
                      symbol={kingOfTheHill.symbol}
                      imageUrl={kingOfTheHill.meta?.imageUrl}
                      size="xl"
                    />
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                      <Crown className="w-3 h-3 text-black" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-lg font-bold text-foreground group-hover:text-yellow-400 transition-colors">
                        {kingOfTheHill.name}
                      </span>
                      <Badge variant="outline" className="text-xs font-mono border-yellow-500/40 text-yellow-400">
                        {kingOfTheHill.symbol}
                      </Badge>
                      {isGraduated(kingOfTheHill.reserveEth) && (
                        <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                          <Rocket className="w-2.5 h-2.5 mr-1" /> Graduated
                        </Badge>
                      )}
                    </div>
                    {kingOfTheHill.meta?.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                        {kingOfTheHill.meta.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs">
                      <span className="font-mono text-primary font-bold">
                        {formatEth(kingOfTheHill.marketCap, 4)} ETH mcap
                      </span>
                      <span className="text-muted-foreground">
                        {formatEth(kingOfTheHill.currentPrice, 8)} ETH/token
                      </span>
                      <span className="text-muted-foreground font-mono">
                        by {shortenAddress(kingOfTheHill.creator)}
                      </span>
                    </div>
                    <div className="mt-2 max-w-xs">
                      <GraduationBar reserveWei={kingOfTheHill.reserveEth} compact />
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-yellow-400 transition-colors flex-shrink-0" />
                </div>
              </div>
            </Link>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-card/50 border-border/60 text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {[
              { id: "newest" as const, icon: Clock, label: "Newest" },
              { id: "marketcap" as const, icon: TrendingUp, label: "Top MCap" },
              { id: "trending" as const, icon: Flame, label: "Trending" },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setSortBy(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  sortBy === id
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-card/50 text-muted-foreground border border-border/40 hover:border-border"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-lg border border-border/40 bg-card/50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full bg-muted/40" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-28 bg-muted/40" />
                    <Skeleton className="h-3 w-16 bg-muted/40" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full bg-muted/40" />
                <Skeleton className="h-2 w-full bg-muted/40" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {search ? "No tokens found" : "No tokens launched yet"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {search ? "Try a different search term" : "Be the first to launch a token on CurvePad"}
            </p>
            <Link href="/create">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                <Zap className="w-3.5 h-3.5" /> Launch a Token
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((token, idx) => {
              const graduated = isGraduated(token.reserveEth);
              const pct = progressPct(token.reserveEth);
              const isKing = kingOfTheHill?.address === token.address && tokens.length > 1;
              return (
                <Link key={token.address} href={`/token/${token.address}`}>
                  <div
                    className={`group rounded-xl border bg-card/50 hover:bg-card transition-all cursor-pointer p-4 h-full flex flex-col ${
                      isKing
                        ? "border-yellow-500/30 hover:border-yellow-400/50"
                        : graduated
                        ? "border-primary/30 hover:border-primary/50"
                        : "border-border/40 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative flex-shrink-0">
                        <TokenAvatar
                          name={token.name}
                          symbol={token.symbol}
                          imageUrl={token.meta?.imageUrl}
                          size="md"
                        />
                        {isKing && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                            <Crown className="w-2.5 h-2.5 text-black" />
                          </div>
                        )}
                        {graduated && !isKing && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Rocket className="w-2.5 h-2.5 text-black" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-sm font-bold truncate ${isKing ? "group-hover:text-yellow-400" : "group-hover:text-primary"} transition-colors`}>
                            {token.name}
                          </span>
                          <Badge variant="outline" className="text-xs font-mono border-border/50 text-muted-foreground h-4 px-1.5 flex-shrink-0">
                            {token.symbol}
                          </Badge>
                          {idx === 0 && tokens.length > 2 && sortBy === "trending" && (
                            <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30 h-4 px-1.5">
                              <Flame className="w-2.5 h-2.5 mr-0.5" /> Hot
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                          by {shortenAddress(token.creator)}
                        </p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>

                    {token.meta?.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                        {token.meta.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Price</p>
                        <p className="text-xs font-mono font-semibold text-foreground">
                          {formatEth(token.currentPrice, 8)} ETH
                        </p>
                      </div>
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Market Cap</p>
                        <p className="text-xs font-mono font-semibold text-primary">
                          {formatEth(token.marketCap, 4)} ETH
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Graduation</span>
                        <span className={`font-mono ${graduated ? "text-primary font-bold" : "text-muted-foreground"}`}>
                          {graduated ? "🎓 Done" : `${pct.toFixed(1)}%`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${graduated ? "bg-primary" : "bg-gradient-to-r from-primary/50 to-primary"}`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
