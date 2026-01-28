import React, { createContext, useContext, ReactNode } from 'react';
import { useMarkets } from '../hooks/useMarkets';
import { Market } from '../types';

interface MarketContextType {
  markets: Market[];
  selectedMarket: Market | null;
  selectMarket: (marketAddress: `0x${string}`) => void;
  isLoading: boolean;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

interface MarketProviderProps {
  children: ReactNode;
}

/**
 * Provider for global market state
 * Wraps the app to provide market selection across all components
 */
export function MarketProvider({ children }: MarketProviderProps) {
  const marketsData = useMarkets();

  return (
    <MarketContext.Provider value={marketsData}>
      {children}
    </MarketContext.Provider>
  );
}

/**
 * Hook to access market context
 * Must be used within MarketProvider
 */
export function useMarketContext() {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarketContext must be used within a MarketProvider');
  }
  return context;
}

/**
 * Hook to get current selected market with fallback
 * Returns null-safe market object
 */
export function useSelectedMarket() {
  const { selectedMarket } = useMarketContext();
  return selectedMarket;
}
