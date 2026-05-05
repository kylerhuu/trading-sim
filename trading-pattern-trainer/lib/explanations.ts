import { Direction, ExplanationData, ScenarioType } from "./types";

const scenarioLabels: Record<ScenarioType, string> = {
  "uptrend-continuation": "Uptrend continuation",
  "downtrend-continuation": "Downtrend continuation",
  "range-consolidation": "Range / consolidation",
  breakout: "Breakout",
  "fake-breakout": "Fake breakout",
  "liquidity-grab-stop-hunt": "Liquidity grab / stop hunt",
  "reversal-after-sweep": "Reversal after sweep",
  "higher-low-lower-high": "Higher low / lower high structure",
  "support-resistance-bounce": "Support / resistance bounce",
  "trendline-break": "Trendline break",
  "bull-trap-bear-trap": "Bull trap / bear trap",
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

  const liquidityText = explanation.hadLiquidityGrab
    ? "A clear liquidity sweep was present, where price probed beyond a prior swing and quickly reclaimed."
    : "Liquidity sat near obvious swing extremes, but the reaction was more orderly than a hard stop-hunt.";

  const fakeoutText = explanation.hadFakeout
    ? "The setup also featured trap behavior: initial breakout intent failed and trapped late participants."
    : "Break behavior was cleaner, with less evidence of immediate trap mechanics.";

  const volumeText =
    explanation.volumeConfirmation === "strong"
      ? "Volume expanded into the decisive move, which improved conviction."
      : explanation.volumeConfirmation === "weak"
        ? "Volume did not confirm aggressively, so conviction needed to stay tempered."
        : "Volume was mixed, so confirmation depended more on candle closes and structure than raw participation.";

  return [
    `${scenarioLabels[scenarioType]} context: market structure leaned toward ${structureText}, with trend bias reading as ${explanation.trendBias}.`,
    `Support formed near ${explanation.support.toFixed(2)} while resistance sat near ${explanation.resistance.toFixed(2)}. Those levels framed the decision zone, and liquidity pockets were likely around ${explanation.liquidityAbove.toFixed(2)} (buyside) and ${explanation.liquidityBelow.toFixed(2)} (sellside).`,
    liquidityText,
    `Wick analysis: repeated rejection tails around key levels signaled absorption, while candle body quality showed where initiative participants were actually closing bars, not just spiking intrabar.`,
    `${fakeoutText} ${volumeText}`,
    `Potential execution framing (education only): wait for a reaction around ${explanation.potentialEntry.toFixed(2)}, then invalidate the idea beyond ${explanation.invalidationLevel.toFixed(2)}. Think in risk multiples first and avoid forcing trades with poor asymmetry.`,
    `Why the best directional read was "${directionLabel[correctDirection]}": post-signal follow-through and acceptance favored that path over the alternatives.`,
    `Common beginner misread: focusing on a single dramatic candle while ignoring whether structure, level reclaim/hold, and volume agreement were aligned.`,
    `Nuance and trap awareness: many losing reads come from entering before confirmation, chasing late into liquidity, or treating a wick break as a true breakout without a strong close.`,
    "This analysis is for chart-reading practice and education only, not financial advice.",
  ].join("\n\n");
}

export function buildKeyLessons(explanation: ExplanationData): string[] {
  return [
    `Map the range first: support near ${explanation.support.toFixed(2)}, resistance near ${explanation.resistance.toFixed(2)}.`,
    explanation.hadLiquidityGrab
      ? "Treat sweep-and-reclaim action as information about trapped positioning."
      : "Use wick rejection around extremes to judge whether breakout pressure is accepted.",
    explanation.volumeConfirmation === "strong"
      ? "When volume expands with closes, continuation odds generally improve."
      : "When volume is weak/mixed, demand stronger close confirmation before committing.",
    "Define invalidation before entry; if invalidated, move on instead of averaging down.",
  ];
}
