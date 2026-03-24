#!/usr/bin/env node
/**
 * Aave v3 Position Reader
 * Reads supply/borrow/health data from Aave Pool contracts
 * Shows looping strategies: supply → borrow → supply → ...
 */

const { ethers } = require('ethers');

const POOL_ABI = [
    'function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

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

const CHAINS = {
    ethereum: {
        rpc: 'https://ethereum-rpc.publicnode.com',
        pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
    },
    base: {
        rpc: 'https://base-rpc.publicnode.com',
        pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'
    },
    arbitrum: {
        rpc: 'https://arbitrum-one-rpc.publicnode.com',
        pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
    avalanche: {
        rpc: 'https://avalanche-c-chain-rpc.publicnode.com',
        pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
    optimism: {
        rpc: 'https://optimism-rpc.publicnode.com',
        pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
    polygon: {
        rpc: 'https://polygon-bor-rpc.publicnode.com',
        pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function readChain(chainName, chainConfig) {
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc, undefined, { staticNetwork: true, batchMaxCount: 1 });
    provider._getConnection().timeout = 8000;
    const pool = new ethers.Contract(chainConfig.pool, POOL_ABI, provider);
    const results = [];

    for (const wallet of WALLETS) {
        try {
            const data = await pool.getUserAccountData(wallet);
            // Aave v3 returns values in 8 decimals (1 USD = 1e8)
            const collateral = Number(data.totalCollateralBase) / 1e8;
            const debt = Number(data.totalDebtBase) / 1e8;
            const available = Number(data.availableBorrowsBase) / 1e8;
            const healthFactor = Number(ethers.formatEther(data.healthFactor));
            const ltv = Number(data.ltv) / 100;

            if (collateral > 0 || debt > 0) {
                results.push({
                    wallet,
                    collateral,
                    debt,
                    available,
                    healthFactor,
                    ltv,
                    chain: chainName,
                    utilization: collateral > 0 ? (debt / collateral * 100) : 0
                });
            }
        } catch (e) {
            // skip errors
        }
    }

    return results;
}

async function main() {
    console.log('=== Aave v3 Position Reader ===\n');

    const allResults = [];

    for (const [chainName, chainConfig] of Object.entries(CHAINS)) {
        console.log(`Reading ${chainName}...`);
        try {
            const results = await readChain(chainName, chainConfig);
            allResults.push(...results);
            if (results.length > 0) {
                console.log(`  Found ${results.length} positions`);
            } else {
                console.log(`  No positions`);
            }
        } catch (e) {
            console.log(`  Error: ${e.message}`);
        }
        await sleep(1000);
    }

    // Sort by collateral
    allResults.sort((a, b) => b.collateral - a.collateral);

    // Group by wallet
    const byWallet = {};
    for (const r of allResults) {
        if (!byWallet[r.wallet]) byWallet[r.wallet] = [];
        byWallet[r.wallet].push(r);
    }

    // Print results
    console.log(`\n${'='.repeat(80)}`);
    console.log(`AAVE v3 POSITIONS`);
    console.log(`${'='.repeat(80)}`);

    let totalCollateral = 0;
    let totalDebt = 0;

    for (const [wallet, positions] of Object.entries(byWallet)) {
        const short = `${wallet.slice(0, 8)}...${wallet.slice(-4)}`;
        const walletCollateral = positions.reduce((s, p) => s + p.collateral, 0);
        const walletDebt = positions.reduce((s, p) => s + p.debt, 0);
        totalCollateral += walletCollateral;
        totalDebt += walletDebt;

        console.log(`\n${'─'.repeat(60)}`);
        console.log(`WALLET: ${short}  (${wallet})`);
        console.log(`  Total Collateral: $${walletCollateral.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
        console.log(`  Total Debt:       $${walletDebt.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
        console.log(`  Net Position:     $${(walletCollateral - walletDebt).toLocaleString(undefined, {maximumFractionDigits: 0})}`);

        for (const p of positions) {
            console.log(`\n  Chain: ${p.chain.toUpperCase()}`);
            console.log(`    Collateral: $${p.collateral.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
            console.log(`    Debt:       $${p.debt.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
            console.log(`    Available:  $${p.available.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
            console.log(`    LTV:        ${p.ltv}%`);
            console.log(`    Health:     ${p.healthFactor === 0 ? '∞ (no debt)' : p.healthFactor.toFixed(2)}`);
            if (p.debt > 0) {
                console.log(`    Utilization: ${p.utilization.toFixed(1)}%`);
                if (p.utilization > 70) {
                    console.log(`    ⚠️  HIGH LEVERAGE — likely looping strategy`);
                }
            }
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`TOTALS`);
    console.log(`  Total Collateral: $${totalCollateral.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
    console.log(`  Total Debt:       $${totalDebt.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
    console.log(`  Net:              $${(totalCollateral - totalDebt).toLocaleString(undefined, {maximumFractionDigits: 0})}`);
    console.log(`  Active wallets:   ${Object.keys(byWallet).length}`);

    // Save
    const fs = require('fs');
    fs.writeFileSync('aave-positions.json', JSON.stringify(allResults, null, 2));
    console.log('\nSaved to aave-positions.json');
}

main().catch(console.error);
