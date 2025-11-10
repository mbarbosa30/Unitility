import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';

const POOL = '0xa7c6359200fa376c233a454de456291357d5ed18';
const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

async function main() {
  const balance = await client.getBalance({ address: POOL });
  console.log('PaymasterPool ETH balance:', formatEther(balance), 'ETH');
  console.log('Balance in wei:', balance.toString());
  console.log('\nEstimated gas cost for UserOp:');
  console.log('- Gas limit: ~600,000 (with account deployment)');
  console.log('- Gas price: ~0.1 gwei');
  console.log('- Cost: ~0.00006 ETH');
  console.log('\nStatus:', balance > BigInt('60000000000000') ? '✅ Sufficient' : '❌ Insufficient');
}

main();
