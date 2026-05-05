export function ExplanationPanel(props: {
  isCorrect: boolean;
  correctLabel: string;
  displayedFutureCount: number;
  futureTotal: number;
  coachExplanation: string;
  isLoadingExplanation: boolean;
  keyLessons: string[];
}) {
  const { isCorrect, correctLabel, displayedFutureCount, futureTotal, coachExplanation, isLoadingExplanation, keyLessons } = props;
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Result</p>
        <p className={`mt-1 text-lg font-semibold ${isCorrect ? "text-emerald-300" : "text-rose-300"}`}>
          {isCorrect ? "Correct read." : "Not this time."} Correct direction: {correctLabel}
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Future candles revealed: {displayedFutureCount}/{futureTotal}
        </p>
      </div>
      <div>
        <h2 className="mb-2 text-lg font-semibold">Coach Explanation</h2>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm leading-6 whitespace-pre-line text-slate-200">
          {isLoadingExplanation && <p className="mb-3 text-xs text-slate-400">Loading AI explanation...</p>}
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
  );
}
