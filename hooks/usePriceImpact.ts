import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export type ImpactLevel = 'positive' | 'negative' | 'neutral';

export interface PriceImpactResult {
  impactLevel: ImpactLevel;
  impactPercentage: number;       // Estimated % impact (positive = bonus, negative = penalty)
  impactColor: string;            // Tailwind color class
  impactBgColor: string;          // Background color class
  impactLabel: string;            // Human readable label
  estimatedGmTokens: number;      // Estimated GM tokens to receive
  effectiveDepositUsd: number;    // Total USD value after impact
  longDepositUsd: number;         // USD value of long deposit
  shortDepositUsd: number;        // USD value of short deposit
}

interface UsePriceImpactParams {
  marketAddress?: string;
  longAmount: number;             // Amount of long token to deposit
  shortAmount: number;            // Amount of short token to deposit
}

// Helper to parse GMX 30-decimal price format
const parseGmxPrice = (rawPrice: any): number => {
  if (typeof rawPrice === 'number') return rawPrice;
  if (typeof rawPrice === 'object' && rawPrice?.price) {
    const priceStr = rawPrice.price.toString();
    const priceBigInt = BigInt(priceStr);
    return Number(priceBigInt) / 1e30;
  }
  return 0;
};

/**
 * Hook to calculate and display price impact for deposit
 * 
 * Price Impact Logic:
 * - If deposit helps BALANCE the pool → Positive (bonus, green)
 * - If deposit makes pool MORE IMBALANCED → Negative (penalty, red)
 * - If deposit maintains balance → Neutral (yellow)
 */
