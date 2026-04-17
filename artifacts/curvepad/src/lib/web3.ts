import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

export const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "CurvePad" }),
    walletConnect({
      projectId: "2d0b9b35da4a10a8c6d6cd2b55a63a3b",
    }),
  ],
  transports: {
    [base.id]: http("https://mainnet.base.org"),
  },
});

// TokenFactory deployed & verified on Base mainnet — block 44809260
// https://basescan.org/address/0x479596943e70316A0d893De1876EBeA1Ea8E4D5B
export const FACTORY_ADDRESS = "0x479596943e70316A0d893De1876EBeA1Ea8E4D5B" as `0x${string}`;

// Must match TokenFactory.sol constants exactly.
// BASE_PRICE is wei per full token at supply=0.
// SLOPE is wei-per-full-token increase per full token of supply.
export const BASE_PRICE = BigInt("1000000000000"); // 1e12 — 0.000001 ETH / token
export const SLOPE = BigInt("1000000");            // 1e6  — price rises 1e6 wei per token

const WAD = BigInt(1e18);

export const FACTORY_ABI = [
  {
    type: "event",
    name: "TokenCreated",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "createToken",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
    ],
    outputs: [{ name: "token", type: "address" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getTokens",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTokenCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const BONDING_CURVE_ABI = [
  {
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
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creator",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMarketCap",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creatorFeesEarned",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "buy",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "sell",
    inputs: [{ name: "tokenAmount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getBuyPrice",
    inputs: [{ name: "ethAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSellReturn",
    inputs: [{ name: "tokenAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatEth(wei: bigint, decimals = 6): string {
  const eth = Number(wei) / 1e18;
  if (eth === 0) return "0";
  if (eth < 0.000001) return "<0.000001";
  return eth.toFixed(decimals).replace(/\.?0+$/, "");
}

export function formatTokens(amount: bigint, decimals = 2): string {
  const tokens = Number(amount) / 1e18;
  if (tokens >= 1_000_000) return (tokens / 1_000_000).toFixed(2) + "M";
  if (tokens >= 1_000) return (tokens / 1_000).toFixed(2) + "K";
  return tokens.toFixed(decimals);
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ─── On-chain math (mirrors TokenFactory.sol exactly) ────────────────────────

/**
 * Tokens received (WAD) for ethIn wei sent to buy().
 *
 * Formula (mirrors contract _tokensForEth):
 *   B = BASE_PRICE + SLOPE * (supply / WAD)            [wei per full token]
 *   discriminant = B² + 2·SLOPE·ethForReserve           [full 256-bit, no WAD division]
 *   x = (√discriminant − B) / SLOPE                     [full tokens]
 *   result = x * WAD                                     [WAD units]
 *
 * ethIn is the TOTAL msg.value (reserve + 1% fee); fee is stripped here.
 */
export function calcBuyTokens(ethIn: bigint, currentSupply: bigint): bigint {
  const ethForReserve = (ethIn * BigInt(99)) / BigInt(100); // strip 1% fee
  const s = currentSupply / WAD;                            // full token count
  const B = BASE_PRICE + SLOPE * s;                         // spot price
  const discriminant = B * B + BigInt(2) * SLOPE * ethForReserve;
  const sqrtD = bigIntSqrt(discriminant);
  if (sqrtD <= B) return BigInt(0);
  const xTokens = (sqrtD - B) / SLOPE;                     // full tokens
  return xTokens * WAD;                                     // WAD
}

/**
 * Net ETH received (wei) for selling tokenAmount WAD tokens.
 *
 * Formula (mirrors contract _ethForTokens + _reserveAt):
 *   s = supply / WAD, x = tokenAmount / WAD  (full tokens)
 *   reserve(s) = BASE_PRICE * s + SLOPE * s² / 2   [wei]
 *   gross = reserve(s) − reserve(s − x)             [wei]
 *   net = gross * 99 / 100                           [after 1% fee]
 */
export function calcSellReturn(tokenAmount: bigint, currentSupply: bigint): bigint {
  if (tokenAmount > currentSupply) return BigInt(0);
  const s = currentSupply / WAD;
  const x = tokenAmount / WAD;
  const supplyAfter = s - x;

  const reserveBefore = BASE_PRICE * s + (SLOPE * s * s) / BigInt(2);
  const reserveAfter = BASE_PRICE * supplyAfter + (SLOPE * supplyAfter * supplyAfter) / BigInt(2);
  if (reserveAfter > reserveBefore) return BigInt(0);

  const gross = reserveBefore - reserveAfter;
  return (gross * BigInt(99)) / BigInt(100);
}

function bigIntSqrt(n: bigint): bigint {
  if (n <= BigInt(0)) return BigInt(0);
  let x = n;
  let y = (x + BigInt(1)) / BigInt(2);
  while (y < x) {
    x = y;
    y = (x + n / x) / BigInt(2);
  }
  return x;
}

// ─── Curve plotting ───────────────────────────────────────────────────────────

export function calcCurvePoints(
  currentSupply: bigint,
  points = 100
): { supply: number; price: number }[] {
  const supplyNum = Number(currentSupply) / 1e18;
  const maxSupply = Math.max(supplyNum * 2, 1_000_000);
  const result = [];
  for (let i = 0; i <= points; i++) {
    const s = (maxSupply * i) / points;
    const price = (Number(BASE_PRICE) + Number(SLOPE) * s) / 1e18;
    result.push({ supply: s, price });
  }
  return result;
}
