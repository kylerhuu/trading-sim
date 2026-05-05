import { clamp, randomBetween, randomInt, weightedChoice } from "./random";
import { difficultyCfg, resolveCorrectDirection, scenarioPool, scenarioTagMap } from "./scenarios";
import { Candle, Difficulty, Direction, ExplanationData, IntensityLevel, MacroBias, Scenario, ScenarioAnnotation, ScenarioTag, ScenarioType } from "./types";

const roundPrice = (p: number) => Number(p.toFixed(2));
const EPS = 0.0001;

function clampDirectionBias(value: number): Direction {
  if (value > 0.18) return "up";
  if (value < -0.18) return "down";
  return "sideways";
}

function candleColorRunTooLong(candles: Candle[], limit = 4): boolean {
  let run = 1;
  for (let i = 1; i < candles.length; i++) {
    const prevUp = candles[i - 1].close >= candles[i - 1].open;
    const curUp = candles[i].close >= candles[i].open;
    run = prevUp === curUp ? run + 1 : 1;
    if (run > limit) return true;
  }
  return false;
}

function smoothCurveScore(candles: Candle[]): number {
  if (candles.length < 6) return 0;
  let monotonicSteps = 0;
  let lowRetraceCount = 0;
  for (let i = 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (Math.abs(d) > 0.02) monotonicSteps += 1;
    const retrace = Math.abs(candles[i].close - candles[i - 1].open);
    if (retrace < 0.1) lowRetraceCount += 1;
  }
  return (monotonicSteps + lowRetraceCount) / (candles.length * 2);
}

function hasPullback(candles: Candle[]): boolean {
  const deltas = candles.slice(1).map((c, i) => c.close - candles[i].close);
  if (deltas.length < 6) return true;
  const maxMove = Math.max(...deltas.map((d) => Math.abs(d)));
  const required = maxMove * 0.28;
  for (let i = 1; i < candles.length; i++) {
    const move = candles[i].close - candles[i - 1].close;
    if (Math.abs(move) > required && Math.sign(move) !== Math.sign(deltas[Math.max(0, i - 2)])) return true;
  }
  return false;
}

function hasVolatilityShift(candles: Candle[]): boolean {
  if (candles.length < 8) return true;
  const first = candles.slice(0, Math.floor(candles.length / 2));
  const second = candles.slice(Math.floor(candles.length / 2));
  const avgBody = (arr: Candle[]) => arr.reduce((a, c) => a + Math.abs(c.close - c.open), 0) / arr.length;
  const v1 = avgBody(first);
  const v2 = avgBody(second);
  return Math.max(v1, v2) / Math.max(0.0001, Math.min(v1, v2)) > 1.18;
}

function wickChartValidator(candlesBefore: Candle[], candlesAfter: Candle[], scenarioType: ScenarioType): boolean {
  const recent = [...candlesBefore.slice(-12), ...candlesAfter.slice(0, 8)];
  const recentRange = Math.max(...recent.map((c) => c.high)) - Math.min(...recent.map((c) => c.low));
  const giantWicks = recent.filter((c) => {
    const body = Math.max(0.01, Math.abs(c.close - c.open));
    const wick = Math.max(c.high - Math.max(c.open, c.close), Math.min(c.open, c.close) - c.low);
    return wick > body * 3;
  });
  if (scenarioType !== "news-liquidation-candle" && giantWicks.length >= 3) return false;

  const impossibleSpikes = recent.filter((c) => {
    const wick = Math.max(c.high - Math.max(c.open, c.close), Math.min(c.open, c.close) - c.low);
    return wick > recentRange * 0.8 && c.metadata?.purpose !== "sweep";
  });
  if (impossibleSpikes.length > 0) return false;

  const hugeWickSizes = recent
    .map((c) => Math.max(c.high - Math.max(c.open, c.close), Math.min(c.open, c.close) - c.low))
    .filter((w) => w > 0.9)
    .map((w) => Number(w.toFixed(2)));
  const freq = new Map<number, number>();
  for (const w of hugeWickSizes) freq.set(w, (freq.get(w) ?? 0) + 1);
  if ([...freq.values()].some((v) => v >= 3)) return false;

  return true;
}

