/**
 * Compile Solidity contracts using Sourcify compilation API
 */

import * as fs from 'fs';

async function compileContracts() {
  console.log('🔨 Compiling Solidity contracts using Sourcify API...\n');

  // Read contract sources
  const factorySource = fs.readFileSync('contracts/PaymasterFactory.sol', 'utf8');
  const poolSource = fs.readFileSync('contracts/PaymasterPool.sol', 'utf8');

  // Create minimal OpenZeppelin IERC20 interface for compilation
  const ierc20Source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
`;

  // Prepare Sourcify API request
  const metadata = {
    compiler: {
      version: '0.8.20'
    },
    language: 'Solidity',
    output: {
      abi: true,
      devdoc: true,
      userdoc: true
    },
    settings: {
      compilationTarget: {
        'PaymasterFactory.sol': 'PaymasterFactory'
      },
      evmVersion: 'paris',
      libraries: {},
      metadata: {
        bytecodeHash: 'ipfs'
      },
      optimizer: {
        enabled: true,
        runs: 200
      },
      remappings: []
    },
    sources: {
      'PaymasterFactory.sol': {
        content: factorySource
      },
      'PaymasterPool.sol': {
        content: poolSource
      },
      '@openzeppelin/contracts/token/ERC20/IERC20.sol': {
        content: ierc20Source
      }
    },
    version: 1
  };

  try {
    console.log('⏳ Sending compilation request to Sourcify...');
    
    const response = await fetch('https://sourcify.dev/server/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contracts: metadata })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors && result.errors.length > 0) {
      console.error('❌ Compilation errors:');
      result.errors.forEach((err: any) => console.error(err));
      process.exit(1);
    }

    console.log('✅ Compilation successful!\n');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error: any) {
    console.error('❌ Remote compilation failed:', error.message);
    console.log('\n📝 Alternative: Use Remix IDE at https://remix.ethereum.org');
    console.log('   1. Copy contract code from contracts/ directory');
    console.log('   2. Compile in Remix');
    console.log('   3. Add bytecode to PAYMASTER_FACTORY_BYTECODE secret\n');
    process.exit(1);
  }
}

compileContracts();
