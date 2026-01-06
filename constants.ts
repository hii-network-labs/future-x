
import { MarketSide, Position, PendingOrder, Vault, LPPosition, OrderType, OrderStatus } from './types';

// Environment-based Configuration (Vite uses import.meta.env)
export const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '22469');
export const CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME || "Custom GMX";
export const RPC_URL = import.meta.env.VITE_RPC_URL || "http://115.75.100.60:8545";
export const KEEPER_API_URL = import.meta.env.VITE_KEEPER_API_URL || "http://127.0.0.1:9090";
export const EXPLORER_URL = import.meta.env.VITE_EXPLORER_URL || "https://arbiscan.io";

export const CONTRACTS = {
  market: import.meta.env.VITE_MARKET_ADDRESS || "0x68dE251394Ccfda893Cc6796B68e5A8b6944F66e",
  wnt: import.meta.env.VITE_WNT_ADDRESS || "0xd020d6D39b5550bdc3440Ff8f6EA5f1Cf745b13c",
  usdc: import.meta.env.VITE_USDC_ADDRESS || "0xE0105CF6930e8767ADb5425ddc7f8B6df25699A6",
  exchangeRouter: import.meta.env.VITE_EXCHANGE_ROUTER || "0xD5c0a7DFe2e4a5D1BE5927d0816393d145a3f0d5",
  orderVault: import.meta.env.VITE_ORDER_VAULT || "0xe5474698f1A1c0381BB21476BdA1A4968d017D3a",
  reader: import.meta.env.VITE_READER_ADDRESS || "0x81ec3c87553EDaBd7b391AED31ee6EDd51Ec54b7",
  dataStore: import.meta.env.VITE_DATASTORE_ADDRESS || "0xF2ea404864b2E9cd5DCA985079Bee6e9BC3AedE2",
  depositVault: import.meta.env.VITE_DEPOSIT_VAULT || "0x228FB4eAfACbA605Fc7b160BEd7A4fd1a21E804B",
  withdrawalVault: import.meta.env.VITE_WITHDRAWAL_VAULT || "0x8E01E9a99A730bdEd580160D55d9B266127B298A",
} as const;

export const FEES = {
  minExecutionFee: import.meta.env.VITE_MIN_EXECUTION_FEE || "0.015", // ETH
};

export const getTokenDecimals = (address: string) => {
  const addr = address.toLowerCase();
  if (addr === CONTRACTS.usdc.toLowerCase()) return 6;
  if (addr === CONTRACTS.wnt.toLowerCase()) return 18;
  return 18; // Default to 18
};

export const getTokenSymbol = (address: string) => {
  const addr = address.toLowerCase();
  if (addr === CONTRACTS.usdc.toLowerCase()) return "USDC";
  if (addr === CONTRACTS.wnt.toLowerCase()) return "HNC";
  return "???";
};

export const getMarketName = (address: string) => {
  const addr = address.toLowerCase();
  if (addr === CONTRACTS.market.toLowerCase()) return "ETH-USD";
  return "Unknown";
};

export const GMX_DECIMALS = 30;
export const USDC_DECIMALS = 6;

export const COLORS = {
  bg: "#0C111A",
  surface: "#111827",
  surfaceLight: "#1A1F2B",
  border: "#1F2937",
  primary: "#34D399", 
  secondary: "#06B6D4", 
  warning: "#FBBF24", 
  danger: "#EF4444", 
};

// Fix: Added missing MOCK_ORDERS constant for TradeConsole activity history
export const MOCK_ORDERS: PendingOrder[] = [
  {
    id: '1',
    type: OrderType.INCREASE,
    side: MarketSide.LONG,
    size: 25000,
    price: 2850.45,
    status: OrderStatus.EXECUTED,
    timestamp: Date.now() - 3600000,
  },
  {
    id: '2',
    type: OrderType.DECREASE,
    side: MarketSide.SHORT,
    size: 15000,
    price: 2845.12,
    status: OrderStatus.FAILED,
    timestamp: Date.now() - 7200000,
  }
];

// Fix: Added missing MOCK_VAULTS constant for LiquidityConsole
export const MOCK_VAULTS: Vault[] = [
  {
    id: 'eth-vault',
    name: 'ETH Core Vault',
    token: 'USDC',
    tokenAddress: CONTRACTS.market, // Uses real GM for dev
    markets: ['ETH-USD'],
    totalLiquidity: 25400000,
    utilization: 64.5,
    pnl24h: 12500,
    risk: 'Low',
  },
  {
    id: 'btc-vault',
    name: 'BTC Alpha Vault',
    token: 'USDC',
    tokenAddress: CONTRACTS.market,
    markets: ['BTC-USD'],
    totalLiquidity: 15200000,
    utilization: 72.1,
    pnl24h: -4200,
    risk: 'Medium',
  },
  {
    id: 'multi-asset',
    name: 'DeFi Index Vault',
    token: 'USDC',
    markets: ['SOL-USD', 'ARB-USD', 'LINK-USD'],
    totalLiquidity: 1950000,
    utilization: 89.2,
    pnl24h: 38500,
    risk: 'High',
  }
];

// Fix: Added missing MOCK_LP_POSITIONS constant for LiquidityConsole
export const MOCK_LP_POSITIONS: LPPosition[] = [
  {
    id: 'lp-1',
    vaultId: 'eth-vault',
    vaultName: 'ETH Core Vault',
    deposited: 25000,
    share: 0.098,
    pnl: 450.25,
    feesEarned: 120.40,
    utilizationExposure: 64.5,
  }
];
