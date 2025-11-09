/**
 * Script to create a test pool after factory deployment
 * 
 * Prerequisites:
 * 1. Factory deployed (VITE_PAYMASTER_FACTORY_ADDRESS set)
 * 2. DEPLOYER_PRIVATE_KEY with Base ETH
 * 
 * Usage:
 *   tsx scripts/create-pool.ts <token_address> <fee_pct> <min_transfer> <eth_deposit>
 * 
 * Example:
 *   tsx scripts/create-pool.ts 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 50 1000000 0.1
 *   Creates USDC pool with 0.5% fee, 1 USDC min, 0.1 ETH deposit
 */

import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import PaymasterFactoryABI from '../client/src/contracts/PaymasterFactory.json';

// Configuration
const FACTORY_ADDRESS = process.env.VITE_PAYMASTER_FACTORY_ADDRESS;
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

if (!FACTORY_ADDRESS) {
  console.error('❌ ERROR: VITE_PAYMASTER_FACTORY_ADDRESS not set');
  console.error('   Deploy factory first with scripts/deploy.ts');
  process.exit(1);
}

// Get deployer account from private key
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  console.error('❌ ERROR: DEPLOYER_PRIVATE_KEY not set');
  process.exit(1);
}

const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as `0x${string}`);

// Parse CLI arguments
const [tokenAddress, feePct, minTransfer, ethDeposit] = process.argv.slice(2);

if (!tokenAddress || !feePct || !minTransfer || !ethDeposit) {
  console.log('Usage: tsx scripts/create-pool.ts <token> <fee_pct> <min_transfer> <eth_deposit>');
  console.log('\nExample:');
  console.log('  tsx scripts/create-pool.ts 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 50 1000000 0.1');
  console.log('  (Creates USDC pool: 0.5% fee, 1 USDC min, 0.1 ETH deposit)');
  process.exit(1);
}

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

async function main() {
  console.log('🏊 Creating Paymaster Pool');
  console.log('==========================\n');
  console.log(`📍 Factory: ${FACTORY_ADDRESS}`);
  console.log(`🪙 Token: ${tokenAddress}`);
  console.log(`💸 Fee: ${parseInt(feePct) / 100}%`);
  console.log(`📊 Min Transfer: ${minTransfer} units`);
  console.log(`💰 ETH Deposit: ${ethDeposit} ETH\n`);

  try {
    // Call createPool on factory
    const { request } = await publicClient.simulateContract({
      address: FACTORY_ADDRESS as `0x${string}`,
      abi: PaymasterFactoryABI.abi,
      functionName: 'createPool',
      args: [tokenAddress, BigInt(feePct), BigInt(minTransfer)],
      value: parseEther(ethDeposit),
      account,
    });

    console.log('⏳ Submitting transaction...');
    const hash = await walletClient.writeContract(request);
    console.log(`📝 Transaction: ${hash}`);

    console.log('⏳ Waiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('✅ Pool created successfully!');
      console.log(`🔗 View on BaseScan: https://basescan.org/tx/${hash}`);

      // Parse logs to get pool address
      // PoolCreated event signature: keccak256("PoolCreated(address,address,uint256,uint256,address)")
      const POOL_CREATED_TOPIC = '0x33363435aa328f4a84563aa5eda653e11b245849e979c71e099477e6f4a03309';
      
      const poolCreatedLog = receipt.logs.find((log) =>
        log.topics[0] === POOL_CREATED_TOPIC
      );

      if (poolCreatedLog && poolCreatedLog.topics[1]) {
        // First indexed parameter is poolAddress
        const poolAddress = `0x${poolCreatedLog.topics[1].slice(-40)}`;
        console.log(`\n🏊 Pool Address: ${poolAddress}`);
        console.log(`🔗 View Pool: https://basescan.org/address/${poolAddress}`);
      } else {
        console.log(`\n⚠️  Warning: Could not extract pool address from transaction logs`);
        console.log(`   Check transaction on BaseScan to find the pool address`);
      }
    } else {
      console.error('❌ Transaction failed');
    }
  } catch (error: any) {
    console.error('❌ Error creating pool:', error.message);
    process.exit(1);
  }
}

main();
