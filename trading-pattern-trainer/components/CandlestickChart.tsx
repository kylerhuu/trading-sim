"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  CandlestickData,
  ColorType,
  HistogramData,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import { Candle } from "@/lib/types";

interface CandlestickChartProps {
  candles: Candle[];
}

export function CandlestickChart({ candles }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const candleData = useMemo<CandlestickData[]>(
    () =>
      candles.map((c) => ({
        time: c.time as CandlestickData["time"],
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    [candles],
  );

  const volumeData = useMemo<HistogramData[]>(
    () =>
      candles.map((c) => ({
        time: c.time as HistogramData["time"],
        value: c.volume,
        color: c.close >= c.open ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
      })),
    [candles],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 520,
      layout: {
        background: { type: ColorType.Solid, color: "#0b1020" },
        textColor: "#cbd5e1",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.12)" },
        horzLines: { color: "rgba(148,163,184,0.12)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148,163,184,0.2)",
      },
      timeScale: {
        borderColor: "rgba(148,163,184,0.2)",
      },
      handleScroll: true,
      handleScale: true,
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: true,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
    });
    candlestickSeries.setData(candleData);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      base: 0,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
    });
    volumeSeries.setData(volumeData);

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
      chart.timeScale().fitContent();
    });
    resizeObserver.observe(container);
    chart.timeScale().fitContent();

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candleData, volumeData]);

  return <div ref={containerRef} className="h-[520px] w-full rounded-xl border border-slate-800" />;
}
