import { Confidence, Direction } from "@/lib/trading/types";

const predictionOptions: { id: Direction; label: string }[] = [
  { id: "up", label: "Price goes up" },
  { id: "down", label: "Price goes down" },
  { id: "sideways", label: "Stay sideways / uncertain" },
];
const confidenceOptions: Confidence[] = ["low", "medium", "high"];

interface PredictionPanelProps {
  prediction: Direction | null;
  confidence: Confidence;
  isSubmitted: boolean;
  onPrediction: (d: Direction) => void;
  onConfidence: (c: Confidence) => void;
  onSubmit: () => void;
  onNext: () => void;
}

export function PredictionPanel(props: PredictionPanelProps) {
  const { prediction, confidence, isSubmitted, onPrediction, onConfidence, onSubmit, onNext } = props;
  return (
    <>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-300">Your prediction</p>
        <div className="space-y-2">
          {predictionOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onPrediction(option.id)}
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
              onClick={() => onConfidence(level)}
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
          onClick={onSubmit}
          disabled={prediction === null || isSubmitted}
          className="w-full rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Submit
        </button>
        <button
          onClick={onNext}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
        >
          Next chart
        </button>
      </div>
    </>
  );
}
