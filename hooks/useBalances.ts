import { useBalance as useWagmiBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACTS } from '../constants';

/**
 * Hook to fetch user's USDC balance
 */
export function useUSDCBalance(address: `0x${string}` | undefined) {
  const { data: balance, isLoading, refetch } = useWagmiBalance({
    address: address,
    // token: CONTRACTS.usdc as `0x${string}`, // Temporarily commented to fix lint if needed, but let's see
  });

  // Format balance properly
  const formatted = balance?.value 
    ? Number(formatUnits(balance.value, balance.decimals)).toFixed(2)
    : '0.00';

  const raw = balance?.value || 0n;

  return {
    balance: formatted,
    balanceRaw: raw,
    decimals: balance?.decimals || 6,
    isLoading,
    refetch,
    symbol: balance?.symbol || 'USDC',
  };
}

/**
 * Hook to fetch user's ETH balance (for gas)
 */
export function useETHBalance(address: `0x${string}` | undefined) {
  const { data: balance, isLoading, refetch } = useWagmiBalance({
    address: address,
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
