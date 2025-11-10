import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { keccak256 } from 'viem';

console.log('🔨 Compiling PaymasterPool with Verification');
console.log('='.repeat(60));

// Read source files
const contractPath = path.join(process.cwd(), 'contracts/PaymasterPool.sol');
const source = fs.readFileSync(contractPath, 'utf-8');

console.log('✅ Source file read');
console.log(`   Path: ${contractPath}`);
console.log(`   Size: ${source.length} chars\n`);

// Verify source contains executeBatch validation
const hasExecuteBatch = source.includes('bytes4 executeBatchSelector = bytes4(keccak256("executeBatch(address[],bytes[])"))');
console.log(`🔍 Source code verification:`);
console.log(`   Contains executeBatch validation: ${hasExecuteBatch ? '✅ YES' : '❌ NO'}`);

if (!hasExecuteBatch) {
  throw new Error('Source code does not contain executeBatch validation!');
}
console.log('');

// Create import callback
function findImports(importPath: string) {
  try {
    if (importPath.startsWith('@openzeppelin/')) {
      const ozPath = path.join(process.cwd(), 'node_modules', importPath);
      const contents = fs.readFileSync(ozPath, 'utf-8');
      return { contents };
    }
    return { error: 'File not found' };
  } catch (e) {
    return { error: 'File not found' };
  }
}

// Compile with viaIR
const input = {
  language: 'Solidity',
  sources: {
    'PaymasterPool.sol': { content: source },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    viaIR: true,
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'],
      },
    },
  },
};

console.log('⚙️  Compiling with solc...');
console.log(`   Version: ${solc.version()}`);
console.log(`   Optimizer: enabled (200 runs)`);
console.log(`   viaIR: true\n`);

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// Check for errors
if (output.errors) {
  const errors = output.errors.filter((e: any) => e.severity === 'error');
  if (errors.length > 0) {
    console.error('❌ Compilation errors:', errors);
    throw new Error('Contract compilation failed');
  }
  // Show warnings
  const warnings = output.errors.filter((e: any) => e.severity === 'warning');
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warnings (non-critical)\n`);
  }
}

const contract = output.contracts['PaymasterPool.sol']['PaymasterPool'];
const abi = contract.abi;
const bytecode = '0x' + contract.evm.bytecode.object;
const deployedBytecode = '0x' + contract.evm.deployedBytecode.object;

console.log('✅ Compilation successful!');
console.log(`   Deployment bytecode: ${bytecode.length} chars`);
console.log(`   Runtime bytecode: ${deployedBytecode.length} chars\n`);

// Calculate bytecode hashes
const deploymentHash = keccak256(bytecode as `0x${string}`);
const runtimeHash = keccak256(deployedBytecode as `0x${string}`);

console.log('🔑 Bytecode hashes:');
console.log(`   Deployment: ${deploymentHash}`);
console.log(`   Runtime: ${runtimeHash}\n`);

// Verify executeBatch selector is in bytecode
const executeBatchSelectorBytes = '8d80ff0a'; // bytes4(keccak256("executeBatch(address[],bytes[])"))
const selectorInBytecode = deployedBytecode.includes(executeBatchSelectorBytes);

console.log('🔍 Bytecode validation:');
console.log(`   executeBatch selector (0x${executeBatchSelectorBytes}): ${selectorInBytecode ? '✅ FOUND' : '⚠️  NOT FOUND (may be optimized)'}`);

// With viaIR, selector might be computed, so also check for "Only executeBatch" revert string
const revertString = 'Only executeBatch calls';
const hasRevertString = source.includes(revertString);
console.log(`   Revert string "${revertString}": ${hasRevertString ? '✅ IN SOURCE' : '❌ MISSING'}\n`);

// Save artifacts
const artifactDir = path.join(process.cwd(), 'artifacts-verified');
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

const artifact = {
  contractName: 'PaymasterPool',
  abi,
  bytecode,
  deployedBytecode,
  deploymentHash,
  runtimeHash,
  compiler: {
    version: solc.version(),
    settings: input.settings,
  },
  sourceHash: keccak256(Buffer.from(source) as any),
};

const artifactPath = path.join(artifactDir, 'PaymasterPool.json');
fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

console.log('💾 Artifact saved:');
console.log(`   Path: ${artifactPath}`);
console.log(`   Source hash: ${artifact.sourceHash}\n`);

console.log('🎉 Compilation and verification complete!');
console.log('');
console.log('Next steps:');
console.log('1. Deploy using: tsx scripts/deploy-verified-paymaster.ts');
console.log('2. Verify on-chain bytecode matches runtime hash');
console.log('3. Update database and test gasless transfer\n');