function chooseIntensity(difficulty: Difficulty): IntensityLevel {
  if (difficulty === "beginner") {
    return weightedChoice<IntensityLevel>([
      { item: "calm", weight: 45 },
      { item: "normal", weight: 45 },
      { item: "volatile", weight: 10 },
    ]);
  }
  if (difficulty === "intermediate") {
    return weightedChoice<IntensityLevel>([
      { item: "normal", weight: 35 },
      { item: "volatile", weight: 45 },
      { item: "chaotic", weight: 20 },
    ]);
  }
  return weightedChoice<IntensityLevel>([
    { item: "volatile", weight: 35 },
    { item: "chaotic", weight: 40 },
    { item: "liquidation", weight: 25 },
  ]);
}

function getComplicationRange(difficulty: Difficulty): [number, number] {
  if (difficulty === "beginner") return [1, 2];
  if (difficulty === "intermediate") return [2, 4];
  return [4, 7];
}

function rollingMean(values: number[], i: number, len: number): number {
  const from = Math.max(0, i - len + 1);
  let s = 0;
  for (let k = from; k <= i; k++) s += values[k];
  return s / (i - from + 1);
}

function buildSignal(close: number[], idx: number, params: {
  macroDir: number;
  localDir: number;
  localStrength: number;
  intensity: IntensityLevel;
  meanAnchor: number;
  prevVol: number;
}): { nextClose: number; vol: number; eventNote?: string } {
  const { macroDir, localDir, localStrength, intensity, meanAnchor, prevVol } = params;
  const prev = close[idx - 1];
  const prev2 = close[Math.max(0, idx - 2)] ?? prev;
  const volRegime = intensity === "calm" ? 0.18 : intensity === "normal" ? 0.26 : intensity === "volatile" ? 0.42 : intensity === "chaotic" ? 0.58 : 0.82;
  const accel = randomBetween(0.4, 1.6);
  const trendComponent = macroDir * randomBetween(0.02, 0.12) + localDir * localStrength * randomBetween(0.04, 0.24);
  const meanReversion = clamp((meanAnchor - prev) * randomBetween(0.03, 0.18), -0.45, 0.45);
  const momentum = (prev - prev2) * randomBetween(0.15, 0.48);
  const nonlinear = Math.sin(idx / randomBetween(2.2, 5.4)) * randomBetween(0.01, 0.12) * (Math.random() > 0.5 ? 1 : -1);
  const noise = randomBetween(-volRegime, volRegime) * accel;
  let delta = trendComponent + meanReversion + momentum + nonlinear + noise;

  let eventNote: string | undefined;
  if (Math.random() < (intensity === "calm" ? 0.05 : 0.12)) {
    const event = weightedChoice([
      { item: "wick-spike", weight: 26 },
      { item: "fake-breakout", weight: 24 },
      { item: "liquidity-grab", weight: 24 },
      { item: "failed-continuation", weight: 26 },
    ]);
    if (event === "failed-continuation") delta *= -randomBetween(0.6, 1.4);
    if (event === "fake-breakout") delta *= randomBetween(1.4, 2.3);
    if (event === "liquidity-grab") delta += (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.25, 0.7);
    eventNote = event;
  }

  const nextClose = roundPrice(Math.max(20, prev + delta));
  const body = Math.abs(nextClose - prev);
  const vol = Math.max(25, Math.round((prevVol * randomBetween(0.84, 1.13)) + body * randomBetween(120, 340)));
  return { nextClose, vol, eventNote };
}

function computeMa(values: number[], length: number): number[] {
  return values.map((_, i) => rollingMean(values, i, length));
}

