import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'Paymaster Market',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'paymaster-market-default',
  chains: [base],
  ssr: false,
});
