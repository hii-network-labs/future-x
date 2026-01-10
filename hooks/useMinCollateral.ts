import { useReadContract } from 'wagmi';
import { keccak256, encodeAbiParameters, formatUnits } from 'viem';
import { CONTRACTS, GMX_DECIMALS } from '../constants';

/**
 * GMX V2 DataStore key for MIN_COLLATERAL_USD
 * Uses abi.encode pattern: keccak256(encodeAbiParameters([{type: 'string'}], ['MIN_COLLATERAL_USD']))
 */
const MIN_COLLATERAL_USD_KEY = keccak256(
  encodeAbiParameters([{ type: 'string' }], ['MIN_COLLATERAL_USD'])
);

/**
 * DataStore ABI - getUint function to read uint256 values
 */
const DATASTORE_ABI = [
  {
    name: 'getUint',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'key', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * Hook to fetch MIN_COLLATERAL_USD from GMX V2 DataStore
 * Returns the minimum collateral required in USD (30 decimals)
 */
export function useMinCollateral() {
  const { data: minCollateralRaw, isLoading, error } = useReadContract({
    address: CONTRACTS.dataStore as `0x${string}`,
    abi: DATASTORE_ABI,
    functionName: 'getUint',
    args: [MIN_COLLATERAL_USD_KEY],
    query: {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 30 * 60 * 1000,   // Keep in garbage collection for 30 mins
    }
  });

  // Convert from 30 decimals to human-readable USD
  const minCollateralUsd = minCollateralRaw 
    ? Number(formatUnits(minCollateralRaw, GMX_DECIMALS)) 
    : 10; // Fallback to $10 if query fails

  // Debug log
  // console.log('[useMinCollateral] DataStore MIN_COLLATERAL_USD:', {
  //   raw: minCollateralRaw?.toString(),
  //   usd: minCollateralUsd,
  //   isLoading,
  //   error: error?.message,
  // });

  return {
    minCollateralUsd,
    minCollateralRaw: minCollateralRaw || 0n,
    isLoading,
    error,
  };
}
