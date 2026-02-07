'use client';

import { useEffect, useRef, memo, useState, useCallback } from 'react';

interface Position {
  id: number;
  entryPrice: number;
  direction: 'CALL' | 'PUT';
  takeProfit?: number;
  stopLoss?: number;
}

interface TradingViewChartProps {
  symbol: string;
  theme?: 'dark' | 'light';
  currentPrice?: number;
  positions?: Position[];
  onUpdatePosition?: (id: number, updates: { takeProfit?: number; stopLoss?: number }) => void;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function TradingViewChart({
  symbol,
  theme = 'dark',
  currentPrice,
  positions = [],
  onUpdatePosition
}: TradingViewChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  // Chart interaction state
  const [offset, setOffset] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragType, setDragType] = useState<'pan' | 'tp' | 'sl' | null>(null);
  const [dragPositionId, setDragPositionId] = useState<number | null>(null);
  const [localPositions, setLocalPositions] = useState<Position[]>([]);

  // Sync positions
  useEffect(() => {
    setLocalPositions(positions);
  }, [positions]);

  // Fetch historical data and subscribe to live updates
  useEffect(() => {
    const APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || '1089';
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        ticks_history: symbol,
        end: 'latest',
        count: 200,
        style: 'candles',
        granularity: 60,
      }));

      ws.send(JSON.stringify({
        ticks: symbol,
        subscribe: 1,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.candles) {
        const newCandles = data.candles.map((c: any) => ({
          time: c.epoch,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candlesRef.current = newCandles;
        setCandles(newCandles);
      }

      if (data.tick) {
        const tick = data.tick;
        const currentCandles = [...candlesRef.current];

        if (currentCandles.length > 0) {
          const lastCandle = currentCandles[currentCandles.length - 1];
          const tickMinute = Math.floor(tick.epoch / 60) * 60;
          const lastCandleMinute = Math.floor(lastCandle.time / 60) * 60;

          if (tickMinute === lastCandleMinute) {
            lastCandle.close = tick.quote;
            lastCandle.high = Math.max(lastCandle.high, tick.quote);
            lastCandle.low = Math.min(lastCandle.low, tick.quote);
          } else {
            currentCandles.push({
              time: tick.epoch,
              open: tick.quote,
              high: tick.quote,
              low: tick.quote,
              close: tick.quote,
            });
            if (currentCandles.length > 200) {
              currentCandles.shift();
            }
          }
          candlesRef.current = currentCandles;
          setCandles([...currentCandles]);
        }
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ forget_all: 'ticks' }));
        ws.close();
      }
    };
  }, [symbol]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Calculate visible candles and price range
  const getChartParams = useCallback(() => {
    const padding = { top: 20, right: 70, bottom: 30, left: 10 };
    const chartWidth = dimensions.width - padding.left - padding.right;
    const chartHeight = dimensions.height - padding.top - padding.bottom;

    const visibleCandles = Math.floor(50 / zoom);
    const startIdx = Math.max(0, candles.length - visibleCandles - offset);
    const endIdx = Math.min(candles.length, startIdx + visibleCandles);
    const visible = candles.slice(startIdx, endIdx);

    if (visible.length === 0) {
      return { padding, chartWidth, chartHeight, visible: [], minPrice: 0, maxPrice: 0, priceRange: 1 };
    }

    const prices = visible.flatMap(c => [c.high, c.low]);
    // Include position prices in range
    localPositions.forEach(pos => {
      prices.push(pos.entryPrice);
      if (pos.takeProfit) prices.push(pos.takeProfit);
      if (pos.stopLoss) prices.push(pos.stopLoss);
    });
    if (currentPrice) prices.push(currentPrice);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    return { padding, chartWidth, chartHeight, visible, minPrice, maxPrice, priceRange };
  }, [candles, dimensions, offset, zoom, localPositions, currentPrice]);

  // Convert price to Y coordinate
  const priceToY = useCallback((price: number, params: ReturnType<typeof getChartParams>) => {
    const { padding, chartHeight, minPrice, priceRange } = params;
    const pricePadding = priceRange * 0.1;
    return padding.top + chartHeight - ((price - minPrice + pricePadding) / (priceRange + pricePadding * 2)) * chartHeight;
  }, []);

  // Convert Y coordinate to price
  const yToPrice = useCallback((y: number, params: ReturnType<typeof getChartParams>) => {
    const { padding, chartHeight, minPrice, priceRange } = params;
    const pricePadding = priceRange * 0.1;
    return minPrice - pricePadding + (1 - (y - padding.top) / chartHeight) * (priceRange + pricePadding * 2);
  }, []);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const params = getChartParams();

    // Check if clicking on a TP/SL line
    for (const pos of localPositions) {
      if (pos.takeProfit) {
        const tpY = priceToY(pos.takeProfit, params);
        if (Math.abs(y - tpY) < 8 && x > params.padding.left && x < dimensions.width - params.padding.right) {
          setDragType('tp');
          setDragPositionId(pos.id);
          setIsDragging(true);
          return;
        }
      }
      if (pos.stopLoss) {
        const slY = priceToY(pos.stopLoss, params);
        if (Math.abs(y - slY) < 8 && x > params.padding.left && x < dimensions.width - params.padding.right) {
          setDragType('sl');
          setDragPositionId(pos.id);
          setIsDragging(true);
          return;
        }
      }
    }

    // Otherwise, start panning
    setDragType('pan');
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  }, [getChartParams, localPositions, priceToY, dimensions]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (dragType === 'pan') {
      const dx = e.clientX - dragStart.x;
      const sensitivity = 0.5 / zoom;
      setOffset(prev => Math.max(0, Math.min(candles.length - 10, prev + dx * sensitivity)));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if ((dragType === 'tp' || dragType === 'sl') && dragPositionId !== null) {
      const y = e.clientY - rect.top;
      const params = getChartParams();
      const newPrice = yToPrice(y, params);

      setLocalPositions(prev => prev.map(pos => {
        if (pos.id === dragPositionId) {
          if (dragType === 'tp') {
            return { ...pos, takeProfit: newPrice };
          } else {
            return { ...pos, stopLoss: newPrice };
          }
        }
        return pos;
      }));
    }
  }, [isDragging, dragType, dragStart, dragPositionId, zoom, candles.length, getChartParams, yToPrice]);

  const handleMouseUp = useCallback(() => {
    if (dragType === 'tp' || dragType === 'sl') {
      const pos = localPositions.find(p => p.id === dragPositionId);
      if (pos && onUpdatePosition) {
        onUpdatePosition(pos.id, {
          takeProfit: pos.takeProfit,
          stopLoss: pos.stopLoss,
        });
      }
    }
    setIsDragging(false);
    setDragType(null);
    setDragPositionId(null);
  }, [dragType, dragPositionId, localPositions, onUpdatePosition]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(5, prev * delta)));
  }, []);

  // Double click to add TP/SL
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (localPositions.length === 0) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const y = e.clientY - rect.top;
    const params = getChartParams();
    const clickPrice = yToPrice(y, params);

    // Find the most recent position
    const pos = localPositions[localPositions.length - 1];
    if (!pos) return;

    // Determine if it should be TP or SL based on position direction and click location
    if (pos.direction === 'CALL') {
      if (clickPrice > pos.entryPrice && !pos.takeProfit) {
        setLocalPositions(prev => prev.map(p =>
          p.id === pos.id ? { ...p, takeProfit: clickPrice } : p
        ));
        onUpdatePosition?.(pos.id, { takeProfit: clickPrice });
      } else if (clickPrice < pos.entryPrice && !pos.stopLoss) {
        setLocalPositions(prev => prev.map(p =>
          p.id === pos.id ? { ...p, stopLoss: clickPrice } : p
        ));
        onUpdatePosition?.(pos.id, { stopLoss: clickPrice });
      }
    } else {
      if (clickPrice < pos.entryPrice && !pos.takeProfit) {
        setLocalPositions(prev => prev.map(p =>
          p.id === pos.id ? { ...p, takeProfit: clickPrice } : p
        ));
        onUpdatePosition?.(pos.id, { takeProfit: clickPrice });
      } else if (clickPrice > pos.entryPrice && !pos.stopLoss) {
        setLocalPositions(prev => prev.map(p =>
          p.id === pos.id ? { ...p, stopLoss: clickPrice } : p
        ));
        onUpdatePosition?.(pos.id, { stopLoss: clickPrice });
      }
    }
  }, [localPositions, getChartParams, yToPrice, onUpdatePosition]);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0 || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const params = getChartParams();
    const { padding, chartWidth, chartHeight, visible, minPrice, maxPrice, priceRange } = params;

    if (visible.length === 0) return;

    const width = dimensions.width;
    const height = dimensions.height;

    // Clear canvas
    ctx.fillStyle = theme === 'dark' ? '#0b0e11' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const pricePadding = priceRange * 0.1;
    const scaleY = (price: number) => priceToY(price, params);

    const candleWidth = Math.max(3, (chartWidth / visible.length) * 0.7);
    const candleGap = chartWidth / visible.length;

    // Draw grid lines
    ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;

    const gridLines = 6;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const price = maxPrice + pricePadding - ((priceRange + pricePadding * 2) / gridLines) * i;
      ctx.fillStyle = theme === 'dark' ? '#848e9c' : '#666';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(price.toFixed(2), width - padding.right + 5, y + 3);
    }

    // Draw candles
    visible.forEach((candle, i) => {
      const x = padding.left + i * candleGap + candleGap / 2;
      const isGreen = candle.close >= candle.open;

      ctx.strokeStyle = isGreen ? '#0ecb81' : '#f6465d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, scaleY(candle.high));
      ctx.lineTo(x, scaleY(candle.low));
      ctx.stroke();

      const bodyTop = scaleY(Math.max(candle.open, candle.close));
      const bodyBottom = scaleY(Math.min(candle.open, candle.close));
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);

      ctx.fillStyle = isGreen ? '#0ecb81' : '#f6465d';
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // Draw position lines
    localPositions.forEach(pos => {
      // Entry line
      const entryY = scaleY(pos.entryPrice);
      ctx.strokeStyle = pos.direction === 'CALL' ? '#0ecb81' : '#f6465d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();

      // Entry label
      ctx.fillStyle = pos.direction === 'CALL' ? '#0ecb81' : '#f6465d';
      ctx.fillRect(width - padding.right, entryY - 10, 65, 20);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(pos.entryPrice.toFixed(2), width - padding.right + 5, entryY + 4);

      // Take Profit line
      if (pos.takeProfit) {
        const tpY = scaleY(pos.takeProfit);
        ctx.strokeStyle = '#00bcd4';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(padding.left, tpY);
        ctx.lineTo(width - padding.right, tpY);
        ctx.stroke();
        ctx.setLineDash([]);

        // TP label
        ctx.fillStyle = '#00bcd4';
        ctx.fillRect(padding.left, tpY - 10, 50, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText('TP', padding.left + 5, tpY + 4);

        ctx.fillStyle = '#00bcd4';
        ctx.fillRect(width - padding.right, tpY - 10, 65, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(pos.takeProfit.toFixed(2), width - padding.right + 5, tpY + 4);
      }

      // Stop Loss line
      if (pos.stopLoss) {
        const slY = scaleY(pos.stopLoss);
        ctx.strokeStyle = '#ff5722';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(padding.left, slY);
        ctx.lineTo(width - padding.right, slY);
        ctx.stroke();
        ctx.setLineDash([]);

        // SL label
        ctx.fillStyle = '#ff5722';
        ctx.fillRect(padding.left, slY - 10, 50, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText('SL', padding.left + 5, slY + 4);

        ctx.fillStyle = '#ff5722';
        ctx.fillRect(width - padding.right, slY - 10, 65, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(pos.stopLoss.toFixed(2), width - padding.right + 5, slY + 4);
      }
    });

    // Draw current price line
    if (currentPrice) {
      const priceY = scaleY(currentPrice);
      ctx.strokeStyle = '#f0b90b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, priceY);
      ctx.lineTo(width - padding.right, priceY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#f0b90b';
      ctx.fillRect(width - padding.right, priceY - 10, 65, 20);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(currentPrice.toFixed(2), width - padding.right + 5, priceY + 4);
    }

  }, [candles, dimensions, theme, currentPrice, offset, zoom, localPositions, getChartParams, priceToY]);

  // Update cursor based on hover
  const getCursor = () => {
    if (isDragging) {
      return dragType === 'pan' ? 'grabbing' : 'ns-resize';
    }
    return 'crosshair';
  };

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        background: theme === 'dark' ? '#0b0e11' : '#fff',
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: getCursor(),
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      />
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          color: theme === 'dark' ? '#848e9c' : '#666',
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          pointerEvents: 'none',
        }}
      >
        {symbol} • 1m
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 12,
          color: theme === 'dark' ? '#5a6270' : '#999',
          fontSize: '10px',
          fontFamily: 'Inter, sans-serif',
          pointerEvents: 'none',
        }}
      >
        Scroll to zoom • Drag to pan • Double-click to add TP/SL
      </div>
    </div>
  );
}

export default memo(TradingViewChart);
