import { useState, useMemo } from 'react';
import { Crosshair, Scale, TrendingUp, DollarSign, BarChart2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getGetHistoricalAnalyticsQueryKey, useGetHistoricalAnalytics } from '@workspace/api-client-react';
import { EmptyState, LoadingPanel, Metric, MiniLegend, PageIntro, Panel, QueryError, Sparkline } from '@/components/marketpulse-ui';

type BacktestBar = {
  date: string; close: number; predicted: string; actual: string;
  correct: boolean; probability: number; equity: number; buyHold: number;
};

async function fetchBacktest(capital: number, threshold: number): Promise<BacktestBar[]> {
  const url = `/api/backtest?capital=${capital}&threshold=${threshold}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Backtest fetch failed');
  return res.json() as Promise<BacktestBar[]>;
}

function BacktestChart({ data }: { data: BacktestBar[] }) {
  if (!data.length) return <EmptyState label="No backtest data" />;
  const equities  = data.map(d => d.equity);
  const buyHolds  = data.map(d => d.buyHold);
  const allVals   = [...equities, ...buyHolds];
  const min = Math.min(...allVals) * 0.995;
  const max = Math.max(...allVals) * 1.005;
  const range = max - min;
  const W = 100, H = 100;
  const px = (i: number) => (i / (data.length - 1)) * W;
  const py = (v: number) => H - ((v - min) / range) * H;
  const eqPts  = data.map((d, i) => `${px(i)},${py(d.equity)}`).join(' ');
  const bhPts  = data.map((d, i) => `${px(i)},${py(d.buyHold)}`).join(' ');
  const finalEq = equities.at(-1)!;
  const finalBH = buyHolds.at(-1)!;
  const eqGain  = ((finalEq - equities[0]!) / equities[0]!) * 100;
  const bhGain  = ((finalBH - buyHolds[0]!) / buyHolds[0]!) * 100;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="font-mono text-[10px] text-[#69d8b5] uppercase tracking-wider">Strategy</span>
          <div className="text-lg font-bold text-[#edf2f7]">${finalEq.toLocaleString('en', { maximumFractionDigits: 0 })}</div>
          <span className={eqGain >= 0 ? 'text-[#69d8b5] text-xs' : 'text-[#ef9491] text-xs'}>{eqGain >= 0 ? '+' : ''}{eqGain.toFixed(1)}%</span>
        </div>
        <div>
          <span className="font-mono text-[10px] text-[#7aa4f5] uppercase tracking-wider">Buy &amp; Hold</span>
          <div className="text-lg font-bold text-[#edf2f7]">${finalBH.toLocaleString('en', { maximumFractionDigits: 0 })}</div>
          <span className={bhGain >= 0 ? 'text-[#69d8b5] text-xs' : 'text-[#ef9491] text-xs'}>{bhGain >= 0 ? '+' : ''}{bhGain.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-[200px] w-full">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
          {[25, 50, 75].map(y => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="#1d2834" strokeWidth=".3" vectorEffect="non-scaling-stroke" />)}
          <polygon points={`0,${H} ${eqPts} ${W},${H}`} fill="#69d8b5" opacity=".07" />
          <polyline points={eqPts} fill="none" stroke="#69d8b5" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <polyline points={bhPts} fill="none" stroke="#7aa4f5" strokeWidth="1.2" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-3">
        <MiniLegend items={[{ label: 'ML Strategy', color: '#69d8b5' }, { label: 'Buy & Hold', color: '#7aa4f5' }]} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [capital, setCapital] = useState(10000);
  const [threshold, setThreshold] = useState(0.55);

  const analytics = useGetHistoricalAnalytics({ query: { queryKey: getGetHistoricalAnalyticsQueryKey() } });
  const backtest  = useQuery({
    queryKey: ['backtest', capital, threshold],
    queryFn:  () => fetchBacktest(capital, threshold),
    enabled: false,
    staleTime: 30000,
  });

  const data  = analytics.data;
  const total = (data?.bullishCount ?? 0) + (data?.bearishCount ?? 0);
  const trend = data?.accuracyTrend ?? [];

  const backtestStats = useMemo(() => {
    if (!backtest.data?.length) return null;
    const bt = backtest.data;
    const correct = bt.filter(b => b.correct).length;
    const accuracy = correct / bt.length;
    const finalEquity = bt.at(-1)!.equity;
    const pnl = finalEquity - capital;
    const maxDD = bt.reduce((worst, b, i) => {
      const peak = Math.max(...bt.slice(0, i + 1).map(x => x.equity));
      return Math.min(worst, (b.equity - peak) / peak);
    }, 0);
    return { accuracy, finalEquity, pnl, maxDD, trades: bt.length };
  }, [backtest.data, capital]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageIntro
        eyebrow="Workspace / analytics"
        title="Historical performance &amp; profit simulation"
        description="Review the held-out XAUUSD research test period and compare its strategy equity with buy-and-hold. Live selected-market readings are shown on Overview."
      />

      {/* ── KPI row ── */}
      {analytics.isLoading ? (
        <div className="grid gap-5 md:grid-cols-3"><Panel><LoadingPanel lines={4} /></Panel><Panel><LoadingPanel lines={4} /></Panel><Panel><LoadingPanel lines={4} /></Panel></div>
      ) : analytics.isError ? (
        <Panel><QueryError onRetry={() => void analytics.refetch()} /></Panel>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-3 animate-in">
            <Panel className="p-5">
              <Metric label="Historical accuracy" value={typeof data.accuracy === 'number' ? `${(data.accuracy * 100).toFixed(1)}%` : '—'} note="Test set predictions" accent />
            </Panel>
            <Panel className="p-5">
              <Metric label="Bullish calls" value={data.bullishCount.toLocaleString()} note={total ? `${((data.bullishCount / total) * 100).toFixed(1)}% of test period` : '—'} />
            </Panel>
            <Panel className="p-5">
              <Metric label="Bearish calls" value={data.bearishCount.toLocaleString()} note={total ? `${((data.bearishCount / total) * 100).toFixed(1)}% of test period` : '—'} />
            </Panel>
          </div>

          {/* ── Accuracy trend ── */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)]">
            <Panel title="Accuracy trend" detail={`${trend.length} windows`} icon={TrendingUp} className="animate-in delay-1">
              <div className="p-5">
                {trend.length ? (
                  <>
                    <div className="h-[200px]">
                      <Sparkline values={trend.map(t => t.accuracy)} color="#69d8b5" height={200} fill />
                    </div>
                    <div className="mt-3 flex justify-between font-mono text-[10px] text-[#657386]">
                      <span>{trend[0]?.period}</span>
                      <span>{trend.at(-1)?.period}</span>
                    </div>
                  </>
                ) : <EmptyState />}
              </div>
            </Panel>

            <Panel title="Prediction distribution" detail={`${total} calls`} icon={Scale} className="animate-in delay-2">
              <div className="p-5">
                {total ? (
                  <>
                    <div className="mb-6 flex items-center justify-center">
                      <div className="relative flex h-44 w-44 items-center justify-center rounded-full"
                        style={{ background: `conic-gradient(#69d8b5 ${(data.bullishCount / total) * 360}deg, #ef9491 0deg)` }}>
                        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-[#111720]">
                          <span className="font-mono text-2xl text-[#edf2f7]">{total}</span>
                          <span className="text-[10px] text-[#6d7b8e]">predictions</span>
                        </div>
                      </div>
                    </div>
                    <MiniLegend items={[{ label: `Bullish (${data.bullishCount})`, color: '#69d8b5' }, { label: `Bearish (${data.bearishCount})`, color: '#ef9491' }]} />
                  </>
                ) : <EmptyState />}
              </div>
            </Panel>
          </div>

          {/* ── Calibration ── */}
          <Panel title="Calibration" detail="predicted probability vs actual rate" icon={Crosshair} className="animate-in delay-2">
            <div className="p-5">
              {data.calibration?.length ? (
                <div className="space-y-4">
                  {data.calibration.map((item, i) => (
                    <div key={`${item.bucket}-${i}`} className="grid grid-cols-[76px_1fr_74px] items-center gap-3 text-xs">
                      <span className="font-mono text-[#aeb9c6]">{item.bucket}</span>
                      <div className="relative h-2 rounded-full bg-[#25303d]">
                        <div className="h-full rounded-full bg-[#f2c25e] transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, item.actual * 100))}%` }} />
                        <span className="absolute -top-1.5 h-5 w-px bg-[#69d8b5]" style={{ left: `${Math.max(0, Math.min(100, item.predicted * 100))}%` }} />
                      </div>
                      <span className="text-right font-mono text-[#6f7d90]">{(item.actual * 100).toFixed(1)}% actual</span>
                    </div>
                  ))}
                  <MiniLegend items={[{ label: 'Actual rate', color: '#f2c25e' }, { label: 'Predicted marker', color: '#69d8b5' }]} />
                </div>
              ) : <EmptyState />}
            </div>
          </Panel>
        </div>
      ) : <Panel><EmptyState /></Panel>}

      {/* ── Profit Simulation ── */}
      <div className="mt-8">
        <div className="mb-5 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-[#f2c25e]" />
          <h2 className="text-lg font-extrabold tracking-[-.03em] text-[#edf2f7]">Profit Simulation</h2>
          <span className="font-mono text-[10px] text-[#657386]">/ test period backtest</span>
        </div>

        {/* Controls */}
        <Panel className="mb-5 p-5 animate-in">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#657386]">Simulation controls</div>
            <button
              type="button"
              onClick={() => void backtest.refetch()}
              disabled={backtest.isLoading}
              className="rounded-full border border-[#f2c25e]/40 bg-[#2d2618] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#f2c25e] transition hover:bg-[#382f1d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {backtest.isLoading ? 'Running…' : 'Run simulation'}
            </button>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#748296]">Starting capital (USD)</span>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1000} max={100000} step={1000} value={capital}
                  onChange={e => setCapital(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a3644] accent-[#f2c25e]"
                />
                <span className="w-20 shrink-0 text-right font-mono text-sm text-[#f2c25e]">${capital.toLocaleString()}</span>
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#748296]">Confidence threshold</span>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={0.50} max={0.75} step={0.01} value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a3644] accent-[#f2c25e]"
                />
                <span className="w-14 shrink-0 text-right font-mono text-sm text-[#f2c25e]">{(threshold * 100).toFixed(0)}%</span>
              </div>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {backtestStats && (
                <>
                  <div className="rounded-lg bg-[#121b26] p-3 text-center">
                    <div className="font-mono text-lg text-[#f2c25e]">{(backtestStats.accuracy * 100).toFixed(1)}%</div>
                    <div className="mt-1 font-mono text-[10px] text-[#667488]">HIT RATE</div>
                  </div>
                  <div className="rounded-lg bg-[#121b26] p-3 text-center">
                    <div className={`font-mono text-lg ${backtestStats.pnl >= 0 ? 'text-[#69d8b5]' : 'text-[#ef9491]'}`}>
                      {backtestStats.pnl >= 0 ? '+' : ''}${backtestStats.pnl.toLocaleString('en', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-[#667488]">P&amp;L</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Panel>

        {/* Equity chart */}
        <Panel title="Equity Curve" detail="ML strategy vs buy-and-hold" icon={BarChart2} className="animate-in delay-1">
          <div className="p-5">
            {backtest.isLoading ? <LoadingPanel lines={6} /> : backtest.isError ? <QueryError onRetry={() => void backtest.refetch()} /> : backtest.data ? (
              <BacktestChart data={backtest.data} />
            ) : <EmptyState />}
          </div>
        </Panel>

        {/* Stats row */}
        {backtestStats && (
          <div className="mt-5 grid gap-3 sm:grid-cols-4 animate-in delay-2">
            {[
              { label: 'Final equity',   value: `$${backtestStats.finalEquity.toLocaleString('en', { maximumFractionDigits: 0 })}`, accent: true },
              { label: 'Total P&L',      value: `${backtestStats.pnl >= 0 ? '+' : ''}$${Math.abs(backtestStats.pnl).toFixed(0)}` },
              { label: 'Max drawdown',   value: `${(backtestStats.maxDD * 100).toFixed(1)}%` },
              { label: 'Trades taken',   value: backtestStats.trades.toLocaleString() },
            ].map(({ label, value, accent }) => (
              <Panel key={label} className="p-5">
                <Metric label={label} value={value} accent={accent} />
              </Panel>
            ))}
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-[#566070]">
          ⚠ Backtest results assume 2% round-trip friction. Past simulated performance does not guarantee future results.
          This is a research tool only, not financial advice.
        </p>
      </div>
    </div>
  );
}
