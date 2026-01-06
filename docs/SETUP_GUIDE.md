# Custom GMX Futures Console - Setup Guide

## 📋 Overview

This guide walks you through setting up and running the Custom GMX Futures Console with real GMX V2 contract integration.

## 🔧 Prerequisites

- **Bun** or **Node.js 18+**
- **MetaMask** or compatible Web3 wallet
- Access to **GMX V2 Keeper Service** (running on port 9090 or via ngrok)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd custom-gmx-futures-console
bun install
# or
npm install
```

### 2. Install GMX Integration Dependencies

The current `package.json` only has React dependencies. Add wallet and blockchain integration:

```bash
bun add wagmi viem @rainbow-me/rainbowkit @tanstack/react-query
# or
npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query
```

### 3. Configure Environment

Create a `.env.local` file:

```bash
# Chain Configuration
VITE_CHAIN_ID=22469
VITE_CHAIN_NAME=Custom GMX Chain
VITE_RPC_URL=http://115.75.100.60:8545

# Keeper Service API
VITE_KEEPER_API_URL=http://127.0.0.1:9090
# If keeper is behind ngrok, use that URL:
# VITE_KEEPER_API_URL=https://03d1c591bf91.ngrok-free.app

# WalletConnect Project ID (get from https://cloud.walletconnect.com)
VITE_WALLET_CONNECT_PROJECT_ID=your_project_id_here

# GMX V2 Contract Addresses
VITE_MARKET_ADDRESS=0x68dE251394Ccfda893Cc6796B68e5A8b6944F66e
VITE_WNT_ADDRESS=0xd020d6D39b5550bdc3440Ff8f6EA5f1Cf745b13c
VITE_USDC_ADDRESS=0xE0105CF6930e8767ADb5425ddc7f8B6df25699A6
VITE_EXCHANGE_ROUTER=0xD5c0a7DFe2e4a5D1BE5927d0816393d145a3f0d5
VITE_ORDER_VAULT=0xe5474698f1A1c0381BB21476BdA1A4968d017D3a
VITE_READER_ADDRESS=0x81ec3c87553EDaBd7b391AED31ee6EDd51Ec54b7
VITE_DATASTORE_ADDRESS=0xF2ea404864b2E9cd5DCA985079Bee6e9BC3AedE2
VITE_DEPOSIT_VAULT=0x228FB4eAfACbA605Fc7b160BEd7A4fd1a21E804B
VITE_WITHDRAWAL_VAULT=0x8E01E9a99A730bdEd580160D55d9B266127B298A

# Execution Fees
VITE_MIN_EXECUTION_FEE=0.015
```

### 4. Start Keeper Service

The UI depends on the Keeper Service for real-time prices. Start it in a separate terminal:

```bash
cd ../gmx-sdk/keeper-service
bun run dev
# Server will run on http://127.0.0.1:9090
```

Verify keeper is running:
```bash
curl http://127.0.0.1:9090/prices
# Should return: {"timestamp":..., "prices":{"0x...":"300000..."}}
```

### 5. Start Frontend

```bash
cd custom-gmx-futures-console
bun run dev
# or
npm run dev
```

Open browser at `http://localhost:5173`

## 🔄 Current Integration Status

### ✅ Working Features
- **Price Polling**: Real ETH/USDC prices from Keeper Service
- **UI/UX**: Complete trading console interface
- **Mock Trading**: Simulated order flow for testing

### ⚠️ Needs Integration (See INTEGRATION_GUIDE.md)
- **Wallet Connection**: Replace mock with real wagmi/RainbowKit
- **Order Creation**: Implement actual multicall to ExchangeRouter
- **Position Fetching**: Query Reader contract for real positions
- **Liquidity Operations**: Add/remove liquidity via DepositVault

## 📚 Integration Steps

Follow these steps to convert mock UI to functional trading:

### Step 1: Setup Wallet Provider

Update `index.tsx` to wrap app with Wagmi providers (see `INTEGRATION_GUIDE.md` Section 1)

### Step 2: Update Constants

Replace hardcoded values in `constants.ts` with environment variables:

```typescript
// constants.ts
export const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '22469');
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'http://localhost:8545';
export const KEEPER_API_URL = import.meta.env.VITE_KEEPER_API_URL || 'http://127.0.0.1:9090';

export const CONTRACTS = {
  market: import.meta.env.VITE_MARKET_ADDRESS,
  wnt: import.meta.env.VITE_WNT_ADDRESS,
  usdc: import.meta.env.VITE_USDC_ADDRESS,
  // ... etc
} as const;
```

### Step 3: Implement Real Wallet Connection

Update `App.tsx` to use wagmi hooks instead of mock state:

```typescript
import { useAccount, useChainId } from 'wagmi';

const App = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  const chainState = {
    address,
    isConnected,
    chainId,
    isCorrectChain: chainId === CHAIN_ID,
    name: chainId === CHAIN_ID ? CHAIN_NAME : 'Wrong Network'
  };
  
  // ...
};
```

