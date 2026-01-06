import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { READER_ABI } from '../constants/abis';
import { CONTRACTS } from '../constants';
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
      const collateralAmount = Number(formatUnits(pos.numbers.collateralAmount, 6)); // USDC decimals
      const isLong = pos.flags.isLong;
      
      // Calculate entry price from position data
      const sizeInTokens = Number(formatUnits(pos.numbers.sizeInTokens, 18));
      const entryPrice = sizeInTokens > 0 ? sizeInUsd / sizeInTokens : currentEthPrice;
      
      // Calculate leverage
      const leverage = collateralAmount > 0 ? sizeInUsd / collateralAmount : 0;
      
      // Calculate PnL
      const priceDiff = currentEthPrice - entryPrice;
      const pnlPercent = entryPrice > 0 ? (priceDiff / entryPrice) * 100 : 0;
      const pnl = isLong 
        ? (priceDiff / entryPrice) * sizeInUsd 
        : -(priceDiff / entryPrice) * sizeInUsd;
      
      // Calculate liquidation price (simplified)
      const liqPrice = isLong 
        ? entryPrice * (1 - (1 / leverage) * 0.9) // 90% of max loss
        : entryPrice * (1 + (1 / leverage) * 0.9);

      return {
        id: `pos-${index}`,
        market: 'ETH-PERP',
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
