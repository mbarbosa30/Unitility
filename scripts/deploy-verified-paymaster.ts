import fs from 'fs';
import { createWalletClient, createPublicClient, http, parseEther, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const TOKEN_ADDRESS = '0x9a33406165f562E16C3abD82fd1185482E01b49a'; // TALENT
const FEE_PCT = 300; // 3%
const MIN_TRANSFER = parseEther('5'); // 5 TALENT

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

async function deployVerifiedPaymaster() {
  console.log('🚀 Deploying VERIFIED PaymasterPool Contract');
  console.log('='.repeat(60));

  // Load verified artifact
  const artifact = JSON.parse(fs.readFileSync('artifacts-verified/PaymasterPool.json', 'utf-8'));
  const { abi, bytecode, runtimeHash } = artifact;

  console.log('📦 Using verified artifact:');
  console.log(`   Expected runtime hash: ${runtimeHash}`);
  console.log(`   Bytecode size: ${bytecode.length} chars\n`);

  console.log('📝 Deployment parameters:');
  console.log(`   Deployer: ${account.address}`);
  console.log(`   Token: ${TOKEN_ADDRESS} (TALENT)`);
  console.log(`   Fee: ${FEE_PCT} basis points (${FEE_PCT / 100}%)`);
  console.log(`   Min Transfer: ${Number(MIN_TRANSFER) / 1e18} tokens\n`);

  try {
    // Deploy contract
    console.log('🚀 Deploying to Base mainnet...');
    const hash = await walletClient.deployContract({
      abi,
      bytecode: bytecode as `0x${string}`,
      args: [ENTRY_POINT, TOKEN_ADDRESS, FEE_PCT, MIN_TRANSFER, account.address],
    });

    console.log(`Transaction hash: ${hash}`);
    console.log('⏳ Waiting for confirmation...\n');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status !== 'success') {
      throw new Error('Deployment transaction failed');
    }

    const contractAddress = receipt.contractAddress;
    if (!contractAddress) {
      throw new Error('Contract address not found in receipt');
    }

    console.log(`✅ Contract deployed at: ${contractAddress}`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}\n`);

    // Verify bytecode matches
    console.log('🔍 Verifying deployed bytecode...');
    const onChainBytecode = await publicClient.getBytecode({ address: contractAddress });
    const onChainHash = keccak256(onChainBytecode!);

    console.log(`   Expected: ${runtimeHash}`);
    console.log(`   On-chain: ${onChainHash}`);
    console.log(`   Match: ${onChainHash === runtimeHash ? '✅ YES' : '❌ NO'}\n`);

    if (onChainHash !== runtimeHash) {
      throw new Error('Deployed bytecode does not match expected hash!');
    }

    // Fund with 0.001 ETH
    console.log('💰 Funding PaymasterPool via EntryPoint...');
    const depositAmount = parseEther('0.001');
    
    const depositHash = await walletClient.writeContract({
      address: ENTRY_POINT as `0x${string}`,
      abi: [{
        name: 'depositTo',
        type: 'function',
        stateMutability: 'payable',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [],
      }],
      functionName: 'depositTo',
      args: [contractAddress],
      value: depositAmount,
    });

    console.log(`Deposit transaction: ${depositHash}`);
    console.log('⏳ Waiting for confirmation...\n');

    const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
    if (depositReceipt.status !== 'success') {
      throw new Error('Deposit transaction failed');
    }

    // Verify deposit
    const finalDeposit = await publicClient.readContract({
      address: ENTRY_POINT as `0x${string}`,
      abi: [{
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'balanceOf',
      args: [contractAddress],
    });

    console.log(`✅ Funded ${Number(depositAmount) / 1e18} ETH`);
    console.log(`Final deposit: ${Number(finalDeposit) / 1e18} ETH\n`);

    console.log('🎉 Deployment Complete!');
    console.log('='.repeat(60));
    console.log(`PaymasterPool: ${contractAddress}`);
    console.log(`Deployment TX: ${hash}`);
    console.log(`Funding TX: ${depositHash}`);
    console.log(`EntryPoint Deposit: ${Number(finalDeposit) / 1e18} ETH`);
    console.log(`Bytecode Verified: ✅ YES`);
    console.log('');
    console.log('📋 Next Steps:');
    console.log(`1. Update database pool with address: ${contractAddress}`);
    console.log(`2. Delete old pool: 0x66dc832363f1eb1693cacef3a6db0c63bdf6ab0e`);
    console.log(`3. Restart event indexer`);
    console.log(`4. Test gasless TALENT transfer\n`);

    return contractAddress;

  } catch (error: any) {
    console.error('❌ Deployment failed:', error.shortMessage || error.message);
    throw error;
  }
}

deployVerifiedPaymaster().catch(error => {
  console.error(error);
  process.exit(1);
});
