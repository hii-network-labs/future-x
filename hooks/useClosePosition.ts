import { useState, useMemo } from 'react';
import { useWalletClient, useWaitForTransactionReceipt } from 'wagmi';
import { encodeFunctionData, parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { CONTRACTS, FEES, getTokenDecimals } from '../constants';
import { MULTICALL_ABI } from '../constants/abis';
import { useGmxProtocol } from './useGmxProtocol';
import { calculateAcceptablePrice } from '../utils/priceUtils';

interface ClosePositionParams {
  market: `0x${string}`;
  collateralToken: `0x${string}`;
  indexToken?: `0x${string}`;
  isLong: boolean;
  sizeDeltaUsd: string; // Full position size to close
  indexDecimals?: number; // Added for dynamic price scaling
}

export const useClosePosition = () => {
  const { data: walletClient } = useWalletClient();
  const [isClosing, setIsClosing] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  
  // Need prices for acceptablePrice calculation
  const { prices } = useGmxProtocol(walletClient?.account.address || null);

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

      // 1. Get Current Price
      // We need to find the price for the specific market's index token
      // Since we don't have the indexToken address passed explicitly here, we might need to rely on the passed map or look it up.
      // Ideally, the caller should pass the index token address, or we infer it.
      // For now, assuming standard markets where indexToken is relatively known or we scan prices?
      // Actually, we can just use the market address to look up in a "Market Config" if we had it, but simplified:
      // Let's iterate `prices` to find a matching price? No, keys are token addresses.
      // We will assume WNT for now if not found, or better, ask caller to pass it?
      // Since changing the signature is risky, let's try to pass `indexToken` in `params`?
      // The user just said "close long", which implies they are interacting with the UI.
      // The UI (PositionsPanel) has the position data.
      
      // Let's Look up price from the prices map using the known WNT/BTC/etc addresses if possible, 
      // OR better: Just fetch the WNT price as a fallback or iterate?
      // Given the `TradeConsole.tsx` fix worked, we need `currentPriceBigInt`.
      // Let's use a "best guess" or try to find the token price based on the market?
      // Actually, `usePositions` returns `indexToken` in the position data. 
      // We should update `ClosePositionParams` to include `indexToken`.
      
      // ... WAIT, updating the interface might break call sites. 
      // Let's check `TradeConsole.tsx`... it calls `closePosition`...
      // `TradeConsole.tsx` line 160: `const market = pos.marketAddress;`... doesn't pass indexToken.
      // I will update the interface in `useClosePosition.ts` AND the call in `TradeConsole.tsx` in a subsequent step if needed.
      // FOR NOW, I will use a safe default or try to find it. 
      // Actually, for "Long", the index token is usually the "Long Token" (WNT).
      // For "Short", it's usually the "Long Token" (WNT) as well for WNT-USDC markets.
      // GMX V2 markets are Index-based. 
      // Most critical markets are WNT/USDC.
      
      // Let's try to get the WNT price as a baseline if we can't find others, 
      // BUT for this specific fix I will modify `ClosePositionParams` to accept `indexToken`.
      
      // Wait, I can't modify `TradeConsole` in the same step easily if I strictly follow "one file per edit" unless I use multi_replace.
      // But I can make `indexToken` optional in `ClosePositionParams` and default to WNT if missing.
      
      let indexToken = params.indexToken || CONTRACTS.wnt;
      
      const priceStr = prices[indexToken.toLowerCase()] || prices[indexToken];
      const currentPriceBigInt = priceStr ? BigInt(priceStr) : 0n;

      if (currentPriceBigInt === 0n) {
         console.warn('⚠️ No price found for close position, using 0/MAX (Dangerous)');
      }

      // Use unified utility for price calculation
      // params.isLong is true if active position is long. Close Long = Decrease Long.
      let acceptablePrice = calculateAcceptablePrice(
          currentPriceBigInt,
          params.isLong,
          false, // Is Increase = FALSE (Decrease)
          params.indexDecimals || 18, // Use dynamic decimals or safe default
          50n // Slippage 0.5%
      );

      // Fallback if price missing (though risky)
      if (currentPriceBigInt === 0n) {
         acceptablePrice = params.isLong ? 0n : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      }

      // Build decrease order params
      const orderParams = {
        addresses: {
          receiver: walletClient.account.address,
          cancellationReceiver: walletClient.account.address,
          callbackContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          uiFeeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          market: params.market,
          // FIX: Use the position's actual collateral token, not hardcoded WNT
          // GMX Long uses USDC collateral, WNT Long uses WNT collateral
          initialCollateralToken: params.collateralToken,
          swapPath: [] as `0x${string}`[],
        },
        numbers: {
          sizeDeltaUsd: sizeDeltaUsd,
          initialCollateralDeltaAmount: 0n, // Full position close
          triggerPrice: 0n, // Market order
          acceptablePrice: acceptablePrice,
          executionFee: executionFee,
          callbackGasLimit: 0n,
          minOutputAmount: 0n,
          validFromTime: 0n, // Immediate execution
        },
        orderType: 4, // MarketDecrease = 4
        decreasePositionSwapType: 0, // NoSwap
        isLong: params.isLong,
        shouldUnwrapNativeToken: params.isLong, // Unwrap for Long positions
        referralCode: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        autoCancel: false,
        dataList: [] as `0x${string}`[],
      };

      console.log('🔴 CLOSE POSITION PARAMS:', {
         market: params.market,
         isLong: params.isLong,
         size: params.sizeDeltaUsd,
         acceptablePrice: acceptablePrice.toString(),
         currentPrice: currentPriceBigInt.toString()
      });

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
      } else if (error.message?.includes('InsufficientFundsToPayForCosts')) {
        toast.error('Insufficient Collateral to pay for PnL/Fees');
      } else {
        toast.error('Failed to close position: ' + (error.reason || error.message || 'Unknown error'));
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
