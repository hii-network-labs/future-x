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
      // DEBUG LOGGING
      // DEBUG LOGGING removed

      // Parse position data (30 decimals for USD values)
      const sizeInUsd = Number(formatUnits(pos.numbers.sizeInUsd, 30));
      
      // Dynamic decimals for collateral
      const collateralTokenAddress = pos.addresses.collateralToken.toLowerCase();
      const collateralDecimals = getTokenDecimals(collateralTokenAddress);
      const collateralAmount = Number(formatUnits(pos.numbers.collateralAmount, collateralDecimals));
      const collateralSymbol = getTokenSymbol(collateralTokenAddress);

      // Get collateral price in USD
      const rawCollateralPrice = allPrices[collateralTokenAddress] || 
        (collateralTokenAddress === CONTRACTS.usdc.toLowerCase() ? "1000000000000000000000000000000" : "0");
      const collateralPrice = formatGmxPrice(rawCollateralPrice) || (collateralTokenAddress === CONTRACTS.usdc.toLowerCase() ? 1 : currentEthPrice);
      const collateralUsd = collateralAmount * collateralPrice;

      const isLong = pos.flags.isLong;

      // Find market to get index token decimals
      const marketInfo = markets.find(m => m.marketToken.toLowerCase() === pos.addresses.market.toLowerCase());
      const indexDecimals = marketInfo?.indexDecimals || 18;

      // Calculate entry price from position data
      // sizeInTokens in GMX V2 uses the index token's decimals
      const sizeInTokens = Number(formatUnits(pos.numbers.sizeInTokens, indexDecimals));
      
      const entryPrice = sizeInTokens > 0 ? sizeInUsd / sizeInTokens : currentEthPrice;
      
      // Calculate leverage: Size (USD) / Collateral (USD)
      const leverage = collateralUsd > 0 ? sizeInUsd / collateralUsd : 0;
      
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

      return {
        id: `pos-${index}`,
        market: marketName,
        side: isLong ? MarketSide.LONG : MarketSide.SHORT,
        size: sizeInUsd,
        collateral: collateralAmount,
        entryPrice,
        markPrice: currentEthPrice,
        leverage: parseFloat(leverage.toFixed(2)),
        liqPrice,
        pnl,
      };
    }).filter(pos => pos.size > 0); // Filter out empty positions
  }, [positionsData, currentEthPrice, markets, allPrices]); // added markets, allPrices dependencies

  return {
    positions,
    isLoading,
    refetch,
  };
}
