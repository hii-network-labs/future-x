
import React from 'react';
import { CHAIN_ID, CHAIN_NAME } from '../constants';

const WrongChainBanner: React.FC = () => {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between">
      <div className="flex items-center space-x-4 mb-4 md:mb-0">
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <div>
          <h3 className="font-bold text-lg text-white">Wrong Network Detected</h3>
          <p className="text-gray-400 text-sm">Please switch to <span className="text-white font-bold">{CHAIN_NAME}</span> (Chain ID {CHAIN_ID}) to resume trading.</p>
        </div>
      </div>
      
      <button className="bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-8 rounded-lg transition-all shadow-lg shadow-red-500/20 active:scale-95">
        Switch to Chain {CHAIN_ID}
      </button>
    </div>
  );
};

export default WrongChainBanner;
