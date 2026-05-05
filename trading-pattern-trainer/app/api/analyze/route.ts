import { NextRequest, NextResponse } from "next/server";
import { Candle, CoachAnalyzeOutput, Difficulty, Direction, ScenarioAnnotation } from "@/lib/trading/types";

interface AnalyzeRequestBody {
  candlesBefore: Candle[];
  candlesAfter: Candle[];
  indicators: {
    fastMA: number[];
    slowMA: number[];
    bands?: { upper: number[]; lower: number[] };
    volume: number[];
  };
  scenarioMetadata: Record<string, unknown>;
  userPrediction: Direction;
  correctDirection: Direction;
  difficulty: Difficulty;
  revealedAnnotations: ScenarioAnnotation[];
}

function fallbackAnalyze(body: AnalyzeRequestBody): CoachAnalyzeOutput {
  const verdict = body.userPrediction === body.correctDirection ? "Your read aligned with the result." : "Your read was reasonable but invalidated.";
  return {
    summary: `${verdict} Outcome formed through trap-and-confirmation sequencing, not a single clean signal.`,
    bias: body.correctDirection === "up" ? "bullish" : body.correctDirection === "down" ? "bearish" : "uncertain",
    confidence: 0.61,
    keyPoints: ["Structure shifted after trap behavior.", "Volume expanded on directional candles.", "Key level reaction mattered more than first impulse."],
    whatToWatch: ["Retest quality at broken levels.", "Whether price holds above/below fast MA.", "Follow-through after sweep events."],
    trapWarnings: ["Breakout can fail after first confirmation.", "MA cross can trap when volume fades."],
    conceptsUsed: ["market structure", "liquidity sweep", "moving average interaction", "volume confirmation", "invalidation"],
    beginnerMistakes: ["Chasing first breakout candle.", "Ignoring failed retest signal."],
    whyOutcomeHappened: "The directional move strengthened only after trap attempts failed and confirmation candles held key levels.",
    alternateScenario: "If reclaim had held with stronger volume, price could have rotated into a squeeze rather than trend continuation.",
    riskLesson: "Treat setup quality probabilistically and define invalidation before entry.",
    chartQualityFeedback: {
      realismScore: 74,
      issues: ["Some transitions were cleaner than real intraday flow."],
      suggestedGeneratorTweaks: ["Add extra failed continuation around MA retests.", "Increase ambiguous chop before expansion in 20-30% of charts."],
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeRequestBody;
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ analysis: fallbackAnalyze(body), source: "fallback" });
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      required: [
        "summary",
        "bias",
        "confidence",
        "keyPoints",
        "whatToWatch",
        "trapWarnings",
        "conceptsUsed",
        "beginnerMistakes",
        "whyOutcomeHappened",
        "alternateScenario",
        "riskLesson",
        "chartQualityFeedback",
      ],
      properties: {
        summary: { type: "string" },
        bias: { type: "string", enum: ["bullish", "bearish", "uncertain"] },
        confidence: { type: "number" },
        keyPoints: { type: "array", items: { type: "string" } },
        whatToWatch: { type: "array", items: { type: "string" } },
        trapWarnings: { type: "array", items: { type: "string" } },
        conceptsUsed: { type: "array", items: { type: "string" } },
        beginnerMistakes: { type: "array", items: { type: "string" } },
        whyOutcomeHappened: { type: "string" },
        alternateScenario: { type: "string" },
        riskLesson: { type: "string" },
        chartQualityFeedback: {
          type: "object",
          additionalProperties: false,
          required: ["realismScore", "issues", "suggestedGeneratorTweaks"],
          properties: {
            realismScore: { type: "number" },
            issues: { type: "array", items: { type: "string" } },
            suggestedGeneratorTweaks: { type: "array", items: { type: "string" } },
          },
        },
      },
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are a trading education coach. This is simulated data. Do not give financial advice. Analyze price action probabilistically. Do not say a setup guarantees anything. Focus on structure, liquidity, FVGs, MAs, volume, traps, confirmation, invalidation, and uncertainty.",
          },
          {
            role: "user",
            content: `Post-reveal analysis. Input:\n${JSON.stringify(body)}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "analyze_output",
            strict: true,
            schema,
          },
        },
        max_output_tokens: 1200,
      }),
    });

    if (!response.ok) return NextResponse.json({ analysis: fallbackAnalyze(body), source: "fallback" });
    const data = await response.json();
    const parsed = (data.output_parsed ?? (data.output_text ? JSON.parse(data.output_text) : undefined)) as
      | CoachAnalyzeOutput
      | undefined;
    if (!parsed) return NextResponse.json({ analysis: fallbackAnalyze(body), source: "fallback" });
    return NextResponse.json({ analysis: parsed, source: "openai" });
  } catch {
    return NextResponse.json({
      analysis: fallbackAnalyze({
        candlesBefore: [],
        candlesAfter: [],
        indicators: { fastMA: [], slowMA: [], volume: [] },
        scenarioMetadata: {},
        userPrediction: "sideways",
        correctDirection: "sideways",
        difficulty: "beginner",
        revealedAnnotations: [],
      }),
      source: "fallback",
    });
  }
}
