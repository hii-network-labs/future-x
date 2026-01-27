
import { MarketSide, Position, PendingOrder, Vault, LPPosition, OrderType, OrderStatus } from './types';

// Environment-based Configuration (Vite uses import.meta.env)
export const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '22469');
export const CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME || "Custom GMX";
export const RPC_URL = import.meta.env.VITE_RPC_URL || "https://rpc-public.teknix.dev";
export const KEEPER_API_URL = import.meta.env.VITE_KEEPER_API_URL || "http://localhost:9090";
export const EXPLORER_URL = import.meta.env.VITE_EXPLORER_URL || "https://arbiscan.io";
export const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL || "https://subgraph-gmx.teknix.dev";

export const CONTRACTS = {
  market: import.meta.env.VITE_MARKET_ADDRESS || "0x68dE251394Ccfda893Cc6796B68e5A8b6944F66e",
  wnt: import.meta.env.VITE_WNT_ADDRESS || "0xd020d6D39b5550bdc3440Ff8f6EA5f1Cf745b13c",
  usdc: import.meta.env.VITE_USDC_ADDRESS || "0xE0105CF6930e8767ADb5425ddc7f8B6df25699A6",
  exchangeRouter: import.meta.env.VITE_EXCHANGE_ROUTER || "0xD5c0a7DFe2e4a5D1BE5927d0816393d145a3f0d5",
  router: import.meta.env.VITE_ROUTER || "0x25bdBd9c21497D276000D4ebB9203DbE2eD408f7", // Correct spender for GMX V2
  orderVault: import.meta.env.VITE_ORDER_VAULT || "0xe5474698f1A1c0381BB21476BdA1A4968d017D3a",
  reader: import.meta.env.VITE_READER_ADDRESS || "0x81ec3c87553EDaBd7b391AED31ee6EDd51Ec54b7",
  dataStore: import.meta.env.VITE_DATASTORE_ADDRESS || "0xF2ea404864b2E9cd5DCA985079Bee6e9BC3AedE2",
  depositVault: import.meta.env.VITE_DEPOSIT_VAULT || "0x228FB4eAfACbA605Fc7b160BEd7A4fd1a21E804B",
  withdrawalVault: import.meta.env.VITE_WITHDRAWAL_VAULT || "0x8E01E9a99A730bdEd580160D55d9B266127B298A",
} as const;

export const FEES = {
  minExecutionFee: import.meta.env.VITE_MIN_EXECUTION_FEE || "0.1", // ETH/HNC
};

export const getTokenDecimals = (address: string) => {
  const addr = address.toLowerCase();
  if (addr === CONTRACTS.usdc.toLowerCase()) return 6;
  if (addr === CONTRACTS.wnt.toLowerCase()) return 18;
  return 18; // Default to 18
};

// Token metadata is now resolved dynamically in hooks/useMetadata.ts

export const GMX_DECIMALS = 30;
export const USDC_DECIMALS = 6;

// Helper to format GMX prices from keeper API
// Keeper returns: priceUsd * 10^(30 - tokenDecimals)
// - WNT (18 dec): 1110 USD -> 1110 * 10^12 = 1.11e15
// - USDC (6 dec): 1 USD -> 1 * 10^24 = 1e24
//
// @param priceStr - The raw price string from API
// @param tokenDecimals - Optional. Token decimals (18 for WNT, 6 for USDC). 
//                        If provided, uses exact formula. If not, estimates from magnitude.
export const formatGmxPrice = (priceStr?: string | number, tokenDecimals?: number): number => {
  if (!priceStr) return 0;
  
  // Convert number to string to avoid BigInt errors
  const str = priceStr.toString();
  
  try {
    // If scientific notation (e.g. 1.2e+22), BigInt might fail. 
    // If it's a small float (0.05), BigInt fails.
    // If it's a huge integer string, BigInt works.
    
    // Check if it's already a small float?
    if (str.includes('.') && !str.includes('e')) {
       const f = parseFloat(str);
       if (Math.abs(f) < 1000000000) return f; // It's likely already formatted
    }
    
    // Handle Scientific Notation by expanding it? 
    // Or just let BigInt try. BigInt("1.2e+22") throws.
    
    let val: bigint;
    try {
      val = BigInt(str);
    } catch {
       // Fallback for floats/scientific
       return parseFloat(str);
    }
    
    if (val === 0n) return 0;
    
    let precision: number;
    
    if (tokenDecimals !== undefined) {
      precision = 30 - tokenDecimals;
    } else {
      const digits = str.length;
      
      // Bucket by digit count
      if (digits >= 27) {
        precision = 30; // 1e30 range
      } else if (digits >= 20) {
        precision = 24; // 1e24 range (USDC 6 dec) -> 10^20 is $0.0001
      } else if (digits >= 11) {
        precision = 12; // 1e12 range (WNT 18 dec)
      } else {
        precision = 0; // Assume strictly formatted
        return Number(val);
      }
    }
    
    const divisor = BigInt(10) ** BigInt(precision > 2 ? precision - 2 : 0);
    const num = Number(val / divisor);
    return precision > 2 ? num / 100 : num;
    
  } catch {
    return 0;
  }
};


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
    marketData: {
        marketToken: CONTRACTS.market as `0x${string}`,
        indexToken: CONTRACTS.wnt as `0x${string}`,
        longToken: CONTRACTS.wnt as `0x${string}`,
        shortToken: CONTRACTS.usdc as `0x${string}`,
        name: 'ETH-USD',
        indexSymbol: 'WNT',
        longSymbol: 'WNT',
        shortSymbol: 'USDC',
        isActive: true
    }
  },
  {
    id: 'gmx-vault',
    name: 'GMX Core Vault',
    token: 'USDC',
    tokenAddress: "0x121116C613a78A82de601803d40203bA364E7BCf",
    markets: ['GMX-USD'],
    totalLiquidity: 10000000,
    utilization: 10.5,
    pnl24h: 200,
    risk: 'High',
    marketData: {
        marketToken: "0x121116C613a78A82de601803d40203bA364E7BCf" as `0x${string}`,
        indexToken: "0xEFB08a9589b6238441935185FDf5B57B6101466f" as `0x${string}`, // GMX
        longToken: "0xEFB08a9589b6238441935185FDf5B57B6101466f" as `0x${string}`, // GMX
        shortToken: CONTRACTS.usdc as `0x${string}`,
        name: 'GMX-USD',
        indexSymbol: 'GMX',
        longSymbol: 'GMX',
        shortSymbol: 'USDC',
        isActive: true
    }
  },
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
