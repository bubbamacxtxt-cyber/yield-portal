#!/usr/bin/env node
/**
 * Wallet Analyzer
 * Checks EVM wallet balances and DeFi positions
 * Uses Portals API for balances + direct contract reads for positions
 */

const API_KEY = process.env.PORTALS_API_KEY;
const NETWORKS = ['ethereum', 'arbitrum', 'base', 'optimism', 'avalanche', 'polygon', 'bsc', 'sonic', 'hyperevm'];

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

// Non-EVM address - skip
const SKIP = ['SP133ZXWBW9WY4HTHP9SKEC5414BGTTHT75G9HDKW'];

const NETWORKS_PARAM = NETWORKS.map(n => `networks[]=${n}`).join('&');

async function fetchBalances(wallet) {
    const url = `https://api.portals.fi/v2/account?owner=${wallet}&${NETWORKS_PARAM}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    if (!res.ok) {
        console.error(`  API error for ${wallet.slice(0,10)}...: ${res.status}`);
        return { balances: [] };
    }
    return await res.json();
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log(`Analyzing ${WALLETS.length} wallets across ${NETWORKS.length} networks...\n`);

    const results = [];

    for (let i = 0; i < WALLETS.length; i++) {
        const wallet = WALLETS[i];
        console.log(`[${i+1}/${WALLETS.length}] ${wallet.slice(0,10)}...`);

        const data = await fetchBalances(wallet);
        const balances = data.balances || [];

        // Group by network
        const byNetwork = {};
        let totalUSD = 0;

        for (const b of balances) {
            if (!byNetwork[b.network]) byNetwork[b.network] = [];
            const usdValue = (b.balance || 0) * (b.price || 0);
            totalUSD += usdValue;
            byNetwork[b.network].push({
                symbol: b.symbol,
                balance: b.balance,
                price: b.price,
                usd: usdValue,
                platform: b.platform,
                isDeFi: b.platform && b.platform !== 'native' && b.platform !== 'basic'
            });
        }

        results.push({
            wallet,
            totalUSD,
            networks: byNetwork,
            tokenCount: balances.length
        });

        if (totalUSD > 0) {
            console.log(`  Total: $${totalUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}`);
            for (const [net, tokens] of Object.entries(byNetwork)) {
                const netTotal = tokens.reduce((s, t) => s + t.usd, 0);
                const defiTokens = tokens.filter(t => t.isDeFi);
                console.log(`  ${net}: $${netTotal.toLocaleString(undefined, {maximumFractionDigits: 2})} (${tokens.length} tokens${defiTokens.length ? ', ' + defiTokens.length + ' DeFi' : ''})`);
            }
        } else {
            console.log(`  Empty or no positions on supported chains`);
        }

        // Rate limit
        if (i < WALLETS.length - 1) await sleep(1500);
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    const active = results.filter(r => r.totalUSD > 0);
    console.log(`Active wallets: ${active.length} / ${results.length}`);
    console.log(`Total value: $${active.reduce((s, r) => s + r.totalUSD, 0).toLocaleString(undefined, {maximumFractionDigits: 2})}`);

    // Top wallets
    console.log('\nTop wallets by value:');
    for (const r of active.sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 10)) {
        console.log(`  ${r.wallet}  $${r.totalUSD.toLocaleString(undefined, {maximumFractionDigits: 2})}`);
    }

    // Save results
    const fs = require('fs');
    fs.writeFileSync('wallet-analysis.json', JSON.stringify(results, null, 2));
    console.log('\nSaved to wallet-analysis.json');
}

main().catch(console.error);