export function usePriceImpact({
  marketAddress,
  longAmount,
  shortAmount,
}: UsePriceImpactParams) {
  
  // Fetch market data
  const { data: markets, isLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: () => apiClient.getMarkets(),
    staleTime: 10000,
    refetchInterval: 10000,
  });

  const result = useMemo((): PriceImpactResult | null => {
    if (!markets || !marketAddress) return null;
    if (longAmount <= 0 && shortAmount <= 0) return null;

    // Find market
    const market = markets.find(
      (m: any) => m.address.toLowerCase() === marketAddress.toLowerCase()
    );
    if (!market) return null;

    // Get prices
    const longTokenPrice = parseGmxPrice(market.longTokenPrice);
    const shortTokenPrice = parseGmxPrice(market.shortTokenPrice) || 1;
    
    if (longTokenPrice <= 0) return null;

    // Current pool state
    const currentLongPoolUsd = market.longPoolUsd || 0;
    const currentShortPoolUsd = market.shortPoolUsd || 0;
    const currentTotalPoolUsd = currentLongPoolUsd + currentShortPoolUsd;

    if (currentTotalPoolUsd <= 0) {
      // Empty pool - no impact calculation possible
      return {
        impactLevel: 'neutral',
        impactPercentage: 0,
        impactColor: 'text-yellow-400',
        impactBgColor: 'bg-yellow-500/20',
        impactLabel: 'New Pool',
        estimatedGmTokens: 0,
        effectiveDepositUsd: 0,
        longDepositUsd: 0,
        shortDepositUsd: 0,
      };
    }

    // Calculate deposit values in USD
    const longDepositUsd = longAmount * longTokenPrice;
    const shortDepositUsd = shortAmount * shortTokenPrice;
    const totalDepositUsd = longDepositUsd + shortDepositUsd;

    if (totalDepositUsd <= 0) return null;

    // Current pool percentages
    const currentLongPercent = currentLongPoolUsd / currentTotalPoolUsd;
    const currentShortPercent = currentShortPoolUsd / currentTotalPoolUsd;
    
    // Determine which side user is depositing to (single-sided or pair)
    const isLongOnly = longDepositUsd > 0 && shortDepositUsd === 0;
    const isShortOnly = shortDepositUsd > 0 && longDepositUsd === 0;
    const isPair = longDepositUsd > 0 && shortDepositUsd > 0;
    
    // Calculate imbalance BEFORE and AFTER deposit
    const beforeImbalance = Math.abs(currentLongPercent - 0.5); // 0 = perfect, 0.5 = 100% one-sided
    
    const afterLongPoolUsd = currentLongPoolUsd + longDepositUsd;
    const afterShortPoolUsd = currentShortPoolUsd + shortDepositUsd;
    const afterTotalPoolUsd = afterLongPoolUsd + afterShortPoolUsd;
    const afterLongPercent = afterLongPoolUsd / afterTotalPoolUsd;
    const afterImbalance = Math.abs(afterLongPercent - 0.5);
    
    // === SIMPLIFIED IMPACT CALCULATION ===
    // Based on GMX mechanics:
    // - Single-sided deposit to majority side → penalty proportional to imbalance
    // - Single-sided deposit to minority side → bonus proportional to imbalance  
    // - Balanced (50/50) deposit → near-zero impact
    
    let impactPercentage = 0;
    
    // Calculate how far from 50/50 the pool is (0 = balanced, 0.1 = 60/40, 0.2 = 70/30)
    const imbalanceAmount = Math.abs(currentLongPercent - 0.5);
    const majorityIsLong = currentLongPercent > 0.5;
    
    if (isPair) {
      // Pair deposit - calculate based on ratio
      const depositLongRatio = longDepositUsd / totalDepositUsd;
      const depositShortRatio = shortDepositUsd / totalDepositUsd;
      
      // If deposit ratio matches pool ratio, impact ~ 0
      // If deposit helps balance, positive impact
      // If deposit hurts balance, negative impact
      if (Math.abs(depositLongRatio - 0.5) < 0.05) {
        // Near 50/50 deposit = minimal impact
        impactPercentage = 0;
      } else if ((majorityIsLong && depositShortRatio > 0.5) || (!majorityIsLong && depositLongRatio > 0.5)) {
        // Depositing more of the minority token = positive impact
        impactPercentage = imbalanceAmount * 20; // Up to +10% bonus for very imbalanced pools
      } else {
        // Depositing more of the majority token = negative impact
        impactPercentage = -imbalanceAmount * 30; // Up to -15% penalty
      }
    } else if (isLongOnly) {
      if (majorityIsLong) {
        // Depositing Long when pool already has more Long → BIG PENALTY
        // Impact scales with imbalance: 10% excess → ~20% penalty, 20% excess → ~40% penalty
        impactPercentage = -imbalanceAmount * 200; // e.g., 0.1 (60/40) * 200 = -20%
      } else {
        // Depositing Long when pool needs more Long → BONUS
        impactPercentage = imbalanceAmount * 50; // e.g., 0.1 (40/60) * 50 = +5%
      }
    } else if (isShortOnly) {
      if (!majorityIsLong) {
        // Depositing Short when pool already has more Short → BIG PENALTY
        impactPercentage = -imbalanceAmount * 200;
      } else {
        // Depositing Short when pool needs more Short → BONUS
        impactPercentage = imbalanceAmount * 50;
      }
    }
    
    // GMX typically has impacts from -35% to +10%
    impactPercentage = Math.max(-35, Math.min(10, impactPercentage));

    // Determine impact level and colors
    let impactLevel: ImpactLevel;
    let impactColor: string;
    let impactBgColor: string;
    let impactLabel: string;

    if (impactPercentage > 1) {
      // Positive impact - helping balance the pool
      impactLevel = 'positive';
      impactColor = 'text-emerald-400';
      impactBgColor = 'bg-emerald-500/20';
      impactLabel = `+${impactPercentage.toFixed(1)}% Bonus`;
    } else if (impactPercentage < -1) {
      // Negative impact - making pool more imbalanced
      impactLevel = 'negative';
      impactColor = 'text-red-400';
      impactBgColor = 'bg-red-500/20';
      impactLabel = `${impactPercentage.toFixed(1)}% Loss`;
    } else {
      // Neutral - minimal impact
      impactLevel = 'neutral';
      impactColor = 'text-yellow-400';
      impactBgColor = 'bg-yellow-500/20';
      impactLabel = '~0% Impact';
    }

    // Estimate GM tokens received
    // GM tokens = (deposit USD * (1 + impact%)) / GM price
    const gmTokenPrice = market.marketTokenPrice || 1;
    const effectiveDepositUsd = totalDepositUsd * (1 + impactPercentage / 100);
    const estimatedGmTokens = gmTokenPrice > 0 ? effectiveDepositUsd / gmTokenPrice : 0;

    return {
      impactLevel,
      impactPercentage,
      impactColor,
      impactBgColor,
      impactLabel,
      estimatedGmTokens,
      effectiveDepositUsd,
      longDepositUsd,
      shortDepositUsd,
    };
  }, [markets, marketAddress, longAmount, shortAmount]);

  return {
    data: result,
    isLoading,
  };
}
