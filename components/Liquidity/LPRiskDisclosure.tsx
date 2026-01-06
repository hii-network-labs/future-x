
import React from 'react';

const LPRiskDisclosure: React.FC = () => {
  return (
    <div className="bg-[#1A1F2B] border border-amber-500/20 rounded-xl p-6 space-y-6 sticky top-24">
      <div className="flex items-center space-x-3 text-amber-500">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <h3 className="font-bold text-xs uppercase tracking-widest">LP Risk Console</h3>
      </div>
      
      <div className="space-y-4">
        <RiskBlock 
          title="Counterparty Liability" 
          desc="Liquidity providers are the counterparty to all traders. When traders profit, those profits are paid out from vault liquidity." 
        />
        <RiskBlock 
          title="Capital Efficiency" 
          desc="High utilization increases fee generation but also increases the risk of withdrawal friction during peak volatility." 
        />
        <RiskBlock 
          title="Drawdown Awareness" 
          desc="Unlike AMMs, vaults can experience direct drawdown of principal if trading PnL exceeds protocol fees earned." 
        />
      </div>

      <div className="pt-4 border-t border-gray-800">
        <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-bold uppercase mb-2">
          <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
          <span>Execution: Keeper Verified</span>
        </div>
        <p className="text-[10px] text-gray-600 leading-relaxed font-medium">
          Vault interactions require multi-block confirmation. Withdrawals may be subject to a 12-hour timelock to prevent frontrunning.
        </p>
      </div>
    </div>
  );
};

const RiskBlock: React.FC<{ title: string, desc: string }> = ({ title, desc }) => (
  <div>
    <h4 className="text-[11px] font-bold text-gray-300 mb-1 uppercase tracking-tight">{title}</h4>
    <p className="text-[10px] text-gray-500 leading-normal font-medium">{desc}</p>
  </div>
);

export default LPRiskDisclosure;
