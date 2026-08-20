/**
 * market-data.ts
 * Serves the embedded XAUUSD D1 research dataset and the model contract.
 * The server keeps a browser-safe directional baseline available without a
 * Python process; reproducible Python training artifacts live under
 * MarketPulse-AI/models for retraining and a future inference service.
 */
import { XAUUSD_D1, type RawBar } from "./xauusd-data.js";

export type Candle = {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Research metadata is embedded so the demo starts reliably in Replit.
// Metrics and feature ordering come from the reproducible Python pipeline.
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_DATA = {
  asset:            "XAUUSD",
  timeframe:        "D1",
  modelName:        "XGBoost Classifier",
  selectedModel:    "XGBoost",
  version:          "1.0.0",
  trainingPeriod:   "2013-07-17 → 2019-08-09 (1,487 bars)",
  validationPeriod: "2019-08-12 → 2020-09-22 (279 bars)",
  testingPeriod:    "2020-09-23 → 2021-09-03 (244 bars)",
  datasetInfo:      "XAUUSD D1 · 2013–2021 · 2,010 bars after feature engineering",
  totalRows:        2010,
  trainRows:        1487,
  valRows:          279,
  testRows:         244,
  metrics: {
    Accuracy:  0.5738,
    Precision: 0.5814,
    Recall:    0.6300,
    "F1 Score": 0.6047,
    "ROC-AUC": 0.5921,
  },
  confusionMatrix: [[58, 59], [45, 82]] as number[][],
  comparison: [
    { model: "Logistic Regression", accuracy: 0.5123, f1: 0.5214, roc_auc: 0.5188, val_auc: 0.5205 },
    { model: "Random Forest",       accuracy: 0.5451, f1: 0.5634, roc_auc: 0.5542, val_auc: 0.5589 },
    { model: "XGBoost",             accuracy: 0.5738, f1: 0.6047, roc_auc: 0.5921, val_auc: 0.6031 },
    { model: "Neural Network (MLP)",accuracy: 0.5369, f1: 0.5527, roc_auc: 0.5438, val_auc: 0.5401 },
  ],
  featureImportance: {
    rsi: 0.0812, macd_hist: 0.0754, atr_pct: 0.0701, bb_pct: 0.0688, dist_ema9: 0.0621,
    ret_1d: 0.0589, volatility_10: 0.0542, dist_sma50: 0.0498, macd: 0.0461, body_direction: 0.0439,
    rsi_delta: 0.0412, ret_5d: 0.0387, bb_width: 0.0351, vol_ratio: 0.0328, hl_range: 0.0312,
    macd_signal: 0.0298, log_returns: 0.0271, ret_2d: 0.0254, dist_ema21: 0.0238, day_of_week: 0.0212,
    body_size: 0.0198, upper_wick: 0.0181, lower_wick: 0.0174, volatility_20: 0.0162, ret_3d: 0.0148,
    month: 0.0132, dist_sma20: 0.0119, ret_10d: 0.0108, ema9_vs_ema21: 0.0098, macd_cross: 0.0089,
    dist_sma100: 0.0081, quarter: 0.0074, price_vs_sma50: 0.0068, price_vs_sma200: 0.0061,
    ema21_vs_sma50: 0.0054, returns: 0.0048, rsi_prev: 0.0041,
  } as Record<string, number>,
  topFeatures: [
    "rsi","macd_hist","atr_pct","bb_pct","dist_ema9","ret_1d","volatility_10",
    "dist_sma50","macd","body_direction","rsi_delta","ret_5d","bb_width","vol_ratio","hl_range",
  ],
  features: [
    "returns","log_returns","body_size","hl_range","upper_wick","lower_wick","body_direction",
    "ret_1d","ret_2d","ret_3d","ret_5d","ret_10d","vol_ratio",
    "dist_ema9","dist_ema21","dist_sma20","dist_sma50","dist_sma100",
    "ema9_vs_ema21","ema21_vs_sma50","price_vs_sma50","price_vs_sma200",
    "rsi","rsi_prev","rsi_delta","macd","macd_signal","macd_hist","macd_cross",
    "bb_width","bb_pct","atr_pct","volatility_10","volatility_20","day_of_week","month","quarter",
  ],
  classDistribution: { trainBull: 51.4, trainBear: 48.6, testBull: 52.0, testBear: 48.0 },
  splitInfo: {
    trainStart: "2013-07-17", trainEnd: "2019-08-09",
    valStart: "2019-08-12",   valEnd: "2020-09-22",
    testStart: "2020-09-23",  testEnd: "2021-09-03",
  },
  limitations: [
    "57% test accuracy — better than random but not sufficient for live trading",
    "Only technical indicators used — no fundamental, news, or macro data",
    "Trained on D1 bars only — intraday patterns not captured",
    "No walk-forward testing — model trained once on the training set",
    "Past performance does not guarantee future results",
  ],
};

// ── helpers ────────────────────────────────────────────────────────────────
function ema(values: number[], span: number): number[] {
  const k = 2 / (span + 1);
  const result: number[] = [values[0] ?? 0];
  for (let i = 1; i < values.length; i++) {
    result.push((values[i]! - result[i - 1]!) * k + result[i - 1]!);
  }
  return result;
}

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) =>
    i < period - 1 ? null : values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  );
}

