
import { useState, useEffect } from 'react';
import { formatGmxPrice } from '../constants';

export function usePrices() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [rawPrices, setRawPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const url = `${import.meta.env.VITE_KEEPER_API_URL || "http://127.0.0.1:9090"}/prices`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const raw = data.prices || {};
          setRawPrices(raw);

          // Format prices
          const formatted: Record<string, number> = {};
          Object.keys(raw).forEach(key => {
            formatted[key.toLowerCase()] = formatGmxPrice(raw[key]);
          });
          setPrices(formatted);
        }
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
