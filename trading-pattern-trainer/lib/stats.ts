import { AttemptRecord, Confidence, TrainerStats } from "./types";

const STORAGE_KEY = "trading-pattern-trainer-attempts-v1";

function buildConfidenceStats(records: AttemptRecord[]): TrainerStats["confidenceAccuracy"] {
  const confidenceLevels: Confidence[] = ["low", "medium", "high"];
  return confidenceLevels.reduce(
    (acc, level) => {
      const subset = records.filter((r) => r.confidence === level);
      const correct = subset.filter((r) => r.wasCorrect).length;
      acc[level] = {
        attempts: subset.length,
        accuracyPct: subset.length ? Math.round((correct / subset.length) * 100) : 0,
      };
      return acc;
    },
    {
      low: { attempts: 0, accuracyPct: 0 },
      medium: { attempts: 0, accuracyPct: 0 },
      high: { attempts: 0, accuracyPct: 0 },
    },
  );
}

export function computeStats(records: AttemptRecord[]): TrainerStats {
  const totalAttempts = records.length;
  const correctAnswers = records.filter((r) => r.wasCorrect).length;
  const accuracyPct = totalAttempts ? Math.round((correctAnswers / totalAttempts) * 100) : 0;

  let currentStreak = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (!records[i].wasCorrect) break;
    currentStreak += 1;
  }

  let bestStreak = 0;
  let rolling = 0;
  for (const r of records) {
    if (r.wasCorrect) {
      rolling += 1;
      bestStreak = Math.max(bestStreak, rolling);
    } else {
      rolling = 0;
    }
  }

  return {
    totalAttempts,
    correctAnswers,
    accuracyPct,
    currentStreak,
    bestStreak,
    confidenceAccuracy: buildConfidenceStats(records),
  };
}

export function loadAttemptHistory(): AttemptRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AttemptRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveAttemptHistory(records: AttemptRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
