import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';

const SMART_ACCOUNT = '0xe7C0dad97500ccD89fF9361DC5acB20013873bb0';
const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

async function main() {
  const balance = await client.getBalance({ address: SMART_ACCOUNT });
  const bytecode = await client.getBytecode({ address: SMART_ACCOUNT });
  
  console.log('Smart Account Address:', SMART_ACCOUNT);
  console.log('ETH Balance:', formatEther(balance), 'ETH');
  console.log('Balance in wei:', balance.toString());
  console.log('Is Deployed:', bytecode && bytecode !== '0x' ? 'Yes' : 'No');
  console.log('\nRequired for prefund: ~0.00006 ETH (gas estimation)');
  console.log('Status:', balance > BigInt('60000000000000') ? '✅ Has ETH' : '❌ NO ETH - This causes AA23!');
}

main();
