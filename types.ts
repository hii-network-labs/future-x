
export enum MarketSide {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}

export enum OrderType {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export interface Position {
  id: string;
  market: string;
  side: MarketSide;
  size: number; // USD
  collateral: number; // USD
  entryPrice: number;
  markPrice: number;
  leverage: number;
  liqPrice: number;
  pnl: number;
}

export interface PendingOrder {
  id: string;
  type: OrderType;
  side: MarketSide;
  size: number;
  price: number;
  status: OrderStatus;
  timestamp: number;
}

export interface ChainState {
  chainId: number;
  name: string;
  isConnected: boolean;
  isCorrectChain: boolean;
  address: string | null;
}

export interface SystemStatus {
  oracle: 'Fresh' | 'Stale';
  keeper: 'Online' | 'Degraded';
  network: 'Connected' | 'Error';
}

// LP Specific Types
export interface Vault {
  id: string;
  name: string;
  token: string;
  tokenAddress?: string; // e.g. GM Token Address
  markets: string[];
  totalLiquidity: number;
  utilization: number;
  pnl24h: number;
  risk: 'Low' | 'Medium' | 'High';
  marketData?: Market; // Linked market data for dynamic vaults
}

export interface LPPosition {
  id: string;
  vaultId: string;
  vaultName: string;
  vault?: Vault; // Attached vault object for actions
  deposited: number;
  share: number; // percentage
  pnl: number;
  feesEarned: number;
  utilizationExposure: number;
}

// Market represents a trading pair (e.g., WNT-USD, BTC-USD)
export interface Market {
  marketToken: `0x${string}`;     // GM token / market address
  indexToken: `0x${string}`;      // Token being traded (WNT, BTC)
  longToken: `0x${string}`;       // Collateral for longs
  shortToken: `0x${string}`;      // Collateral for shorts (usually USDC)
  name: string;                    // Display name: "WNT-USD"
  indexSymbol: string;            // "WNT", "BTC"
  longSymbol: string;             // "WNT"
  shortSymbol: string;            // "USDC"
  indexDecimals?: number;         // Decimals of index token (e.g. 18 for WNT, 8 for BTC)
  longDecimals?: number;          // Decimals of long token
  poolValueUsd?: number;          // Total liquidity in USD
  isActive: boolean;              // Has sufficient liquidity
}
