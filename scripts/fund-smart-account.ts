import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const SMART_ACCOUNT = '0xe7C0dad97500ccD89fF9361DC5acB20013873bb0';
const FUND_AMOUNT = parseEther('0.0001'); // 0.0001 ETH for prefund
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
  console.log('💰 Funding Smart Account for ERC-4337 Prefund');
  console.log('==============================================\n');
  console.log(`📍 Smart Account: ${SMART_ACCOUNT}`);
  console.log(`💸 Amount: ${FUND_AMOUNT.toString()} wei (0.0001 ETH)\n`);

  const hash = await walletClient.sendTransaction({
    to: SMART_ACCOUNT,
    value: FUND_AMOUNT,
  });

  console.log(`📝 TX: ${hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log('✅ Smart account funded with 0.0001 ETH!');
    console.log(`🔗 BaseScan: https://basescan.org/tx/${hash}`);
    console.log('\n✨ Now you can send gasless transactions!');
  } else {
    console.error('❌ Transaction failed');
  }
}

main().catch(console.error);
