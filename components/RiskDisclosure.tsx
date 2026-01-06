
import React from 'react';

const RiskDisclosure: React.FC = () => {
  return (
    <div className="bg-[#1A1F2B] border border-amber-500/20 rounded-xl p-5 space-y-4">
      <div className="flex items-center space-x-3 text-amber-500">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <h3 className="font-bold text-xs uppercase tracking-wider">Trading Risk Disclosure</h3>
      </div>
      
      <div className="space-y-3">
        <RiskItem 
          title="Async Execution" 
          desc="Prices are not matched instantly. Keepers execute requests with a brief delay using fresh oracle signatures."
        />
        <RiskItem 
          title="Oracle Deviation" 
          desc="Market price depends on the median of various exchange feeds. Small deviations can occur during volatility."
        />
        <RiskItem 
          title="Liquidation Risk" 
          desc="Positions are liquidated instantly when collateral fails to cover required maintenance margins."
        />
      </div>

      <div className="pt-2 border-t border-gray-800">
        <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
          By trading on Custom GMX, you acknowledge understanding of these decentralized mechanisms. 
          There is no centralized authority to reverse transactions.
        </p>
      </div>
    </div>
  );
};

const RiskItem: React.FC<{ title: string, desc: string }> = ({ title, desc }) => (
  <div>
    <h4 className="text-[11px] font-bold text-gray-300 mb-0.5">{title}</h4>
    <p className="text-[10px] text-gray-500 leading-normal">{desc}</p>
  </div>
);

export default RiskDisclosure;
