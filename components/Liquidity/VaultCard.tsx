
import React from 'react';
import { Vault } from '../../types';

interface VaultCardProps {
  vault: Vault;
  onClick: () => void;
}

const VaultCard: React.FC<VaultCardProps> = ({ vault, onClick }) => {
  const isHighRisk = vault.utilization > 85;
  const isMedRisk = vault.utilization > 70 && vault.utilization <= 85;

  return (
    <div 
      onClick={onClick}
      className="bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-emerald-500/50 cursor-pointer transition-all group"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center font-bold text-indigo-400">
            {vault.token[0]}
          </div>
          <div>
            <h3 className="font-bold text-white leading-none mb-1">{vault.name}</h3>
            <div className="flex space-x-1">
              {vault.markets.map(m => (
                <span key={m} className="text-[9px] bg-gray-800 text-gray-500 px-1 py-0.5 rounded font-bold uppercase">{m}</span>
              ))}
            </div>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
          isHighRisk ? 'bg-red-500/10 text-red-500' : 
          isMedRisk ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
        }`}>
          {vault.risk} Risk
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="text-xs text-gray-500 font-medium">Total Liquidity</div>
          <div className="text-sm font-bold text-gray-200">${vault.totalLiquidity.toLocaleString()}</div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-1.5">
            <div className="text-xs text-gray-500 font-medium">Utilization</div>
            <div className={`text-xs font-bold ${isHighRisk ? 'text-red-400' : isMedRisk ? 'text-amber-400' : 'text-gray-300'}`}>
              {vault.utilization}%
            </div>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${isHighRisk ? 'bg-red-500' : isMedRisk ? 'bg-amber-500' : 'bg-emerald-500'}`} 
              style={{ width: `${vault.utilization}%` }}
            ></div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-800/50">
          <span className="text-[10px] text-gray-600 font-bold uppercase">24h PnL</span>
          <span className={`text-xs font-bold ${vault.pnl24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {vault.pnl24h >= 0 ? '+' : ''}${vault.pnl24h.toLocaleString()}
          </span>
        </div>
      </div>
      
      <div className="mt-6 w-full py-2 bg-gray-900 group-hover:bg-emerald-500/10 rounded text-[10px] font-bold text-gray-500 group-hover:text-emerald-400 text-center uppercase tracking-widest transition-colors">
        Manage Vault
      </div>
    </div>
  );
};

export default VaultCard;
