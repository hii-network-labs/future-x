import { useState, useEffect } from 'react';
import { useWalletClient, useConfig, usePublicClient, useWaitForTransactionReceipt } from 'wagmi';
import { encodeFunctionData, parseUnits, type Hex } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { MULTICALL_ABI } from '../constants/abis';
import { CONTRACTS, FEES, CHAIN_ID } from '../constants';
import toast from 'react-hot-toast';
import { estimateExecutionFee, GAS_LIMITS, formatExecutionFee } from '../utils/gasUtils';

const API_BASE = import.meta.env.VITE_KEEPER_API_URL || 'http://localhost:3000';

// Cache for token decimals to avoid repeated API calls
const decimalsCache: Record<string, number> = {};

/**
 * Fetch token decimals from keeper API (with caching)
 */
async function getTokenDecimals(tokenAddress: string): Promise<number> {
  const key = tokenAddress.toLowerCase();
  
  // Return cached value if available
  if (decimalsCache[key] !== undefined) {
    return decimalsCache[key];
  }
  
  try {
    const response = await fetch(`${API_BASE}/tokens/${tokenAddress}`);
    if (response.ok) {
      const result = await response.json();
      const data = result.data || result;
      if (data.decimals !== undefined) {
        decimalsCache[key] = data.decimals;
        return data.decimals;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch token decimals, defaulting to 18:', e);
  }
  
  // Default to 18 if API fails
  return 18;
}

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
  const queryClient = useQueryClient();
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // 🔄 Invalidate position caches when order creation is confirmed
  // Note: Order creation confirmed means order is in queue, not yet executed by keeper
  // But we still want to refresh to show pending order status
  useEffect(() => {
    if (isConfirmed && txHash) {
      console.log('✅ Order creation confirmed - invalidating position caches');
      // Invalidate position queries to catch keeper execution faster
      queryClient.invalidateQueries({ queryKey: ['apiPositions'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Order submitted! Waiting for keeper execution...');
    }
  }, [isConfirmed, txHash, queryClient]);

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
      
      let executionFee = parseUnits(FEES.minExecutionFee, 18);
      let callbackGasLimit = 0n; // Default auto
      
      try {
        if (publicClient) {
          const gasPrice = await publicClient.getGasPrice();
          executionFee = estimateExecutionFee(gasPrice, GAS_LIMITS.ORDER);
          callbackGasLimit = GAS_LIMITS.ORDER; // Set explicit limit equal to benchmark
          console.log(`⛽ Order Fee: ${formatExecutionFee(executionFee)} (Limit: ${callbackGasLimit})`);
        }
      } catch (err) {
        console.warn('Using default fee:', err);
      }

      // Build order params structure (matching GMX V2 contract)
      const orderParams = {
        addresses: {
          receiver: address,
          cancellationReceiver: address,
          callbackContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          uiFeeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          market: params.market, // Usually matches the market address
          initialCollateralToken: params.collateralToken, // Use selected token
          swapPath: [] as `0x${string}`[],
        },
        numbers: {
          sizeDeltaUsd,
          initialCollateralDeltaAmount: collateralDeltaAmount,
          triggerPrice: 0n,
          acceptablePrice: params.acceptablePrice,
          executionFee,
          callbackGasLimit,
          minOutputAmount: 0n,
          validFromTime: 0n,
        },
        orderType: 2, // Market Increase
        decreasePositionSwapType: 0,
        isLong: params.isLong,
        shouldUnwrapNativeToken: params.isLong, // Keep unwrapping for Longs logic (defaults)
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

      // Determine payment type
      const isNativePayment = params.collateralToken.toLowerCase() === CONTRACTS.wnt.toLowerCase();

      // 2. Send Collateral
      if (isNativePayment) {
        // For Native ETH (WNT address used as placeholder)
        // Input `collateralAmount` is already in TOKENS (ETH), not USD if coming from input.
        // Wait - caller passes collateralAmount. 
        // If isLong (ETH market), collateralAmount is ETH.
        // If isShort (ETH market), collateralAmount is USDC.
        
        // Caution: params.collateralAmount is "number". 
        // If isNativePayment, we treat it as 18 decimals.
        const wntCollateralAmount = parseUnits(params.collateralAmount.toString(), 18); // ETH decimals
        
        // Update params with correct WNT amount
        orderParams.numbers.initialCollateralDeltaAmount = wntCollateralAmount;

        calls.push(encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendWnt',
          args: [CONTRACTS.orderVault as `0x${string}`, wntCollateralAmount],
        }));
        
        totalValue += wntCollateralAmount;
      } else {
        // For ERC20 tokens - fetch decimals dynamically from API
        const decimals = await getTokenDecimals(params.collateralToken);
        
        const tokenCollateralAmount = parseUnits(params.collateralAmount.toString(), decimals);
        orderParams.numbers.initialCollateralDeltaAmount = tokenCollateralAmount;

        calls.push(encodeFunctionData({
          abi: MULTICALL_ABI,
          functionName: 'sendTokens',
          args: [
            params.collateralToken,
            CONTRACTS.orderVault as `0x${string}`,
            tokenCollateralAmount,
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
        isNativePayment
      });

      // SAFETY CHECK: Verify Allowance Logic (only for ERC20)
      if (!isNativePayment && publicClient) {
         const tokenCollateralAmount = orderParams.numbers.initialCollateralDeltaAmount;
          // @ts-ignore
          const allowance = await publicClient.readContract({
            address: params.collateralToken, 
            abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
            functionName: 'allowance',
            args: [address, CONTRACTS.router as `0x${string}`],
          }) as bigint;

          if (allowance < tokenCollateralAmount) {
             toast.error('Insufficient allowance! Please approve token.');
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

      // toast.success('Order submitted! Waiting for keeper execution...');
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
