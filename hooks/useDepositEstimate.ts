import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS } from '../constants';
import { apiClient } from '../lib/api-client';

export interface DepositEstimateResult {
  estimatedGmTokens: number;       // Estimated GM tokens from on-chain
  estimatedUsd: number;            // USD value of GM tokens
  priceImpactPercent: number;      // Impact percentage
  impactLevel: 'positive' | 'negative' | 'neutral';
  impactColor: string;
  impactLabel: string;
  inputUsd: number;                // Input USD value
  source: 'on-chain' | 'formula';  // Estimation source
}

interface UseDepositEstimateParams {
  marketAddress?: string;
  longAmount: string;              // Token amount as string
  shortAmount: string;             // Token amount as string
}

// ABI for Reader.getDepositAmountOut
const READER_ABI = [
  {
    name: 'getDepositAmountOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'dataStore', type: 'address' },
      {
        name: 'market',
        type: 'tuple',
        components: [
          { name: 'marketToken', type: 'address' },
          { name: 'indexToken', type: 'address' },
          { name: 'longToken', type: 'address' },
          { name: 'shortToken', type: 'address' }
        ]
      },
      {
        name: 'prices',
        type: 'tuple',
        components: [
          {
            name: 'indexTokenPrice',
            type: 'tuple',
            components: [
              { name: 'min', type: 'uint256' },
              { name: 'max', type: 'uint256' }
            ]
          },
          {
            name: 'longTokenPrice',
            type: 'tuple',
            components: [
              { name: 'min', type: 'uint256' },
              { name: 'max', type: 'uint256' }
            ]
          },
          {
            name: 'shortTokenPrice',
            type: 'tuple',
            components: [
              { name: 'min', type: 'uint256' },
              { name: 'max', type: 'uint256' }
            ]
          }
        ]
      },
      { name: 'longTokenAmount', type: 'uint256' },
      { name: 'shortTokenAmount', type: 'uint256' },
      { name: 'uiFeeReceiver', type: 'address' },
      { name: 'swapPricingType', type: 'uint8' },
      { name: 'includeVirtualInventoryImpact', type: 'bool' }
    ],
    outputs: [{ type: 'uint256' }]
  }
];

/**
 * Convert GMX 30-decimal price to Oracle format
 * Oracle format: priceUsd * 10^(30 - tokenDecimals)
 * 
 * API returns: priceUint as string in 30 decimals (e.g., "66000000...30 zeros" for $66)
 * We need: price scaled for token decimals
 * 
 * @param priceUint - Price as string from API (30 decimals)
 * @param tokenDecimals - Token decimals (18 for GMX, 6 for USDC)
 */
function convertToOraclePrice(priceUint: string, tokenDecimals: number): bigint {
  // priceUint from API is already in 30 decimals
  // Oracle format needs: priceUsd * 10^(30 - tokenDecimals)
  // Since priceUint = priceUsd * 10^30, we need to divide by 10^tokenDecimals
  const fullPrice = BigInt(priceUint);
  const divisor = 10n ** BigInt(tokenDecimals);
  return fullPrice / divisor;
}

/**
 * Hook to estimate deposit output using on-chain Reader contract
 * Uses Reader.getDepositAmountOut for accurate estimation
 */
