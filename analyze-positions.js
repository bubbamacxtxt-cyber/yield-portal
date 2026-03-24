#!/usr/bin/env node
/**
 * Deep Wallet Analyzer
 * Reads DeFi positions for the protocol wallets
 * Filters: >$100K only, ignore Stacks
 * Shows: strategies, tokens, platforms per wallet
 */

const API_KEY = process.env.PORTALS_API_KEY;
const NETWORKS = ['ethereum', 'arbitrum', 'base', 'optimism', 'avalanche', 'polygon', 'bsc', 'sonic', 'hyperevm'];
const NETWORKS_PARAM = NETWORKS.map(n => `networks[]=${n}`).join('&');

const WALLETS = [
    '0x020c5bB0d81b8cf539Ca06364Ece4a41631995b4',
    '0x887fD380C1e4Cc28e119917015fE7fb0062c5d67',
    '0xB2e193a469D73634b116810d647960ad00Db321D',
    '0x1Ae4190c55c2986130694aF6998A94126C0685cd',
    '0xc29ff89a2dE0c0E8A358a933A8B00692cDe452b5',
    '0xC1d023141ad6935F81E5286E577768b75C9Ff8EB',
    '0x5b53358ECA5790fA4c268aD6813386B3A86549C7',
    '0xFbbF1826Aba90704A2167D2EB4A7a9D83A8DE9c7',
    '0x1DFF1e9968222aa6c66BF402baC2C3FE5Ed13F76',
    '0x3207363359Ca0c11D11073aD48301E8c958B7910',
    '0x7bee8D37FBA61a6251a08b957d502C56E2A50FAb',
    '0x920EefBCf1f5756109952E6Ff6dA1Cab950C64d7',
    '0xD2305803Ca7821e4E5C3bcAeD366AD7dE9F13739',
    '0xe5971fd226433d5D3a926c9fc99BbDd1E5953146',
    '0xc2d2C22f54c9Fae2456b6E7f7fBdC240E1898DA1',
    '0xAcABC577f359e4Af4Dd057af56de5A576ba9Bd82',
    '0xD2Fb3766A7d191AFfaa8Ab5C40B6A67007Aa3A5d',
    '0xc468315a2df54f9c076bD5Cfe5002BA211F74CA6',
    '0x33A4866bffc90791e65Da0d339eDdcaE3d9ce9F9',
    '0x3BbCb84fCDE71063D8C396e6C54F5dC3D19EE0EC',
];

// Known protocol token patterns (Aave aTokens, Compound cTokens, etc.)
const PROTOCOL_TOKENS = {
    // Aave
    'aave': { patterns: ['^a[A-Z]{2,6}$', '^v[A-Z]{2,6}$'], platform: 'aave', type: 'lending' },
    'aave-v3-stata': { patterns: ['^stata[A-Z]{3,6}'], platform: 'aave-v3', type: 'lending' },
    // Compound
    'compound': { patterns: ['^c[A-Z]{3,6}$', '^cWBTC$'], platform: 'compound', type: 'lending' },
    // Morpho
    'morpho': { patterns: ['^m[A-Z]{3,6}$', '^morpho'], platform: 'morpho', type: 'lending' },
    // Fluid
    'fluid': { patterns: ['^f[A-Z]{3,6}$'], platform: 'fluid', type: 'lending' },
    // Euler
    'euler': { patterns: ['^e[A-Z]{3,6}$', '^euler'], platform: 'euler', type: 'lending' },
    // Silo
    'silo': { patterns: ['^silo'], platform: 'silo', type: 'lending' },
    // Spark
    'spark': { patterns: ['^spark', '^sp[A-Z]{3,6}'], platform: 'spark', type: 'lending' },
    // Venus
    'venus': { patterns: ['^v[A-Z]{3,6}$'], platform: 'venus', type: 'lending' },
    // Pendle
    'pendle': { patterns: ['^PT-', '^YT-', 'pendle'], platform: 'pendle', type: 'yield' },
    // Eigenlayer
    'eigenlayer': { patterns: ['^eigen', 'stETH'], platform: 'eigenlayer', type: 'staking' },
    // Lido
    'lido': { patterns: ['^stETH', '^wstETH'], platform: 'lido', type: 'staking' },
    // Rocket Pool
    'rocket': { patterns: ['^rETH'], platform: 'rocket-pool', type: 'staking' },
    // Uniswap LP
    'uniswap': { patterns: ['^UNI-V[23]$', 'NFT'], platform: 'uniswap', type: 'lp' },
    // Curve
    'curve': { patterns: ['^crv', '^CRV', '3pool'], platform: 'curve', type: 'lp' },
    // Convex
    'convex': { patterns: ['^cvx'], platform: 'convex', type: 'yield' },
    // Yearn
    'yearn': { patterns: ['^yv'], platform: 'yearn', type: 'vault' },
    // Gearbox
    'gearbox': { patterns: ['^gear'], platform: 'gearbox', type: 'leveraged' },
    // Ethena
    'ethena': { patterns: ['^sUSDe', '^USDe'], platform: 'ethena', type: 'stablecoin' },
    // MakerDAO / Sky
    'maker': { patterns: ['^DAI', '^USDS', '^sDAI', '^MKR', '^SKY'], platform: 'makerdao', type: 'stablecoin' },
    // Radiant
    'radiant': { patterns: ['^rd'], platform: 'radiant', type: 'lending' },
};

