import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const FACTORY = '0x9406Cc6185a346906296840746125a0E44976454';
const EOA_OWNER = '0x216844eF94D95279c6d1631875F2dd93FbBdfB61'; // Your connected wallet
const SALT = 0n;
const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  console.error('❌ DEPLOYER_PRIVATE_KEY not set');
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

async function main() {
  console.log('🏭 Deploying SimpleAccount via Factory\n');
  console.log(`Owner: ${EOA_OWNER}`);
  console.log(`Salt: ${SALT.toString()}\n`);

  // First, check if account is already deployed
  const predictedAddress = await publicClient.readContract({
    address: FACTORY,
    abi: [{
      name: 'getAddress',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'address' }],
    }],
    functionName: 'getAddress',
    args: [EOA_OWNER, SALT],
  });

  console.log(`Predicted Address: ${predictedAddress}\n`);

  const bytecode = await publicClient.getBytecode({ address: predictedAddress as `0x${string}` });
  
  if (bytecode && bytecode !== '0x') {
    console.log('✅ Account already deployed!');
    console.log(`Account Address: ${predictedAddress}`);
    return;
  }

  console.log('⏳ Deploying account...\n');

  // Call factory.createAccount(owner, salt)
  const hash = await walletClient.writeContract({
    address: FACTORY,
    abi: [{
      name: 'createAccount',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt', type: 'uint256' },
      ],
      outputs: [{ name: 'ret', type: 'address' }],
    }],
    functionName: 'createAccount',
    args: [EOA_OWNER, SALT],
  });

  console.log(`📝 TX: ${hash}`);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log('✅ SimpleAccount deployed!');
    console.log(`📍 Address: ${predictedAddress}`);
    console.log(`🔗 BaseScan: https://basescan.org/tx/${hash}`);
    console.log('\n✨ Now try the gasless transfer again!');
  } else {
    console.error('❌ Deployment failed');
  }
}

main().catch(console.error);