### Step 4: Implement Real Order Creation

Update `useGmxProtocol.ts` to use `useWalletClient` and actual contract calls:

```typescript
import { useWalletClient } from 'wagmi';
import { encodeFunctionData, parseUnits } from 'viem';

export function useGmxProtocol(address: string | null) {
  const { data: walletClient } = useWalletClient();
  
  const createOrder = async (params) => {
    if (!walletClient) throw new Error('Wallet not connected');
    
    // Build multicall as shown in INTEGRATION_GUIDE.md Section 3
    const calls = [
      encodeFunctionData({ /* sendWnt */ }),
      encodeFunctionData({ /* sendTokens */ }),
      encodeFunctionData({ /* createOrder */ })
    ];
    
    const txHash = await walletClient.writeContract({
      address: CONTRACTS.exchangeRouter,
      abi: MULTICALL_ABI,
      functionName: 'multicall',
      args: [calls],
      value: executionFee
    });
    
    return txHash;
  };
  
  // ...
}
```

### Step 5: Fetch Real Positions

Add `usePositions` hook to query Reader contract:

```typescript
import { usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';

const { data: positions } = useQuery({
  queryKey: ['positions', address],
  queryFn: async () => {
    const posInfos = await publicClient.readContract({
      address: CONTRACTS.reader,
      abi: READER_ABI,
      functionName: 'getAccountPositions',
      args: [CONTRACTS.dataStore, address, 0n, 50n]
    });
    return posInfos;
  },
  enabled: !!address,
  refetchInterval: 3000
});
```

## 🧪 Testing Workflow

1. **Start Keeper Service** (Terminal 1)
   ```bash
   cd keeper-service
   bun run dev
   ```

2. **Start Frontend** (Terminal 2)
   ```bash
   cd custom-gmx-futures-console
   bun run dev
   ```

3. **Connect Wallet** via UI

4. **Test Price Feed**: Verify prices update every 2 seconds

5. **Test Order Creation** (Mock Mode):
   - Enter collateral + size
   - Click "Open Long" or "Open Short"
   - Check console logs for protocol request

6. **Upgrade to Real Trading**: Follow integration steps above

## 🔍 Troubleshooting

### Keeper Service Not Responding
```bash
# Check if keeper is running
curl http://127.0.0.1:9090/prices

# If using ngrok, update VITE_KEEPER_API_URL
# Open ngrok URL in browser first to bypass warning page
```

### CORS Errors
If keeper is on different port, ensure CORS is enabled in keeper service:
```typescript
// keeper-service/src/index.ts
app.get('/prices', async (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  // ...
});
```

### Wrong Network
- Ensure MetaMask is connected to Chain ID 22469
- Update network in MetaMask settings if needed
- Click "Switch Network" banner in UI

### RPC Connection Failed
- Verify `VITE_RPC_URL` is accessible
- Test with: `curl http://115.75.100.60:8545 -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`

## 📖 Full Integration Reference

For complete code examples and detailed implementation guide, see:
- **INTEGRATION_GUIDE.md** in this directory
- **Working Example**: `../gmx-sdk/frontend/` directory

## 🛠️ Project Structure

```
custom-gmx-futures-console/
├── components/
│   ├── TradeConsole.tsx    # Main trading interface
│   ├── OrderPanel.tsx       # Order entry form
│   ├── PositionsPanel.tsx   # Active positions display
│   ├── Portfolio.tsx        # Portfolio overview
│   └── LiquidityConsole.tsx # LP management
├── hooks/
│   └── useGmxProtocol.ts    # GMX integration logic
├── constants.ts             # Config & addresses
├── types.ts                 # TypeScript definitions
├── App.tsx                  # Main app component
└── .env.local              # Environment config
```

## 🚀 Deployment

### Build for Production

```bash
bun run build
# or
npm run build
```

Output will be in `dist/` directory.

### Preview Production Build

```bash
bun run preview
# or
npm run preview
```

### Deploy to Vercel/Netlify

1. Push to GitHub
2. Connect repo to Vercel/Netlify
3. Set environment variables in dashboard
4. Deploy

**Important**: Ensure Keeper Service is publicly accessible (e.g., via ngrok or deployed separately)

## 📝 Next Steps

1. ✅ **Complete Wallet Integration** - Follow INTEGRATION_GUIDE.md
2. ✅ **Test on Testnet** - Use small amounts
3. ✅ **Add Error Handling** - Toast notifications for failures
4. ✅ **Implement Position Management** - Close/modify positions
5. ✅ **Add Liquidity Features** - Deposit/withdraw from vaults

## 🔗 Resources

- **GMX V2 Docs**: https://docs.gmx.io/docs/category/contracts-v2
- **Wagmi**: https://wagmi.sh
- **Vite**: https://vitejs.dev
- **RainbowKit**: https://www.rainbowkit.com

---

**Status**: 🟡 **Mock UI Ready** → Follow integration guide to enable real trading

**Support**: Check `INTEGRATION_GUIDE.md` for detailed implementation examples
