import { 
  encodeFunctionData, 
  type Address, 
  type Hex, 
  parseEther,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  toHex 
} from 'viem';
import { base } from 'viem/chains';

// ERC-4337 v0.6 EntryPoint address on Base mainnet
// NOTE: Using v0.6 because existing SimpleAccount was deployed with v0.6
export const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as const;

// UserOperation structure for ERC-4337 v0.6 (unpacked format)
export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
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
 * Build a UserOperation for a gasless token transfer using EOA tokens
 * 
 * This constructs an ERC-4337 v0.6 UserOperation that:
 * 1. Calls SimpleAccount.executeBatch() to perform TWO token transfers:
 *    - transferFrom(eoa, recipient, amount)
 *    - transferFrom(eoa, paymaster, fee)
 * 2. Uses a PaymasterPool to sponsor the gas fees
 * 3. Signs the operation with the account owner's key (signature added separately)
 * 
 * Prerequisites:
 * - EOA must have approved the smart account to spend tokens
 */
export function buildUserOp(params: BuildUserOpParams): Omit<UserOperation, 'signature'> {
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
  
  // Step 5: For v0.6, paymasterAndData is just the paymaster address (no gas limits embedded)
  const paymasterAndData = paymasterAddress as Hex;
  
  return {
    sender: account,
    nonce,
    initCode: '0x', // No initCode needed for existing accounts
    callData: executeBatchCallData,
    callGasLimit,
    verificationGasLimit: validationGasLimit,
    preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymasterAndData,
  };
}

/**
 * Get the hash of a UserOperation for signing (v0.6 format)
 * This is used by the account owner to sign the operation
 * 
 * Per ERC-4337 v0.6 spec, the hash calculation:
 * 1. Encodes all UserOp fields using ABI encoding
 * 2. Hashes the encoded bytes to get innerHash
 * 3. Encodes innerHash with entryPoint and chainId, then hashes again
 */
export function getUserOpHash(
  userOp: Omit<UserOperation, 'signature'>,
  entryPoint: Address = ENTRY_POINT_ADDRESS,
  chainId: number = base.id
): Hex {
  // Step 1: ABI-encode the UserOp (without signature)
  const innerHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, uint256, bytes32, bytes32, uint256, uint256, uint256, uint256, uint256, bytes32'),
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode || '0x'),
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        keccak256(userOp.paymasterAndData || '0x'),
      ]
    )
  );
  
  // Step 2: Outer hash with entryPoint and chainId
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
 * This creates a complete UserOperation ready for submission to a bundler.
 * The signature should be generated by signing the getUserOpHash result with the
 * account owner's private key.
 * 
 * @param userOp The unsigned UserOperation
 * @param signature The signature from the account owner
 * @returns Complete UserOperation with signature
 */
export function signUserOp(
  userOp: Omit<UserOperation, 'signature'>,
  signature: Hex
): UserOperation {
  return {
    ...userOp,
    signature,
  };
}
