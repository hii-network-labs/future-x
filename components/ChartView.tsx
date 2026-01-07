
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
}

const ChartView: React.FC<ChartViewProps> = ({ price, liqPrice }) => {
  const chartUrl = import.meta.env.VITE_TRADINGVIEW_URL || 'https://tv-gmx.teknix.dev/';
  
  return (
    <div className="w-full h-full bg-[#0C111A] overflow-hidden">
      <iframe 
        src={chartUrl}
        className="w-full h-full border-none"
        title="TradingView Chart"
        allow="clipboard-write; fullscreen"
      />
    </div>
  );
};

export default ChartView;