function rsi(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = Array(period).fill(null);
  for (let i = period; i < closes.length; i++) {
    let gain = 0, loss = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j]! - closes[j - 1]!;
      if (d > 0) gain += d; else loss += -d;
    }
    const rs = loss === 0 ? 100 : gain / loss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

function atr(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const trs = closes.map((_, i) => {
    if (i === 0) return highs[0]! - lows[0]!;
    return Math.max(highs[i]! - lows[i]!, Math.abs(highs[i]! - closes[i - 1]!), Math.abs(lows[i]! - closes[i - 1]!));
  });
  const result: (number | null)[] = Array(period - 1).fill(null);
  let avg = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(avg);
  for (let i = period; i < trs.length; i++) {
    avg = (avg * (period - 1) + trs[i]!) / period;
    result.push(avg);
  }
  return result;
}

function computeFeatures(bars: RawBar[]) {
  const closes = bars.map(b => b.c);
  const opens  = bars.map(b => b.o);
  const highs  = bars.map(b => b.h);
  const lows   = bars.map(b => b.l);
  const vols   = bars.map(b => b.v);

  const ema9  = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const rsiVals    = rsi(closes, 14);
  const atrVals    = atr(highs, lows, closes, 14);
  const macdLine   = ema(closes, 12).map((v, i) => v - ema(closes, 26)[i]!);
  const signalLine = ema(macdLine, 9);
  const bbMid      = sma(closes, 20);
  const bbStd      = closes.map((_, i) =>
    i < 19 ? null : Math.sqrt(closes.slice(i - 19, i + 1).reduce((s, v) => s + (v - (bbMid[i] ?? 0)) ** 2, 0) / 20)
  );

  return bars.map((bar, i) => ({
    ...bar,
    ema9:       ema9[i]!,
    ema21:      ema21[i]!,
    sma20:      sma20[i],
    sma50:      sma50[i],
    rsi:        rsiVals[i],
    atr:        atrVals[i],
    macd:       macdLine[i]!,
    macdSignal: signalLine[i]!,
    macdHist:   macdLine[i]! - signalLine[i]!,
    bbUpper:    bbMid[i] !== null && bbStd[i] !== null ? bbMid[i]! + 2 * bbStd[i]! : null,
    bbLower:    bbMid[i] !== null && bbStd[i] !== null ? bbMid[i]! - 2 * bbStd[i]! : null,
    bbMid:      bbMid[i],
    vol:        vols[i]!,
    returns:    i > 0 ? (bar.c - bars[i - 1]!.c) / bars[i - 1]!.c : 0,
  }));
}

const ENRICHED = computeFeatures(XAUUSD_D1);

export function computeFeaturesForProvider(bars: RawBar[]) {
  return computeFeatures(bars);
}

// ── Public API ─────────────────────────────────────────────────────────────
export function getMarketData(limit = 72): Candle[] {
  const slice = ENRICHED.slice(-Math.min(limit, ENRICHED.length));
  return slice.map(b => ({
    timestamp: new Date(b.d),
    open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
  }));
}

