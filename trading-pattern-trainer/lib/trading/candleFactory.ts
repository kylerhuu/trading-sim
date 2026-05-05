import { Candle, CandlePurpose, Direction } from "./types";
import { randomBetween } from "./random";

const roundPrice = (p: number) => Number(p.toFixed(2));
const std = (n = 1) => (Math.random() - 0.5) * 2 * n;

export function createCandle(params: {
  prevClose: number;
  time: number;
  body: number;
  upperWick: number;
  lowerWick: number;
  volume: number;
  purpose?: CandlePurpose;
  volatility?: number;
  nearbyUpperLevel?: number;
  nearbyLowerLevel?: number;
  metadata?: Candle["metadata"];
}): Candle {
  const {
    prevClose,
    time,
    body,
    upperWick,
    lowerWick,
    volume,
    purpose = "normal",
    volatility = 1,
    nearbyUpperLevel,
    nearbyLowerLevel,
    metadata,
  } = params;
  const open = prevClose + std(0.06);
  const close = open + body;
  const bodyAbs = Math.max(Math.abs(body), 0.02);

  const capByPurpose = () => {
    if (purpose === "displacement") return { min: 0.1, max: 0.4 };
    if (purpose === "doji") return { min: 1.5, max: 2.5 };
    if (purpose === "sweep") return { min: 0.4, max: 3.2 };
    if (purpose === "retest" || purpose === "pullback" || purpose === "chop") return { min: 0.3, max: 1.4 };
    return { min: 0.3, max: 1.2 };
  };
  const cap = capByPurpose();
  let up = Math.min(Math.abs(upperWick), bodyAbs * cap.max * volatility);
  let down = Math.min(Math.abs(lowerWick), bodyAbs * cap.max * volatility);
  up = Math.max(up, bodyAbs * cap.min * randomBetween(0.6, 1.1));
  down = Math.max(down, bodyAbs * cap.min * randomBetween(0.6, 1.1));

  if (purpose === "sweep") {
    // Tie sweep wick to targeted liquidity level with small overshoot.
    const overshoot = randomBetween(0.05, 0.25) * volatility;
    if (nearbyUpperLevel !== undefined) {
      const target = Math.max(open, close, nearbyUpperLevel) + overshoot;
      up = Math.max(0.01, target - Math.max(open, close));
    }
    if (nearbyLowerLevel !== undefined) {
      const target = Math.min(open, close, nearbyLowerLevel) - overshoot;
      down = Math.max(0.01, Math.min(open, close) - target);
    }
  }

  let high = roundPrice(Math.max(open, close) + up);
  let low = roundPrice(Math.min(open, close) - down);
  // OHLC consistency guard.
  high = Math.max(high, open, close);
  low = Math.min(low, open, close);

  // Wick validator and spike guard.
  const upper = high - Math.max(open, close);
  const lower = Math.min(open, close) - low;
  const largestWick = Math.max(upper, lower);
  if (purpose !== "sweep" && largestWick > bodyAbs * 5) {
    const shrink = (bodyAbs * 4.5) / largestWick;
    high = roundPrice(Math.max(open, close) + upper * shrink);
    low = roundPrice(Math.min(open, close) - lower * shrink);
  }
  if (purpose === "normal" && largestWick > bodyAbs * 3) {
    const shrink = (bodyAbs * 2.6) / largestWick;
    high = roundPrice(Math.max(open, close) + upper * shrink);
    low = roundPrice(Math.min(open, close) - lower * shrink);
  }
  // Volume-wick coherence: avoid huge low-volume random spikes.
  const vol = Math.max(20, Math.round(volume));
  if (purpose !== "sweep" && vol < 110 && largestWick > bodyAbs * 2.4) {
    const shrink = (bodyAbs * 2.1) / largestWick;
    high = roundPrice(Math.max(open, close) + upper * shrink);
    low = roundPrice(Math.min(open, close) - lower * shrink);
  }
  if (purpose === "sweep" && vol < 180) {
    // enforce spike behavior for true sweep wicks
    high = roundPrice(Math.max(high, Math.max(open, close) + bodyAbs * 0.8));
    low = roundPrice(Math.min(low, Math.min(open, close) - bodyAbs * 0.8));
  }
  return {
    time,
    open: roundPrice(open),
    close: roundPrice(close),
    high,
    low,
    volume: vol,
    metadata: { ...(metadata ?? {}), purpose },
  };
}

export function createRangeCandle(prevClose: number, time: number, volatility: number): Candle {
  const body = std(0.12) * volatility;
  return createCandle({
    prevClose,
    time,
    body,
    upperWick: randomBetween(0.08, 0.35) * volatility,
    lowerWick: randomBetween(0.08, 0.35) * volatility,
    volume: 90 * randomBetween(0.65, 0.95),
    purpose: Math.abs(body) < 0.03 ? "doji" : "normal",
    volatility,
  });
}

export function createSweepCandle(params: {
  prevClose: number;
  time: number;
  sweepSide: "above" | "below";
  equalHigh: number;
  equalLow: number;
  volatility: number;
}): Candle {
  const c = createCandle({
    prevClose: params.prevClose,
    time: params.time,
    body: std(0.12) * params.volatility,
    upperWick: randomBetween(0.4, 1.0) * params.volatility,
    lowerWick: randomBetween(0.4, 1.0) * params.volatility,
    volume: 170 * randomBetween(1.8, 2.9),
    purpose: "sweep",
    volatility: params.volatility,
    nearbyUpperLevel: params.sweepSide === "above" ? params.equalHigh : undefined,
    nearbyLowerLevel: params.sweepSide === "below" ? params.equalLow : undefined,
    metadata: { liquiditySweep: true, stopHunt: true, purpose: "sweep" },
  });
  if (params.sweepSide === "above") {
    c.high = roundPrice(params.equalHigh + randomBetween(0.55, 1.45) * params.volatility);
    c.close = roundPrice(Math.min(params.equalHigh - randomBetween(0.08, 0.32), c.close));
  } else {
    c.low = roundPrice(params.equalLow - randomBetween(0.55, 1.45) * params.volatility);
    c.close = roundPrice(Math.max(params.equalLow + randomBetween(0.08, 0.32), c.close));
  }
  c.high = roundPrice(Math.max(c.high, c.open, c.close));
  c.low = roundPrice(Math.min(c.low, c.open, c.close));
  return c;
}

export function createDisplacementCandle(
  prevClose: number,
  time: number,
  direction: Direction,
  volatility: number,
  markBos = false,
): Candle {
  const dir = direction === "down" ? -1 : 1;
  return createCandle({
    prevClose,
    time,
    body: dir * randomBetween(0.8, 2.2) * volatility,
    upperWick: randomBetween(0.05, 0.22) * volatility,
    lowerWick: randomBetween(0.05, 0.22) * volatility,
    volume: 220 * randomBetween(2.0, 3.8),
    purpose: "displacement",
    volatility,
    metadata: { imbalance: true, fairValueGap: true, breakOfStructure: markBos || undefined, purpose: "displacement" },
  });
}

export function createPullbackCandle(
  prevClose: number,
  time: number,
  priorDirection: Direction,
  volatility: number,
): Candle {
  const dir = priorDirection === "down" ? 1 : -1;
  return createCandle({
    prevClose,
    time,
    body: dir * randomBetween(0.15, 0.55) * volatility,
    upperWick: randomBetween(0.08, 0.35) * volatility,
    lowerWick: randomBetween(0.08, 0.35) * volatility,
    volume: 125 * randomBetween(0.75, 1.15),
    purpose: "pullback",
    volatility,
    metadata: { purpose: "pullback" },
  });
}
