import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const PAYMASTER_POOL = '0xf2734b01060c0c4df14202f4433d68e97d29cad3';
const TALENT_TOKEN = '0x9a33406165f562e16c3abd82fd1185482e01b49a';
const EOA = '0x216844eF94D95279c6d1631875F2dd93FbBdfB61';
const SMART_ACCOUNT = '0xe7C0dad97500ccD89fF9361DC5acB20013873bb0';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

async function diagnose() {
  console.log('🔍 Diagnosing Paymaster Configuration');
  console.log('=====================================\n');
  
  // Check paymaster balance
  const paymasterBalance = await publicClient.readContract({
    address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [PAYMASTER_POOL as `0x${string}`],
  });
  console.log(`✓ Paymaster EntryPoint balance: ${(Number(paymasterBalance) / 1e18).toFixed(6)} ETH`);
  
  // Check EOA token balance
  const eoaBalance = await publicClient.readContract({
    address: TALENT_TOKEN as `0x${string}`,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [EOA as `0x${string}`],
  });
  console.log(`✓ EOA TALENT balance: ${(Number(eoaBalance) / 1e18).toFixed(2)} TALENT`);
  
  // Check EOA allowance to smart account
  const allowance = await publicClient.readContract({
    address: TALENT_TOKEN as `0x${string}`,
    abi: parseAbi(['function allowance(address,address) view returns (uint256)']),
    functionName: 'allowance',
    args: [EOA as `0x${string}`, SMART_ACCOUNT as `0x${string}`],
  });
  console.log(`✓ EOA allowance to Smart Account: ${(Number(allowance) / 1e18).toFixed(2)} TALENT`);
  
  // Check paymaster fee and min transfer
  const feePct = await publicClient.readContract({
    address: PAYMASTER_POOL as `0x${string}`,
    abi: parseAbi(['function feePct() view returns (uint256)']),
    functionName: 'feePct',
  });
  console.log(`✓ Paymaster fee: ${Number(feePct) / 100}%`);
  
  const minTransfer = await publicClient.readContract({
    address: PAYMASTER_POOL as `0x${string}`,
    abi: parseAbi(['function minTransfer() view returns (uint256)']),
    functionName: 'minTransfer',
  });
  console.log(`✓ Minimum transfer: ${(Number(minTransfer) / 1e18).toFixed(2)} TALENT`);
  
  // Check smart account owner
  try {
    const owner = await publicClient.readContract({
      address: SMART_ACCOUNT as `0x${string}`,
      abi: parseAbi(['function owner() view returns (address)']),
      functionName: 'owner',
    });
    console.log(`✓ Smart Account owner: ${owner}`);
    console.log(`  Expected EOA: ${EOA}`);
    console.log(`  Match: ${owner.toLowerCase() === EOA.toLowerCase() ? '✓' : '✗'}`);
  } catch (error: any) {
    console.log(`✗ Failed to get Smart Account owner: ${error.message}`);
  }
  
  console.log('\n📋 Summary:');
  console.log('  - Paymaster has sufficient ETH for gas sponsorship');
  console.log('  - EOA has sufficient TALENT tokens');
  console.log('  - EOA has approved Smart Account to spend tokens');
  console.log(`  - Fee structure: ${Number(feePct) / 100}% with ${(Number(minTransfer) / 1e18).toFixed(2)} TALENT minimum`);
  
  console.log('\n🔧 If validation still fails, the issue is likely in the contract logic.');
  console.log('   Consider adding console.log statements to the Solidity contract to debug.');
}

diagnose().catch(console.error);
