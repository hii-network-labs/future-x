/**
 * GMX V2 Price Precision Utilities
 * 
 * GMX V2 uses MIXED PRECISION for different price types:
 * - PnL amounts (USD): 1e30
 * - Stablecoin prices: 1e24
 * - Non-stablecoin prices: 1e12
 * 
 * This was discovered through smart contract analysis when debugging PnL discrepancies.
 * See: docs/GMX_V2_PRICE_PRECISION.md for full explanation
 */

// ============================================================================
// PRECISION CONSTANTS
// ============================================================================

export const GMX_PNL_PRECISION = BigInt(10 ** 30);
export const GMX_STABLECOIN_PRICE_PRECISION = BigInt(10 ** 24);
export const GMX_TOKEN_PRICE_PRECISION = BigInt(10 ** 12);

// ============================================================================
// STABLECOIN REGISTRY
// ============================================================================

const STABLECOINS = new Set<string>([
  '0xe0105cf6930e8767adb5425ddc7f8b6df25699a6', // USDC
  // Add other stablecoins as needed:
  // '0x...', // USDT
  // '0x...', // DAI
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a token address is a stablecoin
 */
export function isStablecoin(tokenAddress: string): boolean {
  return STABLECOINS.has(tokenAddress.toLowerCase());
}

/**
 * Get the correct price precision for a token
 * - Stablecoins: 1e24
 * - Non-stablecoins: 1e12
 */
export function getTokenPricePrecision(tokenAddress: string): bigint {
  return isStablecoin(tokenAddress) 
    ? GMX_STABLECOIN_PRICE_PRECISION 
    : GMX_TOKEN_PRICE_PRECISION;
}

// ============================================================================
// CORE CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert PnL from USD (1e30) to token amount
 * 
 * This is critical for accurate PnL display!
 * 
 * Example:
 * - basePnlUsd = 134237647897717303760000000000 (1e30) = $0.134238
 * - collateralTokenPrice = 690000000000000000000000 (1e24) = $0.69/USDC
 * - usdcDecimals = 6
 * 
 * Result: 0.134238 / 0.69 = 0.194547 USDC = 194547 USDCwei
 * 
 * @param pnlUsd - PnL in USD with 1e30 precision
 * @param tokenPrice - Token price in its native precision (1e24 for stables, 1e12 for others)
 * @param tokenAddress - Token contract address
 * @param tokenDecimals - Token decimals (e.g., 6 for USDC, 18 for ETH)
 * @returns PnL amount in token's smallest unit
 */
export function convertPnlToTokenAmount(
  pnlUsd: bigint,
  tokenPrice: bigint,
  tokenAddress: string,
  tokenDecimals: number,
): bigint {
  const pricePrecision = getTokenPricePrecision(tokenAddress);
  
  // Formula: (pnlUsd * pricePrecision * 10^decimals) / (tokenPrice * 1e30)
  const numerator = pnlUsd * pricePrecision * BigInt(10 ** tokenDecimals);
  const denominator = tokenPrice * GMX_PNL_PRECISION;
  
  return numerator / denominator;
}

/**
 * Convert token amount to USD (1e30)
 * 
 * @param tokenAmount - Amount in token's smallest unit
 * @param tokenPrice - Token price in its native precision
 * @param tokenAddress - Token contract address
 * @param tokenDecimals - Token decimals
 * @returns USD amount with 1e30 precision
 */
export function convertTokenAmountToPnlUsd(
  tokenAmount: bigint,
  tokenPrice: bigint,
  tokenAddress: string,
  tokenDecimals: number,
): bigint {
  const pricePrecision = getTokenPricePrecision(tokenAddress);
  
  const numerator = tokenAmount * tokenPrice * GMX_PNL_PRECISION;
  const denominator = BigInt(10 ** tokenDecimals) * pricePrecision;
  
  return numerator / denominator;
}

/**
 * Format PnL USD (1e30) to human-readable number
 */
export function formatPnlUsd(pnlUsd: bigint): number {
  return Number(pnlUsd) / Number(GMX_PNL_PRECISION);
}

/**
 * Format token amount to human-readable number
 */
export function formatTokenAmount(amount: bigint, decimals: number): number {
  return Number(amount) / (10 ** decimals);
}

/**
 * Validate borrowing fee to detect subgraph indexing bug
 * 
 * The subgraph incorrectly indexes borrowingFeeAmount from index [15] instead of [10],
 * which causes it to read positionFeeReceiverFactor instead.
 * 
 * If borrowingFee > collateralAmount, it's likely the bug.
 * 
 * @returns true if borrowing fee looks suspicious
 */
export function validateBorrowingFee(
  borrowingFee: bigint,
  collateralAmount: bigint,
): { isValid: boolean; warning?: string } {
  if (borrowingFee > collateralAmount) {
    return {
      isValid: false,
      warning: `Suspicious borrowing fee (${borrowingFee}) exceeds collateral (${collateralAmount}). Likely subgraph indexing bug.`,
    };
  }
  
  // Borrowing fee should typically be < 10% of collateral for reasonable positions
  const tenPercent = collateralAmount / 10n;
  if (borrowingFee > tenPercent) {
    return {
      isValid: true,
      warning: `High borrowing fee (${borrowingFee}) relative to collateral (${collateralAmount}). Verify position duration.`,
    };
  }
  
  return { isValid: true };
}
