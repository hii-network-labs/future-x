
import { useState, useEffect } from 'react';
import { formatGmxPrice } from '../constants';
import { apiClient } from '../lib/api-client';

export function usePrices() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [rawPrices, setRawPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const raw = await apiClient.getPrices();
        
        // Transform for usePrices hook compatibility (raw map of address -> price string)
        const rawMap: Record<string, string> = {};
        Object.entries(raw).forEach(([addr, data]) => {
           rawMap[addr.toLowerCase()] = data.price;
        });
        
        setRawPrices(rawMap);

        // Format prices
        const formatted: Record<string, number> = {};
        Object.keys(rawMap).forEach(key => {
          formatted[key] = formatGmxPrice(rawMap[key]);
        });
        
        setPrices(formatted);
      } catch (e) {
        // console.warn("Price fetch failed", e);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 5000); // 5s poll
    return () => clearInterval(interval);
  }, []);

  const getPrice = (tokenAddress: string) => {
    if (!tokenAddress) return 0;
    return prices[tokenAddress.toLowerCase()] || 0;
  };

  return { prices, rawPrices, getPrice };
}
