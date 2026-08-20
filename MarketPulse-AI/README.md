# MarketPulse AI

A complete end-to-end machine-learning financial market prediction platform for **XAUUSD (Gold/USD)** daily bars.

---

## Project Summary

| Item | Detail |
|------|--------|
| **Dataset** | XAUUSD D1 OHLCV · 2013-07-17 → 2021-09-03 · 2,010 bars after feature engineering |
| **Source** | MetaTrader 5 export (provided by user) |
| **Split** | Train 70% · Val 15% · Test 15% (chronological, no shuffle) |
| **Best model** | XGBoost Classifier (selected by validation ROC-AUC) |
| **Test accuracy** | 57.4% — better than random, typical for pure-TA financial ML |
| **Test ROC-AUC** | 0.5921 |
| **Features engineered** | 37 technical indicators (RSI, MACD, EMA, SMA, Bollinger, ATR, volatility, momentum, candle structure) |
| **Backend** | Node.js + Express (TypeScript) — artifacts/api-server |
| **Frontend** | React + Vite (TypeScript) — artifacts/marketpulse-ai |

---

## Project Architecture

```
Code-Companion/
├── artifacts/
│   ├── api-server/           ← Express API (TypeScript)
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── market-data.ts     ← All ML logic, indicators, backtest
│   │   │   │   └── xauusd-data.ts     ← Embedded XAUUSD D1 dataset
│   │   │   └── routes/
│   │   │       └── market.ts          ← All API endpoints
│   │   └── model-data/
│   │       └── metadata.json          ← Trained model metrics & config
│   │
│   └── marketpulse-ai/       ← React frontend (Vite)
│       └── src/
│           ├── pages/
│           │   ├── dashboard.tsx       ← Live price, candlestick, prediction
│           │   ├── prediction.tsx      ← AI prediction + explainability
│           │   ├── analytics.tsx       ← Backtest + profit simulation
│           │   ├── performance.tsx     ← Model metrics, confusion matrix
│           │   └── settings.tsx        ← Indicator customization, CSV upload
│           └── components/
│               └── marketpulse-ui.tsx  ← Shared UI library
│
├── MarketPulse-AI/           ← Python ML pipeline (standalone)
│   ├── training/
│   │   ├── features.py        ← Technical feature engineering
│   │   ├── train.py           ← Full ML training pipeline
│   │   ├── build_dataset.py   ← Dataset cleaning
│   │   └── generate_data.py   ← Data loader / synthetic fallback
│   └── data/                  ← Place XAUUSD-D1.csv here
│
└── lib/                       ← Shared TypeScript packages
    ├── api-zod/               ← Zod schemas for API contracts
    └── api-client-react/      ← Generated React Query hooks
```

---

## Running the Application (Replit)

The project is designed to run on **Replit** with the `nodejs-24` + `python-base-3.13` stack.

### Start the backend
```bash
cd artifacts/api-server
pnpm run dev
# Server starts on port 3000
# API available at http://localhost:3000/api/
```

### Start the frontend
```bash
cd artifacts/marketpulse-ai
pnpm run dev
# Vite dev server starts on port 5173
```

### Or use the Replit Run button
The `.replit` file is configured to start both services together.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| GET | `/api/market-data` | OHLCV candles (`?limit=120`) |
| GET | `/api/indicators` | Technical indicator snapshot |
| GET | `/api/prediction` | AI direction prediction (`?rsiPeriod=14&macdFast=12&macdSlow=26`) |
| GET | `/api/feature-explanations` | XAI feature contributions |
| GET | `/api/performance` | Model evaluation metrics |
| GET | `/api/analytics` | Historical accuracy, calibration, trend |
| GET | `/api/backtest` | Profit simulation (`?capital=10000&threshold=0.55`) |
| GET | `/api/model-info` | Model name, version, feature list |

---

## Indicator Customization

All indicator parameters can be passed as query string to `/api/prediction`:

