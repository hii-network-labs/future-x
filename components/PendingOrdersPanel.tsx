
import React from 'react';
import { PendingOrder, OrderStatus } from '../types';

interface PendingOrdersPanelProps {
  orders: PendingOrder[];
  showHeader?: boolean;
}

const PendingOrdersPanel: React.FC<PendingOrdersPanelProps> = ({ orders, showHeader = true }) => {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden">
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="font-bold text-sm uppercase tracking-wider text-gray-400">Activity & Pending Orders</h2>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Side</th>
              <th className="px-6 py-3">Size</th>
              <th className="px-6 py-3">Req. Price</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-600 text-sm">No recent activity</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="text-sm">
                  <td className="px-6 py-4 font-medium text-gray-300">
                    {order.type}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${order.side === 'LONG' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {order.side}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">${order.size.toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-400">${order.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    {order.status === OrderStatus.PENDING ? (
                      <div className="flex items-center space-x-2 text-amber-500 font-bold animate-pulse">
                         <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                        <span>Waiting for Keeper...</span>
                      </div>
                    ) : order.status === OrderStatus.EXECUTED ? (
                      <span className="text-emerald-500 font-bold">✓ Executed</span>
                    ) : (
                      <span className="text-red-500 font-bold">✕ Failed</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 text-[10px] font-bold">
                    {new Date(order.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PendingOrdersPanel;
