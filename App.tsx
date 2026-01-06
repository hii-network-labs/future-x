
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAccount, useChainId } from 'wagmi';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TradeConsole from './components/TradeConsole';
import Portfolio from './components/Portfolio';
import LiquidityConsole from './components/LiquidityConsole';
import WrongChainBanner from './components/WrongChainBanner';
import { CHAIN_ID, CHAIN_NAME } from './constants';

const App: React.FC = () => {
  // Real wallet connection using wagmi
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  const chainState = {
    address: address || null,
    isConnected,
    chainId: chainId || 0,
    isCorrectChain: chainId === CHAIN_ID,
    name: chainId === CHAIN_ID ? CHAIN_NAME : 'Wrong Network',
  };

  return (
    <HashRouter>
      <div className="flex min-h-screen text-gray-200">
        <Sidebar />
        
        <div className="flex-1 flex flex-col min-w-0 bg-[#0C111A]">
          <Header chainState={chainState} />
          
          <main className="flex-1 overflow-auto">
            <div className="max-w-[1400px] mx-auto p-4 md:p-6">
              {!chainState.isCorrectChain && chainState.isConnected && (
                <WrongChainBanner />
              )}
              
              <div className={(!chainState.isCorrectChain && chainState.isConnected) ? "pointer-events-none opacity-50 grayscale transition-all duration-300" : ""}>
                <Routes>
                  <Route path="/" element={<Navigate to="/trade" replace />} />
                  <Route path="/trade" element={<TradeConsole chainState={chainState} />} />
                  <Route path="/portfolio" element={<Portfolio chainState={chainState} />} />
                  <Route path="/liquidity" element={<LiquidityConsole chainState={chainState} />} />
                </Routes>
              </div>
            </div>
          </main>
        </div>
      </div>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#1f2937',
          color: '#fff',
          border: '1px solid #374151',
        },
      }} />
    </HashRouter>
  );
};

export default App;
