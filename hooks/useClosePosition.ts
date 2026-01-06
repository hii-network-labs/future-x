import { useState } from 'react';
import { useWalletClient, useWaitForTransactionReceipt } from 'wagmi';
import { encodeFunctionData, parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { CONTRACTS, FEES } from '../constants';
import { MULTICALL_ABI } from '../constants/abis';

interface ClosePositionParams {
  market: `0x${string}`;
  collateralToken: `0x${string}`;
  isLong: boolean;
  sizeDeltaUsd: string; // Full position size to close
}

export const useClosePosition = () => {
  const { data: walletClient } = useWalletClient();
  const [isClosing, setIsClosing] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const closePosition = async (params: ClosePositionParams) => {
    if (!walletClient) {
      toast.error('Wallet not connected');
      throw new Error('Wallet not connected');
    }

    try {
      setIsClosing(true);

      const executionFee = parseUnits(FEES.minExecutionFee, 18);
      const sizeDeltaUsd = parseUnits(params.sizeDeltaUsd, 30); // 30 decimals for USD

      // Build decrease order params
      const orderParams = {
        addresses: {
          receiver: walletClient.account.address,
          cancellationReceiver: walletClient.account.address,
          callbackContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          uiFeeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          market: params.market,
          initialCollateralToken: params.collateralToken,
          swapPath: [] as `0x${string}`[],
        },
        numbers: {
          sizeDeltaUsd: sizeDeltaUsd,
          initialCollateralDeltaAmount: 0n, // Full position close
          triggerPrice: 0n, // Market order
          acceptablePrice: params.isLong 
            ? 0n // Any price for long (selling at any price)
            : parseUnits('999999999', 30), // Max price for short (buying back at any price)
          executionFee: executionFee,
          callbackGasLimit: 0n,
          minOutputAmount: 0n,
          validFromTime: 0n, // Immediate execution
        },
        orderType: 4, // MarketDecrease = 4
        decreasePositionSwapType: 0, // NoSwap
        isLong: params.isLong,
        shouldUnwrapNativeToken: false,
        referralCode: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        autoCancel: false,
        dataList: [] as `0x${string}`[],
      };

      // Build multicall: sendWnt + createOrder
      const calls = [
        // 1. Send execution fee (WNT)
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendWnt',
          args: [CONTRACTS.orderVault as `0x${string}`, executionFee],
        }),
        // 2. Create decrease order
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'createOrder',
          args: [orderParams],
        }),
      ];

      // Execute multicall
      const hash = await walletClient.writeContract({
        address: CONTRACTS.exchangeRouter as `0x${string}`,
        abi: MULTICALL_ABI,
        functionName: 'multicall',
        args: [calls],
        value: executionFee,
        chain: undefined,
        account: walletClient.account,
      });

      setTxHash(hash);
      toast.success('Close position request submitted!');
      
      return hash;
    } catch (error: any) {
      console.error('Close position error:', error);
      
      // User-friendly error messages
      if (error.message?.includes('user rejected')) {
        toast.error('Transaction rejected');
      } else if (error.message?.includes('insufficient funds')) {
        toast.error('Insufficient ETH for gas');
      } else {
        toast.error('Failed to close position');
      }
      
      throw error;
    } finally {
      setIsClosing(false);
    }
  };

  return {
    closePosition,
    isClosing,
    isConfirming,
    isConfirmed,
    txHash,
  };
};
