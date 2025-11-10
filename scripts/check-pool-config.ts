import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';

const POOL_ADDRESS = '0xa7c6359200fa376c233a454de456291357d5ed18';
const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

async function main() {
  console.log('📍 Checking PaymasterPool configuration...\n');
  
  // Read minTransfer
  const minTransfer = await publicClient.readContract({
    address: POOL_ADDRESS,
    abi: [{
      name: 'minTransfer',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'minTransfer',
  }) as bigint;
  
  // Read feePct
  const feePct = await publicClient.readContract({
    address: POOL_ADDRESS,
    abi: [{
      name: 'feePct',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'feePct',
  }) as bigint;
  
  // Read tokenAddress
  const tokenAddress = await publicClient.readContract({
    address: POOL_ADDRESS,
    abi: [{
      name: 'tokenAddress',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'address' }],
    }],
    functionName: 'tokenAddress',
  }) as string;
  
  console.log(`Contract: ${POOL_ADDRESS}`);
  console.log(`Token: ${tokenAddress}`);
  console.log(`Min Transfer: ${minTransfer.toString()} wei (${formatEther(minTransfer)} tokens)`);
  console.log(`Fee: ${feePct.toString()} basis points (${Number(feePct) / 100}%)`);
  console.log(`\nUser is trying to send: 30 tokens (30e18 wei)`);
  console.log(`Min transfer check: ${minTransfer <= BigInt('30000000000000000000') ? '✅ PASS' : '❌ FAIL'}`);
}

main().catch(console.error);
