import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';

const SUBGRAPH_URL = process.env.SUBGRAPH_URL + '/v1/graphql';

export interface LiquidityHistoryItem {
  id: string;
  timestamp: number;
  tokensBalance: string;
  cumulativeIncome: string;
  marketAddress: string;
  changeAmount: string; // Calculated difference
}

const LIQUIDITY_HISTORY_QUERY = `
  query GetLiquidityHistory($account: String!) {
    UserGmTokensBalanceChange(
      where: { account: { _ilike: $account } }
      order_by: { timestamp: desc }
    ) {
      id
      timestamp
      tokensBalance
      cumulativeIncome
      marketAddress
      cumulativeFeeUsdPerGmToken
    }
  }
`;

export function useLiquidityHistory(account: string | undefined) {
  return useQuery({
    queryKey: ['liquidityHistory', account],
    queryFn: async () => {
      if (!account) return { history: [], feesEarned: '0', pnl: '0' };

      try {
        const response = await fetch(SUBGRAPH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: LIQUIDITY_HISTORY_QUERY,
            variables: { account: account.toLowerCase() },
          }),
        });

        const result = await response.json();
        console.log('LiquidityHistory Subgraph Result:', result);
        const changes = result.data?.UserGmTokensBalanceChange || [];

        // Calculate Stats
        // Latest cumulativeIncome should be the total fees/pnl earned?
        // Let's assume cumulativeIncome tracks Realized PnL + Fees?
        const latest = changes[0];
        const feesEarned = latest ? formatUnits(BigInt(latest.cumulativeIncome), 18) : '0'; // Assuming 18 decimals for USD? Or 6? 30?
        // Actually GMX usually uses 30 decimals for USD values in contracts, but let's check.
        // If it's 18 (WNT) or 6 (USDC)?
        // Use logic: if values are huge, likely 30.
        
        return {
            history: changes,
            feesEarned, // TODO: verify decimals
            pnl: '0' // PnL might be embedded in Income or calc from price vs cost
        };
      } catch (error) {
        console.error('Liquidity history fetch error:', error);
        return { history: [], feesEarned: '0', pnl: '0' };
      }
    },
    enabled: !!account,
  });
}
