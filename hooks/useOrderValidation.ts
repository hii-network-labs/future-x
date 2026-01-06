import { useMemo } from 'react';
import { parseUnits } from 'viem';
import { useUSDCBalance, useETHBalance } from './useBalances';
import { FEES } from '../constants';

interface ValidationErrors {
  insufficientCollateral: boolean;
  belowMinimum: boolean;
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
  leverage: number
): ValidationResult {
  const { balanceRaw: usdcBalanceRaw } = useUSDCBalance(address);
  const { balanceRaw: ethBalanceRaw } = useETHBalance(address);

  const validation = useMemo(() => {
    // Parse collateral amount
    const collateralNum = parseFloat(collateralInput);
    
    // Check for invalid input
    if (isNaN(collateralNum) || collateralInput.trim() === '') {
      return {
        errors: {
          insufficientCollateral: false,
          belowMinimum: false,
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

    // Validation checks
    const errors: ValidationErrors = {
      insufficientCollateral: collateralRaw > usdcBalanceRaw,
      belowMinimum: collateralNum < 1,
      insufficientGas: ethBalanceRaw < executionFeeRaw,
      leverageTooHigh: leverage > 50 || leverage < 1.1,
      invalidAmount: collateralNum <= 0,
    };

    // Determine error message priority
    let errorMessage: string | null = null;
    if (errors.invalidAmount) {
      errorMessage = 'Amount must be greater than 0';
    } else if (errors.belowMinimum) {
      errorMessage = 'Minimum collateral: $1';
    } else if (errors.insufficientCollateral) {
      errorMessage = 'Insufficient USDC balance';
    } else if (errors.insufficientGas) {
      errorMessage = `Need ${FEES.minExecutionFee} ETH for gas`;
    } else if (errors.leverageTooHigh) {
      errorMessage = 'Leverage must be between 1.1x and 50x';
    }

    const isValid = !Object.values(errors).some(Boolean);

    return {
      errors,
      isValid,
      errorMessage,
    };
  }, [collateralInput, leverage, usdcBalanceRaw, ethBalanceRaw]);

  return validation;
}
