import React, { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';
import { Vault } from '../../types';
import { CONTRACTS, FEES } from '../../constants';
import { useTokenBalance, useETHBalance } from '../../hooks/useBalances';
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
  
  // Deposit State
  const [depositMode, setDepositMode] = useState<'long' | 'short' | 'pair'>('short');
  const [amountLong, setAmountLong] = useState('');
  const [amountShort, setAmountShort] = useState('');
  // Withdraw State
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Determine Token Addresses
  const longTokenAddress = vault.marketData?.longToken;
  const shortTokenAddress = vault.marketData?.shortToken || CONTRACTS.usdc;
  
  // Balances
  const { balance: nativeBalance } = useETHBalance(address);
  // This hook fetches balance for the specific longTokenAddress (could be WNT, GMX, BTC, etc.)
  const { balance: specificLongTokenBalance, symbol: longTokenSymbol } = useTokenBalance(address, longTokenAddress as `0x${string}`);
  const { balance: shortBalance } = useTokenBalance(address, shortTokenAddress as `0x${string}`);
  
  // Determine if Long Token is WNT (Native Wrapper)
  const isLongTokenWNT = longTokenAddress?.toLowerCase() === CONTRACTS.wnt.toLowerCase();
  
  // Logic: 
  // - If WNT: User deposits HNC (native), so show nativeBalance.
  // - If GMX/Other: User deposits that token directly, show specificLongTokenBalance.
  const longBalance = isLongTokenWNT ? nativeBalance : specificLongTokenBalance;
  const longSymbol = isLongTokenWNT ? 'HNC' : (vault.token === 'GMX' ? 'GMX' : (longTokenSymbol || 'Long Token'));
  
  const { data: liquidityData } = useLiquidity(
    vault.marketData?.marketToken,
    vault.marketData?.longToken,
    vault.marketData?.shortToken
  );
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
  
  // Amounts for Approval
  const longAmountBigInt = amountLong && !isNaN(parseFloat(amountLong)) ? parseUnits(amountLong, 18) : 0n;
  const shortAmountBigInt = amountShort && !isNaN(parseFloat(amountShort)) ? parseUnits(amountShort, 6) : 0n;
  const withdrawAmountBigInt = withdrawAmount && !isNaN(parseFloat(withdrawAmount)) ? parseUnits(withdrawAmount, 18) : 0n;

  // 1. Long Token Approval (WNT/GMX)
  const { 
    isApproved: isLongApproved, 
    isApproving: isLongApproving, 
    approve: approveLong, 
  } = useTokenApproval({
    tokenAddress: longTokenAddress as `0x${string}`,
    spenderAddress: CONTRACTS.router as `0x${string}`, 
    amount: longAmountBigInt
  });

  // 2. Short Token Approval (USDC)
  const { 
    isApproved: isShortApproved, 
    isApproving: isShortApproving, 
    approve: approveShort, 
  } = useTokenApproval({
    tokenAddress: shortTokenAddress as `0x${string}`,
    spenderAddress: CONTRACTS.router as `0x${string}`, 
    amount: shortAmountBigInt
  });

  // 3. GM Token Approval (For Withdraw)
  const { 
    isApproved: isGmApproved, 
    isApproving: isGmApproving, 
    approve: approveGm, 
  } = useTokenApproval({
    tokenAddress: vault.marketData?.marketToken as `0x${string}`,
    spenderAddress: CONTRACTS.router as `0x${string}`, 
    amount: withdrawAmountBigInt
  });

  // Toast on Deposit Confirmation
  useEffect(() => {
    if (isDepositConfirmed && depositTxHash) {
      toast.success(
        <div>
          Deposit Confirmed! <br/>
          <a href={`http://115.75.100.60:8067/tx/${depositTxHash}`} target="_blank" rel="noreferrer" className="underline font-bold">View on Explorer</a>
        </div>,
        { duration: 5000, id: 'deposit-success' }
      );
      setAmountLong('');
      setAmountShort('');
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
        { duration: 5000, id: 'withdraw-success' }
      );
      setWithdrawAmount('');
    }
  }, [isWithdrawConfirmed, withdrawTxHash]);

  const isSubmitting = isDepositing || isWithdrawing || isLongApproving || isShortApproving || isGmApproving;
  
  // Validation Helper
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const value = e.target.value;
    // Allow empty, or valid positive float (no standard negative sign)
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setter(value);
    }
  };

  const getError = (amount: string, balance: string | undefined) => {
     if (!amount) return null;
     const val = parseFloat(amount);
     const bal = parseFloat(balance?.replace(/,/g, '') || '0');
     if (isNaN(val)) return 'Invalid amount';
     if (val > bal) return 'Exceeds balance';
     return null;
  };

  const isValidDeposit = () => {
      const longVal = parseFloat(amountLong || '0');
      const shortVal = parseFloat(amountShort || '0');
      const longBal = parseFloat(longBalance || '0');
      const shortBal = parseFloat(shortBalance || '0');

      if (depositMode === 'long') return longVal > 0 && longVal <= longBal;
      if (depositMode === 'short') return shortVal > 0 && shortVal <= shortBal;
      if (depositMode === 'pair') {
          // At least one > 0, and all entered must be valid
          if (longVal === 0 && shortVal === 0) return false;
          if (longVal > longBal) return false;
          if (shortVal > shortBal) return false;
          return true;
      }
      return false;
  };

  const isValidWithdraw = parseFloat(withdrawAmount) > 0 && parseFloat(withdrawAmount) <= parseFloat(liquidityData?.userGmBalance || '0');
  const isValid = activeTab === 'add' ? isValidDeposit() : isValidWithdraw;


  // Get public client to wait for tx receipts
  const publicClient = usePublicClient();

  const handleAction = async () => {
    if (!isValid) return;

    try {
      if (activeTab === 'add') {
        // ========== DEPOSIT FLOW ==========
        
        // Check Approvals based on INPUT amounts (not just mode)
        // NOTE: Skip long token approval if it's WNT - we use sendWnt which wraps native HNC automatically
        const isLongTokenWNT = longTokenAddress?.toLowerCase() === CONTRACTS.wnt.toLowerCase();
        const needsLongApproval = !isLongTokenWNT && (depositMode === 'long' || depositMode === 'pair') && parseUnits(amountLong || '0', 18) > 0n && !isLongApproved;
        const needsShortApproval = (depositMode === 'short' || depositMode === 'pair') && parseUnits(amountShort || '0', 6) > 0n && !isShortApproved;

        if (needsLongApproval) {
          toast('Approving Long Token...', { icon: '🔐' });
          const hash = await approveLong();
          if (hash && publicClient) await publicClient.waitForTransactionReceipt({ hash });
        }

        if (needsShortApproval) {
          toast('Approving USDC...', { icon: '🔐' });
          const hash = await approveShort();
          if (hash && publicClient) await publicClient.waitForTransactionReceipt({ hash });
        }
        
        // Execute Deposit
        await createDeposit({
          marketAddress: (vault.marketData?.marketToken || CONTRACTS.market) as `0x${string}`,
          // Pass legacy tokenAddress/decimals just in case (optional)
          tokenAddress: depositMode === 'short' ? shortTokenAddress as `0x${string}` : longTokenAddress as `0x${string}`,
          amount: '0', 
          decimals: 18,
          
          longToken: longTokenAddress as `0x${string}`,
          shortToken: shortTokenAddress as `0x${string}`,
          longAmount: (depositMode === 'long' || depositMode === 'pair') ? amountLong : undefined,
          shortAmount: (depositMode === 'short' || depositMode === 'pair') ? amountShort : undefined,
        });
        
        setAmountLong('');
        setAmountShort('');

      } else {
        // ========== WITHDRAW FLOW ==========
        if (!isGmApproved) {
           toast('Approving GM Token...', { icon: '🔐' });
           const hash = await approveGm();
           if (hash && publicClient) await publicClient.waitForTransactionReceipt({ hash });
        }

        await createWithdrawal({
          marketAddress: (vault.marketData?.marketToken || CONTRACTS.market) as `0x${string}`,
          marketTokenAddress: (vault.marketData?.marketToken || CONTRACTS.market) as `0x${string}`,
          amount: withdrawAmount,
          decimals: 18 // GM Token
        });
        setWithdrawAmount('');
      }
      
    } catch (e) {
      console.error(e);
      toast.error('Operation failed');
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
                onClick={() => { setActiveTab('add'); }}
                className={`flex-1 py-3 text-xs font-bold uppercase transition-all ${activeTab === 'add' ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Add Liquidity
              </button>
              <button 
                onClick={() => { setActiveTab('remove'); }}
                className={`flex-1 py-3 text-xs font-bold uppercase transition-all ${activeTab === 'remove' ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Remove Liquidity
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Token Selector (Only show for Add Liquidity) */}
              {activeTab === 'add' && (
                  <div className="flex bg-black/40 p-1 rounded-lg border border-gray-800">
                      <button 
                        onClick={() => setDepositMode('short')}
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${depositMode === 'short' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                         USDC (Shorts)
                      </button>
                      <button 
                        onClick={() => setDepositMode('long')}
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${depositMode === 'long' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                         Longs
                      </button>
                      <button 
                        onClick={() => setDepositMode('pair')}
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${depositMode === 'pair' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                         Pair
                      </button>
                  </div>
              )}

              {/* Input Fields */}
              {activeTab === 'add' ? (
                <div className="space-y-4">
                    {/* Short Token Input */}
                    {(depositMode === 'short' || depositMode === 'pair') && (
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Amount (USDC)</label>
                                <span className="text-[10px] text-gray-600">Wallet: {shortBalance}</span>
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    value={amountShort}
                                    onChange={(e) => handleAmountChange(e, setAmountShort)}
                                    placeholder="0.00"
                                    className={`w-full bg-[#0C111A] border ${getError(amountShort, shortBalance) ? 'border-red-500/50 focus:border-red-500' : 'border-gray-800 focus:border-emerald-500/50'} rounded-lg pl-4 pr-16 py-3 text-lg font-bold focus:outline-none transition-colors`}
                                />
                                <button onClick={() => setAmountShort(shortBalance)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 hover:text-white">MAX</button>
                            </div>
                            {getError(amountShort, shortBalance) && <div className="text-[10px] text-red-400 mt-1 font-bold">{getError(amountShort, shortBalance)}</div>}
                        </div>
                    )}

                    {/* Long Token Input */}
                    {(depositMode === 'long' || depositMode === 'pair') && (
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">
                                  Amount ({longSymbol}
                                  {isLongTokenWNT && specificLongTokenBalance && parseFloat(specificLongTokenBalance) > 0 ? ` • WNT: ${specificLongTokenBalance}` : ''})
                                </label>
                                <span className="text-[10px] text-gray-600">Wallet: {longBalance}</span>
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    value={amountLong}
                                    onChange={(e) => handleAmountChange(e, setAmountLong)}
                                    placeholder="0.00"
                                    className={`w-full bg-[#0C111A] border ${getError(amountLong, longBalance) ? 'border-red-500/50 focus:border-red-500' : 'border-gray-800 focus:border-indigo-500/50'} rounded-lg pl-4 pr-16 py-3 text-lg font-bold focus:outline-none transition-colors`}
                                />
                                <button 
                                  onClick={() => {
                                    if (isLongTokenWNT) {
                                      // Native Token: Subtract Gas Buffer (0.01)
                                      const val = parseFloat(longBalance || '0');
                                      const max = Math.max(0, val - 0.01);
                                      setAmountLong(max.toFixed(4));
                                    } else {
                                      setAmountLong(longBalance || '0');
                                    }
                                  }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 hover:text-white"
                                >
                                  MAX
                                </button>
                            </div>
                            {getError(amountLong, longBalance) && <div className="text-[10px] text-red-400 mt-1 font-bold">{getError(amountLong, longBalance)}</div>}
                        </div>
                    )}
                </div>
              ) : (
                // Withdraw Input
                <div>
                     <div className="flex justify-between items-end mb-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase">Amount (GM)</label>
                        <span className="text-[10px] text-gray-600">Balance: {liquidityData?.userGmBalance || '0.00'}</span>
                    </div>
                    <div className="relative">
                        <input 
                            type="text" 
                            inputMode="decimal"
                            value={withdrawAmount}
                            onChange={(e) => handleAmountChange(e, setWithdrawAmount)}
                            placeholder="0.00"
                            className={`w-full bg-[#0C111A] border ${getError(withdrawAmount, liquidityData?.userGmBalance) ? 'border-red-500/50 focus:border-red-500' : 'border-gray-800 focus:border-amber-500/50'} rounded-lg pl-4 pr-16 py-3 text-lg font-bold focus:outline-none transition-colors`}
                        />
                        <button onClick={() => setWithdrawAmount(liquidityData?.userGmBalance || '0')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 hover:text-white">MAX</button>
                    </div>
                    {getError(withdrawAmount, liquidityData?.userGmBalance) && <div className="text-[10px] text-red-400 mt-1 font-bold">{getError(withdrawAmount, liquidityData?.userGmBalance)}</div>}
                </div>
              )}

              <div className="space-y-3 bg-black/20 p-4 rounded-lg">
                <SummaryRow label="Protocol Share Delta" value="+0.015%" />
                <SummaryRow label="Est. Annual Fee Yield" value="~12.4%" color="text-emerald-400" />
                <SummaryRow label="Execution Fee" value="0.015 HNC" highlight />
              </div>

              <button 
                onClick={handleAction}
                disabled={!isConnected || !isValid || isSubmitting}
                className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${activeTab === 'add' ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-amber-500 text-black hover:bg-amber-400'}`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  activeTab === 'add' 
                    ? `Deposit ${depositMode === 'pair' ? 'Pair' : vault.token}` 
                    : `Withdraw ${vault.token}`
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
