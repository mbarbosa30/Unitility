const initCode = "0x9406Cc6185a346906296840746125a0E449764545fbfb9cf000000000000000000000000216844ef94d95279c6d1631875f2dd93fbbdfb610000000000000000000000000000000000000000000000000000000000000000";

console.log('📦 Decoding initCode...\n');
console.log('Full initCode:', initCode);
console.log('Length:', initCode.length, 'characters', '(', (initCode.length - 2) / 2, 'bytes )');

// Split into factory address and calldata
const factory = '0x' + initCode.slice(2, 42); // 20 bytes (40 hex chars)
const calldata = '0x' + initCode.slice(42);

console.log('\nFactory Address:', factory);
console.log('Factory Calldata:', calldata);
console.log('Calldata length:', calldata.length, 'characters', '(', (calldata.length - 2) / 2, 'bytes )');

// Decode calldata
const selector = calldata.slice(0, 10); // 4 bytes
const owner = '0x' + calldata.slice(10, 74); // 32 bytes
const salt = '0x' + calldata.slice(74);     // 32 bytes

console.log('\nCalldata breakdown:');
console.log('Selector:', selector);
console.log('Owner (32 bytes):', owner);
console.log('Owner (address):', '0x' + owner.slice(26)); // Remove padding
console.log('Salt:', salt);

console.log('\n✅ Expected createAccount(owner, salt) format');
console.log('Factory should call: createAccount(' + '0x' + owner.slice(26) + ', ' + salt + ')');
