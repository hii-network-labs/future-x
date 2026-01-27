
import { MarketSide } from '../types';

export const PRICE_PRECISION = 30n;
export const DEFAULT_SLIPPAGE_BPS = 100n; // 1.0% (Increased for safety)
export const BPS_DIVISOR = 10000n;

/**
 * Calculates the acceptable price for an order, handling slippage direction and compact decimal scaling.
 * 
 * @param currentPrice30 - Current Index Price in 30 decimals (BigInt)
 * @param isLong - Whether the position is Long
 * @param isIncrease - Whether we are increasing (Opening/Adding) or Decreasing (Closing/Reducing)
 * @param indexDecimals - Decimals of the Index Token (default 18 for WNT/GMX, 8 for BTC, etc.)
 * @param slippageBps - Slippage tolerance in Basis Points (default 50 = 0.5%)
 * @returns Acceptable Price in "Compact Decimals" (Contract Format)
 */
export function calculateAcceptablePrice(
  currentPrice30: bigint,
  isLong: boolean,
  isIncrease: boolean,
  indexDecimals: number = 18,
  slippageBps: bigint = DEFAULT_SLIPPAGE_BPS
): bigint {
  if (currentPrice30 === 0n) return 0n;

  // Determine direction:
  // Increase Long (Buy) -> Max Price (Price * (1 + S))
  // Increase Short (Sell) -> Min Price (Price * (1 - S))
  // Decrease Long (Sell) -> Min Price (Price * (1 - S))
  // Decrease Short (Buy) -> Max Price (Price * (1 + S))
  
  // Logic Matrix:
  // | Long | Increase | Action | Direction | Formula |
  // |------|----------|--------|-----------|---------|
  // |  T   |    T     |  Buy   |   Max     |  1 + S  |
  // |  F   |    T     |  Sell  |   Min     |  1 - S  |
  // |  T   |    F     |  Sell  |   Min     |  1 - S  |
  // |  F   |    F     |  Buy   |   Max     |  1 + S  |
  
  // Simplified: If (isLong == isIncrease) -> Max (1+S). Else -> Min (1-S).
  const useMaxPrice = isLong === isIncrease;

  let acceptablePrice30 = 0n;
  
  if (useMaxPrice) {
    acceptablePrice30 = currentPrice30 * (BPS_DIVISOR + slippageBps) / BPS_DIVISOR;
  } else {
    acceptablePrice30 = currentPrice30 * (BPS_DIVISOR - slippageBps) / BPS_DIVISOR;
  }

  // Scale to Compact Decimals
  // Contract Expects: Price * 10^(30 - TokenDecimals)
  // Input currentPrice30 is Price * 10^30.
  // We need to divide by 10^TokenDecimals.
  const decimalsScale = 10n ** BigInt(indexDecimals);
  const compactPrice = acceptablePrice30 / decimalsScale;
  
  return compactPrice;
}
