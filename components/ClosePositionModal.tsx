import React, { useState } from 'react';
import { Position } from '../types';
import { useClosePosition } from '../hooks/useClosePosition';
import { useAccuratePositionPnL } from '../hooks/useAccuratePositionPnL';
import FeeBreakdown from './FeeBreakdown';
import { CONTRACTS } from '../constants';

interface ClosePositionModalProps {
  position: Position;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ClosePositionModal: React.FC<ClosePositionModalProps> = ({
  position,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { closePosition, isClosing, isConfirming } = useClosePosition();
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);

  // Fetch accurate PnL from subgraph (only for closed positions)
  // For open positions, this will show placeholder data
  const { basePnlUsd, priceImpactUsd, realizedPnlUsd, fees, isLoading } = useAccuratePositionPnL(
    undefined, // We don't have user address here
    CONTRACTS.market,
    false // Disable for now since we need orderKey for open positions
  );

  const handleClose = async () => {
    try {
      await closePosition({
        market: CONTRACTS.market as `0x${string}`,
        collateralToken: CONTRACTS.usdc as `0x${string}`,
        isLong: position.side === 'LONG',
        sizeDeltaUsd: position.size.toString(),
      });
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Close position failed:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Close Position</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Position Info */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">Market</span>
              <span className="text-sm font-bold text-white">{position.market}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">Side</span>
              <span className={`text-sm font-bold ${position.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>
                {position.leverage}x {position.side}
              </span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">Size</span>
              <span className="text-sm font-bold text-white">${position.size.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Mark Price PnL</span>
              <span className={`text-sm font-bold ${position.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Fee Breakdown Toggle */}
          <button
            onClick={() => setShowFeeBreakdown(!showFeeBreakdown)}
            className="w-full text-xs text-gray-400 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            {showFeeBreakdown ? '▼' : '▶'} {showFeeBreakdown ? 'Hide' : 'Show'} Fee Breakdown
          </button>

          {/* Fee Breakdown (from subgraph - for demo only) */}
          {showFeeBreakdown && (
            <div>
              <FeeBreakdown
                positionFee={fees.positionFee}
                borrowingFee={fees.borrowingFee}
                fundingFee={fees.fundingFee}
                priceImpact={priceImpactUsd}
                basePnl={position.pnl} // Use mark price PnL as approximation
              />
              <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-400">
                ℹ️ Fee breakdown will be accurate after position is closed
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
            ⚠️ This will close your entire position at market price
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-all"
            disabled={isClosing || isConfirming}
          >
            Cancel
          </button>
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isClosing || isConfirming}
          >
            {isClosing || isConfirming ? 'Closing...' : 'Confirm Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClosePositionModal;
