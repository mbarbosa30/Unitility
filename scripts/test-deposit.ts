import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const poolAddress = '0xC9f9677Aa4F79ADE2c484f9ea445cA9bb1FDCE75' as `0x${string}`;

if (!privateKey) {
  console.error('Missing DEPLOYER_PRIVATE_KEY');
  process.exit(1);
}

const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as `0x${string}`);

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(RPC_URL),
});

async function testDeposit() {
  console.log('📊 Testing Deposit to Pool:', poolAddress);
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('💰 Wallet Balance:', (Number(balance) / 1e18).toFixed(6), 'ETH\n');
  
  if (balance < parseEther('0.0001')) {
    console.error('❌ Insufficient balance for test');
    return;
  }
  
  try {
    // Send 0.0001 ETH to pool (calls receive() which emits Deposited event)
    const hash = await walletClient.sendTransaction({
      to: poolAddress,
      value: parseEther('0.0001'),
    });
    
    console.log('✅ Deposit sent!');
    console.log('📝 Transaction:', hash);
    console.log('⏳ Waiting for confirmation...\n');
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Confirmed in block:', receipt.blockNumber.toString());
    console.log('🔍 Check indexer logs for Deposited event detection!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testDeposit();
