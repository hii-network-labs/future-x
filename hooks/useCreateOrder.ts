import { useState } from 'react';
import { useWalletClient, useConfig, usePublicClient, useWaitForTransactionReceipt } from 'wagmi';
import { encodeFunctionData, parseUnits, type Hex } from 'viem';
import { MULTICALL_ABI } from '../constants/abis';
import { CONTRACTS, FEES, CHAIN_ID } from '../constants';
import toast from 'react-hot-toast';

interface CreateOrderParams {
  market: `0x${string}`;         // Market address (from selected market)
  collateralToken: `0x${string}`; // Collateral token (usually shortToken)
  sizeDeltaUsd: number;
  collateralAmount: number;      // Collateral in USD
  currentPrice: number;          // Current ETH price for USD->ETH conversion
  isLong: boolean;
  acceptablePrice: bigint;
}

/**
 * Hook to create GMX orders via multicall
 */
export function useCreateOrder(address: `0x${string}` | undefined) {
  const { data: walletClient } = useWalletClient();
  const config = useConfig();
  const publicClient = usePublicClient();
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
          market: params.market, // Usually matches the market address
          initialCollateralToken: params.isLong ? (CONTRACTS.wnt as `0x${string}`) : params.collateralToken, // Force WNT for Long
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
        shouldUnwrapNativeToken: params.isLong, // Unwrap WNT for Longs (if user sends ETH)
        autoCancel: false,
        referralCode: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        dataList: [] as `0x${string}`[],
      };

      // Encode multicall functions
      const calls: `0x${string}`[] = [];
      let totalValue = executionFee;

      // 1. Send WNT (wrapped ETH) for execution fee
      calls.push(encodeFunctionData({
        abi: MULTICALL_ABI,
        functionName: 'sendWnt',
        args: [CONTRACTS.orderVault as `0x${string}`, executionFee],
      }));

      // 2. Send Collateral
      if (params.isLong) {
        // For Long, we use ETH (WNT) as collateral
        // User inputs collateral in USD, we need to convert to ETH amount
        const collateralInEth = params.collateralAmount / params.currentPrice; // USD / (USD/ETH) = ETH
        const wntCollateralAmount = parseUnits(collateralInEth.toFixed(18), 18); // ETH decimals
        
        // Update params with correct WNT amount
        orderParams.numbers.initialCollateralDeltaAmount = wntCollateralAmount;

        calls.push(encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendWnt',
          args: [CONTRACTS.orderVault as `0x${string}`, wntCollateralAmount],
        }));
        
        totalValue += wntCollateralAmount;
      } else {
        // For Short, we use USDC (standard logic)
        calls.push(encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendTokens',
          args: [
            CONTRACTS.usdc as `0x${string}`,
            CONTRACTS.orderVault as `0x${string}`,
            collateralDeltaAmount,
          ],
        }));
      }

      // 3. Create the order
      calls.push(encodeFunctionData({
        abi: MULTICALL_ABI,
        functionName: 'createOrder',
        args: [orderParams],
      }));

      console.log('📤 Creating order with params:', {
        market: params.market,
        collateralToken: orderParams.addresses.initialCollateralToken,
        collateralAmount: orderParams.numbers.initialCollateralDeltaAmount,
        size: params.sizeDeltaUsd,
        isLong: params.isLong,
        totalValue,
      });

      // SAFETY CHECK: Verify Allowance Logic (only for USDC/Short)
      if (!params.isLong && publicClient) {
        // ... (Keep existing allowance logic but simpler reference)
         // @ts-ignore
         const allowance = await publicClient.readContract({
            address: CONTRACTS.usdc as `0x${string}`, // Force USDC address for Short check
            abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
            functionName: 'allowance',
            args: [address, CONTRACTS.router as `0x${string}`],
          }) as bigint;

          if (allowance < collateralDeltaAmount) {
             toast.error('Insufficient allowance! Please approve USDC.');
             throw new Error('Insufficient allowance.');
          }
      }

      // Send multicall transaction
      const hash = await walletClient.writeContract({
        account: address,
        address: CONTRACTS.exchangeRouter as `0x${string}`,
        abi: MULTICALL_ABI,
        functionName: 'multicall',
        args: [calls],
        value: totalValue, // Send ExecutionFee + Collateral (if ETH)
        chain: config.chains.find(c => c.id === CHAIN_ID),
      });

      setTxHash(hash);
      
      // Wait for receipt to check for reversion
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'reverted') {
          toast.error('Transaction reverted on-chain');
          console.error('❌ Transaction reverted:', receipt);
          throw new Error('Transaction reverted');
        }
      }

      toast.success('Order submitted! Waiting for keeper execution...');
      console.log('✅ Transaction confirmed:', hash);

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
