import React, { useState, useEffect } from 'react';
import OrderPanel from './OrderPanel';
import PositionsPanel from './PositionsPanel';
import PendingOrdersPanel from './PendingOrdersPanel';
import TradeHistoryPanel from './TradeHistoryPanel';
import RiskDisclosure from './RiskDisclosure';
import ChartView from './ChartView';
import { ChainState, MarketSide, Position, PendingOrder, OrderStatus, OrderType } from '../types';
import { useGmxProtocol } from '../hooks/useGmxProtocol';
import { useCreateOrder } from '../hooks/useCreateOrder';
import { usePositions } from '../hooks/usePositions';
import { useClosePosition } from '../hooks/useClosePosition';
import { useTradeHistory } from '../hooks/useTradeHistory';
import { MOCK_ORDERS } from '../constants';
import { CONTRACTS } from '../constants';
import toast, { Toaster } from 'react-hot-toast';

interface TradeConsoleProps {
  chainState: ChainState;
}

const TradeConsole: React.FC<TradeConsoleProps> = ({ chainState }) => {
  const { ethPrice, prices } = useGmxProtocol(chainState.address);
  const { createOrder, isCreating, isConfirmed } = useCreateOrder(chainState.address as `0x${string}`);
  const { closePosition, isClosing } = useClosePosition();
  const { positions: realPositions, isLoading: positionsLoading } = usePositions(
    chainState.address as `0x${string}`,
    ethPrice
  );
  const [localPositions, setLocalPositions] = useState<Position[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [historyPage, setHistoryPage] = useState(1);
  
  // Hooks with pagination
  const { data: tradeHistory = [], isLoading: historyLoading, totalPages, total } = useTradeHistory(chainState.address, historyPage, 10);

  // Merge real positions with local optimistic updates
  const positions = [...realPositions, ...localPositions];

  const handleOpenOrder = async (side: MarketSide, size: number, collateral: number, leverage: number) => {
    const newOrder: PendingOrder = {
      id: `order-${Date.now()}`,
      type: OrderType.INCREASE,
      side,
      size,
      price: ethPrice,
      status: OrderStatus.PENDING,
      timestamp: Date.now()
    };
    
    setPendingOrders([newOrder, ...pendingOrders]);
    
    try {
      // Get current ETH price from keeper
      const ethPriceStr = prices[CONTRACTS.wnt.toLowerCase()];
      const currentPrice = ethPriceStr ? BigInt(ethPriceStr) : BigInt(0);
      
      // Calculate acceptable price with 10% slippage
      const acceptablePrice = side === MarketSide.LONG 
        ? (currentPrice * 110n) / 100n   // Long: willing to pay 10% more
        : (currentPrice * 90n) / 100n;   // Short: willing to receive 10% less

      // Real contract call
      await createOrder({
        sizeDeltaUsd: size,
        collateralAmount: collateral,
        isLong: side === MarketSide.LONG,
        acceptablePrice,
      });

      // Update order status to executed
      setPendingOrders(prev => prev.map(o => 
        o.id === newOrder.id ? { ...o, status: OrderStatus.EXECUTED } : o
      ));

      toast.success('Order created! Waiting for keeper execution...');
      
      // Add to local positions for optimistic UI update
      const newPos: Position = {
        id: `pos-${Date.now()}`,
        market: "ETH-PERP",
        side,
        size,
        collateral,
        entryPrice: ethPrice,
        markPrice: ethPrice,
        leverage,
        liqPrice: side === MarketSide.LONG ? ethPrice * 0.82 : ethPrice * 1.18,
        pnl: 0
      };
      setLocalPositions(prev => [newPos, ...prev]);
      
      // Remove from pending and local after keeper execution (delay for demo)
      setTimeout(() => {
        setPendingOrders(prev => prev.filter(o => o.id !== newOrder.id));
        // Remove local position after real one appears
        setTimeout(() => {
          setLocalPositions(prev => prev.filter(p => p.id !== newPos.id));
        }, 10000); // 10s to allow real position to load
      }, 5000);

    } catch (e: any) {
      console.error('Order failed:', e);
      setPendingOrders(prev => prev.map(o => 
        o.id === newOrder.id ? { ...o, status: OrderStatus.FAILED } : o
      ));
    }
  };

  const handleClosePosition = async (id: string) => {
    // Find in both real and local positions
    const allPositions = [...realPositions, ...localPositions];
    const pos = allPositions.find(p => p.id === id);
    
    if (!pos) return;
    
    console.log('Closing position:', pos);
    toast.loading('Preparing to close position...', { id: 'close-position' });
    
    try {
      await closePosition({
        market: CONTRACTS.market as `0x${string}`,
        collateralToken: CONTRACTS.usdc as `0x${string}`,
        isLong: pos.side === MarketSide.LONG,
        sizeDeltaUsd: pos.size.toString(),
      });
      
      toast.dismiss('close-position');
      
      // Remove from local positions optimistically
      setLocalPositions(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Close position failed:', error);
      toast.dismiss('close-position');
      // Error toast handled by useClosePosition hook
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Toast Notifications */}
      <Toaster position="top-right" />
      
      <div className="col-span-12 xl:col-span-9 space-y-6">
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-center">
            {/* Oracle Price */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <span className="text-sm font-black text-indigo-400">OR</span>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Oracle Price</div>
                <div className="text-sm font-bold text-white tabular-nums">${ethPrice.toLocaleString()}</div>
              </div>
            </div>

            {/* Index Price */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <span className="text-sm font-black text-blue-400">IX</span>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Index Price</div>
                <div className="text-sm font-bold text-white tabular-nums">${ethPrice.toLocaleString()}</div>
              </div>
            </div>

            {/* 24h Change */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <span className="text-sm font-black text-emerald-400">24h</span>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">24H Change</div>
                <div className="text-sm font-bold text-emerald-400 tabular-nums">+1.84%</div>
              </div>
            </div>

            {/* Funding Rate */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <span className="text-sm font-black text-purple-400">FR</span>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Funding Rate</div>
                <div className="text-sm font-bold text-white tabular-nums">0.0008% / 1h</div>
              </div>
            </div>

            {/* Execution Fee */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <span className="text-sm font-black text-amber-400">EF</span>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Execution Fee</div>
                <div className="text-sm font-bold text-white tabular-nums">0.015 HNC</div>
                <div className="text-[9px] text-gray-600">Keeper</div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-[480px] bg-[#111827] border border-gray-800 rounded-xl overflow-hidden relative">
          <ChartView price={ethPrice} liqPrice={positions.length > 0 ? positions[0].liqPrice : null} />
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
          onOpenOrder={handleOpenOrder} 
          isWalletConnected={chainState.isConnected}
          isCreatingOrder={isCreating}
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
