import React, { useState, useMemo } from 'react';
import { ChainState, Vault, LPPosition } from '../types';
import { CONTRACTS } from '../constants';
import VaultCard from './Liquidity/VaultCard';
import VaultDrawer from './Liquidity/VaultDrawer';
import LPPositionsTable from './Liquidity/LPPositionsTable';
import LPRiskDisclosure from './Liquidity/LPRiskDisclosure';
import { useLiquidity } from '../hooks/useLiquidity';
import { useMarkets } from '../hooks/useMarkets';
import { useAccount, useReadContracts } from 'wagmi';
import { ERC20_ABI } from '../constants/abis';
import { formatUnits } from 'viem';
import { usePrices } from '../hooks/usePrices';

interface LiquidityConsoleProps {
  chainState: ChainState;
}

const LiquidityConsole: React.FC<LiquidityConsoleProps> = ({ chainState }) => {
  const { address } = useAccount();
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { getPrice } = usePrices();
  
  // Fetch markets
  const { markets } = useMarkets();
  
  // Fetch default liquidity data (for header stats)
  const { data: defaultLiquidityData, refetch } = useLiquidity();

  // Fetch GM token balances for ALL markets
  const gmBalanceContracts = useMemo(() => {
    if (!address || markets.length === 0) return [];
    return markets.flatMap(market => [
      {
        address: market.marketToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      },
      {
        address: market.marketToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      },
      {
        address: market.marketToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      },
    ]);
  }, [address, markets]);

  const { data: gmBalanceData, isLoading: balancesLoading } = useReadContracts({
    contracts: gmBalanceContracts,
    query: {
      enabled: gmBalanceContracts.length > 0,
      refetchInterval: 10000,
    }
  });

  // Build LP positions for all markets with non-zero balance
  const lpPositions = useMemo<LPPosition[]>(() => {
    if (!gmBalanceData || markets.length === 0) return [];
    
    const positions: LPPosition[] = [];
    
    markets.forEach((market, index) => {
      const balanceResult = gmBalanceData[index * 3];
      const totalSupplyResult = gmBalanceData[index * 3 + 1];
      const decimalsResult = gmBalanceData[index * 3 + 2];
      
      const balance = balanceResult?.result as bigint || 0n;
      const totalSupply = totalSupplyResult?.result as bigint || 0n;
      const decimals = decimalsResult?.result as number || 18;
      
      if (balance > 0n) {
        const balanceFormatted = parseFloat(formatUnits(balance, decimals));
        const sharePercentage = totalSupply > 0n 
          ? (Number(balance) * 100 / Number(totalSupply))
          : 0;
        
        // Estimate USD value based on pool TVL
        const poolValueUsd = market.poolValueUsd || 0;
        const depositedUsd = totalSupply > 0n 
          ? (Number(balance) / Number(totalSupply)) * poolValueUsd
          : 0;
        
        positions.push({
          id: `lp-${market.marketToken}`,
          vaultId: market.marketToken,
          vaultName: `${market.indexSymbol || market.name} Vault`,
          deposited: balanceFormatted,
          share: sharePercentage,
          pnl: 0, // Would need historical data
          feesEarned: 0, // Would need historical data
          utilizationExposure: 50, // Mock
          vault: {
            id: `vault-${market.marketToken}`,
            name: `${market.indexSymbol} Vault`,
            token: 'GM',
            tokenAddress: market.marketToken,
            markets: [market.name],
            totalLiquidity: poolValueUsd,
            utilization: 50,
            pnl24h: 0,
            risk: 'Medium',
            marketData: market
          }
        });
      }
    });
    
    return positions;
  }, [gmBalanceData, markets]);

  const handleSelectVault = (vault: Vault) => {
    setSelectedVault(vault);
    setIsDrawerOpen(true);
  };

  // Map markets to Vault objects
  const vaults = useMemo<Vault[]>(() => {
    return markets.map((market) => ({
      id: `vault-${market.marketToken}`,
      name: `${market.indexSymbol} Vault`,
      token: 'GM',
      tokenAddress: market.marketToken,
      markets: [market.name],
      totalLiquidity: market.poolValueUsd || 0,
      utilization: 50,
      pnl24h: 0,
      risk: 'Medium',
      marketData: market
    }));
  }, [markets]);

  const displayVaults = vaults.length > 0 ? vaults : [];

  // Calculate total deposited USD across all positions
  const totalDepositedUsd = useMemo(() => {
    return lpPositions.reduce((sum, pos) => {
      const vault = pos.vault;
      if (vault && vault.totalLiquidity > 0) {
        const usd = (pos.deposited / (vault.totalLiquidity / (getPrice(vault.marketData?.longToken || '') || 1))) * vault.totalLiquidity || pos.deposited;
        return sum + (pos.vault?.totalLiquidity ? (pos.share / 100) * pos.vault.totalLiquidity : 0);
      }
      return sum;
    }, 0);
  }, [lpPositions, getPrice]);

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
          <TopStat label="Your Positions" value={lpPositions.length.toString()} />
          <div className="bg-[#111827] border border-gray-800 rounded-lg p-3 min-w-[120px] relative group cursor-pointer hover:border-gray-700 transition-colors" onClick={() => refetch()}>
             <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center justify-between">
               Total Deposited
               <svg className={`w-3 h-3 text-gray-600 group-hover:text-emerald-500 transition-transform ${balancesLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             </span>
             <div className="text-base font-bold text-emerald-400">${totalDepositedUsd.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
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

          {/* User Positions - Now shows ALL markets */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Your Liquidity Positions</h2>
            {lpPositions.length > 0 ? (
               <LPPositionsTable 
                 positions={lpPositions} 
                 onManage={handleSelectVault} 
               />
            ) : (
              <div className="p-8 text-center border border-dashed border-gray-800 rounded-xl text-gray-500 text-sm">
                {balancesLoading ? 'Loading positions...' : 'No active liquidity positions found in any vault.'}
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

