import { createPublicClient, http, keccak256 } from 'viem';
import { base } from 'viem/chains';
import fs from 'fs';

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
});

const PAYMASTER = '0x66dc832363f1eb1693cacef3a6db0c63bdf6ab0e';

async function verifyBytecode() {
  const artifact = JSON.parse(fs.readFileSync('artifacts-verified/PaymasterPool.json', 'utf-8'));

  const onChainBytecode = await publicClient.getBytecode({ address: PAYMASTER as `0x${string}` });
  const onChainHash = keccak256(onChainBytecode!);

  console.log('🔍 Bytecode Verification');
  console.log('='.repeat(60));
  console.log('Expected runtime hash:', artifact.runtimeHash);
  console.log('On-chain hash:        ', onChainHash);
  console.log('');
  console.log('Match:', onChainHash === artifact.runtimeHash ? '✅ YES - Correct bytecode deployed!' : '❌ NO - Wrong bytecode deployed!');
  console.log('');
  console.log('Deployed bytecode size:', onChainBytecode!.length, 'chars');
  console.log('Expected bytecode size:', artifact.deployedBytecode.length, 'chars\n');

  if (onChainHash === artifact.runtimeHash) {
    console.log('💡 Conclusion:');
    console.log('   ✅ The deployed contract has the correct batch-aware validation code');
    console.log('   ⚠️  The -32603 error must be coming from a different validation failure');
    console.log('   🔧 Next: Debug the actual validation logic (paymasterAndData format, gas limits, etc.)\n');
  } else {
    console.log('💡 Conclusion:');
    console.log('   ❌ The deployed contract has WRONG bytecode');
    console.log('   🚨 Need to redeploy with correct artifact');
    console.log('   🔧 Next: Deploy using artifacts-verified/PaymasterPool.json\n');
  }
}

verifyBytecode().catch(console.error);
