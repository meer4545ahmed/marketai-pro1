import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, BrainCircuit, CheckCircle2, Database, Eye, FileImage, Gauge, GitBranch, Radio, ScanLine, Sparkles, UploadCloud } from 'lucide-react';
import { getGetRealtimeAnalysisQueryKey, type ChartAnalysisRequest, useAnalyzeChart, useGetModelInfo, useGetRealtimeAnalysis } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { GlowCard, LoadingPanel, Metric, PageIntro, Panel, StatusPill } from '@/components/marketpulse-ui';
import { scanChartImage } from '@/lib/chart-analysis';
import { useMarketPreferences } from '@/hooks/use-market-preferences';

type ScanRequest = ChartAnalysisRequest & { previewUrl: string };

async function createDemoChartFile() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 620;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser could not create the demo chart.');

  const width = canvas.width;
  const height = canvas.height;
  const chartTop = 54;
  const chartBottom = 500;
  const chartLeft = 56;
  const chartRight = 1144;
  const bars = 46;
  const closes = Array.from({ length: bars }, (_, index) => {
    const wave = Math.sin(index * 0.48) * 18 + Math.sin(index * 0.17) * 10;
    return 100 + index * 0.92 + wave;
  });

  context.fillStyle = '#0d1520';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  context.lineWidth = 1;
  for (let y = chartTop; y <= chartBottom; y += 74) {
    context.beginPath();
    context.moveTo(chartLeft, y);
    context.lineTo(chartRight, y);
    context.stroke();
  }
  for (let x = chartLeft; x <= chartRight; x += 136) {
    context.beginPath();
    context.moveTo(x, chartTop);
    context.lineTo(x, chartBottom);
    context.stroke();
  }

  const min = Math.min(...closes) - 24;
  const max = Math.max(...closes) + 24;
  const toY = (value: number) => chartTop + ((max - value) / (max - min)) * (chartBottom - chartTop);
  const step = (chartRight - chartLeft) / bars;
  const bodyWidth = Math.max(8, step * 0.52);

  context.lineWidth = 2;
  context.strokeStyle = '#f2c25e';
  context.beginPath();
  closes.forEach((close, index) => {
    const x = chartLeft + step * index + step / 2;
    const average = closes.slice(Math.max(0, index - 8), index + 1).reduce((sum, value) => sum + value, 0) / Math.min(9, index + 1);
    const y = toY(average);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  closes.forEach((close, index) => {
    const open = index === 0 ? close - 3 : closes[index - 1] + Math.sin(index * 1.9) * 4;
    const high = Math.max(open, close) + 7 + Math.abs(Math.sin(index)) * 5;
    const low = Math.min(open, close) - 6 - Math.abs(Math.cos(index * 0.8)) * 4;
    const x = chartLeft + step * index + step / 2;
    const bullish = close >= open;
    context.strokeStyle = bullish ? '#69d8b5' : '#ef9491';
    context.fillStyle = context.strokeStyle;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, toY(high));
    context.lineTo(x, toY(low));
    context.stroke();
    const top = toY(Math.max(open, close));
    const bottom = toY(Math.min(open, close));
    context.fillRect(x - bodyWidth / 2, top, bodyWidth, Math.max(5, bottom - top));
  });

  context.fillStyle = '#9aa6b5';
  context.font = '600 18px monospace';
  context.fillText('XAUUSD · D1 · MARKETPULSE DEMO', chartLeft, 30);
  context.fillStyle = '#657386';
  context.font = '13px monospace';
  context.fillText('visual feature extraction / research mode', chartLeft, height - 42);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The demo chart could not be generated.');
  return new File([blob], 'marketpulse-demo-chart.png', { type: 'image/png' });
}

