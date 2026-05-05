export type Direction = "up" | "down" | "sideways";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Confidence = "low" | "medium" | "high";

export type ScenarioType =
  | "uptrend-continuation"
  | "downtrend-continuation"
  | "range-consolidation"
  | "breakout"
  | "fake-breakout"
  | "liquidity-grab-stop-hunt"
  | "reversal-after-sweep"
  | "higher-low-lower-high"
  | "support-resistance-bounce"
  | "trendline-break"
  | "bull-trap-bear-trap";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExplanationData {
  trendBias: Direction;
  support: number;
  resistance: number;
  liquidityAbove: number;
  liquidityBelow: number;
  hadLiquidityGrab: boolean;
  hadFakeout: boolean;
  volumeConfirmation: "strong" | "weak" | "mixed";
  marketStructure: "hh-hl" | "lh-ll" | "range";
  invalidationLevel: number;
  potentialEntry: number;
  riskRewardHint: string;
  keySignals: string[];
}

export interface Scenario {
  candlesBefore: Candle[];
  candlesAfter: Candle[];
  correctDirection: Direction;
  scenarioType: ScenarioType;
  explanationData: ExplanationData;
}

export interface AttemptRecord {
  prediction: Direction;
  confidence: Confidence;
  wasCorrect: boolean;
}

export interface TrainerStats {
  totalAttempts: number;
  correctAnswers: number;
  accuracyPct: number;
  currentStreak: number;
  bestStreak: number;
  confidenceAccuracy: Record<Confidence, { attempts: number; accuracyPct: number }>;
}
