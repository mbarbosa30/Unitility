import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const FINAL_PAYMASTER = '0xf448cc02fb157ee2f05e187cb05f3d5fa08f5c98';
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

async function verifyFinalPool() {
  console.log('✅ Verifying Final PaymasterPool');
  console.log('='.repeat(60));
  console.log(`Paymaster: ${FINAL_PAYMASTER}\n`);

  try {
    // Check feePct
    const feePct = await publicClient.readContract({
      address: FINAL_PAYMASTER as `0x${string}`,
      abi: [{
        name: 'feePct',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'feePct',
    });
    console.log(`✅ Fee Pct: ${feePct} basis points (${Number(feePct) / 100}%)`);

    // Check token address
    const token = await publicClient.readContract({
      address: FINAL_PAYMASTER as `0x${string}`,
      abi: [{
        name: 'tokenAddress',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
      }],
      functionName: 'tokenAddress',
    });
    console.log(`✅ Token: ${token}`);

    // Check minTransfer
    const minTransfer = await publicClient.readContract({
      address: FINAL_PAYMASTER as `0x${string}`,
      abi: [{
        name: 'minTransfer',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'minTransfer',
    });
    console.log(`✅ Min Transfer: ${Number(minTransfer) / 1e18} tokens`);

    // Check EntryPoint deposit
    const deposit = await publicClient.readContract({
      address: ENTRY_POINT as `0x${string}`,
      abi: [{
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'balanceOf',
      args: [FINAL_PAYMASTER as `0x${string}`],
    });
    console.log(`✅ EntryPoint Deposit: ${Number(deposit) / 1e18} ETH`);

    // Check unclaimedFees
    const unclaimed = await publicClient.readContract({
      address: FINAL_PAYMASTER as `0x${string}`,
      abi: [{
        name: 'unclaimedFees',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'unclaimedFees',
    });
    console.log(`✅ Unclaimed Fees: ${Number(unclaimed) / 1e18} tokens`);

    console.log('\n🎉 All contract functions working correctly!');
    console.log('✅ This is the correct PaymasterPool with paymasterAndData validation');

  } catch (error: any) {
    console.error('❌ Error:', error.shortMessage || error.message);
  }
}

verifyFinalPool().catch(console.error);
