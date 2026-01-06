
import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => {
  return (
    <aside className="w-16 lg:w-60 bg-[#111827] border-r border-gray-800 flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center px-4 border-b border-gray-800">
        <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-black text-xl">G</div>
        <span className="ml-3 font-bold text-xl tracking-tight hidden lg:block">CUSTOM GMX</span>
      </div>
      
      <nav className="flex-1 py-6 px-3 space-y-2">
        <SidebarItem to="/trade" icon={<TradeIcon />} label="Trade" />
        <SidebarItem to="/portfolio" icon={<PortfolioIcon />} label="Portfolio" />
        <SidebarItem to="/liquidity" icon={<LiquidityIcon />} label="Liquidity" />
        <div className="pt-4 mt-4 border-t border-gray-800/50">
          <SidebarItem to="/docs" icon={<DocsIcon />} label="Documentation" />
        </div>
      </nav>
      
      <div className="p-4 bg-gray-900/50 rounded-lg m-3 border border-gray-800 hidden lg:block">
        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">Live Statistics</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Total Vol</span>
            <span className="text-xs font-medium text-gray-200">$42.8M</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Open Interest</span>
            <span className="text-xs font-medium text-gray-200">$1.2M</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

const SidebarItem: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => 
      `flex items-center px-3 py-2.5 rounded-lg transition-all group ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`
    }
  >
    <span className="w-6 h-6 flex items-center justify-center">{icon}</span>
    <span className="ml-3 font-medium hidden lg:block">{label}</span>
  </NavLink>
);

const TradeIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const PortfolioIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const LiquidityIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
const DocsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;

export default Sidebar;
