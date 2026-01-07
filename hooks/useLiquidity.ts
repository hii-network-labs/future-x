import { useAccount, useReadContracts } from 'wagmi';
import { ERC20_ABI } from '../constants/abis';
import { CONTRACTS } from '../constants';
import { formatUnits } from 'viem';

export interface LiquidityData {
  userGmBalance: string;
  userGmBalanceUsd: string;
  marketTvlUsd: string;
  sharePercentage: string;
  isLoading: boolean;
}

/**
 * Hook to fetch Liquidity data (TVL, User GM Balance)
 */
export function useLiquidity(
  marketAddr?: string, 
  longTokenAddr?: string, 
  shortTokenAddr?: string
) {
  const { address } = useAccount();

  // Use passed addresses or fallback to defaults
  const marketAddress = (marketAddr || CONTRACTS.market) as `0x${string}`;
  const shortTokenAddress = (shortTokenAddr || CONTRACTS.usdc) as `0x${string}`;
  const longTokenAddress = (longTokenAddr || CONTRACTS.wnt) as `0x${string}`;

  // 1. Read User GM Balance (Market Token is an ERC20)
  // 2. Read Market TVL (USDC Balance + WNT Balance in Market)
  const result = useReadContracts({
    contracts: [
      {
        address: marketAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address || '0x0000000000000000000000000000000000000000'],
      },
      {
        address: shortTokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [marketAddress],
      },
      {
        address: longTokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [marketAddress],
      },
      {
        address: marketAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      },
      {
        address: marketAddress,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      },
    ],
    query: {
      refetchInterval: 10000, // Refresh every 10s
    }
  });

  const [
    userGmBalanceResult,
    marketShortBalanceResult,
    marketLongBalanceResult,
    gmDecimalsResult,
    totalSupplyResult
  ] = result.data || [];

  const isLoading = result.isLoading;

  // Process User Balance
  const userGmBalanceRaw = userGmBalanceResult?.result as bigint || 0n;
  const gmDecimals = gmDecimalsResult?.result as number || 18;
  const userGmBalanceFormatted = formatUnits(userGmBalanceRaw, gmDecimals);
  
  // Process Share %
  const totalSupplyRaw = totalSupplyResult?.result as bigint || 0n;

  const sharePercentage = totalSupplyRaw > 0n 
    ? (Number(userGmBalanceRaw) * 100 / Number(totalSupplyRaw)).toFixed(4)
    : '0';

  // Process TVL
  // Simplified TVL = Short Token Balance (usually USDC) + Long Token Balance * Price
  // For MVP we just use the Short Token balance as a proxy for stable TVL if we don't have oracle prices here yet
  const marketShortRaw = marketShortBalanceResult?.result as bigint || 0n;
  // Assuming short token is USDC 6 decimals for now, ideally we should fetch decimals too
  const marketTvlFormatted = formatUnits(marketShortRaw, 6); 

  // Approximating GM Price = TVL / TotalSupply? 
  // For simplicity MVP: 1 GM ~= 1 USD (it's a stablecoin pair usually)
  const userGmBalanceUsd = parseFloat(userGmBalanceFormatted).toFixed(2);

  return {
    data: {
      userGmBalance: parseFloat(userGmBalanceFormatted).toFixed(4),
      userGmBalanceUsd: userGmBalanceUsd,
      marketTvlUsd: parseFloat(marketTvlFormatted).toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sharePercentage: sharePercentage,
      isLoading
    } as LiquidityData,
    refetch: result.refetch
  };
}
