import { createPublicClient, http, encodeFunctionData, parseEther, concat, pad, toHex, encodeAbiParameters, parseAbiParameters } from 'viem';
import { base } from 'viem/chains';

const RPC_URL = process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org';
const PAYMASTER = '0x66dc832363f1eb1693cacef3a6db0c63bdf6ab0e';
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const TOKEN = '0x9a33406165f562e16c3abd82fd1185482e01b49a'; // TALENT

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

// ERC-20 transferFrom ABI
const ERC20_TRANSFER_FROM_ABI = [{
  name: 'transferFrom',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

// SimpleAccount executeBatch ABI
const EXECUTE_BATCH_ABI = [{
  name: 'executeBatch',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'dest', type: 'address[]' },
    { name: 'func', type: 'bytes[]' },
  ],
  outputs: [],
}] as const;

async function testValidation() {
  console.log('🧪 Testing PaymasterPool Validation Logic');
  console.log('='.repeat(60));

  // Test parameters
  const eoaOwner = '0x1116E33F241a3ff3D05276e8B0c895361AA669b3';
  const recipient = '0x2c696e742e07d92d9ae574865267c54b13930363';
  const amount = parseEther('30');
  const fee = parseEther('0.9'); // 3%

  console.log('Test Parameters:');
  console.log(`  EOA Owner: ${eoaOwner}`);
  console.log(`  Recipient: ${recipient}`);
  console.log(`  Amount: ${Number(amount) / 1e18} TALENT`);
  console.log(`  Fee: ${Number(fee) / 1e18} TALENT\n`);

  // Step 1: Build executeBatch callData
  const transferToRecipient = encodeFunctionData({
    abi: ERC20_TRANSFER_FROM_ABI,
    functionName: 'transferFrom',
    args: [eoaOwner as `0x${string}`, recipient as `0x${string}`, amount],
  });

  const transferFeeToPaymaster = encodeFunctionData({
    abi: ERC20_TRANSFER_FROM_ABI,
    functionName: 'transferFrom',
    args: [eoaOwner as `0x${string}`, PAYMASTER as `0x${string}`, fee],
  });

  const executeBatchCallData = encodeFunctionData({
    abi: EXECUTE_BATCH_ABI,
    functionName: 'executeBatch',
    args: [
      [TOKEN as `0x${string}`, TOKEN as `0x${string}`],
      [transferToRecipient, transferFeeToPaymaster],
    ],
  });

  console.log('✅ executeBatch callData built');
  console.log(`   Selector: ${executeBatchCallData.slice(0, 10)}`);
  console.log(`   Length: ${executeBatchCallData.length} chars\n`);

  // Step 2: Build paymasterAndData
  const postVerificationGasLimit = BigInt(60000);
  const postOpGasLimit = BigInt(150000);

  const postVerifHex = pad(toHex(postVerificationGasLimit), { size: 16 });
  const postOpHex = pad(toHex(postOpGasLimit), { size: 16 });
  const postGasPacked = concat([postVerifHex, postOpHex]);

  const contextData = encodeAbiParameters(
    parseAbiParameters('address, uint256, uint256'),
    [recipient as `0x${string}`, amount, fee]
  );

  const paymasterAndData = concat([
    PAYMASTER as `0x${string}`,
    postGasPacked,
    contextData
  ]);

  console.log('✅ paymasterAndData built');
  console.log(`   Total length: ${paymasterAndData.length} chars (${(paymasterAndData.length - 2) / 2} bytes)`);
  console.log(`   Paymaster: ${paymasterAndData.slice(0, 42)}`);
  console.log(`   PostGas: ${paymasterAndData.slice(42, 108)}`);
  console.log(`   Context: ${paymasterAndData.slice(108)}\n`);

  // Step 3: Check if contract recognizes executeBatch selector
  console.log('🔍 Checking contract bytecode...');
  const bytecode = await publicClient.getBytecode({ address: PAYMASTER as `0x${string}` });
  const executeBatchSelector = '0x18dfb3c7'; // from callData
  const hasSelector = bytecode?.includes(executeBatchSelector.slice(2));
  console.log(`   executeBatch selector (${executeBatchSelector}): ${hasSelector ? '✅ FOUND' : '❌ NOT FOUND'}`);
  
  // Also check for the keccak256 calculation
  const selectorCheckPattern = '8d80ff0a'; // bytes4(keccak256("executeBatch(address[],bytes[])"))
  const hasSelectorCheck = bytecode?.includes(selectorCheckPattern);
  console.log(`   Selector constant (0x${selectorCheckPattern}): ${hasSelectorCheck ? '✅ FOUND' : '❌ NOT FOUND'}\n`);

  // Step 4: Check EOA token balance and allowance
  console.log('🔍 Checking EOA token state...');
  
  const balance = await publicClient.readContract({
    address: TOKEN as `0x${string}`,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'balanceOf',
    args: [eoaOwner as `0x${string}`],
  });

  const smartAccount = '0xA444786DcbDDC285d274D02d38A4C4a1Ebbe96B0';
  const allowance = await publicClient.readContract({
    address: TOKEN as `0x${string}`,
    abi: [{
      name: 'allowance',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'allowance',
    args: [eoaOwner as `0x${string}`, smartAccount as `0x${string}`],
  });

  const required = amount + fee;
  console.log(`   Balance: ${Number(balance) / 1e18} TALENT`);
  console.log(`   Allowance: ${Number(allowance) / 1e18} TALENT`);
  console.log(`   Required: ${Number(required) / 1e18} TALENT`);
  console.log(`   Sufficient balance: ${balance >= required ? '✅ YES' : '❌ NO'}`);
  console.log(`   Sufficient allowance: ${allowance >= required ? '✅ YES' : '❌ NO'}\n`);

  console.log('💡 Conclusion:');
  if (!hasSelector && !hasSelectorCheck) {
    console.log('   ❌ Contract bytecode does NOT contain executeBatch validation');
    console.log('   🚨 The contract was likely deployed with OLD validation code');
    console.log('   🔧 Solution: Redeploy contract from correct source with viaIR enabled\n');
  } else {
    console.log('   ✅ Contract appears to have executeBatch support');
    console.log('   ⚠️  The -32603 error likely comes from another validation failure\n');
  }
}

testValidation().catch(console.error);