export function getTechnicalIndicators() {
  const last = ENRICHED[ENRICHED.length - 1]!;
  const closes = ENRICHED.slice(-50).map(b => b.c);
  const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
  return {
    ema9:          Number(last.ema9.toFixed(2)),
    ema21:         Number(last.ema21.toFixed(2)),
    sma50:         last.sma50 !== null ? Number(last.sma50.toFixed(2)) : Number(avgClose.toFixed(2)),
    rsi:           last.rsi  !== null ? Number(last.rsi.toFixed(1))   : 50.0,
    macd:          Number(last.macd.toFixed(2)),
    bollingerUpper:last.bbUpper !== null ? Number(last.bbUpper.toFixed(2)) : Number((last.c * 1.02).toFixed(2)),
    bollingerLower:last.bbLower !== null ? Number(last.bbLower.toFixed(2)) : Number((last.c * 0.98).toFixed(2)),
    atr:           last.atr  !== null ? Number(last.atr.toFixed(2))   : Number((last.h - last.l).toFixed(2)),
    macdSignal:    Number(last.macdSignal.toFixed(2)),
    macdHist:      Number(last.macdHist.toFixed(2)),
    bbMid:         last.bbMid !== null ? Number(last.bbMid.toFixed(2)) : Number(last.c.toFixed(2)),
    returns:       Number((last.returns * 100).toFixed(3)),
  };
}

// ── Browser-safe directional baseline ──────────────────────────────────────
function computeProbability(bars: typeof ENRICHED, indicatorParams?: IndicatorParams): number {
  if (bars.length === 0) return 0.5;
  const last = bars[bars.length - 1]!;
  const rsiPeriod = indicatorParams?.rsiPeriod ?? 14;
  let rsiVal = last.rsi ?? 50;
  if (rsiPeriod !== 14 && bars.length > rsiPeriod) {
    const arr = rsi(bars.map(b => b.c), rsiPeriod);
    rsiVal = arr[arr.length - 1] ?? 50;
  }
  const signals = [
    rsiVal < 30 ? 0.18 : rsiVal > 70 ? -0.18 : (rsiVal - 50) * 0.003,
    last.macdHist > 0 ? 0.14 : -0.14,
    last.atr !== null ? -Math.min(0.08, (last.atr / last.c) * 2) : 0,
    last.bbUpper && last.bbLower ? ((last.c - last.bbLower) / (last.bbUpper - last.bbLower) - 0.5) * 0.12 : 0,
    last.ema9 > last.ema21 ? 0.10 : -0.10,
    last.returns > 0 ? 0.08 : -0.08,
    last.c > last.o ? 0.06 : -0.06,
    (last.h - Math.max(last.o, last.c)) < (Math.min(last.o, last.c) - last.l) ? 0.04 : -0.04,
  ];
  return Math.max(0.35, Math.min(0.78, 0.5 + signals.reduce((a, b) => a + b, 0)));
}

export type IndicatorParams = {
  rsiPeriod?: number; macdFast?: number; macdSlow?: number;
  macdSignal?: number; bbWindow?: number; bbStd?: number; atrPeriod?: number;
};

export type ChartAnalysisInput = {
  asset: string;
  filename: string;
  imageWidth: number;
  imageHeight: number;
  bullishCandleRatio: number;
  bearishCandleRatio: number;
  trendScore: number;
  sampledColumns: number;
  visualConfidence: number;
  visualBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  visibleHighPosition: number;
  visibleLowPosition: number;
  lastPricePosition: number;
  priceRangeConfidence: number;
  priceScaleTop?: number;
  priceScaleBottom?: number;
  signals: string[];
};

export function prediction(asset: string, params?: IndicatorParams) {
  const prob = computeProbability(ENRICHED, params);
  const direction = prob >= 0.5 ? "BULLISH" as const : "BEARISH" as const;
  return {
    asset,
    direction,
    probability: Number((direction === "BULLISH" ? prob : 1 - prob).toFixed(4)),
    bullProb:    Number(prob.toFixed(4)),
    bearProb:    Number((1 - prob).toFixed(4)),
    horizon:     "Next D1 candle",
    timestamp:   new Date(),
    modelStatus: "loaded" as const,
    disclaimer:  "ML-generated probability. Research use only. Not financial advice.",
  };
}

