# Stablecoin Intelligence Layer — Future Expansion

> Stored: 2026-03-22. Build when ready.

## What Pharos.watch Does (Our Target)

Pharos tracks 161 stablecoins across 19 peg currencies with:
- **Peg deviation monitoring** — 14+ price sources, consensus algorithm, depeg detection
- **Blacklist/freeze tracking** — USDC/USDT on-chain events (Etherscan, TronGrid)
- **Mint/burn flow tracking** — on-chain event logs, hourly aggregates
- **DEX liquidity scoring** — pool TVL, volume, quality, durability (0-100)
- **Safety scores** — independent SMIDGE framework ratings
- **Stability Index (PSI)** — market-wide 0-100 health score
- **Dependency map** — collateral relationships between stablecoins
- **Cemetery** — 82 dead stablecoins with cause of death
- **Daily digest** — AI-generated market summaries
- **Risk-adjusted yield** — yield leaderboard with safety filters
- **Non-USD pegs** — EUR, GBP, gold, silver, commodity-backed

**GitHub:** https://github.com/TokenBrice/stablecoin-dashboard
**Stack:** Next.js 16 + Cloudflare Worker + D1 + Pages

## Our Current Capabilities

- ✅ 1,483 stablecoins tracked (via Portals API)
- ✅ 900 with active yields
- ✅ Basic APY, TVL, chain breakdown
- ✅ Asset type categorization (stablecoin, ETH, BTC)
- ✅ Risk-adjusted scoring (APY × log(TVL))

## Gap Analysis

| Feature | Pharos | Us | Difficulty |
|---|---|---|---|
| Stablecoin supply & market cap | ✅ | ✅ | Done |
| Peg deviation monitoring | ✅ 14 sources | ❌ | Medium |
| Blacklist/freeze tracking | ✅ | ❌ | Easy |
| Mint/burn flow tracking | ✅ | ❌ | Medium |
| DEX liquidity scoring | ✅ | ❌ | Medium |
| Safety scores | ✅ | ❌ | Hard (reference only) |
| Stability Index | ✅ | ❌ | Medium |
| Dependency map | ✅ | ❌ | Hard |
| Cemetery | ✅ | ❌ | Easy (manual) |
| Daily digest (AI) | ✅ | ❌ | Easy |
| Risk-adjusted yield | ✅ | 🔶 | Enhance |
| Chain breakdown | ✅ | 🔶 | Enhance |
| Non-USD pegs | ✅ | ❌ | Easy (FX API) |

## Free Data Sources

| Source | Purpose | Cost |
|---|---|---|
| DeFiLlama | Supply, price, chain dist | Free |
| CoinGecko | Fallback prices | Free tier |
| Pyth Network | Oracle prices | Free |
| Binance | CEX spot prices | Free |
| Coinbase | CEX spot prices | Free |
| RedStone | Oracle backup | Free |
| Curve Finance | DEX implied prices | Free |
| The Graph | Uniswap V3 subgraphs | Free tier |
| DexScreener | DEX fallback | Free |
| Etherscan | Blacklist events | Free tier |
| Frankfurter.app | ECB FX rates | Free |
| gold-api.com | Gold/silver prices | Free |
| FRED | US Treasury rates | Free |

## Build Phases

### Phase 1 — Peg Monitoring (highest value)
- Price consensus: pull from CoinGecko, DeFiLlama, Binance, Coinbase, Pyth
- Compare against peg reference ($1 for USD, etc.)
- Flag depeg events (>50 bps deviation)
- Store historical peg scores
- **Effort:** 2-3 days

### Phase 2 — Blacklist Tracking
- Query Etherscan for USDC/USDT freeze events
- Track on Ethereum, Arbitrum, Base, Polygon
- Hourly sync via GitHub Actions
- **Effort:** 1 day

### Phase 3 — Mint/Burn Flows
- Track on-chain mint/burn events
- Compute net flow per stablecoin per day
- Visualize supply changes
- **Effort:** 2-3 days

### Phase 4 — Stability Index
- Compute PSI-style score: 100 - severity - breadth
- Aggregate active depegs, market impact, trend
- Daily snapshots
- **Effort:** 1-2 days

### Phase 5 — Yield Intelligence Enhancement
- Enhance existing yield data
- Risk-adjusted scoring improvements
- Yield leaderboard with better filters
- **Effort:** 1 day

### Phase 6 — Non-USD Pegs
- FX rates from Frankfurter.app (ECB)
- Gold/silver from gold-api.com
- EUR, GBP, CHF, gold, silver stablecoins
- **Effort:** 1 day

## Notes

- Pharos uses Cloudflare Worker + D1. We use GitHub Actions + SQLite. Different infra, same data.
- Their codebase is complex (76 DB migrations, circuit breakers, consensus algorithms). We should build incrementally.
- Pharos is "all rights reserved" — we can learn methodology but shouldn't copy code.
- Start with Phase 1 (peg monitoring) — it's the highest-value, most-visible feature.
