import { createPublicClient, http, encodeFunctionData, keccak256, encodePacked, parseEther, formatEther } from 'viem';
import { base } from 'viem/chains';

const BUNDLER_RPC = process.env.VITE_BUNDLER_RPC_URL;
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const FACTORY = '0x9406Cc6185a346906296840746125a0E44976454';
const PAYMASTER = '0xb47973f205121ad784d9414bbfeca86c8e270844';
const TOKEN = '0x9a33406165f562E16C3abD82fd1185482E01b49a'; // TALENT
const EOA_OWNER = '0x1116E33F241a3ff3D05276e8B0c895361AA669b3';
const RECIPIENT = '0x742D35CC6634c0532925A3b844BC9E7595F0BEb0'; // Test recipient

const ACCOUNT_ADDRESS = '0xA444786DcbDDC285d274D02d38A4C4a1Ebbe96B0';

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
});

async function testGaslessTransfer() {
  console.log('🧪 Testing Gasless TALENT Transfer');
  console.log('='.repeat(60), '\n');
  
  console.log('📝 Configuration:');
  console.log(`   Smart Account: ${ACCOUNT_ADDRESS}`);
  console.log(`   EOA Owner: ${EOA_OWNER}`);
  console.log(`   Paymaster: ${PAYMASTER}`);
  console.log(`   Token: ${TOKEN} (TALENT)`);
  console.log(`   Recipient: ${RECIPIENT}\n`);
  
  // Check if account is deployed
  const code = await publicClient.getBytecode({ address: ACCOUNT_ADDRESS });
  const isDeployed = code && code.length > 2;
  console.log('🔍 Account Status:');
  console.log(`   Deployed: ${isDeployed ? 'YES ✅' : 'NO ❌ (will deploy via initCode)'}\n`);
  
  // Check token balance
  const balance = await publicClient.readContract({
    address: TOKEN,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'balanceOf',
    args: [EOA_OWNER],
  });
  
  console.log('💰 Token Balance:');
  console.log(`   EOA Owner: ${formatEther(balance)} TALENT\n`);
  
  if (balance === 0n) {
    throw new Error('EOA owner has 0 TALENT tokens - cannot test transfer');
  }
  
  // Check allowance
  const allowance = await publicClient.readContract({
    address: TOKEN,
    abi: [{
      name: 'allowance',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' }
      ],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'allowance',
    args: [EOA_OWNER, ACCOUNT_ADDRESS],
  });
  
  console.log('🔓 Allowance:');
  console.log(`   Smart Account can spend: ${formatEther(allowance)} TALENT`);
  
  if (allowance === 0n) {
    console.log('   ⚠️ WARNING: No allowance set - transfer will fail\n');
    console.log('   To fix: Connect wallet as', EOA_OWNER);
    console.log('   Call: token.approve(smartAccount, maxAmount)\n');
  } else {
    console.log();
  }
  
  // Build UserOp
  const transferAmount = parseEther('6'); // 6 TALENT (above 5 minimum)
  const feeAmount = (transferAmount * 300n) / 10000n; // 3% fee
  
  console.log('📤 Transfer Details:');
  console.log(`   Amount to send: ${formatEther(transferAmount)} TALENT`);
  console.log(`   Fee (3%): ${formatEther(feeAmount)} TALENT`);
  console.log(`   Total deducted from EOA: ${formatEther(transferAmount + feeAmount)} TALENT\n`);
  
  // Build initCode (only if not deployed)
  const initCode = isDeployed ? '0x' : encodePacked(
    ['address', 'bytes'],
    [
      FACTORY,
      encodeFunctionData({
        abi: [{
          name: 'createAccount',
          type: 'function',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'salt', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'address' }],
        }],
        functionName: 'createAccount',
        args: [EOA_OWNER, 0n],
      })
    ]
  );
  
  // Build executeBatch call
  const call0 = encodeFunctionData({
    abi: [{
      name: 'transferFrom',
      type: 'function',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ name: '', type: 'bool' }],
    }],
    functionName: 'transferFrom',
    args: [EOA_OWNER, RECIPIENT, transferAmount],
  });
  
  const call1 = encodeFunctionData({
    abi: [{
      name: 'transferFrom',
      type: 'function',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ name: '', type: 'bool' }],
    }],
    functionName: 'transferFrom',
    args: [EOA_OWNER, PAYMASTER, feeAmount],
  });
  
  const callData = encodeFunctionData({
    abi: [{
      name: 'executeBatch',
      type: 'function',
      inputs: [
        { name: 'dest', type: 'address[]' },
        { name: 'value', type: 'uint256[]' },
        { name: 'func', type: 'bytes[]' }
      ],
      outputs: [],
    }],
    functionName: 'executeBatch',
    args: [[TOKEN, TOKEN], [0n, 0n], [call0, call1]],
  });
  
  // Get nonce
  const nonce = await publicClient.readContract({
    address: ENTRY_POINT,
    abi: [{
      name: 'getNonce',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'sender', type: 'address' },
        { name: 'key', type: 'uint192' }
      ],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'getNonce',
    args: [ACCOUNT_ADDRESS, 0n],
  });
  
  console.log('🔢 Nonce:', nonce.toString(), '\n');
  
  // Build paymasterAndData
  const paymasterAndData = encodePacked(
    ['address', 'uint128', 'uint128'],
    [PAYMASTER, 50000n, 50000n] // postOpGasLimit, paymasterVerificationGasLimit
  );
  
  const userOp = {
    sender: ACCOUNT_ADDRESS,
    nonce: `0x${nonce.toString(16)}`,
    initCode,
    callData,
    callGasLimit: '0x30000',
    verificationGasLimit: isDeployed ? '0x30000' : '0x100000',
    preVerificationGas: '0x10000',
    maxFeePerGas: '0x5F5E100',
    maxPriorityFeePerGas: '0x5F5E100',
    paymasterAndData,
    signature: '0x' + '00'.repeat(65),
  };
  
  console.log('📦 UserOperation built');
  console.log('   Sender:', userOp.sender);
  console.log('   Nonce:', userOp.nonce);
  console.log('   InitCode length:', initCode.length, 'chars');
  console.log('   CallData length:', callData.length, 'chars');
  console.log('   PaymasterAndData length:', paymasterAndData.length, 'chars\n');
  
  // Send to bundler
  console.log('🚀 Sending to Pimlico bundler...');
  console.log('   Endpoint:', BUNDLER_RPC, '\n');
  
  try {
    const response = await fetch(BUNDLER_RPC!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendUserOperation',
        params: [userOp, ENTRY_POINT],
        id: 1,
      }),
    });
    
    const result = await response.json();
    
    if (result.error) {
      console.log('❌ BUNDLER ERROR:');
      console.log(JSON.stringify(result.error, null, 2));
      
      // Parse error message for details
      if (result.error.message) {
        console.log('\n📝 Error Message:', result.error.message);
      }
      
      if (result.error.data) {
        console.log('\n📝 Error Data:', result.error.data);
      }
    } else {
      console.log('✅ SUCCESS!');
      console.log('   UserOpHash:', result.result);
      console.log('\n⏳ Waiting for transaction...');
      
      // Poll for receipt
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const receiptResponse = await fetch(BUNDLER_RPC!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getUserOperationReceipt',
            params: [result.result],
            id: 1,
          }),
        });
        
        const receiptResult = await receiptResponse.json();
        
        if (receiptResult.result) {
          receipt = receiptResult.result;
          break;
        }
      }
      
      if (receipt) {
        console.log('\n📜 Transaction Receipt:');
        console.log('   TX Hash:', receipt.receipt.transactionHash);
        console.log('   Block:', receipt.receipt.blockNumber);
        console.log('   Success:', receipt.success ? '✅ YES' : '❌ NO');
        
        if (!receipt.success) {
          console.log('   Reason:', receipt.reason);
        }
      } else {
        console.log('\n⚠️ Receipt not found after 60 seconds');
      }
    }
  } catch (error: any) {
    console.error('\n❌ Fetch error:', error.message);
  }
}

testGaslessTransfer().catch(console.error);
