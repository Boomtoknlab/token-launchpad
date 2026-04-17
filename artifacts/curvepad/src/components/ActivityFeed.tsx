import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { formatEth, formatTokens, shortenAddress, BONDING_CURVE_ABI } from "@/lib/web3";
import { ArrowUpRight, ArrowDownLeft, ExternalLink } from "lucide-react";
import { base } from "wagmi/chains";

interface TradeEvent {
  trader: string;
  isBuy: boolean;
  tokenAmount: bigint;
  ethAmount: bigint;
  newSupply: bigint;
  txHash: string;
  blockNumber: bigint;
  timestamp?: number;
}

interface ActivityFeedProps {
  tokenAddress: `0x${string}`;
}

export function ActivityFeed({ tokenAddress }: ActivityFeedProps) {
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const publicClient = usePublicClient({ chainId: base.id });

  useEffect(() => {
    let cancelled = false;
    const FACTORY_DEPLOYED_BLOCK = BigInt(0);

    async function fetchEvents() {
      if (!publicClient) return;
      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock =
          latestBlock > BigInt(100000)
            ? latestBlock - BigInt(100000)
            : FACTORY_DEPLOYED_BLOCK;

        const logs = await publicClient.getLogs({
          address: tokenAddress,
          event: {
            type: "event",
            name: "Trade",
            inputs: [
              { name: "trader", type: "address", indexed: true },
              { name: "isBuy", type: "bool", indexed: false },
              { name: "tokenAmount", type: "uint256", indexed: false },
              { name: "ethAmount", type: "uint256", indexed: false },
              { name: "newSupply", type: "uint256", indexed: false },
            ],
          },
          fromBlock,
          toBlock: "latest",
        });

        if (!cancelled) {
          const parsed: TradeEvent[] = logs
            .filter((l) => l.args.trader !== undefined)
            .map((l) => ({
              trader: l.args.trader as string,
              isBuy: l.args.isBuy as boolean,
              tokenAmount: l.args.tokenAmount as bigint,
              ethAmount: l.args.ethAmount as bigint,
              newSupply: l.args.newSupply as bigint,
              txHash: l.transactionHash || "",
              blockNumber: l.blockNumber || BigInt(0),
            }))
            .reverse();
          setEvents(parsed);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEvents();
    const interval = setInterval(fetchEvents, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tokenAddress, publicClient]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-md bg-muted/30 animate-pulse"
            data-testid={`skeleton-trade-${i}`}
          />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className="py-8 text-center text-muted-foreground text-sm"
        data-testid="text-no-trades"
      >
        No trades yet. Be the first to buy!
      </div>
    );
  }

  return (
    <div className="space-y-1.5" data-testid="activity-feed">
      {events.slice(0, 20).map((event, i) => (
        <div
          key={`${event.txHash}-${i}`}
          className="flex items-center justify-between px-3 py-2 rounded-md bg-card/50 border border-border/40 hover:border-border/80 transition-colors group"
          data-testid={`trade-event-${i}`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                event.isBuy
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {event.isBuy ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownLeft className="w-3.5 h-3.5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-semibold ${
                    event.isBuy ? "text-primary" : "text-destructive"
                  }`}
                >
                  {event.isBuy ? "BUY" : "SELL"}
                </span>
                <span className="text-xs text-foreground font-mono">
                  {formatTokens(event.tokenAmount)} tokens
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {shortenAddress(event.trader)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs font-mono font-semibold text-foreground">
                {formatEth(event.ethAmount, 5)} ETH
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                supply: {formatTokens(event.newSupply)}
              </div>
            </div>
            {event.txHash && (
              <a
                href={`https://basescan.org/tx/${event.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                data-testid={`link-tx-${i}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
