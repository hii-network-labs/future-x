import React from 'react';

export interface FeeBreakdownProps {
  positionFee: number;
  borrowingFee: number;
  fundingFee: number;
  executionFee: number;
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
  executionFee,
  priceImpact,
  basePnl,
}) => {
  // Total fees (negative because they're costs)
  // Funding fee can be positive (paid to user) or negative (paid by user). 
  // API returns "fundingFeeAmount" usually as positive magnitude, but direction depends.
  // GMX V2 Convention: fundingFeeAmount is usually the amount PAID BY USER.
  // If it's negative pnl, it's cost.
  
  // Let's assume standard cost model:
  // Realized PnL = Base PnL + Price Impact - Position Fee - Borrowing Fee - Funding Fee - Execution Fee
  
  const totalFees = positionFee + borrowingFee + fundingFee + executionFee;
  const realizedPnl = basePnl + priceImpact - totalFees;

  return (
    <div className="bg-gray-900/90 border border-gray-700 rounded-lg p-3 space-y-2 min-w-[240px] shadow-xl backdrop-blur-sm z-50">
      <div className="text-[10px] font-bold uppercase text-gray-500 mb-1 border-b border-gray-700 pb-1">Fee Breakdown</div>
      
      {/* Base PnL */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-400">Base PnL</span>
        <span className={`font-mono font-medium ${basePnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {basePnl >= 0 ? '+' : ''}${basePnl.toFixed(2)}
        </span>
      </div>

      {/* Price Impact */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-400">Price Impact</span>
        <span className={`font-mono font-medium ${priceImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {priceImpact >= 0 ? '+' : ''}${priceImpact.toFixed(2)}
        </span>
      </div>

      <div className="border-t border-gray-800 my-1"></div>

      {/* Fees */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-400">Position Fee</span>
        <span className="text-red-400 font-mono">-${positionFee.toFixed(2)}</span>
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-400">Borrowing Fee</span>
        <span className="text-red-400 font-mono">-${borrowingFee.toFixed(2)}</span>
      </div>
      
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-400">Funding Fee</span>
        <span className="text-red-400 font-mono">-${fundingFee.toFixed(2)}</span>
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-400">Execution Fee</span>
        <span className="text-red-400 font-mono">-${executionFee.toFixed(4)}</span>
      </div>

      <div className="border-t border-gray-700 my-1"></div>

      {/* Total */}
      <div className="flex justify-between items-center pt-1">
        <span className="text-xs font-bold text-gray-200">Net Final PnL</span>
        <span className={`text-sm font-bold font-mono ${realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

export default FeeBreakdown;
