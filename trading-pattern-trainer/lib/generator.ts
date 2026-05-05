import {
  Candle,
  Difficulty,
  Direction,
  ExplanationData,
  Scenario,
  ScenarioType,
} from "./types";

const scenarioPool: ScenarioType[] = [
  "uptrend-continuation",
  "downtrend-continuation",
  "range-consolidation",
  "breakout",
  "fake-breakout",
  "liquidity-grab-stop-hunt",
  "reversal-after-sweep",
  "higher-low-lower-high",
  "support-resistance-bounce",
  "trendline-break",
  "bull-trap-bear-trap",
];

const difficultyCfg = {
  beginner: { noise: 0.4, wickiness: 0.6, trapChance: 0.15, baseVol: 0.9 },
  intermediate: { noise: 0.8, wickiness: 1, trapChance: 0.35, baseVol: 1.1 },
  advanced: { noise: 1.2, wickiness: 1.3, trapChance: 0.55, baseVol: 1.35 },
} as const;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const roundPrice = (p: number) => Number(p.toFixed(2));
const std = (n = 1) => (Math.random() - 0.5) * 2 * n;

function clampDirectionBias(value: number): Direction {
  if (value > 0.18) return "up";
  if (value < -0.18) return "down";
  return "sideways";
}

function baseDriftForScenario(scenario: ScenarioType): number {
  switch (scenario) {
    case "uptrend-continuation":
    case "breakout":
      return 0.32;
    case "downtrend-continuation":
      return -0.32;
    case "range-consolidation":
      return 0;
    case "fake-breakout":
      return 0.08;
    case "liquidity-grab-stop-hunt":
      return -0.05;
    case "reversal-after-sweep":
      return -0.16;
    case "higher-low-lower-high":
    case "support-resistance-bounce":
      return 0.14;
    case "trendline-break":
      return -0.1;
    case "bull-trap-bear-trap":
      return 0.02;
    default:
      return 0;
  }
}

function applyScenarioPulse(
  idx: number,
  total: number,
  scenario: ScenarioType,
  trapChance: number,
): number {
  const phase = idx / total;
  if (scenario === "range-consolidation") {
    return Math.sin(phase * Math.PI * 4) * 0.14;
  }
  if (scenario === "breakout" && phase > 0.72) return 0.45;
  if (scenario === "fake-breakout" && phase > 0.72 && phase < 0.86) return 0.42;
  if (scenario === "fake-breakout" && phase >= 0.86) return -0.35;
  if (scenario === "liquidity-grab-stop-hunt" && phase > 0.78 && phase < 0.88) return -0.52;
  if (scenario === "liquidity-grab-stop-hunt" && phase >= 0.88) return 0.42;
  if (scenario === "reversal-after-sweep" && phase > 0.72 && phase < 0.86) return -0.4;
  if (scenario === "reversal-after-sweep" && phase >= 0.86) return 0.5;
  if (scenario === "trendline-break" && phase > 0.68) return -0.45;
  if (scenario === "bull-trap-bear-trap" && phase > 0.7 && phase < 0.84) return 0.45;
  if (scenario === "bull-trap-bear-trap" && phase >= 0.84) return -0.55;
  if (Math.random() < trapChance * 0.015) return std(0.7);
  return 0;
}

function generateCandles(
  count: number,
  startPrice: number,
  scenario: ScenarioType,
  difficulty: Difficulty,
): Candle[] {
  const cfg = difficultyCfg[difficulty];
  const candles: Candle[] = [];
  let price = startPrice;
  let ts = Math.floor(Date.now() / 1000) - count * 60;

  for (let i = 0; i < count; i++) {
    const drift = baseDriftForScenario(scenario) * randomBetween(0.6, 1.4);
    const pulse = applyScenarioPulse(i, count, scenario, cfg.trapChance);
    const volRegime = cfg.baseVol + Math.sin(i / 8) * 0.18 + Math.abs(std(cfg.noise * 0.15));
    const body = drift + pulse + std(cfg.noise * 0.55) * volRegime;

    const open = price;
    let close = open + body;
    if (Math.abs(close - open) < 0.08) {
      close += std(0.2);
    }

    const wickTop = Math.abs(std(cfg.wickiness * 0.65)) + 0.04;
    const wickBottom = Math.abs(std(cfg.wickiness * 0.65)) + 0.04;
    const high = Math.max(open, close) + wickTop;
    const low = Math.min(open, close) - wickBottom;

    const directionalVolumeBoost =
      Math.abs(body) > cfg.baseVol * 0.45 ? randomBetween(1.15, 1.65) : randomBetween(0.75, 1.2);
    const volume = Math.round((120 + Math.abs(body) * 220 + Math.abs(pulse) * 380) * directionalVolumeBoost);

    candles.push({
      time: ts,
      open: roundPrice(open),
      high: roundPrice(high),
      low: roundPrice(low),
      close: roundPrice(close),
      volume,
    });

    price = close + std(0.04);
    ts += 60;
  }

  return candles;
}