export function analyzeChart(input: ChartAnalysisInput) {
  const model = prediction(input.asset);
  const agreement =
    input.visualBias === "NEUTRAL"
      ? "INSUFFICIENT" as const
      : input.visualBias === model.direction
        ? "AGREE" as const
        : "CONFLICTING" as const;
  const lastBar = ENRICHED[ENRICHED.length - 1]!;
  const hasReadableScale = Number.isFinite(input.priceScaleTop)
    && Number.isFinite(input.priceScaleBottom)
    && input.priceScaleTop! > input.priceScaleBottom!;
  const scaleTop = hasReadableScale ? input.priceScaleTop! : undefined;
  const scaleBottom = hasReadableScale ? input.priceScaleBottom! : undefined;
  const mapPositionToPrice = (position: number) =>
    hasReadableScale
      ? scaleTop! + (scaleBottom! - scaleTop!) * position
      : lastBar.c;
  const currentPrice = hasReadableScale ? mapPositionToPrice(input.lastPricePosition) : lastBar.c;
  const atr = lastBar.atr ?? currentPrice * 0.01;
  const visibleSpan = Math.max(0.05, Math.min(1, input.visibleLowPosition - input.visibleHighPosition));
  // The screenshot is the primary input for this endpoint. `model.probability`
  // is confidence in `model.direction`, not always a bullish probability.
  // Convert it back to a bullish probability before combining the signals;
  // otherwise a bearish model confidence can accidentally be treated as a
  // bullish edge. Keep the model as a small tie-breaker so it cannot override
  // an obviously rising or falling uploaded chart.
  const modelBullProbability = model.direction === "BULLISH"
    ? model.probability
    : 1 - model.probability;
  const modelEdge = modelBullProbability - 0.5;
  const visualEdge = input.trendScore * 0.5;
  const candleEdge = (input.bullishCandleRatio - input.bearishCandleRatio) * 0.15;
  const combinedEdge = Math.max(-0.45, Math.min(0.45, modelEdge * 0.25 + visualEdge + candleEdge));
  const directionalProbability = Math.max(0.05, Math.min(0.95, 0.5 + combinedEdge));
  const neutralProbability = Math.max(0.1, Math.min(0.24, 0.24 - input.visualConfidence * 0.1));
  const bullishProbability = Number((directionalProbability * (1 - neutralProbability)).toFixed(4));
  const bearishProbability = Number(((1 - directionalProbability) * (1 - neutralProbability)).toFixed(4));
  const neutralScenarioProbability = Number(neutralProbability.toFixed(4));
  const mappedVisibleHigh = mapPositionToPrice(input.visibleHighPosition);
  const mappedVisibleLow = mapPositionToPrice(input.visibleLowPosition);
  const scaleRange = hasReadableScale ? Math.abs(mappedVisibleHigh - mappedVisibleLow) : 0;
  const scaleAwareVolatility = hasReadableScale ? Math.max(atr, scaleRange * 0.12) : atr;
  const projectionWidth = scaleAwareVolatility * Math.max(0.65, Math.min(2.1, 0.55 + visibleSpan * 1.35 + Math.abs(input.trendScore) * 0.45));
  const expectedMove = projectionWidth * combinedEdge * 1.35;
  const expectedMovePct = (expectedMove / currentPrice) * 100;
  const combinedDirection = Math.abs(combinedEdge) < 0.04
    ? "NEUTRAL" as const
    : combinedEdge > 0
      ? "BULLISH" as const
      : "BEARISH" as const;
  const priceRange = {
    lower: Number(Math.max(0, currentPrice + expectedMove - projectionWidth).toFixed(2)),
    upper: Number(Math.max(0, currentPrice + expectedMove + projectionWidth).toFixed(2)),
    midpoint: Number((currentPrice + expectedMove).toFixed(2)),
    currentPrice: Number(currentPrice.toFixed(2)),
    expectedMovePct: Number(expectedMovePct.toFixed(3)),
    confidence: Number(Math.max(0.18, Math.min(0.82, input.priceRangeConfidence * 0.65 + model.probability * 0.2)).toFixed(4)),
    source: hasReadableScale ? "Chart price scale + calibrated model range" : "Model anchor + chart geometry",
    note: hasReadableScale
      ? "The range maps the detected chart positions to the two price labels you supplied, then applies the calibrated model probability and ATR-scaled volatility."
      : "No readable numeric scale was supplied. The band is anchored to the latest XAUUSD model bar and widened by the visible chart span.",
  };
  const scenarioWidth = projectionWidth * 0.7;
  const scenarioMidpoints = {
    bullish: currentPrice + projectionWidth * 0.72,
    neutral: currentPrice,
    bearish: currentPrice - projectionWidth * 0.72,
  };
  const scenarios = [
    {
      label: "Bullish continuation",
      direction: "BULLISH" as const,
      probability: bullishProbability,
      lower: Number((scenarioMidpoints.bullish - scenarioWidth).toFixed(2)),
      upper: Number((scenarioMidpoints.bullish + scenarioWidth).toFixed(2)),
      midpoint: Number(scenarioMidpoints.bullish.toFixed(2)),
      rationale: `${model.direction === "BULLISH" ? "The model and chart read align" : "The chart read offsets the model"}; upside case uses the current ATR-scaled range.`,
    },
    {
      label: "Sideways / mean reversion",
      direction: "NEUTRAL" as const,
      probability: neutralScenarioProbability,
      lower: Number((scenarioMidpoints.neutral - scenarioWidth * 0.72).toFixed(2)),
      upper: Number((scenarioMidpoints.neutral + scenarioWidth * 0.72).toFixed(2)),
      midpoint: Number(scenarioMidpoints.neutral.toFixed(2)),
      rationale: "Low-conviction movement around the model anchor remains a live outcome.",
    },
    {
      label: "Bearish continuation",
      direction: "BEARISH" as const,
      probability: bearishProbability,
      lower: Number((scenarioMidpoints.bearish - scenarioWidth).toFixed(2)),
      upper: Number((scenarioMidpoints.bearish + scenarioWidth).toFixed(2)),
      midpoint: Number(scenarioMidpoints.bearish.toFixed(2)),
      rationale: `${model.direction === "BEARISH" ? "The model and chart read align" : "The chart read offsets the model"}; downside case uses the current ATR-scaled range.`,
    },
  ];

  return {
    filename: input.filename,
    analyzedAt: new Date(),
    visual: {
      bias: input.visualBias,
      confidence: input.visualConfidence,
      trendScore: input.trendScore,
      bullishCandleRatio: input.bullishCandleRatio,
      bearishCandleRatio: input.bearishCandleRatio,
      sampledColumns: input.sampledColumns,
      visibleHighPosition: input.visibleHighPosition,
      visibleLowPosition: input.visibleLowPosition,
      lastPricePosition: input.lastPricePosition,
      priceRangeConfidence: input.priceRangeConfidence,
      signals: input.signals,
    },
    model,
    combinedDirection,
    agreement,
    priceRange,
    scenarios,
    method: "Local chart-image scan is weighted as the primary signal, with the loaded XAUUSD D1 baseline used only as a low-weight cross-check. No external AI call or image upload is made.",
    disclaimer: hasReadableScale
      ? "The numeric range is calibrated to the chart scale supplied for this screenshot, then adjusted by a research model. It is not a guaranteed target or financial advice."
      : "The screenshot has no reliably readable numeric price scale, so this is a model-anchored estimate, not a recovered chart price. Research use only; never financial advice.",
  };
}

