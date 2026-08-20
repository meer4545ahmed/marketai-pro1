import type { RawBar } from "./xauusd-data.js";

type BingXRow = Record<string, unknown> | unknown[];

const INTERVALS: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
};

const SYMBOLS: Record<string, string> = {
  BTCUSD: "BTC-USDT",
  ETHUSD: "ETH-USDT",
};

const YAHOO_SYMBOLS: Record<string, string> = {
  XAUUSD: "GC=F",
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  EURJPY: "EURJPY=X",
};

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampValue(value: unknown) {
  const parsed = numberValue(value);
  if (parsed !== null) return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function parseRow(row: BingXRow): RawBar | null {
  const values = Array.isArray(row)
    ? {
        timestamp: row[0],
        open: row[1],
        high: row[2],
        low: row[3],
        close: row[4],
        volume: row[5],
      }
    : {
        timestamp: row.time ?? row.timestamp ?? row.ts,
        open: row.open ?? row.o,
        high: row.high ?? row.h,
        low: row.low ?? row.l,
        close: row.close ?? row.c,
        volume: row.volume ?? row.v ?? 0,
      };
  const timestamp = timestampValue(values.timestamp);
  const open = numberValue(values.open);
  const high = numberValue(values.high);
  const low = numberValue(values.low);
  const close = numberValue(values.close);
  const volume = numberValue(values.volume) ?? 0;
  if (timestamp === null || open === null || high === null || low === null || close === null) return null;
  if (low > high || open < low || open > high || close < low || close > high) return null;
  return {
    d: new Date(timestamp).toISOString(),
    o: open,
    h: high,
    l: low,
    c: close,
    v: volume,
  };
}

function rowsFromPayload(payload: unknown): BingXRow[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { data?: unknown; code?: unknown };
  const data = body.data;
  if (Array.isArray(data)) return data as BingXRow[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: BingXRow[] }).data;
  }
  return [];
}

export type BingXMarketResult = {
  symbol: string;
  timeframe: string;
  bars: RawBar[];
  provider: "BingX" | "Yahoo Finance";
};

async function fetchBingXCandles(asset: string, timeframe: string, limit: number): Promise<BingXMarketResult> {
  const interval = INTERVALS[timeframe] ?? "1h";
  const symbol = SYMBOLS[asset] ?? `${asset.replace(/USD$/, "")}-USDT`;
  const query = new URLSearchParams({
    symbol,
    interval,
    limit: String(Math.min(200, Math.max(30, limit))),
  });
  const endpoints = [
    `https://open-api.bingx.com/openApi/swap/v2/quote/klines?${query}`,
    `https://open-api.bingx.com/openApi/swap/v3/quote/klines?${query}`,
  ];
  let lastError = "BingX returned no candle data.";
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(6500) });
      if (!response.ok) {
        lastError = `BingX responded with HTTP ${response.status}.`;
        continue;
      }
      const payload = await response.json() as { code?: unknown; msg?: unknown; data?: unknown };
      if (payload.code !== undefined && String(payload.code) !== "0") {
        lastError = String(payload.msg ?? "BingX rejected the market-data request.");
        continue;
      }
      const bars = rowsFromPayload(payload).map(parseRow).filter((bar): bar is RawBar => Boolean(bar));
      bars.sort((a, b) => a.d.localeCompare(b.d));
      if (bars.length >= 20) return { symbol, timeframe, bars, provider: "BingX" };
      lastError = `BingX returned only ${bars.length} usable candles for ${symbol}.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "BingX request failed.";
    }
  }
  throw new Error(lastError);
}

async function fetchYahooCandles(asset: string, timeframe: string, limit: number): Promise<BingXMarketResult> {
  const symbol = YAHOO_SYMBOLS[asset];
  if (!symbol) throw new Error(`No public market-data symbol is configured for ${asset}.`);
  const interval = timeframe === "1D" ? "1d" : timeframe === "4H" ? "1h" : INTERVALS[timeframe] ?? "1h";
  const range = interval === "1d" ? "2y" : "3mo";
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(6500), headers: { "User-Agent": "MarketPulse/1.0" } });
  if (!response.ok) throw new Error(`Yahoo Finance responded with HTTP ${response.status}.`);
  const payload = await response.json() as {
    chart?: { result?: Array<{ meta?: { symbol?: string }; timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> } }> };
  };
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const bars: RawBar[] = [];
  for (let index = 0; index < (result?.timestamp?.length ?? 0); index += 1) {
    const open = quote?.open?.[index];
    const high = quote?.high?.[index];
    const low = quote?.low?.[index];
    const close = quote?.close?.[index];
    if (open === null || open === undefined || high === null || high === undefined || low === null || low === undefined || close === null || close === undefined) continue;
    bars.push({
      d: new Date((result!.timestamp![index] ?? 0) * 1000).toISOString(),
      o: open, h: high, l: low, c: close, v: quote?.volume?.[index] ?? 0,
    });
  }
  if (bars.length < 20) throw new Error(`Yahoo Finance returned only ${bars.length} usable candles for ${asset}.`);
  return { symbol: result?.meta?.symbol ?? symbol, timeframe, bars: bars.slice(-Math.min(limit, bars.length)), provider: "Yahoo Finance" };
}

export async function fetchMarketCandles(asset: string, timeframe: string, limit: number): Promise<BingXMarketResult> {
  return YAHOO_SYMBOLS[asset]
    ? fetchYahooCandles(asset, timeframe, limit)
    : fetchBingXCandles(asset, timeframe, limit);
}