function DirectionBadge({ direction, large = false }: { direction: string; large?: boolean }) {
  const bullish = direction === 'BULLISH';
  const neutral = direction === 'NEUTRAL';
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1 font-mono font-bold ${large ? 'text-xl' : 'text-xs'} ${bullish ? 'border-[#245445] bg-[#142b26] text-[#69d8b5]' : neutral ? 'border-[#493c22] bg-[#211c13] text-[#f2c25e]' : 'border-[#5d3032] bg-[#2b1d21] text-[#ef9491]'}`}>
      {bullish ? '↑' : neutral ? '↔' : '↓'} {direction}
    </span>
  );
}

function formatPrice(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RealtimeAnalysisPanel() {
  const [enabled, setEnabled] = useState(false);
  const [asset, setAsset] = useState('BTCUSD');
  const [timeframe, setTimeframe] = useState<'1H' | '4H' | '1D'>('1H');
  const realtime = useGetRealtimeAnalysis(
    { asset, timeframe, limit: 120 },
    {
      query: {
        queryKey: getGetRealtimeAnalysisQueryKey({ asset, timeframe, limit: 120 }),
        enabled,
        staleTime: 0,
        refetchInterval: enabled ? 10_000 : false,
      },
    },
  );
  const live = realtime.data;

  return (
    <Panel title="Realtime model stream" detail="provider candles · refreshes every 10 seconds" icon={Radio} className="mb-5">
      <div className="space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#718095]">Continuous analysis</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#aab6c4]">
              This stream recalculates the price band, model probability, indicators, and three scenarios from the latest candles instead of returning one fixed bearish/bullish answer.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#718095]">Symbol</span>
              <select value={asset} onChange={event => setAsset(event.target.value)} className="h-9 rounded-md border border-[#3a4755] bg-[#101722] px-2 text-xs font-semibold text-[#d8e0eb]">
                <option value="BTCUSD">BTCUSD</option>
                <option value="ETHUSD">ETHUSD</option>
                <option value="XAUUSD">XAUUSD</option>
                <option value="EURUSD">EURUSD</option>
                <option value="GBPUSD">GBPUSD</option>
                <option value="USDJPY">USDJPY</option>
                <option value="EURJPY">EURJPY</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#718095]">Timeframe</span>
              <select value={timeframe} onChange={event => setTimeframe(event.target.value as typeof timeframe)} className="h-9 rounded-md border border-[#3a4755] bg-[#101722] px-2 text-xs font-semibold text-[#d8e0eb]">
                <option value="1H">1H</option>
                <option value="4H">4H</option>
                <option value="1D">1D</option>
              </select>
            </label>
            <Button type="button" size="sm" className={enabled ? 'bg-[#2a3948] text-[#d8e0eb]' : 'bg-[#69d8b5] text-[#08110f]'} onClick={() => setEnabled(value => !value)}>
              <Radio className="h-3.5 w-3.5" /> {enabled ? 'Pause stream' : 'Start live mode'}
            </Button>
          </div>
        </div>

        {!enabled && !live && (
          <div className="rounded-lg border border-dashed border-[#3a4755] bg-[#0e141c] p-4 text-xs leading-relaxed text-[#718095]">
            Start live mode to fetch provider candles. If a provider is unavailable, the panel shows a visible warning instead of hiding the failure or silently substituting another market.
          </div>
        )}

        {realtime.isError && (
          <div className="rounded-lg border border-[#5d3032] bg-[#2b1d21] p-3 text-xs text-[#ef9491]">
            The realtime endpoint could not be reached. Check the API workflow and try again.
          </div>
        )}

        {live && (
          <>
            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${live.providerStatus === 'live' ? 'border-[#245445] bg-[#142b26] text-[#9de5cc]' : 'border-[#493c22] bg-[#211c13] text-[#d5bc77]'}`}>
              <span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" />{live.providerMessage}</span>
              <span className="font-mono text-[10px]">{realtime.isFetching ? 'refreshing…' : `updated ${new Date(live.updatedAt).toLocaleTimeString()}`}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Current price" value={formatPrice(live.currentPrice)} note={live.symbol} accent />
              <Metric label="Combined read" value={<DirectionBadge direction={live.combinedDirection} />} note={`${(live.model.probability * 100).toFixed(1)}% model confidence`} />
              <Metric label="Next range" value={`${formatPrice(live.priceRange.lower)} – ${formatPrice(live.priceRange.upper)}`} note={`${live.priceRange.expectedMovePct >= 0 ? '+' : ''}${live.priceRange.expectedMovePct.toFixed(2)}% expected move`} />
              <Metric label="Range confidence" value={`${(live.priceRange.confidence * 100).toFixed(0)}%`} note={live.priceRange.source} />
            </div>
            <div className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
              <div className="rounded-xl border border-[#394a5c] bg-[linear-gradient(135deg,#111d2a,#0f151e)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#718095]">Live model projection</p>
                    <p className="mt-2 text-2xl font-bold text-[#f2c25e]">{formatPrice(live.priceRange.lower)} <span className="text-[#718095]">—</span> {formatPrice(live.priceRange.upper)}</p>
                  </div>
                  <Gauge className="h-5 w-5 text-[#f2c25e]" />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[#aab6c4]">{live.priceRange.note}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#9eabba] sm:grid-cols-4">
                  <span>RSI <b className="text-[#dbe3eb]">{live.indicators.rsi.toFixed(1)}</b></span>
                  <span>ATR <b className="text-[#dbe3eb]">{formatPrice(live.indicators.atr)}</b></span>
                  <span>EMA9 <b className="text-[#dbe3eb]">{formatPrice(live.indicators.ema9)}</b></span>
                  <span>MACD <b className="text-[#dbe3eb]">{live.indicators.macd.toFixed(3)}</b></span>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {live.scenarios.map(scenario => (
                  <div key={scenario.label} className="rounded-lg border border-[#263442] bg-[#0f151e] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#cbd5e1]">{scenario.label}</span>
                      <DirectionBadge direction={scenario.direction} />
                    </div>
                    <p className="mt-2 text-sm font-bold text-[#dbe3eb]">{formatPrice(scenario.lower)} – {formatPrice(scenario.upper)}</p>
                    <p className="mt-1 font-mono text-[10px] text-[#f2c25e]">{(scenario.probability * 100).toFixed(1)}% weight</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-[#b7a77b]">{live.disclaimer}</p>
          </>
        )}
      </div>
    </Panel>
  );
}

export default function ChartAnalysisPage() {
  const { preferences } = useMarketPreferences();
  const [scan, setScan] = useState<ScanRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scaleTopPrice, setScaleTopPrice] = useState('');
  const [scaleBottomPrice, setScaleBottomPrice] = useState('');
  const analysis = useAnalyzeChart();
  const model = useGetModelInfo();

  useEffect(() => () => {
    if (scan?.previewUrl) URL.revokeObjectURL(scan.previewUrl);
  }, [scan?.previewUrl]);

  const chooseFile = async (file: File) => {
    setError(null);
    analysis.reset();
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Please choose a PNG or JPEG TradingView screenshot.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('The screenshot is larger than 10 MB. Crop or compress it before uploading.');
      return;
    }
    try {
      const top = Number(scaleTopPrice);
      const bottom = Number(scaleBottomPrice);
      const next = await scanChartImage(file, {
        ...(Number.isFinite(top) && top > 0 ? { priceScaleTop: top } : {}),
        ...(Number.isFinite(bottom) && bottom > 0 ? { priceScaleBottom: bottom } : {}),
      }, preferences.asset);
      setScan(previous => {
        if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
        return next;
      });
      analysis.mutate({ data: next });
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Chart scan failed.');
    }
  };

  const tryDemo = async () => {
    setError(null);
    try {
      await chooseFile(await createDemoChartFile());
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : 'Demo chart generation failed.');
    }
  };

  const result = analysis.data;
  const visual = result?.visual;

  const applyPriceScale = () => {
    if (!scan) return;
    const top = Number(scaleTopPrice);
    const bottom = Number(scaleBottomPrice);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || top <= bottom || bottom <= 0) {
      setError('Enter valid chart-axis values: the top price must be greater than the bottom price.');
      return;
    }
    const next = { ...scan, priceScaleTop: top, priceScaleBottom: bottom };
    setError(null);
    setScan(next);
    analysis.mutate({ data: next });
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageIntro
        eyebrow="Workspace / chart reader"
        title="Read the chart, not just the bias"
        description="Upload a clean TradingView screenshot. MarketPulse extracts price geometry, combines it with the calibrated model, and returns a price band plus bullish, sideways, and bearish scenarios."
      />

      <RealtimeAnalysisPanel />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-in delay-1">
        <div className="rounded-xl border border-[#2b3948] bg-[#101722]/90 p-4">
          <div className="flex items-center gap-2 text-[#7aa4f5]"><Database className="h-4 w-4" /><span className="font-mono text-[10px] uppercase tracking-[.14em]">Dataset</span></div>
          <p className="mt-3 text-sm font-bold text-[#dbe3eb]">{preferences.asset} · {preferences.timeframe}</p>
          <p className="mt-1 text-[11px] text-[#718095]">selected market context</p>
        </div>
        <div className="rounded-xl border border-[#2b3948] bg-[#101722]/90 p-4">
          <div className="flex items-center gap-2 text-[#f2c25e]"><BrainCircuit className="h-4 w-4" /><span className="font-mono text-[10px] uppercase tracking-[.14em]">Model</span></div>
          <p className="mt-3 text-sm font-bold text-[#dbe3eb]">{model.data?.modelName ?? 'XGBoost classifier'}</p>
          <p className="mt-1 text-[11px] text-[#718095]">{model.data?.featureCount ?? 37} engineered features</p>
        </div>
        <div className="rounded-xl border border-[#2b3948] bg-[#101722]/90 p-4">
          <div className="flex items-center gap-2 text-[#69d8b5]"><GitBranch className="h-4 w-4" /><span className="font-mono text-[10px] uppercase tracking-[.14em]">Validation</span></div>
          <p className="mt-3 text-sm font-bold text-[#dbe3eb]">70 / 15 / 15</p>
          <p className="mt-1 text-[11px] text-[#718095]">train · validation · held-out test</p>
        </div>
        <div className="rounded-xl border border-[#2b3948] bg-[#101722]/90 p-4">
          <div className="flex items-center gap-2 text-[#b07efa]"><BarChart3 className="h-4 w-4" /><span className="font-mono text-[10px] uppercase tracking-[.14em]">Output</span></div>
          <p className="mt-3 text-sm font-bold text-[#dbe3eb]">Price band + scenarios</p>
          <p className="mt-1 text-[11px] text-[#718095]">model-calibrated, not guaranteed</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
        <Panel title="Chart screenshot" detail="local pixel scan · not stored" icon={FileImage}>
          <div className="p-5">
            {scan ? (
              <div className="overflow-hidden rounded-xl border border-[#2b3948] bg-[#080d14]">
                <img src={scan.previewUrl} alt={`Uploaded chart: ${scan.filename}`} className="max-h-[430px] w-full object-contain" />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#202a36] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#d8e0eb]">{scan.filename}</p>
                    <p className="font-mono text-[10px] text-[#6e7d90]">{scan.imageWidth} × {scan.imageHeight}px · {scan.sampledColumns} active columns</p>
                  </div>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void chooseFile(file); }} />
                    <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-[#3e4b5c] px-3 text-xs font-semibold text-[#c4cfdb] hover:bg-[#17202b]"><UploadCloud className="h-3.5 w-3.5" /> Replace</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[330px] flex-col items-center justify-center rounded-xl border border-dashed border-[#3a4755] bg-[#0e141c] px-6 text-center hover:border-[#f2c25e]">
                <label className="flex cursor-pointer flex-col items-center">
                  <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void chooseFile(file); }} />
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#3c4857] bg-[#161e28] text-[#f2c25e]"><UploadCloud className="h-5 w-5" /></span>
                  <span className="text-sm font-semibold text-[#d8e0eb]">Drop a TradingView screenshot here</span>
                  <span className="mt-2 max-w-xs text-xs leading-relaxed text-[#718095]">PNG or JPEG · crop out browser chrome and keep the candles visible.</span>
                  <span className="mt-4 font-mono text-[9px] text-[#4e5e70]">MAX 10 MB · SELECTED MARKET / ANY TIMEFRAME</span>
                </label>
                <Button type="button" variant="outline" size="sm" className="mt-5 border-[#3a4755] bg-[#151d28] text-[#c2cdd8]" onClick={() => void tryDemo()}>
                  <Sparkles className="h-3.5 w-3.5" /> Try demo chart
                </Button>
              </div>
            )}
            {error && <p className="mt-3 flex items-center gap-2 text-xs text-[#ef9491]"><AlertTriangle className="h-4 w-4" />{error}</p>}
            <div className="mt-4 rounded-lg border border-[#2b3948] bg-[#101722] p-4">
              <div className="flex items-start gap-2">
                <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-[#f2c25e]" />
                <div>
                  <p className="text-xs font-semibold text-[#d8e0eb]">Calibrate the image price scale</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#718095]">Copy the highest and lowest visible price labels from the chart axis. This maps pixel positions to actual prices; without both labels, the result stays model-anchored.</p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="grid flex-1 gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#718095]">Top visible price</span>
                  <input type="number" min="0" step="any" value={scaleTopPrice} onChange={event => setScaleTopPrice(event.target.value)} placeholder="e.g. 2450.00" className="h-9 rounded-md border border-[#3a4755] bg-[#0d1520] px-3 text-xs text-[#d8e0eb] outline-none focus:border-[#f2c25e]" />
                </label>
                <label className="grid flex-1 gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#718095]">Bottom visible price</span>
                  <input type="number" min="0" step="any" value={scaleBottomPrice} onChange={event => setScaleBottomPrice(event.target.value)} placeholder="e.g. 2380.00" className="h-9 rounded-md border border-[#3a4755] bg-[#0d1520] px-3 text-xs text-[#d8e0eb] outline-none focus:border-[#f2c25e]" />
                </label>
                <Button type="button" size="sm" variant="outline" className="h-9 border-[#3a4755] bg-[#151d28] text-[#c2cdd8]" onClick={applyPriceScale} disabled={!scan || analysis.isPending}>Apply scale</Button>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#493c22] bg-[#211c13] p-3 text-xs leading-relaxed text-[#b7a77b]">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[#f2c25e]" />
              <span>One local scan + one small JSON request per image. No external AI call or image upload is used, so this path consumes zero AI credits. The optional scale calibration makes the displayed range absolute instead of a model anchor.</span>
            </div>
          </div>
        </Panel>

        <GlowCard bullish={result?.combinedDirection === 'BULLISH'}>
          <Panel title="Directional read" detail={result ? new Date(result.analyzedAt).toLocaleString() : 'waiting for screenshot'} icon={BrainCircuit}>
            {analysis.isPending ? <LoadingPanel lines={5} /> : result && visual ? (
              <div className="space-y-5 p-5">
                <div className="rounded-xl border border-[#2b3948] bg-[#101722] p-5 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#718095]">Combined baseline direction</p>
                  <div className="mt-4"><DirectionBadge direction={result.combinedDirection} large /></div>
                  <p className="mt-3 text-xs leading-relaxed text-[#8390a1]">The direction is weighted from the model probability and the chart’s visible trajectory. The price band below is the actionable part of this read.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#263442] bg-[#0f151e] p-4">
                    <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#cbd5e1]">Screenshot read</span><ScanLine className="h-4 w-4 text-[#7aa4f5]" /></div>
                    <div className="mt-3"><DirectionBadge direction={visual.bias} /></div>
                    <p className="mt-2 font-mono text-[10px] text-[#718095]">{(visual.confidence * 100).toFixed(0)}% visual confidence</p>
                  </div>
                  <div className="rounded-lg border border-[#263442] bg-[#0f151e] p-4">
                    <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#cbd5e1]">Trained model</span><BrainCircuit className="h-4 w-4 text-[#f2c25e]" /></div>
                    <div className="mt-3"><DirectionBadge direction={result.model.direction} /></div>
                    <p className="mt-2 font-mono text-[10px] text-[#718095]">{(result.model.probability * 100).toFixed(1)}% model confidence</p>
                  </div>
                </div>
                 <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                   <Metric label="Trend score" value={visual.trendScore > 0 ? `+${visual.trendScore.toFixed(2)}` : visual.trendScore.toFixed(2)} note="visual trajectory" accent />
                   <Metric label="Active columns" value={visual.sampledColumns} note="detected regions" />
                   <Metric label="Bull candles" value={`${(visual.bullishCandleRatio * 100).toFixed(0)}%`} note="of color reads" />
                   <Metric label="Bear candles" value={`${(visual.bearishCandleRatio * 100).toFixed(0)}%`} note="of color reads" />
                 </div>
                <div className="rounded-xl border border-[#394a5c] bg-[linear-gradient(135deg,#111d2a,#0f151e)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#718095]">Model-calibrated next-candle range</p>
                      <p className="mt-2 text-3xl font-bold tracking-tight text-[#f2c25e]">
                        {formatPrice(result.priceRange.lower)} <span className="text-[#718095]">—</span> {formatPrice(result.priceRange.upper)}
                      </p>
                      <p className="mt-2 text-xs text-[#8390a1]">
                        Midpoint {formatPrice(result.priceRange.midpoint)} · expected move {result.priceRange.expectedMovePct >= 0 ? '+' : ''}{result.priceRange.expectedMovePct.toFixed(2)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#304153] bg-[#0d1520] px-3 py-2 text-right">
                      <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[#718095]">Range confidence</p>
                      <p className="mt-1 text-lg font-bold text-[#dbe3eb]">{(result.priceRange.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-[#aab6c4]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f2c25e]" />
                    <span>{result.priceRange.note}</span>
                  </div>
                </div>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#718095]">Scenario map</p>
                    <span className="text-[10px] text-[#526276]">probabilities are relative, not guarantees</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {result.scenarios.map(scenario => (
                      <div key={scenario.label} className="rounded-lg border border-[#263442] bg-[#0f151e] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#cbd5e1]">{scenario.label}</span>
                          <DirectionBadge direction={scenario.direction} />
                        </div>
                        <p className="mt-3 text-lg font-bold text-[#dbe3eb]">{formatPrice(scenario.lower)} – {formatPrice(scenario.upper)}</p>
                        <p className="mt-1 font-mono text-[10px] text-[#f2c25e]">{(scenario.probability * 100).toFixed(1)}% model weight</p>
                        <p className="mt-3 text-[11px] leading-relaxed text-[#718095]">{scenario.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${result.agreement === 'AGREE' ? 'border-[#245445] bg-[#142b26] text-[#9de5cc]' : 'border-[#493c22] bg-[#211c13] text-[#d5bc77]'}`}>
                  {result.agreement === 'AGREE' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {result.agreement === 'AGREE' ? 'Visual and model directions agree.' : result.agreement === 'CONFLICTING' ? 'Visual and model directions conflict; treat the signal as low conviction.' : 'The screenshot did not contain enough directional evidence.'}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[330px] flex-col items-center justify-center p-6 text-center">
                <ScanLine className="h-8 w-8 text-[#526276]" />
                <p className="mt-4 text-sm font-semibold text-[#b6c2d0]">Awaiting a chart screenshot</p>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#718095]">The analysis will show visual structure, model direction, agreement, and limitations here.</p>
              </div>
            )}
          </Panel>
        </GlowCard>
      </div>

      {result && visual && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Panel title="What the scan saw" detail="derived from visible pixels" icon={ScanLine}>
            <div className="divide-y divide-[#202a36]">
              {visual.signals.map(signal => <div key={signal} className="px-5 py-3 text-xs leading-relaxed text-[#aab6c4]">{signal}</div>)}
            </div>
          </Panel>
          <Panel title="How to interpret this" detail="research guardrails" icon={AlertTriangle}>
            <div className="space-y-3 p-5 text-xs leading-relaxed text-[#7d8a9b]">
              <p><StatusPill status={result.model.horizon} tone="gold" /> The trained model predicts the next daily candle. The range is a probability band, not a guaranteed target price.</p>
              <p>{result.method}</p>
              <p>Model anchor: {formatPrice(result.priceRange.currentPrice)} · source: {result.priceRange.source}</p>
              <p className="text-[#b7a77b]">{result.disclaimer}</p>
            </div>
          </Panel>
        </div>
      )}

      {!result && (
        <Panel title="Presentation runbook" detail="three steps" icon={Sparkles} className="mt-5 animate-in delay-2">
          <div className="grid gap-3 p-5 md:grid-cols-3">
            {[
              ['01', 'Upload', 'Choose a TradingView PNG or JPEG, or use the demo chart to show the workflow without a live market screenshot.'],
              ['02', 'Extract', 'The browser reads candle regions, vertical price span, latest price position, and left-to-right trajectory. The image bytes are never sent or stored.'],
              ['03', 'Project', 'The calibrated model combines that geometry with ATR to return a range and three weighted scenarios, without an external AI credit spend.'],
            ].map(([number, title, copy]) => (
              <div key={number} className="rounded-lg border border-[#263442] bg-[#0f151e] p-4">
                <span className="font-mono text-[10px] text-[#f2c25e]">{number}</span>
                <p className="mt-2 text-sm font-bold text-[#d8e0eb]">{title}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#718095]">{copy}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}