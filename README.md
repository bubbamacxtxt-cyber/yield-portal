# Yield Portal

Multi-protocol yield analytics dashboard powered by the [Portals API](https://build.portals.fi/docs).

## What This Is

A DeFi yield dashboard that tracks APY, TVL, and rate changes across **290+ protocols** and **9 chains** — all from a single API. Built on Portals.fi's free tier with our own historical tracking layer.

**Live:** https://bubbamacxtxt-cyber.github.io/yield-portal/

## The Killer Features

### 1. Same Asset, Best Rate
Pick any token (USDC, ETH, WBTC) → instantly see its yield across every protocol and chain, ranked by APY.

### 2. Yield Momentum Tracker
Not just current APY — shows which yields are *accelerating*. "USDC on Compound went from 2.1% → 3.4% this week (+62%)." Built by snapshotting Portals data every 4 hours and computing deltas.

### 3. Risk-Adjusted Yield Score
Combine APY with TVL into a single safety score. `APY × log(TVL)`. One number tells you if a yield is worth the risk.

### 4. Stablecoin Yield Leaderboard
Dedicated view — only stablecoins (USDC, USDT, DAI, FRAX, GHO, crvUSD, etc.), sorted by APY, with TVL as a trust signal. This is what most yield farmers actually want.

### 5. Protocol Comparison Matrix
Side-by-side view: Aave vs Fluid vs Compound vs Morpho — same asset, same chain, compare rates, TVL, utilization.

### 6. Daily Snapshot History
Portals free tier doesn't give historical data. We build our own by snapshotting every 4 hours. After 7 days you see weekly trends. After 30 days you see monthly. This compounds in value over time.

### 7. TVL Flow Indicator
Track net inflows/outflows per protocol. "Compound USDC gained $12M this week" → signals growing confidence. Computed from snapshot deltas.

### 8. New Opportunity Alerts
Flag newly listed tokens, new protocols crossing $1M TVL, or rates that spike above historical average. Push to Telegram.

### 9. Multi-Chain Yield Map
Visual overview showing where yields are highest across chains. "Best stablecoin yields right now: Arbitrum 4.2%, Base 3.8%, Ethereum 2.1%."

### 10. Savings Calculator
"Deposit $10,000 in USDC → earn $X per month at current rates." Simple, powerful. Shows projected earnings across top 5 opportunities.

---

## Data Sources

### Primary: Portals API (Free Tier)
- **Endpoint:** `GET /v2/tokens`
- **Coverage:** 290+ protocols, 9 chains
- **Data:** Real-time APY, price, TVL, volume, reserves
- **Limits:** Max 250 items/page, pagination supported
- **Auth:** API key required (free tier available at [build.portals.fi](https://build.portals.fi/dashboard))

### Secondary: Direct Protocol APIs
- **Aave v3:** GraphQL API at `api.v3.aave.com` (market-level detail)
- **Fluid:** REST API at `api.fluid.instadapp.io/v2/lending` (token-level detail)
- **DeFiLlama:** Yields API at `yields.llama.fi` (fallback/verification)

### What We DON'T Get (Paid Tier)
- Historical OHLC data (we snapshot ourselves)
- 24h transaction history
- Holder distribution
- Aggregated 48h metrics

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Data Pipeline                   │
│                                                  │
│  Portals API ──→ fetch-portals.js ──→ SQLite DB  │
│  Aave API     ──→ fetch-aave.js    ──→ SQLite DB │
│  Fluid API    ──→ fetch-fluid.js   ──→ SQLite DB │
│                                                  │
│  Every 4 hours via GitHub Actions                │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│                  Analytics Engine                 │
│                                                  │
│  compute-deltas.js    → 1d/7d/30d rate changes   │
│  compute-momentum.js  → yield acceleration       │
│  compute-risk.js      → risk-adjusted scores     │
│  compute-flow.js      → TVL inflows/outflows     │
│  categorize.js        → asset type tagging       │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│                   Output Layer                    │
│                                                  │
│  export-data.js  → data.json (static)            │
│  index.html      → GitHub Pages dashboard        │
│  alerts.js       → Telegram notifications        │
└─────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Protocol registry
protocols (id, name, slug, chain, category, tvl, is_verified)

-- Token listings with current rates
tokens (
  id, protocol_id, symbol, address, chain,
  apy, apy_base, apy_reward,
  tvl_usd, price_usd,
  total_supply, total_borrow,
  asset_type,  -- stablecoin, eth, btc, other
  updated_at
)

-- Historical snapshots (every 4 hours)
snapshots (
  id, token_id, timestamp,
  apy, tvl_usd, price_usd,
  total_supply, total_borrow
)

-- Computed deltas
deltas (
  token_id, period,  -- 1d, 7d, 30d
  apy_change, apy_change_pct,
  tvl_change, tvl_change_pct,
  momentum_score,
  computed_at
)

-- Alerts
alerts (
  id, token_id, alert_type,  -- spike, drop, new_listing, tvl_threshold
  message, severity, triggered_at, acknowledged
)
```

---

## File Structure

```
yield-portal/
├── README.md                 ← This file
├── schema.sql                ← Database schema
├── fetch-portals.js          ← Portals API fetcher
├── fetch-aave.js             ← Aave direct API fetcher
├── fetch-fluid.js            ← Fluid direct API fetcher
├── compute-deltas.js         ← Rate change calculations
├── compute-momentum.js       ← Yield momentum scoring
├── compute-risk.js           ← Risk-adjusted yield scores
├── compute-flow.js           ← TVL flow tracking
├── categorize.js             ← Asset type classification
├── export-data.js            ← Generate static data.json
├── alerts.js                 ← Alert engine + Telegram
├── index.html                ← Main dashboard (GitHub Pages)
├── leaderboard.html          ← Stablecoin leaderboard
├── compare.html              ← Protocol comparison tool
├── calculator.html           ← Savings calculator
├── data.json                 ← Static data for frontend
├── package.json
├── .github/
│   └── workflows/
│       └── update-data.yml   ← 4-hour fetch + deploy
└── .env                      ← PORTALS_API_KEY (not committed)
```

---

## Development Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up SQLite database with schema
- [ ] Build `fetch-portals.js` — pull all tokens from Portals API
- [ ] Build `fetch-aave.js` — deep Aave data (reuse from aave-yield-dashboard)
- [ ] Build `fetch-fluid.js` — deep Fluid data (reuse from aave-yield-dashboard)
- [ ] Basic `index.html` dashboard showing current rates
- [ ] GitHub Actions for 4-hour data refresh

### Phase 2: Analytics (Week 2)
- [ ] `compute-deltas.js` — 1d/7d/30d rate changes from snapshots
- [ ] `compute-momentum.js` — yield acceleration scoring
- [ ] `compute-risk.js` — risk-adjusted yield scores (APY × log(TVL))
- [ ] `categorize.js` — asset type classification (stablecoin, ETH, BTC)
- [ ] Stablecoin leaderboard page
- [ ] Multi-chain yield overview

### Phase 3: Intelligence (Week 3)
- [ ] `compute-flow.js` — TVL inflow/outflow tracking
- [ ] Protocol comparison matrix
- [ ] Savings calculator
- [ ] Alert engine — spikes, drops, new listings
- [ ] Telegram integration for alerts

### Phase 4: Polish (Week 4)
- [ ] Mobile-responsive design
- [ ] Search and filter improvements
- [ ] Data validation and error handling
- [ ] Rate limit management
- [ ] Documentation

---

## API Rate Limits

### Portals Free Tier
- No documented rate limits
- Conservative approach: 1 request per 2 seconds
- Full token list = ~50 pages at 250/page = ~2 minutes per fetch
- 4-hour cycle = 6 fetches/day = well within limits

### Aave GraphQL
- Free, no key needed
- Rate limit: ~100 requests/minute
- 16 chains × 4 markets = ~64 queries per fetch

### Fluid API
- Free, no key needed
- 6 chains × 1 endpoint = 6 requests per fetch

---

## What Makes This Different

| Feature | Portals Explorer | DeFiLlama | Yield Portal |
|---|---|---|---|
| Protocol coverage | 290+ | 300+ | 290+ (Portals) + deep Aave/Fluid |
| Historical data | Paid only | Free (limited) | Free (self-snapshotted) |
| Rate change tracking | ❌ | Basic | Full momentum scoring |
| Risk-adjusted scoring | ❌ | ❌ | ✅ |
| Stablecoin leaderboard | ❌ | Basic | ✅ Dedicated |
| TVL flow tracking | ❌ | ❌ | ✅ |
| Telegram alerts | ❌ | ❌ | ✅ |
| Self-hosted | ❌ | ✅ | ✅ |
| Cost | Paid API | Free | Free |

---

## Environment Variables

```bash
PORTALS_API_KEY=your_key_here  # Get from build.portals.fi/dashboard
```

## Commands

```bash
npm run fetch              # Fetch all data sources
npm run fetch:portals      # Portals API only
npm run fetch:aave         # Aave only
npm run fetch:fluid        # Fluid only
npm run compute            # Run all analytics
npm run export             # Generate data.json
npm run alerts             # Check and send alerts
```

---

## Team

- **Saus** — CEO, project lead
- **Bub2** — Builder, data pipelines & dashboards
- **Chief** — CTO, infrastructure

---

*Built with data, not vibes.*
