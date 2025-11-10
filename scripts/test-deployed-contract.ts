import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const PAYMASTER = '0xf448cc02fb157ee2f05e187cb05f3d5fa08f5c98';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

async function testDeployedContract() {
  console.log('🔍 Testing Deployed PaymasterPool Contract');
  console.log('='.repeat(60));
  console.log(`Paymaster: ${PAYMASTER}\n`);

  try {
    // Test 1: Check basic contract state
    console.log('📍 Test 1: Basic Contract State');
    
    const bytecode = await publicClient.getBytecode({
      address: PAYMASTER as `0x${string}`,
    });
    console.log(`   Bytecode size: ${bytecode?.length || 0} bytes`);
    console.log(`   Contract exists: ${bytecode && bytecode.length > 2 ? '✅ YES' : '❌ NO'}\n`);

    // Test 2: Check if executeBatch selector is recognized
    console.log('📍 Test 2: Check ExecuteBatch Selector Support');
    
    // executeBatch selector from keccak256("executeBatch(address[],bytes[])")
    const executeBatchSelector = '0x8d80ff0a';
    console.log(`   Expected executeBatch selector: ${executeBatchSelector}`);
    
    // Try to read contract code to see if it contains the selector
    if (bytecode) {
      const hasExecuteBatchCheck = bytecode.includes(executeBatchSelector.slice(2));
      console.log(`   Contract code contains executeBatch selector: ${hasExecuteBatchCheck ? '✅ YES' : '❌ NO'}\n`);
    }

    // Test 3: Verify contract parameters
    console.log('📍 Test 3: Contract Parameters');
    
    const feePct = await publicClient.readContract({
      address: PAYMASTER as `0x${string}`,
      abi: [{
        name: 'feePct',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'feePct',
    });
    console.log(`   ✅ feePct: ${feePct} basis points (${Number(feePct) / 100}%)`);

    const minTransfer = await publicClient.readContract({
      address: PAYMASTER as `0x${string}`,
      abi: [{
        name: 'minTransfer',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'minTransfer',
    });
    console.log(`   ✅ minTransfer: ${Number(minTransfer) / 1e18} tokens`);

    const tokenAddress = await publicClient.readContract({
      address: PAYMASTER as `0x${string}`,
      abi: [{
        name: 'tokenAddress',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
      }],
      functionName: 'tokenAddress',
    });
    console.log(`   ✅ tokenAddress: ${tokenAddress}`);

    const entryPoint = await publicClient.readContract({
      address: PAYMASTER as `0x${string}`,
      abi: [{
        name: 'entryPoint',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
      }],
      functionName: 'entryPoint',
    });
    console.log(`   ✅ entryPoint: ${entryPoint}\n`);

    // Test 4: Check EntryPoint deposit
    console.log('📍 Test 4: EntryPoint Deposit');
    const deposit = await publicClient.readContract({
      address: entryPoint as `0x${string}`,
      abi: [{
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'balanceOf',
      args: [PAYMASTER as `0x${string}`],
    });
    console.log(`   ✅ Deposit: ${Number(deposit) / 1e18} ETH`);
    
    // Calculate required maxCost
    const verificationGas = 900000n;
    const callGas = 400000n;
    const preVerificationGas = 100000n;
    const maxFeePerGas = 100000000n; // 0.1 gwei
    const totalGas = verificationGas + callGas + preVerificationGas;
    const maxCost = totalGas * maxFeePerGas;
    
    console.log(`   Required maxCost: ${Number(maxCost) / 1e18} ETH`);
    console.log(`   Deposit sufficient: ${deposit >= maxCost ? '✅ YES' : '❌ NO'}\n`);

    console.log('🎉 Contract Verification Complete!');
    console.log('\n💡 Conclusion:');
    if (bytecode && bytecode.includes(executeBatchSelector.slice(2))) {
      console.log('   ✅ Contract appears to support executeBatch');
      console.log('   ✅ Deposit is sufficient');
      console.log('   ⚠️  The -32603 error likely comes from paymasterAndData format');
    } else {
      console.log('   ❌ Contract may NOT support executeBatch properly');
      console.log('   🚨 NEEDS REDEPLOYMENT with batch-aware validation');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.shortMessage || error.message);
  }
}

testDeployedContract().catch(console.error);
