import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { Vault } from '../../types';
import { CONTRACTS, FEES } from '../../constants';
import { useUSDCBalance } from '../../hooks/useBalances';
import { useLiquidity } from '../../hooks/useLiquidity';
import { useCreateDeposit } from '../../hooks/useCreateDeposit';
import { useCreateWithdrawal } from '../../hooks/useCreateWithdrawal';
import { useTokenApproval } from '../../hooks/useTokenApproval';
import { useLiquidityHistory } from '../../hooks/useLiquidityHistory';
import toast from 'react-hot-toast';

interface VaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  isConnected: boolean;
}

const VaultDrawer: React.FC<VaultDrawerProps> = ({ isOpen, onClose, vault, isConnected }) => {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');

  // Hooks
  const { balance: usdcBalance } = useUSDCBalance(address);
  const { data: liquidityData } = useLiquidity();
  const { data: historyData } = useLiquidityHistory(address);
  
  // Destructure isConfirmed and txHash for Toasts
  const { 
    createDeposit, 
    isCreating: isDepositing, 
    isConfirmed: isDepositConfirmed, 
    txHash: depositTxHash 
  } = useCreateDeposit(address);

  const { 
    createWithdrawal, 
    isCreating: isWithdrawing, 
    isConfirmed: isWithdrawConfirmed, 
    txHash: withdrawTxHash 
  } = useCreateWithdrawal(address);
  
  // Approval Hook for USDC (Deposit)
  // Approval Hook - Dynamic based on active tab
  const approvalToken = activeTab === 'add' ? CONTRACTS.usdc : vault.tokenAddress; 
  const decimals = activeTab === 'add' ? 6 : 18;
  const amountBigInt = amount && !isNaN(parseFloat(amount)) ? parseUnits(amount, decimals) : 0n;

  const { 
    isApproved, 
    isApproving, 
    approve, 
  } = useTokenApproval({
    tokenAddress: approvalToken as `0x${string}`,
    spenderAddress: CONTRACTS.exchangeRouter as `0x${string}`,
    amount: amountBigInt
  });

  // Toast on Deposit Confirmation
  useEffect(() => {
    if (isDepositConfirmed && depositTxHash) {
      toast.success(
        <div>
          Deposit Confirmed! <br/>
          <a href={`http://115.75.100.60:8067/tx/${depositTxHash}`} target="_blank" rel="noreferrer" className="underline font-bold">View on Explorer</a>
        </div>,
        { duration: 8000 }
      );
      setAmount(''); // Reset form on success
    }
  }, [isDepositConfirmed, depositTxHash]);

  // Toast on Withdrawal Confirmation
  useEffect(() => {
    if (isWithdrawConfirmed && withdrawTxHash) {
      toast.success(
        <div>
          Withdrawal Confirmed! <br/>
          <a href={`http://115.75.100.60:8067/tx/${withdrawTxHash}`} target="_blank" rel="noreferrer" className="underline font-bold">View on Explorer</a>
        </div>,
        { duration: 8000 }
      );
      setAmount(''); // Reset form on success
    }
  }, [isWithdrawConfirmed, withdrawTxHash]);

  const isSubmitting = isDepositing || isWithdrawing || isApproving;
  
  // Validation
  const balance = activeTab === 'add' ? parseFloat(usdcBalance) : parseFloat(liquidityData?.userGmBalance || '0');
  const isValid = amount && !isNaN(parseFloat(amount)) && parseFloat(amount) <= balance && parseFloat(amount) > 0;

  const handleMaxClick = () => {
    if (activeTab === 'add') {
      setAmount(usdcBalance);
    } else {
      setAmount(liquidityData?.userGmBalance || '0');
    }
  };

  const handleAction = async () => {
    if (!isValid) return;

    try {
      if (activeTab === 'add') {
        // Deposit Flow
        if (!isApproved) {
          await approve();
          return;
        }
        await createDeposit({
          marketAddress: CONTRACTS.market as `0x${string}`,
          tokenAddress: CONTRACTS.usdc as `0x${string}`,
          amount,
          decimals: 6 // USDC
        });
        setAmount('');
      } else {
        // Withdraw Flow
        // 1. Check GM Token Approval
        if (!isApproved) {
          await approve();
          return;
        }
        // 2. WNT Token Approval is not needed for execution fee as it's native.

        await createWithdrawal({
          marketAddress: CONTRACTS.market as `0x${string}`,
          marketTokenAddress: CONTRACTS.market as `0x${string}`, // GM Token IS the Market contract usually
          amount,
          decimals: 18 // GM Token
        });
        setAmount('');
      }
      
      // We don't close immediately anymore, we wait for confirmation or user action
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end items-stretch">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md bg-[#111827] h-full shadow-2xl border-l border-gray-800 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-indigo-500/20 rounded flex items-center justify-center font-bold text-indigo-400">
               {vault.token[0]}
             </div>
             <div>
               <h2 className="font-bold text-white">{vault.name}</h2>
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Protocol Backing Vault</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <DetailStat label="Your Deposits" value={`$${liquidityData?.userGmBalanceUsd || '0.00'}`} />
            <DetailStat label="Your Share" value="~0.01%" />
            <DetailStat label="Unrealized PnL" value="$0.00" color="text-emerald-400" />
            <DetailStat label="Accrued Fees" value="$0.00" />
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
            <div className="flex border-b border-gray-800">
              <button 
                onClick={() => { setActiveTab('add'); setAmount(''); }}
                className={`flex-1 py-3 text-xs font-bold uppercase transition-all ${activeTab === 'add' ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Add Liquidity
              </button>
              <button 
                onClick={() => { setActiveTab('remove'); setAmount(''); }}
                className={`flex-1 py-3 text-xs font-bold uppercase transition-all ${activeTab === 'remove' ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Remove Liquidity
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Amount ({activeTab === 'add' ? 'USDC' : 'GM'})</label>
                  <span className="text-[10px] text-gray-600">
                    Wallet: {activeTab === 'add' ? `${usdcBalance} USDC` : `${liquidityData?.userGmBalance || '0.00'} GM`}
                  </span>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0C111A] border border-gray-800 rounded-lg pl-4 pr-24 py-3 text-lg font-bold focus:outline-none focus:border-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    <span className="text-xs text-gray-600 font-bold">{activeTab === 'add' ? 'USDC' : 'GM'}</span>
                    <button 
                      onClick={handleMaxClick}
                      className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 hover:bg-gray-700 uppercase"
                    >
                      Max
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-black/20 p-4 rounded-lg">
                <SummaryRow label="Protocol Share Delta" value="+0.015%" />
                <SummaryRow label="Est. Annual Fee Yield" value="~12.4%" color="text-emerald-400" />
                <SummaryRow label="Execution Fee" value="0.015 HNC" highlight />
              </div>

              <button 
                onClick={handleAction}
                disabled={!isConnected || !isValid || isSubmitting}
                className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${activeTab === 'add' ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-amber-500 text-black hover:bg-amber-400'}`}
              >
                {isSubmitting ? 'Processing...' : (
                  activeTab === 'add' 
                    ? (!isApproved ? 'Approve USDC' : `Deposit ${vault.token}`) 
                    : (!isApproved ? `Approve ${vault.token}` : `Withdraw ${vault.token}`)
                  )}
              </button>
            </div>
          </div>



          {/* History Section (Contextual) */}
          <div className="space-y-3">
             <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Activity</h4>
             <div className="bg-black/20 rounded-lg overflow-hidden border border-gray-800">
               {historyData?.history && historyData.history.length > 0 ? (
                 <div className="max-h-40 overflow-y-auto">
                   <table className="w-full text-[10px] text-left text-gray-500">
                     <thead className="bg-gray-900/50 text-gray-400">
                       <tr>
                         <th className="px-4 py-2">Time</th>
                         <th className="px-4 py-2">Balance</th>
                         <th className="px-4 py-2">Fees</th>
                       </tr>
                     </thead>
                     <tbody>
                       {historyData.history.slice(0, 10).map((item: any) => (
                         <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                           <td className="px-4 py-2">{new Date(item.timestamp * 1000).toLocaleDateString()}</td>
                           <td className="px-4 py-2 font-mono text-gray-300">
                              {(parseInt(item.tokensBalance) / 1e18).toFixed(2)} GM
                           </td>
                           <td className="px-4 py-2 font-mono text-emerald-400">
                              ${(parseInt(item.cumulativeIncome) / 1e18).toFixed(2)}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               ) : (
                 <div className="p-4 text-center text-[10px] text-gray-600 italic">No recent history.</div>
               )}
             </div>
          </div>

          <div className="p-4 bg-[#1A1F2B] rounded-lg border border-gray-800">
             <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Protocol Note</h4>
             <p className="text-[10px] text-gray-500 leading-relaxed">
               GMX V2 liquidity operations are asynchronous. Market tokens will be minted to your address once the keeper executes the deposit request.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailStat: React.FC<{ label: string, value: string, color?: string }> = ({ label, value, color }) => (
  <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-800">
    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</div>
    <div className={`text-sm font-bold ${color || 'text-white'}`}>{value}</div>
  </div>
);

const SummaryRow: React.FC<{ label: string, value: string, color?: string, highlight?: boolean }> = ({ label, value, color, highlight }) => (
  <div className="flex justify-between items-center">
    <span className="text-[10px] text-gray-500 font-bold">{label}</span>
    <span className={`text-[11px] font-bold ${highlight ? 'text-white' : (color || 'text-gray-300')}`}>{value}</span>
  </div>
);

export default VaultDrawer;
