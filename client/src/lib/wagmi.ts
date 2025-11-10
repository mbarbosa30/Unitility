import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { http } from 'wagmi';

export const wagmiConfig = getDefaultConfig({
  appName: 'Paymaster Market',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'paymaster-market-default',
  chains: [base],
  transports: {
    [base.id]: http(import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
  },
  ssr: false,
});
