# MarketPulse AI

MarketPulse AI is a transparent AI-powered market-analysis dashboard for
XAUUSD price data, technical indicators, model predictions, explainability,
performance metadata, and future live-data integrations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/marketpulse-ai` — React/Vite frontend and routes
- `artifacts/api-server/src/routes/market.ts` — market analysis API routes
- `artifacts/api-server/src/lib/market-data.ts` — sample data and model metadata contract
- `artifacts/api-server/model-data` — Colab model drop zone and metadata guide
- `lib/api-spec/openapi.yaml` — API source of truth
- `README.md` — full continuation guide for humans and AI agents

## Architecture decisions

- OpenAPI is the source of truth; generated React Query hooks and Zod schemas are used on both sides.
- The first build runs safely without a trained model using clearly labelled sample data.
- Model performance and explainability are unavailable until imported metadata exists; no numbers are fabricated.
- XAUUSD is the initial asset, but asset and timeframe preferences are persisted independently of page components.
- A future Python inference service should preserve the metadata-defined feature ordering and validation contract.

## Product

The app has dashboard, prediction, performance, analytics, and settings pages.
It provides sample OHLCV data, technical indicators, a directional preview,
CSV validation, model status, and explicit placeholders for live feeds and
news sentiment.

## Chart image demo

The `/chart-analysis` route accepts PNG/JPEG TradingView screenshots. The
browser performs one local visual scan of colored candle regions, vertical
price span, latest price position, and left-to-right trajectory, then sends only
the derived measurements to `POST /api/chart-analysis`. The server combines
those measurements with the XAUUSD D1 calibrated baseline and ATR to return a
model-anchored price band plus bullish-continuation, sideways, and
bearish-continuation scenarios. Images are not persisted and no external AI
call is made, so each scan uses zero AI credits. The page also includes a
generated demo chart so the workflow can be demonstrated without a live
TradingView account.

This is intentionally a two-stage educational system: screenshot pixels provide
context, while the OHLCV model is the learned baseline. Absolute prices are
only labeled as model-anchored estimates unless a readable numeric axis is
available; the result is not OCR, a guaranteed target, or financial advice.

## Reproducible training

The Python pipeline lives under `MarketPulse-AI/training`. It loads
`MarketPulse-AI/data/XAUUSD-D1.csv`, builds 37 technical features, performs a
chronological 70/15/15 split, trains Logistic Regression, Random Forest,
XGBoost, and MLP candidates, selects the best validation ROC-AUC model, and
writes serialized artifacts to `MarketPulse-AI/models/`.

```bash
cd MarketPulse-AI
python training/generate_data.py
python training/train.py
```

The bundled source CSV is a small export, so `generate_data.py` transparently
adds a deterministic synthetic continuation to reach a usable training window.
The generated metadata and test predictions are kept beside the model artifacts
for a college demonstration and should be replaced with a larger real export
before any serious evaluation.

## User preferences

- Keep the product suitable for a college data-science demonstration while
  making it feel like a professional SaaS product.
- Never present predictions as guaranteed prices or financial advice.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
