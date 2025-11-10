/**
 * Compile Solidity contracts using solc-js
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🔨 Compiling Solidity contracts...\n');

  try {
    // Read contract sources
    const contractsDir = path.join(__dirname, '..', 'contracts');
    const poolSource = fs.readFileSync(path.join(contractsDir, 'PaymasterPool.sol'), 'utf8');
    const factorySource = fs.readFileSync(path.join(contractsDir, 'PaymasterFactory.sol'), 'utf8');

    console.log('📦 Loading Solidity compiler...');
    
    // Use remote compilation service
    const compilerInput = {
      language: 'Solidity',
      sources: {
        'PaymasterPool.sol': {
          content: poolSource
        },
        'PaymasterFactory.sol': {
          content: factorySource
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
          }
        },
        evmVersion: 'paris'
      }
    };

    // Try using EtherscanIO compilation API
    console.log('⏳ Compiling via remote service...');
    
    const response = await fetch('https://etherscan.io/api/v1/compiler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compiler: 'v0.8.20+commit.a1b79de6',
        input: JSON.stringify(compilerInput)
      })
    });

    if (!response.ok) {
      throw new Error(`Compilation service failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors && result.errors.some((e: any) => e.severity === 'error')) {
      console.error('❌ Compilation errors:');
      result.errors.forEach((e: any) => {
        if (e.severity === 'error') {
          console.error(e.formattedMessage);
        }
      });
      process.exit(1);
    }

    // Extract compiled artifacts
    const poolContract = result.contracts?.['PaymasterPool.sol']?.['PaymasterPool'];
    const factoryContract = result.contracts?.['PaymasterFactory.sol']?.['PaymasterFactory'];

    if (!poolContract || !factoryContract) {
      throw new Error('Compilation succeeded but contracts not found in output');
    }

    console.log('✅ Compilation successful!\n');

    // Save ABIs
    const artifactsDir = path.join(__dirname, '..', 'client', 'src', 'contracts');
    
    fs.writeFileSync(
      path.join(artifactsDir, 'PaymasterPool.json'),
      JSON.stringify({ abi: poolContract.abi }, null, 2)
    );
    
    fs.writeFileSync(
      path.join(artifactsDir, 'PaymasterFactory.json'),
      JSON.stringify({ abi: factoryContract.abi }, null, 2)
    );

    console.log('💾 Saved ABI files to client/src/contracts/');
    
    // Output bytecode for deployment
    const factoryBytecode = factoryContract.evm.bytecode.object;
    console.log('\n📋 Deployment Instructions:');
    console.log('1. Copy the bytecode below');
    console.log('2. Add to Replit Secrets: PAYMASTER_FACTORY_BYTECODE=0x...');
    console.log('3. Run: tsx scripts/deploy.ts\n');
    console.log(`Bytecode (${factoryBytecode.length} chars):`);
    console.log(`0x${factoryBytecode.slice(0, 100)}...`);
    
    // Save bytecode to file for easy copying
    fs.writeFileSync(
      path.join(__dirname, 'factory-bytecode.txt'),
      `0x${factoryBytecode}`
    );
    console.log('\n💾 Full bytecode saved to: scripts/factory-bytecode.txt');

  } catch (error: any) {
    console.error('\n❌ Compilation failed:', error.message);
    console.log('\n📝 Fallback: Use Remix IDE');
    console.log('1. Visit https://remix.ethereum.org');
    console.log('2. Copy contracts from DEPLOY.md');
    console.log('3. Compile with version 0.8.20');
    console.log('4. Deploy to Base mainnet\n');
    process.exit(1);
  }
}

main();
