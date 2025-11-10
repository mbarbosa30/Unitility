import { decodeAbiParameters, parseAbiParameters } from 'viem';

// From the logs: This is the executeBatch callData
const callData = "0x18dfb3c7000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000020000000000000000000000009a33406165f562e16c3abd82fd1185482e01b49a0000000000000000000000009a33406165f562e16c3abd82fd1185482e01b49a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000c423b872dd0000000000000000000000001116e33f241a3ff3d05276e8b0c895361aa669b30000000000000000000000002c696e742e07d92d9ae574865267c54b13930363000000000000000000000000000000000000000000000008ac7230489e8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c423b872dd0000000000000000000000001116e33f241a3ff3d05276e8b0c895361aa669b3000000000000000000000000bd55102033139bedc8d3406157e15017795d235d0000000000000000000000000000000000000000000000000429d069189e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

console.log('🔍 Decoding executeBatch callData...\n');

// Extract selector
const selector = callData.slice(0, 10);
console.log('executeBatch selector:', selector, '(expected: 0x18dfb3c7 for executeBatch)');

// Decode parameters
const [targets, calls] = decodeAbiParameters(
  parseAbiParameters('address[], bytes[]'),
  `0x${callData.slice(10)}`
);

console.log('\n📦 Batch structure:');
console.log('  Targets:', targets);
console.log('  Number of calls:', calls.length);

console.log('\n🔍 Analyzing each call:');

for (let i = 0; i < calls.length; i++) {
  const call = calls[i];
  console.log(`\nCall ${i}:`);
  console.log('  Full hex:', call);
  console.log('  Length:', call.length, 'chars (', (call.length - 2) / 2, 'bytes)');
  
  // Extract selector (first 4 bytes = 8 hex chars + 0x)
  const callSelector = call.slice(0, 10);
  console.log('  Selector:', callSelector);
  
  if (callSelector === '0x23b872dd') {
    console.log('  ✅ This is transferFrom!');
    
    // Decode transferFrom parameters
    const [from, to, amount] = decodeAbiParameters(
      parseAbiParameters('address, address, uint256'),
      `0x${call.slice(10)}`
    );
    
    console.log('    From:', from);
    console.log('    To:', to);
    console.log('    Amount:', amount.toString());
  } else {
    console.log('  ❌ NOT transferFrom! Expected 0x23b872dd');
  }
}

console.log('\n✅ Debug complete');
