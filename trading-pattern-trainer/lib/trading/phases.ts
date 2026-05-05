import { Candle, Direction } from "./types";
import { randomBetween, randomInt } from "./random";
import {
  createDisplacementCandle,
  createPullbackCandle,
  createRangeCandle,
  createSweepCandle,
} from "./candleFactory";

export function generateRangePhase(count: number, startPrice: number, startTime: number, volatility: number) {
  const candles: Candle[] = [];
  let prev = startPrice;
  let t = startTime;
  let rangeHigh = Number.NEGATIVE_INFINITY;
  let rangeLow = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const c = createRangeCandle(prev, t, volatility);
    candles.push(c);
    rangeHigh = Math.max(rangeHigh, c.high);
    rangeLow = Math.min(rangeLow, c.low);
    prev = c.close;
    t += 60;
  }
  return { candles, rangeHigh, rangeLow };
}

export function generateLiquidityBuildPhase(
  count: number,
  startPrice: number,
  startTime: number,
  rangeHigh: number,
  rangeLow: number,
  volatility: number,
) {
  const candles: Candle[] = [];
  const equalHigh = rangeHigh + randomBetween(0.08, 0.2);
  const equalLow = rangeLow - randomBetween(0.08, 0.2);
  let prev = startPrice;
  let t = startTime;
  for (let i = 0; i < count; i++) {
    const c = createRangeCandle(prev, t, volatility * 1.05);
    if (i % 2 === 0) c.high = Number((equalHigh + randomBetween(-0.05, 0.05)).toFixed(2));
    if (i % 3 === 0) c.low = Number((equalLow + randomBetween(-0.05, 0.05)).toFixed(2));
    c.high = Number(Math.max(c.high, c.open, c.close).toFixed(2));
    c.low = Number(Math.min(c.low, c.open, c.close).toFixed(2));
    candles.push(c);
    prev = c.close;
    t += 60;
  }
  return { candles, equalHigh, equalLow };
}

export function generateSweepPhase(
  startPrice: number,
  startTime: number,
  sweepSide: "above" | "below",
  equalHigh: number,
  equalLow: number,
  volatility: number,
) {
  const candle = createSweepCandle({ prevClose: startPrice, time: startTime, sweepSide, equalHigh, equalLow, volatility });
  const sweepPrice = sweepSide === "above" ? candle.high : candle.low;
  return { candle, sweepPrice };
}

export function generateDisplacementPhase(
  count: number,
  startPrice: number,
  startTime: number,
  direction: Direction,
  volatility: number,
) {
  const candles: Candle[] = [];
  let prev = startPrice;
  let t = startTime;
  for (let i = 0; i < count; i++) {
    const c = createDisplacementCandle(prev, t, direction, volatility, i === 0);
    candles.push(c);
    prev = c.close;
    t += 60;
  }
  return candles;
}

export function generatePullbackPhase(
  count: number,
  startPrice: number,
  startTime: number,
  priorDirection: Direction,
  volatility: number,
) {
  const candles: Candle[] = [];
  let prev = startPrice;
  let t = startTime;
  for (let i = 0; i < count; i++) {
    const c = createPullbackCandle(prev, t, priorDirection, volatility);
    candles.push(c);
    prev = c.close;
    t += 60;
  }
  return candles;
}

export function generateOutcomePhase(
  count: number,
  startPrice: number,
  startTime: number,
  direction: Direction,
  volatility: number,
) {
  const candles: Candle[] = [];
  let prev = startPrice;
  let t = startTime;
  for (let i = 0; i < count; i++) {
    const dir =
      direction === "sideways" ? (Math.random() > 0.5 ? "up" : "down") : direction;
    const c = createDisplacementCandle(
      prev,
      t,
      dir,
      randomBetween(0.28, 0.62) * volatility,
      false,
    );
    c.volume = Math.round(c.volume * randomBetween(0.6, 1.2));
    candles.push(c);
    prev = c.close;
    t += 60;
  }
  if (candles.length > 0 && direction === "sideways") {
    const mid = candles[randomInt(0, candles.length - 1)];
    mid.metadata = { ...(mid.metadata ?? {}), trap: true };
  }
  return candles;
}

