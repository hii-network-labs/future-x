import { useReadContract, useReadContracts } from 'wagmi';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { READER_ABI, ERC20_ABI } from '../constants/abis';
import { CONTRACTS, formatGmxPrice } from '../constants';
import { Market } from '../types';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

interface RawMarket {
  marketToken: `0x${string}`;
  indexToken: `0x${string}`;
  longToken: `0x${string}`;
  shortToken: `0x${string}`;
}

/**
 * Hook to fetch all available markets from the Reader contract
 * and allow selection of active trading market
 */
export function useMarkets() {
  const [selectedMarketAddress, setSelectedMarketAddress] = useState<`0x${string}` | null>(null);

  // 1. Fetch Markets from Backend API
  const { data: apiMarkets, isLoading: marketsLoading } = useQuery({
    queryKey: ['markets-api'],
    queryFn: () => apiClient.getMarkets(),
    refetchInterval: 10000,
  });

  // Transform API markets into App Market objects
  const markets = useMemo<Market[]>(() => {
    if (!apiMarkets) return [];

    const transformed = apiMarkets.map((m) => {
      // API already provides these values
      const longPoolAmount = m.longPoolAmount || 0;
      const shortPoolAmount = m.shortPoolAmount || 0;
      const longPoolUsd = m.longPoolUsd || 0;
      const shortPoolUsd = m.shortPoolUsd || 0;
      const poolValue = m.tvl || 0;

      const totalPoolUsd = longPoolUsd + shortPoolUsd;
      const longPoolPercentage = totalPoolUsd > 0 ? (longPoolUsd / totalPoolUsd) * 100 : 0;
      const shortPoolPercentage = totalPoolUsd > 0 ? (shortPoolUsd / totalPoolUsd) * 100 : 0;

      return {
        marketToken: m.address as `0x${string}`,
        indexToken: m.indexToken as `0x${string}`,
        longToken: m.longToken as `0x${string}`,
        shortToken: m.shortToken as `0x${string}`,
        name: m.name || 'Unknown Market',
        indexSymbol: m.indexSymbol || 'UNK',
        longSymbol: m.longSymbol || 'UNK',
        shortSymbol: m.shortSymbol || 'USD',
        indexDecimals: m.indexDecimals || 18,
        longDecimals: m.longDecimals || 18,
        
        longPoolAmount,
        shortPoolAmount,
        longPoolUsd,
        shortPoolUsd,
        longPoolPercentage,
        shortPoolPercentage,
        
        poolValueUsd: poolValue, 
        isActive: poolValue > 0,
        
        indexTokenPrice: m.indexTokenPrice,
      };
    });
    
    console.log('[useMarkets] API Markets:', apiMarkets?.length, apiMarkets);
    
    const validMarkets = transformed.filter(m => m.poolValueUsd > 0);
    const hiddenMarkets = transformed.filter(m => m.poolValueUsd <= 0);

    if (hiddenMarkets.length > 0) {
      console.log('[useMarkets] Hidden Markets (TVL=0):', hiddenMarkets.map(m => ({
        name: m.name, 
        address: m.marketToken, 
        tvl: m.poolValueUsd,
        longAmt: m.longPoolAmount,
        shortAmt: m.shortPoolAmount
      })));
    }

    console.log('[useMarkets] Active Markets:', validMarkets.length);
    
    return validMarkets;
  }, [apiMarkets]);

  // Get selected market or default to first
  const selectedMarket = useMemo(() => {
    if (markets.length === 0) return null;
    if (selectedMarketAddress) {
      const found = markets.find(
        (m) => m.marketToken.toLowerCase() === selectedMarketAddress.toLowerCase()
      );
      if (found) return found;
    }
    // Default to first market or the one matching CONTRACTS.market
    // Prioritize high liquidity markets if default not found?
    const defaultMarket = markets.find(
      (m) => m.marketToken.toLowerCase() === CONTRACTS.market.toLowerCase()
    );
    return defaultMarket || markets[0];
  }, [markets, selectedMarketAddress]);

  // Select market handler
  const selectMarket = useCallback((marketAddress: `0x${string}`) => {
    setSelectedMarketAddress(marketAddress);
  }, []);

  return {
    markets,
    selectedMarket,
    selectMarket,
    isLoading: marketsLoading,
  };
}
