import { useQuery } from '@tanstack/react-query';
import { apiClient, TradeHistory, PaginatedResponse } from '../lib/api-client';

export function useTradeHistory(account: string | undefined, page: number = 1, limit: number = 10) {
  // Query for trades via API
  const tradesQuery = useQuery<PaginatedResponse<TradeHistory>>({
    queryKey: ['tradeHistory', account, page, limit],
    queryFn: async () => {
      if (!account) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      return apiClient.getHistory(account, page, limit);
    },
    enabled: !!account,
    refetchInterval: 10000,
  });

  const response = tradesQuery.data || { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
  const allTrades = response.data;
  const total = response.meta.total;
  const totalPages = response.meta.totalPages;

  return {
    data: allTrades, // Display current page data directly
    isLoading: tradesQuery.isLoading,
    total,
    totalPages,
    hasNextPage: page < totalPages
  };
}