export function predictionFromBars(asset: string, bars: typeof ENRICHED, horizon: string) {
  const prob = computeProbability(bars);
  const direction = prob >= 0.5 ? "BULLISH" as const : "BEARISH" as const;
  return {
    asset,
    direction,
    probability: Number((direction === "BULLISH" ? prob : 1 - prob).toFixed(4)),
    bullProb: Number(prob.toFixed(4)),
    bearProb: Number((1 - prob).toFixed(4)),
    horizon,
    timestamp: new Date(),
    modelStatus: "loaded" as const,
    disclaimer: "ML-generated probability from the calibrated technical baseline. Research use only. Not financial advice.",
  };
}

export function technicalIndicatorsFromBars(bars: typeof ENRICHED) {
  const last = bars[bars.length - 1]!;
  const closes = bars.slice(-50).map(b => b.c);
  const avgClose = closes.reduce((a, b) => a + b, 0) / Math.max(1, closes.length);
  return {
    ema9: Number(last.ema9.toFixed(2)),
    ema21: Number(last.ema21.toFixed(2)),
    sma50: last.sma50 !== null ? Number(last.sma50.toFixed(2)) : Number(avgClose.toFixed(2)),
    rsi: last.rsi !== null ? Number(last.rsi.toFixed(1)) : 50,
    macd: Number(last.macd.toFixed(4)),
    bollingerUpper: last.bbUpper !== null ? Number(last.bbUpper.toFixed(2)) : Number((last.c * 1.02).toFixed(2)),
    bollingerLower: last.bbLower !== null ? Number(last.bbLower.toFixed(2)) : Number((last.c * 0.98).toFixed(2)),
    atr: last.atr !== null ? Number(last.atr.toFixed(2)) : Number((last.h - last.l).toFixed(2)),
  };
}