export function useDepositEstimate({
  marketAddress,
  longAmount,
  shortAmount,
}: UseDepositEstimateParams) {
  const publicClient = usePublicClient();

  // Fetch market data from API
  const { data: markets, isLoading: isLoadingMarkets } = useQuery({
    queryKey: ['markets'],
    queryFn: () => apiClient.getMarkets(),
    staleTime: 10000,
  });

  // On-chain estimation
  const { data, isLoading, error } = useQuery({
    queryKey: ['depositEstimate', marketAddress, longAmount, shortAmount],
    queryFn: async (): Promise<DepositEstimateResult | null> => {
      if (!marketAddress || !markets || !publicClient) return null;

      const longAmountNum = parseFloat(longAmount) || 0;
      const shortAmountNum = parseFloat(shortAmount) || 0;

      if (longAmountNum <= 0 && shortAmountNum <= 0) return null;

      // Find market data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const market = markets.find(
        (m: any) => m.address.toLowerCase() === marketAddress.toLowerCase()
      );
      if (!market) return null;

      // Get token decimals
      const longDecimals = market.longDecimals || 18;
      const shortDecimals = market.shortDecimals || 6;
      const gmPrice = market.marketTokenPrice || 1;

      // Parse prices from API (30 decimals) and convert to Oracle format
      const longTokenPriceRaw = market.longTokenPrice?.price || '0';
      const shortTokenPriceRaw = market.shortTokenPrice?.price || '0';

      // Convert to Oracle format: priceUsd * 10^(30 - tokenDecimals)
      const longTokenPrice = convertToOraclePrice(longTokenPriceRaw, longDecimals);
      const shortTokenPrice = convertToOraclePrice(shortTokenPriceRaw, shortDecimals);

      // Parse amounts to wei
      const longAmountWei = longAmountNum > 0 ? parseUnits(longAmount, longDecimals) : 0n;
      const shortAmountWei = shortAmountNum > 0 ? parseUnits(shortAmount, shortDecimals) : 0n;

      // Calculate input USD for comparison
      const longPriceUsd = Number(BigInt(longTokenPriceRaw)) / 1e30;
      const shortPriceUsd = Number(BigInt(shortTokenPriceRaw)) / 1e30;
      const inputUsd = longAmountNum * longPriceUsd + shortAmountNum * shortPriceUsd;

      try {
        // Call Reader.getDepositAmountOut
        const gmAmountOut = await publicClient.readContract({
          address: CONTRACTS.reader as `0x${string}`,
          abi: READER_ABI,
          functionName: 'getDepositAmountOut',
          args: [
            CONTRACTS.dataStore as `0x${string}`,
            {
              marketToken: marketAddress as `0x${string}`,
              indexToken: market.indexToken as `0x${string}`,
              longToken: market.longToken as `0x${string}`,
              shortToken: market.shortToken as `0x${string}`,
            },
            {
              indexTokenPrice: { min: longTokenPrice, max: longTokenPrice },
              longTokenPrice: { min: longTokenPrice, max: longTokenPrice },
              shortTokenPrice: { min: shortTokenPrice, max: shortTokenPrice },
            },
            longAmountWei,
            shortAmountWei,
            '0x0000000000000000000000000000000000000000' as `0x${string}`,
            0, // SwapPricingType
            true, // includeVirtualInventoryImpact
          ],
        }) as bigint;

        // Format result
        const estimatedGmTokens = parseFloat(formatUnits(gmAmountOut, 18));
        const estimatedUsd = estimatedGmTokens * gmPrice;
        
        // Calculate price impact
        const expectedGmNoImpact = inputUsd / gmPrice;
        const priceImpactPercent = expectedGmNoImpact > 0 
          ? ((estimatedGmTokens - expectedGmNoImpact) / expectedGmNoImpact) * 100 
          : 0;

        // Determine impact level and colors
        let impactLevel: 'positive' | 'negative' | 'neutral';
        let impactColor: string;
        let impactLabel: string;

        if (priceImpactPercent > 1) {
          impactLevel = 'positive';
          impactColor = 'text-emerald-400';
          impactLabel = `+${priceImpactPercent.toFixed(1)}% Bonus`;
        } else if (priceImpactPercent < -1) {
          impactLevel = 'negative';
          impactColor = 'text-red-400';
          impactLabel = `${priceImpactPercent.toFixed(1)}% Loss`;
        } else {
          impactLevel = 'neutral';
          impactColor = 'text-yellow-400';
          impactLabel = '~0% Impact';
        }

        console.log('✅ On-chain estimation:', {
          input: `${longAmountNum} Long + ${shortAmountNum} Short`,
          inputUsd: `$${inputUsd.toFixed(2)}`,
          output: `${estimatedGmTokens.toFixed(4)} GM`,
          outputUsd: `$${estimatedUsd.toFixed(2)}`,
          priceImpact: `${priceImpactPercent.toFixed(2)}%`,
        });

        return {
          estimatedGmTokens,
          estimatedUsd,
          priceImpactPercent,
          impactLevel,
          impactColor,
          impactLabel,
          inputUsd,
          source: 'on-chain',
        };
      } catch (err) {
        console.error('❌ On-chain estimation failed, using formula fallback:', err);
        
        // Fallback to formula-based estimation
        return calculateFormulaEstimate(
          market, 
          longAmountNum, 
          shortAmountNum, 
          longPriceUsd, 
          shortPriceUsd, 
          gmPrice
        );
      }
    },
    enabled: !!marketAddress && !!markets && !!publicClient &&
             (parseFloat(longAmount) > 0 || parseFloat(shortAmount) > 0),
    staleTime: 5000,
    refetchInterval: 10000,
  });

  return {
    data,
    isLoading: isLoading || isLoadingMarkets,
    error,
  };
}

