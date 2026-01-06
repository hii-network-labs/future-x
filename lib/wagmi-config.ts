import { http, createConfig } from 'wagmi';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { 
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { CHAIN_ID, CHAIN_NAME, RPC_URL } from '../constants';

const chains = [{
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
}] as const;

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [injectedWallet],
    },
  ],
  {
    appName: 'GMX Trading Console',
    projectId: 'N/A', 
  }
);

export const config = createConfig({
  connectors,
  chains: [chains[0]],
  transports: {
    [CHAIN_ID]: http(RPC_URL)
  },
  ssr: true,
});
