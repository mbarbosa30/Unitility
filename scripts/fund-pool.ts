import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const POOL_ADDRESS = '0xa7c6359200fa376c233a454de456291357d5ed18';
const DEPOSIT_AMOUNT = parseEther('0.001'); // 0.001 ETH
const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  console.error('❌ DEPLOYER_PRIVATE_KEY not set');
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
  console.log('💰 Funding PaymasterPool');
  console.log('========================\n');
  console.log(`📍 Pool: ${POOL_ADDRESS}`);
  console.log(`💸 Amount: ${DEPOSIT_AMOUNT.toString()} wei (0.001 ETH)\n`);

  const hash = await walletClient.sendTransaction({
    to: POOL_ADDRESS,
    value: DEPOSIT_AMOUNT,
  });

  console.log(`📝 TX: ${hash}`);
  console.log('⏳ Waiting...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log('✅ Deposited 0.001 ETH to pool!');
    console.log(`🔗 BaseScan: https://basescan.org/tx/${hash}`);
  } else {
    console.error('❌ Transaction failed');
  }
}

main().catch(console.error);
