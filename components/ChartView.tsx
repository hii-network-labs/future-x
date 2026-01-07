
import React, { useEffect, useState, useRef, useMemo } from 'react';

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
}

interface ChartViewProps {
  price: number;
  liqPrice: number | null;
  symbol?: string;
}

const ChartView: React.FC<ChartViewProps> = ({ price, liqPrice, symbol }) => {
  const baseUrl = import.meta.env.VITE_TRADINGVIEW_URL || 'https://tv-gmx.teknix.dev/';
  
  // Append symbol if provided
  const chartUrl = symbol ? `${baseUrl}?symbol=${symbol}` : baseUrl;
  
  return (
    <div className="w-full h-full bg-[#0C111A] overflow-hidden">
      <iframe 
        src={chartUrl}
        className="w-full h-full border-none block"
        title="TradingView Chart"
        allow="clipboard-write; fullscreen"
        scrolling="no"
        style={{ overflow: 'hidden' }}
      />
    </div>
  );
};

export default ChartView;
