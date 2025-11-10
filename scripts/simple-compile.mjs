/**
 * Simple Solidity compiler using solc-js from npm CDN
 * Run with: node scripts/simple-compile.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

async function compile() {
  console.log('🔨 Compiling PaymasterPool.sol...\n');

  try {
    // Read contract source
    const contractPath = path.join(__dirname, '..', 'contracts', 'PaymasterPool.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    // Use solcjs wrapper from unpkg
    console.log('📦 Loading solc-js from CDN...');
    
    const solcModule = await import('https://unpkg.com/solc@0.8.20/wrapper.js');
    
    // Load the actual compiler
    const solcUrl = 'https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js';
    const response = await fetch(solcUrl);
    const solcCode = await response.text();
    
    // Create solc instance
    const Module = { exports: {} };
    eval(solcCode);
    const solc = Module.exports;

    console.log('⏳ Compiling...');

    // Prepare compilation input
    const input = {
      language: 'Solidity',
      sources: {
        'PaymasterPool.sol': {
          content: source
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode.object']
          }
        }
      }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    // Check for errors
    if (output.errors) {
      const errors = output.errors.filter(e => e.severity === 'error');
      if (errors.length > 0) {
        console.error('❌ Compilation errors:');
        errors.forEach(e => console.error(e.formattedMessage));
        process.exit(1);
      }
    }

    const contract = output.contracts['PaymasterPool.sol']['PaymasterPool'];
    const bytecode = contract.evm.bytecode.object;
    const abi = contract.abi;

    console.log('✅ Compilation successful!\n');
    console.log(`📋 Bytecode length: ${bytecode.length} characters`);
    
    // Save artifacts
    const artifactsDir = path.join(__dirname, '..', 'client', 'src', 'contracts');
    fs.writeFileSync(
      path.join(artifactsDir, 'PaymasterPool.json'),
      JSON.stringify({ abi }, null, 2)
    );

    const bytecodeFile = path.join(__dirname, 'paymaster-pool-bytecode.txt');
    fs.writeFileSync(bytecodeFile, `0x${bytecode}`);

    console.log('💾 Saved ABI to: client/src/contracts/PaymasterPool.json');
    console.log('💾 Saved bytecode to: scripts/paymaster-pool-bytecode.txt\n');
    console.log('📝 Add to Replit Secrets:');
    console.log(`PAYMASTER_POOL_BYTECODE=0x${bytecode.slice(0, 100)}...\n`);
    console.log('🚀 Then run: tsx scripts/deploy-paymaster.ts\n');

  } catch (error) {
    console.error('❌ Compilation failed:', error.message);
    console.log('\n📝 Fallback: Use Remix IDE');
    console.log('See DEPLOY.md for instructions\n');
    process.exit(1);
  }
}

compile();
