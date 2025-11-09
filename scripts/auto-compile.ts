/**
 * Automatic contract compilation using external compiler service
 */

import * as fs from 'fs';
import * as path from 'path';

async function compileContracts() {
  console.log('🔨 Compiling Solidity contracts...\n');

  // Read contract sources
  const factorySource = fs.readFileSync('contracts/PaymasterFactory.sol', 'utf8');
  const poolSource = fs.readFileSync('contracts/PaymasterPool.sol', 'utf8');

  // Use soljson compiler from CDN
  const solcVersion = 'v0.8.20+commit.a1b79de6';
  
  console.log('📦 Loading Solidity compiler from CDN...');
  
  const solcUrl = `https://binaries.soliditylang.org/bin/soljson-${solcVersion}.js`;
  
  try {
    // Dynamic import of solc from CDN
    const response = await fetch(solcUrl);
    const solcCode = await response.text();
    
    // Create a wrapper to load solc
    const solcWrapper = new Function('Module', solcCode + '; return Module;');
    const solc = solcWrapper({});
    
    // Prepare compiler input
    const input = {
      language: 'Solidity',
      sources: {
        'PaymasterFactory.sol': { content: factorySource },
        'PaymasterPool.sol': { content: poolSource },
        '@openzeppelin/contracts/token/ERC20/IERC20.sol': {
          content: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
`
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        outputSelection: {
          '*': {
            '*': ['evm.bytecode.object', 'abi']
          }
        }
      }
    };

    console.log('⏳ Compiling contracts...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
      const errors = output.errors.filter((e: any) => e.severity === 'error');
      if (errors.length > 0) {
        console.error('❌ Compilation errors:');
        errors.forEach((e: any) => console.error(e.formattedMessage));
        process.exit(1);
      }
    }

    // Extract bytecode
    const factoryBytecode = output.contracts['PaymasterFactory.sol']['PaymasterFactory'].evm.bytecode.object;
    const factoryABI = output.contracts['PaymasterFactory.sol']['PaymasterFactory'].abi;
    
    const poolABI = output.contracts['PaymasterPool.sol']['PaymasterPool'].abi;

    console.log('✅ Compilation successful!\n');
    console.log(`📍 Factory Bytecode Length: ${factoryBytecode.length} characters`);
    console.log(`📍 Factory Bytecode: 0x${factoryBytecode.slice(0, 100)}...\n`);

    // Save artifacts
    const artifactsDir = path.join(process.cwd(), 'client/src/contracts');
    fs.writeFileSync(
      path.join(artifactsDir, 'PaymasterFactory.json'),
      JSON.stringify({ abi: factoryABI }, null, 2)
    );
    fs.writeFileSync(
      path.join(artifactsDir, 'PaymasterPool.json'),
      JSON.stringify({ abi: poolABI }, null, 2)
    );

    console.log('💾 Updated ABI files in client/src/contracts/\n');
    console.log('🔑 Add this to Replit Secrets:');
    console.log(`PAYMASTER_FACTORY_BYTECODE=0x${factoryBytecode}\n`);

    return `0x${factoryBytecode}`;
  } catch (error: any) {
    console.error('❌ Compilation failed:', error.message);
    process.exit(1);
  }
}

compileContracts();
