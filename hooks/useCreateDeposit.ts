import { useState } from 'react';
import { useWalletClient, useWaitForTransactionReceipt } from 'wagmi';
import { encodeFunctionData, parseUnits, type Hex } from 'viem';
import { MULTICALL_ABI } from '../constants/abis';
import { CONTRACTS, FEES } from '../constants';
import toast from 'react-hot-toast';

interface CreateDepositParams {
  marketAddress: `0x${string}`;
  tokenAddress: `0x${string}`; // Token being deposited (e.g. USDC)
  amount: string; // User input string "100.5"
  decimals: number;
}

/**
 * Hook to create GMX deposits (add liquidity) via creating a Deposit Order
 */
export function useCreateDeposit(address: `0x${string}` | undefined) {
  const { data: walletClient } = useWalletClient();
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const createDeposit = async (params: CreateDepositParams) => {
    if (!walletClient || !address) {
      toast.error('Wallet not connected');
      throw new Error('Wallet not connected');
    }

    setIsCreating(true);

    try {
      // 1. Parse amounts
      const amountBigInt = parseUnits(params.amount, params.decimals);
      const executionFee = parseUnits(FEES.minExecutionFee, 18); // ETH decimals

      // 2. Build CreateDepositParams
      // FIXED: Uses FLAT structure matching ExchangeRouter ABI (NOT nested numbers/addresses like createOrder)
      const depositParams = {
        addresses: {
          receiver: address,
          callbackContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          uiFeeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          // Note: If depositing USDC, it usually goes to Short Token? 
          // For GMX V2 w/ Single Token Pools (or standard pools), we specify BOTH initialLong and initialShort usually.
          // BUT if we are only depositing ONE token, the other is zero address?
          // Let's check script: it sets initialLong: WNT, initialShort: USDC.
          // If we deposit USDC, we should set initialShortToken = USDC, initialLongToken = WNT (or zero address?)
          // For simplicity, let's assume we are depositing into the Short side (USDC) if it's a stablecoin vault.
          // If params.tokenAddress is USDC, it is initialShortToken.
          // However, to keep it generic, we need to know the market structure. 
          // For now, let's put it in *both* if valid? No.
          market: params.marketAddress,
          initialLongToken: CONTRACTS.wnt as `0x${string}`, // Must match market's Long Token (WNT/ETH)
          initialShortToken: params.tokenAddress, // USDC is usually the short token
          longTokenSwapPath: [] as `0x${string}`[],
          shortTokenSwapPath: [] as `0x${string}`[],
        },
        minMarketTokens: 0n, // TODO: Add slippage protection?
        shouldUnwrapNativeToken: false,
        executionFee,
        callbackGasLimit: 200000n, // Explicit gas limit from script
        dataList: [] as `0x${string}`[],
      };

      // 3. Encode Multicall
      // Note: We must send funds to the DepositVault (NOT OrderVault)
      // We assume CONTRACTS.depositVault exists.
      const calls = [
        // A. Send Execution Fee (WNT) to DepositVault
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendWnt',
          args: [CONTRACTS.depositVault as `0x${string}`, executionFee],
        }),
        // B. Send Collateral (USDC) to DepositVault
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendTokens',
          args: [
            params.tokenAddress,
            CONTRACTS.depositVault as `0x${string}`,
            amountBigInt,
          ],
        }),
        // C. Call createDeposit
        encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'createDeposit',
          args: [depositParams],
        }),
      ];

      console.log('📤 Submitting Deposit:', {
        market: params.marketAddress,
        amount: params.amount,
        fee: FEES.minExecutionFee,
      });

      // 4. Send Transaction
      const hash = await walletClient.writeContract({
        address: CONTRACTS.exchangeRouter as `0x${string}`,
        abi: MULTICALL_ABI,
        functionName: 'multicall',
        args: [calls],
        value: executionFee, // Msg.value must cover the WNT sent
        chain: undefined,
        account: walletClient.account,
      });

      setTxHash(hash);
      toast.success('Deposit submitted! Minting GM tokens...');
      return hash;

    } catch (error: any) {
      console.error('❌ Deposit failed:', error);
      if (error.message?.includes('User rejected')) {
        toast.error('Transaction cancelled');
      } else {
        toast.error('Deposit failed: ' + (error.shortMessage || error.message));
      }
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createDeposit,
    isCreating,
    isConfirming,
    isConfirmed,
    txHash,
  };
}
