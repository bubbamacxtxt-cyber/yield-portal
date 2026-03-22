# Yield Portal — TODO & Planning

## 🔥 In Progress
- [ ] Dashboard polish (filters, pagination) — done, iterating
- [ ] Stablecoin categorization — done (Pharos registry, 529 tracked)

## 📋 Next Up

### Risk-Adjusted Scoring System
Current formula: `APY × log(TVL)` — basic, needs improvement.

**Requirements:**
- Combine yield with safety into a single comparable score
- Account for: TVL, protocol reputation, chain risk, asset type, utilization
- Should work across all 290+ protocols
- Must be simple enough to understand at a glance

**Considerations:**
- Protocol weighting (Aave/Compound vs unknown protocols)
- Chain risk (Ethereum vs newer/L2 chains)
- Asset volatility (stablecoins vs ETH vs volatile tokens)
- Pool utilization (how much is borrowed vs sitting idle)
- TVL thresholds (>$100M safe, $10-100M moderate, <$10M risky)

**Goal:** A single number users can sort by to find "best yield for least risk"

---

### Pharos Stablecoin Intelligence (Future)
- [ ] Peg deviation monitoring
- [ ] Blacklist/freeze tracking
- [ ] Mint/burn flow tracking
- [ ] DEX liquidity scoring
- [ ] Stability Index (PSI)
- [ ] See: docs/STABLECOIN-INTELLIGENCE.md

---

## ✅ Done
- [x] Portals API fetcher (2-tier strategy, ~35 calls/fetch)
- [x] GitHub Actions (4-hour auto-refresh)
- [x] Dashboard with tabs (All/Stablecoins/ETH/BTC/Risk-Adjusted/Chains)
- [x] Filters (Min TVL, Min APY, Chain, Search)
- [x] Pagination (50 per page)
- [x] Stablecoin categorization (Pharos registry cross-reference)
- [x] LP token filtering (both sides must be stablecoins)
- [x] Pharos research & expansion roadmap