function computeBands(values: number[], length = 20): { upper: number[]; lower: number[]; middle: number[] } {
  const middle: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const from = Math.max(0, i - length + 1);
    const slice = values.slice(from, i + 1);
    const mean = slice.reduce((a, v) => a + v, 0) / Math.max(1, slice.length);
    const variance = slice.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, slice.length);
    const std = Math.sqrt(variance);
    middle.push(mean);
    upper.push(mean + 2 * std);
    lower.push(mean - 2 * std);
  }
  return { upper, lower, middle };
}

function applyHesitation(close: number[], fromIdx: number, majorDir: 1 | -1): void {
  const count = Math.min(randomInt(3, 6), close.length - fromIdx - 2);
  for (let i = 0; i < count; i++) {
    const idx = fromIdx + i;
    const prev = close[idx - 1];
    const step = randomBetween(-0.12, 0.12) + (i % 2 === 0 ? 0.03 : -0.03);
    close[idx] = roundPrice(prev + step);
  }
  const breakIdx = fromIdx + count;
  if (breakIdx < close.length) {
    close[breakIdx] = roundPrice(close[breakIdx - 1] + majorDir * randomBetween(0.45, 1.1));
  }
}

function applyFakeAttempts(close: number[], eventMap: Map<number, string>, fromIdx: number, majorDir: 1 | -1): void {
  const fakeDir = majorDir * -1;
  const pushes = randomInt(1, 2);
  let idx = fromIdx;
  for (let p = 0; p < pushes && idx < close.length - 4; p++) {
    close[idx] = roundPrice(close[idx - 1] + fakeDir * randomBetween(0.28, 0.62));
    eventMap.set(idx, "fake-breakout");
    close[idx + 1] = roundPrice(close[idx] + fakeDir * randomBetween(0.08, 0.22)); // retest continuation look
    close[idx + 2] = roundPrice(close[idx + 1] - fakeDir * randomBetween(0.46, 0.95)); // fail quickly
    eventMap.set(idx + 2, "failed-continuation");
    idx += 3;
  }
}

function applyIndicatorInteractions(params: {
  close: number[];
  eventMap: Map<number, string>;
  requireTrap: boolean;
  enableBands: boolean;
}): { notes: string[]; trapCount: number } {
  const { close, eventMap, requireTrap, enableBands } = params;
  const notes: string[] = [];
  let trapCount = 0;
  for (let pass = 0; pass < 2; pass++) {
    const maFast = computeMa(close, 7);
    const maSlow = computeMa(close, 18);
    const bands = computeBands(close, 20);
    for (let i = 20; i < close.length - 3; i++) {
      const p = close[i];
      const dFast = p - maFast[i];
      const dSlow = p - maSlow[i];
      const nearFast = Math.abs(dFast) < 0.22;
      const nearSlow = Math.abs(dSlow) < 0.28;
      if (nearFast && Math.random() < 0.2) {
        // bounce/reject off MA
        close[i + 1] = roundPrice(close[i] + (dFast >= 0 ? 1 : -1) * randomBetween(0.16, 0.42));
        notes.push("MA bounce");
      } else if (nearSlow && Math.random() < 0.14) {
        // break then retest
        const dir = dSlow >= 0 ? -1 : 1;
        close[i + 1] = roundPrice(close[i] + dir * randomBetween(0.26, 0.58));
        close[i + 2] = roundPrice(maSlow[i + 1] + randomBetween(-0.12, 0.12));
        notes.push("MA break retest");
      } else if ((nearFast || nearSlow) && Math.random() < 0.12) {
        // MA cross trap
        const dir = Math.random() > 0.5 ? 1 : -1;
        close[i + 1] = roundPrice(close[i] + dir * randomBetween(0.24, 0.52));
        close[i + 2] = roundPrice(close[i + 1] - dir * randomBetween(0.34, 0.72));
        eventMap.set(i + 2, "failed-continuation");
        notes.push("MA cross trap");
        trapCount += 1;
      }

      if (enableBands) {
        const upper = bands.upper[i];
        const lower = bands.lower[i];
        if (p >= upper - 0.08 && Math.random() < 0.2) {
          close[i + 1] = roundPrice(close[i] - randomBetween(0.22, 0.56));
          notes.push("Upper band rejection");
        } else if (p <= lower + 0.08 && Math.random() < 0.2) {
          close[i + 1] = roundPrice(close[i] + randomBetween(0.22, 0.56));
          notes.push("Lower band rejection");
        } else if ((p > upper || p < lower) && Math.random() < 0.22) {
          // fake breakout outside bands, snap back
          const dir = p > upper ? 1 : -1;
          close[i + 1] = roundPrice(close[i] + dir * randomBetween(0.1, 0.26));
          close[i + 2] = roundPrice(bands.middle[i + 1] + randomBetween(-0.14, 0.14));
          eventMap.set(i + 2, "fake-breakout");
          notes.push("Band breakout trap");
          trapCount += 1;
        } else if (Math.abs(upper - lower) < 0.8 && Math.random() < 0.14) {
          // compression before expansion
          close[i + 1] = roundPrice(close[i] + randomBetween(-0.08, 0.08));
          close[i + 2] = roundPrice(close[i + 1] + (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.45, 0.95));
          notes.push("Band compression expansion");
        }
      }
    }
  }
  if (requireTrap && trapCount < 1) {
    const idx = randomInt(22, Math.max(23, close.length - 5));
    close[idx + 1] = roundPrice(close[idx] + randomBetween(0.22, 0.55));
    close[idx + 2] = roundPrice(close[idx + 1] - randomBetween(0.4, 0.92));
    eventMap.set(idx + 2, "fake-breakout");
    notes.push("Forced breakout trap");
    trapCount += 1;
  }
  return { notes, trapCount };
}

