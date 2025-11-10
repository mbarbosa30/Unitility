import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const FACTORY = '0x9406Cc6185a346906296840746125a0E44976454';
const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

async function main() {
  console.log('🏭 Checking SimpleAccountFactory deployment...\n');
  console.log(`Factory Address: ${FACTORY}\n`);
  
  const bytecode = await client.getBytecode({ address: FACTORY });
  
  if (bytecode && bytecode !== '0x') {
    console.log('✅ Factory IS deployed on Base mainnet');
    console.log(`Bytecode length: ${bytecode.length} characters`);
    console.log(`Bytecode preview: ${bytecode.substring(0, 100)}...`);
  } else {
    console.log('❌ Factory NOT deployed! This is the problem!');
    console.log('The SimpleAccountFactory address 0x9406...4454 is not deployed on Base.');
    console.log('\nYou need to:');
    console.log('1. Find the correct SimpleAccountFactory address for Base mainnet');
    console.log('2. Or deploy your own SimpleAccountFactory');
  }
}

main();
