import { useBalance as useWagmiBalance, useReadContract } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';
import { CONTRACTS } from '../constants';

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

  // Optional: Fetch decimals if ERC20 (optimisation: hardcode known tokens or fetch once)
  // For now, assume 6 for USDC if address matches, else 18 to start, or fetch.
  // GMX V2 tokens usually 6 (USDC) or 18.
  // Let's assume 18 usually but 6 for USDC.
  const isUSDC = tokenAddress?.toLowerCase() === CONTRACTS.usdc.toLowerCase();
  const decimals = isUSDC ? 6 : 18; 

  if (!tokenAddress) {
    return {
      balance: nativeBalance?.value 
        ? Number(formatUnits(nativeBalance.value, nativeBalance.decimals)).toFixed(4)
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
      ? Number(formatUnits(tokenBalanceVal, decimals)).toFixed(2)
      : '0.00',
    balanceRaw: tokenBalanceVal || 0n,
    decimals: decimals,
    isLoading: isTokenLoading,
    refetch: refetchToken,
    symbol: '', // Symbol fetching would require another call, passed from parent usually
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
    ? Number(formatUnits(balance.value, balance.decimals)).toFixed(4)
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
    ? Number(formatUnits(balance.value, balance.decimals)).toFixed(4)
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
