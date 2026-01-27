import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadContracts } from 'wagmi';
import { ERC20_ABI } from '../constants/abis';
import { formatGmxPrice } from '../constants';
import { Market } from '../types'; // UI Market type
import { apiClient } from '../lib/api-client';

/**
 * Hook to fetch markets via API + Wagmi (for balances/TVL)
 */
export function useApiMarkets() {
  // 1. Fetch Markets Metadata & Prices from API
  const { data: apiMarkets, isLoading: isApiLoading } = useQuery({
    queryKey: ['apiMarkets'],
    queryFn: () => apiClient.getMarkets(),
    refetchInterval: 30000,
  });

  // 2. Fetch Balances (TVL) via Wagmi
  // We need to construct the contract calls based on API results
  const balanceContracts = useMemo(() => {
    if (!apiMarkets || !Array.isArray(apiMarkets)) return [];
    
    return apiMarkets.flatMap(m => [
      {
        address: m.longToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf' as const,
        args: [m.address as `0x${string}`]
      },
      {
        address: m.shortToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf' as const,
        args: [m.address as `0x${string}`]
      }
    ]);
  }, [apiMarkets]);

  const { data: balanceResults, isLoading: isBalancesLoading } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: balanceContracts.length > 0,
      refetchInterval: 30000,
    }
  });

  // 3. Merge API data with Balances to create UI Market objects
  const markets = useMemo<Market[]>(() => {
    if (!apiMarkets || !Array.isArray(apiMarkets)) return [];

    return apiMarkets.map((m, index) => {
      // Calculate Pool Value using Balances + Prices from API
      let poolValue = 0;
      
      if (balanceResults) {
        const longBalRes = balanceResults[index * 2];
        const shortBalRes = balanceResults[index * 2 + 1];
        
        if (longBalRes?.status === 'success' && shortBalRes?.status === 'success') {
            const longBal = Number(longBalRes.result) / (10 ** (m.longDecimals || 18));
            const shortBal = Number(shortBalRes.result) / (10 ** (m.shortDecimals || 6));

            // Use prices from API
            // API prices are strings (30 decimals or similar)
            // Need to handle potential wrappers or format details
            // The API returns { price: "..." } or TokenPrice object
            // formatGmxPrice handles the string
            
            const getPrice = (p: any) => {
                if (!p?.price) return 0;
                return formatGmxPrice(p.price) || 0;
            };

            const longPrice = getPrice(m.longTokenPrice);
            const shortPrice = getPrice(m.shortTokenPrice) || 1; // Default USDC to 1

            poolValue = (longBal * longPrice) + (shortBal * shortPrice);
        }
      }

      return {
        marketToken: m.address as `0x${string}`,
        indexToken: m.indexToken as `0x${string}`,
        longToken: m.longToken as `0x${string}`,
        shortToken: m.shortToken as `0x${string}`,
        name: m.name, // "ETH/USDC"
        indexSymbol: m.indexSymbol,
        longSymbol: m.longSymbol,
        shortSymbol: m.shortSymbol,
        indexDecimals: m.indexDecimals,
        longDecimals: m.longDecimals,
        poolValueUsd: poolValue,
        isActive: poolValue > 0, // Show all
        // Pass price data for other hooks (useApiPositions)
        indexTokenPrice: m.indexTokenPrice,
        longTokenPrice: m.longTokenPrice,
        shortTokenPrice: m.shortTokenPrice,
      };
    }).filter(m => m.isActive || true); // Currently keeping all
  }, [apiMarkets, balanceResults]);

  // Selection Logic
  const [selectedMarketAddress, setSelectedMarketAddress] = useState<`0x${string}` | null>(null);

  const selectedMarket = useMemo(() => {
    if (markets.length === 0) return null;
    if (selectedMarketAddress) {
      const found = markets.find(
        (m) => m.marketToken.toLowerCase() === selectedMarketAddress.toLowerCase()
      );
      if (found) return found;
    }
    // Default to first market
    return markets[0];
  }, [markets, selectedMarketAddress]);

  const selectMarket = useCallback((marketAddress: `0x${string}`) => {
    setSelectedMarketAddress(marketAddress);
  }, []);

  return {
    markets,
    selectedMarket,
    selectMarket,
    isLoading: isApiLoading || isBalancesLoading,
  };
}