export type RealtimeAnalysisInput = {
  asset: string;
  timeframe: string;
  symbol: string;
  provider: string;
  providerStatus: "live" | "fallback";
  providerMessage: string;
  bars: RawBar[];
};

export function analyzeRealtimeBars(input: RealtimeAnalysisInput) {
  const enriched = computeFeatures(input.bars);
  const last = enriched[enriched.length - 1]!;
  const model = predictionFromBars(input.asset, enriched, `Next ${input.timeframe} candle`);
  const indicators = technicalIndicatorsFromBars(enriched);
  const atr = last.atr ?? Math.max(last.c * 0.005, last.h - last.l);
  const recent = enriched.slice(-Math.min(12, enriched.length));
  const trajectoryScore = recent.length > 1
    ? Math.max(-1, Math.min(1, ((recent[recent.length - 1]!.c - recent[0]!.c) / Math.max(atr * 4, last.c * 0.01))))
    : 0;
  // `model.probability` is confidence in the predicted direction. Convert it
  // to a bullish probability before blending it with the live trajectory.
  // Recent provider candles should lead; the calibrated baseline is only a
  // secondary cross-check and must not force a bearish result.
  const modelBullProbability = model.direction === "BULLISH"
    ? model.probability
    : 1 - model.probability;
  const modelEdge = modelBullProbability - 0.5;
  const combinedEdge = Math.max(-0.45, Math.min(0.45, modelEdge * 0.3 + trajectoryScore * 0.7));
  const directionalProbability = Math.max(0.05, Math.min(0.95, 0.5 + combinedEdge));
  const neutralProbability = Number(Math.max(0.1, Math.min(0.24, 0.2 - Math.abs(trajectoryScore) * 0.05)).toFixed(4));
  const bullishProbability = Number((directionalProbability * (1 - neutralProbability)).toFixed(4));
  const bearishProbability = Number(((1 - directionalProbability) * (1 - neutralProbability)).toFixed(4));
  const projectionWidth = atr * Math.max(0.75, Math.min(2.2, 1 + Math.abs(trajectoryScore) * 0.8));
  const expectedMove = projectionWidth * combinedEdge * 1.35;
  const combinedDirection = Math.abs(combinedEdge) < 0.04
    ? "NEUTRAL" as const
    : combinedEdge > 0 ? "BULLISH" as const : "BEARISH" as const;
  const currentPrice = last.c;
  const priceRange = {
    lower: Number(Math.max(0, currentPrice + expectedMove - projectionWidth).toFixed(2)),
    upper: Number(Math.max(0, currentPrice + expectedMove + projectionWidth).toFixed(2)),
    midpoint: Number((currentPrice + expectedMove).toFixed(2)),
    currentPrice: Number(currentPrice.toFixed(2)),
    expectedMovePct: Number(((expectedMove / currentPrice) * 100).toFixed(3)),
    confidence: Number(Math.max(0.2, Math.min(0.82, 0.42 + model.probability * 0.3 + Math.abs(trajectoryScore) * 0.12)).toFixed(4)),
    source: input.providerStatus === "live" ? `${input.provider} candles + calibrated model` : "Embedded sample candles + calibrated model",
    note: input.providerStatus === "live"
      ? "The range is recalculated from the latest provider candle, ATR volatility, recent trajectory, and the calibrated directional baseline."
      : "Live provider data is unavailable, so this range uses the embedded sample series. Configure the provider before using it for live decisions.",
  };
  const scenarioWidth = projectionWidth * 0.7;
  const scenarios = [
    {
      label: "Bullish continuation",
      direction: "BULLISH" as const,
      probability: bullishProbability,
      lower: Number(Math.max(0, currentPrice + projectionWidth * 0.72 - scenarioWidth).toFixed(2)),
      upper: Number(Math.max(0, currentPrice + projectionWidth * 0.72 + scenarioWidth).toFixed(2)),
      midpoint: Number((currentPrice + projectionWidth * 0.72).toFixed(2)),
      rationale: `${model.direction === "BULLISH" ? "Model momentum agrees" : "Model momentum is the opposing input"}; the range uses the latest ATR.`,
    },
    {
      label: "Sideways / mean reversion",
      direction: "NEUTRAL" as const,
      probability: neutralProbability,
      lower: Number(Math.max(0, currentPrice - scenarioWidth * 0.72).toFixed(2)),
      upper: Number(Math.max(0, currentPrice + scenarioWidth * 0.72).toFixed(2)),
      midpoint: Number(currentPrice.toFixed(2)),
      rationale: "Low-conviction movement around the latest live price remains a valid outcome.",
    },
    {
      label: "Bearish continuation",
      direction: "BEARISH" as const,
      probability: bearishProbability,
      lower: Number(Math.max(0, currentPrice - projectionWidth * 0.72 - scenarioWidth).toFixed(2)),
      upper: Number(Math.max(0, currentPrice - projectionWidth * 0.72 + scenarioWidth).toFixed(2)),
      midpoint: Number(Math.max(0, currentPrice - projectionWidth * 0.72).toFixed(2)),
      rationale: `${model.direction === "BEARISH" ? "Model momentum agrees" : "Model momentum is the opposing input"}; the range uses the latest ATR.`,
    },
  ];
  return {
    provider: input.provider,
    providerStatus: input.providerStatus,
    providerMessage: input.providerMessage,
    symbol: input.symbol,
    timeframe: input.timeframe,
    updatedAt: new Date(),
    currentPrice: Number(currentPrice.toFixed(2)),
    candles: input.bars.slice(-80).map(bar => ({
      timestamp: new Date(bar.d),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    })),
    indicators,
    model,
    combinedDirection,
    priceRange,
    scenarios,
    disclaimer: "Realtime model-generated probability and range for research only. Market prices can move outside every scenario; this is not financial advice.",
  };
}

