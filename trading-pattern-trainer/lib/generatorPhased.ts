import {
  Candle,
  Difficulty,
  Direction,
  ExplanationData,
  Scenario,
  ScenarioAnnotation,
  ScenarioTag,
  ScenarioType,
} from "./types";

const scenarioPool: ScenarioType[] = [
  "trend-continuation-after-pullback",
  "reversal-after-liquidity-sweep",
  "breakout-retest",
  "failed-breakout-trap",
  "range-accumulation",
  "range-distribution",
  "compression-expansion",
  "news-liquidation-candle",
  "long-squeeze",
  "short-squeeze",
  "choppy-low-confidence-fake-setup",
  "fair-value-gap-imbalance",
  "break-of-structure",
  "change-of-character",
];

const scenarioTagMap: Record<ScenarioType, ScenarioTag[]> = {
  "trend-continuation-after-pullback": ["trend", "continuation", "structure"],
  "reversal-after-liquidity-sweep": ["liquidity", "reversal", "trap"],
  "breakout-retest": ["breakout", "continuation", "support-resistance"],
  "failed-breakout-trap": ["breakout", "fakeout", "trap"],
  "range-accumulation": ["range", "support-resistance", "structure"],
  "range-distribution": ["range", "support-resistance", "reversal"],
  "compression-expansion": ["breakout", "structure", "trend"],
  "news-liquidation-candle": ["liquidity", "trap", "breakout"],
  "long-squeeze": ["liquidity", "trap", "reversal"],
  "short-squeeze": ["liquidity", "trap", "reversal"],
  "choppy-low-confidence-fake-setup": ["fakeout", "trap", "range"],
  "fair-value-gap-imbalance": ["breakout", "continuation", "structure"],
  "break-of-structure": ["structure", "breakout", "trend"],
  "change-of-character": ["structure", "reversal", "liquidity"],
};

const difficultyCfg = {
  beginner: { volatility: 0.9, sidewaysChance: 0.08 },
  intermediate: { volatility: 1.1, sidewaysChance: 0.16 },
  advanced: { volatility: 1.35, sidewaysChance: 0.34 },
} as const;

export const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
export const randomInt = (min: number, max: number) => Math.floor(randomBetween(min, max + 1));
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pick = <T,>(items: T[]) => items[randomInt(0, items.length - 1)];
const roundPrice = (p: number) => Number(p.toFixed(2));
const std = (n = 1) => (Math.random() - 0.5) * 2 * n;

export function generateWick(bodySize: number, volatility: number, bias: Direction) {
  const base = Math.abs(bodySize) * 0.45 + randomBetween(0.08, 0.35) * volatility;
  let upper = base * randomBetween(0.75, 1.5);
  let lower = base * randomBetween(0.75, 1.5);
  if (bias === "up") lower *= randomBetween(1.1, 1.6);
  if (bias === "down") upper *= randomBetween(1.1, 1.6);
  return { upper, lower };
}

export function generateVolume(base: number, multiplier = 1) {
  return Math.round(base * multiplier * randomBetween(0.82, 1.22));
}

export const addNoiseToTrend = () => 0;
export const createPullback = () => 0;
export const createChop = () => 0;
export const createDisplacementMove = () => 0;
export const createLiquiditySweep = () => null;
export const createFairValueGap = () => null;

function getScenarioBias(scenario: ScenarioType): Direction {
  if (["long-squeeze", "failed-breakout-trap", "range-distribution", "change-of-character"].includes(scenario))
    return "down";
  if (
    ["breakout-retest", "short-squeeze", "fair-value-gap-imbalance", "trend-continuation-after-pullback"].includes(
      scenario,
    )
  )
    return "up";
  return "sideways";
}

function buildCandle(params: {
  prevClose: number;
  time: number;
  body: number;
  upperWick: number;
  lowerWick: number;
  volume: number;
  metadata?: Candle["metadata"];
}): Candle {
  const { prevClose, time, body, upperWick, lowerWick, volume, metadata } = params;
  const open = prevClose + std(0.06);
  const close = open + body;
  return {
    time,
    open: roundPrice(open),
    close: roundPrice(close),
    high: roundPrice(Math.max(open, close) + Math.abs(upperWick)),
    low: roundPrice(Math.min(open, close) - Math.abs(lowerWick)),
    volume: Math.max(20, Math.round(volume)),
    metadata,
  };
}

