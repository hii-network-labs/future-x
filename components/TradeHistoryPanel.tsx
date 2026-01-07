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
                // PnL and Size use 30 decimals
                const sizeDeltaUsd = trade.sizeDeltaUsd ? Number(formatUnits(BigInt(trade.sizeDeltaUsd), 30)) : 0;
                const pnlUsd = trade.pnlUsd ? Number(formatUnits(BigInt(trade.pnlUsd), 30)) : 0;
                
                // executionPrice in this subgraph appears to use 12 decimals (e.g. 5000*10^12 for 5000 USD)
                // Standard GMX is 30, but empirical data shows 12 here.
                const executionPrice = trade.executionPrice 
                  ? Number(formatUnits(BigInt(trade.executionPrice), 12)) 
                  : 0;
                
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
                        <div className={`text-sm font-bold ${pnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pnlUsd >= 0 ? '+' : ''}${pnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
