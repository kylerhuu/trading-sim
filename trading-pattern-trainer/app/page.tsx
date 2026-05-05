"use client";

import { useEffect, useMemo, useState } from "react";
import { TradingChart } from "@/components/TradingChart";
import { PredictionPanel } from "@/components/PredictionPanel";
import { StatsPanel } from "@/components/StatsPanel";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { AICoachPanel } from "@/components/AICoachPanel";
import { buildCoachExplanation, buildKeyLessons } from "@/lib/trading/explanations";
import { generateScenarioWithFilters, getAllScenarioTags, getScenariosByTags } from "@/lib/trading/generator";
import { loadStats, saveStats, updateStats } from "@/lib/stats";
import {
  AttemptRecord,
  Confidence,
  defaultStats,
  Difficulty,
  Direction,
  CoachAnalyzeOutput,
  CoachPrecheckOutput,
  Candle,
  Scenario,
  ScenarioTag,
  ScenarioType,
} from "@/lib/trading/types";

const predictionOptions: { id: Direction; label: string }[] = [
  { id: "up", label: "Price goes up" },
  { id: "down", label: "Price goes down" },
  { id: "sideways", label: "Stay sideways / uncertain" },
];

const difficultyOptions: Difficulty[] = ["beginner", "intermediate", "advanced"];
const replaySpeedOptions = [
  { label: "Slow", ms: 360 },
  { label: "Normal", ms: 180 },
  { label: "Fast", ms: 90 },
];
const allPatternTags = getAllScenarioTags();

