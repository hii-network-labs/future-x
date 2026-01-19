import React from 'react';
import { formatUnits } from 'viem';
import { EXPLORER_URL } from '../constants';

interface TradeHistoryPanelProps {
  trades: any[];
  isLoading: boolean;
  showHeader?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

const TradeHistoryPanel: React.FC<TradeHistoryPanelProps> = ({ 
  trades, 
  isLoading, 
  showHeader = true,
  currentPage = 1,
  totalPages = 1,
  onPageChange 
}) => {
  // ... (getActionInfo and formatDate functions remain distinct/unchanged, we skip them in replacement content if possible, but strict replace needs exact match)
  // To avoid huge match block, I will just match the top part.
  
  // Wait, I need to match the return block safely.
  // Let's rely on the previous tool call context. I will select a range that covers the header.

    const getActionInfo = (trade: any) => {
    const type = parseInt(trade.orderType);
    const isLong = trade.isLong;
    const event = trade.eventName;

    // DEBUG LOG
    if (type >= 4 && type <= 6) {
      console.log(`[TradeHistory] Decrease Trade ${trade.id}:`, {
         type, isLong, event, 
         market: trade.marketAddress,
         collateral: trade.initialCollateralTokenAddress
      });
    }

    // Default values
    let label = 'Unknown';
    let colorClass = 'text-gray-400';
    let bgClass = 'bg-gray-500/10';

    if (event === 'OrderExecuted') {
       if (type === 0 || type === 1) { // Swap
         label = 'Swap';
         colorClass = 'text-blue-400';
         bgClass = 'bg-blue-500/10';
       } else if (type === 2 || type === 3) { // Increase
         label = isLong ? 'Open Long' : 'Open Short';
         colorClass = isLong ? 'text-emerald-400' : 'text-red-400';
         bgClass = isLong ? 'bg-emerald-500/10' : 'bg-red-500/10';
       } else if (type === 4 || type === 5 || type === 6) { // Decrease
         label = isLong ? 'Close Long' : 'Close Short';
         colorClass = isLong ? 'text-emerald-400' : 'text-red-400';
         bgClass = isLong ? 'bg-emerald-500/10' : 'bg-red-500/10';
         
         if (type === 6) label = isLong ? 'Stop Loss Long' : 'Stop Loss Short';
         if (type === 5) label = isLong ? 'Take Profit Long' : 'Take Profit Short';
       } else if (type === 7) { // Liquidation
         label = isLong ? 'Liquidated Long' : 'Liquidated Short';
         colorClass = 'text-red-500';
         bgClass = 'bg-red-500/10';
       }
    } else if (event === 'OrderCancelled') {
      label = 'Cancelled';
      colorClass = 'text-amber-400';
      bgClass = 'bg-amber-500/10';
      if (type === 2 || type === 3) label = `Cancel Open ${isLong ? 'Long' : 'Short'}`;
      if (type === 4 || type === 5 || type === 6) label = `Cancel Close ${isLong ? 'Long' : 'Short'}`;
    }

    return { label, colorClass, bgClass };
  };

  // Decode cancel reason from reasonBytes (if reason string is empty)
  const getCancelReason = (trade: any): string | null => {
    if (trade.eventName !== 'OrderCancelled') return null;
    
    // Try reason string first
    if (trade.reason && trade.reason.trim() !== '') {
      return trade.reason;
    }
    
    // Decode from reasonBytes (hex) - extract readable ASCII
    if (trade.reasonBytes) {
      try {
        const hex = trade.reasonBytes.replace('0x', '');
        let decoded = '';
        for (let i = 0; i < hex.length; i += 2) {
          const code = parseInt(hex.substr(i, 2), 16);
          if (code >= 32 && code < 127) {
            decoded += String.fromCharCode(code);
          }
        }
        // Extract common GMX error patterns
        if (decoded.includes('min collateral')) return 'Min Collateral';
        if (decoded.includes('empty order')) return 'Empty Order';
        if (decoded.includes('insufficient')) return 'Insufficient Balance';
        if (decoded.includes('price')) return 'Price Rejection';
        if (decoded.trim().length > 0) return decoded.trim().slice(0, 30);
      } catch {
        // Ignore decode errors
      }
    }
    
    return null;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (isLoading) {
    return (
      <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden min-h-[400px]">
        {showHeader && (
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-bold text-sm uppercase tracking-wider text-gray-400">Trade History</h2>
          </div>
        )}
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden flex flex-col h-full">
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-gray-400">Trade History</h2>
        </div>
      )}
      
      <div className="flex-1 overflow-x-auto">
        {trades.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-600">
            <p className="text-sm font-medium">No trade history found</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
                <th className="px-6 py-3 text-left">Time</th>
                <th className="px-6 py-3 text-left">Action</th>
                <th className="px-6 py-3 text-right">Size (USD)</th>
                <th className="px-6 py-3 text-right">Price</th>
                <th className="px-6 py-3 text-right">Realized PnL</th>
                <th className="px-6 py-3 text-right">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {trades.map((trade) => {
                const action = getActionInfo(trade);
                
                // Helper function to auto-detect and format USD values from subgraph
                // Subgraph data may be in 30 decimals (standard) or other formats
                const formatUsdValue = (rawValue: string | null, fieldName: string): number => {
                  if (!rawValue) return 0;
                  try {
                    const raw = BigInt(rawValue);
                    const absRaw = raw >= 0n ? raw : -raw;
                    
                    // Auto-detect based on magnitude
                    // Values > 1e25 are likely 30 decimals
                    // Values < 1e25 might be in reduced precision (e.g., 12 or 18 decimals)
                    const threshold30 = BigInt(10) ** BigInt(25);
                    const threshold18 = BigInt(10) ** BigInt(15);
                    
                    let result: number;
                    if (absRaw > threshold30) {
                      // 30 decimals (standard GMX format)
                      result = Number(formatUnits(raw, 30));
                    } else if (absRaw > threshold18) {
                      // Try 18 decimals
                      result = Number(formatUnits(raw, 18));
                    } else {
                      // Try 12 decimals (legacy indexer format) or direct USD
                      const try12 = Number(formatUnits(raw, 12));
                      if (Math.abs(try12) > 0.01 && Math.abs(try12) < 1e8) {
                        result = try12;
                      } else {
                        // Might be direct USD value (no scaling)
                        result = Number(raw) / 1e6; // Try 6 decimals as last resort
                      }
                    }
                    
                    return result;
                  } catch {
                    return 0;
                  }
                };
                
                const sizeDeltaUsd = formatUsdValue(trade.sizeDeltaUsd, 'sizeDeltaUsd');
                
                // PnL Correction Logic
                // Subgraph 'pnlUsd' can be corrupted (e.g. showing -1000 instead of -15).
                // usage: Realized PnL = BasePnL (Price Move) - Fees
                let finalPnlUsd = 0;
                let isCorrected = false;
                
                const rawPnl = formatUsdValue(trade.pnlUsd, 'pnlUsd');
                const rawBasePnl = formatUsdValue(trade.basePnlUsd, 'basePnlUsd');
                const posFee = formatUsdValue(trade.positionFeeAmount, 'posFee');
                const borrowFee = formatUsdValue(trade.borrowingFeeAmount, 'borrowFee');
                const fundFee = formatUsdValue(trade.fundingFeeAmount, 'fundFee');
                
                const calculatedPnl = rawBasePnl - (posFee + borrowFee + fundFee);
                
                // If Subgraph PnL deviates by more than $1 or 5% from Calculated, suspect corruption
                // In the user's case: Raw=-1000, Calc=-15. Deviation is huge.
                const diff = Math.abs(rawPnl - calculatedPnl);
                
                // Trust Calculated PnL if available and different
                if (trade.basePnlUsd && diff > 1.0) {
                     finalPnlUsd = calculatedPnl;
                     isCorrected = true;
                } else {
                     finalPnlUsd = rawPnl;
                }
                
                // executionPrice auto-detection:
                // - If value > 1e25, it's 30 decimals (new correct format)
                // - If value < 1e25, it's likely 12 decimals (legacy format after indexer processing)
                // This matches the formatGmxPrice logic in constants.ts
                let executionPrice = 0;
                if (trade.executionPrice) {
                  const rawPrice = BigInt(trade.executionPrice);
                  const threshold = BigInt(10) ** BigInt(25);
                  
                  if (rawPrice > threshold) {
                    // 30 decimals (new correct format)
                    executionPrice = Number(formatUnits(rawPrice, 30));
                  } else {
                    // 12 decimals (legacy subgraph format)
                    executionPrice = Number(formatUnits(rawPrice, 12));
                  }
                  
                  // Sanity check: if price is still absurd, try other formats
                  if (executionPrice > 1e10 || executionPrice < 0.0001) {
                    // Try 18 decimals (another common format)
                    const try18 = Number(formatUnits(rawPrice, 18));
                    if (try18 > 0.01 && try18 < 1e8) {
                      executionPrice = try18;
                    }
                  }
                }
                
                // Don't show Price/PnL for cancelled orders if 0
                const showPrice = trade.eventName === 'OrderExecuted' && executionPrice > 0;
                const showPnl = trade.eventName === 'OrderExecuted' && (
                  parseInt(trade.orderType) >= 4 || parseInt(trade.orderType) === 7 // Decrease or Liquidation
                );

                return (
                  <tr key={trade.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-400 font-mono">{formatDate(trade.timestamp)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap w-fit ${action.bgClass} ${action.colorClass}`}>
                          {action.label}
                        </span>
                        {getCancelReason(trade) && (
                          <span className="text-[10px] text-amber-500/80 font-medium pl-1">
                            ⚠️ {getCancelReason(trade)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-medium text-gray-300">
                        ${sizeDeltaUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {showPrice ? (
                        <div className="text-sm font-medium text-gray-300">
                          ${executionPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {showPnl ? (
                        <div className="flex flex-col items-end">
                            <div className={`text-sm font-bold flex items-center gap-1 ${finalPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {finalPnlUsd >= 0 ? '+' : ''}${finalPnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              
                              {isCorrected && (
                                <div className="group relative">
                                    <span className="cursor-help text-[10px] text-amber-500">⚠️</span>
                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 border border-gray-700 rounded text-[10px] text-gray-300 z-50 shadow-xl">
                                        <div className="font-bold text-amber-500 mb-1">Pass-through Correction</div>
                                        <div>Subgraph PnL: {rawPnl.toFixed(2)}</div>
                                        <div>Corrected: {finalPnlUsd.toFixed(2)}</div>
                                        <div className="mt-1 opacity-70">(Base: {rawBasePnl.toFixed(2)} - Fees)</div>
                                    </div>
                                </div>
                              )}
                            </div>
                        </div>
                      ) : (
                         <div className="text-xs text-gray-600">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={`${EXPLORER_URL}/tx/${trade.transaction.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-400 underline decoration-blue-500/30 font-mono"
                      >
                        wTx
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      {onPageChange && (
        <div className="px-6 py-4 border-t border-gray-800 flex justify-between items-center bg-gray-900/30">
          <button 
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500 transition-colors flex items-center space-x-1"
          >
            <span>&larr; Prev</span>
          </button>
          
          <span className="text-xs font-mono text-gray-500">Page {currentPage} / {totalPages > 0 ? totalPages : '-'}</span>

          <button 
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500 transition-colors flex items-center space-x-1"
          >
            <span>Next &rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TradeHistoryPanel;