/**
 * Calculate formula-based estimation as fallback
 */
function calculateFormulaEstimate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  market: any,
  longAmountNum: number,
  shortAmountNum: number,
  longPriceUsd: number,
  shortPriceUsd: number,
  gmPrice: number
): DepositEstimateResult {
  const currentLongPoolUsd = market.longPoolUsd || 0;
  const currentShortPoolUsd = market.shortPoolUsd || 0;
  const currentTotalPoolUsd = currentLongPoolUsd + currentShortPoolUsd;

  const longDepositUsd = longAmountNum * longPriceUsd;
  const shortDepositUsd = shortAmountNum * shortPriceUsd;
  const totalDepositUsd = longDepositUsd + shortDepositUsd;

  if (currentTotalPoolUsd <= 0 || totalDepositUsd <= 0) {
    return {
      estimatedGmTokens: 0,
      estimatedUsd: 0,
      priceImpactPercent: 0,
      impactLevel: 'neutral',
      impactColor: 'text-gray-400',
      impactLabel: 'N/A',
      inputUsd: totalDepositUsd,
      source: 'formula',
    };
  }

  // Simple impact calculation based on pool composition
  const currentLongPercent = currentLongPoolUsd / currentTotalPoolUsd;
  const majorityIsLong = currentLongPercent > 0.5;
  const imbalanceAmount = Math.abs(currentLongPercent - 0.5);

  let priceImpactPercent = 0;
  const isLongOnly = longDepositUsd > 0 && shortDepositUsd === 0;
  const isShortOnly = shortDepositUsd > 0 && longDepositUsd === 0;

  if (isLongOnly && majorityIsLong) {
    priceImpactPercent = -imbalanceAmount * 45;
  } else if (isShortOnly && !majorityIsLong) {
    priceImpactPercent = -imbalanceAmount * 45;
  } else if (isLongOnly && !majorityIsLong) {
    priceImpactPercent = imbalanceAmount * 10;
  } else if (isShortOnly && majorityIsLong) {
    priceImpactPercent = imbalanceAmount * 10;
  }

  priceImpactPercent = Math.max(-35, Math.min(10, priceImpactPercent));

  const effectiveDepositUsd = totalDepositUsd * (1 + priceImpactPercent / 100);
  const estimatedGmTokens = gmPrice > 0 ? effectiveDepositUsd / gmPrice : 0;

  let impactLevel: 'positive' | 'negative' | 'neutral';
  let impactColor: string;
  let impactLabel: string;

  if (priceImpactPercent > 1) {
    impactLevel = 'positive';
    impactColor = 'text-emerald-400';
    impactLabel = `+${priceImpactPercent.toFixed(1)}% Bonus`;
  } else if (priceImpactPercent < -1) {
    impactLevel = 'negative';
    impactColor = 'text-red-400';
    impactLabel = `${priceImpactPercent.toFixed(1)}% (Est.)`;
  } else {
    impactLevel = 'neutral';
    impactColor = 'text-yellow-400';
    impactLabel = '~0% Impact';
  }

  return {
    estimatedGmTokens,
    estimatedUsd: effectiveDepositUsd,
    priceImpactPercent,
    impactLevel,
    impactColor,
    impactLabel,
    inputUsd: totalDepositUsd,
    source: 'formula',
  };
}