export function generateReclaimPhase(params: {
  count: number;
  startPrice: number;
  startTime: number;
  brokenLevel: number;
  direction: Direction;
  volatility: number;
}) {
  const { count, startPrice, startTime, brokenLevel, direction, volatility } = params;
  const candles: Candle[] = [];
  let prev = startPrice;
  let t = startTime;
  for (let i = 0; i < count; i++) {
    const c = createPullbackCandle(prev, t, direction === "up" ? "down" : "up", volatility * 0.8);
    candles.push(c);
    prev = c.close;
    t += 60;
  }
  const last = candles[candles.length - 1];
  if (last) {
    if (direction === "up") {
      last.close = Math.max(last.close, Number((brokenLevel + randomBetween(0.05, 0.35)).toFixed(2)));
      last.high = Math.max(last.high, last.close + randomBetween(0.05, 0.2));
    } else {
      last.close = Math.min(last.close, Number((brokenLevel - randomBetween(0.05, 0.35)).toFixed(2)));
      last.low = Math.min(last.low, last.close - randomBetween(0.05, 0.2));
    }
  }
  return candles;
}

export function generateRetestPhase(params: {
  count: number;
  startPrice: number;
  startTime: number;
  retestLevel: number;
  direction: Direction;
  volatility: number;
}) {
  const { count, startPrice, startTime, retestLevel, direction, volatility } = params;
  const candles: Candle[] = [];
  let prev = startPrice;
  let t = startTime;
  for (let i = 0; i < count; i++) {
    const c = createRangeCandle(prev, t, volatility * randomBetween(0.7, 0.95));
    // mixed red/green around retest level with wicks
    c.open = Number((prev + randomBetween(-0.12, 0.12)).toFixed(2));
    c.close = Number((c.open + randomBetween(-0.18, 0.18)).toFixed(2));
    const rej = randomBetween(0.08, 0.32);
    if (direction === "up") {
      c.low = Math.min(c.low, Number((retestLevel - rej).toFixed(2)));
    } else {
      c.high = Math.max(c.high, Number((retestLevel + rej).toFixed(2)));
    }
    c.high = Number(Math.max(c.high, c.open, c.close).toFixed(2));
    c.low = Number(Math.min(c.low, c.open, c.close).toFixed(2));
    c.volume = Math.round(c.volume * randomBetween(0.6, 0.9));
    c.metadata = { ...(c.metadata ?? {}), purpose: "retest" };
    candles.push(c);
    prev = c.close;
    t += 60;
  }
  return candles;
}

export function generateHigherLowPhase(
  startPrice: number,
  startTime: number,
  supportLevel: number,
  volatility: number,
) {
  const candles: Candle[] = [];
  const c1 = createPullbackCandle(startPrice, startTime, "up", volatility * 0.85);
  c1.low = Math.max(c1.low, Number((supportLevel + randomBetween(0.02, 0.25)).toFixed(2)));
  const c2 = createRangeCandle(c1.close, startTime + 60, volatility * 0.7);
  candles.push(c1, c2);
  return candles;
}

export function generateLowerHighPhase(
  startPrice: number,
  startTime: number,
  resistanceLevel: number,
  volatility: number,
) {
  const candles: Candle[] = [];
  const c1 = createPullbackCandle(startPrice, startTime, "down", volatility * 0.85);
  c1.high = Math.min(c1.high, Number((resistanceLevel - randomBetween(0.02, 0.25)).toFixed(2)));
  const c2 = createRangeCandle(c1.close, startTime + 60, volatility * 0.7);
  candles.push(c1, c2);
  return candles;
}

export function generateConsolidationAfterImpulse(
  count: number,
  startPrice: number,
  startTime: number,
  volatility: number,
) {
  const candles: Candle[] = [];
  let prev = startPrice;
  let t = startTime;
  for (let i = 0; i < count; i++) {
    const c = createRangeCandle(prev, t, volatility * 0.6);
    c.volume = Math.round(c.volume * randomBetween(0.55, 0.85));
    c.metadata = { ...(c.metadata ?? {}), purpose: "chop" };
    candles.push(c);
    prev = c.close;
    t += 60;
  }
  return candles;
}

export function generateFailedRetestPhase(params: {
  count: number;
  startPrice: number;
  startTime: number;
  level: number;
  failedDirection: Direction;
  volatility: number;
}) {
  const { count, startPrice, startTime, level, failedDirection, volatility } = params;
  const candles: Candle[] = [];
  let prev = startPrice;
  let t = startTime;
  for (let i = 0; i < count; i++) {
    const dir = failedDirection === "up" ? "down" : "up";
    const c = createDisplacementCandle(prev, t, dir, volatility * randomBetween(0.6, 1.05), i === 0);
    if (dir === "up") c.low = Math.max(c.low, level - randomBetween(0.05, 0.2));
    else c.high = Math.min(c.high, level + randomBetween(0.05, 0.2));
    candles.push(c);
    prev = c.close;
    t += 60;
  }
  return candles;
}