function generateRangePhase(count: number, startPrice: number, startTime: number, volatility: number) {
  const candles: Candle[] = [];
  let prevClose = startPrice;
  let t = startTime;
  let rangeHigh = Number.NEGATIVE_INFINITY;
  let rangeLow = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const body = std(0.12) * volatility;
    const wick = generateWick(body, volatility * 0.7, "sideways");
    const c = buildCandle({
      prevClose,
      time: t,
      body,
      upperWick: wick.upper,
      lowerWick: wick.lower,
      volume: generateVolume(95, randomBetween(0.6, 0.9)),
    });
    candles.push(c);
    rangeHigh = Math.max(rangeHigh, c.high);
    rangeLow = Math.min(rangeLow, c.low);
    prevClose = c.close;
    t += 60;
  }
  return { candles, rangeHigh, rangeLow };
}

function generateLiquidityBuildPhase(
  count: number,
  startPrice: number,
  startTime: number,
  rangeHigh: number,
  rangeLow: number,
  volatility: number,
) {
  const candles: Candle[] = [];
  let prevClose = startPrice;
  let t = startTime;
  const equalHigh = rangeHigh + randomBetween(0.08, 0.2);
  const equalLow = rangeLow - randomBetween(0.08, 0.2);
  for (let i = 0; i < count; i++) {
    const body = std(0.15) * volatility;
    const wick = generateWick(body, volatility * 0.85, "sideways");
    const c = buildCandle({
      prevClose,
      time: t,
      body,
      upperWick: wick.upper,
      lowerWick: wick.lower,
      volume: generateVolume(108, randomBetween(0.75, 1.1)),
    });
    if (i % 2 === 0) c.high = roundPrice(equalHigh + randomBetween(-0.05, 0.05));
    if (i % 3 === 0) c.low = roundPrice(equalLow + randomBetween(-0.05, 0.05));
    c.high = roundPrice(Math.max(c.high, c.open, c.close));
    c.low = roundPrice(Math.min(c.low, c.open, c.close));
    candles.push(c);
    prevClose = c.close;
    t += 60;
  }
  return { candles, equalHigh, equalLow };
}

function generateSweepPhase(
  startPrice: number,
  startTime: number,
  sweepSide: "above" | "below",
  equalHigh: number,
  equalLow: number,
  volatility: number,
) {
  const body = std(0.12) * volatility;
  const wick = generateWick(body, volatility * 1.5, "sideways");
  const c = buildCandle({
    prevClose: startPrice,
    time: startTime,
    body,
    upperWick: wick.upper,
    lowerWick: wick.lower,
    volume: generateVolume(175, randomBetween(1.8, 2.9)),
    metadata: { liquiditySweep: true, stopHunt: true },
  });
  if (sweepSide === "above") {
    c.high = roundPrice(equalHigh + randomBetween(0.55, 1.45) * volatility);
    c.close = roundPrice(Math.min(equalHigh - randomBetween(0.08, 0.32), c.close));
    c.low = roundPrice(Math.min(c.low, c.close - randomBetween(0.05, 0.2)));
    return { candle: c, sweepPrice: c.high };
  }
  c.low = roundPrice(equalLow - randomBetween(0.55, 1.45) * volatility);
  c.close = roundPrice(Math.max(equalLow + randomBetween(0.08, 0.32), c.close));
  c.high = roundPrice(Math.max(c.high, c.close + randomBetween(0.05, 0.2)));
  return { candle: c, sweepPrice: c.low };
}