function buildCandlesFromClose(params: {
  close: number[];
  startTime: number;
  baseVolume: number;
  intensity: IntensityLevel;
  eventMap: Map<number, string>;
}): Candle[] {
  const { close, startTime, baseVolume, intensity, eventMap } = params;
  const candles: Candle[] = [];
  for (let i = 0; i < close.length; i++) {
    const open = i === 0 ? close[0] - randomBetween(-0.15, 0.15) : close[i - 1];
    const c = close[i];
    const body = Math.max(0.02, Math.abs(c - open));
    const event = eventMap.get(i);
    const wickMul = event === "wick-spike" || event === "liquidity-grab" ? randomBetween(1.4, 2.6) : randomBetween(0.3, 1.15);
    const upper = body * randomBetween(0.22, wickMul);
    const lower = body * randomBetween(0.22, wickMul);
    let high = Math.max(open, c) + upper;
    let low = Math.min(open, c) - lower;
    if (event === "fake-breakout") {
      if (c >= open) high += body * randomBetween(0.8, 1.4);
      else low -= body * randomBetween(0.8, 1.4);
    }
    if (event === "liquidity-grab") {
      if (Math.random() > 0.5) {
        high += body * randomBetween(1.4, 2.8);
        low += body * randomBetween(0.2, 0.5);
      } else {
        low -= body * randomBetween(1.4, 2.8);
        high -= body * randomBetween(0.2, 0.5);
      }
    }
    high = Math.max(high, open, c);
    low = Math.min(low, open, c);
    const volatilityBump = intensity === "chaotic" || intensity === "liquidation" ? randomBetween(1, 1.35) : randomBetween(0.86, 1.1);
    const volume = Math.round(baseVolume * volatilityBump * randomBetween(0.7, 1.35) + body * randomBetween(80, 240));
    candles.push({
      time: startTime + i * 60,
      open: roundPrice(open),
      close: roundPrice(c),
      high: roundPrice(high),
      low: roundPrice(low),
      volume,
      metadata: {
        purpose: event === "liquidity-grab" ? "sweep" : event === "failed-continuation" ? "pullback" : "normal",
        liquiditySweep: event === "liquidity-grab",
        trap: event === "fake-breakout" || event === "failed-continuation",
      },
    });
  }
  return candles;
}

