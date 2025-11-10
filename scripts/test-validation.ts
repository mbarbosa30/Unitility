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

// UserOp from actual logs
const testUserOp = {
  sender: '0xe7C0dad97500ccD89fF9361DC5acB20013873bb0',
  nonce: 0n,
  initCode: '0x' as `0x${string}`,
  callData: '0x18dfb3c7000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000020000000000000000000000009a33406165f562e16c3abd82fd1185482e01b49a0000000000000000000000009a33406165f562e16c3abd82fd1185482e01b49a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000006423b872dd000000000000000000000000216844ef94d95279c6d1631875f2dd93fbbdfb610000000000000000000000001116e33f241a3ff3d05276e8b0c895361aa669b300000000000000000000000000000000000000000000000008ac7230489e8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006423b872dd000000000000000000000000216844ef94d95279c6d1631875f2dd93fbbdfb61000000000000000000000000d854ce29e07381bfd9459a370830c93dbe7256ff0000000000000000000000000000000000000000000000000429d069189e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
  callGasLimit: 250000n,
  verificationGasLimit: 300000n,
  preVerificationGas: 60000n,
  maxFeePerGas: 1000000000n,
  maxPriorityFeePerGas: 1000000000n,
  paymasterAndData: '0x' as `0x${string}`,
  signature: '0x8eabca17c99d6f05377f626c1e6e8c2d337c6881690b9c261cae05a691ba2ea74712a924afd110572bc1a2b13aff91aa6551297b564e055092b96e8d413e00231b' as `0x${string}`,
};

// Build paymasterAndData
const recipient = '0x1116e33f241a3ff3d05276e8b0c895361aa669b3';
const amount = 10000000000000000000n; // 10 TALENT
const fee = 300000000000000000n; // 0.3 TALENT (3%)

const postGas = concat([
  pad(toHex(60000n, { size: 16 }), { size: 16 }), // postVerificationGasLimit
  pad(toHex(150000n, { size: 16 }), { size: 16 }), // postOpGasLimit
]);

const context = encodeAbiParameters(
  parseAbiParameters('address to, uint256 amount, uint256 fee'),
  [recipient as `0x${string}`, amount, fee]
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
