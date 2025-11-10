import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const POOL_ADDRESS = '0x072330F9EA3F97DB7C8265096e59E0C42334aAaf';
const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
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

const EntryPointABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "depositTo",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

async function main() {
  console.log('💰 Depositing DIRECTLY to EntryPoint');
  console.log('======================================\n');
  console.log(`📍 EntryPoint: ${ENTRYPOINT_ADDRESS}`);
  console.log(`📍 For Pool: ${POOL_ADDRESS}`);
  console.log(`💸 Amount: ${DEPOSIT_AMOUNT.toString()} wei (0.001 ETH)\n`);

  const hash = await walletClient.writeContract({
    address: ENTRYPOINT_ADDRESS as `0x${string}`,
    abi: EntryPointABI,
    functionName: 'depositTo',
    args: [POOL_ADDRESS as `0x${string}`],
    value: DEPOSIT_AMOUNT,
  });

  console.log(`📝 TX: ${hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log('✅ Deposited 0.001 ETH directly to EntryPoint for pool!');
    console.log('💡 Pool can now sponsor gasless transactions');
    console.log(`🔗 BaseScan: https://basescan.org/tx/${hash}`);
  } else {
    console.error('❌ Transaction failed');
  }
}

main().catch(console.error);
