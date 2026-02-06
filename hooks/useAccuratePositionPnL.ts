import { useQuery } from '@apollo/client/react';
import { subgraphClient, GET_TRADE_ACTIONS, GET_POSITION_FEE_DETAILS } from '../lib/subgraph';
import {
  convertPnlToTokenAmount,
  formatPnlUsd,
  formatTokenAmount,
  validateBorrowingFee,
  GMX_PNL_PRECISION,
} from '../lib/gmxPricePrecision';
import { CONTRACTS, getTokenDecimals } from '../constants';

export interface PositionFees {
  positionFee: bigint;
  borrowingFee: bigint;
  fundingFee: bigint; // Positive if collected, negative if paid
  totalFees: bigint;
}

export interface AccuratePositionPnL {
  basePnlUsd: number; // PnL based on mark price only (in USD)
  basePnlInTokens: number; // PnL in collateral token amount
  priceImpactUsd: number; // Price impact (can be positive or negative)
  realizedPnlUsd: number; // Total PnL in USD including all fees
  realizedPnlInTokens: number; // Total PnL in collateral tokens
  fees: PositionFees;
  isLoading: boolean;
  error?: Error;
  warnings?: string[]; // Validation warnings (e.g., suspicious borrowing fee)
}

/**
 * Hook to fetch accurate Position PnL from Subgraph
 * 
 * UPDATED: Now handles GMX V2's mixed precision system:
 * - basePnlUsd from subgraph is in 1e30 precision
 * - Converts to token amount using correct price scale (1e24 for stablecoins)
 * - Validates borrowing fees to detect subgraph indexing bug
 * 
 * This includes:
 * - Base PnL (mark price based)
 * - Funding fees (collected or paid)
 * - Borrowing fees  
 * - Position fees
 * - Price impact
 * 
 * @param account - User wallet address
 * @param marketAddress - Market contract address
 * @param enabled - Whether to enable the query (default: true)
 */
