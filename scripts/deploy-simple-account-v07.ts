import { createWalletClient, createPublicClient, http, parseEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// SimpleAccountFactory address on Base (v0.7 compatible)
const SIMPLE_ACCOUNT_FACTORY = '0x9406Cc6185a346906296840746125a0E44976454' as Address;

// EntryPoint v0.7
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;

async function main() {
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerPrivateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not found in environment');
  }

  // Ensure private key has 0x prefix
  const formattedPrivateKey = deployerPrivateKey.startsWith('0x') 
    ? deployerPrivateKey 
    : `0x${deployerPrivateKey}`;

  const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.VITE_BASE_RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.VITE_BASE_RPC_URL),
  });

  console.log('\n🚀 Deploying SimpleAccount with v0.7 EntryPoint');
  console.log('================================================');
  console.log('Owner address:', account.address);
  console.log('EntryPoint v0.7:', ENTRY_POINT_V07);
  console.log('SimpleAccountFactory:', SIMPLE_ACCOUNT_FACTORY);

  // Calculate counterfactual address
  const salt = BigInt(0); // Use salt 0 for first account
  
  const smartAccountAddress = await publicClient.readContract({
    address: SIMPLE_ACCOUNT_FACTORY,
    abi: [{
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt', type: 'uint256' },
      ],
      name: 'getAddress',
      outputs: [{ type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    }],
    functionName: 'getAddress',
    args: [account.address, salt],
  });

  console.log('\n📍 Calculated smart account address:', smartAccountAddress);

  // Check if already deployed
  const code = await publicClient.getCode({ address: smartAccountAddress });
  if (code && code !== '0x') {
    console.log('✅ Account already deployed!');
    
    // Verify EntryPoint
    const accountEntryPoint = await publicClient.readContract({
      address: smartAccountAddress,
      abi: [{
        inputs: [],
        name: 'entryPoint',
        outputs: [{ type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      }],
      functionName: 'entryPoint',
    });
    
    console.log('Account EntryPoint:', accountEntryPoint);
    console.log('Is v0.7?', accountEntryPoint.toLowerCase() === ENTRY_POINT_V07.toLowerCase());
    
    return;
  }

  console.log('\n🔨 Deploying new account...');

  // Deploy account via factory
  const txHash = await walletClient.writeContract({
    address: SIMPLE_ACCOUNT_FACTORY,
    abi: [{
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt', type: 'uint256' },
      ],
      name: 'createAccount',
      outputs: [{ type: 'address' }],
      stateMutability: 'nonpayable',
      type: 'function',
    }],
    functionName: 'createAccount',
    args: [account.address, salt],
  });

  console.log('Transaction hash:', txHash);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('✅ Account deployed! Block:', receipt.blockNumber);

  // Verify deployment
  const accountEntryPoint = await publicClient.readContract({
    address: smartAccountAddress,
    abi: [{
      inputs: [],
      name: 'entryPoint',
      outputs: [{ type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    }],
    functionName: 'entryPoint',
  });

  const owner = await publicClient.readContract({
    address: smartAccountAddress,
    abi: [{
      inputs: [],
      name: 'owner',
      outputs: [{ type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    }],
    functionName: 'owner',
  });

  console.log('\n✅ Deployment verified:');
  console.log('  Smart Account:', smartAccountAddress);
  console.log('  Owner:', owner);
  console.log('  EntryPoint:', accountEntryPoint);
  console.log('  Is v0.7?', accountEntryPoint.toLowerCase() === ENTRY_POINT_V07.toLowerCase());

  // Fund account
  console.log('\n💰 Funding account with 0.001 ETH...');
  const fundTxHash = await walletClient.sendTransaction({
    to: smartAccountAddress,
    value: parseEther('0.001'),
  });

  console.log('Fund TX:', fundTxHash);
  await publicClient.waitForTransactionReceipt({ hash: fundTxHash });
  
  const balance = await publicClient.getBalance({ address: smartAccountAddress });
  console.log('✅ Account funded! Balance:', balance.toString(), 'wei');

  console.log('\n🎉 Done!');
  console.log('================================================');
  console.log('New SimpleAccount address:', smartAccountAddress);
  console.log('EntryPoint (v0.7):', accountEntryPoint);
  console.log('Owner:', owner);
  console.log('\n⚠️  NEXT STEPS:');
  console.log('1. Update VITE_SIMPLE_ACCOUNT_ADDRESS in Replit Secrets');
  console.log('2. Approve this account to spend TALENT tokens from your EOA');
  console.log('3. Test gasless transfer!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
