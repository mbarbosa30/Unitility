import { 
  encodeFunctionData, 
  type Address, 
  type Hex, 
  parseEther,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters 
} from 'viem';
import { base } from 'viem/chains';

// ERC-4337 v0.7 EntryPoint address on Base mainnet
export const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const;

// PackedUserOperation structure for ERC-4337 v0.7
export interface PackedUserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex; // Packed: validationGasLimit (16 bytes) + callGasLimit (16 bytes)
  preVerificationGas: bigint;
  gasFees: Hex; // Packed: maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
  paymasterAndData: Hex; // Packed: paymaster address (20 bytes) + verification data + post-op data
  signature: Hex;
}

// SimpleAccount ABI for executeBatch function
const SIMPLE_ACCOUNT_EXECUTE_BATCH_ABI = [
  {
    name: 'executeBatch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'dest', type: 'address[]' },
      { name: 'func', type: 'bytes[]' },
    ],
    outputs: [],
  },
  {
    name: 'getNonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// ERC-20 transferFrom ABI
const ERC20_TRANSFER_FROM_ABI = [
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

interface BuildUserOpParams {
  // Account
  account: Address; // SimpleAccount address
  eoaOwner: Address; // EOA wallet that owns the tokens
  nonce: bigint;
  
  // Transfer details
  tokenAddress: Address;
  recipientAddress: Address;
  amount: bigint;
  
  // Paymaster
  paymasterAddress: Address;
  feePercentage: number; // Fee in basis points (e.g., 50 = 0.5%)
  
  // Gas settings (optional, can use defaults)
  validationGasLimit?: bigint;
  callGasLimit?: bigint;
  preVerificationGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  maxFeePerGas?: bigint;
}

/**
 * Packs two uint128 values into a single bytes32
 * @param high First 16 bytes (uint128)
 * @param low Last 16 bytes (uint128)
 * @returns Packed bytes32
 */
function packUint128s(high: bigint, low: bigint): Hex {
  const highHex = high.toString(16).padStart(32, '0');
  const lowHex = low.toString(16).padStart(32, '0');
  return `0x${highHex}${lowHex}` as Hex;
}

/**
 * Build a UserOperation for a gasless token transfer using EOA tokens
 * 
 * This constructs an ERC-4337 v0.7 PackedUserOperation that:
 * 1. Calls SimpleAccount.executeBatch() to perform TWO token transfers:
 *    - transferFrom(eoa, recipient, amount)
 *    - transferFrom(eoa, paymaster, fee)
 * 2. Uses a PaymasterPool to sponsor the gas fees
 * 3. Signs the operation with the account owner's key (signature added separately)
 * 
 * Prerequisites:
 * - EOA must have approved the smart account to spend tokens
 */
export function buildUserOp(params: BuildUserOpParams): Omit<PackedUserOperation, 'signature'> {
  const {
    account,
    eoaOwner,
    nonce,
    tokenAddress,
    recipientAddress,
    amount,
    paymasterAddress,
    feePercentage,
    validationGasLimit = BigInt(100000),
    callGasLimit = BigInt(50000),
    preVerificationGas = BigInt(21000),
    maxPriorityFeePerGas = parseEther('0.001', 'gwei'),
    maxFeePerGas = parseEther('0.1', 'gwei'),
  } = params;
  
  // Step 1: Calculate fee in tokens (feePercentage is in basis points, e.g., 50 = 0.5%)
  const tokenFee = (amount * BigInt(feePercentage)) / BigInt(10000);
  
  // Step 2: Encode first transferFrom call: transferFrom(eoa, recipient, amount)
  const transferToRecipient = encodeFunctionData({
    abi: ERC20_TRANSFER_FROM_ABI,
    functionName: 'transferFrom',
    args: [eoaOwner, recipientAddress, amount],
  });
  
  // Step 3: Encode second transferFrom call: transferFrom(eoa, paymaster, fee)
  const transferFeeToPaymaster = encodeFunctionData({
    abi: ERC20_TRANSFER_FROM_ABI,
    functionName: 'transferFrom',
    args: [eoaOwner, paymasterAddress, tokenFee],
  });
  
  // Step 4: Encode SimpleAccount executeBatch call with both transfers
  const executeBatchCallData = encodeFunctionData({
    abi: SIMPLE_ACCOUNT_EXECUTE_BATCH_ABI,
    functionName: 'executeBatch',
    args: [
      [tokenAddress, tokenAddress], // Two calls to the same token
      [transferToRecipient, transferFeeToPaymaster],
    ],
  });
  
  // Step 5: Pack gas limits (validation gas + call gas)
  const accountGasLimits = packUint128s(validationGasLimit, callGasLimit);
  
  // Step 6: Pack gas fees per ERC-4337 v0.7: maxFeePerGas (high) + maxPriorityFeePerGas (low)
  const gasFees = packUint128s(maxFeePerGas, maxPriorityFeePerGas);
  
  // Step 7: Construct paymaster and data
  // Format per ERC-4337 v0.7:
  // - Bytes 0-19: paymaster address (20 bytes)
  // - Bytes 20-35: paymasterVerificationGasLimit (16 bytes, uint128)
  // - Bytes 36-51: paymasterPostOpGasLimit (16 bytes, uint128)
  // - Bytes 52+: paymasterData (optional, not used by our PaymasterPool)
  // Use higher gas limits for paymaster validation and post-op
  const paymasterVerificationGasLimit = BigInt(300000);
  const paymasterPostOpGasLimit = BigInt(200000);
  
  // Remove 0x prefix from address
  const addressHex = paymasterAddress.slice(2);
  // Encode gas limits as 16-byte (32 hex chars) uint128 values
  const verificationGasHex = paymasterVerificationGasLimit.toString(16).padStart(32, '0');
  const postOpGasHex = paymasterPostOpGasLimit.toString(16).padStart(32, '0');
  
  const paymasterAndData = `0x${addressHex}${verificationGasHex}${postOpGasHex}` as Hex;
  
  return {
    sender: account,
    nonce,
    initCode: '0x', // No initCode needed for existing accounts
    callData: executeBatchCallData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData,
  };
}

/**
 * Get the hash of a UserOperation for signing
 * This is used by the account owner to sign the operation
 * 
 * Per ERC-4337 v0.7 spec, the hash uses TIGHT PACKING (no ABI padding):
 * 1. Tight-pack UserOp fields with gas limits as uint128 (16 bytes each)
 * 2. Hash the packed bytes to get innerHash
 * 3. Encode innerHash with entryPoint and chainId, then hash again
 */
export function getUserOpHash(
  userOp: Omit<PackedUserOperation, 'signature'>,
  entryPoint: Address = ENTRY_POINT_ADDRESS,
  chainId: number = base.id
): Hex {
  // Helper: Convert bigint to hex with exact byte length (no 0x prefix)
  const toHex = (value: bigint, bytes: number): string => {
    return value.toString(16).padStart(bytes * 2, '0');
  };
  
  // Unpack accountGasLimits: bytes32 containing verificationGasLimit (16B) + callGasLimit (16B)
  const accountGasLimitsHex = userOp.accountGasLimits.slice(2); // Remove 0x
  const verificationGasLimit = BigInt('0x' + accountGasLimitsHex.slice(0, 32)); // First 16 bytes
  const callGasLimit = BigInt('0x' + accountGasLimitsHex.slice(32, 64)); // Last 16 bytes
  
  // Unpack gasFees: bytes32 per ERC-4337 v0.7: maxFeePerGas (16B high) + maxPriorityFeePerGas (16B low)
  const gasFeesHex = userOp.gasFees.slice(2); // Remove 0x
  const maxFeePerGas = BigInt('0x' + gasFeesHex.slice(0, 32)); // First 16 bytes (high)
  const maxPriorityFeePerGas = BigInt('0x' + gasFeesHex.slice(32, 64)); // Last 16 bytes (low)
  
  // Step 1: Tight-pack inner fields (no ABI padding)
  // Per ERC-4337 v0.7: Only the 4 gas LIMIT fields are uint128, preVerificationGas stays uint256
  // Total: 20 + 32 + 32 + 32 + 16 + 16 + 32 + 16 + 16 + 32 = 244 bytes
  const innerPacked = '0x' + [
    userOp.sender.slice(2), // address (20 bytes)
    toHex(userOp.nonce, 32), // uint256 (32 bytes)
    keccak256(userOp.initCode || '0x').slice(2), // bytes32 (32 bytes)
    keccak256(userOp.callData).slice(2), // bytes32 (32 bytes)
    toHex(verificationGasLimit, 16), // uint128 (16 bytes)
    toHex(callGasLimit, 16), // uint128 (16 bytes)
    toHex(userOp.preVerificationGas, 32), // uint256 (32 bytes) - NOT uint128!
    toHex(maxPriorityFeePerGas, 16), // uint128 (16 bytes)
    toHex(maxFeePerGas, 16), // uint128 (16 bytes)
    keccak256(userOp.paymasterAndData || '0x').slice(2), // bytes32 (32 bytes)
  ].join('') as Hex;
  
  const innerHash = keccak256(innerPacked);
  
  // Step 2: Outer hash uses ABI encoding (safe for fixed-size types)
  const userOpHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, address, uint256'),
      [innerHash, entryPoint, BigInt(chainId)]
    )
  );
  
  return userOpHash;
}

/**
 * Attach a signature to an unsigned UserOperation
 * 
 * This creates a complete PackedUserOperation ready for submission to a bundler.
 * The signature should be generated by signing the getUserOpHash result with the
 * account owner's private key.
 * 
 * @param userOp The unsigned UserOperation
 * @param signature The signature from the account owner
 * @returns Complete PackedUserOperation with signature
 */
export function signUserOp(
  userOp: Omit<PackedUserOperation, 'signature'>,
  signature: Hex
): PackedUserOperation {
  return {
    ...userOp,
    signature,
  };
}
