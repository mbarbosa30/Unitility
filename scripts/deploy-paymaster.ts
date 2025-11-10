/**
 * Deploy PaymasterPool contract to Base mainnet
 * 
 * This script will deploy using one of two methods:
 * 1. Pre-compiled bytecode from secrets
 * 2. Source code deployment (requires online compiler)
 */

import { createWalletClient, createPublicClient, http, parseEther, encodeDeployData } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as readline from 'readline';

// Configuration
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // ERC-4337 v0.7 on Base
const RPC_URL = process.env.VITE_BASE_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Get deployer account from private key
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  console.error('❌ ERROR: DEPLOYER_PRIVATE_KEY not set in environment');
  console.error('   Add your private key to Replit Secrets as DEPLOYER_PRIVATE_KEY');
  process.exit(1);
}

const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as `0x${string}`);

// Create clients
const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(RPC_URL),
});

// Prompt user for configuration
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🚀 PaymasterPool Deployment Script');
  console.log('===================================\n');

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`📍 Deployer Address: ${account.address}`);
  console.log(`💰 Balance: ${parseFloat(balance.toString()) / 1e18} ETH`);
  console.log(`🌐 Network: Base Mainnet`);
  console.log(`🔗 EntryPoint: ${ENTRY_POINT}\n`);

  if (balance < parseEther('0.002')) {
    console.error('❌ ERROR: Insufficient balance. Need at least 0.002 ETH for deployment.');
    process.exit(1);
  }

  // Get deployment parameters
  console.log('📝 Deployment Configuration:\n');
  
  const tokenAddress = await prompt('Token Address (e.g., 0x776d2280853da64025644f36e785411baa2d1592): ');
  if (!tokenAddress || tokenAddress.length !== 42) {
    console.error('❌ Invalid token address');
    process.exit(1);
  }

  const feePctInput = await prompt('Fee Percentage in basis points (e.g., 50 = 0.5%): ');
  const feePct = parseInt(feePctInput);
  if (isNaN(feePct) || feePct < 0 || feePct > 10000) {
    console.error('❌ Invalid fee percentage (must be 0-10000)');
    process.exit(1);
  }

  const minTransferInput = await prompt('Minimum Transfer Amount in wei (e.g., 1000000000000000000 = 1 token): ');
  const minTransfer = BigInt(minTransferInput);

  const sponsorAddress = await prompt(`Sponsor Address (press Enter to use ${account.address}): `);
  const sponsor = sponsorAddress || account.address;

  console.log('\n📋 Deployment Parameters:');
  console.log(`   EntryPoint: ${ENTRY_POINT}`);
  console.log(`   Token: ${tokenAddress}`);
  console.log(`   Fee: ${feePct / 100}%`);
  console.log(`   Min Transfer: ${minTransfer.toString()}`);
  console.log(`   Sponsor: ${sponsor}\n`);

  const confirm = await prompt('⚠️  Deploy to MAINNET? Type "yes" to continue: ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Deployment cancelled.');
    rl.close();
    process.exit(0);
  }

  // Since we don't have compiled bytecode, provide instructions
  console.log('\n⚠️  Automated deployment requires compiled bytecode.');
  console.log('\n📝 Choose deployment method:\n');
  console.log('1️⃣  Quick Deploy via Remix (Recommended - 2 minutes)');
  console.log('   • Visit https://remix.ethereum.org');
  console.log('   • Copy contract from DEPLOY.md');
  console.log('   • Compile with v0.8.20');
  console.log('   • Deploy with parameters above\n');
  
  console.log('2️⃣  Deploy via this script (requires bytecode)');
  console.log('   • Compile contract manually');
  console.log('   • Set PAYMASTER_POOL_BYTECODE in secrets');
  console.log('   • Run this script again\n');

  const bytecode = process.env.PAYMASTER_POOL_BYTECODE;
  
  if (bytecode && bytecode.startsWith('0x')) {
    console.log('✅ Found PAYMASTER_POOL_BYTECODE in environment');
    console.log('⏳ Deploying contract...\n');

    try {
      // Deploy with constructor parameters
      const hash = await walletClient.deployContract({
        abi: [
          {
            type: 'constructor',
            inputs: [
              { name: '_entryPoint', type: 'address' },
              { name: '_tokenAddress', type: 'address' },
              { name: '_feePct', type: 'uint256' },
              { name: '_minTransfer', type: 'uint256' },
              { name: '_sponsor', type: 'address' },
            ],
          },
        ],
        bytecode: bytecode as `0x${string}`,
        args: [ENTRY_POINT, tokenAddress as `0x${string}`, BigInt(feePct), minTransfer, sponsor as `0x${string}`],
      });

      console.log(`📝 Transaction: ${hash}`);
      console.log('⏳ Waiting for confirmation...');

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success' && receipt.contractAddress) {
        console.log('\n✅ PaymasterPool deployed successfully!');
        console.log(`📍 Contract Address: ${receipt.contractAddress}`);
        console.log(`🔗 BaseScan: https://basescan.org/address/${receipt.contractAddress}`);
        console.log(`\n📝 Next Steps:`);
        console.log(`1. Deposit ETH: Call deposit() with value`);
        console.log(`2. Update database with contract address: ${receipt.contractAddress}`);
        console.log(`3. Test gasless transfer\n`);
      } else {
        console.error('❌ Deployment failed');
      }
    } catch (error: any) {
      console.error('❌ Deployment error:', error.message);
      process.exit(1);
    }
  } else {
    console.log('💡 TIP: For fastest deployment, use Remix IDE (option 1)');
    console.log('    Full instructions available in DEPLOY.md\n');
  }

  rl.close();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
