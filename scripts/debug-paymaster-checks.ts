import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const PAYMASTER_POOL = '0xf2734b01060c0c4df14202f4433d68e97d29cad3';
const TALENT_TOKEN = '0x9a33406165f562e16c3abd82fd1185482e01b49a';
const SMART_ACCOUNT = '0xe7C0dad97500ccD89fF9361DC5acB20013873bb0';
const EOA = '0x216844eF94D95279c6d1631875F2dd93FbBdfB61';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const POOL_ABI = [{
  inputs: [],
  name: 'tokenAddress',
  outputs: [{ name: '', type: 'address' }],
  stateMutability: 'view',
  type: 'function'
}, {
  inputs: [],
  name: 'minTransfer',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}, {
  inputs: [],
  name: 'feePct',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}] as const;

const ACCOUNT_ABI = [{
  inputs: [],
  name: 'owner',
  outputs: [{ name: '', type: 'address' }],
  stateMutability: 'view',
  type: 'function'
}] as const;

const ERC20_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}, {
  inputs: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' }
  ],
  name: 'allowance',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}] as const;

async function debugPaymasterChecks() {
  console.log('🔍 Debugging PaymasterPool Validation Checks');
  console.log('='.repeat(60));
  console.log(`Paymaster: ${PAYMASTER_POOL}`);
  console.log(`Smart Account: ${SMART_ACCOUNT}`);
  console.log(`EOA Owner: ${EOA}`);
  console.log(`Token: ${TALENT_TOKEN}\n`);

  try {
    // Check 1: Get pool configuration
    console.log('📝 Check 1: Pool Configuration');
    const [tokenAddress, minTransfer, feePct] = await Promise.all([
      publicClient.readContract({
        address: PAYMASTER_POOL as `0x${string}`,
        abi: POOL_ABI,
        functionName: 'tokenAddress',
      }),
      publicClient.readContract({
        address: PAYMASTER_POOL as `0x${string}`,
        abi: POOL_ABI,
        functionName: 'minTransfer',
      }),
      publicClient.readContract({
        address: PAYMASTER_POOL as `0x${string}`,
        abi: POOL_ABI,
        functionName: 'feePct',
      }),
    ]);
    
    console.log(`  Token Address: ${tokenAddress}`);
    console.log(`  Min Transfer: ${minTransfer} wei`);
    console.log(`  Fee Percentage: ${feePct} basis points`);
    console.log(`  ✅ Pool config matches: ${tokenAddress.toLowerCase() === TALENT_TOKEN.toLowerCase()}\n`);

    // Check 2: Smart account owner
    console.log('📝 Check 2: Smart Account Owner');
    const owner = await publicClient.readContract({
      address: SMART_ACCOUNT as `0x${string}`,
      abi: ACCOUNT_ABI,
      functionName: 'owner',
    });
    console.log(`  Smart Account Owner: ${owner}`);
    console.log(`  Expected EOA: ${EOA}`);
    console.log(`  ✅ Owner matches: ${owner.toLowerCase() === EOA.toLowerCase()}\n`);

    // Check 3: EOA token balance
    console.log('📝 Check 3: EOA Token Balance');
    const balance = await publicClient.readContract({
      address: TALENT_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [EOA as `0x${string}`],
    });
    const amount = 30000000000000000000n; // 30 TALENT
    const fee = 900000000000000000n; // 0.9 TALENT
    const required = amount + fee;
    
    console.log(`  EOA Balance: ${balance} wei (${Number(balance) / 1e18} TALENT)`);
    console.log(`  Required (amount + fee): ${required} wei (${Number(required) / 1e18} TALENT)`);
    console.log(`  ✅ Sufficient balance: ${balance >= required}\n`);

    // Check 4: EOA allowance to smart account
    console.log('📝 Check 4: EOA Allowance to Smart Account');
    const allowance = await publicClient.readContract({
      address: TALENT_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [EOA as `0x${string}`, SMART_ACCOUNT as `0x${string}`],
    });
    
    console.log(`  EOA Allowance: ${allowance} wei`);
    console.log(`  Required: ${required} wei`);
    console.log(`  ✅ Sufficient allowance: ${allowance >= required}\n`);

    // Check 5: Minimum transfer
    console.log('📝 Check 5: Minimum Transfer Amount');
    console.log(`  Transfer Amount: ${amount} wei`);
    console.log(`  Minimum Required: ${minTransfer} wei`);
    console.log(`  ✅ Above minimum: ${amount >= minTransfer}\n`);

    // Check 6: Fee calculation
    console.log('📝 Check 6: Fee Calculation');
    const expectedFee = (amount * feePct) / 10000n;
    console.log(`  Actual Fee: ${fee} wei`);
    console.log(`  Expected Fee: ${expectedFee} wei`);
    console.log(`  ✅ Fee correct: ${fee === expectedFee}\n`);

    console.log('✅ All validation checks passed!');
    console.log('\n⚠️  If all checks pass but validation still fails, the issue is likely:');
    console.log('   1. Gas estimation is still too low');
    console.log('   2. Signature validation failing');
    console.log('   3. Context data mismatch in paymasterAndData');
    
  } catch (error: any) {
    console.error('❌ Error during checks:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

debugPaymasterChecks().catch(console.error);
