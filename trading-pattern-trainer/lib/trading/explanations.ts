import { Direction, ExplanationData, ScenarioType } from "./types";

const scenarioLabels: Record<ScenarioType, string> = {
  "trend-continuation-after-pullback": "Trend continuation after pullback",
  "reversal-after-liquidity-sweep": "Reversal after liquidity sweep",
  "breakout-retest": "Breakout and retest",
  "failed-breakout-trap": "Failed breakout trap",
  "range-accumulation": "Range accumulation",
  "range-distribution": "Range distribution",
  "compression-expansion": "Compression before expansion",
  "news-liquidation-candle": "News-style liquidation candle",
  "long-squeeze": "Long squeeze",
  "short-squeeze": "Short squeeze",
  "choppy-low-confidence-fake-setup": "Choppy low-confidence fake setup",
  "fair-value-gap-imbalance": "Fair value gap / imbalance",
  "break-of-structure": "Break of structure",
  "change-of-character": "Change of character",
};

const directionLabel: Record<Direction, string> = {
  up: "Price goes up",
  down: "Price goes down",
  sideways: "Stay sideways / uncertain",
};

export function buildCoachExplanation(params: {
  scenarioType: ScenarioType;
  explanation: ExplanationData;
  correctDirection: Direction;
}): string {
  const { scenarioType, explanation, correctDirection } = params;
  const structureText =
    explanation.marketStructure === "hh-hl"
      ? "higher highs and higher lows"
      : explanation.marketStructure === "lh-ll"
        ? "lower highs and lower lows"
        : "a range with two-way rotations";

  return [
    `${scenarioLabels[scenarioType]} context: structure leaned toward ${structureText}, with trend bias ${explanation.trendBias}.`,
    explanation.macroTrend ? `Macro context: ${explanation.macroTrend.replaceAll("-", " ")}.` : "Macro context was mixed.",
    explanation.currentStructure ? `Current setup: ${explanation.currentStructure.replaceAll("-", " ")}.` : "Current setup showed conflicting structure.",
    `Support near ${explanation.support.toFixed(2)} and resistance near ${explanation.resistance.toFixed(2)} framed liquidity at ${explanation.liquidityAbove.toFixed(2)} / ${explanation.liquidityBelow.toFixed(2)}.`,
    explanation.hadLiquidityGrab
      ? "A clear liquidity sweep appeared before directional expansion."
      : "Liquidity was tested without a full stop-hunt signature.",
    explanation.hadFakeout
      ? "Trap behavior existed: a break attempt failed and reversed."
      : "Trap behavior was limited; structure led the read.",
    `Volume confirmation was ${explanation.volumeConfirmation}.`,
    `Invalidation around ${explanation.invalidationLevel.toFixed(2)} and potential reaction area near ${explanation.potentialEntry.toFixed(2)} keep risk/reward structured.`,
    explanation.complexityNotes?.length
      ? `Complications present: ${explanation.complexityNotes.join(", ")}. The read was about which signal failed first, not which one appeared first.`
      : "Complications were limited, so level interaction and close quality carried more weight.",
    `Best directional read: "${directionLabel[correctDirection]}".`,
    "Common beginner misread: chasing the first expansion and ignoring failed reclaim/retest logic and invalidation discipline.",
    "Simulated training tool. Not financial advice.",
  ].join("\n\n");
}

export function buildKeyLessons(explanation: ExplanationData): string[] {
  return [
    `Map structure first: support ${explanation.support.toFixed(2)} / resistance ${explanation.resistance.toFixed(2)}.`,
    explanation.hadLiquidityGrab
      ? "Treat sweep-reclaim action as information about trapped liquidity."
      : "If no hard sweep appears, demand cleaner confirmation candles.",
    explanation.volumeConfirmation === "strong"
      ? "Strong volume on displacement improves continuation odds."
      : "Mixed/weak volume demands more patience and cleaner invalidation.",
    "Define invalidation before entry and preserve asymmetric risk/reward.",
  ];
}
