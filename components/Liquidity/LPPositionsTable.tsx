
import React from 'react';
import { LPPosition, Vault } from '../../types';
import { MOCK_VAULTS } from '../../constants';

interface LPPositionsTableProps {
  positions: LPPosition[];
  onManage: (vault: Vault) => void;
}

const LPPositionsTable: React.FC<LPPositionsTableProps> = ({ positions, onManage }) => {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
              <th className="px-6 py-4">Vault</th>
              <th className="px-6 py-4">Deposited</th>
              <th className="px-6 py-4">Share %</th>
              <th className="px-6 py-4">Unrealized PnL</th>
              <th className="px-6 py-4">Fees Earned</th>
              <th className="px-6 py-4">Utilization Exp.</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {positions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center text-gray-600 text-sm">No liquidity provided</td>
              </tr>
            ) : (
              positions.map(pos => (
                <tr key={pos.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-white text-sm">{pos.vaultName}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-300">${pos.deposited.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 font-bold">{pos.share}%</td>
                  <td className="px-6 py-4">
                    <div className={`text-sm font-bold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-500/80">${pos.feesEarned.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                       <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-500" style={{ width: `${pos.utilizationExposure}%` }}></div>
                       </div>
                       <span className="text-xs font-bold text-gray-500">{pos.utilizationExposure}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        const v = MOCK_VAULTS.find(v => v.id === pos.vaultId);
                        // Fix: Removed 'as any' casting as MOCK_VAULTS is now properly typed
                        if (v) onManage(v);
                      }}
                      className="text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black px-4 py-2 rounded transition-all uppercase tracking-widest"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LPPositionsTable;
