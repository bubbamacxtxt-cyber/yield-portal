#!/usr/bin/env node
/**
 * Portals API Fetcher
 * Pulls yield data from Portals.fi API and stores in SQLite
 * 
 * Strategy (minimizes API calls):
 *   - Tier 1: ALL tokens with >$1M TVL (broad coverage, ~30 pages)
 *   - Tier 2: Lending platforms with >$100K TVL (deep coverage, ~5 pages)
 *   Total: ~35 calls per fetch, 6x/day = ~210/day = ~6,300/month (50K budget)
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'yield-portal.db');
const API_BASE = 'https://api.portals.fi/v2/tokens';
const API_KEY = process.env.PORTALS_API_KEY;
const PAGE_SIZE = 250;

// Lending platforms we want deep coverage on
const LENDING_PLATFORMS = [
    'compound-v3', 'morpho', 'fluid', 'euler', 'venus', 'spark',
    'silo-finance', 'silo-finance-v2', 'aavev2', 'aavev3',
    'aavev3-stata-token', 'curve-llamalend', 'radiantv2', 'extra-finance-xlend'
];

// Stablecoin symbols for categorization
const STABLECOIN_SYMBOLS = new Set([
    'USDC', 'USDT', 'DAI', 'FRAX', 'USDE', 'USDS', 'GHO', 'CRVUSD',
    'SUSD', 'LUSD', 'USDG', 'AUSD', 'RLUSD', 'USDTB', 'USDG', 'TUSD',
    'BUSD', 'PYUSD', 'USDP', 'DOLA', 'EUSD', 'CUSD', 'UST', 'FDUSD',
    'USDD', 'MIM', 'CUSD', 'EURC', 'PYUSD', 'GYD', 'DGH', 'BUIDL',
    // Staked/wrapped variants
    'SUSDE', 'SUSDS', 'SFRAX', 'SDAI', 'SUSDC', 'SUSDT',
    // Syrup/LP tokens
    'SYRUPUSDC', 'SYRUPUSDT', 'SYRUPDAI',
]);

// Check if a symbol is a stablecoin (includes prefix/suffix matching)
function isStablecoin(symbol) {
    const s = symbol.toUpperCase();
    if (STABLECOIN_SYMBOLS.has(s)) return true;
    // Catch variants: AETHUSDC, CBBTCUSDC, etc.
    if (s.includes('USDC') || s.includes('USDT') || s.includes('DAI') || 
        s.includes('FRAX') || s.includes('USDE') || s.includes('USD') ||
        s.includes('EUR') || s.includes('GBP')) {
        // Exclude BTC/ETH derivatives
        if (s.includes('BTC') || s.includes('ETH') || s.includes('WSTETH') || 
            s.includes('RETH') || s.includes('STETH')) return false;
        return true;
    }
    return false;
}

// ETH-related symbols
const ETH_TOKENS = new Set([
    'ETH', 'WETH', 'STETH', 'WSTETH', 'RETH', 'CBETH', 'SFRXETH',
    'EZETH', 'RSETH', 'ETHX', 'ANKRETH', 'OSETH', 'SWETH', 'METH',
    'SFRXETH', 'WEETH', 'EETH'
]);

// BTC-related symbols
const BTC_TOKENS = new Set([
    'BTC', 'WBTC', 'TBTC', 'CBBTC', 'RENBTC'
]);

function initDb() {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
    return db;
}

function categorizeToken(symbol) {
    const s = symbol.toUpperCase();
    if (isStablecoin(s)) return 'stablecoin';
    if (ETH_TOKENS.has(s)) return 'eth';
    if (BTC_TOKENS.has(s)) return 'btc';
    return 'other';
}

async function fetchPage(params, retries = 3) {
    const url = new URL(API_BASE);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            });

            if (res.status === 429) {
                const wait = Math.pow(2, attempt) * 2000;
                console.log(`  Rate limited, waiting ${wait}ms...`);
                await new Promise(r => setTimeout(r, wait));
                continue;
            }

            if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
            return await res.json();
        } catch (err) {
            if (attempt === retries - 1) throw err;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

async function fetchAllPages(baseParams, label) {
    const allTokens = [];
    let page = 0;
    let totalItems = 0;

    do {
        const data = await fetchPage({ ...baseParams, page: String(page), limit: String(PAGE_SIZE) });
        const tokens = data.tokens || [];
        totalItems = data.totalItems || 0;
        allTokens.push(...tokens);

        console.log(`  ${label} page ${page}: ${tokens.length} tokens (total: ${totalItems})`);
        page++;

        // Rate limit: 1 request per second
        if (data.more) await new Promise(r => setTimeout(r, 1000));
    } while (page * PAGE_SIZE < totalItems);

    return allTokens;
}

function storeToken(db, token) {
    const stmt = db.prepare(`
        INSERT INTO tokens (
            symbol, name, address, chain, decimals,
            apy, tvl_usd, price_usd,
            total_supply, asset_type, is_verified,
            portals_id, protocol_id, updated_at
        ) VALUES (
            @symbol, @name, @address, @chain, @decimals,
            @apy, @tvl_usd, @price_usd,
            @total_supply, @asset_type, @is_verified,
            @portals_id, @protocol_id, datetime('now')
        )
        ON CONFLICT(protocol_id, symbol, chain) DO UPDATE SET
            apy = excluded.apy,
            tvl_usd = excluded.tvl_usd,
            price_usd = excluded.price_usd,
            total_supply = excluded.total_supply,
            is_verified = excluded.is_verified,
            updated_at = datetime('now')
    `);

    // Get or create protocol
    let protocol = db.prepare('SELECT id FROM protocols WHERE platform_id = ? AND chain = ?')
        .get(token.platform, token.network);

    if (!protocol) {
        const result = db.prepare('INSERT INTO protocols (name, slug, chain, platform_id) VALUES (?, ?, ?, ?)')
            .run(token.platform + ' (' + token.network + ')', token.platform + '-' + token.network, token.network, token.platform);
        protocol = { id: result.lastInsertRowid };
    }

    stmt.run({
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        chain: token.network,
        decimals: token.decimals || 18,
        apy: token.metrics?.apy || 0,
        tvl_usd: token.liquidity || 0,
        price_usd: token.price || 0,
        total_supply: token.totalSupply || '0',
        asset_type: categorizeToken(token.symbol),
        is_verified: token.verifiedAt ? 1 : 0,
        portals_id: token.key,
        protocol_id: protocol.id
    });
}

function storeSnapshot(db, token) {
    const tokenRow = db.prepare('SELECT id FROM tokens WHERE portals_id = ?').get(token.key);
    if (!tokenRow) return;

    db.prepare(`
        INSERT INTO snapshots (token_id, timestamp, apy, tvl_usd, price_usd, total_supply)
        VALUES (?, datetime('now'), ?, ?, ?, ?)
        ON CONFLICT(token_id, timestamp) DO UPDATE SET
            apy = excluded.apy,
            tvl_usd = excluded.tvl_usd,
            price_usd = excluded.price_usd
    `).run(tokenRow.id, token.metrics?.apy || 0, token.liquidity || 0, token.price || 0, token.totalSupply || '0');
}

function logSync(db, type, count, status, error) {
    if (status === 'running') {
        db.prepare('INSERT INTO sync_log (sync_type, status, started_at) VALUES (?, ?, datetime(\'now\'))')
            .run(type, 'running');
    } else {
        db.prepare(`UPDATE sync_log SET completed_at = datetime('now'), items_count = ?, status = ?, error_message = ?
            WHERE id = (SELECT MAX(id) FROM sync_log WHERE sync_type = ? AND status = 'running')`)
            .run(count, status, error || null, type);
    }
}

async function main() {
    if (!API_KEY) {
        console.error('❌ PORTALS_API_KEY not set');
        process.exit(1);
    }

    const db = initDb();
    let totalTokens = 0;

    try {
        logSync(db, 'portals_update', 0, 'running');

        // Tier 1: All tokens with >$1M TVL (broad coverage)
        console.log('=== Tier 1: All tokens >$1M TVL ===');
        const broadTokens = await fetchAllPages({ minLiquidity: '1000000', sortBy: 'liquidity', sortDirection: 'desc' }, 'Broad');
        for (const t of broadTokens) {
            storeToken(db, t);
            storeSnapshot(db, t);
        }
        totalTokens += broadTokens.length;
        console.log(`  Stored ${broadTokens.length} tokens`);

        // Tier 2: Lending platforms with >$100K TVL (deep coverage)
        console.log('\n=== Tier 2: Lending platforms >$100K TVL ===');
        for (const platform of LENDING_PLATFORMS) {
            try {
                const platformTokens = await fetchAllPages(
                    { platforms: platform, minLiquidity: '100000', sortBy: 'liquidity', sortDirection: 'desc' },
                    platform
                );
                for (const t of platformTokens) {
                    storeToken(db, t);
                    storeSnapshot(db, t);
                }
                totalTokens += platformTokens.length;
                console.log(`  ${platform}: ${platformTokens.length} tokens`);
            } catch (err) {
                console.error(`  ${platform}: Error - ${err.message}`);
            }
        }

        logSync(db, 'portals_update', totalTokens, 'success');
        console.log(`\n✅ Portals fetch complete: ${totalTokens} total tokens stored`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        logSync(db, 'portals_update', totalTokens, 'error', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { initDb, fetchAllPages, categorizeToken };
