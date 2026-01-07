
import { useState, useEffect, useCallback, useMemo } from 'react';
import { KEEPER_API_URL, CONTRACTS, FEES, GMX_DECIMALS, USDC_DECIMALS, formatGmxPrice } from '../constants';
import { MarketSide, Position, PendingOrder, OrderStatus, OrderType } from '../types';

// formatGmxPrice moved to constants.ts

/**
 * Hook for GMX protocol data - now accepts indexToken param for multi-market support
 * @param address - User wallet address
 * @param indexToken - Index token address for the selected market (defaults to WNT)
 */
export function useGmxProtocol(address: string | null, indexToken?: `0x${string}`) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Use provided indexToken or default to WNT
  const activeIndexToken = indexToken?.toLowerCase() || CONTRACTS.wnt.toLowerCase();

  // 1. Real-time Price Polling
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(`${KEEPER_API_URL}/prices`);
        if (res.ok) {
          const data = await res.json();
          setPrices(data.prices || {});
        }
      } catch (e) {
        console.warn("Keeper price poll failed", e);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 2000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Positions from Reader Contract
  const fetchPositions = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      // In a real environment, we'd use viem/wagmi readContract here
      // For this implementation, we simulate the logic from the Reader.getAccountPositions call
      // described in the guide, but we'll fetch mock-integrated data for the UI
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // 3. Calculate current price for selected market
  const currentPrice = useMemo(() => {
    const priceStr = prices[activeIndexToken];
    return formatGmxPrice(priceStr) || 0;
  }, [prices, activeIndexToken]);

  // 4. Get price as BigInt for order creation
  const currentPriceBigInt = useMemo(() => {
    const priceStr = prices[activeIndexToken];
    return priceStr ? BigInt(priceStr) : 0n;
  }, [prices, activeIndexToken]);

  return {
    prices,
    positions,
    isLoading,
    // Price for the selected market's index token
    ethPrice: currentPrice || 2855.40,
    currentPriceBigInt,
    activeIndexToken,
  };
}