function realismValidator(params: {
  candlesBefore: Candle[];
  candlesAfter: Candle[];
  scenarioType: ScenarioType;
  conflictCount: number;
  complicationNotes: string[];
  ambiguousTarget: boolean;
  trapCount: number;
  indicatorAgreementTooPerfect: boolean;
}): boolean {
  const { candlesBefore, candlesAfter, scenarioType, conflictCount, complicationNotes, ambiguousTarget, trapCount, indicatorAgreementTooPerfect } = params;
  const all = [...candlesBefore, ...candlesAfter];
  const recent = all.slice(-18);
  const sameColor = recent.filter((c) => c.close >= c.open).length;
  if (sameColor > 14 || sameColor < 4) return false;
  if (smoothCurveScore(recent) > 0.8) return false;
  if (!hasVolatilityShift(all)) return false;
  if (!hasPullback(candlesAfter)) return false;
  if (!wickChartValidator(candlesBefore, candlesAfter, scenarioType)) return false;
  if (candleColorRunTooLong(all, 5)) return false;
  if (complicationNotes.length < 1) return false;
  if (conflictCount < 2) return false;
  if (trapCount < 1) return false;
  if (indicatorAgreementTooPerfect) return false;
  if (ambiguousTarget) {
    const beforeLast = candlesBefore.at(-1)?.close ?? 100;
    const afterLast = candlesAfter.at(-1)?.close ?? beforeLast;
    if (Math.abs(afterLast - beforeLast) > beforeLast * 0.022) return false;
  }
  return true;
}

function buildExplanationData(scenarioType: ScenarioType, candlesBefore: Candle[], candlesAfter: Candle[]): ExplanationData {
  const lows = candlesBefore.map((c) => c.low);
  const highs = candlesBefore.map((c) => c.high);
  const closes = candlesBefore.map((c) => c.close);
  const bodyStrength = closes.at(-1)! - closes[Math.max(0, closes.length - 8)];
  const bias = clampDirectionBias(bodyStrength / 8);
  const support = Math.min(...lows.slice(-20));
  const resistance = Math.max(...highs.slice(-20));
  const liquidityAbove = resistance + randomBetween(0.2, 0.8);
  const liquidityBelow = support - randomBetween(0.2, 0.8);
  const avgBeforeVol = candlesBefore.slice(-15).reduce((acc, c) => acc + c.volume, 0) / Math.min(15, candlesBefore.length);
  const avgAfterVol = candlesAfter.slice(0, 8).reduce((acc, c) => acc + c.volume, 0) / Math.min(8, candlesAfter.length);
  const volumeConfirmation = avgAfterVol > avgBeforeVol * 1.18 ? "strong" : avgAfterVol < avgBeforeVol * 0.92 ? "weak" : "mixed";
  const trendBias = bias;
  return {
    macroTrend: undefined,
    currentStructure: undefined,
    recentStructureEvent: "none",
    fvgSummaries: [],
    liquiditySummaries: [],
    complexityNotes: [],
    trendBias,
    support: roundPrice(support),
    resistance: roundPrice(resistance),
    liquidityAbove: roundPrice(liquidityAbove),
    liquidityBelow: roundPrice(liquidityBelow),
    hadLiquidityGrab: candlesBefore.some((c) => c.metadata?.liquiditySweep),
    hadFakeout: candlesBefore.some((c) => c.metadata?.trap),
    volumeConfirmation,
    marketStructure: bias === "up" ? "hh-hl" : bias === "down" ? "lh-ll" : "range",
    invalidationLevel: roundPrice(bias === "up" ? support - 0.35 : resistance + 0.35),
    potentialEntry: roundPrice((support + resistance) / 2),
    riskRewardHint: "Use confirmation around a defended level, risk at invalidation, and avoid chasing extended candles.",
    keySignals: [
      "Structured phases: range, liquidity build, sweep, displacement, pullback, outcome.",
      "Sweep rejection set up the post-manipulation directional leg.",
      "Displacement candles showed urgency and imbalance.",
      "Pullback quality hinted at continuation versus failure risk.",
      `Scenario model: ${scenarioType.replaceAll("-", " ")}.`,
    ],
  };
}

