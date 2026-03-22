-- Yield Portal Database Schema

-- Protocol registry
CREATE TABLE IF NOT EXISTS protocols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    chain TEXT NOT NULL,
    category TEXT, -- lending, dex, vault, staking, other
    tvl_usd REAL DEFAULT 0,
    is_verified INTEGER DEFAULT 0,
    platform_id TEXT, -- Portals platform identifier
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Token listings with current rates
CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    protocol_id INTEGER NOT NULL REFERENCES protocols(id),
    symbol TEXT NOT NULL,
    name TEXT,
    address TEXT,
    chain TEXT NOT NULL,
    decimals INTEGER DEFAULT 18,
    apy REAL DEFAULT 0,
    apy_base REAL DEFAULT 0,
    apy_reward REAL DEFAULT 0,
    tvl_usd REAL DEFAULT 0,
    price_usd REAL DEFAULT 0,
    total_supply TEXT DEFAULT '0',
    total_borrow TEXT DEFAULT '0',
    asset_type TEXT, -- stablecoin, eth, btc, other
    is_verified INTEGER DEFAULT 0,
    portals_id TEXT, -- network:address format for Portals
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(protocol_id, symbol, chain)
);

-- Historical snapshots (every 4 hours)
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL REFERENCES tokens(id),
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    apy REAL DEFAULT 0,
    tvl_usd REAL DEFAULT 0,
    price_usd REAL DEFAULT 0,
    total_supply TEXT DEFAULT '0',
    total_borrow TEXT DEFAULT '0',
    UNIQUE(token_id, timestamp)
);

-- Computed deltas
CREATE TABLE IF NOT EXISTS deltas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL REFERENCES tokens(id),
    period TEXT NOT NULL, -- 1d, 7d, 30d
    apy_change REAL DEFAULT 0,
    apy_change_pct REAL DEFAULT 0,
    tvl_change REAL DEFAULT 0,
    tvl_change_pct REAL DEFAULT 0,
    momentum_score REAL DEFAULT 0,
    risk_score REAL DEFAULT 0,
    computed_at TEXT DEFAULT (datetime('now')),
    UNIQUE(token_id, period)
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER REFERENCES tokens(id),
    alert_type TEXT NOT NULL, -- spike, drop, new_listing, tvl_threshold
    message TEXT NOT NULL,
    severity TEXT DEFAULT 'info', -- info, warning, critical
    triggered_at TEXT DEFAULT (datetime('now')),
    acknowledged INTEGER DEFAULT 0
);

-- Sync log
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL, -- portals_update, aave_update, fluid_update, compute_deltas
    status TEXT NOT NULL, -- running, success, error
    items_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tokens_chain ON tokens(chain);
CREATE INDEX IF NOT EXISTS idx_tokens_asset_type ON tokens(asset_type);
CREATE INDEX IF NOT EXISTS idx_tokens_apy ON tokens(apy);
CREATE INDEX IF NOT EXISTS idx_tokens_tvl ON tokens(tvl_usd);
CREATE INDEX IF NOT EXISTS idx_snapshots_token ON snapshots(token_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_deltas_token ON deltas(token_id);
CREATE INDEX IF NOT EXISTS idx_deltas_period ON deltas(period);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