function deriveCorrectDirection(
  scenario: ScenarioType,
  candlesBefore: Candle[],
  candlesAfter: Candle[],
): Direction {
  const move = candlesAfter.at(-1)!.close - candlesBefore.at(-1)!.close;

  if (scenario === "range-consolidation") return "sideways";
  if (scenario === "downtrend-continuation") return "down";
  if (scenario === "uptrend-continuation") return "up";
  if (Math.abs(move) < 0.45) return "sideways";
  return move > 0 ? "up" : "down";
}

function buildExplanationData(
  scenarioType: ScenarioType,
  candlesBefore: Candle[],
  candlesAfter: Candle[],
): ExplanationData {
  const lows = candlesBefore.map((c) => c.low);
  const highs = candlesBefore.map((c) => c.high);
  const closes = candlesBefore.map((c) => c.close);
  const bodyStrength = closes.at(-1)! - closes[Math.max(0, closes.length - 8)];
  const bias = clampDirectionBias(bodyStrength / 8);

  const support = Math.min(...lows.slice(Math.max(0, lows.length - 20)));
  const resistance = Math.max(...highs.slice(Math.max(0, highs.length - 20)));
  const liquidityAbove = resistance + randomBetween(0.2, 0.8);
  const liquidityBelow = support - randomBetween(0.2, 0.8);

  const avgBeforeVol =
    candlesBefore.slice(-15).reduce((acc, c) => acc + c.volume, 0) / Math.min(15, candlesBefore.length);
  const avgAfterVol =
    candlesAfter.slice(0, 8).reduce((acc, c) => acc + c.volume, 0) / Math.min(8, candlesAfter.length);

  const volumeConfirmation =
    avgAfterVol > avgBeforeVol * 1.18 ? "strong" : avgAfterVol < avgBeforeVol * 0.92 ? "weak" : "mixed";

  const structure: ExplanationData["marketStructure"] =
    bias === "up" ? "hh-hl" : bias === "down" ? "lh-ll" : "range";

  const keySignals = [
    "Rejection wicks appeared near key liquidity pockets.",
    "Body-to-wick ratio shifted into momentum territory before expansion.",
    "Price reacted around a clearly defended support/resistance zone.",
    "Follow-through volume gave clues on whether the move was accepted or faded.",
  ];

  return {
    trendBias: bias,
    support: roundPrice(support),
    resistance: roundPrice(resistance),
    liquidityAbove: roundPrice(liquidityAbove),
    liquidityBelow: roundPrice(liquidityBelow),
    hadLiquidityGrab:
      scenarioType === "liquidity-grab-stop-hunt" || scenarioType === "reversal-after-sweep",
    hadFakeout: scenarioType === "fake-breakout" || scenarioType === "bull-trap-bear-trap",
    volumeConfirmation,
    marketStructure: structure,
    invalidationLevel: roundPrice(bias === "up" ? support - 0.35 : resistance + 0.35),
    potentialEntry: roundPrice((support + resistance) / 2),
    riskRewardHint:
      "Wait for a close + retest around the trigger level, then define risk at invalidation and target at least 1.5R to 2R.",
    keySignals,
  };
}

export function generateScenario(difficulty: Difficulty): Scenario {
  const scenarioType = pick(scenarioPool);
  const candlesBeforeCount = Math.floor(randomBetween(40, 81));
  const candlesAfterCount = Math.floor(randomBetween(10, 21));
  const startPrice = randomBetween(95, 125);

  const candlesBefore = generateCandles(candlesBeforeCount, startPrice, scenarioType, difficulty);
  const afterSeed = candlesBefore.at(-1)!.close;
  const candlesAfter = generateCandles(candlesAfterCount, afterSeed, scenarioType, difficulty);
  const correctDirection = deriveCorrectDirection(scenarioType, candlesBefore, candlesAfter);

  return {
    candlesBefore,
    candlesAfter,
    correctDirection,
    scenarioType,
    explanationData: buildExplanationData(scenarioType, candlesBefore, candlesAfter),
  };
}
