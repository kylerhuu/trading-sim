import { NextRequest, NextResponse } from "next/server";
import { Candle, CoachPrecheckOutput, Difficulty } from "@/lib/trading/types";

interface PrecheckRequestBody {
  candlesBefore: Candle[];
  indicators: {
    fastMA: number[];
    slowMA: number[];
    bands?: { upper: number[]; lower: number[] };
    volume: number[];
  };
  difficulty: Difficulty;
  scenarioMetadata?: Record<string, unknown>;
}

function fallbackPrecheck(body: PrecheckRequestBody): CoachPrecheckOutput {
  const recent = body.candlesBefore.slice(-18);
  const highs = recent.map((c) => c.high);
  const lows = recent.map((c) => c.low);
  const support = (lows.length ? Math.min(...lows) : 0).toFixed(2);
  const resistance = (highs.length ? Math.max(...highs) : 0).toFixed(2);
  return {
    summary: "Mixed pre-reveal structure with trap risk around recent extremes.",
    bullishClues: ["Reclaims above fast MA after a sweep low.", "Higher lows hold above local support."],
    bearishClues: ["Failed breakout wicks near resistance.", "Slow MA rejection with weak closes."],
    uncertainClues: ["Conflicting MA slope and structure.", "Volume is not decisive on pushes."],
    keyLevels: [`Support ${support}`, `Resistance ${resistance}`],
    confirmUp: ["Close and hold above resistance with volume expansion.", "Retest holds above fast MA."],
    confirmDown: ["Break and close below support.", "Failed reclaim under slow MA after breakdown."],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PrecheckRequestBody;
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ analysis: fallbackPrecheck(body), source: "fallback" });
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["summary", "bullishClues", "bearishClues", "uncertainClues", "keyLevels", "confirmUp", "confirmDown"],
      properties: {
        summary: { type: "string" },
        bullishClues: { type: "array", items: { type: "string" } },
        bearishClues: { type: "array", items: { type: "string" } },
        uncertainClues: { type: "array", items: { type: "string" } },
        keyLevels: { type: "array", items: { type: "string" } },
        confirmUp: { type: "array", items: { type: "string" } },
        confirmDown: { type: "array", items: { type: "string" } },
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
              "You are a trading education coach. This is simulated data. Do not give financial advice. Analyze probabilistically. Focus on structure, liquidity, FVGs, MAs, volume, traps, confirmation, invalidation, and uncertainty.",
          },
          {
            role: "user",
            content: `Pre-reveal analysis only. Do not infer future candles. Input:\n${JSON.stringify(body)}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "precheck_output",
            strict: true,
            schema,
          },
        },
        max_output_tokens: 700,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ analysis: fallbackPrecheck(body), source: "fallback" });
    }
    const data = await response.json();
    const parsed = (data.output_parsed ?? (data.output_text ? JSON.parse(data.output_text) : undefined)) as
      | CoachPrecheckOutput
      | undefined;
    if (!parsed) return NextResponse.json({ analysis: fallbackPrecheck(body), source: "fallback" });
    return NextResponse.json({ analysis: parsed, source: "openai" });
  } catch {
    return NextResponse.json({ analysis: fallbackPrecheck({ candlesBefore: [], indicators: { fastMA: [], slowMA: [], volume: [] }, difficulty: "beginner" }), source: "fallback" });
  }
}
