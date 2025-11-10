import { createWalletClient, createPublicClient, http, parseEther, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import * as fs from 'fs';

// EntryPoint v0.7
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;

// User's wallet address (will own the smart account)
const OWNER_ADDRESS = '0x216844eF94D95279c6d1631875F2dd93FbBdfB61' as Address;

async function main() {
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerPrivateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not found');
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

  console.log('\n🚀 Deploying SimpleAccount with v0.7 EntryPoint');
  console.log('===============================================');
  console.log('Deployer:', account.address);
  console.log('Owner (user wallet):', OWNER_ADDRESS);
  console.log('EntryPoint v0.7:', ENTRY_POINT_V07);

  // Read compiled contracts
  const compiledOutput = JSON.parse(fs.readFileSync('compiled/output.json', 'utf8'));
  const contracts = compiledOutput.contracts;
  
  const factoryContract = contracts['contracts/SimpleAccountFactory.sol:SimpleAccountFactory'];
  const accountContract = contracts['contracts/SimpleAccount.sol:SimpleAccount'];

  if (!factoryContract || !accountContract) {
    throw new Error('Contracts not found in compiled output. Run: npx solc ...');
  }

  console.log('\n1️⃣  Deploying SimpleAccountFactory...');
  
  // Deploy factory - constructor takes entryPoint address
  const factoryBytecode = `0x${factoryContract.bin}` as Hex;
  const factoryAbi = JSON.parse(factoryContract.abi);
  
  // Encode constructor args (entryPoint address)
  const constructorArgs = ENTRY_POINT_V07.slice(2).padStart(64, '0');
  const deployData = `${factoryBytecode}${constructorArgs}` as Hex;

  const factoryTxHash = await walletClient.sendTransaction({
    data: deployData,
  });

  console.log('Factory deploy TX:', factoryTxHash);
  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryTxHash });
  const factoryAddress = factoryReceipt.contractAddress!;
  
  console.log('✅ Factory deployed:', factoryAddress);
  console.log('   Block:', factoryReceipt.blockNumber);

  // Calculate counterfactual account address
  console.log('\n2️⃣  Calculating smart account address...');
  const salt = 0n;
  
  const smartAccountAddress = await publicClient.readContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: 'getAddress',
    args: [OWNER_ADDRESS, salt],
  }) as Address;

  console.log('Smart account address:', smartAccountAddress);

  // Check if already deployed
  const code = await publicClient.getCode({ address: smartAccountAddress });
  
  if (code && code !== '0x') {
    console.log('✅ Account already deployed!');
  } else {
    console.log('Creating account...');
    const createTxHash = await walletClient.writeContract({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: 'createAccount',
      args: [OWNER_ADDRESS, salt],
    });

    console.log('Create account TX:', createTxHash);
    const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTxHash });
    console.log('✅ Account created! Block:', createReceipt.blockNumber);
  }

  // Verify deployment
  console.log('\n3️⃣  Verifying deployment...');
  
  const accountAbi = JSON.parse(accountContract.abi);
  
  const [accountEntryPoint, owner] = await Promise.all([
    publicClient.readContract({
      address: smartAccountAddress,
      abi: accountAbi,
      functionName: 'entryPoint',
    }) as Promise<Address>,
    publicClient.readContract({
      address: smartAccountAddress,
      abi: accountAbi,
      functionName: 'owner',
    }) as Promise<Address>,
  ]);

  console.log('  Smart Account:', smartAccountAddress);
  console.log('  Owner:', owner);
  console.log('  EntryPoint:', accountEntryPoint);
  
  const isV07 = accountEntryPoint.toLowerCase() === ENTRY_POINT_V07.toLowerCase();
  console.log('  Is v0.7?', isV07 ? '✅ YES' : '❌ NO');

  if (!isV07) {
    throw new Error('EntryPoint mismatch! Deployment failed.');
  }

  // Fund account
  console.log('\n4️⃣  Funding account with 0.001 ETH...');
  const balance = await publicClient.getBalance({ address: smartAccountAddress });
  
  if (balance < parseEther('0.001')) {
    const fundTxHash = await walletClient.sendTransaction({
      to: smartAccountAddress,
      value: parseEther('0.001'),
    });

    console.log('Fund TX:', fundTxHash);
    await publicClient.waitForTransactionReceipt({ hash: fundTxHash });
    console.log('✅ Account funded!');
  } else {
    console.log('✅ Account already has funds:', balance.toString(), 'wei');
  }

  console.log('\n🎉 Deployment Complete!');
  console.log('===============================================');
  console.log('Factory:', factoryAddress);
  console.log('Smart Account:', smartAccountAddress);
  console.log('Owner:', owner);
  console.log('EntryPoint:', accountEntryPoint);
  console.log('\n📝 NEXT STEPS:');
  console.log('1. Update client/src/lib/simpleAccount.ts:');
  console.log(`   - SIMPLE_ACCOUNT_FACTORY = '${factoryAddress}'`);
  console.log(`   - SIMPLE_ACCOUNT_ADDRESS = '${smartAccountAddress}'`);
  console.log('2. In your wallet, approve this account to spend TALENT:');
  console.log(`   - Spender: ${smartAccountAddress}`);
  console.log('   - Amount: Max approval');
  console.log('3. Restart the app and test gasless transfer!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
