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
export function useLiquidity() {
  const { address } = useAccount();

  // We are tracking the single 'Market' defined in CONTRACTS
  const marketAddress = CONTRACTS.market as `0x${string}`;
  const usdcAddress = CONTRACTS.usdc as `0x${string}`;
  const wntAddress = CONTRACTS.wnt as `0x${string}`;

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
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [marketAddress],
      },
      {
        address: wntAddress,
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
    marketUsdcBalanceResult,
    marketWntBalanceResult,
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
  console.log('useLiquidity Debug:', { 
    userBalance: userGmBalanceRaw.toString(), 
    totalSupply: totalSupplyRaw.toString(),
    gmDecimals
  });

  const sharePercentage = totalSupplyRaw > 0n 
    ? (Number(userGmBalanceRaw) * 100 / Number(totalSupplyRaw)).toFixed(4)
    : '0';

  // Process TVL
  // Simplified TVL = USDC Balance + (WNT Balance * Price)
  // For now, let's just show USDC part as "Stable TVL" since we don't have oracle price inside this hook easily
  const marketUsdcRaw = marketUsdcBalanceResult?.result as bigint || 0n;
  const marketTvlFormatted = formatUnits(marketUsdcRaw, 6); // USDC is 6 decimals

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
