import { getContract } from 'viem';
import { base } from 'viem/chains';
import PaymasterFactoryABI from '@/contracts/PaymasterFactory.json';
import PaymasterPoolABI from '@/contracts/PaymasterPool.json';

// Contract addresses - to be set after deployment
export const CONTRACTS = {
  PAYMASTER_FACTORY: import.meta.env.VITE_PAYMASTER_FACTORY_ADDRESS as `0x${string}` | undefined,
  ENTRY_POINT: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as `0x${string}`, // v0.7 EntryPoint on Base
};

export const getPaymasterFactory = (client: any) => {
  if (!CONTRACTS.PAYMASTER_FACTORY) {
    throw new Error(
      'VITE_PAYMASTER_FACTORY_ADDRESS not configured. Please deploy contracts and set the environment variable.'
    );
  }
  return getContract({
    address: CONTRACTS.PAYMASTER_FACTORY,
    abi: PaymasterFactoryABI.abi,
    client,
  });
};

export const getPaymasterPool = (poolAddress: `0x${string}`, client: any) => {
  return getContract({
    address: poolAddress,
    abi: PaymasterPoolABI.abi,
    client,
  });
};

// Event signatures for listening
export const EVENTS = {
  PoolCreated: 'PoolCreated(address indexed poolAddress, address indexed token, uint256 feePct, uint256 minTransfer, address indexed sponsor)',
  Deposited: 'Deposited(address indexed depositor, uint256 amount)',
  Withdrawn: 'Withdrawn(address indexed withdrawer, uint256 amount)',
  FeesClaimed: 'FeesClaimed(address indexed claimant, uint256 amount)',
  ParamsAdjusted: 'ParamsAdjusted(uint256 newFeePct, uint256 newMinTransfer)',
  Rebalanced: 'Rebalanced(uint256 tokensSwapped, uint256 ethReceived)',
};

// Chain config
export const CHAIN_CONFIG = {
  chain: base,
  rpcUrl: import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
};

// Helper to format addresses for display
export const shortenAddress = (address: string) => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper to get explorer link
export const getExplorerLink = (address: string, type: 'address' | 'tx' = 'address') => {
  return `${CHAIN_CONFIG.blockExplorer}/${type}/${address}`;
};