export function getAllScenarioTags(): ScenarioTag[] {
  return ["trend", "continuation", "reversal", "range", "breakout", "fakeout", "liquidity", "structure", "support-resistance", "trap"];
}

export function getScenariosByTags(tags: ScenarioTag[]): ScenarioType[] {
  if (tags.length === 0) return [...scenarioPool];
  return scenarioPool.filter((scenario) => scenarioTagMap[scenario].some((tag) => tags.includes(tag)));
}

function generateScenarioInternal(difficulty: Difficulty, scenarioType: ScenarioType): Scenario {
  const macroBias = weightedChoice<MacroBias>([
    { item: "macro-uptrend", weight: 23 },
    { item: "macro-downtrend", weight: 23 },
    { item: "macro-range", weight: 22 },
    { item: "macro-distribution", weight: 16 },
    { item: "macro-accumulation", weight: 16 },
  ]);
  const intensity = chooseIntensity(difficulty);
  for (let attempt = 0; attempt < 28; attempt++) {
    const cfg = difficultyCfg[difficulty];
    const scenarioTags = scenarioTagMap[scenarioType];
    const totalBefore = clamp(randomInt(40, 80), 40, 80);
    const totalAfter = randomInt(10, 20);
    const total = totalBefore + totalAfter;
    const t0 = Math.floor(Date.now() / 1000) - total * 60;
    const startPrice = randomBetween(95, 140);
    const close: number[] = [startPrice];
    const volumeRaw: number[] = [randomInt(80, 140)];
    const eventMap = new Map<number, string>();
    const macroDir = macroBias === "macro-uptrend" || macroBias === "macro-accumulation" ? 1 : macroBias === "macro-downtrend" || macroBias === "macro-distribution" ? -1 : 0;
    const localDir = weightedChoice<number>([{ item: 1, weight: 40 }, { item: -1, weight: 40 }, { item: 0, weight: 20 }]);
    const localStrength = randomBetween(0.45, 1.3) * cfg.volatility;
    const meanAnchor = startPrice + macroDir * randomBetween(-1.2, 1.2);
    const ambiguousTarget = Math.random() < 0.34;

    for (let i = 1; i < total; i++) {
      const signal = buildSignal(close, i, {
        macroDir,
        localDir: i < Math.floor(total * 0.65) ? localDir : -localDir * randomBetween(0.25, 0.9),
        localStrength,
        intensity,
        meanAnchor: meanAnchor + Math.sin(i / 7) * randomBetween(0.25, 1.1),
        prevVol: volumeRaw[i - 1] ?? 120,
      });
      close.push(signal.nextClose);
      volumeRaw.push(signal.vol);
      if (signal.eventNote) eventMap.set(i, signal.eventNote);
    }

    const majorDir: 1 | -1 = weightedChoice([
      { item: 1 as const, weight: 1 },
      { item: -1 as const, weight: 1 },
    ]);
    const fakeStart = randomInt(Math.floor(total * 0.45), Math.floor(total * 0.75));
    applyFakeAttempts(close, eventMap, fakeStart, majorDir);
    applyHesitation(close, Math.min(total - 8, fakeStart + 2), majorDir);
    const bandsEnabled = Math.random() < 0.58;
    const indicatorInteractions = applyIndicatorInteractions({
      close,
      eventMap,
      requireTrap: difficulty !== "beginner" || Math.random() < 0.7,
      enableBands: bandsEnabled,
    });

    const allCandles = buildCandlesFromClose({
      close,
      startTime: t0,
      baseVolume: randomBetween(90, 150),
      intensity,
      eventMap,
    });
    for (let i = 1; i < allCandles.length - 1; i++) {
      if (Math.random() < 0.2) {
        const c = allCandles[i];
        const prev = allCandles[i - 1];
        const next = allCandles[i + 1];
        c.close = roundPrice((c.close + prev.close * 0.35 + next.close * 0.25) / 1.6 + randomBetween(-0.12, 0.12));
        c.high = roundPrice(Math.max(c.high, c.open, c.close));
        c.low = roundPrice(Math.min(c.low, c.open, c.close));
      }
    }

    const candlesBefore = allCandles.slice(0, totalBefore);
    const candlesAfter = allCandles.slice(totalBefore);
    const closeAll = allCandles.map((c) => c.close);
    const maFast = computeMa(closeAll, 7);
    const maSlow = computeMa(closeAll, 18);
    const momentum = closeAll.at(-1)! - closeAll[Math.max(0, closeAll.length - 6)];
    const structure = closeAll.at(-1)! - closeAll[Math.max(0, closeAll.length - 12)];
    const maSignal = maFast.at(-1)! - maSlow.at(-1)!;
    const sweepSignal = [...candlesBefore.slice(-8), ...candlesAfter.slice(0, 4)].some((c) => c.metadata?.liquiditySweep)
      ? (Math.random() > 0.5 ? 1 : -1)
      : 0;
    const signs = [Math.sign(momentum), Math.sign(structure), Math.sign(maSignal), sweepSignal].filter((s) => s !== 0);
    const pos = signs.filter((s) => s > 0).length;
    const neg = signs.filter((s) => s < 0).length;
    const conflictCount = pos > 0 && neg > 0 ? 2 + Math.min(pos, neg) : 0;
    const indicatorAgreementTooPerfect = Math.abs(maSignal) > 0.7 && Math.abs(momentum) > 0.9 && pos === signs.length;

    const annotations: ScenarioAnnotation[] = [];
    const highs = candlesBefore.slice(-20).map((c) => c.high);
    const lows = candlesBefore.slice(-20).map((c) => c.low);
    const support = Math.min(...lows);
    const resistance = Math.max(...highs);
    const entry = roundPrice(candlesBefore.at(-1)?.close ?? startPrice);
    const dirHint: Direction = maSignal > EPS ? "up" : maSignal < -EPS ? "down" : "sideways";
    const invalidation = dirHint === "down" ? entry + randomBetween(0.25, 0.85) : entry - randomBetween(0.25, 0.85);

    annotations.push({ type: "support", label: "Support", price: roundPrice(support) });
    annotations.push({ type: "resistance", label: "Resistance", price: roundPrice(resistance) });
    annotations.push({ type: "entry", label: "Potential entry", price: entry });
    annotations.push({ type: "invalidation", label: "Invalidation", price: roundPrice(invalidation) });
    eventMap.forEach((e, idx) => {
      if (idx < totalBefore || idx >= totalBefore + 10) return;
      const c = allCandles[idx];
      if (e === "liquidity-grab") annotations.push({ type: "liquidity-sweep", label: "Liquidity grab", time: c.time, price: c.close });
      if (e === "fake-breakout") annotations.push({ type: "trap", label: "Fake breakout", time: c.time, price: c.close });
      if (e === "failed-continuation") annotations.push({ type: "change-of-character", label: "Failed continuation", time: c.time, price: c.close });
    });

    const [minComp, maxComp] = getComplicationRange(difficulty);
    const targetComplications = randomInt(minComp, maxComp) + (intensity === "chaotic" ? 1 : 0) + (intensity === "liquidation" ? 2 : 0);
    const notes = [...Array.from(eventMap.values()), ...indicatorInteractions.notes].slice(0, targetComplications + 2);
    if (
      !realismValidator({
        candlesBefore,
        candlesAfter,
        scenarioType,
        conflictCount,
        complicationNotes: notes,
        ambiguousTarget,
        trapCount: indicatorInteractions.trapCount + notes.filter((n) => n.includes("trap")).length,
        indicatorAgreementTooPerfect,
      })
    ) {
      continue;
    }

    const explanationData = buildExplanationData(scenarioType, candlesBefore, candlesAfter);
    explanationData.macroTrend = macroBias;
    explanationData.currentStructure = weightedChoice([
      { item: "trend-continuation", weight: 18 },
      { item: "fakeout", weight: 22 },
      { item: "liquidity-sweep", weight: 22 },
      { item: "reversal-attempt", weight: 18 },
      { item: "compression-expansion", weight: 20 },
    ]);
    explanationData.recentStructureEvent = weightedChoice([
      { item: "bos", weight: 36 },
      { item: "choch", weight: 36 },
      { item: "none", weight: 28 },
    ]);
    explanationData.complexityNotes = notes;
    explanationData.fvgSummaries = ["Multiple overlapping imbalances formed and were interacted with unevenly."];
    explanationData.liquiditySummaries = annotations.filter((a) => a.type === "liquidity-sweep").map((a) => a.label);

    const correctDirection = ambiguousTarget
      ? "sideways"
      : resolveCorrectDirection({
          scenario: scenarioType,
          difficulty,
          beforeLastClose: candlesBefore.at(-1)!.close,
          afterLastClose: candlesAfter.at(-1)!.close,
        });

    return {
      candlesBefore,
      candlesAfter,
      macroBias,
      intensity,
      shortTermBias: clampDirectionBias((candlesAfter.at(-1)!.close - candlesAfter[0].open) / 8),
      confidenceScore: Number((ambiguousTarget ? randomBetween(0.32, 0.58) : randomBetween(0.44, 0.86)).toFixed(2)),
      correctDirection,
      scenarioType,
      scenarioTags,
      overlayOptions: {
        showVwap: Math.random() < 0.62,
        showBands: bandsEnabled,
      },
      explanationData,
      annotations,
    };
  }

  const totalBefore = 48;
  const totalAfter = 12;
  const t0 = Math.floor(Date.now() / 1000) - (totalBefore + totalAfter) * 60;
  const closes = [randomBetween(96, 126)];
  for (let i = 1; i < totalBefore + totalAfter; i++) {
    closes.push(roundPrice(closes[i - 1] + randomBetween(-0.42, 0.42) + Math.sin(i / 3) * 0.06));
  }
  const fallbackCandles = buildCandlesFromClose({
    close: closes,
    startTime: t0,
    baseVolume: 120,
    intensity,
    eventMap: new Map(),
  });
  const candlesBefore = fallbackCandles.slice(0, totalBefore);
  const candlesAfter = fallbackCandles.slice(totalBefore);
  const explanationData = buildExplanationData(scenarioType, candlesBefore, candlesAfter);
  explanationData.macroTrend = macroBias;
  explanationData.complexityNotes = ["fallback mixed-flow generation"];
  return {
    candlesBefore,
    candlesAfter,
    macroBias,
    intensity,
    shortTermBias: "sideways",
    confidenceScore: 0.45,
    correctDirection: resolveCorrectDirection({
      scenario: scenarioType,
      difficulty,
      beforeLastClose: candlesBefore.at(-1)!.close,
      afterLastClose: candlesAfter.at(-1)!.close,
    }),
    scenarioType,
    scenarioTags: scenarioTagMap[scenarioType],
    overlayOptions: { showVwap: true, showBands: true },
    explanationData,
    annotations: [],
  };
}

export function generateScenario(difficulty: Difficulty): Scenario {
  return generateScenarioInternal(difficulty, scenarioPool[randomInt(0, scenarioPool.length - 1)]);
}

export function generateScenarioWithFilters(params: {
  difficulty: Difficulty;
  allowedScenarioTypes: ScenarioType[];
}): Scenario {
  const { difficulty, allowedScenarioTypes } = params;
  const pool = allowedScenarioTypes.length ? allowedScenarioTypes : scenarioPool;
  const scenarioType = pool[randomInt(0, pool.length - 1)];
  return generateScenarioInternal(difficulty, scenarioType);
}
