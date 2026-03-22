#!/usr/bin/env node
/**
 * Export data to data.json for the dashboard
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'yield-portal.db');
const OUTPUT_PATH = path.join(__dirname, 'data.json');

function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ Database not found. Run fetch first.');
        process.exit(1);
    }

    const db = new Database(DB_PATH, { readonly: true });

    // Top yields by asset type
    const topYields = {};
    for (const assetType of ['stablecoin', 'eth', 'btc', 'other']) {
        topYields[assetType] = db.prepare(`
            SELECT t.symbol, t.chain, p.name as protocol, t.apy, t.tvl_usd, t.price_usd,
                   t.asset_type, t.is_verified,
                   ROUND(t.apy * LOG(t.tvl_usd + 1), 2) as risk_score
            FROM tokens t
            JOIN protocols p ON t.protocol_id = p.id
            WHERE t.asset_type = ? AND t.tvl_usd > 100000 AND t.apy > 0
            ORDER BY t.apy DESC
            LIMIT 50
        `).all(assetType);
    }

    // All tokens sorted by APY
    const allByApy = db.prepare(`
        SELECT t.symbol, t.chain, p.name as protocol, t.apy, t.tvl_usd,
               t.asset_type, p.platform_id
        FROM tokens t
        JOIN protocols p ON t.protocol_id = p.id
        WHERE t.tvl_usd > 100000 AND t.apy > 0
        ORDER BY t.apy DESC
        LIMIT 500
    `).all();

    // All tokens sorted by TVL
    const allByTvl = db.prepare(`
        SELECT t.symbol, t.chain, p.name as protocol, t.apy, t.tvl_usd,
               t.asset_type, p.platform_id
        FROM tokens t
        JOIN protocols p ON t.protocol_id = p.id
        WHERE t.tvl_usd > 100000
        ORDER BY t.tvl_usd DESC
        LIMIT 500
    `).all();

    // Risk-adjusted top yields
    const riskAdjusted = db.prepare(`
        SELECT t.symbol, t.chain, p.name as protocol, t.apy, t.tvl_usd,
               t.asset_type,
               ROUND(t.apy * LOG(t.tvl_usd + 1), 2) as risk_score
        FROM tokens t
        JOIN protocols p ON t.protocol_id = p.id
        WHERE t.tvl_usd > 1000000 AND t.apy > 0
        ORDER BY risk_score DESC
        LIMIT 100
    `).all();

    // Chain summary
    const chainSummary = db.prepare(`
        SELECT chain, COUNT(*) as token_count, 
               SUM(tvl_usd) as total_tvl,
               AVG(CASE WHEN apy > 0 THEN apy END) as avg_apy
        FROM tokens
        WHERE tvl_usd > 100000
        GROUP BY chain
        ORDER BY total_tvl DESC
    `).all();

    // Protocol summary
    const protocolSummary = db.prepare(`
        SELECT p.name, p.chain, COUNT(*) as token_count,
               SUM(t.tvl_usd) as total_tvl,
               AVG(CASE WHEN t.apy > 0 THEN t.apy END) as avg_apy
        FROM tokens t
        JOIN protocols p ON t.protocol_id = p.id
        WHERE t.tvl_usd > 100000
        GROUP BY p.id
        ORDER BY total_tvl DESC
        LIMIT 50
    `).all();

    // Stats
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total_tokens,
            COUNT(DISTINCT chain) as total_chains,
            COUNT(DISTINCT protocol_id) as total_protocols,
            SUM(tvl_usd) as total_tvl,
            MAX(updated_at) as last_updated
        FROM tokens
        WHERE tvl_usd > 100000
    `).get();

    // Last sync
    const lastSync = db.prepare(`
        SELECT sync_type, status, items_count, completed_at
        FROM sync_log
        WHERE status = 'success'
        ORDER BY id DESC
        LIMIT 5
    `).all();

    const data = {
        generatedAt: new Date().toISOString(),
        stats,
        topYields,
        allByApy,
        allByTvl,
        riskAdjusted,
        chainSummary,
        protocolSummary,
        lastSync
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ data.json generated`);
    console.log(`   Tokens: ${stats.total_tokens}`);
    console.log(`   Chains: ${stats.total_chains}`);
    console.log(`   Protocols: ${stats.total_protocols}`);
    console.log(`   TVL: $${(stats.total_tvl / 1e9).toFixed(2)}B`);

    db.close();
}

main();
