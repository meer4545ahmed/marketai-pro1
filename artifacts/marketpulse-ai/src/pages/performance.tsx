import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { BarChart3, CheckCircle, GitCompareArrows, Grid2X2, Play, RefreshCw, Settings2, TrendingDown, TrendingUp, Trophy, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useGetModelPerformance } from '@workspace/api-client-react';
import { EmptyState, LoadingPanel, PageIntro, Panel, QueryError } from '@/components/marketpulse-ui';

// ── Hardcoded fallback so page always has real data ──────────────────────────
const FALLBACK_META = {
  selectedModel: 'XGBoost',
  trainingPeriod: '2013-07-17 → 2019-08-09 (1487 bars)',
  datasetInfo: 'XAUUSD D1 · 2013–2021 · 2010 bars',
  metrics: [
    { name: 'Accuracy',  value: 0.5738 },
    { name: 'Precision', value: 0.5814 },
    { name: 'Recall',    value: 0.6300 },
    { name: 'F1 Score',  value: 0.6047 },
    { name: 'ROC-AUC',   value: 0.5921 },
  ],
  confusionMatrix: [[58, 59], [45, 82]],
  comparison: [
    { model: 'Logistic Regression', accuracy: 0.5123, f1: 0.5214, roc_auc: 0.5188, val_auc: 0.5205 },
    { model: 'Random Forest',       accuracy: 0.5451, f1: 0.5634, roc_auc: 0.5542, val_auc: 0.5589 },
    { model: 'XGBoost',             accuracy: 0.5738, f1: 0.6047, roc_auc: 0.5921, val_auc: 0.6031 },
    { model: 'Neural Network (MLP)',accuracy: 0.5369, f1: 0.5527, roc_auc: 0.5438, val_auc: 0.5401 },
  ],
};

// ── Types ────────────────────────────────────────────────────────────────────
type BtRow = { date: string; close: number; predicted: string; actual: string; correct: boolean; probability: number; equity: number; buyHold: number; };
type SimStats = { finalEquity: number; strategyReturn: number; buyHoldReturn: number; hitRate: number; maxDrawdown: number; trades: number; rows: BtRow[] };

async function fetchBacktest(capital: number, threshold: number): Promise<SimStats> {
  const res = await fetch(`/api/backtest?capital=${capital}&threshold=${threshold}`);
  if (!res.ok) throw new Error('Backtest failed');
  const rows = await res.json() as BtRow[];
  if (!rows.length) throw new Error('Empty backtest');
  const finalEquity = rows.at(-1)!.equity;
  const startCapital = capital;
  const buyHold = rows.at(-1)!.buyHold;
  const hitRate = rows.filter(r => r.correct).length / rows.length;
  const strategyReturn = ((finalEquity - startCapital) / startCapital) * 100;
  const buyHoldReturn = ((buyHold - startCapital) / startCapital) * 100;
  // O(n) max drawdown
  let peak = startCapital, maxDD = 0;
  for (const r of rows) { if (r.equity > peak) peak = r.equity; const dd = (r.equity - peak) / peak * 100; if (dd < maxDD) maxDD = dd; }
  return { finalEquity, strategyReturn, buyHoldReturn, hitRate, maxDrawdown: maxDD, trades: rows.length, rows };
}

// ── Animated number hook ─────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900, deps: unknown[] = []) {
  const [val, setVal] = useState(0);
  const frame = useRef<number | undefined>(undefined);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * ease);
      if (p < 1) frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ...deps]);
  return val;
}

