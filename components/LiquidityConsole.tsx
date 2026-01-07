import React, { useState, useMemo } from 'react';
import { ChainState, Vault } from '../types';
import { MOCK_VAULTS, CONTRACTS } from '../constants';
import VaultCard from './Liquidity/VaultCard';
import VaultDrawer from './Liquidity/VaultDrawer';
import LPPositionsTable from './Liquidity/LPPositionsTable';
import LPRiskDisclosure from './Liquidity/LPRiskDisclosure';
import { useLiquidity } from '../hooks/useLiquidity';
import { useMarkets } from '../hooks/useMarkets';
import { useAccount } from 'wagmi';

interface LiquidityConsoleProps {
  chainState: ChainState;
}

const LiquidityConsole: React.FC<LiquidityConsoleProps> = ({ chainState }) => {
  const { address } = useAccount();
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Fetch markets
  const { markets } = useMarkets();
  
  // Fetch default liquidity data (for header stats - assumes first market or WNT-USD)
  const { data: defaultLiquidityData, refetch } = useLiquidity();

  const handleSelectVault = (vault: Vault) => {
    setSelectedVault(vault);
    setIsDrawerOpen(true);
  };

  // Map markets to Vault objects
  const vaults = useMemo<Vault[]>(() => {
    return markets.map((market, index) => ({
      id: `vault-${market.marketToken}`,
      name: `${market.indexSymbol} Vault`,
      token: 'GM', // GM Token
      tokenAddress: market.marketToken,
      markets: [market.name],
      totalLiquidity: 0, // TODO: Fetch per-market TVL effectively
      utilization: 50, // Mock
      pnl24h: 0,
      risk: 'Medium',
      marketData: market
    }));
  }, [markets]);

  // Use dynamic vaults or fallback to mock if no markets loaded yet (though useMarkets defaults to empty array)
  const displayVaults = vaults.length > 0 ? vaults : [];

  const realizedFees = '0.00' // Placeholder

  return (
    <div className="space-y-8 relative">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Liquidity Provision</h1>
          <p className="text-gray-500 text-sm font-medium">Back protocol markets as an LP and earn trading fees.</p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <TopStat label="Total TVL" value={`$${defaultLiquidityData?.marketTvlUsd || '0'}`} />
          <TopStat label="Avg. Utilization" value="~50%" />
          {/* Refresh Button Integration */}
          <div className="bg-[#111827] border border-gray-800 rounded-lg p-3 min-w-[120px] relative group cursor-pointer hover:border-gray-700 transition-colors" onClick={() => refetch()}>
             <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center justify-between">
               Your Balance (WNT)
               <svg className={`w-3 h-3 text-gray-600 group-hover:text-emerald-500 transition-transform ${!defaultLiquidityData ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             </span>
             <div className="text-base font-bold text-emerald-400">{defaultLiquidityData?.userGmBalance || '0.00'} GM</div>
          </div>
          <TopStat label="Vaults Active" value={markets.length.toString()} />
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
              {displayVaults.length > 0 ? (
                displayVaults.map(vault => (
                  <VaultCard 
                    key={vault.id}
                    vault={vault} 
                    onClick={() => handleSelectVault(vault)} 
                  />
                ))
              ) : (
                <div className="col-span-3 text-center py-10 text-gray-500 text-sm">Loading markets...</div>
              )}
            </div>
          </section>

          {/* User Positions - Simplified for now, just shows default market pos */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Your Liquidity Positions (Default Market)</h2>
            {parseFloat(defaultLiquidityData?.userGmBalance || '0') > 0 ? (
               <LPPositionsTable 
                 positions={[{
                   id: 'lp-real',
                   vaultId: 'default',
                   vaultName: 'WNT-USD Vault',
                   deposited: parseFloat(defaultLiquidityData?.userGmBalance || '0'),
                   share: parseFloat(defaultLiquidityData?.sharePercentage || '0'), 
                   pnl: 0, 
                   feesEarned: parseFloat(realizedFees),
                   utilizationExposure: 50,
                   vault: displayVaults[0] // Attach the vault specific to this position
                 }]} 
                 onManage={handleSelectVault} 
               />
            ) : (
              <div className="p-8 text-center border border-dashed border-gray-800 rounded-xl text-gray-500 text-sm">
                No active liquidity positions found in WNT-USD vault.
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
