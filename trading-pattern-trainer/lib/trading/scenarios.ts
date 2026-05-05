import { Difficulty, Direction, Phase, ScenarioTag, ScenarioType } from "./types";

export const scenarioPool: ScenarioType[] = [
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

export const scenarioTagMap: Record<ScenarioType, ScenarioTag[]> = {
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

export const scenarioPhaseSequence: Phase[] = [
  "range",
  "liquidity-build",
  "liquidity-sweep",
  "displacement",
  "pullback",
  "outcome",
];

export const difficultyCfg = {
  beginner: { volatility: 0.9, sidewaysChance: 0.08 },
  intermediate: { volatility: 1.1, sidewaysChance: 0.16 },
  advanced: { volatility: 1.35, sidewaysChance: 0.34 },
} as const;

export function getScenarioBias(scenario: ScenarioType): Direction {
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

export function resolveCorrectDirection(params: {
  scenario: ScenarioType;
  difficulty: Difficulty;
  beforeLastClose: number;
  afterLastClose: number;
}): Direction {
  const { scenario, difficulty, beforeLastClose, afterLastClose } = params;
  const move = afterLastClose - beforeLastClose;
  if (scenario === "choppy-low-confidence-fake-setup" && difficulty === "advanced") return "sideways";
  if (Math.abs(move) < (difficulty === "advanced" ? 0.85 : 0.45)) return "sideways";
  return move > 0 ? "up" : "down";
}
