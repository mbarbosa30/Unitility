import { createPublicClient, http, encodeAbiParameters, parseAbiParameters, concat, pad, toHex } from 'viem';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const PAYMASTER_POOL = '0xf2734b01060c0c4df14202f4433d68e97d29cad3';
const TALENT_TOKEN = '0x9a33406165f562e16c3abd82fd1185482e01b49a';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

// Build UserOp with correct parameters - we'll build callData ourselves
import { encodeFunctionData, parseAbiParameters as parseParams } from 'viem';

const ERC20_TRANSFER_FROM_ABI = [{
  inputs: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' }
  ],
  name: 'transferFrom',
  outputs: [{ name: '', type: 'bool' }],
  stateMutability: 'nonpayable',
  type: 'function'
}] as const;

const EXECUTE_BATCH_ABI = [{
  inputs: [
    { name: 'dest', type: 'address[]' },
    { name: 'func', type: 'bytes[]' }
  ],
  name: 'executeBatch',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function'
}] as const;

const eoaOwner = '0x216844eF94D95279c6d1631875F2dd93FbBdfB61';
const recipientAddr = '0x1116e33f241a3ff3d05276e8b0c895361aa669b3';
const amountToSend = 30000000000000000000n; // 30 TALENT
const feeToPaymaster = 900000000000000000n; // 0.9 TALENT

// Build the two transferFrom calls
const transferToRecipient = encodeFunctionData({
  abi: ERC20_TRANSFER_FROM_ABI,
  functionName: 'transferFrom',
  args: [eoaOwner as `0x${string}`, recipientAddr as `0x${string}`, amountToSend],
});

const transferFeeToPaymaster = encodeFunctionData({
  abi: ERC20_TRANSFER_FROM_ABI,
  functionName: 'transferFrom',
  args: [eoaOwner as `0x${string}`, PAYMASTER_POOL as `0x${string}`, feeToPaymaster],
});

// Build executeBatch callData
const callDataGenerated = encodeFunctionData({
  abi: EXECUTE_BATCH_ABI,
  functionName: 'executeBatch',
  args: [
    [TALENT_TOKEN as `0x${string}`, TALENT_TOKEN as `0x${string}`],
    [transferToRecipient, transferFeeToPaymaster]
  ],
});

const testUserOp = {
  sender: '0xe7C0dad97500ccD89fF9361DC5acB20013873bb0',
  nonce: 0n,
  initCode: '0x' as `0x${string}`,
  callData: callDataGenerated,
  callGasLimit: 250000n,
  verificationGasLimit: 300000n,
  preVerificationGas: 60000n,
  maxFeePerGas: 100000000n,
  maxPriorityFeePerGas: 1000000n,
  paymasterAndData: '0x' as `0x${string}`,
  signature: '0x71a9c7ccce47375662c5d6a6325695182389cbe1b3e59e656ceff7a42a8a5e6b40212373d4289de8d8fb01b7436aa7089c8f407a7b76daca0f84e3f3beb28e2f1b' as `0x${string}`,
};

// Build paymasterAndData - using actual parameters from latest send attempt
const postGas = concat([
  pad(toHex(60000n, { size: 16 }), { size: 16 }), // postVerificationGasLimit
  pad(toHex(150000n, { size: 16 }), { size: 16 }), // postOpGasLimit
]);

const context = encodeAbiParameters(
  parseAbiParameters('address to, uint256 amount, uint256 fee'),
  [recipientAddr as `0x${string}`, amountToSend, feeToPaymaster]
);

testUserOp.paymasterAndData = concat([
  PAYMASTER_POOL as `0x${string}`,
  postGas,
  context.slice(2) as `0x${string}`,
]);

console.log('🧪 Testing PaymasterPool Validation');
console.log('====================================\n');
console.log('UserOp Details:');
console.log(`  Sender: ${testUserOp.sender}`);
console.log(`  Nonce: ${testUserOp.nonce}`);
console.log(`  CallData length: ${testUserOp.callData.length} chars`);
console.log(`  PaymasterAndData: ${testUserOp.paymasterAndData}`);
console.log(`  PaymasterAndData length: ${testUserOp.paymasterAndData.length} chars (${(testUserOp.paymasterAndData.length - 2) / 2} bytes)\n`);

console.log('Packed components:');
console.log(`  Paymaster address: ${PAYMASTER_POOL} (20 bytes)`);
console.log(`  PostGas: ${postGas} (32 bytes)`);
console.log(`  Context: ${context} (${context.length} chars, ${(context.length - 2) / 2} bytes)\n`);

// Try to simulate validation
const EntryPointABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "sender", type: "address" },
          { internalType: "uint256", name: "nonce", type: "uint256" },
          { internalType: "bytes", name: "initCode", type: "bytes" },
          { internalType: "bytes", name: "callData", type: "bytes" },
          { internalType: "uint256", name: "callGasLimit", type: "uint256" },
          { internalType: "uint256", name: "verificationGasLimit", type: "uint256" },
          { internalType: "uint256", name: "preVerificationGas", type: "uint256" },
          { internalType: "uint256", name: "maxFeePerGas", type: "uint256" },
          { internalType: "uint256", name: "maxPriorityFeePerGas", type: "uint256" },
          { internalType: "bytes", name: "paymasterAndData", type: "bytes" },
          { internalType: "bytes", name: "signature", type: "bytes" }
        ],
        internalType: "struct UserOperation",
        name: "userOp",
        type: "tuple"
      }
    ],
    name: "simulateValidation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
] as const;

async function testValidation() {
  try {
    console.log('⏳ Calling EntryPoint.simulateValidation()...\n');
    
    await publicClient.simulateContract({
      address: ENTRYPOINT_ADDRESS as `0x${string}`,
      abi: EntryPointABI,
      functionName: 'simulateValidation',
      args: [testUserOp],
    });
    
    console.log('✅ Validation succeeded!');
  } catch (error: any) {
    console.log('❌ Validation failed!\n');
    console.log('Error details:');
    console.log(`  Message: ${error.message}`);
    
    if (error.cause?.data) {
      console.log(`  Data: ${error.cause.data}`);
    }
    
    if (error.cause?.reason) {
      console.log(`  Reason: ${error.cause.reason}`);
    }
    
    // Try to get full error
    console.log('\nFull error object:');
    console.log(JSON.stringify(error, null, 2));
  }
}

testValidation().catch(console.error);
