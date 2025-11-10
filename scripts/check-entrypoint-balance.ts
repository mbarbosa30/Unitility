import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const NEW_PAYMASTER = '0x7901cd168DFeca790D74a72148E22Aaa4618C98b';
const OLD_PAYMASTER = '0xf2734b01060c0c4df14202f4433d68e97d29cad3';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const ENTRYPOINT_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}, {
  inputs: [{ name: 'account', type: 'address' }],
  name: 'getDepositInfo',
  outputs: [
    { name: 'deposit', type: 'uint256' },
    { name: 'staked', type: 'bool' },
    { name: 'stake', type: 'uint112' },
    { name: 'unstakeDelaySec', type: 'uint32' },
    { name: 'withdrawTime', type: 'uint48' }
  ],
  stateMutability: 'view',
  type: 'function'
}] as const;

async function checkBalances() {
  console.log('💰 Checking EntryPoint Deposit Balances');
  console.log('='.repeat(60));
  console.log(`EntryPoint: ${ENTRYPOINT_ADDRESS}\n`);

  try {
    // Check new paymaster
    console.log('📍 New Paymaster Pool:');
    console.log(`   Address: ${NEW_PAYMASTER}`);
    const newBalance = await publicClient.readContract({
      address: ENTRYPOINT_ADDRESS as `0x${string}`,
      abi: ENTRYPOINT_ABI,
      functionName: 'balanceOf',
      args: [NEW_PAYMASTER as `0x${string}`],
    });
    console.log(`   Deposit: ${formatEther(newBalance)} ETH (${newBalance} wei)`);
    
    const newDepositInfo = await publicClient.readContract({
      address: ENTRYPOINT_ADDRESS as `0x${string}`,
      abi: ENTRYPOINT_ABI,
      functionName: 'getDepositInfo',
      args: [NEW_PAYMASTER as `0x${string}`],
    });
    console.log(`   Staked: ${newDepositInfo[1]}`);
    console.log(`   Stake: ${formatEther(newDepositInfo[2])} ETH\n`);

    // Check old paymaster
    console.log('📍 Old Paymaster Pool:');
    console.log(`   Address: ${OLD_PAYMASTER}`);
    const oldBalance = await publicClient.readContract({
      address: ENTRYPOINT_ADDRESS as `0x${string}`,
      abi: ENTRYPOINT_ABI,
      functionName: 'balanceOf',
      args: [OLD_PAYMASTER as `0x${string}`],
    });
    console.log(`   Deposit: ${formatEther(oldBalance)} ETH (${oldBalance} wei)\n`);

    // Calculate required deposit based on gas limits
    const verificationGas = 700000n;
    const callGas = 250000n;
    const preVerificationGas = 60000n;
    const maxFeePerGas = 100000000n; // 0.1 gwei
    
    const totalGas = verificationGas + callGas + preVerificationGas;
    const maxCost = totalGas * maxFeePerGas;
    
    console.log('💡 Required Deposit Analysis:');
    console.log(`   Total Gas: ${totalGas} gas`);
    console.log(`   Max Fee Per Gas: ${formatEther(maxFeePerGas)} ETH`);
    console.log(`   Max Cost: ${formatEther(maxCost)} ETH (${maxCost} wei)`);
    console.log(`   Recommended: 0.005 ETH (5x buffer)\n`);
    
    console.log('⚖️  Comparison:');
    console.log(`   New Pool: ${formatEther(newBalance)} ETH`);
    console.log(`   Required: ${formatEther(maxCost)} ETH`);
    console.log(`   Status: ${newBalance >= maxCost ? '✅ SUFFICIENT' : '❌ INSUFFICIENT'}`);
    console.log(`   Deficit: ${newBalance < maxCost ? formatEther(maxCost - newBalance) + ' ETH' : 'None'}\n`);

    if (newBalance < maxCost) {
      const needed = maxCost - newBalance;
      const recommended = 5000000000000000n - newBalance; // 0.005 ETH
      console.log('🚨 ACTION REQUIRED:');
      console.log(`   Minimum to add: ${formatEther(needed)} ETH`);
      console.log(`   Recommended to add: ${formatEther(recommended)} ETH (for safety buffer)`);
    }

  } catch (error: any) {
    console.error('❌ Error checking balances:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

checkBalances().catch(console.error);
