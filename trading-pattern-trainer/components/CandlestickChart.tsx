"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  CandlestickData,
  ColorType,
  HistogramData,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  SeriesMarker,
} from "lightweight-charts";
import { Candle, ScenarioAnnotation } from "@/lib/types";

interface CandlestickChartProps {
  candles: Candle[];
  showAnnotations?: boolean;
  annotations?: ScenarioAnnotation[];
}

export function CandlestickChart({ candles, showAnnotations = false, annotations = [] }: CandlestickChartProps) {
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
    const markersApi = createSeriesMarkers(candlestickSeries, []);

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

    if (showAnnotations) {
      const markers = annotations
        .filter((a) => a.time)
        .map((a): SeriesMarker<CandlestickData["time"]> => {
          const position: "aboveBar" | "belowBar" =
            a.type === "liquidity-sweep" || a.type === "trap" ? "aboveBar" : "belowBar";
          const shape: "arrowDown" | "arrowUp" | "circle" =
            a.type === "liquidity-sweep" ? "arrowDown" : a.type === "break-of-structure" ? "arrowUp" : "circle";
          return {
            time: a.time as CandlestickData["time"],
            position,
            shape,
            color:
              a.type === "liquidity-sweep"
                ? "#f59e0b"
                : a.type === "break-of-structure"
                  ? "#22c55e"
                  : a.type === "change-of-character"
                    ? "#a78bfa"
                    : "#38bdf8",
            text: a.label,
          };
        });
      markersApi.setMarkers(markers);

      annotations
        .filter((a) => a.price && (a.type === "support" || a.type === "resistance" || a.type === "entry" || a.type === "invalidation"))
        .forEach((line) => {
          candlestickSeries.createPriceLine({
            price: line.price!,
            color:
              line.type === "support"
                ? "rgba(34,197,94,0.7)"
                : line.type === "resistance"
                  ? "rgba(239,68,68,0.7)"
                  : line.type === "entry"
                    ? "rgba(14,165,233,0.8)"
                    : "rgba(244,114,182,0.8)",
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
  }, [annotations, candleData, showAnnotations, volumeData]);

  return <div ref={containerRef} className="h-[520px] w-full rounded-xl border border-slate-800" />;
}
