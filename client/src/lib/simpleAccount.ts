import { type Address, type Hex, type PublicClient, encodeFunctionData, parseAbiParameters, encodeAbiParameters, keccak256 } from 'viem';
import { ENTRY_POINT_ADDRESS } from './userOp';

// SimpleAccountFactory address on Base mainnet (canonical ERC-4337 v0.7 deployment)
export const SIMPLE_ACCOUNT_FACTORY_ADDRESS = '0x9406Cc6185a346906296840746125a0E44976454' as const;

// SimpleAccountFactory ABI for createAccount function
const SIMPLE_ACCOUNT_FACTORY_ABI = [
  {
    name: 'createAccount',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' },
    ],
    outputs: [{ name: 'ret', type: 'address' }],
  },
  {
    name: 'getAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// SimpleAccount ABI for getNonce function
const SIMPLE_ACCOUNT_ABI = [
  {
    name: 'getNonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// EntryPoint ABI for getNonce function
const ENTRY_POINT_ABI = [
  {
    name: 'getNonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    outputs: [{ name: 'nonce', type: 'uint256' }],
  },
] as const;

/**
 * Compute the counterfactual SimpleAccount address for a given owner
 * 
 * @param ownerAddress The EOA that will own the SimpleAccount
 * @param salt Salt for deterministic deployment (default: 0)
 * @param publicClient Viem public client for Base mainnet
 * @returns The computed SimpleAccount address
 */
export async function getSimpleAccountAddress(
  ownerAddress: Address,
  salt = BigInt(0),
  publicClient: PublicClient
): Promise<Address> {
  try {
    const address = await publicClient.readContract({
      address: SIMPLE_ACCOUNT_FACTORY_ADDRESS,
      abi: SIMPLE_ACCOUNT_FACTORY_ABI,
      functionName: 'getAddress',
      args: [ownerAddress, salt],
    });
    
    return address as Address;
  } catch (error) {
    console.error('Failed to get SimpleAccount address:', error);
    throw new Error('Failed to compute SimpleAccount address. Is SimpleAccountFactory deployed?');
  }
}

/**
 * Check if a SimpleAccount is deployed at the given address
 * 
 * @param accountAddress The SimpleAccount address to check
 * @param publicClient Viem public client for Base mainnet
 * @returns True if the account is deployed, false otherwise
 */
export async function isSimpleAccountDeployed(
  accountAddress: Address,
  publicClient: PublicClient
): Promise<boolean> {
  try {
    const bytecode = await publicClient.getBytecode({ address: accountAddress });
    return bytecode !== undefined && bytecode !== '0x';
  } catch (error) {
    console.error('Failed to check SimpleAccount deployment:', error);
    return false;
  }
}

/**
 * Get the initCode for deploying a SimpleAccount
 * 
 * This is used in the UserOperation when the account is not yet deployed.
 * The initCode format is: factoryAddress + callData
 * 
 * @param ownerAddress The EOA that will own the SimpleAccount
 * @param salt Salt for deterministic deployment (default: 0)
 * @returns The initCode to include in the UserOperation
 */
export function getSimpleAccountInitCode(
  ownerAddress: Address,
  salt = BigInt(0)
): Hex {
  // Encode the createAccount function call
  const callData = encodeFunctionData({
    abi: SIMPLE_ACCOUNT_FACTORY_ABI,
    functionName: 'createAccount',
    args: [ownerAddress, salt],
  });
  
  // initCode = factoryAddress + callData
  return `${SIMPLE_ACCOUNT_FACTORY_ADDRESS}${callData.slice(2)}` as Hex;
}

/**
 * Get the nonce for a SimpleAccount
 * 
 * This queries the EntryPoint to get the current nonce for the account.
 * The nonce is used to prevent replay attacks.
 * 
 * @param accountAddress The SimpleAccount address
 * @param publicClient Viem public client for Base mainnet
 * @param key Nonce key (default: 0 for sequential nonces)
 * @returns The current nonce
 */
export async function getSimpleAccountNonce(
  accountAddress: Address,
  publicClient: PublicClient,
  key = BigInt(0)
): Promise<bigint> {
  try {
    const nonce = await publicClient.readContract({
      address: ENTRY_POINT_ADDRESS,
      abi: ENTRY_POINT_ABI,
      functionName: 'getNonce',
      args: [accountAddress, key],
    });
    
    return nonce as bigint;
  } catch (error) {
    console.error('Failed to get SimpleAccount nonce:', error);
    throw new Error('Failed to query account nonce from EntryPoint');
  }
}

/**
 * Setup SimpleAccount for a user
 * 
 * This is a convenience function that:
 * 1. Computes the SimpleAccount address
 * 2. Checks if it's deployed
 * 3. Returns the address and initCode (if needed)
 * 4. Returns the current nonce
 * 
 * @param ownerAddress The EOA that owns the SimpleAccount
 * @param publicClient Viem public client for Base mainnet
 * @returns Object with account address, initCode (if not deployed), and nonce
 */
export async function setupSimpleAccount(
  ownerAddress: Address,
  publicClient: PublicClient
): Promise<{
  accountAddress: Address;
  initCode: Hex;
  nonce: bigint;
  isDeployed: boolean;
}> {
  // Step 1: Compute the SimpleAccount address
  const accountAddress = await getSimpleAccountAddress(ownerAddress, BigInt(0), publicClient);
  
  // Step 2: Check if it's deployed
  const isDeployed = await isSimpleAccountDeployed(accountAddress, publicClient);
  
  // Step 3: Get initCode if not deployed
  const initCode = isDeployed ? '0x' as Hex : getSimpleAccountInitCode(ownerAddress);
  
  // Step 4: Get current nonce
  const nonce = await getSimpleAccountNonce(accountAddress, publicClient);
  
  return {
    accountAddress,
    initCode,
    nonce,
    isDeployed,
  };
}
