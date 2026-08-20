import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CandlestickChart, CircleGauge, RefreshCw, TrendingUp, TrendingDown, Waves, Zap } from 'lucide-react';
import { getGetMarketDataQueryKey, getGetPredictionQueryKey, getGetTechnicalIndicatorsQueryKey, useGetMarketData, useGetModelInfo, useGetPrediction, useGetTechnicalIndicators } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AnimatedNumber, DataKey, EmptyState, GlowCard, LoadingPanel, Metric, PageIntro, Panel, PulseDot, QueryError, SectionLink, StatusPill } from '@/components/marketpulse-ui';
import { useMarketPreferences } from '@/hooks/use-market-preferences';

type CandleBar = { open: number; high: number; low: number; close: number };
type BtRow     = { equity: number; buyHold: number; correct: boolean };

async function fetchBtRows(): Promise<BtRow[]> {
  const res = await fetch('/api/backtest?capital=10000&threshold=0.55');
  if (!res.ok) throw new Error('bt');
  return res.json() as Promise<BtRow[]>;
}

function PremiumChart({ candles, btRows, overlays }: {
  candles: CandleBar[];
  btRows: BtRow[];
  overlays: { ema9: boolean; ema21: boolean; sma50: boolean; bb: boolean };
}) {
  const [tick,    setTick]    = useState(0);
  const [drawPct, setDrawPct] = useState(0);
  const [scanIdx, setScanIdx] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const t0     = useRef(performance.now());

  useEffect(() => {
    const DUR = 1600;
    let last = 0;
    const loop = (now: number) => {
      setDrawPct(Math.min(1, (now - t0.current) / DUR));
      if (now - last > 80) {
        last = now;
        setTick(v => v + 1);
        setScanIdx(v => (v + 1) % Math.max(1, candles.length));
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [candles.length]);

  if (!candles.length) return <EmptyState label="Loading chart…" detail="" />;

  const slice = candles.slice(-52);
  const n     = slice.length;
  const W = 100, H = 78, PAD = 2;
  const plotW = W - PAD * 2;
  const hi    = Math.max(...slice.map(c => c.high)) * 1.004;
  const lo    = Math.min(...slice.map(c => c.low))  * 0.996;
  const rng   = hi - lo || 1;
  const py    = (v: number) => H - ((v - lo) / rng) * H;
  const px    = (i: number) => PAD + (i / (n - 1)) * plotW;
  const barW  = Math.max(0.5, (plotW / n) * 0.62);

  const buildEma = (span: number) => {
    const k = 2 / (span + 1);
    let v = slice[0]!.close;
    return slice.map(c => { v = (c.close - v) * k + v; return v; });
  };
  const smaN = (p: number) => slice.map((_, i) =>
    i < p - 1 ? null : slice.slice(i - p + 1, i + 1).reduce((a, b) => a + b.close, 0) / p
  );

  const ema9V  = overlays.ema9  ? buildEma(9)  : null;
  const ema21V = overlays.ema21 ? buildEma(21) : null;
  const sma50V = overlays.sma50 ? smaN(Math.min(50, n)) : null;
  const bbMid  = overlays.bb    ? smaN(Math.min(20, n)) : null;
  const bbStd  = overlays.bb && bbMid ? slice.map((_, i) => {
    if (i < 19 || bbMid[i] === null) return null;
    const m = bbMid[i]!;
    return Math.sqrt(slice.slice(i - 19, i + 1).reduce((s, c) => s + (c.close - m) ** 2, 0) / 20);
  }) : null;

  const maLine = (vals: (number | null)[]) =>
    vals.map((v, i) => v !== null ? `${px(i).toFixed(2)},${py(v).toFixed(2)}` : null).filter(Boolean).join(' ');

  // equity overlay normalised into H
  let eqPath = '';
  const eqSlice = btRows.length >= n ? btRows.slice(-n) : btRows;
  if (eqSlice.length >= 2) {
    const eqs   = eqSlice.map(r => r.equity);
    const eqMin = Math.min(...eqs), eqMax = Math.max(...eqs), eqRng = eqMax - eqMin || 1;
    eqPath = eqSlice.map((r, i) => {
      const xi = PAD + (i / (eqSlice.length - 1)) * plotW;
      const yi = H * 0.15 + ((eqMax - r.equity) / eqRng) * H * 0.65;
      return `${xi.toFixed(2)},${yi.toFixed(2)}`;
    }).join(' ');
  }

  const sIdx    = scanIdx % n;
  const sX      = px(sIdx);
  const sClose  = slice[sIdx]!.close;
  const sMid    = py(sClose);
  const wiggle  = Math.sin(tick * 0.18) * 0.35;

  // last candle live dot
  const lastC   = slice[n - 1]!;
  const lX      = px(n - 1);
  const lY      = py(lastC.close) + wiggle * 0.4;
  const lUp     = lastC.close >= lastC.open;
  const lCol    = lUp ? '#69d8b5' : '#ef9491';
  const ring    = 3.8 + Math.sin(tick * 0.22) * 1.4;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[#1a2738]"
      style={{ background: 'linear-gradient(160deg, #060c14 0%, #080e18 60%, #060c12 100%)', boxShadow: '0 0 80px rgba(105,216,181,0.05), 0 0 200px rgba(122,164,245,0.03), inset 0 1px 0 rgba(255,255,255,0.04)' }}>

      {/* ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob-green absolute -left-20 -top-20 h-80 w-80 rounded-full" />
        <div className="blob-blue  absolute -bottom-24 right-0 h-72 w-72 rounded-full" />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="lg1" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%"   stopColor="#7aa4f5" /><stop offset="50%" stopColor="#69d8b5" /><stop offset="100%" stopColor="#baf7d5" />
          </linearGradient>
          <linearGradient id="lg2" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%"  stopColor="#f2c25e" stopOpacity=".8" /><stop offset="100%" stopColor="#f7d57d" stopOpacity=".5" />
          </linearGradient>
          <filter id="fg">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="b" />
            <feColorMatrix in="b" type="matrix" values="0 0 0 0 0.41  0 0 0 0 0.85  0 0 0 0 0.71  0 0 0 0.9 0" result="cb" />
            <feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fb">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.0" result="b" />
            <feColorMatrix in="b" type="matrix" values="0 0 0 0 0.48  0 0 0 0 0.64  0 0 0 0 0.96  0 0 0 0.8 0" result="cb" />
            <feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="dc"><rect x="0" y="0" width={`${drawPct * W}`} height={H} /></clipPath>
        </defs>

        {/* grid */}
        {[H*.2,H*.4,H*.6,H*.8].map(y => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="rgba(148,163,184,0.07)" strokeWidth=".3" vectorEffect="non-scaling-stroke" />)}
        {[.25,.5,.75].map(f => <line key={f} x1={W*f} x2={W*f} y1="0" y2={H} stroke="rgba(148,163,184,0.04)" strokeWidth=".3" vectorEffect="non-scaling-stroke" />)}

        {/* BB fill */}
        {overlays.bb && bbMid && bbStd && (() => {
          const top = bbMid.map((m, i) => m !== null && bbStd[i] !== null ? `${px(i).toFixed(2)},${py(m + 2 * bbStd[i]!).toFixed(2)}` : null).filter(Boolean);
          const bot = [...bbMid].map((m, i) => m !== null && bbStd[i] !== null ? `${px(i).toFixed(2)},${py(m - 2 * bbStd[i]!).toFixed(2)}` : null).filter(Boolean).reverse();
          return <polygon points={[...top, ...bot].join(' ')} fill="#f2c25e" opacity=".04" />;
        })()}

        {/* SMA50 */}
        {sma50V && <polyline clipPath="url(#dc)" points={maLine(sma50V)} fill="none" stroke="#b07efa" strokeWidth=".7" strokeDasharray="2 1.5" vectorEffect="non-scaling-stroke" opacity=".7" />}
        {/* EMA21 */}
        {ema21V && <polyline clipPath="url(#dc)" points={maLine(ema21V)} fill="none" stroke="#7aa4f5" strokeWidth=".85" vectorEffect="non-scaling-stroke" opacity=".8" />}

        {/* equity overlay */}
        {eqPath && (
          <g clipPath="url(#dc)" filter="url(#fb)">
            <polyline points={eqPath} fill="none" stroke="url(#lg2)" strokeWidth=".9" strokeDasharray="2.5 1.5" vectorEffect="non-scaling-stroke" opacity=".65" />
          </g>
        )}

        {/* candles */}
        {slice.map((c, i) => {
          const isUp  = c.close >= c.open;
          const col   = isUp ? '#69d8b5' : '#ef9491';
          const x     = px(i);
          const active = i === sIdx;
          const alpha = drawPct < (i / n) ? 0 : isUp ? 0.88 : 0.78;
          const bodyT = py(Math.max(c.open, c.close));
          const bodyH = Math.max(0.9, Math.abs(py(c.open) - py(c.close)));
          return (
            <g key={i} opacity={alpha}>
              <line x1={x} x2={x} y1={py(c.high)} y2={py(c.low)} stroke={col} strokeWidth={active ? '.75' : '.45'} vectorEffect="non-scaling-stroke" opacity=".65" />
              <rect x={x - barW/2} y={bodyT + (active ? wiggle : 0)} width={barW} height={bodyH} rx=".15"
                fill={isUp ? col : 'none'} stroke={isUp ? 'none' : col} strokeWidth=".4" />
            </g>
          );
        })}

        {/* EMA9 glowing */}
        {ema9V && (
          <g clipPath="url(#dc)" filter="url(#fg)">
            <polyline points={maLine(ema9V)} fill="none" stroke="#f2c25e" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
          </g>
        )}

        {/* scan cursor */}
        <line x1={sX} x2={sX} y1="0" y2={H} stroke="rgba(122,164,245,0.14)" strokeWidth=".5" vectorEffect="non-scaling-stroke" />
        <circle cx={sX} cy={sMid + wiggle * .6} r="2.8" fill="rgba(122,164,245,0.1)" stroke="#7aa4f5" strokeWidth=".5"
          style={{ filter: 'drop-shadow(0 0 6px rgba(122,164,245,0.75))' }} />
        <circle cx={sX} cy={sMid + wiggle * .6} r="1.1" fill="#7aa4f5" />

        {/* live dot */}
        <circle cx={lX} cy={lY} r={ring} fill="none" stroke={lCol} strokeWidth=".35"
          opacity={.25 + Math.sin(tick * .2) * .2} />
        <circle cx={lX} cy={lY} r="2.0" fill={lCol} style={{ filter: `drop-shadow(0 0 5px ${lCol})` }} />
        <circle cx={lX} cy={lY} r="0.9" fill="#fff" opacity=".7" />
      </svg>

      {/* HUD — AI signal */}
      <div className="hud-badge absolute left-3 top-3 gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#69d8b5]" style={{ boxShadow: '0 0 10px rgba(105,216,181,0.95)' }} />
        <span className="hud-label">AI SIGNAL · LIVE</span>
      </div>

      {/* HUD — equity */}
      {btRows.length > 0 && (
        <div className="hud-badge absolute right-3 top-3 gap-1.5">
          <span className="hud-label text-[#f2c25e]">BT EQUITY</span>
          <span className="font-mono text-[9px] font-bold text-[#f2c25e]">${(btRows.at(-1)?.equity ?? 0).toLocaleString('en', { maximumFractionDigits: 0 })}</span>
        </div>
      )}

      {/* HUD — price tag */}
      <div className={`hud-price absolute bottom-3 left-3 ${lUp ? 'border-[#69d8b5]/25 bg-[#132b26]/85' : 'border-[#ef9491]/25 bg-[#2b1b1e]/85'}`}>
        <span className={`font-mono text-[14px] font-bold ${lUp ? 'text-[#69d8b5]' : 'text-[#ef9491]'}`}
          style={{ textShadow: `0 0 16px ${lUp ? 'rgba(105,216,181,.6)' : 'rgba(239,148,145,.6)'}` }}>
          {lastC.close.toFixed(2)}
        </span>
        <span className="ml-1.5 font-mono text-[9px] text-[#5a6878]">USD</span>
      </div>

      {/* HUD — legend */}
      {eqPath && (
        <div className="hud-badge absolute bottom-3 right-3 gap-3">
          <span className="flex items-center gap-1 hud-label"><i className="h-px w-4 border-t border-[#69d8b5] inline-block" />Price</span>
          <span className="flex items-center gap-1 hud-label" style={{ color: '#f2c25e' }}><i className="h-px w-4 border-t border-dashed border-[#f2c25e] inline-block" />Backtest</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { preferences } = useMarketPreferences();
  const [overlays, setOverlays] = useState({ ema9: true, ema21: true, sma50: false, bb: false });
  const queryParams = useMemo(() => ({ asset: preferences.asset, timeframe: preferences.timeframe, limit: 120 }), [preferences]);
  const market     = useGetMarketData(queryParams, { query: { queryKey: getGetMarketDataQueryKey(queryParams), refetchInterval: 30000 } });
  const indicators = useGetTechnicalIndicators(queryParams, { query: { queryKey: getGetTechnicalIndicatorsQueryKey(queryParams) } });
  const pred       = useGetPrediction({ asset: preferences.asset }, { query: { queryKey: getGetPredictionQueryKey({ asset: preferences.asset }), refetchInterval: 30000 } });
  const model      = useGetModelInfo();
  const btQuery    = useQuery({ queryKey: ['dash-bt'], queryFn: fetchBtRows, staleTime: 120000 });

  const candles  = market.data ?? [];
  const latest   = candles.at(-1);
  const previous = candles.at(-2);
  const change   = latest && previous ? latest.close - previous.close : null;
  const changePct = change != null && previous?.close ? (change / previous.close) * 100 : null;
  const isBull   = pred.data?.direction === 'BULLISH';
  const predProb = pred.data?.probability ?? 0;
  const prob     = predProb > 0 ? predProb * 100 : null;

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* ── 3D page header ── */}
      <div className="mb-8 animate-in">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em]" style={{ color: '#f2c25e' }}>
          <span className="h-px w-5 bg-[#f2c25e]" /> Workspace / overview
        </div>
        <h1 className="text-3d max-w-3xl text-[30px] font-extrabold tracking-[-.04em] sm:text-[38px]">
          {preferences.asset} Research Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#7e8b9c]">
          Live market state, ML model output, and the technical signals behind every prediction.
        </p>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => { void market.refetch(); void indicators.refetch(); void pred.refetch(); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 animate-in delay-1">
        <div className="kpi-card accent">
          <p className="kpi-label">Asset</p>
          <p className="kpi-val">{preferences.asset}</p>
          <p className="kpi-note">{preferences.timeframe} timeframe</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Last price</p>
          <p className="kpi-val">{latest ? <AnimatedNumber value={latest.close} decimals={2} prefix="$" /> : '—'}</p>
          <p className="kpi-note">{latest ? new Date(latest.timestamp).toLocaleDateString() : 'Awaiting data'}</p>
        </div>
        <div className={`kpi-card ${changePct != null && changePct >= 0 ? 'positive' : ''}`}>
          <p className="kpi-label">Session move</p>
          <p className="kpi-val">{changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}</p>
          <p className="kpi-note">{change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)} USD` : '—'}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Model</p>
          <p className="kpi-val text-sm leading-tight">{model.data?.modelName ?? 'Loading…'}</p>
          <p className="kpi-note">Active classifier</p>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.8fr)]">

        {/* Premium chart panel */}
        <div className="chart-panel animate-in delay-1">
          <div className="chart-panel__header">
            <div className="flex items-center gap-2.5">
              <CandlestickChart className="h-4 w-4 text-[#f2c25e]" />
              <span className="panel-title">Price Structure</span>
            </div>
            <div className="flex items-center gap-3">
              {/* overlay pills */}
              <div className="flex gap-1.5">
                {(['ema9','ema21','sma50','bb'] as const).map(key => (
                  <button key={key} onClick={() => setOverlays(o => ({ ...o, [key]: !o[key] }))}
                    className={`overlay-pill ${overlays[key] ? 'active' : ''}`}>
                    {key === 'bb' ? 'BB' : key.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px] text-[#4a5668]">{candles.length} bars</span>
            </div>
          </div>

          {market.isLoading ? (
            <div className="p-5"><LoadingPanel lines={5} /></div>
          ) : market.isError ? (
            <div className="p-5"><QueryError onRetry={() => void market.refetch()} /></div>
          ) : candles.length ? (
            <div className="p-4">
              {/* chart itself */}
              <div className="h-[300px] w-full">
                <PremiumChart candles={candles} btRows={btQuery.data ?? []} overlays={overlays} />
              </div>

              {/* legend strip */}
              <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[9px] uppercase tracking-[.14em] text-[#4a5668]">
                <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#69d8b5]" />Bull</span>
                <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#ef9491]" />Bear</span>
                {overlays.ema9  && <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#f2c25e]" />EMA9</span>}
                {overlays.ema21 && <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#7aa4f5]" />EMA21</span>}
                {overlays.sma50 && <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#b07efa]" />SMA50</span>}
                {btQuery.data && <span><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#f2c25e]" />Backtest</span>}
              </div>

              {/* OHLC strip */}
              <div className="mt-4 grid grid-cols-2 gap-x-6 border-t border-[#1a2434] pt-3 sm:grid-cols-4">
                <DataKey label="Open"   value={latest?.open   != null ? latest.open.toFixed(2)   : '—'} />
                <DataKey label="High"   value={latest?.high   != null ? latest.high.toFixed(2)   : '—'} />
                <DataKey label="Low"    value={latest?.low    != null ? latest.low.toFixed(2)    : '—'} />
                <DataKey label="Volume" value={latest?.volume != null ? latest.volume.toLocaleString() : '—'} />
              </div>
            </div>
          ) : <EmptyState label="No data" />}
        </div>

        {/* AI Prediction card */}
        <GlowCard bullish={isBull} className="animate-in delay-2">
          <Panel title="AI Prediction" detail="latest inference" icon={CircleGauge}>
            {pred.isLoading ? <LoadingPanel lines={4} /> : pred.isError ? <QueryError onRetry={() => void pred.refetch()} /> : pred.data ? (
              <div className="p-6">
                <div className="mb-2 flex items-center justify-between">
                  <StatusPill status={pred.data.modelStatus ?? 'sample'} tone={pred.data.modelStatus === 'loaded' ? 'green' : 'gold'} />
                  <PulseDot active color={isBull ? '#69d8b5' : '#ef9491'} />
                </div>

                <div className="my-8 flex flex-col items-center text-center">
                  <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg ${isBull ? 'border-[#245445] bg-[#142b26] text-[#69d8b5]' : 'border-[#5d3032] bg-[#2b1d21] text-[#ef9491]'}`}
                    style={{ boxShadow: `0 0 30px ${isBull ? 'rgba(105,216,181,.25)' : 'rgba(239,148,145,.25)'}` }}>
                    {isBull ? <TrendingUp className="h-7 w-7" /> : <TrendingDown className="h-7 w-7" />}
                  </div>

                  <span className={`text-3d-pred text-[44px] font-extrabold tracking-[-.06em] ${isBull ? 'text-[#69d8b5]' : 'text-[#ef9491]'}`}
                    style={{ textShadow: `0 0 40px ${isBull ? 'rgba(105,216,181,.45)' : 'rgba(239,148,145,.45)'}` }}>
                    {pred.data.direction}
                  </span>

                  {prob != null && (
                    <>
                      <div className="mt-3 font-mono text-[48px] font-medium tracking-[-.08em] text-[#f2c25e]"
                        style={{ textShadow: '0 0 30px rgba(242,194,94,.35)' }}>
                        {prob.toFixed(1)}<small className="ml-1 text-xl opacity-60">%</small>
                      </div>
                      <span className="text-xs text-[#758397]">model confidence</span>
                    </>
                  )}
                </div>

                {/* prob bar */}
                <div className="mb-4 space-y-1">
                  <div className="flex justify-between font-mono text-[10px] text-[#637386]">
                    <span>BEAR {((1 - predProb) * 100).toFixed(1)}%</span>
                    <span>BULL {(predProb * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#0e1a28]">
                    <div className={`h-full rounded-full transition-all duration-1000 ${isBull ? 'bg-gradient-to-r from-[#ef9491]/30 to-[#69d8b5]' : 'bg-gradient-to-r from-[#ef9491] to-[#ef9491]/50'}`}
                      style={{ width: `${Math.max(0, Math.min(100, predProb * 100))}%`, boxShadow: `0 0 8px ${isBull ? 'rgba(105,216,181,.5)' : 'rgba(239,148,145,.5)'}` }} />
                  </div>
                </div>

                <div className="border-t border-[#1a2434] pt-4 space-y-2">
                  <DataKey label="Horizon"   value={pred.data.horizon} />
                  <DataKey label="Timestamp" value={new Date(pred.data.timestamp).toLocaleTimeString()} />
                </div>
                <div className="mt-4"><SectionLink href="/prediction">Full prediction detail</SectionLink></div>
              </div>
            ) : <EmptyState />}
          </Panel>
        </GlowCard>
      </div>

      {/* ── Indicators ── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)]">
        <Panel title="Technical Indicators" detail="current snapshot" icon={Waves} className="animate-in delay-3">
          {indicators.isLoading ? <LoadingPanel lines={3} /> : indicators.isError ? <QueryError onRetry={() => void indicators.refetch()} /> : indicators.data ? (
            <div className="grid grid-cols-2 gap-x-6 px-5 py-2 sm:grid-cols-4">
              {[
                ['EMA 9',    indicators.data.ema9,           indicators.data.ema9 > indicators.data.ema21 ? 'text-[#69d8b5]' : 'text-[#ef9491]'],
                ['EMA 21',   indicators.data.ema21,          null],
                ['SMA 50',   indicators.data.sma50,          null],
                ['RSI',      indicators.data.rsi,            indicators.data.rsi > 70 ? 'text-[#ef9491]' : indicators.data.rsi < 30 ? 'text-[#69d8b5]' : 'text-[#f2c25e]'],
                ['MACD',     indicators.data.macd,           indicators.data.macd > 0 ? 'text-[#69d8b5]' : 'text-[#ef9491]'],
                ['ATR',      indicators.data.atr,            null],
                ['BB Upper', indicators.data.bollingerUpper, null],
                ['BB Lower', indicators.data.bollingerLower, null],
              ].map(([label, value, tone]) => (
                <DataKey key={String(label)} label={String(label)} value={Number(value).toFixed(2)} tone={tone as string | undefined} />
              ))}
            </div>
          ) : <EmptyState />}
        </Panel>

        <Panel title="Signal Summary" detail="quick read" icon={Zap} className="animate-in delay-3">
          <div className="p-5 space-y-3">
            {indicators.data ? [
              { label: 'EMA Trend', ok: indicators.data.ema9 > indicators.data.ema21, trueLabel: 'Bullish cross', falseLabel: 'Bearish cross' },
              { label: 'RSI',       ok: indicators.data.rsi < 70 && indicators.data.rsi > 30, trueLabel: 'Neutral zone', falseLabel: indicators.data.rsi > 70 ? 'Overbought' : 'Oversold' },
              { label: 'MACD',      ok: indicators.data.macd > 0, trueLabel: 'Above zero', falseLabel: 'Below zero' },
              { label: 'ATR',       ok: indicators.data.atr < 20, trueLabel: 'Low volatility', falseLabel: 'High volatility' },
            ].map(({ label, ok, trueLabel, falseLabel }) => (
              <div key={label} className="signal-row">
                <span className="text-xs text-[#8b99aa]">{label}</span>
                <span className={`font-mono text-[11px] ${ok ? 'text-[#69d8b5]' : 'text-[#f2c25e]'}`}>{ok ? trueLabel : falseLabel}</span>
              </div>
            )) : <EmptyState label="Loading signals…" detail="" />}
            <div className="mt-3 border-t border-[#1a2434] pt-3">
              <SectionLink href="/analytics">View full analytics</SectionLink>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
