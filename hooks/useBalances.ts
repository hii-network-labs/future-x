import { useBalance as useWagmiBalance, useReadContract } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';
import { useTokenDecimals } from './useTokens';


// Helper: Floor to N decimals
const formatFloor = (val: bigint, decimals: number, precision: number) => {
  const formatted = formatUnits(val, decimals);
  const [int, frac] = formatted.split('.');
  if (!frac) return int;
  return `${int}.${frac.slice(0, precision)}`;
};

/**
 * Hook to fetch generic token balance
 */
export function useTokenBalance(address: `0x${string}` | undefined, tokenAddress: `0x${string}` | undefined) {
  // Strategy 1: Native Balance (if no tokenAddress)
  const { data: nativeBalance, isLoading: isNativeLoading, refetch: refetchNative } = useWagmiBalance({
    address: address,
    query: {
      enabled: !tokenAddress,
      refetchInterval: 5000, // Auto-refresh every 5 seconds
    }
  });

  // Strategy 2: ERC20 Balance
  const { data: tokenBalanceVal, isLoading: isTokenLoading, refetch: refetchToken } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!tokenAddress && !!address,
      refetchInterval: 5000, // Auto-refresh every 5 seconds
    }
  });

  // Fetch decimals dynamically from keeper API
  const { decimals } = useTokenDecimals(tokenAddress);
 


  if (!tokenAddress) {
    return {
      balance: nativeBalance?.value 
        ? formatFloor(nativeBalance.value, nativeBalance.decimals, 4)
        : '0.0000',
      balanceRaw: nativeBalance?.value || 0n,
      decimals: nativeBalance?.decimals || 18,
      isLoading: isNativeLoading,
      refetch: refetchNative,
      symbol: nativeBalance?.symbol || 'ETH',
    };
  }

  return {
    balance: tokenBalanceVal !== undefined
      ? formatFloor(tokenBalanceVal, decimals, 4) // Use 4 decimals for precision (was 2)
      : '0.0000',
    balanceRaw: tokenBalanceVal || 0n,
    decimals: decimals,
    isLoading: isTokenLoading,
    refetch: refetchToken,
    symbol: '', 
  };
}

/**
 * Hook to fetch user's ETH balance (for gas)
 */
export function useETHBalance(address: `0x${string}` | undefined) {
  const { data: balance, isLoading, refetch } = useWagmiBalance({
    address: address,
    query: {
      refetchInterval: 5000, // Auto-refresh every 5 seconds
    }
  });

  const formatted = balance?.value 
    ? formatFloor(balance.value, balance.decimals, 4)
    : '0.0000';

  const raw = balance?.value || 0n;

  return {
    balance: formatted,
    balanceRaw: raw,
    decimals: balance?.decimals || 18,
    isLoading,
    refetch,
    symbol: balance?.symbol || 'HNC',
  };
}

/**
 * Hook to fetch user's WNT (Wrapped Native Token) balance
 */
export function useWNTBalance(address: `0x${string}` | undefined) {
  const { data: balance, isLoading, refetch } = useWagmiBalance({
    address: address,
    // token: CONTRACTS.wnt as `0x${string}`,
  });

  const formatted = balance?.value 
    ? formatFloor(balance.value, balance.decimals, 4)
    : '0.0000';

  const raw = balance?.value || 0n;

  return {
    balance: formatted,
    balanceRaw: raw,
    decimals: balance?.decimals || 18,
    isLoading,
    refetch,
    symbol: balance?.symbol || 'HNC',
  };
}
