import { Confidence, TrainerStats } from "@/lib/trading/types";

const confidenceOptions: Confidence[] = ["low", "medium", "high"];

export function StatsPanel({ stats }: { stats: TrainerStats }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm">
      <p className="mb-2 font-medium text-slate-200">Stats</p>
      <div className="grid grid-cols-2 gap-y-1 text-slate-300">
        <span>Total attempts</span><span className="text-right">{stats.totalAttempts}</span>
        <span>Correct answers</span><span className="text-right">{stats.correctAnswers}</span>
        <span>Accuracy</span><span className="text-right">{stats.accuracyPct}%</span>
        <span>Current streak</span><span className="text-right">{stats.currentStreak}</span>
        <span>Best streak</span><span className="text-right">{stats.bestStreak}</span>
      </div>
      <div className="mt-3 border-t border-slate-700 pt-2 text-xs text-slate-400">
        <p>Confidence vs accuracy</p>
        {confidenceOptions.map((level) => (
          <p key={level}>
            {level}: {stats.confidenceAccuracy[level].accuracyPct}% ({stats.confidenceAccuracy[level].attempts} attempts)
          </p>
        ))}
      </div>
    </div>
  );
}