export function useAccuratePositionPnL(
  account: string | undefined,
  marketAddress: string | undefined,
  enabled: boolean = true
) {
  const { data, loading, error } = useQuery(GET_TRADE_ACTIONS, {
    client: subgraphClient,
    variables: {
      account: account?.toLowerCase(),
      marketAddress: marketAddress?.toLowerCase(),
    },
    skip: !enabled || !account || !marketAddress,
    pollInterval: 10000, // Refetch every 10 seconds
  });

  if (!enabled || !data || loading) {
    return {
      basePnlUsd: 0,
      basePnlInTokens: 0,
      priceImpactUsd: 0,
      realizedPnlUsd: 0,
      realizedPnlInTokens: 0,
      fees: {
        positionFee: 0n,
        borrowingFee: 0n,
        fundingFee: 0n,
        totalFees: 0n,
      } as PositionFees,
      isLoading: loading,
      error: error as Error | undefined,
    } as AccuratePositionPnL;
  }

  // Find the most recent open position (PositionIncrease without matching PositionDecrease)
  const increaseActions = (data as any).tradeActions.filter((a: any) => a.eventName === 'PositionIncrease');
  const decreaseActions = (data as any).tradeActions.filter((a: any) => a.eventName === 'PositionDecrease');

  // Check if position is still open (has increase but no decrease at same or later timestamp)
  const latestIncrease = increaseActions[0];
  
  if (!latestIncrease) {
    // No position found
    return {
      basePnlUsd: 0,
      basePnlInTokens: 0,
      priceImpactUsd: 0,
      realizedPnlUsd: 0,
      realizedPnlInTokens: 0,
      fees: {
        positionFee: 0n,
        borrowingFee: 0n,
        fundingFee: 0n,
        totalFees: 0n,
      } as PositionFees,
      isLoading: false,
    } as AccuratePositionPnL;
  }

  // For OPEN positions: Calculate unrealized PnL based on current price
  // This would require additional market price data, so for now we'll return 0
  // The subgraph only has historical (realized) PnL

  // For CLOSED positions: Get the most recent PositionDecrease
  const latestDecrease = decreaseActions.find((d: any) => 
    d.timestamp >= latestIncrease.timestamp
  );

  if (latestDecrease) {
    // Position was closed - use realized PnL from subgraph
    const basePnlUsdRaw = BigInt(latestDecrease.basePnlUsd || 0);
    const basePnlUsd = formatPnlUsd(basePnlUsdRaw);
    
    const priceImpactUsdRaw = BigInt(latestDecrease.priceImpactUsd || 0);
    const priceImpactUsd = formatPnlUsd(priceImpactUsdRaw);
    
    const positionFee = BigInt(latestDecrease.positionFeeAmount || 0);
    const borrowingFee = BigInt(latestDecrease.borrowingFeeAmount || 0);
    const fundingFee = BigInt(latestDecrease.fundingFeeAmount || 0);

    // ⚠️ CRITICAL: Convert basePnlUsd to token amount using correct price precision
    // For this deployment, we currently only use USDC as collateral
    // TODO: If adding other collateral types, fetch collateralTokenAddress from subgraph
    const collateralTokenAddress = CONTRACTS.usdc;
    const collateralDecimals = getTokenDecimals(collateralTokenAddress);
    
    // For now, use $1.00 price for USDC (1e24 precision)
    // In production, you might want to fetch this from an oracle or price feed
    const usdcPrice = BigInt('1000000000000000000000000'); // $1.00 in 1e24 precision
    
    const basePnlInTokensRaw = convertPnlToTokenAmount(
      basePnlUsdRaw,
      usdcPrice,
      collateralTokenAddress,
      collateralDecimals,
    );
    const basePnlInTokens = formatTokenAmount(basePnlInTokensRaw, collateralDecimals);

    // Validate borrowing fee to detect subgraph bug
    const warnings: string[] = [];
    const collateralAmount = BigInt(latestDecrease.collateralDeltaAmount || 0);
    const borrowingFeeValidation = validateBorrowingFee(borrowingFee, collateralAmount);
    if (!borrowingFeeValidation.isValid || borrowingFeeValidation.warning) {
      if (borrowingFeeValidation.warning) {
        warnings.push(borrowingFeeValidation.warning);
        console.warn('[useAccuratePositionPnL] Borrowing Fee Validation:', borrowingFeeValidation.warning);
        console.warn('[useAccuratePositionPnL] Data:', {
          borrowingFee: borrowingFee.toString(),
          collateralAmount: collateralAmount.toString(),
          txHash: latestDecrease.transaction.hash,
        });
      }
    }

    // Calculate total fees in token amount
    // All fees from subgraph are already in token's smallest unit (e.g., USDCwei for USDC)
    const totalFeesRaw = positionFee + borrowingFee + fundingFee;
    const totalFeesInTokens = formatTokenAmount(totalFeesRaw, collateralDecimals);
    const totalFeesUsd = totalFeesInTokens; // For stablecoins, 1 token = $1

    // Realized PnL = Base PnL + Price Impact - Total Fees (all in token amounts)
    const realizedPnlInTokens = basePnlInTokens + priceImpactUsd - totalFeesInTokens;
    const realizedPnlUsd = realizedPnlInTokens; // For USDC

    return {
      basePnlUsd,
      basePnlInTokens,
      priceImpactUsd,
      realizedPnlUsd,
      realizedPnlInTokens,
      fees: {
        positionFee,
        borrowingFee,
        fundingFee,
        totalFees: totalFeesRaw,
      },
      isLoading: false,
      warnings: warnings.length > 0 ? warnings : undefined,
    } as AccuratePositionPnL;
  }

  // Position is still open - cannot get realized PnL yet
  // Return placeholder
  return {
    basePnlUsd: 0,
    basePnlInTokens: 0,
    priceImpactUsd: 0,
    realizedPnlUsd: 0,
    realizedPnlInTokens: 0,
    fees: {
      positionFee: 0n,
      borrowingFee: 0n,
      fundingFee: 0n,
      totalFees: 0n,
    } as PositionFees,
    isLoading: false,
    error: new Error('Position is still open - subgraph only tracks realized PnL'),
  } as AccuratePositionPnL;
}

/**
 * Hook to fetch fee details for a specific order
 * Useful when displaying close position confirmation dialog
 */
export function useOrderFeeDetails(orderKey: string | undefined, enabled: boolean = true) {
  const { data, loading, error } = useQuery(GET_POSITION_FEE_DETAILS, {
    client: subgraphClient,
    variables: { positionKey: orderKey },
    skip: !enabled || !orderKey,
  });

  if (!data || loading || !(data as any).positionFeesInfos?.[0]) {
    return {
      fees: null,
      isLoading: loading,
      error: error as Error | undefined,
      warning: undefined,
    };
  }

  const feeInfo = (data as any).positionFeesInfos[0];
  const borrowingFee = BigInt(feeInfo.borrowingFeeAmount);
  const positionFee = BigInt(feeInfo.positionFeeAmount);

  // Validate borrowing fee
  const totalCollateral = positionFee * 100n; // Rough estimate, actual collateral might be different
  const validation = validateBorrowingFee(borrowingFee, totalCollateral);
  
  if (!validation.isValid) {
    console.warn('[useOrderFeeDetails] Validation Warning:', validation.warning);
  }

  return {
    fees: {
      positionFee: BigInt(feeInfo.positionFeeAmount),
      borrowingFee,
      fundingFee: BigInt(feeInfo.fundingFeeAmount),
      totalFees: BigInt(feeInfo.positionFeeAmount) + borrowingFee + BigInt(feeInfo.fundingFeeAmount),
    } as PositionFees,
    isLoading: false,
    warning: validation.warning,
  };
}

