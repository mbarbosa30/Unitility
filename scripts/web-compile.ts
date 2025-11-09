/**
 * Compile contracts using online Solidity compiler
 */

import * as fs from 'fs';

async function main() {
  console.log('🔨 Compiling Solidity contracts via web service...\n');

  const factorySource = fs.readFileSync('contracts/PaymasterFactory.sol', 'utf8');
  const poolSource = fs.readFileSync('contracts/PaymasterPool.sol', 'utf8');

  // Create minimal IERC20 interface
  const ierc20 = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}`;

  // Try using remix-like compilation via solc-bin
  const input = {
    language: 'Solidity',
    sources: {
      'PaymasterFactory.sol': { content: factorySource },
      'PaymasterPool.sol': { content: poolSource },
      '@openzeppelin/contracts/token/ERC20/IERC20.sol': { content: ierc20 }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] }
      }
    }
  };

  try {
    // Use Etherscan's compilation API
    console.log('⏳ Requesting compilation from etherscan.io API...');
    
    const response = await fetch('https://api.etherscan.io/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        module: 'contract',
        action: 'verifysourcecode',
        sourceCode: JSON.stringify(input),
        codeformat: 'solidity-standard-json-input',
        contractaddress: '0x0000000000000000000000000000000000000000',
        contractname: 'PaymasterFactory',
        compilerversion: 'v0.8.20+commit.a1b79de6',
        optimizationUsed: '1',
        runs: '200',
        apikey: 'DEMO' // Demo key for testing
      })
    });

    const result = await response.json();
    console.log('API Response:', result);

  } catch (error: any) {
    console.error('❌ Web compilation failed:', error.message);
  }

  // Fallback: Output contract for manual compilation
  console.log('\n📝 Manual compilation needed.');
  console.log('Visit https://remix.ethereum.org and compile these contracts:\n');
  console.log('='.repeat(60));
  console.log('FILE: PaymasterFactory.sol');
  console.log('='.repeat(60));
  console.log(factorySource);
  console.log('\n' + '='.repeat(60));
  console.log('FILE: PaymasterPool.sol');
  console.log('='.repeat(60));
  console.log(poolSource);
  console.log('\n' + '='.repeat(60));
  console.log('\nAfter compilation in Remix:');
  console.log('1. Copy bytecode from Compilation Details');
  console.log('2. Run: export PAYMASTER_FACTORY_BYTECODE=0x...');
  console.log('3. Run: tsx scripts/deploy.ts\n');
}

main();
