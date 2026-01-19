import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { READER_ABI } from '../constants/abis';
import { CONTRACTS, getTokenDecimals, formatGmxPrice, SUBGRAPH_URL } from '../constants';
import { useMetadata } from './useMetadata';
import { Position, MarketSide } from '../types';
import { useMemo } from 'react';
import { useMarketContext } from '../contexts/MarketContext'; 
import { useQuery } from '@tanstack/react-query';

const POSITION_HISTORY_QUERY = `
  query GetPositionHistory($account: String!) {
    actions: TradeAction(
      where: { 
        account: { _ilike: $account },
        eventName: { _eq: "OrderExecuted" },
        orderType: { _in: ["2", "3"] }
      }
      order_by: { timestamp: desc }
      limit: 50
    ) {
      marketAddress
      executionPrice
      timestamp
    }
  }
`;

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
  const { data: positionsData, isLoading: isContractLoading, refetch } = useReadContract({
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

  // Fetch position history from Subgraph to get accurate entry prices
  const { data: subgraphData, isLoading: isGraphLoading } = useQuery({
    queryKey: ['positionHistory', address],
    queryFn: async () => {
      if (!address) return [];
      try {
        const response = await fetch(SUBGRAPH_URL + '/v1/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: POSITION_HISTORY_QUERY,
            variables: { account: address.toLowerCase() },
          }),
        });
        const result = await response.json();
        return result.data?.actions || [];
      } catch (e) {
        console.error('Subgraph fetch error:', e);
        return [];
      }
    },
    enabled: !!address,
    refetchInterval: 10000
  });

  // Create a map of Market -> Last Entry Price
  const entryPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (subgraphData) {
      subgraphData.forEach((action: any) => {
        if (!map[action.marketAddress.toLowerCase()] && action.executionPrice) {
           // Parse 30 decimals
           try {
             const price = Number(formatUnits(BigInt(action.executionPrice), 30));
             if (price > 0) {
               map[action.marketAddress.toLowerCase()] = price;
             }
           } catch {}
        }
      });
    }
    return map;
  }, [subgraphData]);

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

      const isLong = pos.flags.isLong;

      // Find market to get index token decimals
      const marketInfo = markets.find(m => m.marketToken.toLowerCase() === pos.addresses.market.toLowerCase());
      
      const indexTokenAddress = marketInfo?.indexToken; 
      const indexDecimals = indexTokenAddress ? getTokenDecimals(indexTokenAddress) : 18;

      // Find market object to get correct name
      const marketName = markets.find(m => m.marketToken.toLowerCase() === pos.addresses.market.toLowerCase())?.name 
        || getMarketName(pos.addresses.market, pos.addresses.collateralToken);

      // Get mark price from index token (market-specific price)
      let rawIndexPrice: string | undefined;
      
      if (indexTokenAddress) {
        const indexPriceEntry = Object.entries(allPrices).find(
            ([addr]) => addr.toLowerCase() === indexTokenAddress.toLowerCase()
        );
        rawIndexPrice = indexPriceEntry?.[1];
      }

      const markPrice = rawIndexPrice ? formatGmxPrice(rawIndexPrice) : 0;

      // Calculate entry price from position data
      const sizeInTokens = Number(formatUnits(pos.numbers.sizeInTokens, indexDecimals));
      
      // Calculate raw entry price: sizeInUsd / sizeInTokens
      let calculateEntryPrice = sizeInTokens > 0 ? sizeInUsd / sizeInTokens : 0;
      
      // USE SUBGRAPH ENTRY PRICE IF AVAILABLE
      // This fixes the issue where on-chain corrupted data makes entry price look like mark price
      const subgraphEntryPrice = entryPriceMap[pos.addresses.market.toLowerCase()];
      let entryPrice = calculateEntryPrice;

      if (subgraphEntryPrice && subgraphEntryPrice > 0) {
        entryPrice = subgraphEntryPrice;
        console.log(`[Position #${index}] Using Subgraph Entry Price: $${entryPrice}`);
      } else {
        // Fallback to sanity checks logic
        const isLegacyData = markPrice > 0 && (
          calculateEntryPrice <= 0 ||
          calculateEntryPrice > markPrice * 1000 || 
          calculateEntryPrice < markPrice / 1000
        );
        
        if (isLegacyData) {
          console.warn(`[Position #${index}] Legacy/Corrupt position detected - using mark price`);
          entryPrice = markPrice; 
        }
      }
            
      // Calculate leverage: Size (USD) / Collateral (USD)
      const leverage = collateralUsd > 0 ? sizeInUsd / collateralUsd : 0;
            
      // Calculate PnL using Position's Mark Price
      let pnl = 0;
      if (markPrice > 0 && entryPrice > 0) {
          const priceDiff = markPrice - entryPrice;
          pnl = isLong 
            ? (priceDiff / entryPrice) * sizeInUsd 
            : -(priceDiff / entryPrice) * sizeInUsd;
      }
      
      // Calculate liquidation price (simplified)
      let liqPrice = 0;
      if (leverage > 0 && entryPrice > 0) {
        liqPrice = isLong 
          ? entryPrice * (1 - (1 / leverage) * 0.9) // 90% of max loss
          : entryPrice * (1 + (1 / leverage) * 0.9);
      }
      
      if (isLong && liqPrice < 0) liqPrice = 0;

      const position = {
        id: `pos-${index}`,
        market: marketName,
        marketAddress: pos.addresses.market as `0x${string}`,
        collateralToken: pos.addresses.collateralToken as `0x${string}`,
        side: isLong ? MarketSide.LONG : MarketSide.SHORT,
        size: sizeInUsd,
        collateral: collateralUsd,  // USD value instead of token amount
        entryPrice,
        markPrice,
        leverage: parseFloat(leverage.toFixed(2)),
        liqPrice,
        pnl,
      };

      return position;
    }).filter(pos => pos.size > 0); // Filter out empty positions
  }, [positionsData, currentEthPrice, markets, allPrices, entryPriceMap]); 

  return {
    positions,
    isLoading: isContractLoading || isGraphLoading,
    refetch,
  };
}