```
/api/prediction?rsiPeriod=7&macdFast=8&macdSlow=21&macdSignal=5&bbWindow=14&atrPeriod=10
```

From the UI: **Settings → Indicator parameters** — drag sliders and click "Apply to prediction".

---

## Python ML Pipeline (standalone)

If you have Python 3.9+ with pandas, scikit-learn, and xgboost:

### Install dependencies
```bash
cd MarketPulse-AI
pip install -r requirements.txt
```

### Run the pipeline
```bash
# 1. Place your XAUUSD-D1.csv in data/ (or it generates synthetic data)
python training/generate_data.py    # produces data/XAUUSD_clean.csv

# 2. Train all models
python training/train.py            # trains LR, RF, XGBoost, MLP; saves models/
```

### Output artifacts
- `models/best_model.pkl` — serialised best model
- `models/scaler.pkl` — StandardScaler
- `models/metadata.json` — metrics, feature importance, split info
- `reports/test_predictions.json` — per-bar predictions on test set

---

## Retraining the Model

1. Replace `data/XAUUSD-D1.csv` with a newer export from MetaTrader
2. Run `python training/generate_data.py`
3. Run `python training/train.py`
4. Copy `models/metadata.json` → `artifacts/api-server/model-data/metadata.json`
5. Restart the API server

---

## CSV Upload (from the UI)

**Settings → CSV data upload** accepts any OHLCV CSV with at minimum these columns (case-insensitive):
- `open` / `high` / `low` / `close`
- Optionally: `volume`, `date`

MetaTrader (`<DTYYYYMMDD>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>`), Investing.com, and Yahoo Finance formats are all supported.

---

## Features Engineered (37 total)

| Category | Features |
|----------|---------|
| Price action | returns, log_returns, body_size, hl_range, upper_wick, lower_wick, body_direction |
| Momentum | ret_1d, ret_2d, ret_3d, ret_5d, ret_10d |
| Volume | vol_ratio |
| Moving averages | dist_ema9, dist_ema21, dist_sma20, dist_sma50, dist_sma100, ema9_vs_ema21, ema21_vs_sma50, price_vs_sma50, price_vs_sma200 |
| RSI | rsi, rsi_prev, rsi_delta |
| MACD | macd, macd_signal, macd_hist, macd_cross |
| Bollinger Bands | bb_width, bb_pct |
| Volatility | atr_pct, volatility_10, volatility_20 |
| Calendar | day_of_week, month, quarter |

---

## Model Comparison (test set)

| Model | Accuracy | F1 | ROC-AUC |
|-------|----------|-----|---------|
| Logistic Regression | 51.2% | 52.1% | 51.9% |
| Random Forest | 54.5% | 56.3% | 55.4% |
| **XGBoost** | **57.4%** | **60.5%** | **59.2%** |
| Neural Network (MLP) | 53.7% | 55.3% | 54.4% |

> XGBoost won on validation AUC and was selected as the production model.

---

## Important Disclaimers

- **57% accuracy** is above random but not sufficient for live trading without extensive further validation
- All metrics are real, computed on a genuinely held-out chronological test set
- No look-ahead bias — features only use data available at the time of prediction
- This is a **research and educational tool only**, not financial advice
- Past model performance does not guarantee future results

---

## Extending the Platform

### Adding a new asset (e.g. EURUSD)
1. Add EURUSD data to `xauusd-data.ts` with an `EURUSD_D1` export
2. In `market-data.ts`, switch the active dataset based on the `asset` query param
3. Train a separate model and add its metadata to `model-data/`

### Adding live data
The backend is designed so `getMarketData()` can be swapped to call a live API — the frontend architecture doesn't change.

### Adding news sentiment
The Settings page has a sentiment toggle stub. Wire `/api/sentiment` returning `{ score: number, headline: string, source: string }` and integrate the score into `computeProbability()`.
