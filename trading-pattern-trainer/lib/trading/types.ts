export type Direction = "up" | "down" | "sideways";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Confidence = "low" | "medium" | "high";
export type IntensityLevel = "calm" | "normal" | "volatile" | "chaotic" | "liquidation";
export type CandlePurpose =
  | "normal"
  | "doji"
  | "sweep"
  | "displacement"
  | "retest"
  | "pullback"
  | "chop";

export type Phase =
  | "range"
  | "liquidity-build"
  | "liquidity-sweep"
  | "displacement"
  | "pullback"
  | "outcome";

export type MarketState = "accumulation" | "distribution" | "trend" | "reversal" | "chop";
export type MacroBias = "macro-uptrend" | "macro-downtrend" | "macro-range" | "macro-distribution" | "macro-accumulation";
export type MesoSetup =
  | "pullback-into-fvg"
  | "range-breakout"
  | "fakeout"
  | "liquidity-sweep"
  | "trend-continuation"
  | "reversal-attempt"
  | "compression-expansion";
export type MicroEvent =
  | "wick-rejection"
  | "doji-indecision"
  | "small-pullback"
  | "failed-push"
  | "short-consolidation"
  | "tiny-liquidity-grab";

export type ScenarioType =
  | "trend-continuation-after-pullback"
  | "reversal-after-liquidity-sweep"
  | "breakout-retest"
  | "failed-breakout-trap"
  | "range-accumulation"
  | "range-distribution"
  | "compression-expansion"
  | "news-liquidation-candle"
  | "long-squeeze"
  | "short-squeeze"
  | "choppy-low-confidence-fake-setup"
  | "fair-value-gap-imbalance"
  | "break-of-structure"
  | "change-of-character";

export type ScenarioTag =
  | "trend"
  | "continuation"
  | "reversal"
  | "range"
  | "breakout"
  | "fakeout"
  | "liquidity"
  | "structure"
  | "support-resistance"
  | "trap";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  metadata?: {
    purpose?: CandlePurpose;
    liquiditySweep?: boolean;
    fairValueGap?: boolean;
    breakOfStructure?: boolean;
    changeOfCharacter?: boolean;
    stopHunt?: boolean;
    trap?: boolean;
    imbalance?: boolean;
    orderBlock?: boolean;
  };
}

export type AnnotationType =
  | "liquidity-sweep"
  | "fair-value-gap"
  | "support"
  | "resistance"
  | "break-of-structure"
  | "change-of-character"
  | "trap"
  | "entry"
  | "invalidation";

export interface ScenarioAnnotation {
  type: AnnotationType;
  label: string;
  time?: number;
  price?: number;
  startTime?: number;
  endTime?: number;
  high?: number;
  low?: number;
}

export interface ExplanationData {
  macroTrend?: MacroBias;
  currentStructure?: MesoSetup;
  recentStructureEvent?: "bos" | "choch" | "none";
  fvgSummaries?: string[];
  liquiditySummaries?: string[];
  complexityNotes?: string[];
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
  macroBias: MacroBias;
  intensity: IntensityLevel;
  shortTermBias: Direction;
  confidenceScore: number;
  scenarioType: ScenarioType;
  scenarioTags: ScenarioTag[];
  overlayOptions: {
    showVwap: boolean;
    showBands: boolean;
  };
  explanationData: ExplanationData;
  annotations: ScenarioAnnotation[];
}

export interface CoachAnalyzeOutput {
  summary: string;
  bias: "bullish" | "bearish" | "uncertain";
  confidence: number;
  keyPoints: string[];
  whatToWatch: string[];
  trapWarnings: string[];
  conceptsUsed: string[];
  beginnerMistakes: string[];
  whyOutcomeHappened: string;
  alternateScenario: string;
  riskLesson: string;
  chartQualityFeedback: {
    realismScore: number;
    issues: string[];
    suggestedGeneratorTweaks: string[];
  };
}

export interface CoachPrecheckOutput {
  summary: string;
  bullishClues: string[];
  bearishClues: string[];
  uncertainClues: string[];
  keyLevels: string[];
  confirmUp: string[];
  confirmDown: string[];
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

export const defaultStats: TrainerStats = {
  totalAttempts: 0,
  correctAnswers: 0,
  accuracyPct: 0,
  currentStreak: 0,
  bestStreak: 0,
  confidenceAccuracy: {
    low: { attempts: 0, accuracyPct: 0 },
    medium: { attempts: 0, accuracyPct: 0 },
    high: { attempts: 0, accuracyPct: 0 },
  },
};