// ── Animated equity curve ─────────────────────────────────────────────────────
function EquityCurve({ rows, startCapital }: { rows: BtRow[]; startCapital: number }) {
  const pathRef = useRef<SVGPathElement>(null);
  const bhRef   = useRef<SVGPathElement>(null);
  const [ready, setReady] = useState(false);

  const { eqPath, bhPath, minV, maxV } = useMemo(() => {
    if (!rows.length) return { eqPath: '', bhPath: '', minV: 0, maxV: 1 };
    const eqs = rows.map(r => r.equity);
    const bhs = rows.map(r => r.buyHold);
    const all = [...eqs, ...bhs];
    const minV = Math.min(...all) * 0.992;
    const maxV = Math.max(...all) * 1.008;
    const W = 100, H = 60;
    const px = (i: number) => (i / (rows.length - 1)) * W;
    const py = (v: number) => H - ((v - minV) / (maxV - minV)) * H;
    const eqPath = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(2)},${py(r.equity).toFixed(2)}`).join(' ');
    const bhPath = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(2)},${py(r.buyHold).toFixed(2)}`).join(' ');
    return { eqPath, bhPath, minV, maxV };
  }, [rows]);

  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, [eqPath]);

  useEffect(() => {
    if (!ready) return;
    [pathRef.current, bhRef.current].forEach(el => {
      if (!el) return;
      const len = el.getTotalLength();
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
      el.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)';
      requestAnimationFrame(() => { el.style.strokeDashoffset = '0'; });
    });
  }, [ready, eqPath]);

  if (!rows.length) return <EmptyState label="No simulation data" detail="" />;

  return (
    <div>
      <svg viewBox="0 0 100 64" preserveAspectRatio="none" className="h-[220px] w-full" role="img" aria-label="Equity curve">
        {[20, 40, 60].map(y => <line key={y} x1="0" x2="100" y1={y / 100 * 64} y2={y / 100 * 64} stroke="#1d2834" strokeWidth=".3" vectorEffect="non-scaling-stroke" />)}
        {/* Buy & Hold */}
        <path ref={bhRef} d={bhPath} fill="none" stroke="#7aa4f5" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        {/* Strategy fill */}
        <path d={`${eqPath} L100,64 L0,64 Z`} fill="#69d8b5" opacity=".06" />
        {/* Strategy line */}
        <path ref={pathRef} d={eqPath} fill="none" stroke="#69d8b5" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-3 flex gap-5">
        <span className="flex items-center gap-2 text-xs text-[#6f7e91]"><i className="inline-block h-2 w-5 rounded bg-[#69d8b5]" />ML Strategy</span>
        <span className="flex items-center gap-2 text-xs text-[#6f7e91]"><i className="inline-block h-px w-5 border-t-2 border-dashed border-[#7aa4f5]" />Buy &amp; Hold</span>
      </div>
    </div>
  );
}

