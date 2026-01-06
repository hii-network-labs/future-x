
import React from 'react';
import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ChainState, SystemStatus } from '../types';
import { CHAIN_ID, CHAIN_NAME } from '../constants';

interface HeaderProps {
  chainState: ChainState;
}

const Header: React.FC<HeaderProps> = ({ chainState }) => {
  const systemStatus: SystemStatus = {
    oracle: 'Fresh',
    keeper: 'Online',
    network: chainState.isCorrectChain ? 'Connected' : 'Error'
  };

  return (
    <header className="h-16 border-b border-gray-800 bg-[#111827] flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center space-x-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-white leading-tight">Futures Trading</h1>
            
            {/* Navigation Tabs */}
            <nav className="flex items-center space-x-1 bg-gray-900/50 p-1 rounded-lg border border-gray-800/50">
              <NavLink to="/trade" label="Trade" />
              <NavLink to="/liquidity" label="Earn" />
              <NavLink to="/portfolio" label="Portfolio" />
            </nav>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {CHAIN_NAME} <span className="text-gray-600">·</span> Chain ID {CHAIN_ID}
          </p>

        
        <div className="hidden md:flex items-center space-x-3 ml-8 border-l border-gray-800 pl-8">
          <StatusIndicator label="Network" status={systemStatus.network === 'Connected' ? 'success' : 'error'} value={CHAIN_NAME} />
          <StatusIndicator label="Oracle" status="success" value="Fresh" />
          <StatusIndicator label="Keeper" status="success" value="Online" />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <ConnectButton 
          chainStatus="icon"
          showBalance={false}
        />
      </div>
    </header>
  );
};

interface StatusIndicatorProps {
  label: string;
  status: 'success' | 'warning' | 'error';
  value: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ label, status, value }) => {
  const colorClass = 
    status === 'success' ? 'bg-emerald-500' : 
    status === 'warning' ? 'bg-amber-500' : 'bg-red-500';
    
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</span>
      <div className="flex items-center space-x-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`}></div>
        <span className="text-xs font-medium text-gray-300">{value}</span>
      </div>
    </div>
  );
};

const NavLink: React.FC<{ to: string, label: string }> = ({ to, label }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);
  
  return (
    <RouterNavLink 
      to={to} 
      className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
        isActive 
          ? 'bg-gray-800 text-white shadow-sm' 
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
      }`}
    >
      {label}
    </RouterNavLink>
  );
};

export default Header;
