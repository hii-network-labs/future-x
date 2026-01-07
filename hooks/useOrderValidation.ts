import { useMemo } from 'react';
import { parseUnits } from 'viem';
import { useTokenBalance, useETHBalance } from './useBalances';
import { useMinCollateral } from './useMinCollateral';
import { FEES } from '../constants';

interface ValidationErrors {
  insufficientCollateral: boolean;
  belowMinimum: boolean;
  belowMinCollateral: boolean; // NEW: GMX V2 min collateral after fees
  insufficientGas: boolean;
  leverageTooHigh: boolean;
  invalidAmount: boolean;
}

interface ValidationResult {
  errors: ValidationErrors;
  isValid: boolean;
  errorMessage: string | null;
}

/**
 * Validates order inputs before submission
 */
export function useOrderValidation(
  address: `0x${string}` | undefined,
  collateralInput: string,
  leverage: number,
  collateralTokenAddress: `0x${string}` | undefined
): ValidationResult {
  const { balanceRaw: tokenBalanceRaw, symbol } = useTokenBalance(address, collateralTokenAddress);
  const { balanceRaw: ethBalanceRaw } = useETHBalance(address);
  const { minCollateralUsd } = useMinCollateral();

  const validation = useMemo(() => {
    // Parse collateral amount
    const collateralNum = parseFloat(collateralInput);
    
    // Check for invalid input
    if (isNaN(collateralNum) || collateralInput.trim() === '') {
      return {
        errors: {
          insufficientCollateral: false,
          belowMinimum: false,
          belowMinCollateral: false,
          insufficientGas: false,
          leverageTooHigh: false,
          invalidAmount: true,
        },
        isValid: false,
        errorMessage: 'Enter collateral amount',
      };
    }

    // Convert to raw units for comparison (USDC has 6 decimals)
    let collateralRaw: bigint;
    try {
      collateralRaw = parseUnits(collateralInput, 6);
    } catch {
      return {
        errors: {
          insufficientCollateral: false,
          belowMinimum: false,
          belowMinCollateral: false,
          insufficientGas: false,
          leverageTooHigh: false,
          invalidAmount: true,
        },
        isValid: false,
        errorMessage: 'Invalid amount format',
      };
    }

    // Minimum execution fee in ETH
    const executionFeeRaw = parseUnits(FEES.minExecutionFee, 18);

    // GMX V2 minimum collateral from DataStore + $1 buffer for fees
    const MIN_COLLATERAL_WITH_BUFFER = minCollateralUsd + 1;

    // Validation checks
    const errors: ValidationErrors = {
      insufficientCollateral: collateralRaw > tokenBalanceRaw,
      belowMinimum: collateralNum < 1,
      belowMinCollateral: collateralNum < MIN_COLLATERAL_WITH_BUFFER,
      insufficientGas: ethBalanceRaw < executionFeeRaw,
      leverageTooHigh: leverage > 50 || leverage < 1.1,
      invalidAmount: collateralNum <= 0,
    };

    // Determine error message priority
    let errorMessage: string | null = null;
    if (errors.invalidAmount) {
      errorMessage = 'Amount must be greater than 0';
    } else if (errors.belowMinCollateral) {
      errorMessage = `Min collateral: $${MIN_COLLATERAL_WITH_BUFFER.toFixed(0)} (GMX requirement)`;
    } else if (errors.insufficientCollateral) {
      errorMessage = `Insufficient ${symbol || 'Collateral'} balance`;
    } else if (errors.insufficientGas) {
      errorMessage = `Need ${FEES.minExecutionFee} HNC for gas`;
    } else if (errors.leverageTooHigh) {
      errorMessage = 'Leverage must be between 1.1x and 50x';
    }

    const isValid = !Object.values(errors).some(Boolean);

    return {
      errors,
      isValid,
      errorMessage,
    };
  }, [collateralInput, leverage, tokenBalanceRaw, ethBalanceRaw, symbol, minCollateralUsd]);

  return validation;
}
