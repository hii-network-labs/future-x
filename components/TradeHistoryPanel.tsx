import React from 'react';
import { formatUnits } from 'viem';
import { EXPLORER_URL } from '../constants';
import FeeBreakdown from './FeeBreakdown';

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
  const getActionInfo = (trade: any) => {
    const type = parseInt(trade.orderType);
    const isLong = trade.isLong;
    const event = trade.eventName;

    // DEBUG LOG
    if (type >= 4 && type <= 6) {
      console.log(`[TradeHistory] Decrease Trade ${trade.id}:`, {
         type, 
         isLongRaw: trade.isLong,
         isLongType: typeof trade.isLong,
         event, 
         market: trade.marketAddress,
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
              {trades.map((trade, index) => {
                const action = getActionInfo(trade);
                const isBottomRow = index >= trades.length - 3 && trades.length > 5; // Use bottom alignment for last 3 rows if table is large enough
                
                // ... (existing format functions remain same, I will skip them in replacement content to focus on the return, but tool requires contiguous block?)
                // Actually I can just update the rendering part if I use 'index' which is already in map args (implied).
                // Wait, I need to insert the logic variable.
                
                // Helper function to auto-detect and format USD values from subgraph
                const formatUsdValue = (rawValue: string | null, fieldName: string): number => {
                   // ... (keep implementation same as before effectively)
                   if (!rawValue) return 0;
                   try {
                     const raw = BigInt(rawValue);
                     const absRaw = raw >= 0n ? raw : -raw;
                     const threshold30 = BigInt(10) ** BigInt(25);
                     const threshold18 = BigInt(10) ** BigInt(15);
                     if (absRaw > threshold30) return Number(formatUnits(raw, 30));
                     if (absRaw > threshold18) return Number(formatUnits(raw, 18));
                     const try12 = Number(formatUnits(raw, 12));
                     return (Math.abs(try12) > 0.01 && Math.abs(try12) < 1e8) ? try12 : Number(raw) / 1e6;
                   } catch { return 0; }
                };
                
                const sizeDeltaUsd = formatUsdValue(trade.sizeDeltaUsd, 'sizeDeltaUsd');
                const finalPnlUsd = formatUsdValue(trade.pnlUsd, 'pnlUsd');
                
                let executionPrice = 0;
                if (trade.executionPrice) {
                  // ... (re-implement logic briefly for replacement context or assume it's part of replacement)
                  // To keep it clean, I will just replace the map contents.
                   const rawPrice = BigInt(trade.executionPrice);
                   const threshold = BigInt(10) ** BigInt(25);
                   if (rawPrice > threshold) executionPrice = Number(formatUnits(rawPrice, 30));
                   else executionPrice = Number(formatUnits(rawPrice, 12)); // Legacy
                   
                   if (executionPrice > 1e10 || executionPrice < 0.0001) {
                      const try18 = Number(formatUnits(rawPrice, 18));
                      if (try18 > 0.01 && try18 < 1e8) executionPrice = try18;
                   }
                }

                const showPrice = trade.eventName === 'OrderExecuted' && executionPrice > 0;
                const showPnl = trade.eventName === 'OrderExecuted' && (
                  parseInt(trade.orderType) >= 4 || parseInt(trade.orderType) === 7
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
                        <div className="flex flex-col items-end relative group cursor-help">
                            {/* Value Display */}
                            <div className={`text-sm font-bold flex items-center gap-1 ${finalPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'} border-b border-dashed border-gray-600`}>
                              {finalPnlUsd >= 0 ? '+' : ''}${finalPnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>

                            {/* Tooltip: Dynamic Position based on Row Index */}
                            <div className={`hidden group-hover:block absolute right-full mr-3 min-w-[250px] z-[100] ${isBottomRow ? 'bottom-0' : 'top-0'}`}>
                                <FeeBreakdown 
                                    positionFee={trade.positionFeeFormatted || 0}
                                    borrowingFee={trade.borrowingFeeFormatted || 0}
                                    fundingFee={trade.fundingFeeFormatted || 0}
                                    executionFee={trade.executionFeeFormatted || 0}
                                    priceImpact={trade.priceImpactUsdFormatted || 0}
                                    basePnl={trade.pnlUsdFormatted || 0}
                                />
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
