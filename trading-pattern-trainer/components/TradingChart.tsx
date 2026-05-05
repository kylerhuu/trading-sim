"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramData,
  HistogramSeries,
  LineSeries,
  SeriesMarker,
} from "lightweight-charts";
import { Candle, ScenarioAnnotation } from "@/lib/trading/types";

interface TradingChartProps {
  candles: Candle[];
  overlayOptions?: {
    showVwap?: boolean;
    showBands?: boolean;
  };
  showTrendLines?: boolean;
  showAnnotations?: boolean;
  annotations?: ScenarioAnnotation[];
}

export function TradingChart({ candles, overlayOptions, showTrendLines = true, showAnnotations = false, annotations = [] }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeValues = useMemo(() => candles.map((c) => c.close), [candles]);
  const maFast = useMemo(
    () =>
      closeValues.map((_, i) => {
        const from = Math.max(0, i - 6);
        const slice = closeValues.slice(from, i + 1);
        const mean = slice.reduce((a, v) => a + v, 0) / slice.length;
        return mean;
      }),
    [closeValues],
  );
  const maSlow = useMemo(
    () =>
      closeValues.map((_, i) => {
        const from = Math.max(0, i - 17);
        const slice = closeValues.slice(from, i + 1);
        const mean = slice.reduce((a, v) => a + v, 0) / slice.length;
        return mean;
      }),
    [closeValues],
  );
  const vwap = useMemo(() => {
    const acc = candles.reduce<{ pv: number; v: number; values: number[] }>(
      (state, c) => {
        const typical = (c.high + c.low + c.close) / 3;
        const pv = state.pv + typical * c.volume;
        const v = state.v + c.volume;
        return { pv, v, values: [...state.values, pv / Math.max(1, v)] };
      },
      { pv: 0, v: 0, values: [] },
    );
    return acc.values;
  }, [candles]);
  const bands = useMemo(() => {
    return closeValues.map((_, i) => {
      const from = Math.max(0, i - 19);
      const slice = closeValues.slice(from, i + 1);
      const mean = slice.reduce((a, v) => a + v, 0) / Math.max(1, slice.length);
      const variance = slice.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, slice.length);
      const std = Math.sqrt(variance);
      return { upper: mean + std * 2, lower: mean - std * 2 };
    });
  }, [closeValues]);
  const trendLines = useMemo(() => {
    if (candles.length < 12) return null;
    const window = candles.slice(Math.max(0, candles.length - 28));
    const n = window.length;
    const xMean = (n - 1) / 2;
    const highMean = window.reduce((a, c) => a + c.high, 0) / n;
    const lowMean = window.reduce((a, c) => a + c.low, 0) / n;
    let numHigh = 0;
    let numLow = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const x = i - xMean;
      numHigh += x * (window[i].high - highMean);
      numLow += x * (window[i].low - lowMean);
      den += x * x;
    }
    const slopeHigh = den === 0 ? 0 : numHigh / den;
    const slopeLow = den === 0 ? 0 : numLow / den;
    const highStart = highMean + slopeHigh * (0 - xMean);
    const highEnd = highMean + slopeHigh * ((n - 1) - xMean);
    const lowStart = lowMean + slopeLow * (0 - xMean);
    const lowEnd = lowMean + slopeLow * ((n - 1) - xMean);
    return {
      startTime: window[0].time,
      endTime: window[n - 1].time,
      highStart,
      highEnd,
      lowStart,
      lowEnd,
    };
  }, [candles]);
  const candleData = useMemo<CandlestickData[]>(
    () => candles.map((c) => ({ time: c.time as CandlestickData["time"], open: c.open, high: c.high, low: c.low, close: c.close })),
    [candles],
  );
  const volumeData = useMemo<HistogramData[]>(
    () => candles.map((c) => ({ time: c.time as HistogramData["time"], value: c.volume, color: c.close >= c.open ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)" })),
    [candles],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 520,
      layout: { background: { type: ColorType.Solid, color: "#0b1020" }, textColor: "#cbd5e1" },
      grid: { vertLines: { color: "rgba(148,163,184,0.12)" }, horzLines: { color: "rgba(148,163,184,0.12)" } },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.2)" },
      timeScale: { borderColor: "rgba(148,163,184,0.2)" },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: true,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
    });
    series.setData(candleData);
    const markersApi = createSeriesMarkers(series, []);

    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "", base: 0 });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    volume.setData(volumeData);

    const fastLine = chart.addSeries(LineSeries, { color: "rgba(56,189,248,0.95)", lineWidth: 2 });
    fastLine.setData(candles.map((c, i) => ({ time: c.time as CandlestickData["time"], value: maFast[i] })));

    const slowLine = chart.addSeries(LineSeries, { color: "rgba(251,191,36,0.9)", lineWidth: 2 });
    slowLine.setData(candles.map((c, i) => ({ time: c.time as CandlestickData["time"], value: maSlow[i] })));

    if (overlayOptions?.showVwap) {
      const vwapLine = chart.addSeries(LineSeries, { color: "rgba(99,102,241,0.8)", lineWidth: 1 });
      vwapLine.setData(candles.map((c, i) => ({ time: c.time as CandlestickData["time"], value: vwap[i] })));
    }
    if (overlayOptions?.showBands) {
      const upper = chart.addSeries(LineSeries, { color: "rgba(244,114,182,0.65)", lineWidth: 1 });
      const lower = chart.addSeries(LineSeries, { color: "rgba(244,114,182,0.65)", lineWidth: 1 });
      upper.setData(candles.map((c, i) => ({ time: c.time as CandlestickData["time"], value: bands[i].upper })));
      lower.setData(candles.map((c, i) => ({ time: c.time as CandlestickData["time"], value: bands[i].lower })));
    }
    if (showTrendLines && trendLines) {
      const upperTrend = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.75)", lineWidth: 1 });
      const lowerTrend = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.75)", lineWidth: 1 });
      upperTrend.setData([
        { time: trendLines.startTime as CandlestickData["time"], value: trendLines.highStart },
        { time: trendLines.endTime as CandlestickData["time"], value: trendLines.highEnd },
      ]);
      lowerTrend.setData([
        { time: trendLines.startTime as CandlestickData["time"], value: trendLines.lowStart },
        { time: trendLines.endTime as CandlestickData["time"], value: trendLines.lowEnd },
      ]);
    }

    if (showAnnotations) {
      const markers = annotations.filter((a) => a.time).map(
        (a): SeriesMarker<CandlestickData["time"]> => ({
          time: a.time as CandlestickData["time"],
          position: a.type === "liquidity-sweep" || a.type === "trap" ? "aboveBar" : "belowBar",
          shape: a.type === "liquidity-sweep" ? "arrowDown" : a.type === "break-of-structure" ? "arrowUp" : "circle",
          color: a.type === "liquidity-sweep" ? "#f59e0b" : a.type === "break-of-structure" ? "#22c55e" : "#38bdf8",
          text: a.label,
        }),
      );
      markersApi.setMarkers(markers);
      annotations
        .filter((a) => a.price && (a.type === "support" || a.type === "resistance" || a.type === "entry" || a.type === "invalidation"))
        .forEach((line) => {
          series.createPriceLine({
            price: line.price!,
            color: line.type === "support" ? "rgba(34,197,94,0.7)" : line.type === "resistance" ? "rgba(239,68,68,0.7)" : line.type === "entry" ? "rgba(14,165,233,0.8)" : "rgba(244,114,182,0.8)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: line.label,
          });
        });
    } else {
      markersApi.setMarkers([]);
    }

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
  }, [annotations, bands, candleData, candles, maFast, maSlow, overlayOptions?.showBands, overlayOptions?.showVwap, showAnnotations, showTrendLines, trendLines, volumeData, vwap]);

  return <div ref={containerRef} className="h-[520px] w-full rounded-xl border border-slate-800" />;
}
