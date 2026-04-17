import { useRef, useEffect, useState } from "react";
import { calcCurvePoints, BASE_PRICE, SLOPE } from "@/lib/web3";

interface BondingCurveChartProps {
  currentSupply: bigint;
  pendingEth?: bigint;
  pendingTokens?: bigint;
  isBuy?: boolean;
  height?: number;
}

export function BondingCurveChart({
  currentSupply,
  pendingEth,
  pendingTokens,
  isBuy = true,
  height = 260,
}: BondingCurveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animFrame, setAnimFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setAnimFrame((f) => f + 1), 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 16, right: 16, bottom: 36, left: 56 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const supplyNum = Number(currentSupply) / 1e18;
    const maxSupply = Math.max(supplyNum * 2, 1_000_000);
    const points = calcCurvePoints(currentSupply, 120);

    const maxPrice = points[points.length - 1].price * 1.05;
    const minPrice = 0;

    const toX = (s: number) => pad.left + (s / maxSupply) * chartW;
    const toY = (p: number) => pad.top + chartH - ((p - minPrice) / (maxPrice - minPrice)) * chartH;

    ctx.strokeStyle = "rgba(0,255,170,0.06)";
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (chartH * i) / gridLines;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();

      const price = maxPrice - (maxPrice * i) / gridLines;
      ctx.fillStyle = "rgba(160,200,180,0.4)";
      ctx.font = "10px 'Space Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(price.toFixed(6), pad.left - 6, y + 3);
    }

    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    grad.addColorStop(0, "rgba(0,255,170,0.12)");
    grad.addColorStop(1, "rgba(0,255,170,0)");

    ctx.beginPath();
    ctx.moveTo(toX(points[0].supply), toY(points[0].price));
    for (const pt of points) {
      ctx.lineTo(toX(pt.supply), toY(pt.price));
    }
    const lastPt = points[points.length - 1];
    ctx.lineTo(toX(lastPt.supply), pad.top + chartH);
    ctx.lineTo(toX(points[0].supply), pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(toX(points[0].supply), toY(points[0].price));
    for (const pt of points) {
      ctx.lineTo(toX(pt.supply), toY(pt.price));
    }
    ctx.strokeStyle = "rgba(0,255,170,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (pendingTokens && pendingTokens > BigInt(0) && supplyNum > 0) {
      const pendingSupplyNum = Number(pendingTokens) / 1e18;
      const fromSupply = isBuy ? supplyNum : supplyNum - pendingSupplyNum;
      const toSupply = isBuy ? supplyNum + pendingSupplyNum : supplyNum;

      if (fromSupply >= 0 && toSupply <= maxSupply) {
        const highlightGrad = ctx.createLinearGradient(
          toX(fromSupply),
          0,
          toX(toSupply),
          0
        );
        if (isBuy) {
          highlightGrad.addColorStop(0, "rgba(0,120,255,0.15)");
          highlightGrad.addColorStop(1, "rgba(0,120,255,0.35)");
        } else {
          highlightGrad.addColorStop(0, "rgba(255,60,60,0.35)");
          highlightGrad.addColorStop(1, "rgba(255,60,60,0.15)");
        }

        ctx.beginPath();
        const fromPrice =
          (Number(BASE_PRICE) + Number(SLOPE) * fromSupply) / 1e18;
        const toPrice2 =
          (Number(BASE_PRICE) + Number(SLOPE) * toSupply) / 1e18;

        ctx.moveTo(toX(fromSupply), toY(fromPrice));
        ctx.lineTo(toX(toSupply), toY(toPrice2));
        ctx.lineTo(toX(toSupply), pad.top + chartH);
        ctx.lineTo(toX(fromSupply), pad.top + chartH);
        ctx.closePath();
        ctx.fillStyle = highlightGrad;
        ctx.fill();
      }
    }

    if (supplyNum > 0 && supplyNum <= maxSupply) {
      const currentPrice =
        (Number(BASE_PRICE) + Number(SLOPE) * supplyNum) / 1e18;
      const cx = toX(supplyNum);
      const cy = toY(currentPrice);

      const pulse = Math.sin(animFrame * 0.2) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 8 + pulse * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,255,170,${0.06 + pulse * 0.06})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,255,170,0.2)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#00ffaa";
      ctx.shadowColor = "#00ffaa";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "rgba(160,200,180,0.4)";
    ctx.font = "10px 'Space Mono', monospace";
    ctx.textAlign = "center";
    const xTicks = 4;
    for (let i = 0; i <= xTicks; i++) {
      const s = (maxSupply * i) / xTicks;
      const x = toX(s);
      const label = s >= 1_000_000 ? `${(s / 1_000_000).toFixed(1)}M` : `${(s / 1_000).toFixed(0)}K`;
      ctx.fillText(label, x, pad.top + chartH + 20);
    }

    ctx.fillStyle = "rgba(160,200,180,0.25)";
    ctx.font = "9px 'Space Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Supply (tokens)", pad.left + chartW / 2, h - 4);
  }, [currentSupply, pendingEth, pendingTokens, isBuy, animFrame]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height }}
      className="w-full"
      data-testid="canvas-bonding-curve"
    />
  );
}