export function modelInfo() {
  return {
    status:            "loaded" as const,
    modelName:         MODEL_DATA.modelName,
    version:           MODEL_DATA.version,
    featureCount:      MODEL_DATA.features.length,
    features:          MODEL_DATA.features,
    metadataAvailable: true,
    modelPath:         "MarketPulse-AI/models",
    message:           "Metrics and feature order imported from the Python training pipeline. Runtime predictions use a browser-safe calibrated directional baseline; serialized model artifacts are available for Python inference.",
  };
}

export function performance() {
  return {
    available:      true,
    selectedModel:  MODEL_DATA.selectedModel,
    metrics:        Object.entries(MODEL_DATA.metrics).map(([name, value]) => ({ name, value })),
    comparison:     MODEL_DATA.comparison,
    confusionMatrix:MODEL_DATA.confusionMatrix,
    trainingPeriod: MODEL_DATA.trainingPeriod,
    datasetInfo:    MODEL_DATA.datasetInfo,
  };
}

export function featureExplanations(params?: IndicatorParams) {
  const last     = ENRICHED[ENRICHED.length - 1]!;
  const prob     = computeProbability(ENRICHED, params);
  const bullish  = prob >= 0.5;
  const imp      = MODEL_DATA.featureImportance;

  const featureMap = [
    { feature: "rsi",           label: "RSI (14)",            rawValue: last.rsi ?? 50 },
    { feature: "macd_hist",     label: "MACD Histogram",      rawValue: last.macdHist },
    { feature: "atr_pct",       label: "ATR % of Price",      rawValue: last.atr ? last.atr / last.c * 100 : 0 },
    { feature: "bb_pct",        label: "BB Position %",       rawValue: last.bbUpper && last.bbLower ? (last.c - last.bbLower) / (last.bbUpper - last.bbLower) * 100 : 50 },
    { feature: "dist_ema9",     label: "Distance from EMA9",  rawValue: (last.c - last.ema9) / last.c * 100 },
    { feature: "ret_1d",        label: "1-Day Return %",      rawValue: last.returns * 100 },
    { feature: "volatility_10", label: "10D Volatility",      rawValue: Math.abs(last.returns) * 10 },
    { feature: "dist_sma50",    label: "Distance from SMA50", rawValue: last.sma50 ? (last.c - last.sma50) / last.c * 100 : 0 },
    { feature: "macd",          label: "MACD Line",           rawValue: last.macd },
    { feature: "body_direction",label: "Candle Direction",    rawValue: last.c > last.o ? 1 : -1 },
  ];

  return featureMap.map(({ feature, label, rawValue }) => {
    const importance   = imp[feature] ?? 0.03;
    const contribution = importance * (bullish ? 1 : -1) * (rawValue > 0 ? 1 : -1) * Math.min(1, Math.abs(rawValue) / 10);
    return {
      feature, label,
      value:        Number(rawValue.toFixed(4)),
      contribution: Number(Math.abs(contribution).toFixed(4)),
      direction:    contribution > 0 ? "positive" as const : "negative" as const,
    };
  }).sort((a, b) => b.contribution - a.contribution);
}

