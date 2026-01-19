
import React, { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { MarketSide } from '../types';
import { useTokenBalance } from '../hooks/useBalances';
import { useOrderValidation } from '../hooks/useOrderValidation';
import { useTokenApproval } from '../hooks/useTokenApproval';
import { CONTRACTS } from '../constants';
import { parseUnits } from 'viem';
import toast from 'react-hot-toast';

interface OrderPanelProps {
  currentPrice: number;
  onOpenOrder: (side: MarketSide, size: number, collateral: number, leverage: number) => void;
  isWalletConnected: boolean;
  isCreatingOrder?: boolean;
  collateralTokenAddress: `0x${string}` | undefined; // Undefined = Native Token (ETH)
  collateralTokenSymbol: string;
  side: MarketSide;
  onSideChange: (side: MarketSide) => void;
}

const OrderPanel: React.FC<OrderPanelProps> = ({ 
  currentPrice, 
  onOpenOrder, 
  isWalletConnected,
  isCreatingOrder = false,
  collateralTokenAddress,
  collateralTokenSymbol,
  side,
  onSideChange
}) => {
  const { address } = useAccount();
  // Use dynamic token balance
  const { balance: tokenBalance, balanceRaw: tokenBalanceRaw, isLoading: balanceLoading } = useTokenBalance(address, collateralTokenAddress);
  
  // const [side, setSide] = useState<MarketSide>(MarketSide.LONG); // Lifted up
  const [collateralAmount, setCollateralAmount] = useState('10');
  const [leverage, setLeverage] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine collateral price for validation
  // If Native (undefined address), use current market price (ETH/HNC Price)
  // If USDC (or anything else for now), assume stable $1. 
  // TODO: In production, fetch USDC price if depeg is a concern, but $1 is standard for UI validation.
  const validationPrice = !collateralTokenAddress ? currentPrice : 1;

  // Validation hook
  const { isValid, errorMessage } = useOrderValidation(address, collateralAmount, leverage, collateralTokenAddress, validationPrice);

  // Token approval hook for USDC
  const amountBigInt = collateralAmount && !isNaN(parseFloat(collateralAmount)) 
    ? parseUnits(collateralAmount, 6) 
    : 0n;

  const {
    isApproved,
    isApproving,
    isConfirming,
    approve,
  } = useTokenApproval({
    tokenAddress: collateralTokenAddress || '0x0000000000000000000000000000000000000000', // Safe fallback, query disabled if undefined
    spenderAddress: CONTRACTS.router as `0x${string}`,
    amount: amountBigInt
  });

  const isNative = !collateralTokenAddress;
  const needsApproval = !isNative && !isApproved;
  const handleApprove = approve;


  const sizeUSD = Number(collateralAmount) * validationPrice * leverage;
  const keeperFee = 0.0025; // HNC

  // Get public client for waiting for tx
  const publicClient = usePublicClient();

  const handleSmartSubmit = async () => {
    if (!isWalletConnected || !isValid) return;
    
    setIsSubmitting(true);
    
    try {
      // 1. Check & Execute Approval if needed
      if (needsApproval) {
        toast('Approval needed. Please confirm in your wallet...', { icon: '🔐' });
        const hash = await approve();
        if (!hash) {
          setIsSubmitting(false);
          return;
        }

        const toastId = toast.loading(`Approving ${collateralTokenSymbol}...`);
        
        // Wait for approval to be mined
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
          toast.dismiss(toastId);
          toast.success(`Approved! Creating order...`);
        }
      }

      // 2. Open Order
      // Small delay to let indexed state settle (optional, but safer)
      await new Promise(r => setTimeout(r, 500));
      
      onOpenOrder(side, sizeUSD, Number(collateralAmount), leverage);
      
      // Clear inputs after successful order
      setCollateralAmount('');
      setLeverage(5);
      
    } catch (e) {
      console.error(e);
      toast.error('Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // MAX button handler
  const handleMaxClick = () => {
    if (tokenBalanceRaw > 0n) {
      // Use actual balance from hook
      setCollateralAmount(tokenBalance);
    }
  };

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden flex flex-col">
      {/* Tabs */}
      <div className="flex h-12 border-b border-gray-800">
        <button 
          onClick={() => onSideChange(MarketSide.LONG)}
          className={`flex-1 font-bold text-sm transition-all ${side === MarketSide.LONG ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          LONG
        </button>
        <button 
          onClick={() => onSideChange(MarketSide.SHORT)}
          className={`flex-1 font-bold text-sm transition-all ${side === MarketSide.SHORT ? 'bg-red-500 text-black' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          SHORT
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Collateral Input */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="text-xs text-gray-500 font-bold uppercase">Collateral ({collateralTokenSymbol})</label>
            <span className="text-[10px] text-gray-400">
              {balanceLoading ? 'Loading...' : `Bal: ${tokenBalance} ${collateralTokenSymbol}`}
            </span>
          </div>
          <div className="relative group">
            <input 
              type="number"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              className={`w-full bg-[#0C111A] border rounded-lg pl-4 pr-28 py-3 text-lg font-bold focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                !isValid && collateralAmount ? 'border-red-500/50 focus:border-red-500' : 'border-gray-800 focus:border-emerald-500/50'
              }`}
              placeholder="0.00"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
              <span className="text-sm text-gray-500 font-bold">{collateralTokenSymbol}</span>
              <button 
                onClick={handleMaxClick}
                disabled={!isWalletConnected || balanceLoading}
                className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                MAX
              </button>
            </div>
          </div>
          {/* Error message */}
          {errorMessage && collateralAmount && (
            <p className="text-xs text-red-400 mt-1 font-medium">{errorMessage}</p>
          )}
        </div>

        {/* Leverage Slider */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <label className="text-xs text-gray-500 font-bold uppercase">Leverage</label>
            <span className={`text-sm font-bold px-2 py-0.5 rounded ${leverage > 10 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {leverage}x
            </span>
          </div>
          <input 
            type="range" 
            min="1.1" 
            max="50" 
            step="0.1"
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-gray-600 mt-2 font-bold px-1">
            <span>1.1x</span>
            <span>10x</span>
            <span>20x</span>
            <span>30x</span>
            <span>40x</span>
            <span>50x</span>
          </div>
        </div>

        {/* Summary Details */}
        <div className="bg-gray-900/40 rounded-lg p-4 space-y-2 border border-gray-800/50">
          <DetailRow label="Position Size" value={`$${sizeUSD.toLocaleString()}`} />
          <DetailRow label="Entry Price" value={`$${currentPrice.toLocaleString()}`} />
          <DetailRow 
            label="Liq. Price" 
            value={`$${
              leverage > 0
                ? (side === MarketSide.LONG 
                    ? currentPrice * (1 - (1 / leverage) * 0.9)  // 90% of max loss before liquidation
                    : currentPrice * (1 + (1 / leverage) * 0.9)
                  ).toFixed(2)
                : 'N/A'
            }`} 
            warning={leverage > 20} 
          />
          <DetailRow label="Slippage Tolerance" value="0.30%" />
          <div className="pt-2 border-t border-gray-800 mt-2">
            <DetailRow label="Execution Fee" value={`${keeperFee} HNC`} highlight />
          </div>
        </div>

        {/* CTA */}
        <button 
          onClick={handleSmartSubmit}
          disabled={!isWalletConnected || !isValid || isSubmitting || isCreatingOrder}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-500/5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            side === MarketSide.LONG 
            ? 'bg-emerald-500 text-black hover:bg-emerald-400' 
            : 'bg-red-500 text-white hover:bg-red-400'
          }`}
        >
          {!isWalletConnected ? (
            'Connect Wallet'
          ) : isSubmitting || isCreatingOrder ? (
            <>
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>{needsApproval && isSubmitting ? 'Approving...' : 'Processing...'}</span>
            </>
          ) : errorMessage && !isValid ? (
            errorMessage
          ) : (
            `Open ${side === MarketSide.LONG ? 'Long' : 'Short'}`
          )}
        </button>

        <p className="text-[10px] text-gray-500 text-center px-4">
          Open orders are executed asynchronously by the keeper network. 
          Final execution price may vary within slippage tolerance.
        </p>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string, value: string, highlight?: boolean, warning?: boolean }> = ({ label, value, highlight, warning }) => (
  <div className="flex justify-between items-center">
    <span className="text-xs text-gray-500">{label}</span>
    <span className={`text-xs font-medium ${highlight ? 'text-white' : warning ? 'text-red-400' : 'text-gray-300'}`}>
      {value}
    </span>
  </div>
);

export default OrderPanel;
