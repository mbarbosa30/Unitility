import { createWalletClient, http, parseEther, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const NEW_PAYMASTER = '0x7901cd168DFeca790D74a72148E22Aaa4618C98b';

if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error('DEPLOYER_PRIVATE_KEY not set');
}

// Ensure private key has 0x prefix
const privateKey = DEPLOYER_PRIVATE_KEY.startsWith('0x') 
  ? DEPLOYER_PRIVATE_KEY 
  : `0x${DEPLOYER_PRIVATE_KEY}`;

const account = privateKeyToAccount(privateKey as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(RPC_URL),
}).extend(publicActions);

const ENTRYPOINT_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'depositTo',
  outputs: [],
  stateMutability: 'payable',
  type: 'function'
}] as const;

async function fundPaymaster() {
  console.log('💸 Funding New Paymaster with ETH');
  console.log('='.repeat(60));
  console.log(`Paymaster: ${NEW_PAYMASTER}`);
  console.log(`EntryPoint: ${ENTRYPOINT_ADDRESS}`);
  console.log(`Funding Account: ${account.address}\n`);

  // Check deployer balance
  const balance = await walletClient.getBalance({ address: account.address });
  console.log(`Deployer Balance: ${Number(balance) / 1e18} ETH\n`);

  const depositAmount = parseEther('0.002'); // 0.002 ETH (20x more than required minimum of 0.000101)
  
  if (balance < depositAmount) {
    throw new Error(`Insufficient balance! Need ${Number(depositAmount) / 1e18} ETH, have ${Number(balance) / 1e18} ETH`);
  }

  try {
    console.log(`💰 Depositing ${Number(depositAmount) / 1e18} ETH to EntryPoint for paymaster...\n`);
    
    const hash = await walletClient.writeContract({
      address: ENTRYPOINT_ADDRESS as `0x${string}`,
      abi: ENTRYPOINT_ABI,
      functionName: 'depositTo',
      args: [NEW_PAYMASTER as `0x${string}`],
      value: depositAmount,
    });

    console.log(`📝 Transaction Hash: ${hash}`);
    console.log(`⏳ Waiting for confirmation...`);

    const receipt = await walletClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      console.log(`✅ Deposit successful!`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed}`);
      console.log(`\n🎉 Paymaster is now funded with 0.005 ETH!`);
      console.log(`   This should be sufficient for ~50 gasless transfers.`);
    } else {
      console.log(`❌ Transaction reverted`);
    }
  } catch (error: any) {
    console.error('❌ Error funding paymaster:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    throw error;
  }
}

fundPaymaster().catch(console.error);
