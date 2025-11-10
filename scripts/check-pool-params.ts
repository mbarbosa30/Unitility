import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

const POOL_ADDRESS = '0x072330F9EA3F97DB7C8265096e59E0C42334aAaf';
const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const PaymasterPoolABI = [
  {
    inputs: [],
    name: "feePct",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "minTransfer",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "tokenAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  console.log('🔍 Checking PaymasterPool parameters ON-CHAIN');
  console.log('==============================================\n');
  console.log(`📍 Pool: ${POOL_ADDRESS}\n`);

  const [feePct, minTransfer, tokenAddress] = await Promise.all([
    publicClient.readContract({
      address: POOL_ADDRESS as `0x${string}`,
      abi: PaymasterPoolABI,
      functionName: 'feePct',
    }),
    publicClient.readContract({
      address: POOL_ADDRESS as `0x${string}`,
      abi: PaymasterPoolABI,
      functionName: 'minTransfer',
    }),
    publicClient.readContract({
      address: POOL_ADDRESS as `0x${string}`,
      abi: PaymasterPoolABI,
      functionName: 'tokenAddress',
    }),
  ]);

  console.log(`📊 Contract Parameters:`);
  console.log(`   Token Address: ${tokenAddress}`);
  console.log(`   Fee (basis points): ${feePct.toString()} (${Number(feePct) / 100}%)`);
  console.log(`   Min Transfer (wei): ${minTransfer.toString()}`);
  console.log(`   Min Transfer (tokens): ${formatUnits(minTransfer, 18)} TALENT\n`);

  if (Number(feePct) !== 300) {
    console.log('❌ PROBLEM: Fee is not 300 basis points (3%)!');
  } else {
    console.log('✅ Fee is correct: 3%');
  }

  if (minTransfer.toString() !== '5000000000000000000') {
    console.log(`❌ PROBLEM: Min transfer is not 5 TALENT!`);
    console.log(`   Expected: 5000000000000000000 wei`);
    console.log(`   Actual: ${minTransfer.toString()} wei`);
  } else {
    console.log('✅ Min transfer is correct: 5 TALENT');
  }
}

main().catch(console.error);
