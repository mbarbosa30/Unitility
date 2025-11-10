/**
 * Solidity contract compilation script using solc Standard JSON I/O
 */

const path = require('path');
const fs = require('fs');
const solc = require('solc');

console.log('🔨 Compiling Solidity contracts...\n');

// Read contract sources
const factorySource = fs.readFileSync(path.resolve(__dirname, '../contracts/PaymasterFactory.sol'), 'utf8');
const poolSource = fs.readFileSync(path.resolve(__dirname, '../contracts/PaymasterPool.sol'), 'utf8');

// Import callback to resolve OpenZeppelin dependencies
function findImports(importPath) {
  try {
    if (importPath.startsWith('@openzeppelin/')) {
      const fullPath = path.resolve(__dirname, '../node_modules', importPath);
      const contents = fs.readFileSync(fullPath, 'utf8');
      return { contents };
    }
    if (importPath.startsWith('./')) {
      const fullPath = path.resolve(__dirname, '../contracts', importPath);
      const contents = fs.readFileSync(fullPath, 'utf8');
      return { contents };
    }
    return { error: 'File not found: ' + importPath };
  } catch (e) {
    return { error: 'File not found: ' + importPath };
  }
}

// Prepare Standard JSON Input
const input = {
  language: 'Solidity',
  sources: {
    'PaymasterFactory.sol': {
      content: factorySource
    },
    'PaymasterPool.sol': {
      content: poolSource
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
        '*': ['abi', 'evm.bytecode.object']
      }
    }
  }
};

console.log('⏳ Compiling contracts with solc...');

// Compile with import callback
const output = JSON.parse(
  solc.compile(JSON.stringify(input), { import: findImports })
);

// Handle compilation errors
if (output.errors) {
  const errors = output.errors.filter(e => e.severity === 'error');
  if (errors.length > 0) {
    console.error('\n❌ Compilation errors:\n');
    errors.forEach(err => console.error(err.formattedMessage));
    process.exit(1);
  }
  
  // Show warnings
  const warnings = output.errors.filter(e => e.severity === 'warning');
  if (warnings.length > 0) {
    console.warn('\n⚠️  Warnings:\n');
    warnings.forEach(warn => console.warn(warn.formattedMessage));
  }
}

// Extract compiled contracts
const factoryContract = output.contracts['PaymasterFactory.sol']['PaymasterFactory'];
const poolContract = output.contracts['PaymasterPool.sol']['PaymasterPool'];

const factoryBytecode = factoryContract.evm.bytecode.object;
const factoryABI = factoryContract.abi;
const poolABI = poolContract.abi;

console.log('\n✅ Compilation successful!\n');
console.log(`📍 Factory Bytecode Length: ${factoryBytecode.length} characters`);
console.log(`📍 Factory Bytecode Preview: 0x${factoryBytecode.slice(0, 100)}...\n`);

// Update ABI files
const artifactsDir = path.resolve(__dirname, '../client/src/contracts');
fs.writeFileSync(
  path.join(artifactsDir, 'PaymasterFactory.json'),
  JSON.stringify({ abi: factoryABI }, null, 2)
);
fs.writeFileSync(
  path.join(artifactsDir, 'PaymasterPool.json'),
  JSON.stringify({ abi: poolABI }, null, 2)
);

console.log('💾 Updated ABI files in client/src/contracts/\n');

// Save bytecode to env file for deployment
const bytecodeEnv = `PAYMASTER_FACTORY_BYTECODE=0x${factoryBytecode}`;
console.log('🔑 Bytecode ready for deployment:');
console.log(`   Length: ${factoryBytecode.length} characters`);
console.log(`\n📝 To deploy, add to Replit Secrets or run:\n`);
console.log(`   export ${bytecodeEnv}\n   tsx scripts/deploy.ts\n`);

// Export bytecode for use by deployment script
process.env.PAYMASTER_FACTORY_BYTECODE = `0x${factoryBytecode}`;

// Return success
console.log('✅ Compilation complete! Ready to deploy.\n');