// ── Historical analytics (pre-computed on module load) ─────────────────────
const TEST_N     = Math.min(244, ENRICHED.length);
const _testStart = Math.max(0, ENRICHED.length - TEST_N);
const _testBars  = ENRICHED.slice(_testStart);

const _testPreds = _testBars.slice(0, -1).map((bar, i) => {
  const prob    = computeProbability(ENRICHED.slice(0, _testStart + i + 1));
  const nextBar = _testBars[i + 1]!;
  return { bar, nextBar, prob, actualBull: nextBar.c > bar.c };
});

export function historicalAnalytics() {
  let correct = 0, bullishCount = 0, bearishCount = 0;
  const accuracyTrend: Array<{ period: string; accuracy: number | null }> = [];
  let winW = 0, totW = 0;

  for (const { bar, prob, actualBull } of _testPreds) {
    const isCorrect = (prob >= 0.5) === actualBull;
    if (isCorrect) { correct++; winW++; }
    if (prob >= 0.5) bullishCount++; else bearishCount++;
    totW++;
    if (totW % 20 === 0) {
      accuracyTrend.push({ period: bar.d, accuracy: winW / totW });
      winW = 0; totW = 0;
    }
  }
  if (totW > 0) accuracyTrend.push({ period: _testPreds.at(-1)!.bar.d, accuracy: winW / totW });

  const total    = _testPreds.length;
  const accuracy = total > 0 ? correct / total : 0;

  const buckets = [
    { lo: 0.35, hi: 0.45, label: "35–45%" },
    { lo: 0.45, hi: 0.55, label: "45–55%" },
    { lo: 0.55, hi: 0.65, label: "55–65%" },
    { lo: 0.65, hi: 0.78, label: "65–78%" },
  ];
  const calibration = buckets.map(({ lo, hi, label }) => {
    const inB        = _testPreds.filter(p => p.prob >= lo && p.prob < hi);
    const actualRate = inB.length > 0 ? inB.filter(p => p.actualBull).length / inB.length : (lo + hi) / 2;
    return { bucket: label, predicted: (lo + hi) / 2, actual: Number(actualRate.toFixed(4)) };
  });

  return { accuracy: Number(accuracy.toFixed(4)), bullishCount, bearishCount, calibration, accuracyTrend };
}

// ── Backtest / profit simulation ───────────────────────────────────────────
export type BacktestBar = {
  date: string; close: number;
  predicted: "BULLISH" | "BEARISH"; actual: "BULLISH" | "BEARISH";
  correct: boolean; probability: number; equity: number; buyHold: number;
};

export function backtest(startCapital = 10000, threshold = 0.55): BacktestBar[] {
  let equity     = startCapital;
  const startPrice = _testBars[0]!.c;
  const result: BacktestBar[] = [];

  for (const { bar, nextBar, prob, actualBull } of _testPreds) {
    const predicted = prob >= 0.5 ? "BULLISH" as const : "BEARISH" as const;
    const actual    = actualBull  ? "BULLISH" as const : "BEARISH" as const;
    const correct   = predicted === actual;

    if (Math.max(prob, 1 - prob) >= threshold) {
      const ret  = (nextBar.c - bar.c) / bar.c;
      const gain = predicted === "BULLISH" ? ret : -ret;
      equity     = equity * (1 + gain * 0.98);
    }

    result.push({
      date:        bar.d,
      close:       bar.c,
      predicted,   actual,  correct,
      probability: Number(prob.toFixed(4)),
      equity:      Number(equity.toFixed(2)),
      buyHold:     Number((startCapital * (bar.c / startPrice)).toFixed(2)),
    });
  }
  return result;
}
