/**
 * Compile PaymasterPool.sol with v0.6 UserOperation struct
 */
import * as fs from 'fs';
import * as path from 'path';

async function compile() {
  console.log('🔨 Compiling PaymasterPool.sol with v0.6 struct...\n');

  try {
    const solc = await import('solc');
    
    // Read contract source
    const contractPath = path.join(process.cwd(), 'contracts', 'PaymasterPool.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    // Minimal IERC20 interface
    const ierc20 = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}
`;

    // Prepare compilation input
    const input = {
      language: 'Solidity',
      sources: {
        'PaymasterPool.sol': {
          content: source
        },
        '@openzeppelin/contracts/token/ERC20/IERC20.sol': {
          content: ierc20
        }
      },
      settings: {
        viaIR: true,
        optimizer: {
          enabled: true,
          runs: 200
        },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
          }
        }
      }
    };

    console.log('⏳ Compiling with solc...');
    const output = JSON.parse(solc.default.compile(JSON.stringify(input)));

    // Check for errors
    if (output.errors) {
      const errors = output.errors.filter((e: any) => e.severity === 'error');
      if (errors.length > 0) {
        console.error('❌ Compilation errors:');
        errors.forEach((e: any) => console.error(e.formattedMessage));
        process.exit(1);
      }
      
      // Show warnings
      const warnings = output.errors.filter((e: any) => e.severity === 'warning');
      if (warnings.length > 0) {
        console.log('⚠️  Warnings:');
        warnings.forEach((w: any) => console.log(w.formattedMessage));
      }
    }

    if (!output.contracts || !output.contracts['PaymasterPool.sol']) {
      throw new Error('No output contracts found');
    }

    const contract = output.contracts['PaymasterPool.sol']['PaymasterPool'];
    if (!contract) {
      throw new Error('PaymasterPool contract not found in output');
    }

    const bytecode = contract.evm.bytecode.object;
    const abi = contract.abi;

    console.log('\n✅ Compilation successful!');
    console.log(`📋 Bytecode length: ${bytecode.length} characters`);
    
    // Save bytecode to file
    const bytecodeFile = path.join(process.cwd(), 'scripts', 'paymaster-pool-bytecode.txt');
    fs.writeFileSync(bytecodeFile, `0x${bytecode}`);
    
    // Update ABI file
    const abiPath = path.join(process.cwd(), 'client', 'src', 'contracts', 'PaymasterPool.json');
    fs.writeFileSync(abiPath, JSON.stringify({ abi }, null, 2));

    console.log('💾 Saved bytecode to: scripts/paymaster-pool-bytecode.txt');
    console.log('💾 Updated ABI at: client/src/contracts/PaymasterPool.json');
    console.log('\n📝 Next steps:');
    console.log('1. Export bytecode: export PAYMASTER_POOL_BYTECODE=$(cat scripts/paymaster-pool-bytecode.txt)');
    console.log('2. Deploy: tsx scripts/deploy-talent-pool.ts\n');

  } catch (error: any) {
    console.error('❌ Compilation failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

compile();
