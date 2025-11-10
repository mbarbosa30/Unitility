import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { type Address } from 'viem';
import { getSimpleAccountAddress, isSimpleAccountDeployed } from '@/lib/simpleAccount';

export type WalletType = 'disconnected' | 'eoa' | 'smart-contract';
export type SmartAccountStatus = 'unknown' | 'not-deployed' | 'deployed' | 'error';

interface SmartWalletStatus {
  walletType: WalletType;
  smartAccountAddress: Address | null;
  smartAccountStatus: SmartAccountStatus;
  isLoading: boolean;
  error: string | null;
}

export function useSmartWalletStatus(): SmartWalletStatus {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [status, setStatus] = useState<SmartWalletStatus>({
    walletType: 'disconnected',
    smartAccountAddress: null,
    smartAccountStatus: 'unknown',
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    async function detectWalletStatus() {
      if (!address || !isConnected || !publicClient) {
        setStatus({
          walletType: 'disconnected',
          smartAccountAddress: null,
          smartAccountStatus: 'unknown',
          isLoading: false,
          error: null,
        });
        return;
      }

      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        // Check if connected address itself is a smart contract
        const connectedWalletCode = await publicClient.getBytecode({ address });
        const isConnectedWalletSC = !!connectedWalletCode && connectedWalletCode !== '0x';

        if (isConnectedWalletSC) {
          // User connected with a smart contract wallet (like Safe, Argent, etc.)
          setStatus({
            walletType: 'smart-contract',
            smartAccountAddress: address,
            smartAccountStatus: 'deployed',
            isLoading: false,
            error: null,
          });
          return;
        }

        // User connected with an EOA - check SimpleAccount status
        const simpleAccountAddress = await getSimpleAccountAddress(address, BigInt(0), publicClient);
        const isDeployed = await isSimpleAccountDeployed(simpleAccountAddress, publicClient);

        setStatus({
          walletType: 'eoa',
          smartAccountAddress: simpleAccountAddress,
          smartAccountStatus: isDeployed ? 'deployed' : 'not-deployed',
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        console.error('Error detecting wallet status:', error);
        setStatus({
          walletType: 'eoa', // Default to EOA if detection fails
          smartAccountAddress: null,
          smartAccountStatus: 'error',
          isLoading: false,
          error: error.message || 'Failed to detect wallet status',
        });
      }
    }

    detectWalletStatus();
  }, [address, isConnected, publicClient]);

  return status;
}
