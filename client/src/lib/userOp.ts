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
  
  // Step 6: Pack gas fees (priority fee + max fee)
  const gasFees = packUint128s(maxPriorityFeePerGas, maxFeePerGas);
  
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
 * Per ERC-4337 spec:
 * 1. Encode the UserOperation struct with keccak256
 * 2. Encode the result with entryPoint and chainId
 * 3. Return keccak256 of the final encoding
 */
export function getUserOpHash(
  userOp: Omit<PackedUserOperation, 'signature'>,
  entryPoint: Address = ENTRY_POINT_ADDRESS,
  chainId: number = base.id
): Hex {
  // Step 1: Pack and hash the UserOperation (per ERC-4337 v0.7 spec)
  // Pack excludes signature and hashes dynamic fields
  const packed = encodeAbiParameters(
    parseAbiParameters('address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32'),
    [
      userOp.sender,
      userOp.nonce,
      keccak256(userOp.initCode || '0x'),
      keccak256(userOp.callData),
      userOp.accountGasLimits,
      userOp.preVerificationGas,
      userOp.gasFees,
      keccak256(userOp.paymasterAndData || '0x'),
    ]
  );
  
  const packedHash = keccak256(packed);
  
  // Step 2: Encode packed hash with entryPoint and chainId, then hash again
  const userOpHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, address, uint256'),
      [packedHash, entryPoint, BigInt(chainId)]
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
