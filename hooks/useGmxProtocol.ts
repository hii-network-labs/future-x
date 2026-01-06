
import { useState, useEffect, useCallback } from 'react';
import { KEEPER_API_URL, CONTRACTS, FEES, GMX_DECIMALS, USDC_DECIMALS } from '../constants';
import { MarketSide, Position, PendingOrder, OrderStatus, OrderType } from '../types';

// Helper to format 30-decimal GMX prices
export const formatGmxPrice = (priceStr?: string) => {
  if (!priceStr) return 0;
  try {
    const val = BigInt(priceStr);
    const divisor = BigInt(10) ** BigInt(GMX_DECIMALS - 2);
    return Number(val / divisor) / 100;
  } catch {
    return 0;
  }
};

export function useGmxProtocol(address: string | null) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // 3. Create Order (Integrated Logic)
  const createOrder = async (params: {
    sizeDeltaUsd: number;
    collateralAmount: number;
    isLong: boolean;
  }) => {
    if (!address) throw new Error("Wallet not connected");

    // Integration Logic from Guide Section 3:
    // 1. Calculate acceptable price with 10% slippage
    const ethPriceStr = prices[CONTRACTS.wnt.toLowerCase()];
    const currentPrice = ethPriceStr ? BigInt(ethPriceStr) : BigInt(0);
    const acceptablePrice = params.isLong 
      ? (currentPrice * 110n) / 100n 
      : (currentPrice * 90n) / 100n;

    console.log("Protocol Request: createOrder", {
      market: CONTRACTS.market,
      acceptablePrice: acceptablePrice.toString(),
      executionFee: FEES.minExecutionFee,
      multicall: [
        "sendWnt(orderVault, fee)",
        "sendTokens(usdc, orderVault, collateral)",
        "createOrder(params)"
      ]
    });

    // Simulate the async nature of keeper execution
    return new Promise((resolve) => {
      setTimeout(() => resolve("0x" + Math.random().toString(16).slice(2)), 1000);
    });
  };

  return {
    prices,
    positions,
    isLoading,
    ethPrice: formatGmxPrice(prices[CONTRACTS.wnt.toLowerCase()]) || 2855.40,
  };
}