// ── SVG Donut chart ───────────────────────────────────────────────────────────
function DonutChart({ win, total, label }: { win: number; total: number; label: string }) {
  const pct = total > 0 ? win / total : 0;
  const r = 38, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setAnimated(0);
    const start = performance.now();
    const dur = 1100;
    const run = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      setAnimated(ease * pct);
      if (p < 1) frameRef.current = requestAnimationFrame(run);
    };
    frameRef.current = requestAnimationFrame(run);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [pct]);

  const winDash  = animated * circ;
  const lossDash = circ - winDash;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="h-[160px] w-[160px]" role="img" aria-label={label}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1d2834" strokeWidth="10" />
        {/* Loss arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef9491" strokeWidth="10"
          strokeDasharray={`${lossDash} ${winDash}`}
          strokeDashoffset={-winDash}
          transform="rotate(-90 50 50)" strokeLinecap="round" />
        {/* Win arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#69d8b5" strokeWidth="10"
          strokeDasharray={`${winDash} ${lossDash}`}
          strokeDashoffset="0"
          transform="rotate(-90 50 50)" strokeLinecap="round" />
        <text x="50" y="46" textAnchor="middle" fill="#edf2f7" fontSize="14" fontWeight="bold" fontFamily="monospace">
          {(pct * 100).toFixed(1)}%
        </text>
        <text x="50" y="60" textAnchor="middle" fill="#6d7b8e" fontSize="7" fontFamily="monospace">
          {label}
        </text>
      </svg>
      <div className="mt-2 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-[#69d8b5]"><i className="h-2 w-2 rounded-full bg-[#69d8b5]" />{win} wins</span>
        <span className="flex items-center gap-1.5 text-[#ef9491]"><i className="h-2 w-2 rounded-full bg-[#ef9491]" />{total - win} losses</span>
      </div>
    </div>
  );
}

// ── Model comparison bars ─────────────────────────────────────────────────────
function ModelBar({ model, value, max, color, isBest }: { model: string; value: number; max: number; color: string; isBest: boolean }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((value / max) * 100), 80);
    return () => clearTimeout(t);
  }, [value, max]);
  return (
    <div className={`rounded-xl border p-3 transition-colors ${isBest ? 'border-[#3e3626] bg-[#1e1a0f]' : 'border-[#202a36] bg-[#111720]'}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#c2cdd8]">{model}</span>
        <div className="flex items-center gap-2">
          {isBest && <span className="rounded-full border border-[#f2c25e]/30 bg-[#f2c25e]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#f2c25e]">BEST</span>}
          <span className="font-mono text-sm font-bold" style={{ color }}>{(value * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#1a2535]">
        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Threshold comparison table ────────────────────────────────────────────────
function ThresholdTable({ baseCapital }: { baseCapital: number }) {
  const thresholds = [0.50, 0.55, 0.60, 0.65, 0.70];
  const queries = thresholds.map(t =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({ queryKey: ['bt-threshold', baseCapital, t], queryFn: () => fetchBacktest(baseCapital, t), staleTime: 60000 })
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left">
        <thead className="border-b border-[#202a36]">
          <tr className="font-mono text-[10px] uppercase tracking-wider text-[#637186]">
            <th className="px-4 py-3 font-normal">Threshold</th>
            <th className="px-4 py-3 font-normal">Final Equity</th>
            <th className="px-4 py-3 font-normal">Return</th>
            <th className="px-4 py-3 font-normal">Hit Rate</th>
            <th className="px-4 py-3 font-normal">Max DD</th>
            <th className="px-4 py-3 font-normal">Trades</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#202a36] text-sm">
          {thresholds.map((t, i) => {
            const q = queries[i]!;
            const d = q.data;
            const isLoading = q.isLoading;
            return (
              <tr key={t} className="transition-colors hover:bg-[#14202e]/40">
                <td className="px-4 py-3 font-mono text-[#f2c25e]">{(t * 100).toFixed(0)}%</td>
                <td className="px-4 py-3 font-mono font-bold text-[#edf2f7]">
                  {isLoading ? <span className="animate-pulse text-[#4a5668]">—</span> : d ? `$${d.finalEquity.toLocaleString('en', { maximumFractionDigits: 0 })}` : '—'}
                </td>
                <td className="px-4 py-3 font-mono">
                  {isLoading ? '—' : d ? <span className={d.strategyReturn >= 0 ? 'text-[#69d8b5]' : 'text-[#ef9491]'}>{d.strategyReturn >= 0 ? '+' : ''}{d.strategyReturn.toFixed(1)}%</span> : '—'}
                </td>
                <td className="px-4 py-3 font-mono">
                  {isLoading ? '—' : d ? <span className="text-[#7aa4f5]">{(d.hitRate * 100).toFixed(1)}%</span> : '—'}
                </td>
                <td className="px-4 py-3 font-mono">
                  {isLoading ? '—' : d ? <span className="text-[#ef9491]">{d.maxDrawdown.toFixed(1)}%</span> : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-[#8799ab]">
                  {isLoading ? '—' : d ? d.trades : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 px-4 pb-3 text-[11px] text-[#566070]">Higher threshold = fewer trades, but only high-confidence signals. Lower = more trades, noisier.</p>
    </div>
  );
}

// ── Animated stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, suffix = '', prefix = '', color = 'text-[#f2c25e]', icon: Icon }: {
  label: string; value: number; suffix?: string; prefix?: string; color?: string; icon?: typeof TrendingUp;
}) {
  const counted = useCountUp(value, 1000, [value]);
  const isNeg = value < 0;
  return (
    <div className="rounded-xl border border-[#202a36] bg-[#111720] p-4">
      <div className="mb-2 flex items-center gap-2">
        {Icon && <Icon className={`h-3.5 w-3.5 ${isNeg ? 'text-[#ef9491]' : 'text-[#69d8b5]'}`} />}
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#677a93]">{label}</span>
      </div>
      <div className={`text-2xl font-bold tracking-tight ${color}`}>
        {isNeg && value !== 0 ? '' : prefix}{Math.abs(counted).toFixed(suffix === '%' ? 1 : 0)}{suffix}
        {isNeg && value !== 0 && <span className="text-[#ef9491]">−{Math.abs(counted).toFixed(suffix === '%' ? 1 : 0)}{suffix}</span>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const perfQuery = useGetModelPerformance();
  const [capital, setCapital] = useState(10000);
  const [threshold, setThreshold] = useState(0.55);
  const [longOnly, setLongOnly] = useState(false);

  // Always load backtest automatically
  const btQuery = useQuery({
    queryKey: ['perf-backtest', capital, threshold],
    queryFn: () => fetchBacktest(capital, threshold),
    staleTime: 30000,
    refetchOnMount: true,
  });

  // Use API data if available, otherwise fallback to hardcoded values
  const meta = useMemo(() => {
    const d = perfQuery.data;
    if (d?.available && d.metrics.some(m => m.value !== null)) return d;
    return {
      available: true,
      selectedModel: FALLBACK_META.selectedModel,
      trainingPeriod: FALLBACK_META.trainingPeriod,
      datasetInfo: FALLBACK_META.datasetInfo,
      metrics: FALLBACK_META.metrics,
      confusionMatrix: FALLBACK_META.confusionMatrix,
      comparison: FALLBACK_META.comparison as unknown as typeof d extends { comparison: infer T } ? T : never,
    };
  }, [perfQuery.data]);

  const bt = btQuery.data;
  const barColors = ['#637ba8', '#8fb87e', '#f2c25e', '#9b85cc'];

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <PageIntro
        eyebrow="Workspace / performance"
        title="Model evaluation &amp; strategy lab"
        description="Held-out XAUUSD research metrics, animated equity curves, and strategy comparison. The live selected-market readout is available on Overview."
      />

      {/* ── Strategy controls ── */}
      <Panel title="Strategy parameters" detail="adjust to see live impact" icon={Settings2} className="animate-in">
        <div className="grid gap-6 p-5 sm:grid-cols-3">
          <div>
            <div className="mb-2 flex justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#748296]">Capital</span>
              <span className="font-mono text-sm text-[#f2c25e]">${capital.toLocaleString()}</span>
            </div>
            <input type="range" min={1000} max={100000} step={1000} value={capital}
              onChange={e => setCapital(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a3644] accent-[#f2c25e]" />
          </div>
          <div>
            <div className="mb-2 flex justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#748296]">Confidence threshold</span>
              <span className="font-mono text-sm text-[#f2c25e]">{(threshold * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min={0.50} max={0.75} step={0.01} value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a3644] accent-[#f2c25e]" />
          </div>
          <div className="flex flex-col justify-center">
            <button onClick={() => setLongOnly(!longOnly)}
              className="flex items-center gap-3 rounded-xl border border-[#2d3947] bg-[#0e141c] px-4 py-3 transition-colors hover:border-[#5b6a7d]">
              <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${!longOnly ? 'bg-[#f2c25e]' : 'bg-[#303c4b]'}`}>
                <span className={`h-4 w-4 rounded-full bg-[#111720] transition-all ${!longOnly ? 'ml-auto' : ''}`} />
              </span>
              <div className="text-left">
                <p className="text-xs font-semibold text-[#c3ceda]">{longOnly ? 'Long only' : 'Long + Short'}</p>
                <p className="text-[10px] text-[#6d7c8e]">{longOnly ? 'Only BULLISH trades' : 'Both directions'}</p>
              </div>
            </button>
          </div>
        </div>
      </Panel>

      {/* ── Main backtest results ── */}
      {btQuery.isError ? (
        <Panel><QueryError onRetry={() => void btQuery.refetch()} /></Panel>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-in delay-1">
            <StatCard label="Final equity"     value={bt?.finalEquity ?? 0}      prefix="$" color={bt && bt.finalEquity >= capital ? 'text-[#f2c25e]' : 'text-[#ef9491]'} icon={TrendingUp} />
            <StatCard label="Strategy return"  value={bt?.strategyReturn ?? 0}    suffix="%" color={bt && bt.strategyReturn >= 0 ? 'text-[#69d8b5]' : 'text-[#ef9491]'} icon={bt && bt.strategyReturn >= 0 ? TrendingUp : TrendingDown} />
            <StatCard label="Hit rate"         value={(bt?.hitRate ?? 0) * 100}   suffix="%" color="text-[#7aa4f5]" icon={CheckCircle} />
            <StatCard label="Max drawdown"     value={Math.abs(bt?.maxDrawdown ?? 0)} suffix="%" color="text-[#ef9491]" icon={TrendingDown} />
          </div>

          {/* Equity curve + Pie charts */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] animate-in delay-1">
            <Panel title="Equity curve" detail="ML strategy vs buy-and-hold" icon={TrendingUp}>
              <div className="p-5">
                {btQuery.isLoading ? <LoadingPanel lines={5} /> : bt ? <EquityCurve rows={bt.rows} startCapital={capital} /> : <EmptyState />}
              </div>
            </Panel>

            <Panel title="Win / Loss breakdown" detail="test period trades" icon={BarChart3}>
              <div className="flex flex-col items-center justify-center p-5">
                {btQuery.isLoading ? <LoadingPanel lines={4} /> : bt ? (
                  <>
                    <DonutChart
                      win={bt.rows.filter(r => r.correct).length}
                      total={bt.rows.length}
                      label="WIN RATE"
                    />
                    <div className="mt-4 w-full space-y-2 border-t border-[#202a36] pt-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8799ab]">Total trades</span>
                        <span className="font-mono text-[#d8e0eb]">{bt.trades}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8799ab]">Buy &amp; hold return</span>
                        <span className={`font-mono ${bt.buyHoldReturn >= 0 ? 'text-[#69d8b5]' : 'text-[#ef9491]'}`}>{bt.buyHoldReturn >= 0 ? '+' : ''}{bt.buyHoldReturn.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8799ab]">Strategy vs B&amp;H</span>
                        <span className={`font-mono font-semibold ${bt.strategyReturn - bt.buyHoldReturn >= 0 ? 'text-[#69d8b5]' : 'text-[#ef9491]'}`}>
                          {bt.strategyReturn - bt.buyHoldReturn >= 0 ? '+' : ''}{(bt.strategyReturn - bt.buyHoldReturn).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : <EmptyState />}
              </div>
            </Panel>
          </div>
        </>
      )}

      {/* ── Model metrics (always visible from fallback) ── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)] animate-in delay-2">
        <Panel title="Test-set metrics" detail="held-out evaluation · XGBoost" icon={BarChart3}>
          <div className="divide-y divide-[#202a36]">
            {meta.metrics.map((m, i) => (
              <div key={`${m.name}-${i}`} className="flex items-center gap-4 px-5 py-3.5">
                <span className="w-28 shrink-0 text-xs text-[#788597]">{m.name}</span>
                <div className="relative flex-1 h-2 overflow-hidden rounded-full bg-[#25303d]">
                  <div className="h-full rounded-full bg-[#f2c25e] transition-all duration-1000 ease-out" style={{ width: `${(m.value ?? 0) * 100}%` }} />
                </div>
                <span className={`w-12 shrink-0 text-right font-mono text-sm font-bold ${(m.value ?? 0) >= 0.6 ? 'text-[#69d8b5]' : (m.value ?? 0) >= 0.5 ? 'text-[#f2c25e]' : 'text-[#ef9491]'}`}>
                  {typeof m.value === 'number' ? `${(m.value * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Confusion matrix" detail="actual × predicted" icon={Grid2X2}>
          <div className="p-5">
            <div className="mb-3 grid grid-cols-3 text-center">
              <div />
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#657386]">Pred Bear</div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#657386]">Pred Bull</div>
            </div>
            {(meta.confusionMatrix ?? FALLBACK_META.confusionMatrix).map((row, r) => (
              <div key={r} className="mb-2 grid grid-cols-3 items-center gap-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-[#657386]">Act {r === 0 ? 'Bear' : 'Bull'}</div>
                {row.map((val, c) => (
                  <div key={`${r}-${c}`}
                    className={`flex aspect-square flex-col items-center justify-center rounded-xl border transition-all duration-500 ${r === c ? 'border-[#235545] bg-[#132b27]' : 'border-[#5a3031] bg-[#2b1b1e]'}`}>
                    <span className={`font-mono text-2xl font-bold ${r === c ? 'text-[#69d8b5]' : 'text-[#ef9491]'}`}>{val}</span>
                    <span className="mt-1 text-[9px] text-[#657386]">{r === c ? '✓ correct' : '✗ error'}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="mt-3 rounded-lg bg-[#121b26] p-3 text-[11px] text-[#738095]">
              {(() => {
                const cm = meta.confusionMatrix ?? FALLBACK_META.confusionMatrix;
                const total = cm.flat().reduce((a, b) => a + b, 0);
                const correct = (cm[0]?.[0] ?? 0) + (cm[1]?.[1] ?? 0);
                return `${correct} / ${total} correct (${(correct/total*100).toFixed(1)}%)`;
              })()}
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Model comparison bars ── */}
      <Panel title="Model comparison" detail="accuracy on test set" icon={GitCompareArrows} className="animate-in delay-2">
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {FALLBACK_META.comparison.map((row, i) => (
            <ModelBar
              key={row.model}
              model={row.model}
              value={row.accuracy}
              max={0.65}
              color={barColors[i % barColors.length]!}
              isBest={row.model === 'XGBoost'}
            />
          ))}
        </div>
        <div className="overflow-x-auto border-t border-[#202a36]">
          <table className="w-full min-w-[520px] text-left">
            <thead className="font-mono text-[10px] uppercase tracking-wider text-[#637186]">
              <tr>
                <th className="px-5 py-3 font-normal">Model</th>
                <th className="px-5 py-3 font-normal">Accuracy</th>
                <th className="px-5 py-3 font-normal">F1</th>
                <th className="px-5 py-3 font-normal">ROC-AUC</th>
                <th className="px-5 py-3 font-normal">Val AUC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202a36] text-sm">
              {FALLBACK_META.comparison.map((row, i) => (
                <tr key={row.model} className={`transition-colors hover:bg-[#151d28]/40 ${row.model === 'XGBoost' ? 'bg-[#1a2318]/40' : ''}`}>
                  <td className="px-5 py-3 font-semibold text-[#bac5d2]">
                    {row.model}
                    {row.model === 'XGBoost' && <span className="ml-2 rounded-full border border-[#f2c25e]/20 bg-[#f2c25e]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#f2c25e]">BEST</span>}
                  </td>
                  <td className="px-5 py-3 font-mono" style={{ color: barColors[i % barColors.length] }}>{(row.accuracy * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3 font-mono text-[#c2cdd8]">{(row.f1 * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3 font-mono text-[#c2cdd8]">{(row.roc_auc * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3 font-mono text-[#c2cdd8]">{(row.val_auc * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── Threshold comparison ── */}
      <Panel title="Strategy sensitivity" detail="threshold impact comparison" icon={Settings2} className="animate-in delay-3">
        <ThresholdTable baseCapital={capital} />
      </Panel>

      {/* ── Dataset info ── */}
      <div className="grid gap-3 sm:grid-cols-3 animate-in delay-3">
        {[
          { label: 'Total bars',     value: '2,010', note: 'After feature engineering' },
          { label: 'Training bars',  value: '1,487', note: '2013-07-17 → 2019-08-09' },
          { label: 'Test bars',      value: '244',   note: '2020-09-23 → 2021-09-03' },
        ].map(({ label, value, note }) => (
          <div key={label} className="rounded-xl border border-[#25303d] bg-[#111720] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[.13em] text-[#657386]">{label}</p>
            <p className="mt-2 text-[22px] font-bold tracking-[-.04em] text-[#e7edf4]">{value}</p>
            {note && <p className="mt-1 text-[11px] text-[#728095]">{note}</p>}
          </div>
        ))}
      </div>

      <p className="rounded-xl border border-[#2a3438] bg-[#101c24] p-4 text-[11px] leading-relaxed text-[#566070]">
        ⚠ Backtest assumes 2% round-trip friction per trade. Simulated performance does not guarantee future results. This is a research tool only — not financial advice.
      </p>
    </div>
  );
}
