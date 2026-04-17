import { Rocket } from "lucide-react";

const GRADUATION_TARGET_ETH = 10; // ETH — when reserve hits this, token "graduates"
const GRADUATION_TARGET_WEI = BigInt(Math.floor(GRADUATION_TARGET_ETH * 1e18));

interface GraduationBarProps {
  reserveWei: bigint;
  compact?: boolean;
}

export function GraduationBar({ reserveWei, compact = false }: GraduationBarProps) {
  const pct = Math.min(
    100,
    Number((reserveWei * BigInt(10000)) / GRADUATION_TARGET_WEI) / 100
  );
  const graduated = reserveWei >= GRADUATION_TARGET_WEI;
  const ethRaised = Number(reserveWei) / 1e18;

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Graduation</span>
          <span className={graduated ? "text-primary font-bold" : "text-muted-foreground font-mono"}>
            {graduated ? "🎓 Graduated" : `${pct.toFixed(1)}%`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              graduated
                ? "bg-primary"
                : "bg-gradient-to-r from-primary/60 to-primary"
            }`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/40 bg-card/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className={`w-3.5 h-3.5 ${graduated ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-xs font-semibold text-foreground">
            {graduated ? "Graduated!" : "Bonding Curve Progress"}
          </span>
        </div>
        <span className={`text-xs font-mono font-bold ${graduated ? "text-primary" : "text-foreground"}`}>
          {pct.toFixed(2)}%
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            graduated
              ? "bg-primary shadow-[0_0_8px_2px_rgba(0,255,136,0.4)]"
              : pct > 70
              ? "bg-gradient-to-r from-yellow-500 to-primary"
              : "bg-gradient-to-r from-primary/50 to-primary"
          }`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {ethRaised.toFixed(4)} ETH raised
        </span>
        <span>
          {graduated ? "Curve complete" : `Target: ${GRADUATION_TARGET_ETH} ETH`}
        </span>
      </div>

      {!graduated && (
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          When the bonding curve raises {GRADUATION_TARGET_ETH} ETH, the token graduates.
          Remaining: {Math.max(0, GRADUATION_TARGET_ETH - ethRaised).toFixed(4)} ETH
        </p>
      )}
      {graduated && (
        <p className="text-xs text-primary/80 font-medium">
          This token has completed its bonding curve!
        </p>
      )}
    </div>
  );
}
