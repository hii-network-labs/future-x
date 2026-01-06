import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { READER_ABI } from '../constants/abis';
import { CONTRACTS, getTokenDecimals, getMarketName, getTokenSymbol } from '../constants';
import { Position, MarketSide } from '../types';
import { useMemo } from 'react';

/**
 * Hook to fetch user positions from Reader contract
 */
export function usePositions(
  address: `0x${string}` | undefined,
  currentEthPrice: number
) {
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

  // Parse and format positions
  const positions = useMemo<Position[]>(() => {
    if (!positionsData || !Array.isArray(positionsData)) {
      return [];
    }

    return positionsData.map((pos: any, index: number) => {
      // Parse position data (30 decimals for USD values)
      const sizeInUsd = Number(formatUnits(pos.numbers.sizeInUsd, 30));
      
      // Dynamic decimals for collateral
      const collateralDecimals = getTokenDecimals(pos.addresses.collateralToken);
      const collateralAmount = Number(formatUnits(pos.numbers.collateralAmount, collateralDecimals));
      const collateralSymbol = getTokenSymbol(pos.addresses.collateralToken);

      const isLong = pos.flags.isLong;
      
      // Calculate entry price from position data
      // Note: sizeInTokens in GMX V2 is also 18 decimals for ETH markets usually
      const sizeInTokens = Number(formatUnits(pos.numbers.sizeInTokens, 18));
      const entryPrice = sizeInTokens > 0 ? sizeInUsd / sizeInTokens : currentEthPrice;
      
      // Calculate leverage
      const leverage = collateralAmount > 0 ? sizeInUsd / collateralAmount : 0;
      
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

      return {
        id: `pos-${index}`,
        market: `${getMarketName(pos.addresses.market)} (${collateralSymbol})`,
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
  }, [positionsData, currentEthPrice]);

  return {
    positions,
    isLoading,
    refetch,
  };
}
