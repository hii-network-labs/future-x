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
import { usePrices } from './usePrices';

/**
 * Hook to fetch Liquidity data (TVL, User GM Balance)
 */
export function useLiquidity(
  marketAddr?: string, 
  longTokenAddr?: string, 
  shortTokenAddr?: string
) {
  const { address } = useAccount();
  const { getPrice } = usePrices();

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
      {
         address: longTokenAddress,
         abi: ERC20_ABI,
         functionName: 'decimals',
      },
      {
         address: shortTokenAddress,
         abi: ERC20_ABI,
         functionName: 'decimals',
      }
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
    totalSupplyResult,
    longDecimalsResult,
    shortDecimalsResult
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

  // Process TVL & Price
  const marketShortRaw = marketShortBalanceResult?.result as bigint || 0n;
  const marketLongRaw = marketLongBalanceResult?.result as bigint || 0n;
  
  const shortDecimals = shortDecimalsResult?.result as number || 6;
  const longDecimals = longDecimalsResult?.result as number || 18;

  const shortPrice = getPrice(shortTokenAddress) || 1; // Default USDC to $1
  const longPrice = getPrice(longTokenAddress);

  const shortVal = Number(formatUnits(marketShortRaw, shortDecimals)) * shortPrice;
  const longVal = Number(formatUnits(marketLongRaw, longDecimals)) * longPrice;
  
  const marketTvl = shortVal + longVal;
  
  // Calculate Market Token Price (Implied)
  let marketTokenPrice = 1;
  const totalSupplyNum = Number(formatUnits(totalSupplyRaw, gmDecimals));

  if (totalSupplyNum > 0 && marketTvl > 0) {
      marketTokenPrice = marketTvl / totalSupplyNum;
  }

  const userGmBalanceUsd = (Number(userGmBalanceFormatted) * marketTokenPrice).toFixed(2);

  // Helper: Floor to N decimals (Inline as it might not export from hook file cleanly without dedicated utils)
  // Actually, I can import it if I added it to utils.
  // const formatFloor = (val: bigint, decimals: number, precision: number) => ...
  // Let's use string manipulation directly here for safety.
  const formatFloor = (val: bigint, decimals: number, precision: number) => {
    const formatted = formatUnits(val, decimals);
    const [int, frac] = formatted.split('.');
    if (!frac) return int;
    return `${int}.${frac.slice(0, precision)}`;
  };

  return {
    data: {
      userGmBalance: formatFloor(userGmBalanceRaw, gmDecimals, 4),
      userGmBalanceUsd: userGmBalanceUsd,
      marketTvlUsd: marketTvl.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      sharePercentage: sharePercentage,
      isLoading
    } as LiquidityData,
    refetch: result.refetch
  };
}
