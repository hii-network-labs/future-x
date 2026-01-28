
import { useAccount, useReadContracts } from 'wagmi';
import { ERC20_ABI } from '../constants/abis';
import { CONTRACTS } from '../constants';
import { formatUnits } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface LiquidityData {
  userGmBalance: string;
  userGmBalanceUsd: string;
  marketTvlUsd: string;
  sharePercentage: string;
  
  // Backing Composition
  longPoolAmount: number;
  longPoolUsd: number;
  longPoolPercentage: number;
  shortPoolAmount: number;
  shortPoolUsd: number;
  shortPoolPercentage: number;
  
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
  
  // 1. Fetch Global Market Stats from Backend (API)
  const { data: markets, isLoading: isApiLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: () => apiClient.getMarkets(),
    refetchInterval: 10000,
  });

  const marketStats = markets?.find(m => m.address.toLowerCase() === marketAddress.toLowerCase());

  // 2. Read User GM Balance (Market Token is an ERC20)
  // We still need to read user balance from chain as it is specific to the connected wallet
  const result = useReadContracts({
    contracts: [
      {
        address: marketAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address || '0x0000000000000000000000000000000000000000'],
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
      }
    ],
    query: {
      refetchInterval: 10000,
    }
  });

  const [
    userGmBalanceResult,
    gmDecimalsResult,
    totalSupplyResult
  ] = result.data || [];

  const isLoading = result.isLoading || isApiLoading;

  // Process User Balance
  const userGmBalanceRaw = userGmBalanceResult?.result as bigint || 0n;
  const gmDecimals = gmDecimalsResult?.result as number || 18;
  const userGmBalanceFormatted = formatUnits(userGmBalanceRaw, gmDecimals);
  
  // Process Share %
  // Ideally use API total supply if available, but chain is fine too
  const totalSupplyRaw = totalSupplyResult?.result as bigint || 0n;

  const sharePercentage = totalSupplyRaw > 0n 
    ? (Number(userGmBalanceRaw) * 100 / Number(totalSupplyRaw)).toFixed(4)
    : '0';

  // Use API Data for TVL & Backing
  const marketTvl = marketStats?.tvl || 0;
  const marketTokenPrice = marketStats?.marketTokenPrice || 0;
  
  const userGmBalanceUsd = (Number(userGmBalanceFormatted) * marketTokenPrice).toFixed(2);

  const formatFloor = (val: bigint, decimals: number, precision: number) => {
    const formatted = formatUnits(val, decimals);
    const [int, frac] = formatted.split('.');
    if (!frac) return int;
    return `${int}.${frac.slice(0, precision)}`;
  };

  // Calculate Percentages from API data
  const longPoolAmount = marketStats?.longPoolAmount || 0;
  const longPoolUsd = marketStats?.longPoolUsd || 0;
  
  const shortPoolAmount = marketStats?.shortPoolAmount || 0;
  const shortPoolUsd = marketStats?.shortPoolUsd || 0;

  const totalPoolUsd = longPoolUsd + shortPoolUsd;
  
  const longPoolPercentage = totalPoolUsd > 0 ? (longPoolUsd / totalPoolUsd) * 100 : 0;
  const shortPoolPercentage = totalPoolUsd > 0 ? (shortPoolUsd / totalPoolUsd) * 100 : 0;

  return {
    data: {
      userGmBalance: formatFloor(userGmBalanceRaw, gmDecimals, 4),
      userGmBalanceUsd: userGmBalanceUsd,
      marketTvlUsd: marketTvl.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sharePercentage: sharePercentage,
      
      // Backing Composition Data (From API)
      longPoolAmount,
      longPoolUsd,
      longPoolPercentage,
      
      shortPoolAmount,
      shortPoolUsd,
      shortPoolPercentage,

      isLoading
    } as LiquidityData,
    refetch: result.refetch
  };
}
