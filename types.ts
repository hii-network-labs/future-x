
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
}

export interface LPPosition {
  id: string;
  vaultId: string;
  vaultName: string;
  deposited: number;
  share: number; // percentage
  pnl: number;
  feesEarned: number;
  utilizationExposure: number;
}
