import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { READER_ABI } from '../constants/abis';
import { CONTRACTS, getTokenDecimals, formatGmxPrice, SUBGRAPH_URL } from '../constants';
import { useMetadata } from './useMetadata';
import { Position, MarketSide, PendingOrder } from '../types';
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
      isLong
      transaction {
        hash
      }
    }
  }
`;

/**
 * Hook to fetch user positions from Reader contract
 */
export function usePositions(
  address: `0x${string}` | undefined,
  currentEthPrice: number,
  allPrices: Record<string, string> = {},
  pendingOrders: PendingOrder[] = []
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
    const map: Record<string, { price: number, timestamp: number }> = {};
    if (subgraphData) {
      subgraphData.forEach((action: any) => {
        if (!map[action.marketAddress.toLowerCase()] && action.executionPrice) {
           // Parse 30 decimals
             // Parse price - handle potential precision mismatch (30 vs 12 decimals)
             try {
               const rawPrice = BigInt(action.executionPrice);
               const threshold = BigInt(10) ** BigInt(20); // Threshold to decide if 30 decimals or less
               
               let price = 0;
               if (rawPrice > threshold) {
                   // Standard 30 decimals
                   price = Number(formatUnits(rawPrice, 30));
               } else {
                   // Likely 12 decimals (as seen in recent subgraph logs)
                   price = Number(formatUnits(rawPrice, 12));
               }


                if (price > 0.01) { // Sanity check for extremely small values
                  const key = `${action.marketAddress.toLowerCase()}-${action.isLong}`;
                  map[key] = { 
                      price, 
                      timestamp: action.timestamp ? Number(action.timestamp) : 0 
                  };
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
      let sizeInTokens = Number(formatUnits(pos.numbers.sizeInTokens, indexDecimals));

      // Economic Coherence Check: Determine if sizeInTokens is Raw or Wei
      // We calculate implied entry price for both scenarios and choose the one closer to Mark Price
      if (markPrice > 0 && sizeInUsd > 0) {
          const rawSize = BigInt(pos.numbers.sizeInTokens);
          const sizeInTokensWei = Number(formatUnits(rawSize, indexDecimals));
          const sizeInTokensRaw = Number(rawSize); // Interpret as integer

          const priceFromWei = sizeInTokensWei > 0 ? sizeInUsd / sizeInTokensWei : 0;
          const priceFromRaw = sizeInTokensRaw > 0 ? sizeInUsd / sizeInTokensRaw : 0;

          // Calculate logarithmic deviation from Mark Price
          // We use log10 to treat multipliers (e.g. 10x vs 0.1x) symmetrically
          // dev = 0 means perfect match.
          const devWei = priceFromWei > 0 ? Math.abs(Math.log10(priceFromWei / markPrice)) : 100;
          const devRaw = priceFromRaw > 0 ? Math.abs(Math.log10(priceFromRaw / markPrice)) : 100;
          
          // Debugging Coherence
          if (index === 0) {
              console.log(`[Coherence] Mark: ${markPrice}, SizeUSD: ${sizeInUsd}`);
              console.log(`[Coherence] Option Wei: Size=${sizeInTokensWei}, Price=${priceFromWei}, Dev=${devWei.toFixed(4)}`);
              console.log(`[Coherence] Option Raw: Size=${sizeInTokensRaw}, Price=${priceFromRaw}, Dev=${devRaw.toFixed(4)}`);
          }

          // Decision Matrix:
          // If Raw is significantly better (smaller deviation) AND physically plausible (dev < 1 means within 10x factor), prefer Raw
          // The "dev < 1" check safeguards against cases where both are wild, defaulting to standard Wei
          if (devRaw < devWei && devRaw < 1) {
               console.warn(`[Position #${index}] ⚠️ Economic Coherence: "Raw" sizeInTokens is more plausible. Price ${priceFromRaw.toFixed(2)} vs Wei-Price ${priceFromWei.toFixed(2)}. Using Raw.`);
               sizeInTokens = sizeInTokensRaw;
          } else {
               // Default (Wei) is fine or both are bad (default to Wei)
               sizeInTokens = sizeInTokensWei;
          }
      }
      
      // DEBUG: Trace potentially huge values
      if (index === 0) {
          console.log(`[DEBUG POS #0] sizeInUsd (parsed): ${sizeInUsd}`);
          console.log(`[DEBUG POS #0] sizeInTokens (parsed): ${sizeInTokens} (decimals: ${indexDecimals})`);
          console.log(`[DEBUG POS #0] Raw sizeInUsd: ${pos.numbers.sizeInUsd}`);
          console.log(`[DEBUG POS #0] Raw sizeInTokens: ${pos.numbers.sizeInTokens}`);
          console.log(`[DEBUG POS #0] Calculated Entry: ${sizeInTokens > 0 ? sizeInUsd / sizeInTokens : 0}`);
      }

      // Calculate raw entry price: sizeInUsd / sizeInTokens
      let calculateEntryPrice = sizeInTokens > 0 ? sizeInUsd / sizeInTokens : 0;
      
      // USE SUBGRAPH ENTRY PRICE IF AVAILABLE
      // This fixes the issue where on-chain corrupted data makes entry price look like mark price
      const subgraphDataPoint = entryPriceMap[`${pos.addresses.market.toLowerCase()}-${isLong}`];
      let entryPrice = calculateEntryPrice;
      let positionTimestamp = 0;

      if (subgraphDataPoint && subgraphDataPoint.price > 0) {
        let candidate = subgraphDataPoint.price;
        positionTimestamp = subgraphDataPoint.timestamp;

        // Anomaly Fix: Subgraph returning 32 digits instead of 34 digits (Factor of 100)
        // Check if candidate is ~1% of Mark Price (implying 100x scaling error)
        if (markPrice > 0 && candidate < markPrice * 0.02) {
            const scaledCandidate = candidate * 100;
            const dev = Math.abs(scaledCandidate - markPrice) / markPrice;
            if (dev < 0.2) { // If scaling by 100 makes it match Mark Price (<20% dev)
                console.log(`[Position #${index}] 🔧 Auto-corrected Subgraph price precision (x100): $${candidate} -> $${scaledCandidate}`);
                candidate = scaledCandidate;
            }
        }

        // Sanity Check: Ensure (possibly corrected) Entry Price is reasonable
        let isPriceValid = true;
        
        if (markPrice > 0) {
             const deviation = Math.abs(candidate - markPrice) / markPrice;
             if (deviation > 0.5) {
                 isPriceValid = false;
                 console.warn(`[Position #${index}] ⚠️ Ignoring suspicious Subgraph price: $${candidate} (Mark: $${markPrice}, Dev: ${(deviation*100).toFixed(0)}%) - Fallback to Calculated: $${calculateEntryPrice.toFixed(2)}`);
             }
        }

        // Cross-Check: Implied Token Count
        // Subgraph Indexers sometimes truncate token amounts to integers (e.g. 4.98 -> 4.0)
        // causing Price = SizeUSD / 4.0 (inflated) instead of SizeUSD / 4.98
        if (markPrice > 0 && sizeInTokens > 0) {
             const impliedTokens = sizeInUsd / candidate;
             const tokenDev = Math.abs(impliedTokens - sizeInTokens) / sizeInTokens;
             
             // If implied tokens deviate > 10% from actual tokens, reject the price
             if (tokenDev > 0.1) {
                 isPriceValid = false;
                 console.warn(`[Position #${index}] ⚠️ Implied Token Mismatch! Subgraph Price $${candidate} implies ${impliedTokens.toFixed(4)} tokens, but Contract has ${sizeInTokens.toFixed(4)}. Dev: ${(tokenDev*100).toFixed(1)}%. Rejecting Subgraph Price.`);
             }
        }

        if (isPriceValid) {
            entryPrice = candidate;
            console.log(`[Position #${index}] Using Subgraph Entry Price: $${entryPrice}`);
        }
      } else {
        // Fallback: Check for recent pending orders (Transient Entry Price Fix)
        // If we have a pending order for this market/side created < 60s ago, use its price
        const matchingOrder = pendingOrders.find(o => 
          o.marketAddress?.toLowerCase() === pos.addresses.market.toLowerCase() &&
          o.side === (isLong ? MarketSide.LONG : MarketSide.SHORT) &&
          Date.now() - o.timestamp < 60000 // Only trust orders from last 60s
        );

        if (matchingOrder && matchingOrder.price > 0) {
           entryPrice = matchingOrder.price;
           console.log(`[Position #${index}] Using Order Price (Transient): $${entryPrice}`);
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
        indexToken: marketInfo?.indexToken as `0x${string}`,
        side: isLong ? MarketSide.LONG : MarketSide.SHORT,
        size: sizeInUsd,
        collateral: collateralUsd,  // USD value instead of token amount
        entryPrice,
        markPrice,
        leverage: parseFloat(leverage.toFixed(2)),
        liqPrice,
        pnl,
        timestamp: positionTimestamp,
      };

      return position;
    }).filter(pos => pos.size > 0); // Filter out empty positions
  }, [positionsData, currentEthPrice, markets, allPrices, entryPriceMap, pendingOrders]); 

  return {
    positions,
    isLoading: isContractLoading || isGraphLoading,
    refetch,
  };
}
