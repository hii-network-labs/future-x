import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { READER_ABI } from '../constants/abis';
import { CONTRACTS, getTokenDecimals, formatGmxPrice } from '../constants';
import { useMetadata } from './useMetadata';
import { Position, MarketSide } from '../types';
import { useMemo } from 'react';
import { useMarketContext } from '../contexts/MarketContext'; 

/**
 * Hook to fetch user positions from Reader contract
 */
export function usePositions(
  address: `0x${string}` | undefined,
  currentEthPrice: number,
  allPrices: Record<string, string> = {}
) {
  const { markets } = useMarketContext();

  // Fetch positions from Reader contract
  const { data: positionsData, isLoading, refetch } = useReadContract({
    address: CONTRACTS.reader as `0x${string}`,
    abi: READER_ABI,
    functionName: 'getAccountPositions',
    args: address 
      ? [CONTRACTS.dataStore as `0x${string}`, address, 0n, 50n] 
      : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 3000, // Refresh every 3 seconds
    }
  });

  const marketAddresses = useMemo(() => (positionsData as any[])?.map((p: any) => p.addresses.market) || [], [positionsData]);
  const tokenAddresses = useMemo(() => (positionsData as any[])?.map((p: any) => p.addresses.collateralToken) || [], [positionsData]);
  
  const { getMarketName, getTokenSymbol } = useMetadata(marketAddresses, tokenAddresses);

  // Parse and format positions
  const positions = useMemo<Position[]>(() => {
    if (!positionsData || !Array.isArray(positionsData)) {
      return [];
    }

    return positionsData.map((pos: any, index: number) => {
      // Parse position data (30 decimals for USD values)
      const sizeInUsd = Number(formatUnits(pos.numbers.sizeInUsd, 30));
      
      // Dynamic decimals for collateral
      const collateralTokenAddress = pos.addresses.collateralToken.toLowerCase();
      const collateralDecimals = getTokenDecimals(collateralTokenAddress);
      const collateralAmount = Number(formatUnits(pos.numbers.collateralAmount, collateralDecimals));
      const collateralSymbol = getTokenSymbol(collateralTokenAddress);

      // Get collateral price in USD (case-insensitive lookup)
      const collateralPriceEntry = Object.entries(allPrices).find(
        ([addr]) => addr.toLowerCase() === collateralTokenAddress
      );
      const rawCollateralPrice = collateralPriceEntry?.[1] || 
        (collateralTokenAddress === CONTRACTS.usdc.toLowerCase() ? "1000000000000000000000000000000" : "0");
      const collateralPrice = formatGmxPrice(rawCollateralPrice) || (collateralTokenAddress === CONTRACTS.usdc.toLowerCase() ? 1 : currentEthPrice);
      const collateralUsd = collateralAmount * collateralPrice;

      // 🔍 DEBUG: Collateral Price Lookup
      console.log(`[Position #${index}] Collateral Price Debug:`, {
        collateralToken: collateralTokenAddress.slice(0, 10) + '...',
        allPricesKeys: Object.keys(allPrices).map(k => k.slice(0, 10) + '...'),
        foundEntry: collateralPriceEntry ? `${collateralPriceEntry[0].slice(0, 10)}... = ${collateralPriceEntry[1]}` : 'NOT FOUND',
        rawPrice: rawCollateralPrice,
        formattedPrice: formatGmxPrice(rawCollateralPrice),
        finalPrice: collateralPrice,
        collateralAmount,
        collateralUsd,
        currentEthPriceFallback: currentEthPrice,
      });

      const isLong = pos.flags.isLong;

      // Find market to get index token decimals
      const marketInfo = markets.find(m => m.marketToken.toLowerCase() === pos.addresses.market.toLowerCase());
      
      // CRITICAL FIX: sizeInTokens ALWAYS uses index token decimals (WNT = 18)
      // NOT collateral token decimals!
      // For WNT-USDC market: index token is WNT (18 decimals) for both LONG and SHORT
      const indexTokenAddress = marketInfo?.indexToken || CONTRACTS.wnt;
      const indexDecimals = getTokenDecimals(indexTokenAddress);
      
      // Debug: Log what decimals we're using
      console.log(`[Position #${index}] Index Token Config:`, {
        market: pos.addresses.market.slice(0, 10) + '...',
        isLong,
        indexToken: indexTokenAddress.slice(0, 10) + '...',
        indexDecimals,
        collateralToken: collateralTokenAddress.slice(0, 10) + '...',
        collateralDecimals,
        marketInfo: marketInfo ? 'found' : 'not found',
      });

      // Calculate entry price from position data
      // sizeInTokens in GMX V2 uses the index token's decimals
      const sizeInTokens = Number(formatUnits(pos.numbers.sizeInTokens, indexDecimals));
      
      const entryPrice = sizeInTokens > 0 ? sizeInUsd / sizeInTokens : currentEthPrice;
      
      // 📊 ENTRY PRICE DEBUG LOGGING
      console.log(`[Position #${index}] Entry Price Calculation:`, {
        side: isLong ? 'LONG' : 'SHORT',
        market: pos.addresses.market.slice(0, 10) + '...',
        rawData: {
          sizeInUsd_raw: pos.numbers.sizeInUsd.toString(),
          sizeInTokens_raw: pos.numbers.sizeInTokens.toString(),
          collateralAmount_raw: pos.numbers.collateralAmount.toString(),
        },
        parsed: {
          sizeInUsd: sizeInUsd.toFixed(2),
          sizeInTokens: sizeInTokens.toFixed(6),
          indexDecimals,
          collateralAmount: collateralAmount.toFixed(6),
          collateralDecimals,
        },
        prices: {
          entryPrice: entryPrice.toFixed(2),
          currentPrice: currentEthPrice.toFixed(2),
          collateralPrice: collateralPrice.toFixed(2),
        },
        calculation: {
          formula: 'sizeInUsd / sizeInTokens',
          numerator: sizeInUsd,
          denominator: sizeInTokens,
          result: entryPrice,
        }
      });
      
      // Calculate leverage: Size (USD) / Collateral (USD)
      const leverage = collateralUsd > 0 ? sizeInUsd / collateralUsd : 0;
      
      // 🔍 DEBUG: Leverage Calculation
      console.log(`[Position #${index}] Leverage Calculation:`, {
        sizeInUsd,
        collateralUsd,
        leverage,
        leverageFormatted: leverage.toFixed(2) + 'X',
        isLong,
      });
      
      // Calculate PnL
      const priceDiff = currentEthPrice - entryPrice;
      const pnl = isLong 
        ? (priceDiff / entryPrice) * sizeInUsd 
        : -(priceDiff / entryPrice) * sizeInUsd;
      
      // Calculate liquidation price (simplified)
      // If leverage is near 0 or invalid, set a safe liq price
      let liqPrice = 0;
      if (leverage > 0) {
        liqPrice = isLong 
          ? entryPrice * (1 - (1 / leverage) * 0.9) // 90% of max loss
          : entryPrice * (1 + (1 / leverage) * 0.9);
      }
      
      // Ensure liqPrice doesn't go negative in UI for Longs
      if (isLong && liqPrice < 0) liqPrice = 0;
      
      // Find market object to get correct name
      const marketName = markets.find(m => m.marketToken.toLowerCase() === pos.addresses.market.toLowerCase())?.name 
        || getMarketName(pos.addresses.market, pos.addresses.collateralToken);

      const position = {
        id: `pos-${index}`,
        market: marketName,
        side: isLong ? MarketSide.LONG : MarketSide.SHORT,
        size: sizeInUsd,
        collateral: collateralUsd,  // USD value instead of token amount
        entryPrice,
        markPrice: currentEthPrice,
        leverage: parseFloat(leverage.toFixed(2)),
        liqPrice,
        pnl,
      };

      // 📋 FINAL POSITION OBJECT
      console.log(`[Position #${index}] Final Position Object:`, position);

      return position;
    }).filter(pos => pos.size > 0); // Filter out empty positions
  }, [positionsData, currentEthPrice, markets, allPrices]); // added markets, allPrices dependencies

  return {
    positions,
    isLoading,
    refetch,
  };
}
