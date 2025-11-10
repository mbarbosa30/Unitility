/**
 * Non-interactive deployment script for TALENT PaymasterPool
 */
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const TALENT_TOKEN = '0x9a33406165f562e16c3abd82fd1185482e01b49a'; // Correct TALENT token
const FEE_PCT = 50; // 0.5%
const MIN_TRANSFER = parseEther('1'); // 1 TALENT minimum
const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  console.error('❌ ERROR: DEPLOYER_PRIVATE_KEY not set');
  process.exit(1);
}

const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as `0x${string}`);

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
  console.log('🚀 Deploying PaymasterPool for TALENT');
  console.log('=====================================\n');
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`📍 Deployer: ${account.address}`);
  console.log(`💰 Balance: ${(Number(balance) / 1e18).toFixed(4)} ETH`);
  console.log(`🪙 Token: TALENT (${TALENT_TOKEN})`);
  console.log(`💸 Fee: ${FEE_PCT / 100}%`);
  console.log(`📏 Min Transfer: ${MIN_TRANSFER.toString()} wei\n`);

  if (balance < parseEther('0.002')) {
    console.error('❌ Insufficient balance (need 0.002 ETH minimum)');
    process.exit(1);
  }

  const bytecode = process.env.PAYMASTER_POOL_BYTECODE;
  if (!bytecode) {
    console.error('❌ PAYMASTER_POOL_BYTECODE not found in environment');
    console.log('\n📝 To deploy:');
    console.log('1. Compile contract: npm run compile:contracts');
    console.log('2. Copy bytecode to PAYMASTER_POOL_BYTECODE secret');
    console.log('3. Run this script again\n');
    process.exit(1);
  }

  console.log('⏳ Deploying contract...\n');

  try {
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
      args: [ENTRY_POINT, TALENT_TOKEN, BigInt(FEE_PCT), MIN_TRANSFER, account.address],
    });

    console.log(`📝 TX Hash: ${hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success' && receipt.contractAddress) {
      console.log('\n✅ Deployment successful!');
      console.log(`📍 Contract: ${receipt.contractAddress}`);
      console.log(`🔗 BaseScan: https://basescan.org/address/${receipt.contractAddress}`);
      console.log(`\n📝 Next: Update database with this address`);
      console.log(`   UPDATE pools SET contract_address = '${receipt.contractAddress}' WHERE token_symbol = 'TALENT';`);
    } else {
      console.error('❌ Deployment failed');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
