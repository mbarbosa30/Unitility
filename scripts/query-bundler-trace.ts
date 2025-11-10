import { parseEther, formatEther } from 'viem';

const PIMLICO_API_KEY = 'pim_Q754qrtPST5FysN8fEPonx';
const BUNDLER_RPC = `https://api.pimlico.io/v1/base/rpc?apikey=${PIMLICO_API_KEY}`;

async function queryBundlerTrace(traceId: string) {
  console.log(`\n🔍 Querying bundler trace: ${traceId}\n`);
  
  try {
    const response = await fetch(BUNDLER_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pimlico_getUserOperationGasPrice',
        params: [],
      }),
    });

    const data = await response.json();
    console.log('Pimlico status check:', data);

    // Try to get the trace details
    console.log('\n📋 Note: Pimlico bundler traces are internal and not directly queryable.');
    console.log('The trace ID is used for their internal debugging.');
    console.log('\nWe need to use eth_estimateUserOperationGas to see the actual validation error.');
    
  } catch (error) {
    console.error('Error querying bundler:', error);
  }
}

// Use the trace ID from the latest error
const traceId = 'b6983ab048a9fa8aa719b8b27ed38d22';
queryBundlerTrace(traceId);
