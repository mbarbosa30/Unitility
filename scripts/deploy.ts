/**
 * Deployment script for Paymaster Market contracts to Base mainnet
 * 
 * Prerequisites:
 * 1. Contracts compiled with Hardhat/Foundry
 * 2. DEPLOYER_PRIVATE_KEY set in environment
 * 3. Base ETH in deployer wallet
 * 
 * Usage:
 *   tsx scripts/deploy.ts
 */

import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as readline from 'readline';

// Configuration
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // ERC-4337 v0.7 on Base
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

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

// Prompt user for confirmation
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
  console.log('🚀 Paymaster Market Deployment Script');
  console.log('=====================================\n');

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`📍 Deployer Address: ${account.address}`);
  console.log(`💰 Balance: ${parseFloat(balance.toString()) / 1e18} ETH`);
  console.log(`🌐 Network: Base Mainnet`);
  console.log(`🔗 EntryPoint: ${ENTRY_POINT}\n`);

  if (balance < parseEther('0.02')) {
    console.error('❌ ERROR: Insufficient balance. Need at least 0.02 ETH for deployment.');
    process.exit(1);
  }

  // Confirm deployment
  const confirm = await prompt('⚠️  Deploy to MAINNET? This will cost real ETH. Type "yes" to continue: ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Deployment cancelled.');
    process.exit(0);
  }

  // TODO: Replace this with actual compiled bytecode from Hardhat/Foundry
  // After compiling contracts, extract bytecode from artifacts/contracts/PaymasterFactory.sol/PaymasterFactory.json
  const PAYMASTER_FACTORY_BYTECODE = process.env.PAYMASTER_FACTORY_BYTECODE;

  if (!PAYMASTER_FACTORY_BYTECODE) {
    console.log('\n📝 IMPORTANT: PAYMASTER_FACTORY_BYTECODE not set!');
    console.log('   This script requires compiled bytecode from Hardhat/Foundry.');
    console.log('\n📚 Steps to compile and deploy:');
    console.log('   1. Compile contracts locally with: npx hardhat compile');
    console.log('   2. Extract bytecode from artifacts/contracts/PaymasterFactory.sol/PaymasterFactory.json');
    console.log('   3. Set PAYMASTER_FACTORY_BYTECODE in Replit Secrets');
    console.log('   4. Run: tsx scripts/deploy.ts');
    console.log('   5. Verify on BaseScan');
    console.log('   6. Add VITE_PAYMASTER_FACTORY_ADDRESS to Replit Secrets\n');
    rl.close();
    process.exit(1);
  }

  try {
    console.log('\n⏳ Deploying PaymasterFactory...');

    // Deploy PaymasterFactory contract
    const hash = await walletClient.deployContract({
      abi: [
        {
          type: 'constructor',
          inputs: [{ name: '_entryPoint', type: 'address' }],
        },
      ],
      bytecode: PAYMASTER_FACTORY_BYTECODE as `0x${string}`,
      args: [ENTRY_POINT],
    });

    console.log(`📝 Transaction: ${hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success' && receipt.contractAddress) {
      console.log('\n✅ PaymasterFactory deployed successfully!');
      console.log(`📍 Factory Address: ${receipt.contractAddress}`);
      console.log(`🔗 View on BaseScan: https://basescan.org/address/${receipt.contractAddress}`);
      console.log(`\n💾 Add to Replit Secrets:`);
      console.log(`   VITE_PAYMASTER_FACTORY_ADDRESS=${receipt.contractAddress}`);
      console.log(`\n🔍 Next: Verify contract on BaseScan:`);
      console.log(`   npx hardhat verify --network base ${receipt.contractAddress} ${ENTRY_POINT}`);
    } else {
      console.error('❌ Deployment failed - no contract address in receipt');
    }
  } catch (error: any) {
    console.error('❌ Deployment error:', error.message);
    process.exit(1);
  }

  rl.close();
}

main().catch((error) => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});
