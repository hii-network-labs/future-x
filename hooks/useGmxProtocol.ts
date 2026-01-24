
import { useState, useEffect, useCallback, useMemo } from 'react';
import { KEEPER_API_URL, CONTRACTS, FEES, GMX_DECIMALS, USDC_DECIMALS } from '../constants';
import { MarketSide, Position, PendingOrder, OrderStatus, OrderType } from '../types';

// Type for price data from keeper API
interface PriceDataEntry {
  price: string;   // GMX V2 format: priceUsd * 10^(30-decimals)
  decimals: number; // Token decimals (18 for WNT, 6 for USDC)
}

// Convert GMX V2 price to USD
// Formula: priceUsd = price / 10^(30 - decimals)
export const convertPriceToUsd = (priceData: PriceDataEntry | undefined): number => {
  if (!priceData || !priceData.price) return 0;
  try {
    const val = BigInt(priceData.price);
    if (val === 0n) return 0;
    
    // GMX V2 standard: price = priceUsd * 10^(30 - tokenDecimals)
    // So to get priceUsd: divide by 10^(30 - tokenDecimals)
    const precision = 30 - priceData.decimals;
    const divisor = BigInt(10) ** BigInt(precision - 2); // -2 for 2 decimal places
    return Number(val / divisor) / 100;
  } catch {
    return 0;
  }
};

/**
 * Hook for GMX protocol data - now accepts indexToken param for multi-market support
 * @param address - User wallet address
 * @param indexToken - Index token address for the selected market (defaults to WNT)
 */
export function useGmxProtocol(address: string | null, indexToken?: `0x${string}`) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [priceData, setPriceData] = useState<Record<string, PriceDataEntry>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Use provided indexToken or default to WNT
  const activeIndexToken = indexToken?.toLowerCase() || CONTRACTS.wnt.toLowerCase();

  // 1. Real-time Price Polling from Keeper API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(`${KEEPER_API_URL}/prices`);
        if (res.ok) {
          const data = await res.json();
          setPrices(data.prices || {});
          setPriceData(data.priceData || {});
          
          // 📊 PRICE POLLING LOG
          const formattedPrices = Object.entries(data.priceData || {} as Record<string, PriceDataEntry>)
            .reduce((acc, [addr, pd]) => {
              acc[addr.slice(0, 10) + '...'] = convertPriceToUsd(pd as PriceDataEntry);
              return acc;
            }, {} as Record<string, number>);
            
          console.log('[useGmxProtocol] Price Update from Keeper:', {
            timestamp: new Date().toISOString(),
            activeIndexToken,
            priceData: data.priceData,
            formattedPrices
          });
        }
      } catch (e) {
        console.warn("Keeper price poll failed", e);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [activeIndexToken]);

  // 2. Fetch Positions from Reader Contract
  const fetchPositions = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // 3. Calculate current price for selected market (case-insensitive lookup)
  const currentPrice = useMemo(() => {
    // Find priceData with case-insensitive key match
    const entry = Object.entries(priceData).find(
      ([addr]) => addr.toLowerCase() === activeIndexToken
    );
    const pd = entry?.[1];
    const formatted = convertPriceToUsd(pd);
    
    // 📊 CURRENT PRICE CALCULATION LOG
    console.log('[useGmxProtocol] Current Price Calculation:', {
      activeIndexToken: activeIndexToken.slice(0, 10) + '...',
      rawPriceData: pd,
      formatted,
    });
    
    return formatted;
  }, [priceData, activeIndexToken]);

  // 4. Get price as BigInt for order creation (in GMX V2 format)
  const currentPriceBigInt = useMemo(() => {
    const entry = Object.entries(prices).find(
      ([addr]) => addr.toLowerCase() === activeIndexToken
    );
    const priceStr = entry?.[1];
    return priceStr ? BigInt(priceStr) : 0n;
  }, [prices, activeIndexToken]);

  return {
    prices,
    priceData,     // New: price data with decimals
    positions,
    isLoading,
    // Price for the selected market's index token (no fallback - force real data)
    ethPrice: currentPrice,
    currentPriceBigInt,
    activeIndexToken,
    convertPriceToUsd, // Export utility for other components
  };
}
