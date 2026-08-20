import { Router, type IRouter } from "express";
import {
  AnalyzeChartBody,
  AnalyzeChartResponse,
  GetRealtimeAnalysisQueryParams,
  GetRealtimeAnalysisResponse,
  GetFeatureExplanationsResponse,
  GetHistoricalAnalyticsResponse,
  GetMarketDataQueryParams,
  GetMarketDataResponse,
  GetModelInfoResponse,
  GetModelPerformanceResponse,
  GetPredictionQueryParams,
  GetPredictionResponse,
  GetTechnicalIndicatorsQueryParams,
  GetTechnicalIndicatorsResponse,
} from "@workspace/api-zod";
import {
  backtest,
  analyzeChart,
  featureExplanations,
  getMarketData,
  getTechnicalIndicators,
  computeFeaturesForProvider,
  predictionFromBars,
  technicalIndicatorsFromBars,
  historicalAnalytics,
  modelInfo,
  performance,
  prediction,
  type IndicatorParams,
  analyzeRealtimeBars,
} from "../lib/market-data.js";
import { fetchMarketCandles } from "../lib/bingx.js";
import { XAUUSD_D1 } from "../lib/xauusd-data.js";

const router: IRouter = Router();

// ── Market data ─────────────────────────────────────────────────────────────
router.get("/market-data", async (req, res): Promise<void> => {
  const parsed = GetMarketDataQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const live = await fetchMarketCandles(parsed.data.asset, parsed.data.timeframe, parsed.data.limit);
    res.json(GetMarketDataResponse.parse(live.bars.map(bar => ({
      timestamp: new Date(bar.d), open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v,
    }))));
  } catch (error) {
    req.log.warn({ err: error, asset: parsed.data.asset, timeframe: parsed.data.timeframe }, "Market data provider unavailable");
    if (parsed.data.asset !== "XAUUSD") {
      res.status(503).json({ error: `Live data for ${parsed.data.asset} is unavailable.` });
      return;
    }
    res.json(GetMarketDataResponse.parse(getMarketData(parsed.data.limit)));
  }
});

// ── Technical indicators ────────────────────────────────────────────────────
router.get("/indicators", async (req, res): Promise<void> => {
  const parsed = GetTechnicalIndicatorsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const live = await fetchMarketCandles(parsed.data.asset, parsed.data.timeframe, 120);
    res.json(GetTechnicalIndicatorsResponse.parse(technicalIndicatorsFromBars(computeFeaturesForProvider(live.bars))));
  } catch (error) {
    req.log.warn({ err: error, asset: parsed.data.asset, timeframe: parsed.data.timeframe }, "Indicator provider unavailable");
    if (parsed.data.asset !== "XAUUSD") {
      res.status(503).json({ error: `Live indicators for ${parsed.data.asset} are unavailable.` });
      return;
    }
    res.json(GetTechnicalIndicatorsResponse.parse(getTechnicalIndicators()));
  }
});

// ── Prediction ──────────────────────────────────────────────────────────────
router.get("/prediction", async (req, res): Promise<void> => {
  const parsed = GetPredictionQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const params: IndicatorParams = {
    rsiPeriod:  req.query.rsiPeriod  ? Number(req.query.rsiPeriod)  : undefined,
    macdFast:   req.query.macdFast   ? Number(req.query.macdFast)   : undefined,
    macdSlow:   req.query.macdSlow   ? Number(req.query.macdSlow)   : undefined,
    bbWindow:   req.query.bbWindow   ? Number(req.query.bbWindow)   : undefined,
    atrPeriod:  req.query.atrPeriod  ? Number(req.query.atrPeriod)  : undefined,
  };
  try {
    const live = await fetchMarketCandles(parsed.data.asset, "1D", 120);
    res.json(GetPredictionResponse.parse(predictionFromBars(parsed.data.asset, computeFeaturesForProvider(live.bars), "Next D1 candle")));
  } catch (error) {
    req.log.warn({ err: error, asset: parsed.data.asset }, "Prediction provider unavailable");
    if (parsed.data.asset !== "XAUUSD") {
      res.status(503).json({ error: `Live prediction for ${parsed.data.asset} is unavailable.` });
      return;
    }
    res.json(GetPredictionResponse.parse(prediction(parsed.data.asset, params)));
  }
});

// ── TradingView screenshot analysis ─────────────────────────────────────────
router.post("/chart-analysis", (req, res): void => {
  const parsed = AnalyzeChartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(AnalyzeChartResponse.parse(analyzeChart(parsed.data)));
});

// ── Realtime provider analysis ───────────────────────────────────────────────
router.get("/realtime-analysis", async (req, res): Promise<void> => {
  const parsed = GetRealtimeAnalysisQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { asset, timeframe, limit } = parsed.data;
  try {
    const live = await fetchMarketCandles(asset, timeframe, limit);
    res.json(GetRealtimeAnalysisResponse.parse(analyzeRealtimeBars({
      asset,
      timeframe,
      symbol: live.symbol,
      provider: live.provider,
      providerStatus: "live",
      providerMessage: `Latest candles fetched from ${live.provider} public market data.`,
      bars: live.bars,
    })));
  } catch (error) {
    req.log.warn({ err: error, asset, timeframe }, "Live market provider unavailable; using embedded sample data");
    if (asset !== "XAUUSD") {
      res.status(503).json({
        error: error instanceof Error
          ? `Live data for ${asset} is unavailable: ${error.message}`
          : `Live data for ${asset} is unavailable.`,
      });
      return;
    }
    const sampleBars = XAUUSD_D1.slice(-Math.min(limit, XAUUSD_D1.length));
    res.json(GetRealtimeAnalysisResponse.parse(analyzeRealtimeBars({
      asset, timeframe, symbol: asset, provider: "Embedded sample", providerStatus: "fallback",
      providerMessage: error instanceof Error ? `Live provider unavailable: ${error.message}` : "Live provider unavailable; embedded XAUUSD sample data is being shown.",
      bars: sampleBars,
    })));
  }
});

// ── Model info ──────────────────────────────────────────────────────────────
router.get("/model-info", (_req, res): void => {
  res.json(GetModelInfoResponse.parse(modelInfo()));
});

// ── Feature explanations ────────────────────────────────────────────────────
router.get("/feature-explanations", (req, res): void => {
  const params: IndicatorParams = {
    rsiPeriod: req.query.rsiPeriod ? Number(req.query.rsiPeriod) : undefined,
  };
  res.json(GetFeatureExplanationsResponse.parse(featureExplanations(params)));
});

// ── Performance metrics ─────────────────────────────────────────────────────
router.get("/performance", (_req, res): void => {
  res.json(GetModelPerformanceResponse.parse(performance()));
});

// ── Historical analytics ────────────────────────────────────────────────────
router.get("/analytics", (_req, res): void => {
  const data = historicalAnalytics();
  res.json(GetHistoricalAnalyticsResponse.parse(data));
});

// ── Backtest / profit simulation ────────────────────────────────────────────
router.get("/backtest", (req, res): void => {
  const capital   = req.query.capital   ? Number(req.query.capital)   : 10000;
  const threshold = req.query.threshold ? Number(req.query.threshold) : 0.55;
  res.json(backtest(capital, threshold));
});

// ── Full technical series (for chart overlays) ──────────────────────────────
router.get("/indicator-series", (req, res): void => {
  const limit = req.query.limit ? Math.min(500, Number(req.query.limit)) : 150;
  const slice = XAUUSD_D1.slice(-limit);
  res.json(slice);
});

export default router;
