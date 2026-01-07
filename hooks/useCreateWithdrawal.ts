import { useState } from 'react';
import { useWalletClient, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { encodeFunctionData, parseUnits, type Hex } from 'viem';
import { MULTICALL_ABI, WETH_ABI, ERC20_ABI } from '../constants/abis';
import { CONTRACTS, FEES } from '../constants';
import toast from 'react-hot-toast';

interface CreateWithdrawalParams {
  marketAddress: `0x${string}`;
  marketTokenAddress: `0x${string}`; // The GM Token itself
  amount: string; // User input string "100.5" GM
  decimals: number; // Usually 18 for GM tokens
}

/**
 * Hook to create GMX withdrawals (remove liquidity) via multicall
 * REFACTORED: Now uses multicall like createDeposit instead of sequential transactions
 */
export function useCreateWithdrawal(address: `0x${string}` | undefined) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const createWithdrawal = async (params: CreateWithdrawalParams) => {
    if (!walletClient || !address || !publicClient) {
      toast.error('Wallet or Network not connected');
      throw new Error('Wallet/Network issue');
    }

    setIsCreating(true);

    try {
      // 1. Parse amounts
      const amountBigInt = parseUnits(params.amount, params.decimals);
      const executionFee = parseUnits(FEES.minExecutionFee, 18);

      // 2. Build CreateWithdrawalParams
      const withdrawalParams = {
        addresses: {
          receiver: address,
          callbackContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          uiFeeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          market: params.marketAddress,
          longTokenSwapPath: [] as `0x${string}`[],
          shortTokenSwapPath: [] as `0x${string}`[],
        },
        minLongTokenAmount: 0n,
        minShortTokenAmount: 0n,
        shouldUnwrapNativeToken: true, // Unwrap WNT to native ETH
        executionFee,
        callbackGasLimit: 200000n,
        dataList: [] as `0x${string}`[],
      };

      // 3. Encode Multicall - all in one transaction
      const calls = [
        // A. Send Execution Fee (WNT) to WithdrawalVault
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendWnt',
          args: [CONTRACTS.withdrawalVault as `0x${string}`, executionFee],
        }),
        // B. Send GM Tokens to WithdrawalVault
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendTokens',
          args: [
            params.marketTokenAddress,
            CONTRACTS.withdrawalVault as `0x${string}`,
            amountBigInt,
          ],
        }),
        // C. Call createWithdrawal
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'createWithdrawal',
          args: [withdrawalParams],
        }),
      ];

      console.log('📤 Submitting Withdrawal:', {
        market: params.marketAddress,
        gmAmount: params.amount,
        fee: FEES.minExecutionFee,
      });

      // 4. Send Single Transaction via multicall
      const hash = await walletClient.writeContract({
        address: CONTRACTS.exchangeRouter as `0x${string}`,
        abi: MULTICALL_ABI,
        functionName: 'multicall',
        args: [calls],
        value: executionFee, // Msg.value covers the WNT sent
        chain: undefined,
        account: walletClient.account,
      });

      setTxHash(hash);
      toast.success('Withdrawal submitted! Burning GM tokens...');
      return hash;

    } catch (error: any) {
      console.error('❌ Withdrawal failed:', error);
      if (error.message?.includes('User rejected')) {
        toast.error('Transaction cancelled');
      } else {
        toast.error('Withdrawal failed: ' + (error.shortMessage || error.message));
      }
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createWithdrawal,
    isCreating,
    isConfirming,
    isConfirmed,
    txHash,
  };
}
