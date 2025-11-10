import { encodeFunctionData, parseAbi, concat } from 'viem';

// Test data from logs
const EOA = '0x216844eF94D95279c6d1631875F2dd93FbBdfB61';
const RECIPIENT = '0x1116e33f241a3ff3d05276e8b0c895361aa669b3';
const TOKEN = '0x9a33406165f562e16c3abd82fd1185482e01b49a';
const NEW_PAYMASTER = '0xf2734b01060c0c4df14202f4433d68e97d29cad3';
const AMOUNT = BigInt('30000000000000000000'); // 30 TALENT
const FEE = (AMOUNT * BigInt(300)) / BigInt(10000); // 3% fee

console.log('Testing fee recipient in executeBatch callData');
console.log('===============================================\n');
console.log('Expected fee recipient:', NEW_PAYMASTER);
console.log('Amount:', (Number(AMOUNT) / 1e18), 'TALENT');
console.log('Fee:', (Number(FEE) / 1e18), 'TALENT\n');

// Encode first transferFrom: from EOA to recipient
const transfer1 = encodeFunctionData({
  abi: parseAbi(['function transferFrom(address,address,uint256)']),
  functionName: 'transferFrom',
  args: [EOA, RECIPIENT, AMOUNT],
});

// Encode second transferFrom: from EOA to paymaster (fee)
const transfer2 = encodeFunctionData({
  abi: parseAbi(['function transferFrom(address,address,uint256)']),
  functionName: 'transferFrom',
  args: [EOA, NEW_PAYMASTER, FEE],
});

console.log('Transfer 1 (to recipient):');
console.log(`  Length: ${transfer1.length} chars (${(transfer1.length - 2) / 2} bytes)`);
console.log(`  Data: ${transfer1}\n`);

console.log('Transfer 2 (fee to paymaster):');
console.log(`  Length: ${transfer2.length} chars (${(transfer2.length - 2) / 2} bytes)`);
console.log(`  Data: ${transfer2}`);
console.log(`  Fee recipient (bytes 36-68): 0x${transfer2.slice(34, 74)}\n`);

// Encode executeBatch
const executeBatch = encodeFunctionData({
  abi: parseAbi(['function executeBatch(address[],bytes[])']),
  functionName: 'executeBatch',
  args: [[TOKEN, TOKEN], [transfer1, transfer2]],
});

console.log('ExecuteBatch callData:');
console.log(`  Length: ${executeBatch.length} chars`);
console.log(`  First 100 chars: ${executeBatch.slice(0, 100)}...\n`);

console.log('✓ Fee recipient should be:', NEW_PAYMASTER.toLowerCase());
console.log('  Actual in callData:', '0x' + transfer2.slice(34, 74));
console.log('  Match:', ('0x' + transfer2.slice(34, 74)).toLowerCase() === NEW_PAYMASTER.toLowerCase() ? '✓' : '✗');
