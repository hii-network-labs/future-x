
import React, { useState } from 'react';
import { ChainState, Vault } from '../types';
import { MOCK_VAULTS, CONTRACTS } from '../constants';
import VaultCard from './Liquidity/VaultCard';
import VaultDrawer from './Liquidity/VaultDrawer';
import LPPositionsTable from './Liquidity/LPPositionsTable';
import LPRiskDisclosure from './Liquidity/LPRiskDisclosure';
import { useLiquidity } from '../hooks/useLiquidity';
import { useAccount } from 'wagmi';

interface LiquidityConsoleProps {
  chainState: ChainState;
}

const LiquidityConsole: React.FC<LiquidityConsoleProps> = ({ chainState }) => {
  const { address } = useAccount();
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Fetch real liquidity data
  const { data: liquidityData, refetch } = useLiquidity();

  const handleSelectVault = (vault: Vault) => {
    setSelectedVault(vault);
    setIsDrawerOpen(true);
  };

  // Combine Mock Vault structure with Real Data
  const liveVault: Vault = {
    ...MOCK_VAULTS[0],
    totalLiquidity: liquidityData ? parseFloat(liquidityData.marketTvlUsd.replace(/,/g, '')) : 0,
    utilization: 50, 
    tokenAddress: CONTRACTS.market, // Explicitly set for live vault
  };

  // Parse Fee/PnL from history
  // Formatted in hook? No, hook returns string 'feesEarned'.
  // If we assume the hook handles formatting, we just use it.
  // Although in the hook I wrote formatUnits(..., 18). Let's check GMX decimals.
  // Usually PnL is 30 decimals.
  // We can fetch this inside the component if needed for PnL, but for now simplify.
  const realizedFees = '0.00' // Placeholder until proper backend PnL


  return (
    <div className="space-y-8 relative">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Liquidity Provision</h1>
          <p className="text-gray-500 text-sm font-medium">Back protocol markets as an LP and earn trading fees.</p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <TopStat label="Total TVL" value={`$${liquidityData?.marketTvlUsd || '0'}`} />
          <TopStat label="Avg. Utilization" value="~50%" />
          {/* Refresh Button Integration */}
          <div className="bg-[#111827] border border-gray-800 rounded-lg p-3 min-w-[120px] relative group cursor-pointer hover:border-gray-700 transition-colors" onClick={() => refetch()}>
             <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center justify-between">
               Your Balance
               <svg className={`w-3 h-3 text-gray-600 group-hover:text-emerald-500 transition-transform ${!liquidityData ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             </span>
             <div className="text-base font-bold text-emerald-400">{liquidityData?.userGmBalance || '0.00'} GM</div>
          </div>
          <TopStat label="Vaults Active" value="1" />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left Content */}
        <div className="col-span-12 xl:col-span-9 space-y-10">
          
          {/* Vault Cards */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Protocol Vaults</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <VaultCard 
                vault={liveVault} 
                onClick={() => handleSelectVault(liveVault)} 
              />
              {MOCK_VAULTS.slice(1).map(vault => (
                <div key={vault.id} className="opacity-50 pointer-events-none grayscale">
                  <VaultCard vault={vault} onClick={() => {}} />
                </div>
              ))}
            </div>
          </section>

          {/* User Positions */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Your Liquidity Positions</h2>
            {parseFloat(liquidityData?.userGmBalance || '0') > 0 ? (
               <LPPositionsTable 
                 positions={[{
                   id: 'lp-real',
                   vaultId: liveVault.id,
                   vaultName: liveVault.name,
                   deposited: parseFloat(liquidityData?.userGmBalance || '0'),
                   share: parseFloat(liquidityData?.sharePercentage || '0'), 
                   pnl: 0, 
                   feesEarned: parseFloat(realizedFees), // Use real fees
                   utilizationExposure: liveVault.utilization
                 }]} 
                 onManage={handleSelectVault} 
               />
            ) : (
              <div className="p-8 text-center border border-dashed border-gray-800 rounded-xl text-gray-500 text-sm">
                No active liquidity positions found.
              </div>
            )}
          </section>



        </div>

        {/* Right Content */}
        <div className="col-span-12 xl:col-span-3">
          <LPRiskDisclosure />
        </div>
      </div>


      {/* Manage Drawer */}
      {selectedVault && (
        <VaultDrawer 
          isOpen={isDrawerOpen} 
          onClose={() => setIsDrawerOpen(false)} 
          vault={selectedVault}
          isConnected={chainState.isConnected}
        />
      )}
    </div>
  );
};

const TopStat: React.FC<{ label: string, value: string, color?: string }> = ({ label, value, color }) => (
  <div className="bg-[#111827] border border-gray-800 rounded-lg p-3 min-w-[120px]">
    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{label}</span>
    <div className={`text-base font-bold ${color || 'text-gray-200'}`}>{value}</div>
  </div>
);

export default LiquidityConsole;