function classifyToken(symbol, platform, name) {
    const s = (symbol || '').toUpperCase();
    const n = (name || '').toLowerCase();
    const p = (platform || '').toLowerCase();

    // Direct platform match from Portals
    if (p && p !== 'native' && p !== 'basic') {
        return { platform: p, type: 'defi' };
    }

    // Check known patterns
    for (const [proto, config] of Object.entries(PROTOCOL_TOKENS)) {
        for (const pattern of config.patterns) {
            if (new RegExp(pattern, 'i').test(s)) {
                return { platform: config.platform, type: config.type };
            }
        }
    }

    // Check name field
    if (n.includes('aave') || n.includes('lending')) return { platform: 'aave', type: 'lending' };
    if (n.includes('compound')) return { platform: 'compound', type: 'lending' };
    if (n.includes('morpho')) return { platform: 'morpho', type: 'lending' };
    if (n.includes('euler')) return { platform: 'euler', type: 'lending' };
    if (n.includes('pendle')) return { platform: 'pendle', type: 'yield' };

    return null; // basic token
}

async function fetchWallet(wallet) {
    const url = `https://api.portals.fi/v2/account?owner=${wallet}&${NETWORKS_PARAM}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    if (!res.ok) return { balances: [] };
    return await res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    console.log('=== Deep Wallet Analysis ===');
    console.log(`Analyzing ${WALLETS.length} wallets for DeFi positions\n`);

    const allResults = [];

    for (let i = 0; i < WALLETS.length; i++) {
        const wallet = WALLETS[i];
        const short = `${wallet.slice(0, 8)}...${wallet.slice(-4)}`;

        const data = await fetchWallet(wallet);
        const balances = data.balances || [];

        // Calculate totals
        let totalUSD = 0;
        const positions = [];
        const byPlatform = {};

        for (const b of balances) {
            const usd = (b.balance || 0) * (b.price || 0);
            totalUSD += usd;

            const classification = classifyToken(b.symbol, b.platform, b.name);
            const isDeFi = classification !== null;

            if (usd > 0) {
                const pos = {
                    symbol: b.symbol,
                    name: b.name || b.symbol,
                    balance: b.balance,
                    usd,
                    network: b.network,
                    platform: b.platform || 'native',
                    classification: classification,
                    isDeFi
                };
                positions.push(pos);

                if (isDeFi) {
                    const plat = classification.platform;
                    if (!byPlatform[plat]) byPlatform[plat] = { total: 0, tokens: [], type: classification.type };
                    byPlatform[plat].total += usd;
                    byPlatform[plat].tokens.push(`${b.symbol} ($${usd.toLocaleString(undefined, {maximumFractionDigits: 0})}) on ${b.network}`);
                }
            }
        }

        if (totalUSD >= 100000) {
            allResults.push({ wallet, short, totalUSD, positions, byPlatform });
        }

        if (i < WALLETS.length - 1) await sleep(1500);
    }

    // Sort by value
    allResults.sort((a, b) => b.totalUSD - a.totalUSD);

    // Print results
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Found ${allResults.length} wallets with >$100K value`);
    console.log(`Total value: $${allResults.reduce((s, r) => s + r.totalUSD, 0).toLocaleString(undefined, {maximumFractionDigits: 0})}`);
    console.log(`${'='.repeat(80)}\n`);

    for (const r of allResults) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`WALLET: ${r.short}`);
        console.log(`  Full: ${r.wallet}`);
        console.log(`  Total: $${r.totalUSD.toLocaleString(undefined, {maximumFractionDigits: 0})}`);

        if (Object.keys(r.byPlatform).length > 0) {
            console.log(`\n  DeFi Positions:`);
            for (const [plat, info] of Object.entries(r.byPlatform).sort((a, b) => b[1].total - a[1].total)) {
                console.log(`    ${plat.toUpperCase()} (${info.type}) — $${info.total.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
                for (const t of info.tokens) {
                    console.log(`      → ${t}`);
                }
            }
        } else {
            console.log(`  No protocol positions detected — likely holding basic tokens`);
        }

        // Show native/basic tokens
        const basicTokens = r.positions.filter(p => !p.isDeFi);
        if (basicTokens.length > 0) {
            console.log(`\n  Basic Tokens:`);
            for (const t of basicTokens.sort((a, b) => b.usd - a.usd).slice(0, 10)) {
                console.log(`    ${t.symbol.padEnd(12)} $${t.usd.toLocaleString(undefined, {maximumFractionDigits: 0})} on ${t.network}`);
            }
        }
    }

    // Strategy summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('STRATEGY SUMMARY');
    console.log(`${'='.repeat(80)}`);

    const stratSummary = {};
    for (const r of allResults) {
        for (const [plat, info] of Object.entries(r.byPlatform)) {
            if (!stratSummary[plat]) stratSummary[plat] = { total: 0, wallets: 0, type: info.type };
            stratSummary[plat].total += info.total;
            stratSummary[plat].wallets += 1;
        }
    }

    for (const [plat, info] of Object.entries(stratSummary).sort((a, b) => b[1].total - a[1].total)) {
        console.log(`  ${plat.toUpperCase().padEnd(15)} ${info.type.padEnd(12)} $${info.total.toLocaleString(undefined, {maximumFractionDigits: 0})} across ${info.wallets} wallet(s)`);
    }

    // Save
    const fs = require('fs');
    fs.writeFileSync('wallet-positions.json', JSON.stringify(allResults, null, 2));
    console.log('\nSaved to wallet-positions.json');
}

main().catch(console.error);
