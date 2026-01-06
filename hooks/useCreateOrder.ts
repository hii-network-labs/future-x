import { useState } from 'react';
import { useWalletClient, useWaitForTransactionReceipt } from 'wagmi';
import { encodeFunctionData, parseUnits, type Hex } from 'viem';
import { MULTICALL_ABI } from '../constants/abis';
import { CONTRACTS, FEES } from '../constants';
import toast from 'react-hot-toast';

interface CreateOrderParams {
  sizeDeltaUsd: number;
  collateralAmount: number;
  isLong: boolean;
  acceptablePrice: bigint;
}

/**
 * Hook to create GMX orders via multicall
 */
export function useCreateOrder(address: `0x${string}` | undefined) {
  const { data: walletClient } = useWalletClient();
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const createOrder = async (params: CreateOrderParams) => {
    if (!walletClient || !address) {
      toast.error('Wallet not connected');
      throw new Error('Wallet not connected');
    }

    setIsCreating(true);

    try {
      // Convert to proper units
      const sizeDeltaUsd = parseUnits(params.sizeDeltaUsd.toString(), 30); // GMX uses 30 decimals for USD
      const collateralDeltaAmount = parseUnits(params.collateralAmount.toString(), 6); // USDC decimals
      const executionFee = parseUnits(FEES.minExecutionFee, 18); // ETH decimals

      // Build order params structure (matching GMX V2 contract)
      const orderParams = {
        addresses: {
          receiver: address,
          cancellationReceiver: address,
          callbackContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          uiFeeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          market: CONTRACTS.market as `0x${string}`,
          initialCollateralToken: CONTRACTS.usdc as `0x${string}`,
          swapPath: [] as `0x${string}`[],
        },
        numbers: {
          sizeDeltaUsd,
          initialCollateralDeltaAmount: collateralDeltaAmount,
          triggerPrice: 0n,
          acceptablePrice: params.acceptablePrice,
          executionFee,
          callbackGasLimit: 0n,
          minOutputAmount: 0n,
          validFromTime: 0n,
        },
        orderType: 2, // Market Increase
        decreasePositionSwapType: 0,
        isLong: params.isLong,
        shouldUnwrapNativeToken: false,
        autoCancel: false,
        referralCode: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        dataList: [] as `0x${string}`[],
      };

      // Encode multicall functions
      const calls = [
        // 1. Send WNT (wrapped ETH) for execution fee
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendWnt',
          args: [CONTRACTS.orderVault as `0x${string}`, executionFee],
        }),
        // 2. Send USDC collateral to OrderVault
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendTokens',
          args: [
            CONTRACTS.usdc as `0x${string}`,
            CONTRACTS.orderVault as `0x${string}`,
            collateralDeltaAmount,
          ],
        }),
        // 3. Create the order
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'createOrder',
          args: [orderParams],
        }),
      ];

      console.log('📤 Creating order with params:', {
        market: CONTRACTS.market,
        collateral: params.collateralAmount,
        size: params.sizeDeltaUsd,
        isLong: params.isLong,
        executionFee: FEES.minExecutionFee,
      });

      // Send multicall transaction
      const hash = await walletClient.writeContract({
        address: CONTRACTS.exchangeRouter as `0x${string}`,
        abi: MULTICALL_ABI,
        functionName: 'multicall',
        args: [calls],
        value: executionFee, // Send ETH for execution fee
      });

      setTxHash(hash);
      toast.success('Order submitted! Waiting for confirmation...');
      console.log('✅ Transaction sent:', hash);

      return hash;
    } catch (error: any) {
      console.error('❌ Order creation failed:', error);
      
      // User-friendly error messages
      if (error.message?.includes('User rejected')) {
        toast.error('Transaction cancelled');
      } else if (error.message?.includes('insufficient funds')) {
        toast.error('Insufficient funds for gas');
      } else {
        toast.error('Order creation failed');
      }
      
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createOrder,
    isCreating,
    isConfirming,
    isConfirmed,
    txHash,
  };
}
