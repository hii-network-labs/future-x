import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface OptimalDepositResult {
  longAmount: string;        // Amount of long token to deposit
  shortAmount: string;       // Amount of short token to deposit
  longUsd: number;           // USD value of long portion
  shortUsd: number;          // USD value of short portion
  estimatedImpact: 'neutral' | 'positive' | 'negative';
  poolImbalance: {
    longPercentage: number;
    shortPercentage: number;
    isBalanced: boolean;     // Within 5% of 50/50
  };
}

interface UseOptimalDepositParams {
  marketAddress?: string;
  totalUsd: number;          // Total USD user wants to deposit
  longTokenDecimals?: number;
  shortTokenDecimals?: number;
}

/**
 * Hook to calculate optimal deposit amounts for zero/minimal price impact
 * 
 * Strategy: 50/50 USD split between Long and Short tokens
 * - This maintains pool balance and results in neutral price impact
 */
export function useOptimalDeposit({
  marketAddress,
  totalUsd,
  longTokenDecimals = 18,
  shortTokenDecimals = 6,
}: UseOptimalDepositParams) {
  
  // Fetch market data (includes prices and pool composition)
  const { data: markets, isLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: () => apiClient.getMarkets(),
    staleTime: 10000, // 10 seconds
    refetchInterval: 10000,
  });

  const result = useMemo((): OptimalDepositResult | null => {
    if (!markets || !marketAddress || totalUsd <= 0) return null;

    // Find the specific market
    const market = markets.find(
      (m: any) => m.address.toLowerCase() === marketAddress.toLowerCase()
    );

    if (!market) return null;

    // Get prices (handle both number and object formats)
    const rawLongPrice = market.longTokenPrice;
    const rawShortPrice = market.shortTokenPrice;
    
    // Helper to parse GMX price format (30 decimals)
    const parseGmxPrice = (rawPrice: any): number => {
      if (typeof rawPrice === 'number') return rawPrice;
      if (typeof rawPrice === 'object' && rawPrice?.price) {
        const priceStr = rawPrice.price.toString();
        // GMX prices are in 30 decimals, convert to USD
        const priceBigInt = BigInt(priceStr);
        // Divide by 10^30 to get USD value
        return Number(priceBigInt) / 1e30;
      }
      return 0;
    };
    
    const longTokenPrice = parseGmxPrice(rawLongPrice);
    const shortTokenPrice = parseGmxPrice(rawShortPrice) || 1; // Default to $1 for stables

    console.log('🔍 Parsed prices (USD):', { longTokenPrice, shortTokenPrice });

    if (longTokenPrice <= 0) return null;

    // Calculate pool imbalance
    const longPoolUsd = market.longPoolUsd || 0;
    const shortPoolUsd = market.shortPoolUsd || 0;
    const totalPoolUsd = longPoolUsd + shortPoolUsd;
    
    const longPercentage = totalPoolUsd > 0 ? (longPoolUsd / totalPoolUsd) * 100 : 50;
    const shortPercentage = totalPoolUsd > 0 ? (shortPoolUsd / totalPoolUsd) * 100 : 50;
    const isBalanced = Math.abs(longPercentage - 50) < 5; // Within 5% of 50/50

    // === CORE FORMULA: 50/50 Split for Zero Impact ===
    const halfUsd = totalUsd / 2;
    
    // Calculate token amounts
    const longAmount = halfUsd / longTokenPrice;
    const shortAmount = halfUsd / shortTokenPrice;

    // Determine estimated impact based on current pool state
    let estimatedImpact: 'neutral' | 'positive' | 'negative' = 'neutral';
    
    // If pool is already balanced, 50/50 deposit keeps it balanced = neutral
    // If pool is imbalanced and we're adding 50/50, impact is still minimal
    if (isBalanced) {
      estimatedImpact = 'neutral';
    } else {
      // Even with imbalanced pool, 50/50 deposit doesn't make it worse
      estimatedImpact = 'neutral';
    }

    return {
      longAmount: longAmount.toFixed(6),
      shortAmount: shortAmount.toFixed(shortTokenDecimals === 6 ? 2 : 6),
      longUsd: halfUsd,
      shortUsd: halfUsd,
      estimatedImpact,
      poolImbalance: {
        longPercentage,
        shortPercentage,
        isBalanced,
      },
    };
  }, [markets, marketAddress, totalUsd, shortTokenDecimals]);

  return {
    data: result,
    isLoading,
  };
}

/**
 * Calculate optimal single-sided deposit to "hunt" positive impact
 * 
 * Strategy: Deposit ONLY the token that the pool is short on
 * - This helps rebalance the pool and earns positive impact bonus
 */
export function calculatePositiveImpactDeposit(
  totalUsd: number,
  longPoolUsd: number,
  shortPoolUsd: number,
  longTokenPrice: number,
  shortTokenPrice: number
): { side: 'long' | 'short'; amount: string; estimatedBonus: string } {
  
  const totalPoolUsd = longPoolUsd + shortPoolUsd;
  
  if (totalPoolUsd === 0) {
    // Empty pool - default to short side (stablecoin)
    return {
      side: 'short',
      amount: (totalUsd / shortTokenPrice).toFixed(2),
      estimatedBonus: '0%',
    };
  }

  const longPercentage = (longPoolUsd / totalPoolUsd) * 100;
  
  // Deposit to the side that's under 50%
  if (longPercentage < 50) {
    // Pool needs more Long tokens
    return {
      side: 'long',
      amount: (totalUsd / longTokenPrice).toFixed(6),
      estimatedBonus: `+${((50 - longPercentage) * 0.1).toFixed(2)}%`, // Rough estimate
    };
  } else {
    // Pool needs more Short tokens
    return {
      side: 'short',
      amount: (totalUsd / shortTokenPrice).toFixed(2),
      estimatedBonus: `+${((longPercentage - 50) * 0.1).toFixed(2)}%`, // Rough estimate
    };
  }
}
