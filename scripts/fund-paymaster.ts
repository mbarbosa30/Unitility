import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const PAYMASTER = '0x66dc832363f1eb1693cacef3a6db0c63bdf6ab0e';

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

async function fundPaymaster() {
  console.log('💰 Adding Funds to PaymasterPool');
  console.log('='.repeat(60));
  console.log(`Paymaster: ${PAYMASTER}`);
  console.log(`Funder: ${account.address}\n`);

  try {
    // Check current deposit
    const currentDeposit = await publicClient.readContract({
      address: ENTRY_POINT as `0x${string}`,
      abi: [{
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'balanceOf',
      args: [PAYMASTER as `0x${string}`],
    });

    console.log(`Current deposit: ${Number(currentDeposit) / 1e18} ETH`);

    // Check deployer balance
    const deployerBalance = await publicClient.getBalance({
      address: account.address,
    });

    console.log(`Deployer balance: ${Number(deployerBalance) / 1e18} ETH\n`);

    // Add 0.002 ETH more (total will be ~0.0023 ETH)
    const additionalFunding = parseEther('0.0002');
    
    console.log(`Adding ${Number(additionalFunding) / 1e18} ETH...\n`);

    const hash = await walletClient.writeContract({
      address: ENTRY_POINT as `0x${string}`,
      abi: [{
        name: 'depositTo',
        type: 'function',
        stateMutability: 'payable',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [],
      }],
      functionName: 'depositTo',
      args: [PAYMASTER as `0x${string}`],
      value: additionalFunding,
    });

    console.log(`Transaction hash: ${hash}`);
    console.log('⏳ Waiting for confirmation...\n');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status !== 'success') {
      throw new Error('Funding transaction failed');
    }

    // Verify new deposit
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
      args: [PAYMASTER as `0x${string}`],
    });

    console.log(`✅ Funding complete!`);
    console.log(`Final deposit: ${Number(finalDeposit) / 1e18} ETH`);
    console.log(`Added: ${Number(additionalFunding) / 1e18} ETH\n`);

  } catch (error: any) {
    console.error('❌ Funding failed:', error.shortMessage || error.message);
    throw error;
  }
}

fundPaymaster().catch(error => {
  console.error(error);
  process.exit(1);
});
