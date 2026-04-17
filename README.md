# CurvePad

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://docs.soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-orange.svg)](https://getfoundry.sh/)
[![Base](https://img.shields.io/badge/Network-Base%20Mainnet-0052FF.svg)](https://base.org/)
[![Tests](https://img.shields.io/badge/Tests-10%2F10%20passing-brightgreen.svg)](#testing)
[![GitHub](https://img.shields.io/badge/GitHub-agunnaya001-black.svg?logo=github)](https://github.com/agunnaya001)
[![Contract](https://img.shields.io/badge/TokenFactory-0x4795...4D5B-0052FF.svg?logo=ethereum)](https://basescan.org/address/0x479596943e70316A0d893De1876EBeA1Ea8E4D5B)

> **Permissionless bonding curve token launchpad on Base mainnet.**  
> No admin keys. No rugs. Pure on-chain math.

---

## What is CurvePad?

CurvePad lets anyone deploy an ERC-20 token whose price is governed by a **linear bonding curve** stored entirely on Base. Every buy mints new tokens against the curve; every sell burns them and returns ETH. The reserve is always fully collateralized — no fractional reserve, no liquidity pools needed.

| Feature | Detail |
|---|---|
| Chain | Base Mainnet (chain ID 8453) |
| Curve | Linear: `price = BASE_PRICE + SLOPE × supply` |
| Fee | 1% of every trade → token creator |
| Permissions | None — fully permissionless |
| Admin keys | None |

---

## How the Math Works

### Bonding Curve

```
price(s) = BASE_PRICE + SLOPE × s
```

Where:
- `s` = total token supply in full tokens (e.g. 1000 tokens)
- `BASE_PRICE` = 1 × 10⁻⁶ ETH per token (at supply = 0)
- `SLOPE` = price increases by 1 × 10⁻¹² ETH per token, per token of supply

### Reserve Invariant

The contract ETH balance always equals the integral of the price curve:

```
reserve(s) = BASE_PRICE × s + SLOPE × s² / 2
```

This is the fundamental invariant — enforced by the buy and sell math, not by admin controls.

### Buy Formula (Quadratic)

Given ETH sent (`ethForReserve`, after 1% fee), the tokens minted (`x`) solve:

```
SLOPE/2 · x²  +  B · x  −  ethForReserve = 0

x = (√(B² + 2·SLOPE·ethForReserve) − B) / SLOPE
```

Where `B = BASE_PRICE + SLOPE × currentSupply` (spot price).

The discriminant is computed at full 256-bit precision — **no premature WAD division** — which avoids catastrophic cancellation for small trades.

### Sell Formula

Selling `x` tokens returns:

```
gross = reserve(s) − reserve(s − x)
net   = gross × 99 / 100   (1% fee)
```

---

## Architecture

```
curvepad/
├── contracts/foundry/
│   ├── src/
│   │   └── TokenFactory.sol      # Factory + BondingCurveToken
│   ├── test/
│   │   └── TokenFactory.t.sol    # 10 Foundry tests (all passing)
│   └── script/
│       └── DeployTokenFactory.s.sol
│
└── artifacts/curvepad/           # React + Vite frontend
    └── src/
        ├── pages/
        │   ├── ExplorePage.tsx   # Browse all launched tokens
        │   ├── CreatePage.tsx    # Launch a new token
        │   └── TradePage.tsx     # Buy / sell + live terminal
        ├── components/
        │   ├── BondingCurveChart.tsx  # Canvas-rendered price curve
        │   ├── ActivityFeed.tsx       # On-chain Trade event feed
        │   └── TerminalLog.tsx        # Live terminal (green-on-black)
        └── lib/
            └── web3.ts           # wagmi config, ABIs, curve math
```

### Smart Contracts

#### `TokenFactory`
- Deploys `BondingCurveToken` instances
- Maintains an on-chain registry (`getTokens()`, `getTokenCount()`)
- Emits `TokenCreated(token, creator, name, symbol)`
- Optional seed buy on creation (`msg.value > 0`)

#### `BondingCurveToken`
- Standard ERC-20 with `buy()` / `sell()` entrypoints
- ReentrancyGuard (Checks-Effects-Interactions pattern)
- `creator` address set at deploy — receives 1% of every trade
- `creatorFeesEarned` tracks cumulative fees on-chain
- View functions: `getCurrentPrice()`, `getMarketCap()`, `getBuyPrice()`, `getSellReturn()`

---

## Frontend

Built with **React + Vite + wagmi v2 / viem**. Dark terminal aesthetic — neon green on near-black.

### Pages

| Page | Path | Description |
|---|---|---|
| Explore | `/` | Grid of all deployed tokens with live price + volume |
| Create | `/create` | One-form token launcher with optional seed buy |
| Trade | `/trade/:address` | Bonding curve chart, buy/sell panel, live terminal |

### Live Terminal

The Trade page includes a **macOS-style terminal panel** that streams on-chain `Trade` events in real time via `watchContractEvent`. Each line shows:

```
just now  [BUY ] 0x1234...5678 bought +1,337.42 MEME for 0.001337 ETH
12s ago   [SELL] 0xabcd...ef01 sold -500.00 MEME for 0.000498 ETH
```

Green for buys, red for sells, blinking block cursor. No page refresh needed.

---

## Development

### Prerequisites

- [Foundry](https://getfoundry.sh/) (`curl -L https://foundry.paradigm.xyz | bash`)
- Node.js ≥ 18 + pnpm

### Install

```bash
# Install frontend dependencies
pnpm install

# Install Foundry libs
cd contracts/foundry
forge install OpenZeppelin/openzeppelin-contracts --no-git
forge install foundry-rs/forge-std --no-git
```

### Compile Contracts

```bash
cd contracts/foundry
forge build
```

### Run Tests

```bash
cd contracts/foundry
forge test -vv
```

Expected output:

```
Ran 10 tests for test/TokenFactory.t.sol:TokenFactoryTest
[PASS] test_buyReturnsNonTrivialTokens()
[PASS] test_createToken()
[PASS] test_creatorReceivesFees()
[PASS] test_factoryMultipleTokens()
[PASS] test_multiplebuyers_pricesAscending()
[PASS] test_priceIncreasesWithBuys()
[PASS] test_reserveIntegrity()
[PASS] test_revertsBuyWithZeroEth()
[PASS] test_revertsSellMoreThanBalance()
[PASS] test_sellRoundTrip()

Suite result: ok. 10 passed; 0 failed
```

### Run Frontend

```bash
pnpm --filter @workspace/curvepad run dev
```

---

## Deployed Contracts

| Contract | Address | Network |
|---|---|---|
| TokenFactory | [`0x479596943e70316A0d893De1876EBeA1Ea8E4D5B`](https://basescan.org/address/0x479596943e70316A0d893De1876EBeA1Ea8E4D5B) | Base Mainnet |

Deployed at block **44809260** · tx [`0x988c...372`](https://basescan.org/tx/0x988c392651a5480176db68df6002fe55a949863d614948550bcc3df0aea13372) · ✅ verified on BaseScan

---

## Deployment

### Deploy to Base Mainnet

```bash
cd contracts/foundry
forge script script/DeployTokenFactory.s.sol \
  --rpc-url https://mainnet.base.org \
  --private-key $WALLET_PRIVATE_KEY \
  --broadcast \
  -vv
```

### Update Frontend

After deploying, copy the factory address into:

```ts
// artifacts/curvepad/src/lib/web3.ts
export const FACTORY_ADDRESS = "0xYOUR_FACTORY_ADDRESS" as `0x${string}`;
```

### Verify on BaseScan

```bash
forge verify-contract \
  <FACTORY_ADDRESS> \
  src/TokenFactory.sol:TokenFactory \
  --chain base \
  --etherscan-api-key $BASESCAN_API_KEY \
  --watch
```

---

## Security Notes

- **CEI pattern** — all state mutations happen before external calls
- **ReentrancyGuard** — on `buy()` and `sell()`
- **No admin** — no `owner`, no `pause`, no upgrades; the contract is immutable once deployed
- **Reserve math** — quadratic formula is computed at full 256-bit precision; no overflow possible at realistic supply levels (verified up to 10⁹ tokens)
- **Precision** — sub-token fractional supply is truncated in `_reserveAt`; the resulting dust (≤ `2 × BASE_PRICE` = 2 × 10⁻⁶ ETH) is negligible

---

## License

MIT — see [LICENSE](LICENSE).

---

*Built by [@agunnaya001](https://github.com/agunnaya001) on [Base](https://base.org/)*
