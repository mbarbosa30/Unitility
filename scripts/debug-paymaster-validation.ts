import { createPublicClient, http, parseEther, encodeAbiParameters, concat, pad, toHex } from 'viem';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const NEW_PAYMASTER = '0x7901cd168DFeca790D74a72148E22Aaa4618C98b';
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

async function debugPaymasterValidation() {
  console.log('🔍 Debugging PaymasterPool Validation');
  console.log('='.repeat(60));
  console.log(`Paymaster: ${NEW_PAYMASTER}`);
  console.log(`EntryPoint: ${ENTRY_POINT}\n`);

  try {
    // Check basic contract info
    console.log('📍 Contract Info:');
    
    const feePct = await publicClient.readContract({
      address: NEW_PAYMASTER as `0x${string}`,
      abi: [{
        name: 'feePct',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'feePct',
    });
    console.log(`   Fee Pct: ${feePct} basis points (${Number(feePct) / 100}%)`);

    const tokenAddress = await publicClient.readContract({
      address: NEW_PAYMASTER as `0x${string}`,
      abi: [{
        name: 'token',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
      }],
      functionName: 'token',
    });
    console.log(`   Token: ${tokenAddress}`);

    const minTransfer = await publicClient.readContract({
      address: NEW_PAYMASTER as `0x${string}`,
      abi: [{
        name: 'minTransfer',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'minTransfer',
    });
    console.log(`   Min Transfer: ${Number(minTransfer) / 1e18} tokens\n`);

    // Check EntryPoint deposit
    const entryPointDeposit = await publicClient.readContract({
      address: ENTRY_POINT as `0x${string}`,
      abi: [{
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'balanceOf',
      args: [NEW_PAYMASTER as `0x${string}`],
    });
    console.log(`📍 EntryPoint Deposit: ${Number(entryPointDeposit) / 1e18} ETH\n`);

    // Try to read unclaimedFees
    console.log('📍 Testing unclaimedFees():');
    try {
      const unclaimed = await publicClient.readContract({
        address: NEW_PAYMASTER as `0x${string}`,
        abi: [{
          name: 'unclaimedFees',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'unclaimedFees',
      });
      console.log(`   Unclaimed Fees: ${Number(unclaimed) / 1e18} tokens`);
    } catch (error: any) {
      console.log(`   ❌ unclaimedFees() reverted: ${error.shortMessage || error.message}`);
      console.log(`   This suggests the contract might not have this function or it's failing`);
    }

    // Check bytecode to verify contract deployment
    console.log('\n📍 Contract Bytecode:');
    const bytecode = await publicClient.getBytecode({
      address: NEW_PAYMASTER as `0x${string}`,
    });
    console.log(`   Bytecode length: ${bytecode?.length || 0} bytes`);
    console.log(`   Contract deployed: ${bytecode && bytecode.length > 2 ? '✅ YES' : '❌ NO'}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

debugPaymasterValidation().catch(console.error);
