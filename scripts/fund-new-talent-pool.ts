import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const NEW_POOL_ADDRESS = '0x072330F9EA3F97DB7C8265096e59E0C42334aAaf'; // The pool you just created
const DEPOSIT_AMOUNT = parseEther('0.001');
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

const PaymasterPoolABI = [
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

async function main() {
  console.log('💰 Funding NEW TALENT PaymasterPool (0x072330...)');
  console.log('==================================================\n');
  console.log(`📍 Pool: ${NEW_POOL_ADDRESS}`);
  console.log(`💸 Amount: ${DEPOSIT_AMOUNT.toString()} wei (0.001 ETH)\n`);

  const hash = await walletClient.writeContract({
    address: NEW_POOL_ADDRESS as `0x${string}`,
    abi: PaymasterPoolABI,
    functionName: 'deposit',
    value: DEPOSIT_AMOUNT,
  });

  console.log(`📝 TX: ${hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log('✅ Deposited 0.001 ETH to your new TALENT pool!');
    console.log('💡 This ETH is now deposited in the EntryPoint for sponsoring gas');
    console.log(`🔗 BaseScan: https://basescan.org/tx/${hash}`);
  } else {
    console.error('❌ Transaction failed');
  }
}

main().catch(console.error);
