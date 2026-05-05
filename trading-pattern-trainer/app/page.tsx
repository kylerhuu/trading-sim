"use client";

import { useEffect, useMemo, useState } from "react";
import { CandlestickChart } from "@/components/CandlestickChart";
import { buildCoachExplanation, buildKeyLessons } from "@/lib/explanations";
import { generateScenario } from "@/lib/generator";
import { computeStats, loadAttemptHistory, saveAttemptHistory } from "@/lib/stats";
import { AttemptRecord, Confidence, Difficulty, Direction, Scenario } from "@/lib/types";

const predictionOptions: { id: Direction; label: string }[] = [
  { id: "up", label: "Price goes up" },
  { id: "down", label: "Price goes down" },
  { id: "sideways", label: "Stay sideways / uncertain" },
];

const confidenceOptions: Confidence[] = ["low", "medium", "high"];
const difficultyOptions: Difficulty[] = ["beginner", "intermediate", "advanced"];

function getScenarioTagColor(s: string) {
  if (s.includes("trap") || s.includes("fake")) return "bg-amber-500/20 text-amber-300";
  if (s.includes("reversal") || s.includes("sweep")) return "bg-purple-500/20 text-purple-300";
  if (s.includes("break")) return "bg-sky-500/20 text-sky-300";
  return "bg-emerald-500/20 text-emerald-300";
}

export default function Home() {
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [scenario, setScenario] = useState<Scenario>(() => generateScenario("beginner"));
  const [displayedFutureCount, setDisplayedFutureCount] = useState(0);
  const [prediction, setPrediction] = useState<Direction | null>(null);
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [history, setHistory] = useState<AttemptRecord[]>(() =>
    typeof window === "undefined" ? [] : loadAttemptHistory(),
  );

  useEffect(() => {
    if (!isSubmitted) return;
    if (displayedFutureCount >= scenario.candlesAfter.length) return;
    const timer = window.setTimeout(() => {
      setDisplayedFutureCount((prev) => Math.min(prev + 1, scenario.candlesAfter.length));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [displayedFutureCount, isSubmitted, scenario.candlesAfter.length]);

  const shownCandles = useMemo(() => {
    if (!isSubmitted) return scenario.candlesBefore;
    return [...scenario.candlesBefore, ...scenario.candlesAfter.slice(0, displayedFutureCount)];
  }, [displayedFutureCount, isSubmitted, scenario.candlesAfter, scenario.candlesBefore]);

  const stats = useMemo(() => computeStats(history), [history]);
  const isCorrect = prediction !== null && prediction === scenario.correctDirection;

  const coachExplanation = useMemo(() => {
    if (!isSubmitted) return "";
    return buildCoachExplanation({
      scenarioType: scenario.scenarioType,
      explanation: scenario.explanationData,
      correctDirection: scenario.correctDirection,
    });
  }, [isSubmitted, scenario]);

  const keyLessons = useMemo(() => {
    if (!isSubmitted) return [];
    return buildKeyLessons(scenario.explanationData);
  }, [isSubmitted, scenario.explanationData]);

  function createNewScenario(nextDifficulty = difficulty) {
    setScenario(generateScenario(nextDifficulty));
    setDisplayedFutureCount(0);
    setPrediction(null);
    setConfidence("medium");
    setIsSubmitted(false);
  }

  function onSubmitPrediction() {
    if (prediction === null || isSubmitted) return;
    setIsSubmitted(true);
    const nextHistory = [...history, { prediction, confidence, wasCorrect: isCorrect }];
    setHistory(nextHistory);
    saveAttemptHistory(nextHistory);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
        <header className="rounded-xl border border-slate-800 bg-slate-900/70 px-5 py-4">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Trading Pattern Trainer</h1>
          <p className="mt-1 text-sm text-slate-400">
            Practice chart reading with randomized structure, traps, and confirmations.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400">Scenario pattern</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${getScenarioTagColor(
                  scenario.scenarioType,
                )}`}
              >
                {scenario.scenarioType.replaceAll("-", " ")}
              </span>
            </div>
            <CandlestickChart candles={shownCandles} />
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
              <p className="mb-2 text-sm font-medium text-slate-300">Your prediction</p>
              <div className="space-y-2">
                {predictionOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setPrediction(option.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                      prediction === option.id
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">Confidence</p>
              <div className="grid grid-cols-3 gap-2">
                {confidenceOptions.map((level) => (
                  <button
                    key={level}
                    onClick={() => setConfidence(level)}
                    className={`rounded-md border px-2 py-2 text-xs font-medium uppercase tracking-wide transition ${
                      confidence === level
                        ? "border-violet-400 bg-violet-500/20 text-violet-100"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={onSubmitPrediction}
                disabled={prediction === null || isSubmitted}
                className="w-full rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Submit
              </button>
              <button
                onClick={() => createNewScenario()}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
              >
                Next chart
              </button>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm">
              <p className="mb-2 font-medium text-slate-200">Stats</p>
              <div className="grid grid-cols-2 gap-y-1 text-slate-300">
                <span>Total attempts</span>
                <span className="text-right">{stats.totalAttempts}</span>
                <span>Correct answers</span>
                <span className="text-right">{stats.correctAnswers}</span>
                <span>Accuracy</span>
                <span className="text-right">{stats.accuracyPct}%</span>
                <span>Current streak</span>
                <span className="text-right">{stats.currentStreak}</span>
                <span>Best streak</span>
                <span className="text-right">{stats.bestStreak}</span>
              </div>
              <div className="mt-3 border-t border-slate-700 pt-2 text-xs text-slate-400">
                <p>Confidence vs accuracy</p>
                {confidenceOptions.map((level) => (
                  <p key={level}>
                    {level}: {stats.confidenceAccuracy[level].accuracyPct}% ({stats.confidenceAccuracy[level].attempts}{" "}
                    attempts)
                  </p>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {isSubmitted && (
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">Result</p>
              <p className={`mt-1 text-lg font-semibold ${isCorrect ? "text-emerald-300" : "text-rose-300"}`}>
                {isCorrect ? "Correct read." : "Not this time."} Correct direction:{" "}
                {predictionOptions.find((p) => p.id === scenario.correctDirection)?.label}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Future candles revealed: {displayedFutureCount}/{scenario.candlesAfter.length}
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-lg font-semibold">Coach Explanation</h2>
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm leading-6 whitespace-pre-line text-slate-200">
                {coachExplanation}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">Key Lessons</h3>
              <ul className="space-y-2 rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
                {keyLessons.map((lesson) => (
                  <li key={lesson}>- {lesson}</li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
