import React, { useMemo } from 'react';
import { ChainState } from '../types';
import { useTokenBalance, useETHBalance, useWNTBalance } from '../hooks/useBalances';
import { usePositions } from '../hooks/usePositions';
import { useGmxProtocol } from '../hooks/useGmxProtocol';
import { CONTRACTS } from '../constants'; // Import CONTRACTS for USDC address

interface PortfolioProps {
  chainState: ChainState;
}

const Portfolio: React.FC<PortfolioProps> = ({ chainState }) => {
  const { ethPrice } = useGmxProtocol(chainState.address);
  const { positions } = usePositions(chainState.address as `0x${string}`, ethPrice);
  const { balance: usdcBalance, isLoading: usdcLoading } = useTokenBalance(chainState.address as `0x${string}`, CONTRACTS.usdc as `0x${string}`);
  const { balance: ethBalance, isLoading: ethLoading } = useETHBalance(chainState.address as `0x${string}`);
  const { balance: wntBalance, isLoading: wntLoading } = useWNTBalance(chainState.address as `0x${string}`);

  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    const usdcValue = parseFloat(usdcBalance || '0');
    const ethValue = parseFloat(ethBalance || '0') * ethPrice;
    const wntValue = parseFloat(wntBalance || '0') * ethPrice;
    
    // Total collateral in positions
    const totalCollateral = positions.reduce((sum, pos) => sum + pos.collateral, 0);
    
    // Total PnL from positions
    const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);
    
    // Total position size
    const totalPositionSize = positions.reduce((sum, pos) => sum + pos.size, 0);
    
    // Average leverage
    const avgLeverage = positions.length > 0
      ? positions.reduce((sum, pos) => sum + pos.leverage, 0) / positions.length
      : 0;
    
    // Net value = wallet balances + collateral + unrealized PnL
    const netValue = usdcValue + ethValue + wntValue + totalCollateral + totalPnl;
    
    // Total wallet value
    const walletValue = usdcValue + ethValue + wntValue;
    
    return {
      netValue,
      walletValue,
      usdcValue,
      ethValue: ethValue + wntValue, // Combine ETH and WNT
      totalCollateral,
      totalPnl,
      totalPositionSize,
      avgLeverage,
    };
  }, [usdcBalance, ethBalance, wntBalance, ethPrice, positions]);

  const isLoading = usdcLoading || ethLoading || wntLoading;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Portfolio Overview</h1>
          <p className="text-gray-500 text-sm font-medium">Manage your collateral, view PnL history and tracking across Custom GMX.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Total PnL</div>
            <div className={`text-xl font-bold ${metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {isLoading ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                `${metrics.totalPnl >= 0 ? '+' : ''}$${metrics.totalPnl.toFixed(2)}`
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          label="Net Value" 
          value={isLoading ? 'Loading...' : `$${metrics.netValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          sub={`Wallet + Positions`}
        />
        <SummaryCard 
          label="Collateral Assets" 
          value={isLoading ? 'Loading...' : `$${metrics.totalCollateral.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          sub={`In ${positions.length} position${positions.length !== 1 ? 's' : ''}`}
        />
        <SummaryCard 
          label="Open Interest" 
          value={isLoading ? 'Loading...' : `$${metrics.totalPositionSize.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          sub={metrics.avgLeverage > 0 ? `Avg Leverage: ${metrics.avgLeverage.toFixed(1)}x` : 'No positions'}
        />
        <SummaryCard 
          label="Wallet Balance" 
          value={isLoading ? 'Loading...' : `$${metrics.walletValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          sub="Available funds"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-[#111827] border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Position History</h3>
          </div>
          <div className="p-20 flex flex-col items-center justify-center text-gray-700">
            <svg className="w-16 h-16 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="font-medium">Recent history is available in Trade Console</p>
          </div>
        </div>
        
        <div className="lg:col-span-4 bg-[#111827] border border-gray-800 rounded-xl p-6">
          <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400 mb-6">Asset Allocation</h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {metrics.usdcValue > 0 && (
                <AllocationRow 
                  label="USDC" 
                  amount={metrics.usdcValue.toFixed(2)}
                  percent={Math.round((metrics.usdcValue / metrics.netValue) * 100)}
                  color="bg-indigo-500" 
                />
              )}
              {metrics.ethValue > 0 && (
                <AllocationRow 
                  label="HNC" 
                  amount={metrics.ethValue.toFixed(2)}
                  percent={Math.round((metrics.ethValue / metrics.netValue) * 100)}
                  color="bg-emerald-500" 
                />
              )}
              {metrics.totalCollateral > 0 && (
                <AllocationRow 
                  label="In Positions" 
                  amount={metrics.totalCollateral.toFixed(2)}
                  percent={Math.round((metrics.totalCollateral / metrics.netValue) * 100)}
                  color="bg-purple-500" 
                />
              )}
              {metrics.netValue === 0 && (
                <div className="text-center py-8 text-gray-600 text-sm">
                  No assets detected
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string, value: string, sub: string }> = ({ label, value, sub }) => (
  <div className="bg-[#111827] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{label}</div>
    <div className="text-2xl font-bold text-white mb-1">{value}</div>
    <div className="text-xs text-gray-400 font-medium">{sub}</div>
  </div>
);

const AllocationRow: React.FC<{ label: string, amount: string, percent: number, color: string }> = ({ label, amount, percent, color }) => (
  <div>
    <div className="flex justify-between items-end mb-2">
       <span className="text-sm font-bold text-white">{label}</span>
       <span className="text-xs text-gray-500">${amount} <span className="text-gray-700 ml-1">{percent}%</span></span>
    </div>
    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
    </div>
  </div>
);

export default Portfolio;
