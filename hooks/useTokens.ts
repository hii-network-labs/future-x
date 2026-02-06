import { useQuery } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_KEEPER_API_URL || 'http://localhost:3000';

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Hook to fetch all tokens metadata from keeper API
 */
export function useTokens() {
  return useQuery<TokenMetadata[]>({
    queryKey: ['tokens'],
    queryFn: async () => {
      // API_BASE already includes /api suffix (e.g., http://localhost:3000/api)
      const response = await fetch(`${API_BASE}/tokens`);
      if (!response.ok) {
        throw new Error('Failed to fetch tokens');
      }
      const result = await response.json();
      // API returns { data: [...], statusCode: 200 }
      return result.data || result;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to get decimals for a specific token address
 */
export function useTokenDecimals(tokenAddress: string | undefined) {
  const { data: tokens, isLoading } = useTokens();
  
  if (!tokenAddress || !tokens) {
    return { decimals: 18, isLoading }; // Default to 18
  }
  
  const token = tokens.find(
    t => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  
  return { 
    decimals: token?.decimals ?? 18, 
    symbol: token?.symbol,
    name: token?.name,
    isLoading 
  };
}
