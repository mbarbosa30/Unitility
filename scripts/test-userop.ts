/**
 * Test UserOperation simulation with detailed error reporting
 */
import { encodeFunctionData, parseEther, type Hex } from 'viem';

const PIMLICO_API_KEY = 'pim_Q754qrtPST5FysN8fEPonx';
const PIMLICO_RPC = `https://api.pimlico.io/v2/base/rpc?apikey=${PIMLICO_API_KEY}`;

// Test UserOp (from logs)
const userOp = {
  sender: "0xe7C0dad97500ccD89fF9361DC5acB20013873bb0",
  nonce: "0x0",
  initCode: "0x9406Cc6185a346906296840746125a0E449764545fbfb9cf000000000000000000000000216844ef94d95279c6d1631875f2dd93fbbdfb610000000000000000000000000000000000000000000000000000000000000000",
  callData: "0x18dfb3c7000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000020000000000000000000000009a33406165f562e16c3abd82fd1185482e01b49a0000000000000000000000009a33406165f562e16c3abd82fd1185482e01b49a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000006423b872dd000000000000000000000000216844ef94d95279c6d1631875f2dd93fbbdfb610000000000000000000000001116e33f241a3ff3d05276e8b0c895361aa669b3000000000000000000000000000000000000000000000001a055690d9db800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006423b872dd000000000000000000000000216844ef94d95279c6d1631875f2dd93fbbdfb61000000000000000000000000a7c6359200fa376c233a454de456291357d5ed1800000000000000000000000000000000000000000000000000354a6ba7a1800000000000000000000000000000000000000000000000000000000000",
  accountGasLimits: "0x000000000000000000000000000007a120000000000000000000000000000030d40",
  preVerificationGas: "0x186a0",
  gasFees: "0x00000000000000000000000000003b9aca000000000000000000000000005f5e100",
  paymasterAndData: "0xa7c6359200fa376c233a454de456291357d5ed180000000000000000000000000000000000000000000000000000000000049350000000000000000000000000000000000000000000000000000000000030d40",
  signature: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" // Dummy signature for simulation
};

async function simulateUserOp() {
  console.log('🔍 Simulating UserOperation with Pimlico...\n');
  
  const requestBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "pm_validateUserOperation",
    params: [
      userOp,
      "0x0000000071727De22E5E9d8BAf0edAc6f37da032", // EntryPoint v0.7
      "0x2105" // Base chainId (8453)
    ]
  };
  
  console.log('Request:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...\n');
  
  try {
    const response = await fetch(PIMLICO_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const text = await response.text();
    console.log('Raw Response:', text.substring(0, 1000));
    
    const data = JSON.parse(text);
    
    if (data.error) {
      console.log('\n❌ Validation Error:');
      console.log('Code:', data.error.code);
      console.log('Message:', data.error.message);
      if (data.error.data) {
        console.log('Data:', JSON.stringify(data.error.data, null, 2));
      }
    } else {
      console.log('\n✅ Validation Success:');
      console.log(JSON.stringify(data.result, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Simulation failed:', error.message);
  }
}

simulateUserOp();
