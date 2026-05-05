import { CoachAnalyzeOutput, CoachPrecheckOutput } from "@/lib/trading/types";

export function AICoachPanel(props: {
  precheck: CoachPrecheckOutput | null;
  postAnalyze: CoachAnalyzeOutput | null;
  isLoadingPrecheck: boolean;
  isLoadingPostAnalyze: boolean;
  isSubmitted: boolean;
}) {
  const { precheck, postAnalyze, isLoadingPrecheck, isLoadingPostAnalyze, isSubmitted } = props;
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold">AI Coach</h2>
      {!isSubmitted && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          {isLoadingPrecheck && <p className="text-xs text-slate-400">Analyzing pre-reveal setup...</p>}
          {!precheck ? (
            <p className="text-slate-400">Run pre-reveal coach mode to inspect bullish/bearish/uncertain clues before outcome is shown.</p>
          ) : (
            <div className="space-y-3">
              <p>{precheck.summary}</p>
              <p><span className="text-emerald-300">Bullish clues:</span> {precheck.bullishClues.join(" | ")}</p>
              <p><span className="text-rose-300">Bearish clues:</span> {precheck.bearishClues.join(" | ")}</p>
              <p><span className="text-amber-300">Uncertain clues:</span> {precheck.uncertainClues.join(" | ")}</p>
              <p><span className="text-sky-300">Key levels:</span> {precheck.keyLevels.join(" | ")}</p>
            </div>
          )}
        </div>
      )}
      {isSubmitted && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          {isLoadingPostAnalyze && <p className="text-xs text-slate-400">Loading AI Coach analysis...</p>}
          {!postAnalyze ? (
            <p className="text-slate-400">AI coach analysis unavailable.</p>
          ) : (
            <div className="space-y-3">
              <p><span className="font-semibold">Quick read:</span> {postAnalyze.summary}</p>
              <p><span className="font-semibold">Bias:</span> {postAnalyze.bias} ({Math.round(postAnalyze.confidence * 100)}%)</p>
              <p><span className="font-semibold">Key points:</span> {postAnalyze.keyPoints.join(" | ")}</p>
              <p><span className="font-semibold">What to watch:</span> {postAnalyze.whatToWatch.join(" | ")}</p>
              <p><span className="font-semibold">Trap warnings:</span> {postAnalyze.trapWarnings.join(" | ")}</p>
              <p><span className="font-semibold">Beginner mistakes:</span> {postAnalyze.beginnerMistakes.join(" | ")}</p>
              <p><span className="font-semibold">Why outcome happened:</span> {postAnalyze.whyOutcomeHappened}</p>
              <p><span className="font-semibold">Risk lesson:</span> {postAnalyze.riskLesson}</p>
              <div className="rounded border border-slate-700 p-2">
                <p className="font-semibold">Generator realism feedback</p>
                <p>Score: {postAnalyze.chartQualityFeedback.realismScore}</p>
                <p>Issues: {postAnalyze.chartQualityFeedback.issues.join(" | ")}</p>
                <p>Tweaks: {postAnalyze.chartQualityFeedback.suggestedGeneratorTweaks.join(" | ")}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
