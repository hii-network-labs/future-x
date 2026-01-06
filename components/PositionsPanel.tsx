
import React from 'react';
import { Position, MarketSide } from '../types';

interface PositionsPanelProps {
  positions: Position[];
  onClose: (id: string) => void;
  showHeader?: boolean;
  isLoading?: boolean;
}

const PositionsPanel: React.FC<PositionsPanelProps> = ({ positions, onClose, showHeader = true, isLoading = false }) => {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden min-h-[300px]">
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-gray-400">Open Positions ({positions.length})</h2>
        </div>
      )}
      
      {isLoading ? (
        <div className="h-full flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : positions.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-600">
          <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <p className="text-sm font-medium">No active positions</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
                <th className="px-6 py-3">Market / Side</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Entry / Mark</th>
                <th className="px-6 py-3">Liq. Price</th>
                <th className="px-6 py-3">Unrealized PnL</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {positions.map((pos) => (
                <tr key={pos.id} className="hover:bg-gray-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-1.5 h-8 rounded-full ${pos.side === MarketSide.LONG ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <div>
                        <div className="font-bold text-white text-sm">{pos.market}</div>
                        <div className={`text-[10px] font-bold uppercase ${pos.side === MarketSide.LONG ? 'text-emerald-500' : 'text-red-500'}`}>
                          {pos.leverage}x {pos.side}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-200">${pos.size.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500">{pos.collateral.toFixed(2)} Collateral</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-300">${pos.entryPrice.toFixed(2)}</div>
                    <div className="text-xs text-emerald-400 font-bold">${pos.markPrice.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-amber-500/80">${pos.liqPrice.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm font-bold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-500">{(pos.pnl / pos.collateral * 100).toFixed(2)}% ROE</div>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button className="text-[10px] font-bold bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-all">
                      COLLATERAL
                    </button>
                    <button 
                      onClick={() => onClose(pos.id)}
                      className="text-[10px] font-bold bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-3 py-1.5 rounded border border-red-500/20 transition-all"
                    >
                      CLOSE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PositionsPanel;
