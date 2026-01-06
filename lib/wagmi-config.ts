import { http, createConfig } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { CHAIN_ID, CHAIN_NAME, RPC_URL } from '../constants';

// Get WalletConnect Project ID from env
const walletConnectProjectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '';

export const config = getDefaultConfig({
  appName: 'GMX Trading Console',
  projectId: walletConnectProjectId,
  chains: [{
    id: CHAIN_ID,
    name: CHAIN_NAME,
    nativeCurrency: { 
      name: 'ETH', 
      symbol: 'ETH', 
      decimals: 18 
    },
    rpcUrls: {
      default: { http: [RPC_URL] },
      public: { http: [RPC_URL] }
    }
  }],
  transports: {
    [CHAIN_ID]: http(RPC_URL)
  }
});
