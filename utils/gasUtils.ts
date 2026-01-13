
import { formatEther } from 'viem';

// Benchmarks (Estimated Gas Limits for Keeper Execution)
// Based on empirical data and GMX V2 complexity
export const GAS_LIMITS = {
  DEPOSIT: 300000n,
  WITHDRAWAL: 2000000n, // Verified high limit needed
  ORDER: 500000n,       // Increase/Decrease Position
};

// Configurable buffer to ensure Keeper picks it up even if gas spikes
const GAS_PRICE_BUFFER = 1.2; // 20% buffer

/**
 * Estimates the execution fee required for a GMX V2 Action.
 * 
 * @param gasPrice - Current network gas price (wei)
 * @param gasLimit - Benchmark gas limit for the specific action
 * @param buffer - Optional buffer multiplier (default 1.2)
 * @param minFeeEth - Minimum fee floor in ETH (default 0.01)
 * @returns {bigint} - The calculated execution fee in wei
 */
export function estimateExecutionFee(
  gasPrice: bigint,
  gasLimit: bigint,
  buffer: number = GAS_PRICE_BUFFER,
  minFeeEth: number = 0.01 // 0.01 ETH minimum to prevent GMX contract rejection
): bigint {
  // Fee = GasPrice * GasLimit * Buffer
  // We use BigInt arithmetic. Multiplier is applied as (x * (buffer * 100)) / 100
  
  const bufferedPrice = (gasPrice * BigInt(Math.floor(buffer * 100))) / 100n;
  const fee = bufferedPrice * gasLimit;
  
  // Apply minimum fee floor (critical for low gas price chains)
  const minFeeWei = BigInt(Math.floor(minFeeEth * 1e18));
  
  return fee > minFeeWei ? fee : minFeeWei;
}

/**
 * Formats the fee for display (e.g. "0.005 ETH")
 */
export function formatExecutionFee(fee: bigint): string {
    const eth = formatEther(fee);
    // Truncate to 5 decimals safely
    const [int, dec] = eth.split('.');
    if (!dec) return `${int} ETH`;
    return `${int}.${dec.slice(0, 5)} ETH`;
}
