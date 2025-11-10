import { createWalletClient, createPublicClient, http, parseEther, type Address, type Hex, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// EntryPoint v0.7
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;

// Read compiled contracts
const simpleAccountArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../artifacts/contracts/SimpleAccount.sol/SimpleAccount.json'), 'utf8')
);

const factoryArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../artifacts/contracts/SimpleAccountFactory.sol/SimpleAccountFactory.json'), 'utf8')
);

async function main() {
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerPrivateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not found in environment');
  }

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

  console.log('\n🚀 Deploying SimpleAccountFactory with v0.7 EntryPoint');
  console.log('============================================================');
  console.log('Deployer address:', account.address);
  console.log('EntryPoint v0.7:', ENTRY_POINT_V07);

  // Deploy SimpleAccountFactory
  console.log('\n1️⃣  Deploying SimpleAccountFactory...');
  const factoryTxHash = await walletClient.deployContract({
    abi: factoryArtifact.abi,
    bytecode: factoryArtifact.bytecode as Hex,
    args: [ENTRY_POINT_V07],
  });

  console.log('Factory deploy TX:', factoryTxHash);
  console.log('Waiting for confirmation...');

  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryTxHash });
  const factoryAddress = factoryReceipt.contractAddress!;
  
  console.log('✅ Factory deployed at:', factoryAddress);
  console.log('   Block:', factoryReceipt.blockNumber);

  // Create account from factory
  console.log('\n2️⃣  Creating SimpleAccount from factory...');
  const salt = BigInt(0); // Use salt 0

  // Calculate counterfactual address
  const smartAccountAddress = await publicClient.readContract({
    address: factoryAddress,
    abi: factoryArtifact.abi,
    functionName: 'getAddress',
    args: [account.address, salt],
  }) as Address;

  console.log('Calculated smart account address:', smartAccountAddress);

  // Check if already deployed
  const code = await publicClient.getCode({ address: smartAccountAddress });
  
  if (code && code !== '0x') {
    console.log('✅ Account already exists!');
  } else {
    console.log('Deploying account...');
    const createAccountTxHash = await walletClient.writeContract({
      address: factoryAddress,
      abi: factoryArtifact.abi,
      functionName: 'createAccount',
      args: [account.address, salt],
    });

    console.log('Create account TX:', createAccountTxHash);
    const createAccountReceipt = await publicClient.waitForTransactionReceipt({ hash: createAccountTxHash });
    console.log('✅ Account deployed! Block:', createAccountReceipt.blockNumber);
  }

  // Verify deployment
  console.log('\n3️⃣  Verifying deployment...');
  
  const accountEntryPoint = await publicClient.readContract({
    address: smartAccountAddress,
    abi: simpleAccountArtifact.abi,
    functionName: 'entryPoint',
  }) as Address;

  const owner = await publicClient.readContract({
    address: smartAccountAddress,
    abi: simpleAccountArtifact.abi,
    functionName: 'owner',
  }) as Address;

  console.log('  Smart Account:', smartAccountAddress);
  console.log('  Owner:', owner);
  console.log('  EntryPoint:', accountEntryPoint);
  console.log('  Is v0.7?', accountEntryPoint.toLowerCase() === ENTRY_POINT_V07.toLowerCase() ? '✅ YES' : '❌ NO');

  // Fund account
  console.log('\n4️⃣  Funding account with 0.001 ETH...');
  const fundTxHash = await walletClient.sendTransaction({
    to: smartAccountAddress,
    value: parseEther('0.001'),
  });

  console.log('Fund TX:', fundTxHash);
  await publicClient.waitForTransactionReceipt({ hash: fundTxHash });
  
  const balance = await publicClient.getBalance({ address: smartAccountAddress });
  console.log('✅ Account funded! Balance:', balance.toString(), 'wei (0.001 ETH)');

  console.log('\n🎉 Done!');
  console.log('============================================================');
  console.log('Factory address:', factoryAddress);
  console.log('Smart Account address:', smartAccountAddress);
  console.log('EntryPoint (v0.7):', accountEntryPoint);
  console.log('Owner:', owner);
  console.log('\n⚠️  NEXT STEPS:');
  console.log('1. Update .env with:');
  console.log(`   VITE_SIMPLE_ACCOUNT_FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`   VITE_SIMPLE_ACCOUNT_ADDRESS=${smartAccountAddress}`);
  console.log('2. Approve this account to spend TALENT tokens from your EOA');
  console.log('3. Test gasless transfer!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
