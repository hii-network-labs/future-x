import React from 'react';
import { formatUnits } from 'viem';

export interface FeeBreakdownProps {
  positionFee: bigint;
  borrowingFee: bigint;
  fundingFee: bigint;
  priceImpact: number;
  basePnl: number;
}

/**
 * Component to display detailed fee breakdown for position close
 */
const FeeBreakdown: React.FC<FeeBreakdownProps> = ({
  positionFee,
  borrowingFee,
  fundingFee,
  priceImpact,
  basePnl,
}) => {
  // Convert bigints to USD (30 decimals)
  const positionFeeUsd = Number(formatUnits(positionFee, 30));
  const borrowingFeeUsd = Number(formatUnits(borrowingFee, 30));
  const fundingFeeUsd = Number(formatUnits(fundingFee, 30));

  // Total fees (negative because they're costs)
  const totalFees = positionFeeUsd + borrowingFeeUsd - fundingFeeUsd; // fundingFee can be positive if collected

  // Final realized PnL
  const realizedPnl = basePnl + priceImpact - totalFees;

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
      <div className="text-xs font-bold uppercase text-gray-400 mb-2">Fee Breakdown</div>
      
      {/* Base PnL */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">Base PnL</span>
        <span className={`text-sm font-bold ${basePnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {basePnl >= 0 ? '+' : ''}${basePnl.toFixed(2)}
        </span>
      </div>

      {/* Price Impact */}
      {priceImpact !== 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Price Impact</span>
          <span className={`text-sm font-bold ${priceImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {priceImpact >= 0 ? '+' : ''}${priceImpact.toFixed(2)}
          </span>
        </div>
      )}

      <div className="border-t border-gray-800 my-2"></div>

      {/* Fees */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">Position Fee</span>
        <span className="text-sm font-bold text-red-400">-${positionFeeUsd.toFixed(4)}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">Borrowing Fee</span>
        <span className="text-sm font-bold text-red-400">-${borrowingFeeUsd.toFixed(4)}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">Funding Fee</span>
        <span className={`text-sm font-bold ${fundingFeeUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {fundingFeeUsd >= 0 ? '+' : ''}${Math.abs(fundingFeeUsd).toFixed(4)}
        </span>
      </div>

      <div className="border-t border-gray-800 my-2"></div>

      {/* Total */}
      <div className="flex justify-between items-center pt-1">
        <span className="text-sm font-bold text-white">Realized PnL</span>
        <span className={`text-lg font-bold ${realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}
        </span>
      </div>

      {/* Warning if big difference */}
      {Math.abs(realizedPnl - basePnl) > 1 && (
        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
          ⚠️ Net PnL differs from mark price due to fees and price impact
        </div>
      )}
    </div>
  );
};

export default FeeBreakdown;
