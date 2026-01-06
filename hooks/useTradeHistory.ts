import { useQuery } from '@tanstack/react-query';
import { SUBGRAPH_URL as BASE_URL } from '../constants';

const SUBGRAPH_URL = BASE_URL + '/v1/graphql';

interface TradeAction {
  id: string;
  eventName: string;
  orderKey: string;
  orderType: string;
  account: string;
  marketAddress: string | null;
  initialCollateralTokenAddress: string;
  sizeDeltaUsd: string | null;
  executionPrice: string | null;
  triggerPrice: string | null;
  acceptablePrice: string | null;
  priceImpactUsd: string | null;
  pnlUsd: string | null;
  basePnlUsd: string | null;
  positionFeeAmount: string | null;
  borrowingFeeAmount: string | null;
  fundingFeeAmount: string | null;
  isLong: boolean | null;
  timestamp: number;
  transaction: {
    hash: string;
  };
}

interface TradeHistoryResponse {
  tradeActions: TradeAction[];
}

// ... (interfaces)

const TRADE_HISTORY_QUERY = `
  query GetTradeHistory($account: String!, $limit: Int!, $skip: Int!) {
    TradeAction(
      where: { 
        account: { _ilike: $account },
        eventName: { _in: ["OrderExecuted", "OrderCancelled"] }
      }
      order_by: { timestamp: desc }
      limit: $limit
      offset: $skip
    ) {
      id
      eventName
      orderKey
      orderType
      account
      marketAddress
      initialCollateralTokenAddress
      sizeDeltaUsd
      executionPrice
      triggerPrice
      acceptablePrice
      priceImpactUsd
      pnlUsd
      basePnlUsd
      positionFeeAmount
      borrowingFeeAmount
      fundingFeeAmount
      isLong
      timestamp
      transaction {
        hash
      }
    }
  }
`;

const TRADE_COUNT_QUERY = `
  query GetTradeCount($account: String!) {
    TradeAction(
      where: { 
        account: { _ilike: $account },
        eventName: { _in: ["OrderExecuted", "OrderCancelled"] }
      }
      limit: 1000
    ) {
      id
    }
  }
`;

// ... imports

// ... queries ...

export function useTradeHistory(account: string | undefined, page: number = 1, limit: number = 10) {
  // Query for trades
  const tradesQuery = useQuery<TradeAction[]>({
    queryKey: ['tradeHistory', account, page, limit],
    queryFn: async () => {
      if (!account) return [];

      const skip = (page - 1) * limit;

      try {
        const response = await fetch(SUBGRAPH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: TRADE_HISTORY_QUERY,
            variables: { account: account.toLowerCase(), limit, skip },
          }),
        });

        const result = await response.json();
        return result.data?.TradeAction || [];
      } catch (error) {
        console.error('Trade history fetch error:', error);
        return [];
      }
    },
    enabled: !!account,
    refetchInterval: 10000,
  });

  // Query for exact total count (by fetching IDs)
  const countQuery = useQuery({
    queryKey: ['tradeCount', account],
    queryFn: async () => {
      if (!account) return 0;
      try {
        const response = await fetch(SUBGRAPH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: TRADE_COUNT_QUERY,
            variables: { account: account.toLowerCase() },
          }),
        });
        const result = await response.json();
        
        if (result.errors) {
            console.error('Trade count GraphQL errors:', result.errors);
            return 0;
        }

        const actions = result.data?.TradeAction || [];
        console.log('Trade count actions fetched:', actions.length);
        return actions.length;
      } catch (e) {
        console.error('Trade count fetch error:', e);
        return 0;
      }
    },
    enabled: !!account,
  });

  const total = countQuery.data || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: tradesQuery.data || [],
    isLoading: tradesQuery.isLoading,
    total,
    totalPages,
    hasNextPage: page < totalPages
  };
}
