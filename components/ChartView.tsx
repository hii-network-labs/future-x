
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
  const [candles, setCandles] = useState<Candle[]>([]);
  const [displayRange, setDisplayRange] = useState({ min: 0, max: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(null);

  // Initialize and update candles
  useEffect(() => {
    const initialCandles: Candle[] = [];
    let lastClose = price;
    const now = Date.now();
    
    for (let i = 0; i < 60; i++) {
      const open = lastClose;
      const volatility = 12;
      const move = (Math.random() - 0.5) * volatility;
      const close = open + move;
      const high = Math.max(open, close) + Math.random() * 4;
      const low = Math.min(open, close) - Math.random() * 4;
      
      initialCandles.push({
        open, high, low, close,
        timestamp: now - (60 - i) * 60000,
      });
      lastClose = close;
    }
    setCandles(initialCandles);

    const interval = setInterval(() => {
      setCandles(prev => {
        const lastCandle = prev[prev.length - 1];
        const newOpen = lastCandle.close;
        const volatility = 8;
        const move = (Math.random() - 0.5) * volatility;
        const newClose = newOpen + move;
        const newHigh = Math.max(newOpen, newClose) + Math.random() * 3;
        const newLow = Math.min(newOpen, newClose) - Math.random() * 3;

        return [...prev.slice(1), {
          open: newOpen, high: newHigh, low: newLow, close: newClose,
          timestamp: Date.now(),
        }];
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []); // ✅ Only run once on mount - don't reinitialize when price changes!

  // Calculate display range directly from candles (no slow lerp)
  const { min, max } = useMemo(() => {
    if (candles.length === 0) {
      return { min: price * 0.98, max: price * 1.02 };
    }

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    let targetMax = Math.max(...highs);
    let targetMin = Math.min(...lows);

    // Only include liquidation price if it's close to current range
    // This prevents the chart from zooming out too much when liq price is far
    if (liqPrice !== null) {
      const candleRange = targetMax - targetMin;
      const liqDistance = Math.abs(liqPrice - price);
      
      // Only include if liq price is within 50% of current range from price
      if (liqDistance < candleRange * 2) {
        targetMax = Math.max(targetMax, liqPrice);
        targetMin = Math.min(targetMin, liqPrice);
      }
    }

    // Minimum range to prevent flat chart
    const rawRange = targetMax - targetMin;
    const minRange = price * 0.015; // 1.5% minimum range
    
    if (rawRange < minRange) {
      const center = (targetMax + targetMin) / 2;
      targetMax = center + minRange / 2;
      targetMin = center - minRange / 2;
    }

    // Add 15% padding on top and bottom
    const range = targetMax - targetMin;
    const padding = range * 0.15;

    return {
      min: targetMin - padding,
      max: targetMax + padding,
    };
  }, [candles, liqPrice, price]);

  const range = max - min || 1;

  const getX = (i: number) => (i / (candles.length - 1)) * 100;
  const getY = (v: number) => 100 - ((v - min) / range) * 100;

  const candleWidth = 100 / (candles.length * 1.5);
  
  // Use the last candle's close price for the pill to match chart data
  const displayPrice = candles.length > 0 ? candles[candles.length - 1].close : price;
  const currentPriceY = getY(displayPrice);

  return (
    <div className="w-full h-full relative bg-[#0C111A] overflow-hidden" ref={canvasRef}>
      {/* Header Overlays */}
      <div className="absolute top-4 left-6 z-20 flex items-center space-x-6">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Market State</span>
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-bold text-white tracking-tighter tabular-nums">
              ${displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-emerald-400 font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              LIVE
            </span>
          </div>
        </div>
        
        <div className="hidden lg:flex space-x-6 border-l border-gray-800 pl-6 h-10 items-center">
          <OHLCLabel label="O" value={candles[candles.length - 1]?.open} />
          <OHLCLabel label="H" value={candles[candles.length - 1]?.high} />
          <OHLCLabel label="L" value={candles[candles.length - 1]?.low} />
          <OHLCLabel label="C" value={candles[candles.length - 1]?.close} />
        </div>
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(#4B5563 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      </div>

      {/* Chart SVG */}
      <svg className="w-full h-full pr-20 py-16" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Dynamic Y-Grid */}
        {[0, 25, 50, 75, 100].map(v => (
          <line key={`g-${v}`} x1="0" y1={v} x2="100" y2={v} stroke="#1F2937" strokeWidth="0.05" />
        ))}

        {/* Candlesticks */}
        {candles.map((candle, i) => {
          const x = getX(i);
          const isBullish = candle.close >= candle.open;
          const color = isBullish ? '#34D399' : '#F87171';
          const top = getY(Math.max(candle.open, candle.close));
          const bottom = getY(Math.min(candle.open, candle.close));
          const height = Math.max(0.3, bottom - top);
          const highY = getY(candle.high);
          const lowY = getY(candle.low);

          return (
            <g key={`c-${i}`} className="transition-opacity duration-300">
              <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="0.12" />
              <rect 
                x={x - candleWidth / 2} y={top} width={candleWidth} height={height} 
                fill={color} opacity={isBullish ? 0.7 : 0.85} rx="0.1"
              />
            </g>
          );
        })}

        {/* Liquidation Threshold (Crucial UX) */}
        {liqPrice && (
          <g>
            <line x1="0" y1={getY(liqPrice)} x2="100" y2={getY(liqPrice)} stroke="#EF4444" strokeWidth="0.15" strokeDasharray="1.5 1.5" />
            <rect x="0" y={getY(liqPrice) - 1.2} width="14" height="2.4" fill="#EF4444" opacity="0.15" rx="0.2" />
            <text x="1" y={getY(liqPrice) + 0.4} fill="#EF4444" fontSize="1.4" fontWeight="bold" className="tracking-tighter uppercase">Liquidation</text>
          </g>
        )}

        {/* Current Price Tracker (Horizontal) */}
        <line x1="0" y1={currentPriceY} x2="100" y2={currentPriceY} stroke="#34D399" strokeWidth="0.08" strokeDasharray="1 1" opacity="0.5" />
      </svg>

      {/* Y-Axis Labeling */}
      <div className="absolute right-0 top-16 bottom-16 w-20 bg-[#111827]/95 backdrop-blur-lg border-l border-gray-800 flex flex-col justify-between text-[10px] text-gray-500 font-bold px-3 select-none">
        <div className="flex flex-col space-y-1">
          <span className="text-gray-400 font-extrabold uppercase tracking-tighter text-[9px]">High</span>
          <span>${max.toFixed(2)}</span>
        </div>
        <span>${(min + range * 0.75).toFixed(2)}</span>
        <div className="text-emerald-400 font-medium border-l-2 border-emerald-500/50 pl-2">
          ${(min + range * 0.5).toFixed(2)}
        </div>
        <span>${(min + range * 0.25).toFixed(2)}</span>
        <div className="flex flex-col space-y-1">
          <span>${min.toFixed(2)}</span>
          <span className="text-gray-400 font-extrabold uppercase tracking-tighter text-[9px]">Low</span>
        </div>
        
        {/* Real-time Price Pill */}
        <div 
          className="absolute right-0 px-3 py-1.5 bg-emerald-500 text-black font-black text-[11px] tabular-nums shadow-[0_0_20px_rgba(52,211,153,0.3)] z-30 flex items-center transition-all duration-300 ease-out"
          style={{ 
            top: `${currentPriceY}%`,
            transform: 'translateY(-50%)'
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse mr-2"></div>
          {displayPrice.toFixed(2)}
        </div>
      </div>
    </div>
  );
};

const OHLCLabel: React.FC<{ label: string, value?: number }> = ({ label, value }) => (
  <div className="flex items-center space-x-2">
    <span className="text-[10px] text-gray-600 font-black">{label}</span>
    <span className="text-xs font-bold text-gray-300 tabular-nums">
      {value ? value.toFixed(2) : '---'}
    </span>
  </div>
);

export default ChartView;
