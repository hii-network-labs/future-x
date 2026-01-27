export interface ApiResponse<T> {
  data: T;
  statusCode: number;
  timestamp: string;
}

export interface TokenPrice {
  symbol: string;
  token: string;
  price: string;
  timestamp: number;
  signature?: string;
}

export interface Market {
  address: string; // Market Address
  indexToken: string;
  longToken: string;
  shortToken: string;
  name: string; // e.g. "ETH/USDC"
  
  indexSymbol: string;
  longSymbol: string;
  shortSymbol: string;
  
  indexDecimals: number;
  longDecimals: number;
  shortDecimals: number;

  indexTokenPrice?: TokenPrice | { price: string };
  longTokenPrice?: TokenPrice | { price: string };
  shortTokenPrice?: TokenPrice | { price: string };
}

export interface ProtocolStats {
  totalVolume: string;
  totalTvl: string;
  totalOpenInterest: string;
  totalUsers: number;
  activeMarkets: number;
}

export interface Order {
  key: string;
  type: string;
  status: 'open' | 'cancelled' | 'executed';
  market: string;
  triggerPrice: string;
  sizeDelta: string;
  isLong: boolean;
  created_at?: string;
}

export interface Position {
  key: string; // Position Key or ID
  market: string; // Market Name or Address
  collateralToken: string;
  sizeInUsd: string;
  collateralInUsd: string;
  pnl: string;
  isLong: boolean;
  leverage: number;
  markPrice?: string;
  entryPrice?: string;
  // Formatted values from API (floats)
  sizeInUsdFormatted?: number;
  collateralInUsdFormatted?: number;
  entryPriceFormatted?: number;
}

export interface TradeHistory {
  id: string;
  eventName: string;
  orderKey: string;
  orderType: string;
  account: string;
  marketAddress: string;
  sizeDeltaUsd: string;
  executionPrice: string;
  pnlUsd: string;
  positionFeeAmount: string;
  borrowingFeeAmount: string;
  fundingFeeAmount: string;
  isLong: boolean;
  timestamp: number;
  transaction: {
    hash: string;
  };
}

export interface LiquidityPosition {
  id: string;
  market: {
    marketToken: string;
    symbol: string;
  };
  liquidityTokenBalance: string;
}

const API_BASE_URL = import.meta.env.VITE_KEEPER_API_URL || 'http://localhost:3000/api';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, options);
    if (!res.ok) {
      throw new Error(`API Request failed: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data; // Extract data from standard response envelope
  }

  async getPrices(): Promise<Record<string, TokenPrice>> {
    // Returns object mapping address -> price info
    return this.fetch<Record<string, TokenPrice>>('/prices');
  }

  async getPrice(symbol: string): Promise<TokenPrice> {
    return this.fetch<TokenPrice>(`/prices/${symbol}`);
  }

  async getMarkets(): Promise<Market[]> {
    return this.fetch<Market[]>('/markets');
  }

  async getStats(): Promise<ProtocolStats> {
    return this.fetch<ProtocolStats>('/markets/overview');
  }

  async getOrders(account: string): Promise<Order[]> {
    if (!account) return [];
    return this.fetch<Order[]>(`/account/orders?account=${account}`);
  }

  async getPositions(account: string): Promise<Position[]> {
    if (!account) return [];
    return this.fetch<Position[]>(`/account/positions?account=${account}`);
  }

  async getHistory(account: string, page: number = 1, limit: number = 10): Promise<PaginatedResponse<TradeHistory>> {
    if (!account) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    return this.fetch<PaginatedResponse<TradeHistory>>(`/account/history?account=${account}&page=${page}&limit=${limit}`);
  }

  async getUserLiquidity(account: string): Promise<{ liquidityPositions: LiquidityPosition[] }> {
    if (!account) return { liquidityPositions: [] };
    // The controller returns an object with liquidityPositions array? Or directly array?
    // Based on my LiquidityController implementation: 
    // It calls apiAccountService.getLiquidityPositions -> returns subgraph result directly.
    // Subgraph result usually has { userGlpPositions, liquidityPositions } keys if not transformed.
    // Let's assume it returns the raw subgraph structure for now or whatever the service returns.
    // My previous check on LiquidityController example showed:
    // schema: { example: { liquidityPositions: [...] } }
    // So it returns an object.
    return this.fetch<{ liquidityPositions: LiquidityPosition[] }>(`/liquidity/user?account=${account}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
