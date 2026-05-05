import { NextRequest, NextResponse } from "next/server";
import { buildCoachExplanation } from "@/lib/trading/explanations";
import { Candle, Difficulty, Direction, ExplanationData, ScenarioType } from "@/lib/trading/types";

interface ExplainRequestBody {
  scenarioType: ScenarioType;
  difficulty: Difficulty;
  candlesBefore: Candle[];
  candlesAfter: Candle[];
  userPrediction: Direction;
  correctDirection: Direction;
  explanationData: ExplanationData;
}

function buildFallback(body: ExplainRequestBody): string {
  const base = buildCoachExplanation({
    scenarioType: body.scenarioType,
    explanation: body.explanationData,
    correctDirection: body.correctDirection,
  });
  const verdict = body.userPrediction === body.correctDirection ? "Your read aligned with the outcome." : "Your read did not align with the outcome.";
  return `${verdict}\n\n${base}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExplainRequestBody;
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ explanation: buildFallback(body), source: "fallback" });
    }

    const prompt = `
You are a trading coach for an educational chart simulator (not financial advice).
Analyze this setup and explain in detail:
- market structure
- bullish/bearish/uncertain bias
- liquidity zones and sweeps
- fair value gaps/imbalances
- wick and body behavior
- break of structure and change of character
- volume behavior
- trap or failed move risk
- what beginners misread
- why user prediction was right/wrong
- risk/reward and invalidation
- one key lesson

Scenario Type: ${body.scenarioType}
Difficulty: ${body.difficulty}
User Prediction: ${body.userPrediction}
Correct Direction: ${body.correctDirection}
Explanation Data: ${JSON.stringify(body.explanationData)}
Recent candlesBefore tail: ${JSON.stringify(body.candlesBefore.slice(-18))}
candlesAfter: ${JSON.stringify(body.candlesAfter)}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        max_output_tokens: 700,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ explanation: buildFallback(body), source: "fallback" });
    }

    const data = await response.json();
    const explanation: string | undefined = data.output_text;
    if (!explanation) {
      return NextResponse.json({ explanation: buildFallback(body), source: "fallback" });
    }

    return NextResponse.json({ explanation, source: "openai" });
  } catch {
    return NextResponse.json(
      {
        explanation:
          "Chart coach temporarily unavailable. Focus on structure, liquidity sweeps, confirmation closes, and invalidation discipline. Simulated training tool. Not financial advice.",
        source: "fallback",
      },
      { status: 200 },
    );
  }
}
