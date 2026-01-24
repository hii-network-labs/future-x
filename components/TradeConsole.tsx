import React, { useState, useEffect } from 'react';
import OrderPanel from './OrderPanel';
import PositionsPanel from './PositionsPanel';
import PendingOrdersPanel from './PendingOrdersPanel';
import TradeHistoryPanel from './TradeHistoryPanel';
import RiskDisclosure from './RiskDisclosure';
import ChartView from './ChartView';
import MarketSelector from './MarketSelector';
import { ChainState, MarketSide, Position, PendingOrder, OrderStatus, OrderType } from '../types';
import { useGmxProtocol } from '../hooks/useGmxProtocol';
import { useCreateOrder } from '../hooks/useCreateOrder';
import { usePositions } from '../hooks/usePositions';
import { useClosePosition } from '../hooks/useClosePosition';
import { useTradeHistory } from '../hooks/useTradeHistory';
import { useMarketContext } from '../contexts/MarketContext';
import { MOCK_ORDERS } from '../constants';
import { CONTRACTS } from '../constants';
import { useMetadata } from '../hooks/useMetadata';
import toast from 'react-hot-toast';

interface TradeConsoleProps {
  chainState: ChainState;
}


const TradeConsole: React.FC<TradeConsoleProps> = ({ chainState }) => {
  const { selectedMarket } = useMarketContext();
  
  // Pass selectedMarket's indexToken to get correct price
  const { ethPrice, prices, currentPriceBigInt } = useGmxProtocol(
    chainState.address,
    selectedMarket?.indexToken
  );
  const { createOrder, isCreating, isConfirmed } = useCreateOrder(chainState.address as `0x${string}`);
  const { closePosition, isClosing } = useClosePosition();
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  
  const { positions: realPositions, isLoading: positionsLoading } = usePositions(
    chainState.address as `0x${string}`,
    ethPrice,
    prices,
    pendingOrders // Pass pending orders to help fix transient entry price
  );
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [historyPage, setHistoryPage] = useState(1);
  const [side, setSide] = useState<MarketSide>(MarketSide.LONG);

  // Dynamic Collateral Token Logic
  // Long -> Use market.longToken. IF WNT -> Use Native ETH
  // Short -> Use market.shortToken (e.g. USDC)
  
  const isWntLong = side === MarketSide.LONG && 
    (selectedMarket?.longToken.toLowerCase() === CONTRACTS.wnt.toLowerCase());

  const collateralTokenAddress = isWntLong
    ? undefined // Use Native ETH
    : (side === MarketSide.LONG 
        ? (selectedMarket?.longToken || CONTRACTS.wnt) 
        : (selectedMarket?.shortToken || CONTRACTS.usdc));

  const collateralTokenSymbol = isWntLong
    ? 'HNC'
    : (side === MarketSide.LONG
        ? (selectedMarket?.longSymbol || 'WNT') 
        : (selectedMarket?.shortSymbol || 'USDC'));
  
  // Hooks with pagination
  const { data: tradeHistory = [], isLoading: historyLoading, totalPages, total } = useTradeHistory(chainState.address, historyPage, 10);

  // Use real positions directly from Reader contract
  const positions = realPositions;

  const handleOpenOrder = async (side: MarketSide, size: number, collateral: number, leverage: number, collateralTokenAddr?: string) => {
    // ... setup order ...
    const newOrder: PendingOrder = {
      id: `order-${Date.now()}`,
      type: OrderType.INCREASE,
      side,
      size,
      price: ethPrice,
      status: OrderStatus.PENDING,
      timestamp: Date.now(),
      marketAddress: selectedMarket?.marketToken,
    };
    
    setPendingOrders([newOrder, ...pendingOrders]);
    
    try {
      const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      
      // Calculate acceptable price with 0.3% slippage
      // Long: Price * 1.003 (Max we are willing to buy at)
      // Short: Price * 0.997 (Min we are willing to sell for)
      // Note: currentPriceBigInt is 30 decimals
      const SLIPPAGE_BPS = 30n; // 0.3% = 30 BPS. 100% = 10000 BPS
      const BPS_DIVISOR = 10000n;

      let acceptablePrice = 0n;
      
      if (side === MarketSide.LONG) {
         // Long: price * (1 + 0.003)
         acceptablePrice = currentPriceBigInt * (BPS_DIVISOR + SLIPPAGE_BPS) / BPS_DIVISOR;
      } else {
         // Short: price * (1 - 0.003)
         acceptablePrice = currentPriceBigInt * (BPS_DIVISOR - SLIPPAGE_BPS) / BPS_DIVISOR;
      }

      // SCALE DOWN to "Compact Price" (Contract Precision)
      // Contract expects: Price * 10^(30 - TokenDecimals)
      // We have: Price * 10^30
      // So we must divide by 10^TokenDecimals
      const indexDecimals = selectedMarket?.indexDecimals || 18;
      // const decimalsScale = 10n ** BigInt(indexDecimals);
      // acceptablePrice = acceptablePrice / decimalsScale; // FIXED: Contract expects 30 decimals for Order params

      console.log('🔵 ORDER PARAMS:', { 
        side: side === MarketSide.LONG ? 'LONG' : 'SHORT',
        size, 
        collateral,
        collateralToken: collateralTokenAddr,
        market: selectedMarket?.marketToken,
        acceptablePrice: acceptablePrice.toString(),
        indexDecimals
      });
      
      const market = selectedMarket?.marketToken || CONTRACTS.market as `0x${string}`;
      // Use passed token or fallback to logic: Long->LongToken, Short->ShortToken
      const targetCollateralToken = collateralTokenAddr || 
        (side === MarketSide.LONG ? (selectedMarket?.longToken || CONTRACTS.wnt) : (selectedMarket?.shortToken || CONTRACTS.usdc));
      
      await createOrder({
        market,
        collateralToken: targetCollateralToken as `0x${string}`,

        sizeDeltaUsd: size,
        collateralAmount: collateral,
        currentPrice: ethPrice, // Pass current ETH price for USD->ETH conversion
        isLong: side === MarketSide.LONG,
        acceptablePrice,
      });

      // Update order status to executed
      setPendingOrders(prev => prev.map(o => 
        o.id === newOrder.id ? { ...o, status: OrderStatus.EXECUTED } : o
      ));

      // toast.success('Order created! Waiting for keeper execution...'); // Removed redundant toast (handled in hook)
      
      // Position will appear in real data after keeper execution (typically 1-3 seconds)
      // No need for optimistic update - real data refreshes every 3 seconds

    } catch (e: any) {
      console.error('Order failed:', e);
      setPendingOrders(prev => prev.map(o => 
        o.id === newOrder.id ? { ...o, status: OrderStatus.FAILED } : o
      ));
    }
  };

  const handleClosePosition = async (id: string) => {
    const pos = realPositions.find(p => p.id === id);
    
    if (!pos) return;
    
    console.log('Closing position:', pos);
    toast.loading('Preparing to close position...', { id: 'close-position' });
    
    try {
      // FIX: Use position's own market and collateral token, NOT the selected market
      const market = pos.marketAddress;
      const collateralToken = pos.collateralToken;
      
      await closePosition({
        market,
        collateralToken,
        indexToken: pos.indexToken,
        isLong: pos.side === MarketSide.LONG,
        sizeDeltaUsd: pos.size.toString(),
      });
      
      toast.dismiss('close-position');
      
      // Position will be removed from real data after keeper execution
    } catch (error) {
      console.error('Close position failed:', error);
      toast.dismiss('close-position');
      // Error toast handled by useClosePosition hook
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Toast Notifications handled by App root */}
      
      <div className="col-span-12 xl:col-span-9 space-y-6">
        {/* Market Stats Header - Compact Single Row */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-6 overflow-x-auto">
            {/* Market Selector - Compact */}
            <MarketSelector className="flex-shrink-0" />
            
            {/* Stats Row */}
            <div className="flex items-center gap-6 flex-1 justify-end">
              {/* Oracle Price */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <span className="text-[10px] font-black text-indigo-400">OR</span>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase font-semibold">Oracle</div>
                  <div className="text-xs font-bold text-white tabular-nums">${ethPrice.toLocaleString()}</div>
                </div>
              </div>

              {/* Index Price */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <span className="text-[10px] font-black text-blue-400">IX</span>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase font-semibold">Index</div>
                  <div className="text-xs font-bold text-white tabular-nums">${ethPrice.toLocaleString()}</div>
                </div>
              </div>

              {/* 24h Change */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-[9px] font-black text-emerald-400">24h</span>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase font-semibold">Change</div>
                  <div className="text-xs font-bold text-emerald-400 tabular-nums">+1.84%</div>
                </div>
              </div>

              {/* Funding Rate */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <span className="text-[10px] font-black text-purple-400">FR</span>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase font-semibold">Funding</div>
                  <div className="text-xs font-bold text-white tabular-nums">0.0008%</div>
                </div>
              </div>

              {/* Execution Fee */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <span className="text-[10px] font-black text-amber-400">EF</span>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 uppercase font-semibold">Exec Fee</div>
                  <div className="text-xs font-bold text-white tabular-nums">0.015 HNC</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-[480px] bg-[#111827] border border-gray-800 rounded-xl overflow-hidden relative">
          <ChartView 
            price={ethPrice} 
            liqPrice={positions.length > 0 ? positions[0].liqPrice : null}
            symbol={selectedMarket?.indexSymbol} 
          />
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-800">
            <button 
              onClick={() => setActiveTab('positions')}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'positions' 
                  ? 'bg-gray-800/50 text-white border-b-2 border-emerald-400' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
              }`}
            >
              Positions <span className="ml-1 text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded">{positions.length}</span>
            </button>
            <button 
              onClick={() => setActiveTab('orders')}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'orders' 
                  ? 'bg-gray-800/50 text-white border-b-2 border-emerald-400' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
              }`}
            >
              Orders <span className="ml-1 text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded">{pendingOrders.length}</span>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'history' 
                  ? 'bg-gray-800/50 text-white border-b-2 border-emerald-400' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
              }`}
            >
              History <span className="ml-1 text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded">{total > 0 ? total : tradeHistory.length}</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {activeTab === 'positions' && (
              <PositionsPanel 
                positions={positions} 
                onClose={handleClosePosition} 
                showHeader={false} 
                isLoading={positionsLoading}
              />
            )}
            {activeTab === 'orders' && (
              <PendingOrdersPanel 
                orders={pendingOrders} 
                showHeader={false} 
              />
            )}
            {activeTab === 'history' && (
              <TradeHistoryPanel 
                trades={tradeHistory} 
                isLoading={historyLoading} 
                showHeader={false} 
                currentPage={historyPage}
                totalPages={totalPages}
                onPageChange={setHistoryPage}
              />
            )}
          </div>
        </div>
      </div>

      <div className="col-span-12 xl:col-span-3 space-y-6">
        <OrderPanel 
          currentPrice={ethPrice} 
          onOpenOrder={(s, sz, c, l) => handleOpenOrder(s, sz, c, l, collateralTokenAddress)} 
          isWalletConnected={chainState.isConnected}
          isCreatingOrder={isCreating}
          collateralTokenAddress={collateralTokenAddress as `0x${string}`}
          collateralTokenSymbol={collateralTokenSymbol}
          side={side}
          onSideChange={setSide}
        />
        <RiskDisclosure />
      </div>
    </div>
  );
};

const StatBox: React.FC<{ label: string, value: string, highlight?: boolean, color?: string, sub?: string }> = ({ label, value, highlight, color, sub }) => (
  <div className="flex flex-col min-w-[120px]">
    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">{label}</span>
    <span className={`text-lg font-bold tracking-tight ${color || 'text-white'} ${highlight ? 'text-emerald-400' : ''}`}>
      {value}
    </span>
    {sub && <span className="text-[10px] text-gray-600 font-bold">{sub}</span>}
  </div>
);

export default TradeConsole;
