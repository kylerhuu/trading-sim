# Trading Pattern Trainer

Interactive chart-reading practice app built with Next.js, React, TypeScript, TailwindCSS, and `lightweight-charts`.

## Features

- Randomized candlestick scenarios (40-80 setup candles + 10-20 outcome candles)
- Scenario families: trend continuation, breakouts, fakeouts, liquidity sweeps, reversals, traps
- Prediction flow: up / down / sideways with confidence
- Animated reveal playback with speed controls, pause/resume, and reveal-all
- Pattern tag filters with toggles
- Coach-style post-trade explanation and key lessons
- Local stats persistence with streak and confidence-vs-accuracy tracking

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional AI Coach (OpenAI)

Create `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
```

If the API call fails or key is missing, the app automatically uses a local fallback explanation.

## Production Validation

```bash
npm run lint
npm run build
```

## Simple Vercel Deployment

1. Push this folder to a Git repository (GitHub/GitLab/Bitbucket).
2. In Vercel, click **Add New Project** and import the repo.
3. Framework preset: **Next.js** (auto-detected).
4. Build settings:
   - Build command: `npm run build`
   - Output: default (`.next`)
5. Deploy.

Optional env var for AI explanations:

- `OPENAI_API_KEY`