function generateDisplacementPhase(count: number, startPrice: number, startTime: number, direction: Direction, volatility: number) {
  const candles: Candle[] = [];
  let prevClose = startPrice;
  let t = startTime;
  const dir = direction === "down" ? -1 : 1;
  for (let i = 0; i < count; i++) {
    const body = dir * randomBetween(0.8, 2.2) * volatility;
    const wick = generateWick(body, volatility * 0.4, direction);
    const c = buildCandle({
      prevClose,
      time: t,
      body,
      upperWick: wick.upper * 0.45,
      lowerWick: wick.lower * 0.45,
      volume: generateVolume(220, randomBetween(2.0, 3.8)),
      metadata: { imbalance: true, fairValueGap: true, breakOfStructure: i === 0 ? true : undefined },
    });
    candles.push(c);
    prevClose = c.close;
    t += 60;
  }
  return candles;
}

function generatePullbackPhase(count: number, startPrice: number, startTime: number, priorDirection: Direction, volatility: number) {
  const candles: Candle[] = [];
  let prevClose = startPrice;
  let t = startTime;
  const dir = priorDirection === "down" ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const body = dir * randomBetween(0.15, 0.55) * volatility;
    const wick = generateWick(body, volatility * 0.95, dir > 0 ? "up" : "down");
    const c = buildCandle({
      prevClose,
      time: t,
      body,
      upperWick: wick.upper * randomBetween(0.9, 1.4),
      lowerWick: wick.lower * randomBetween(0.9, 1.4),
      volume: generateVolume(125, randomBetween(0.75, 1.15)),
    });
    candles.push(c);
    prevClose = c.close;
    t += 60;
  }
  return candles;
}

function generateOutcomePhase(count: number, startPrice: number, startTime: number, direction: Direction, volatility: number) {
  const candles: Candle[] = [];
  let prevClose = startPrice;
  let t = startTime;
  for (let i = 0; i < count; i++) {
    const dir = direction === "sideways" ? (Math.random() > 0.5 ? 1 : -1) : direction === "up" ? 1 : -1;
    const body = dir * randomBetween(0.18, 0.95) * volatility + std(0.1);
    const wick = generateWick(body, volatility, dir > 0 ? "up" : "down");
    const c = buildCandle({
      prevClose,
      time: t,
      body,
      upperWick: wick.upper * randomBetween(0.8, 1.6),
      lowerWick: wick.lower * randomBetween(0.8, 1.6),
      volume: generateVolume(150, Math.abs(body) > 0.65 ? randomBetween(1.25, 1.9) : randomBetween(0.9, 1.2)),
    });
    candles.push(c);
    prevClose = c.close;
    t += 60;
  }
  return candles;
}

