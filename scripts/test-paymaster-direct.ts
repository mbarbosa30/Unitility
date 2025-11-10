import { createPublicClient, http, encodeAbiParameters, parseAbiParameters, concat, pad, toHex, encodeFunctionData, keccak256 } from 'viem';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const PAYMASTER_POOL = '0xf2734b01060c0c4df14202f4433d68e97d29cad3';
const TALENT_TOKEN = '0x9a33406165f562e16c3abd82fd1185482e01b49a';
const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

// Build the exact UserOp from the latest attempt
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
const smartAccount = '0xe7C0dad97500ccD89fF9361DC5acB20013873bb0';
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

// Build paymasterAndData
const postGas = concat([
  pad(toHex(60000n, { size: 16 }), { size: 16 }), // postVerificationGasLimit
  pad(toHex(150000n, { size: 16 }), { size: 16 }), // postOpGasLimit
]);

const context = encodeAbiParameters(
  parseAbiParameters('address to, uint256 amount, uint256 fee'),
  [recipientAddr as `0x${string}`, amountToSend, feeToPaymaster]
);

const paymasterAndData = concat([
  PAYMASTER_POOL as `0x${string}`,
  postGas,
  context.slice(2) as `0x${string}`,
]) as `0x${string}`;

const testUserOp = {
  sender: smartAccount as `0x${string}`,
  nonce: 0n,
  initCode: '0x' as `0x${string}`,
  callData: callDataGenerated,
  callGasLimit: 250000n,
  verificationGasLimit: 300000n,
  preVerificationGas: 60000n,
  maxFeePerGas: 100000000n,
  maxPriorityFeePerGas: 1000000n,
  paymasterAndData: paymasterAndData,
  signature: '0x71a9c7ccce47375662c5d6a6325695182389cbe1b3e59e656ceff7a42a8a5e6b40212373d4289de8d8fb01b7436aa7089c8f407a7b76daca0f84e3f3beb28e2f1b' as `0x${string}`,
};

// Calculate userOpHash (v0.6 format)
function getUserOpHash(userOp: any, entryPoint: string, chainId: number): `0x${string}` {
  const packedData = encodeAbiParameters(
    parseAbiParameters('address, uint256, bytes32, bytes32, uint256, uint256, uint256, uint256, uint256, bytes32'),
    [
      userOp.sender,
      userOp.nonce,
      keccak256(userOp.initCode || '0x'),
      keccak256(userOp.callData),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      keccak256(userOp.paymasterAndData || '0x'),
    ]
  );
  
  const innerHash = keccak256(packedData);
  
  const outerPacked = encodeAbiParameters(
    parseAbiParameters('bytes32, address, uint256'),
    [innerHash, entryPoint as `0x${string}`, BigInt(chainId)]
  );
  
  return keccak256(outerPacked);
}

const userOpHash = getUserOpHash(testUserOp, ENTRYPOINT_ADDRESS, 8453);
const maxCost = testUserOp.verificationGasLimit * testUserOp.maxFeePerGas;

console.log('📞 Calling PaymasterPool.validatePaymasterUserOp() directly');
console.log('='.repeat(60));
console.log(`Paymaster: ${PAYMASTER_POOL}`);
console.log(`UserOp Hash: ${userOpHash}`);
console.log(`Max Cost: ${maxCost}`);
console.log(`CallData length: ${testUserOp.callData.length} chars`);
console.log(`PaymasterAndData length: ${testUserOp.paymasterAndData.length} chars (${(testUserOp.paymasterAndData.length - 2) / 2} bytes)\n`);

const PAYMASTER_ABI = [{
  inputs: [
    {
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
        { name: 'signature', type: 'bytes' }
      ],
      name: 'userOp',
      type: 'tuple'
    },
    { name: 'userOpHash', type: 'bytes32' },
    { name: 'maxCost', type: 'uint256' }
  ],
  name: 'validatePaymasterUserOp',
  outputs: [
    { name: 'context', type: 'bytes' },
    { name: 'validationData', type: 'uint256' }
  ],
  stateMutability: 'nonpayable',
  type: 'function'
}] as const;

async function testDirectCall() {
  try {
    console.log('⏳ Simulating validatePaymasterUserOp call...\n');
    
    const result = await publicClient.simulateContract({
      address: PAYMASTER_POOL as `0x${string}`,
      abi: PAYMASTER_ABI,
      functionName: 'validatePaymasterUserOp',
      args: [testUserOp, userOpHash, maxCost],
    });
    
    console.log('✅ Validation succeeded!');
    console.log('Result:', result);
  } catch (error: any) {
    console.log('❌ Validation failed!\n');
    console.log('Error message:', error.message);
    
    if (error.cause?.data) {
      console.log('Error data:', error.cause.data);
    }
    
    if (error.cause?.reason) {
      console.log('Revert reason:', error.cause.reason);
    }
    
    // Try to extract the revert message
    const errorStr = error.toString();
    const revertMatch = errorStr.match(/reverted with the following reason:\n(.+)/);
    if (revertMatch) {
      console.log('\n🔍 Specific revert reason:', revertMatch[1]);
    }
  }
}

testDirectCall().catch(console.error);
