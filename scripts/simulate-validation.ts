/**
 * Test script to simulate EntryPoint validation and capture exact revert reason
 */
import { createPublicClient, http, parseEther, encodeFunctionData, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { base } from 'viem/chains';
import type { Hex } from 'viem';

const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const SMART_ACCOUNT = '0xe7C0dad97500ccD89fF9361DC5acB20013873bb0';
const EOA_OWNER = '0x216844eF94D95279c6d1631875F2dd93FbBdfB61';
const PAYMASTER_POOL = '0xcdd156edc19d78a7be19e6afa901960d55291374';
const TALENT_TOKEN = '0x9a33406165f562e16c3abd82fd1185482e01b49a';
const RECIPIENT = '0x1116e33f241a3ff3d05276e8b0c895361aa669b3';
const AMOUNT = parseEther('20');
const FEE_PERCENTAGE = 300; // 3%

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

// ABIs
const ERC20_TRANSFER_FROM_ABI = [
  {
    name: 'transferFrom',
    type: 'function',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const SIMPLE_ACCOUNT_EXECUTE_BATCH_ABI = [
  {
    name: 'executeBatch',
    type: 'function',
    inputs: [
      { name: 'dest', type: 'address[]' },
      { name: 'func', type: 'bytes[]' },
    ],
    outputs: [],
  },
] as const;

const ENTRY_POINT_ABI = [
  {
    name: 'simulateValidation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'userOp',
        type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'callGasLimit', type: 'uint256' },
          { name: 'verificationGasLimit', type: 'uint256' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'maxFeePerGas', type: 'uint256' },
          { name: 'maxPriorityFeePerGas', type: 'uint256' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const;

async function main() {
  console.log('🧪 Testing EntryPoint.simulateValidation()');
  console.log('==========================================\n');

  // Step 1: Calculate fee
  const tokenFee = (AMOUNT * BigInt(FEE_PERCENTAGE)) / BigInt(10000);
  console.log(`💰 Amount: ${AMOUNT.toString()} wei`);
  console.log(`💸 Fee (3%): ${tokenFee.toString()} wei\n`);

  // Step 2: Encode transferFrom calls
  const transferToRecipient = encodeFunctionData({
    abi: ERC20_TRANSFER_FROM_ABI,
    functionName: 'transferFrom',
    args: [EOA_OWNER as Hex, RECIPIENT as Hex, AMOUNT],
  });

  const transferFeeToPaymaster = encodeFunctionData({
    abi: ERC20_TRANSFER_FROM_ABI,
    functionName: 'transferFrom',
    args: [EOA_OWNER as Hex, PAYMASTER_POOL as Hex, tokenFee],
  });

  // Step 3: Encode executeBatch
  const executeBatchCallData = encodeFunctionData({
    abi: SIMPLE_ACCOUNT_EXECUTE_BATCH_ABI,
    functionName: 'executeBatch',
    args: [
      [TALENT_TOKEN as Hex, TALENT_TOKEN as Hex],
      [transferToRecipient, transferFeeToPaymaster],
    ],
  });

  console.log('📝 CallData structure:');
  console.log(`   executeBatch selector: ${executeBatchCallData.slice(0, 10)}`);
  console.log(`   Total length: ${executeBatchCallData.length} chars\n`);

  // Step 4: Build UserOp
  const userOp = {
    sender: SMART_ACCOUNT as Hex,
    nonce: 0n,
    initCode: '0x' as Hex,
    callData: executeBatchCallData,
    callGasLimit: 250000n,
    verificationGasLimit: 300000n,
    preVerificationGas: 60000n,
    maxFeePerGas: parseEther('0.1', 'gwei'),
    maxPriorityFeePerGas: parseEther('0.001', 'gwei'),
    paymasterAndData: PAYMASTER_POOL as Hex, // Just address for now
    signature: '0x' as Hex, // Dummy signature for simulation
  };

  console.log('📦 UserOperation:');
  console.log(`   sender: ${userOp.sender}`);
  console.log(`   nonce: ${userOp.nonce}`);
  console.log(`   callGasLimit: ${userOp.callGasLimit}`);
  console.log(`   verificationGasLimit: ${userOp.verificationGasLimit}`);
  console.log(`   paymasterAndData: ${userOp.paymasterAndData}\n`);

  // Step 5: Simulate validation
  try {
    console.log('⏳ Calling EntryPoint.simulateValidation()...\n');
    
    await publicClient.simulateContract({
      address: ENTRY_POINT as Hex,
      abi: ENTRY_POINT_ABI,
      functionName: 'simulateValidation',
      args: [userOp],
    });

    console.log('✅ Simulation succeeded! No revert.');
  } catch (error: any) {
    console.error('❌ Simulation FAILED with revert:\n');
    
    if (error.cause?.data) {
      console.error('Raw error data:', error.cause.data);
    }
    
    if (error.message) {
      console.error('Error message:', error.message);
    }
    
    if (error.shortMessage) {
      console.error('Short message:', error.shortMessage);
    }
    
    // Try to decode the revert reason
    if (error.cause?.reason) {
      console.error('\n📌 REVERT REASON:', error.cause.reason);
    }
    
    console.error('\n📋 Full error:');
    console.error(JSON.stringify(error, null, 2));
  }
}

main().catch(console.error);
