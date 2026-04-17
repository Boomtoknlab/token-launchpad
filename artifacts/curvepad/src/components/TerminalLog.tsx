import { useState, useEffect, useRef } from "react";
import { usePublicClient } from "wagmi";
import { base } from "wagmi/chains";
import { formatEth, formatTokens, shortenAddress, BONDING_CURVE_ABI } from "@/lib/web3";
import { Terminal } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: Date;
  kind: "buy" | "sell" | "info" | "error";
  trader?: string;
  tokenAmount?: bigint;
  ethAmount?: bigint;
  symbol?: string;
  txHash?: string;
  message?: string;
}

interface TerminalLogProps {
  tokenAddress: `0x${string}`;
  symbol?: string;
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtRelative(d: Date, now: Date) {
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return fmtTime(d);
}

export function TerminalLog({ tokenAddress, symbol }: TerminalLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cursor, setCursor] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const publicClient = usePublicClient({ chainId: base.id });
  const now = useNow();

  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (!publicClient || !tokenAddress) return;

    setLogs([
      {
        id: "init",
        timestamp: new Date(),
        kind: "info",
        message: `Watching ${tokenAddress}`,
      },
    ]);

    const unwatch = publicClient.watchContractEvent({
      address: tokenAddress,
      abi: BONDING_CURVE_ABI,
      eventName: "Trade",
      onLogs: (incoming) => {
        const entries: LogEntry[] = incoming.map((log) => {
          const args = log.args as {
            trader: `0x${string}`;
            isBuy: boolean;
            tokenAmount: bigint;
            ethAmount: bigint;
          };
          return {
            id: log.transactionHash ?? `${Date.now()}`,
            timestamp: new Date(),
            kind: args.isBuy ? "buy" : "sell",
            trader: args.trader,
            tokenAmount: args.tokenAmount,
            ethAmount: args.ethAmount,
            symbol,
            txHash: log.transactionHash ?? undefined,
          };
        });
        setLogs((prev) => [...prev.slice(-199), ...entries]);
      },
    });

    return () => {
      unwatch();
    };
  }, [publicClient, tokenAddress, symbol]);

  function lineColor(kind: LogEntry["kind"]) {
    if (kind === "buy") return "text-[#00ff88]";
    if (kind === "sell") return "text-red-400";
    if (kind === "error") return "text-yellow-400";
    return "text-muted-foreground";
  }

  function linePrefix(kind: LogEntry["kind"]) {
    if (kind === "buy") return "BUY ";
    if (kind === "sell") return "SELL";
    return "INFO";
  }

  function renderLine(entry: LogEntry) {
    const time = fmtRelative(entry.timestamp, now);
    const prefix = linePrefix(entry.kind);

    if (entry.kind === "buy" || entry.kind === "sell") {
      const dir = entry.kind === "buy" ? "+" : "-";
      const tokens = entry.tokenAmount ? formatTokens(entry.tokenAmount) : "?";
      const eth = entry.ethAmount ? formatEth(entry.ethAmount, 6) : "?";
      const trader = entry.trader ? shortenAddress(entry.trader) : "?";
      return (
        <div key={entry.id} className="flex gap-2 leading-5">
          <span className="text-muted-foreground/40 select-none shrink-0 w-[52px] text-right">{time}</span>
          <span className={`font-bold shrink-0 ${lineColor(entry.kind)}`}>[{prefix}]</span>
          <span className={lineColor(entry.kind)}>
            {trader}{" "}
            <span className="opacity-60">{entry.kind === "buy" ? "bought" : "sold"}</span>{" "}
            <span className="font-bold">{dir}{tokens} {entry.symbol || "tokens"}</span>{" "}
            <span className="opacity-60">for</span>{" "}
            <span className="font-bold">{eth} ETH</span>
          </span>
        </div>
      );
    }

    return (
      <div key={entry.id} className="flex gap-2 leading-5">
        <span className="text-muted-foreground/40 select-none shrink-0 w-[52px] text-right">{time}</span>
        <span className={`font-bold shrink-0 ${lineColor(entry.kind)}`}>[{prefix}]</span>
        <span className={`${lineColor(entry.kind)} opacity-70`}>{entry.message}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/40 bg-card/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-black/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <Terminal className="w-3.5 h-3.5 text-muted-foreground ml-1" />
        <span className="text-xs font-mono text-muted-foreground">curvepad — live trades</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground font-mono">live</span>
        </div>
      </div>

      <div className="h-52 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-black/60">
        {logs.length === 0 ? (
          <div className="text-muted-foreground/50 leading-5">Waiting for trades...</div>
        ) : (
          logs.map(renderLine)
        )}
        <div ref={bottomRef} />
        <div className="flex gap-2 leading-5 mt-1">
          <span className="text-muted-foreground/40 select-none shrink-0 w-[52px]" />
          <span className="text-primary/80">
            {">"}{" "}
            <span className={cursor ? "opacity-100" : "opacity-0"}>█</span>
          </span>
        </div>
      </div>
    </div>
  );
}
