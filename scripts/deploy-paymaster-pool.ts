import fs from 'fs';
import path from 'path';
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import solc from 'solc';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

// Contract constructor parameters
const TOKEN_ADDRESS = '0x9a33406165f562E16C3abD82fd1185482E01b49a'; // TALENT token
const FEE_PCT = 300; // 3% in basis points
const MIN_TRANSFER = parseEther('5'); // 5 TALENT minimum

if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error('DEPLOYER_PRIVATE_KEY environment variable is required');
}

// Ensure private key has 0x prefix
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

async function deployPaymasterPool() {
  console.log('🚀 Deploying PaymasterPool Contract');
  console.log('='.repeat(60));
  console.log(`Deployer: ${account.address}`);
  console.log(`Token: ${TOKEN_ADDRESS} (TALENT)`);
  console.log(`Fee: ${FEE_PCT} basis points (${FEE_PCT / 100}%)`);
  console.log(`Min Transfer: ${Number(MIN_TRANSFER) / 1e18} tokens\n`);

  try {
    // Step 1: Compile contract using solc
    console.log('📦 Compiling PaymasterPool contract with solc...');
    
    const contractPath = path.join(process.cwd(), 'contracts/PaymasterPool.sol');
    const source = fs.readFileSync(contractPath, 'utf-8');
    
    // Create import callback to resolve OpenZeppelin contracts
    function findImports(importPath: string) {
      try {
        if (importPath.startsWith('@openzeppelin/')) {
          const ozPath = path.join(process.cwd(), 'node_modules', importPath);
          const contents = fs.readFileSync(ozPath, 'utf-8');
          return { contents };
        }
        return { error: 'File not found' };
      } catch (e) {
        return { error: 'File not found' };
      }
    }
    
    const input = {
      language: 'Solidity',
      sources: {
        'PaymasterPool.sol': { content: source },
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        viaIR: true, // Enable IR-based optimizer to avoid stack too deep errors
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode'],
          },
        },
      },
    };
    
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    
    if (output.errors) {
      const errors = output.errors.filter((e: any) => e.severity === 'error');
      if (errors.length > 0) {
        console.error('Compilation errors:', errors);
        throw new Error('Contract compilation failed');
      }
    }
    
    const contract = output.contracts['PaymasterPool.sol']['PaymasterPool'];
    const abi = contract.abi;
    const bytecode = '0x' + contract.evm.bytecode.object;
    
    if (!bytecode || bytecode === '0x') {
      throw new Error('Bytecode is empty');
    }

    console.log(`✅ Contract compiled (bytecode: ${bytecode.length} chars)\n`);

    // Step 3: Deploy contract
    console.log('🚀 Deploying contract to Base mainnet...');
    const hash = await walletClient.deployContract({
      abi,
      bytecode: bytecode as `0x${string}`,
      args: [ENTRY_POINT, TOKEN_ADDRESS, FEE_PCT, MIN_TRANSFER, account.address], // entryPoint, token, feePct, minTransfer, sponsor
    });

    console.log(`Transaction hash: ${hash}`);
    console.log('⏳ Waiting for confirmation...\n');

    // Step 5: Wait for deployment
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

    // Step 6: Fund via EntryPoint depositTo
    console.log('💰 Funding PaymasterPool via EntryPoint...');
    const depositAmount = parseEther('0.0003'); // Reduced to match available deployer balance
    
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

    // Step 7: Verify deposit
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

    // Step 8: Output summary
    console.log('🎉 Deployment Complete!');
    console.log('='.repeat(60));
    console.log(`PaymasterPool: ${contractAddress}`);
    console.log(`Deployment TX: ${hash}`);
    console.log(`Funding TX: ${depositHash}`);
    console.log(`EntryPoint Deposit: ${Number(finalDeposit) / 1e18} ETH`);
    console.log('');
    console.log('📋 Next Steps:');
    console.log(`1. Update database pool with address: ${contractAddress}`);
    console.log(`2. Restart event indexer to track new pool`);
    console.log(`3. Test gasless token transfer\n`);

    return contractAddress;

  } catch (error: any) {
    console.error('❌ Deployment failed:', error.shortMessage || error.message);
    throw error;
  }
}

deployPaymasterPool().catch(error => {
  console.error(error);
  process.exit(1);
});
