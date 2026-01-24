import { useState } from 'react';
import { useWalletClient, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { encodeFunctionData, parseUnits, type Hex } from 'viem';
import { MULTICALL_ABI } from '../constants/abis';
import { CONTRACTS, FEES } from '../constants';
import toast from 'react-hot-toast';
import { estimateExecutionFee, GAS_LIMITS, formatExecutionFee } from '../utils/gasUtils';

interface CreateDepositParams {
  marketAddress: `0x${string}`;
  // Deprecated: Use longAmount/shortAmount instead
  tokenAddress?: `0x${string}`; 
  amount?: string; 
  decimals?: number;
  
  // New: Specific amounts
  longToken?: `0x${string}`;
  shortToken?: `0x${string}`;
  longAmount?: string;
  shortAmount?: string;
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

  // Fetch current gas price
  // Using publicClient to fetch latest is safer for the exact moment of click.
  const publicClient = usePublicClient();

  const createDeposit = async (params: CreateDepositParams) => {
    if (!walletClient || !address) {
      toast.error('Wallet not connected');
      throw new Error('Wallet not connected');
    }

    setIsCreating(true);

    try {
      // 1. Identify Tokens
      const initialLongToken = params.longToken || CONTRACTS.wnt as `0x${string}`;
      const initialShortToken = params.shortToken || CONTRACTS.usdc as `0x${string}`;

      // 2. Parse Amounts
      // Backward compatibility: If params.amount is set, assume it's for params.tokenAddress
      let longAmountBigInt = 0n;
      let shortAmountBigInt = 0n;

      if (params.longAmount) {
         console.log('📝 Parsing longAmount:', params.longAmount, 'with decimals 18');
         longAmountBigInt = parseUnits(params.longAmount, 18); // Assume 18 for Long (WNT/GMX)
         console.log('📝 longAmountBigInt result:', longAmountBigInt.toString());
      }
      if (params.shortAmount) {
         console.log('📝 Parsing shortAmount:', params.shortAmount, 'with decimals 6');
         try {
           shortAmountBigInt = parseUnits(params.shortAmount, 6); // Assume 6 for Short (USDC)
           console.log('📝 shortAmountBigInt result:', shortAmountBigInt.toString());
         } catch (e) {
           console.error('❌ parseUnits failed:', e);
         }
      }

      // Legacy fallback - ONLY use if new params are not provided
      // This prevents overwriting correctly parsed values from new params
      const hasNewParams = params.longAmount || params.shortAmount;
      if (!hasNewParams && params.amount && params.tokenAddress && params.amount !== '0') {
        console.log('📝 Using legacy fallback, amount:', params.amount, 'tokenAddress:', params.tokenAddress);
        const legacyAmount = parseUnits(params.amount, params.decimals || 18);
        if (params.tokenAddress.toLowerCase() === initialLongToken.toLowerCase()) {
            longAmountBigInt = legacyAmount;
        } else {
            shortAmountBigInt = legacyAmount;
        }
      }

      // DEBUG: Trace deposit params
      console.log('🔍 createDeposit params:', {
        longAmount: params.longAmount,
        shortAmount: params.shortAmount,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        longAmountBigInt: longAmountBigInt.toString(),
        shortAmountBigInt: shortAmountBigInt.toString()
      });

      if (longAmountBigInt === 0n && shortAmountBigInt === 0n) {
          throw new Error("No amount specified");
      }
      
      // Dynamic Fee Calculation
      let executionFee = parseUnits(FEES.minExecutionFee, 18); // Default Fallback
      
      try {
          if (publicClient) {
            const gasPrice = await publicClient.getGasPrice();
            executionFee = estimateExecutionFee(gasPrice, GAS_LIMITS.DEPOSIT);
            console.log(`⛽ Dynamic Fee: ${formatExecutionFee(executionFee)} (Gas: ${gasPrice.toString()})`);
          }
      } catch (err) {
          console.warn('⚠️ Failed to fetch gas price, using default fee:', err);
      }

      console.log('📤 Deposit Tokens:', {
        market: params.marketAddress,
        initialLongToken,
        initialShortToken,
        longAmount: longAmountBigInt.toString(),
        shortAmount: shortAmountBigInt.toString()
      });

      const depositParams = {
        addresses: {
          receiver: address,
          callbackContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          uiFeeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          market: params.marketAddress,
          initialLongToken,
          initialShortToken,
          // IMPORTANT: Empty swap paths = no swap, deposit token directly
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
      const calls: Hex[] = [];

      // A. Send Execution Fee (WNT) to DepositVault
      calls.push(encodeFunctionData({
        abi: MULTICALL_ABI,
        functionName: 'sendWnt',
        args: [CONTRACTS.depositVault as `0x${string}`, executionFee],
      }));

      let totalEthValue = executionFee;

      // B. Send Long Token
      if (longAmountBigInt > 0n) {
          // Check if Long Token is WNT (Native unwrapped)
          // Actually, GMX UI always handles WNT as wrapped/native.
          // If the user is paying in ETH (native), we use sendWnt.
          // If paying in WNT (ERC20), we use sendTokens.
          // For simplicity, let's assume we use sendTokens for WNT unless specific reason not to.
          // BUT, sendWnt is cheaper/easier if user has ETH.
          // Let's assume standard ERC20 transfer for simplicity for now, UNLESS it is the 'native' flow.
          // However, useCreateDeposit usually assumes connected wallet has ETH.
          // Let's look at `CONTRACTS.wnt`.
          
          // Heuristic: If we are depositing 'WNT', we typically treat it as ETH from the user's wallet.
          // So we use sendWnt.
          if (initialLongToken.toLowerCase() === CONTRACTS.wnt.toLowerCase()) {
              calls.push(encodeFunctionData({
                  abi: MULTICALL_ABI,
                  functionName: 'sendWnt',
                  args: [CONTRACTS.depositVault as `0x${string}`, longAmountBigInt],
              }));
              totalEthValue += longAmountBigInt;
          } else {
              // ERC20 Long Token (e.g. GMX, BTC)
              calls.push(encodeFunctionData({
                  abi: MULTICALL_ABI,
                  functionName: 'sendTokens',
                  args: [initialLongToken, CONTRACTS.depositVault as `0x${string}`, longAmountBigInt],
              }));
          }
      }

      // C. Send Short Token (USDC - always ERC20)
      if (shortAmountBigInt > 0n) {
          calls.push(encodeFunctionData({
              abi: MULTICALL_ABI,
              functionName: 'sendTokens',
              args: [initialShortToken, CONTRACTS.depositVault as `0x${string}`, shortAmountBigInt],
          }));
      }

      // D. Call createDeposit
      calls.push(encodeFunctionData({
        abi: MULTICALL_ABI,
        functionName: 'createDeposit',
        args: [depositParams],
      }));

      console.log('📤 Submitting Deposit:', {
        market: params.marketAddress,
        long: longAmountBigInt,
        short: shortAmountBigInt,
        ethValue: totalEthValue,
        fee: FEES.minExecutionFee,
      });

      // 4. Send Transaction
      const hash = await walletClient.writeContract({
        address: CONTRACTS.exchangeRouter as `0x${string}`,
        abi: MULTICALL_ABI,
        functionName: 'multicall',
        args: [calls],
        value: totalEthValue, // Msg.value must cover Execution Fee + Native Token Deposit
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
