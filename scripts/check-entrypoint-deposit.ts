import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';

const POOL_ADDRESS = '0x072330F9EA3F97DB7C8265096e59E0C42334aAaf';
const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const EntryPointABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  console.log('🔍 Checking EntryPoint deposit balance');
  console.log('========================================\n');
  console.log(`📍 Pool: ${POOL_ADDRESS}`);
  console.log(`📍 EntryPoint: ${ENTRYPOINT_ADDRESS}\n`);

  const balance = await publicClient.readContract({
    address: ENTRYPOINT_ADDRESS as `0x${string}`,
    abi: EntryPointABI,
    functionName: 'balanceOf',
    args: [POOL_ADDRESS as `0x${string}`],
  });

  console.log(`💰 EntryPoint Deposit: ${formatEther(balance)} ETH`);
  console.log(`   (${balance.toString()} wei)\n`);

  if (balance === 0n) {
    console.log('❌ PROBLEM: Pool has ZERO ETH deposited in EntryPoint!');
    console.log('   The deposit() function may not have worked correctly.');
    console.log('   Need to send ETH directly to EntryPoint.depositTo(pool)');
  } else {
    console.log('✅ Pool has funds in EntryPoint');
  }
}

main().catch(console.error);
