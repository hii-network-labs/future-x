import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '../lib/api-client'; // Import singleton
import { Position, MarketSide } from '../types';
import { useMarketContext } from '../contexts/MarketContext';
import { formatGmxPrice } from '../constants';

/**
 * Hook to fetch user positions from API
 * Replaces usePositions.ts (Reader Contract + Subgraph)
 */
export function useApiPositions(address: `0x${string}` | undefined) {
  const { markets } = useMarketContext();

  const { data: apiPositions, isLoading, refetch } = useQuery({
    queryKey: ['apiPositions', address],
    queryFn: () => apiClient.getPositions(address || ''),
    enabled: !!address,
    refetchInterval: 2000, // Fast refresh for better real-time updates
    refetchOnWindowFocus: true,
  });

  const positions = useMemo<Position[]>(() => {
    if (!apiPositions || !Array.isArray(apiPositions)) return [];

    return apiPositions.map((pos: any, index: number) => {
      // API returns positions with basic info. 
      // We need to enrich with Mark Price (from markets context) and calculate PnL.
      // API Position format (from ApiAccountService):
      // { id, market: { marketToken, ... }, isLong, sizeInUsd, collateralInUsd, entryPrice }
      // Or based on AccountControllerSwagger:
      // { key, market, collateralToken, sizeInUsd, collateralInUsd, pnl, isLong, leverage }
      // Wait, ApiAccountService uses SubgraphService which returns:
      // { id, account, market: { ... }, isLong, sizeInUsd, collateralInUsd, entryPrice }
      
      // Need to find matching market in our MarketContext to get real-time price
      // pos.market is an object from Subgraph. pos.market.marketToken is likely the ID.
      // or if calling AccountController, it returns what apiAccountService returns.

      const marketTokenAddress = pos.marketAddress || pos.market?.marketToken || pos.market; // Handle potential structure diffs
      const market = markets.find(m => m.marketToken.toLowerCase() === (marketTokenAddress?.toLowerCase ? marketTokenAddress.toLowerCase() : ''));

      // 1. Get Mark Price from Market (which has attached prices if using useApiMarkets)
      // If we are using old useMarkets, prices might not be attached directly?
      // useApiMarkets attaches: indexTokenPrice, longTokenPrice, shortTokenPrice.
      // We need to calculate Mark Price from that or check if market has it.
      // Current useApiMarkets adds `poolValueUsd` but not explicitly `markPrice`?
      // Actually `useApiMarkets` doesn't calculate "Mark Price" per se, it puts token prices on the object.
      // For GMX V2 (GM), mark price depends on index token price.
      
      let markPrice = 0;
      if (market) {
         // Assuming indexTokenPrice is attached to market in new hook
         // or we fallback to external price map if needed.
         // Let's assume market includes price info.
         const priceObj = (market as any).indexTokenPrice;
         if (priceObj) {
            markPrice = typeof priceObj === 'object' ? formatGmxPrice(priceObj.price) : 0;
         }
      }

      // Parsing API values (strings)
      // API might return "sizeInUsd" as 30 decimal string or number?
      // Subgraph usually returns decimal strings (e.g. "123.456") depending on config?
      // GMX Subgraph often returns BigInt strings.
      // ApiClient Position defines string.
      // Let's safe-parse.
      const parseValue = (val: any) => {
         if (typeof val === 'number') return val;
         if (typeof val === 'string') return parseFloat(val); // Simplistic, checking format
         return 0;
      };

      // ApiAccountService returns Subgraph raw, which is usually 30 decimals for USD?
      // Step 2259 "usePositions" had to verify 30 vs 12 decimals.
      // Ideally API standardizes this.
      // PROVISIONAL: Assume API passes through Subgraph raw values.
      // Safe bet: Convert using formatGmxPrice if it looks huge.
      // Use formatted values from API if available (Backend standardizes this now)
      // Fallback to local parsing for backward compatibility
      const sizeInUsd = pos.sizeInUsdFormatted ?? (formatGmxPrice(pos.sizeInUsd) || parseValue(pos.sizeInUsd));
      const collateralInUsd = pos.collateralInUsdFormatted ?? (formatGmxPrice(pos.collateralInUsd) || parseValue(pos.collateralInUsd));
      const entryPrice = pos.entryPriceFormatted ?? (formatGmxPrice(pos.entryPrice) || parseValue(pos.entryPrice));
      
      const isLong = pos.isLong;
      
      // Calculate PnL
      let pnl = 0;
      if (markPrice > 0 && entryPrice > 0) {
          const priceDiff = markPrice - entryPrice;
          pnl = isLong 
            ? (priceDiff / entryPrice) * sizeInUsd 
            : -(priceDiff / entryPrice) * sizeInUsd;
      }

      // Leverage
      const leverage = collateralInUsd > 0 ? sizeInUsd / collateralInUsd : 0;
      
      // Parse Raw Size for precise closing
      let sizeRaw = 0n;
      try {
          if (pos.sizeInUsd) {
              // If it's a number, convert to string first to avoid scientific notation if possible, 
              // but ideally it's a string from API.
              // GMX V2 sizes are 30 decimals. 
              // valid: "123456789...", number 123
              sizeRaw = BigInt(pos.sizeInUsd);
          }
      } catch (e) { console.warn('Failed to parse sizeRaw', pos.sizeInUsd); }

      // Liq Price
      let liqPrice = 0;
      if (leverage > 0 && entryPrice > 0) {
        liqPrice = isLong 
          ? entryPrice * (1 - (1 / leverage) * 0.9)
          : entryPrice * (1 + (1 / leverage) * 0.9);
      }

      return {
        id: pos.id,
        market: market?.name || 'Unknown',
        marketAddress: marketTokenAddress as `0x${string}`,
        collateralToken: pos.collateralToken || (isLong ? market?.longToken : market?.shortToken), // correct fallback
        indexToken: market?.indexToken,
        indexDecimals: market?.indexDecimals || 18,
        side: isLong ? MarketSide.LONG : MarketSide.SHORT,
        size: sizeInUsd,
        sizeRaw, // Accurate integer size
        collateral: collateralInUsd,
        entryPrice,
        markPrice,
        leverage: parseFloat(leverage.toFixed(2)),
        liqPrice,
        pnl,
        timestamp: pos.transaction?.timestamp || 0,
      };
    });
  }, [apiPositions, markets]);

  return {
    positions,
    isLoading,
    refetch
  };
}
