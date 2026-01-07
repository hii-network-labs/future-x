import React from 'react';
import { useMarketContext } from '../contexts/MarketContext';

interface MarketSelectorProps {
  className?: string;
}

/**
 * Dropdown component for selecting trading market
 */
const MarketSelector: React.FC<MarketSelectorProps> = ({ className = '' }) => {
  const { markets, selectedMarket, selectMarket, isLoading } = useMarketContext();

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 px-3 py-2 bg-gray-800 rounded-lg ${className}`}>
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Loading markets...</span>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className={`px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-500 ${className}`}>
        No markets available
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedMarket?.marketToken || ''}
        onChange={(e) => selectMarket(e.target.value as `0x${string}`)}
        className="appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white font-bold text-sm cursor-pointer hover:border-gray-600 focus:border-emerald-500 focus:outline-none transition-colors"
      >
        {markets.map((market) => (
          <option key={market.marketToken} value={market.marketToken}>
            {market.name} ({market.indexSymbol}/{market.shortSymbol})
          </option>
        ))}
      </select>
      {/* Dropdown arrow */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

export default MarketSelector;
