import { createWalletClient, createPublicClient, http, parseEther, encodeAbiParameters, parseAbiParameters, concat } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { execSync } from 'child_process';
import fs from 'fs';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error('DEPLOYER_PRIVATE_KEY environment variable is required');
}

const formattedKey = DEPLOYER_PRIVATE_KEY.startsWith('0x') 
  ? DEPLOYER_PRIVATE_KEY 
  : `0x${DEPLOYER_PRIVATE_KEY}`;

const account = privateKeyToAccount(formattedKey as `0x${string}`);

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(RPC_URL),
});

async function deployTestPaymaster() {
  console.log('🚀 Deploying TestPaymaster for debugging');
  console.log('='.repeat(60), '\n');
  
  // Compile contract
  console.log('📝 Compiling TestPaymaster.sol...');
  execSync('solc --optimize --optimize-runs 200 --bin --abi contracts/TestPaymaster.sol -o build/ --overwrite', { stdio: 'inherit' });
  
  // Read compiled output
  const bytecode = '0x' + fs.readFileSync('build/TestPaymaster.bin', 'utf-8').trim();
  console.log('   Bytecode size:', bytecode.length, 'chars\n');
  
  // Encode constructor (just entryPoint address)
  const constructorArgs = encodeAbiParameters(
    parseAbiParameters('address'),
    [ENTRY_POINT as `0x${string}`]
  );
  
  const deploymentData = concat([bytecode as `0x${string}`, constructorArgs]);
  
  console.log('📝 Deployment parameters:');
  console.log(`   Deployer: ${account.address}`);
  console.log(`   EntryPoint: ${ENTRY_POINT}\n`);
  
  // Deploy
  console.log('🚀 Sending deployment transaction...');
  const hash = await walletClient.sendTransaction({
    to: null,
    data: deploymentData,
    gas: 1000000n,
  });
  
  console.log(`Transaction hash: ${hash}`);
  console.log('⏳ Waiting for confirmation...\n');
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (!receipt.contractAddress) {
    throw new Error('Deployment failed - no contract address');
  }
  
  console.log('✅ TestPaymaster deployed at:', receipt.contractAddress);
  console.log('Block:', receipt.blockNumber.toString());
  console.log('Gas used:', receipt.gasUsed.toString(), '\n');
  
  // Fund paymaster
  console.log('💰 Funding paymaster with 0.005 ETH...');
  const fundHash = await walletClient.writeContract({
    address: receipt.contractAddress,
    abi: [{
      name: 'deposit',
      type: 'function',
      stateMutability: 'payable',
      inputs: [],
      outputs: [],
    }],
    functionName: 'deposit',
    value: parseEther('0.005'),
  });
  
  console.log('Fund TX:', fundHash);
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  
  console.log('\n🎉 Done!');
  console.log('Use this address in SendTokenModal.tsx:');
  console.log(receipt.contractAddress);
  
  return receipt.contractAddress;
}

deployTestPaymaster()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