function getScenarioTagColor(s: string) {
  if (s.includes("trap") || s.includes("fake")) return "bg-amber-500/20 text-amber-300";
  if (s.includes("reversal") || s.includes("sweep")) return "bg-purple-500/20 text-purple-300";
  if (s.includes("break")) return "bg-sky-500/20 text-sky-300";
  return "bg-emerald-500/20 text-emerald-300";
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [selectedTags, setSelectedTags] = useState<ScenarioTag[]>([]);
  const [allowedScenarioTypes, setAllowedScenarioTypes] = useState<ScenarioType[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [displayedFutureCount, setDisplayedFutureCount] = useState(0);
  const [prediction, setPrediction] = useState<Direction | null>(null);
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasScoredCurrentScenario, setHasScoredCurrentScenario] = useState(false);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);
  const [revealSpeedMs, setRevealSpeedMs] = useState(180);
  const [showTrendLines, setShowTrendLines] = useState(true);
  const [coachExplanation, setCoachExplanation] = useState("");
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [isLoadingPrecheck, setIsLoadingPrecheck] = useState(false);
  const [isLoadingPostAnalyze, setIsLoadingPostAnalyze] = useState(false);
  const [precheckAnalysis, setPrecheckAnalysis] = useState<CoachPrecheckOutput | null>(null);
  const [postAnalyze, setPostAnalyze] = useState<CoachAnalyzeOutput | null>(null);
  const [history, setHistory] = useState<AttemptRecord[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      const initialAllowed = getScenariosByTags([]);
      setAllowedScenarioTypes(initialAllowed);
      setHistory(loadStats());
      setScenario(generateScenarioWithFilters({ difficulty: "beginner", allowedScenarioTypes: initialAllowed }));
    });
  }, []);

  useEffect(() => {
    if (!scenario) return;
    if (!isSubmitted) return;
    if (isPlaybackPaused) return;
    if (displayedFutureCount >= scenario.candlesAfter.length) return;
    const timer = window.setTimeout(() => {
      setDisplayedFutureCount((prev) => Math.min(prev + 1, scenario.candlesAfter.length));
    }, revealSpeedMs);
    return () => window.clearTimeout(timer);
  }, [displayedFutureCount, isSubmitted, isPlaybackPaused, revealSpeedMs, scenario]);

  const shownCandles = useMemo(() => {
    if (!scenario) return [];
    if (!isSubmitted) return scenario.candlesBefore;
    return [...scenario.candlesBefore, ...scenario.candlesAfter.slice(0, displayedFutureCount)];
  }, [displayedFutureCount, isSubmitted, scenario]);

  const stats = useMemo(() => updateStats(history), [history]);
  const isCorrect = scenario !== null && prediction !== null && prediction === scenario.correctDirection;

  const keyLessons = useMemo(() => {
    if (!isSubmitted || !scenario) return [];
    return buildKeyLessons(scenario.explanationData);
  }, [isSubmitted, scenario]);

  function createNewScenario(nextDifficulty = difficulty, nextAllowed = allowedScenarioTypes) {
    if (!mounted) return;
    setScenario(
      generateScenarioWithFilters({
        difficulty: nextDifficulty,
        allowedScenarioTypes: nextAllowed,
      }),
    );
    setDisplayedFutureCount(0);
    setPrediction(null);
    setConfidence("medium");
    setIsSubmitted(false);
    setIsPlaybackPaused(false);
    setHasScoredCurrentScenario(false);
    setCoachExplanation("");
    setIsLoadingExplanation(false);
    setIsLoadingPrecheck(false);
    setIsLoadingPostAnalyze(false);
    setPrecheckAnalysis(null);
    setPostAnalyze(null);
  }

  function buildIndicatorPayload(candles: Candle[]) {
    const close = candles.map((c) => c.close);
    const fastMA = close.map((_, i) => {
      const from = Math.max(0, i - 6);
      const slice = close.slice(from, i + 1);
      return slice.reduce((a, v) => a + v, 0) / Math.max(1, slice.length);
    });
    const slowMA = close.map((_, i) => {
      const from = Math.max(0, i - 17);
      const slice = close.slice(from, i + 1);
      return slice.reduce((a, v) => a + v, 0) / Math.max(1, slice.length);
    });
    const bands = close.map((_, i) => {
      const from = Math.max(0, i - 19);
      const slice = close.slice(from, i + 1);
      const mean = slice.reduce((a, v) => a + v, 0) / Math.max(1, slice.length);
      const variance = slice.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, slice.length);
      const std = Math.sqrt(variance);
      return { upper: mean + std * 2, lower: mean - std * 2 };
    });
    return {
      fastMA,
      slowMA,
      bands: { upper: bands.map((b) => b.upper), lower: bands.map((b) => b.lower) },
      volume: candles.map((c) => c.volume),
    };
  }

  async function runPreRevealCoach() {
    if (!scenario || isSubmitted) return;
    setIsLoadingPrecheck(true);
    try {
      const response = await fetch("/api/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candlesBefore: scenario.candlesBefore,
          indicators: buildIndicatorPayload(scenario.candlesBefore),
          difficulty,
          scenarioMetadata: {
            scenarioType: scenario.scenarioType,
            tags: scenario.scenarioTags,
            intensity: scenario.intensity,
          },
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { analysis?: CoachPrecheckOutput };
        if (data.analysis) setPrecheckAnalysis(data.analysis);
      }
    } finally {
      setIsLoadingPrecheck(false);
    }
  }

  async function onSubmitPrediction() {
    if (!scenario || prediction === null || isSubmitted) return;
    setIsSubmitted(true);
    if (!hasScoredCurrentScenario) {
      const nextHistory = [...history, { prediction, confidence, wasCorrect: isCorrect }];
      setHistory(nextHistory);
      saveStats(nextHistory);
      setHasScoredCurrentScenario(true);
    }

    const fallback = buildCoachExplanation({
      scenarioType: scenario.scenarioType,
      explanation: scenario.explanationData,
      correctDirection: scenario.correctDirection,
    });
    setCoachExplanation(fallback);
    setIsLoadingExplanation(true);
    setIsLoadingPostAnalyze(true);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioType: scenario.scenarioType,
          difficulty,
          candlesBefore: scenario.candlesBefore,
          candlesAfter: scenario.candlesAfter,
          userPrediction: prediction,
          correctDirection: scenario.correctDirection,
          explanationData: scenario.explanationData,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { explanation?: string };
        if (data.explanation) setCoachExplanation(data.explanation);
      }
      const fullCandles = [...scenario.candlesBefore, ...scenario.candlesAfter];
      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candlesBefore: scenario.candlesBefore,
          candlesAfter: scenario.candlesAfter,
          indicators: buildIndicatorPayload(fullCandles),
          scenarioMetadata: {
            scenarioType: scenario.scenarioType,
            tags: scenario.scenarioTags,
            intensity: scenario.intensity,
            macroBias: scenario.macroBias,
          },
          userPrediction: prediction,
          correctDirection: scenario.correctDirection,
          difficulty,
          revealedAnnotations: scenario.annotations,
        }),
      });
      if (analyzeResponse.ok) {
        const data = (await analyzeResponse.json()) as { analysis?: CoachAnalyzeOutput };
        if (data.analysis) setPostAnalyze(data.analysis);
      }
    } catch {
      // fallback already set
    } finally {
      setIsLoadingExplanation(false);
      setIsLoadingPostAnalyze(false);
    }
  }

  function togglePatternTag(tag: ScenarioTag) {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    const nextAllowed = getScenariosByTags(nextTags);
    setSelectedTags(nextTags);
    setAllowedScenarioTypes(nextAllowed);
    createNewScenario(difficulty, nextAllowed);
  }

  if (!mounted || !scenario) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl p-6 space-y-4">
          <div className="h-20 animate-pulse rounded-xl bg-slate-900/60" />
          <div className="h-[520px] animate-pulse rounded-xl bg-slate-900/60" />
          <div className="h-48 animate-pulse rounded-xl bg-slate-900/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
        <header className="rounded-xl border border-slate-800 bg-slate-900/70 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Trading Pattern Trainer</h1>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-700 px-3 py-1 uppercase">Difficulty: {difficulty}</span>
              <span className="rounded-full border border-slate-700 px-3 py-1">Accuracy: {stats.accuracyPct}%</span>
              <span className="rounded-full border border-slate-700 px-3 py-1">Streak: {stats.currentStreak}</span>
              {isSubmitted && (
                <span className={`rounded-full border px-3 py-1 ${isCorrect ? "border-emerald-500 text-emerald-300" : "border-rose-500 text-rose-300"}`}>
                  Result: {isCorrect ? "Correct" : "Incorrect"}
                </span>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Practice chart reading with randomized structure, traps, and confirmations.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400">Scenario pattern</span>
              <div className="flex flex-wrap justify-end gap-2">
                {isSubmitted ? (
                  <>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${getScenarioTagColor(
                        scenario.scenarioType,
                      )}`}
                    >
                      {scenario.scenarioType.replaceAll("-", " ")}
                    </span>
                    {scenario.scenarioTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase">
                        {tag}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">Hidden until reveal</span>
                )}
              </div>
            </div>
            <TradingChart
              candles={shownCandles}
              overlayOptions={scenario.overlayOptions}
              showTrendLines={showTrendLines}
              showAnnotations={isSubmitted}
              annotations={scenario.annotations}
            />
          </div>

          <aside className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">Difficulty</p>
              <div className="grid grid-cols-3 gap-2">
                {difficultyOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDifficulty(d);
                      createNewScenario(d);
                    }}
                    className={`rounded-md border px-3 py-2 text-sm capitalize transition ${
                      difficulty === d
                        ? "border-sky-400 bg-sky-500/20 text-sky-100"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-300">Pattern tags (filter toggle)</p>
                <button
                  onClick={() => {
                    setSelectedTags([]);
                    const nextAllowed = getScenariosByTags([]);
                    setAllowedScenarioTypes(nextAllowed);
                    createNewScenario(difficulty, nextAllowed);
                  }}
                  className="text-xs text-slate-400 underline hover:text-slate-200"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {allPatternTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => togglePatternTag(tag)}
                    className={`rounded-full border px-3 py-1 text-xs uppercase transition ${
                      selectedTags.includes(tag)
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Active filters: {selectedTags.length || "none"} | Matching scenarios: {allowedScenarioTypes.length}
              </p>
            </div>

            <PredictionPanel
              prediction={prediction}
              confidence={confidence}
              isSubmitted={isSubmitted}
              onPrediction={setPrediction}
              onConfidence={setConfidence}
              onSubmit={onSubmitPrediction}
              onNext={() => createNewScenario()}
            />
            {!isSubmitted && (
              <button
                onClick={() => runPreRevealCoach()}
                className="w-full rounded-md border border-indigo-400 bg-indigo-500/15 px-3 py-2 text-sm text-indigo-100 hover:bg-indigo-500/25"
              >
                Coach me before reveal
              </button>
            )}

            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
              <p className="mb-2 text-sm font-medium text-slate-200">Reveal playback</p>
              <div className="grid grid-cols-3 gap-2">
                {replaySpeedOptions.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setRevealSpeedMs(opt.ms)}
                    className={`rounded-md border px-2 py-1 transition ${
                      revealSpeedMs === opt.ms
                        ? "border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100"
                        : "border-slate-700 bg-slate-900 hover:bg-slate-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsPlaybackPaused((v) => !v)}
                  disabled={!isSubmitted}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 disabled:opacity-45"
                >
                  {isPlaybackPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={() => setDisplayedFutureCount(scenario.candlesAfter.length)}
                  disabled={!isSubmitted}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 disabled:opacity-45"
                >
                  Reveal all
                </button>
              </div>
              <button
                onClick={() => setShowTrendLines((v) => !v)}
                className={`mt-2 w-full rounded-md border px-2 py-1 transition ${
                  showTrendLines
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                    : "border-slate-700 bg-slate-900 hover:bg-slate-800"
                }`}
              >
                Trend lines: {showTrendLines ? "On" : "Off"}
              </button>
            </div>

            <StatsPanel stats={stats || defaultStats} />
          </aside>
        </section>

        {isSubmitted && (
          <ExplanationPanel
            isCorrect={isCorrect}
            correctLabel={predictionOptions.find((p) => p.id === scenario.correctDirection)?.label ?? "Unknown"}
            displayedFutureCount={displayedFutureCount}
            futureTotal={scenario.candlesAfter.length}
            coachExplanation={coachExplanation}
            isLoadingExplanation={isLoadingExplanation}
            keyLessons={keyLessons}
          />
        )}
        <AICoachPanel
          precheck={precheckAnalysis}
          postAnalyze={postAnalyze}
          isLoadingPrecheck={isLoadingPrecheck}
          isLoadingPostAnalyze={isLoadingPostAnalyze}
          isSubmitted={isSubmitted}
        />
        <p className="text-center text-xs text-slate-500">Simulated training tool. Not financial advice.</p>
      </div>
    </div>
  );
}