function generatePhasedSeries(params: { beforeCount: number; afterCount: number; startPrice: number; scenario: ScenarioType; difficulty: Difficulty }) {
  const { beforeCount, afterCount, startPrice, scenario, difficulty } = params;
  const cfg = difficultyCfg[difficulty];
  const totalBefore = clamp(beforeCount, 40, 80);
  const rangeLen = Math.max(10, Math.floor(totalBefore * 0.28));
  const liqBuildLen = Math.max(8, Math.floor(totalBefore * 0.22));
  const sweepLen = 1;
  const displacementLen = randomInt(1, 3);
  const pullbackLen = Math.max(6, totalBefore - (rangeLen + liqBuildLen + sweepLen + displacementLen));

  const t0 = Math.floor(Date.now() / 1000) - (totalBefore + afterCount) * 60;
  const annotations: ScenarioAnnotation[] = [];

  const range = generateRangePhase(rangeLen, startPrice, t0, cfg.volatility);
  const liq = generateLiquidityBuildPhase(
    liqBuildLen,
    range.candles.at(-1)?.close ?? startPrice,
    range.candles.at(-1)!.time + 60,
    range.rangeHigh,
    range.rangeLow,
    cfg.volatility,
  );
  const sweepSide: "above" | "below" = Math.random() > 0.5 ? "above" : "below";
  const sweep = generateSweepPhase(
    liq.candles.at(-1)?.close ?? startPrice,
    liq.candles.at(-1)!.time + 60,
    sweepSide,
    liq.equalHigh,
    liq.equalLow,
    cfg.volatility,
  );
  annotations.push({
    type: "liquidity-sweep",
    label: sweepSide === "above" ? "Buyside sweep" : "Sellside sweep",
    time: sweep.candle.time,
    price: sweep.sweepPrice,
  });

  const displacementDirection: Direction = sweepSide === "above" ? "down" : "up";
  const displacement = generateDisplacementPhase(
    displacementLen,
    sweep.candle.close,
    sweep.candle.time + 60,
    displacementDirection,
    cfg.volatility * randomBetween(1.15, 1.65),
  );
  const pullback = generatePullbackPhase(
    pullbackLen,
    displacement.at(-1)?.close ?? sweep.candle.close,
    (displacement.at(-1)?.time ?? sweep.candle.time) + 60,
    displacementDirection,
    cfg.volatility,
  );
  const candlesBefore = [...range.candles, ...liq.candles, sweep.candle, ...displacement, ...pullback].slice(0, totalBefore);

  const scenarioBias = getScenarioBias(scenario);
  const outcomeDirection: Direction =
    scenarioBias === "sideways"
      ? difficulty === "advanced" && Math.random() < cfg.sidewaysChance
        ? "sideways"
        : Math.random() > 0.5
          ? displacementDirection
          : displacementDirection === "up"
            ? "down"
            : "up"
      : scenarioBias;
  const candlesAfter = generateOutcomePhase(
    afterCount,
    candlesBefore.at(-1)?.close ?? startPrice,
    (candlesBefore.at(-1)?.time ?? t0) + 60,
    outcomeDirection,
    cfg.volatility * randomBetween(0.95, 1.45),
  );

  const support = Math.min(...range.candles.map((c) => c.low));
  const resistance = Math.max(...range.candles.map((c) => c.high));
  annotations.push({ type: "support", label: "Support", price: support });
  annotations.push({ type: "resistance", label: "Resistance", price: resistance });
  annotations.push({ type: "break-of-structure", label: "Displacement", time: displacement[0]?.time, price: displacement[0]?.close });
  annotations.push({ type: "entry", label: "Potential entry", price: candlesBefore.at(-1)?.close });
  annotations.push({
    type: "invalidation",
    label: "Invalidation",
    price: displacementDirection === "up" ? support - 0.2 : resistance + 0.2,
  });

  return { candlesBefore, candlesAfter, annotations };
}

function deriveCorrectDirection(scenario: ScenarioType, candlesBefore: Candle[], candlesAfter: Candle[], difficulty: Difficulty): Direction {
  const move = candlesAfter.at(-1)!.close - candlesBefore.at(-1)!.close;
  if (scenario === "choppy-low-confidence-fake-setup" && difficulty === "advanced") return "sideways";
  if (Math.abs(move) < (difficulty === "advanced" ? 0.85 : 0.45)) return "sideways";
  return move > 0 ? "up" : "down";
}

function clampDirectionBias(value: number): Direction {
  if (value > 0.18) return "up";
  if (value < -0.18) return "down";
  return "sideways";
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

  return {
    trendBias: bias,
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
      "Sweep rejection defined the manipulation phase before directional expansion.",
      "Displacement candles showed urgency with body dominance and volume expansion.",
      "Pullback quality helped frame whether continuation or reversal remained valid.",
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

export function generateScenarioWithFilters(params: {
  difficulty: Difficulty;
  allowedScenarioTypes: ScenarioType[];
}): Scenario {
  const { difficulty, allowedScenarioTypes } = params;
  const scenarioType = pick(allowedScenarioTypes.length ? allowedScenarioTypes : scenarioPool);
  const scenarioTags = scenarioTagMap[scenarioType];
  const beforeCount = randomInt(40, 80);
  const afterCount = randomInt(10, 20);
  const startPrice = randomBetween(95, 130);

  const phased = generatePhasedSeries({
    beforeCount,
    afterCount,
    startPrice,
    scenario: scenarioType,
    difficulty,
  });
  const { candlesBefore, candlesAfter, annotations } = phased;

  return {
    candlesBefore,
    candlesAfter,
    correctDirection: deriveCorrectDirection(scenarioType, candlesBefore, candlesAfter, difficulty),
    scenarioType,
    scenarioTags,
    explanationData: buildExplanationData(scenarioType, candlesBefore, candlesAfter),
    annotations,
  };
}
