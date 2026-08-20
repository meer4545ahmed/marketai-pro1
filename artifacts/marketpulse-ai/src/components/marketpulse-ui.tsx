import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Activity, AlertTriangle, BarChart3, Bot, BrainCircuit,
  ChevronRight, CircleHelp, Database, Gauge, LayoutDashboard,
  LineChart, Menu, Settings2, ShieldCheck, SlidersHorizontal,
  ScanLine, Upload, X,
} from 'lucide-react';
import { useHealthCheck } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMarketPreferences } from '@/hooks/use-market-preferences';

// ── Navigation ──────────────────────────────────────────────────────────────
export const navItems = [
  { href: '/',            label: 'Overview',     icon: LayoutDashboard },
  { href: '/chart-analysis', label: 'Chart reader', icon: ScanLine },
  { href: '/prediction',  label: 'Prediction',   icon: BrainCircuit },
  { href: '/performance', label: 'Performance',  icon: BarChart3 },
  { href: '/analytics',   label: 'Analytics',    icon: LineChart },
  { href: '/settings',    label: 'Settings',     icon: SlidersHorizontal },
];

// ── App Shell ───────────────────────────────────────────────────────────────
export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: health } = useHealthCheck();
  const { preferences } = useMarketPreferences();
  const healthOnline = health?.status?.toLowerCase() === 'ok' || Boolean(health?.status);

  return (
    <div className="scanline min-h-[100dvh] bg-[#0d1118] text-[#d8e0eb]">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-[#25303d] bg-[#0b0f15] px-4 py-5 transition-transform duration-300 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex items-center justify-between px-3">
          <Link href="/" className="group flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#d2a348] bg-[#d2a348]/10 text-[#f2c25e]">
              <Activity className="h-[18px] w-[18px]" />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#55d5ae] shadow-[0_0_12px_rgba(85,213,174,.65)] animate-pulse" />
            </span>
            <span>
              <span className="block text-[14px] font-extrabold tracking-[.18em] text-[#f4f0e7]">MARKETPULSE</span>
              <span className="block font-mono text-[9px] tracking-[.24em] text-[#6d7a8c]">AI / RESEARCH</span>
            </span>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-[#748196] hover:bg-[#18202c] lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-10 px-3 font-mono text-[10px] uppercase tracking-[.2em] text-[#5f6d80]">Workspace</div>
        <nav className="mt-3 space-y-1" aria-label="Main navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? location === '/' : location.startsWith(href);
            return (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={cn(
                'group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition-all duration-200',
                active ? 'border-[#3e3626] bg-[#2a251b] text-[#f2c25e] shadow-[inset_0_0_20px_rgba(242,194,94,.05)]' : 'border-transparent text-[#8b97a8] hover:border-[#25303d] hover:bg-[#141b25] hover:text-[#d8e0eb]',
              )}>
                <Icon className={cn('h-[17px] w-[17px] transition-colors', active ? 'text-[#f2c25e]' : 'text-[#68778a] group-hover:text-[#a9b4c3]')} />
                <span>{label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#f2c25e] shadow-[0_0_8px_rgba(242,194,94,.8)]" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="rounded-xl border border-[#25303d] bg-[#111720] p-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#55d5ae]" />
              <span className="text-[11px] font-bold tracking-wide text-[#c6d1dd]">Research mode</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#6f7c8e]">Signals are analytical context, not financial advice.</p>
          </div>
          <div className="flex items-center justify-between px-3 font-mono text-[10px] text-[#59687b]">
            <span className="flex items-center gap-2">
              <span className={cn('h-1.5 w-1.5 rounded-full', healthOnline ? 'bg-[#55d5ae] shadow-[0_0_6px_#55d5ae]' : 'bg-[#f2c25e]')} />
              API {healthOnline ? 'CONNECTED' : 'CHECKING'}
            </span>
            <span>v1.0.0</span>
          </div>
        </div>
      </aside>

      {mobileOpen && <button onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />}

      {/* Main */}
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#202a36] bg-[#0d1118]/95 px-5 backdrop-blur-md sm:px-8">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-[#8b97a8] hover:bg-[#18202c] lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#68778a] sm:flex">
            <span className="text-[#f2c25e]">/</span> analyst cockpit <span className="text-[#3c4858]">/</span> {preferences.asset} {preferences.timeframe}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-md border border-[#273442] bg-[#131a23] px-2.5 py-1.5 font-mono text-[10px] text-[#8592a3] sm:inline-flex">
              UTC {new Date().toISOString().slice(11, 16)}
            </span>
            <Link href="/settings" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#293543] text-[#8b97a8] hover:border-[#f2c25e]/50 hover:text-[#f2c25e] transition-colors">
              <Settings2 className="h-4 w-4" />
            </Link>
          </div>
        </header>
        <main className="terminal-grid min-h-[calc(100dvh-68px)] overflow-hidden px-5 py-7 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

// ── Page intro ───────────────────────────────────────────────────────────────
export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end animate-in">
      <div>
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-[#f2c25e]">
          <span className="h-px w-5 bg-[#f2c25e]" /> {eyebrow}
        </div>
        <h1 className="max-w-3xl text-[28px] font-extrabold tracking-[-.04em] text-[#edf2f7] sm:text-[34px]"
          dangerouslySetInnerHTML={{ __html: title }} />
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#7e8b9c]"
          dangerouslySetInnerHTML={{ __html: description }} />
      </div>
      {action}
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────
export function Panel({ children, className, title, detail, icon: Icon }: { children?: ReactNode; className?: string; title?: string; detail?: string; icon?: typeof Activity }) {
  return (
    <section className={cn('rounded-xl border border-[#25303d] bg-[#111720]/95 shadow-[0_15px_45px_rgba(0,0,0,.14)]', className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-[#202a36] px-5 py-4">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="h-4 w-4 text-[#f2c25e]" />}
            <h2 className="text-[12px] font-bold uppercase tracking-[.12em] text-[#bcc7d4]">{title}</h2>
          </div>
          {detail && <span className="font-mono text-[10px] text-[#657386]">{detail}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

// ── Glow Card wrapper for prediction ─────────────────────────────────────────
export function GlowCard({ children, bullish, className }: { children: ReactNode; bullish: boolean; className?: string }) {
  return (
    <div className={cn(
      'relative rounded-xl transition-shadow duration-700',
      bullish
        ? 'shadow-[0_0_40px_rgba(105,216,181,.12),0_0_80px_rgba(105,216,181,.06)]'
        : 'shadow-[0_0_40px_rgba(239,148,145,.12),0_0_80px_rgba(239,148,145,.06)]',
      className,
    )}>
      {/* Animated border glow */}
      <div className={cn(
        'pointer-events-none absolute inset-0 rounded-xl border opacity-40 transition-all duration-700',
        bullish ? 'border-[#69d8b5]' : 'border-[#ef9491]',
      )} />
      {children}
    </div>
  );
}

// ── Pulse dot ────────────────────────────────────────────────────────────────
export function PulseDot({ active, color = '#69d8b5' }: { active?: boolean; color?: string }) {
  return (
    <span className="relative flex h-3 w-3">
      {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ backgroundColor: color }} />}
      <span className="relative inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

// ── Animated number ──────────────────────────────────────────────────────────
export function AnimatedNumber({ value, decimals = 2, prefix = '', suffix = '' }: { value?: number; decimals?: number; prefix?: string; suffix?: string }) {
  const safeValue = Number.isFinite(value) ? value as number : 0;
  const [displayed, setDisplayed] = useState(safeValue);
  const frameRef = useRef<number | null>(null);
  const prevRef  = useRef(safeValue);

  useEffect(() => {
    const start = prevRef.current;
    const end   = safeValue;
    const dur   = 600;
    const t0    = performance.now();
    const animate = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      const next = start + (end - start) * ease;
      setDisplayed(Number.isFinite(next) ? next : 0);
      if (p < 1) frameRef.current = requestAnimationFrame(animate);
      else prevRef.current = end;
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [safeValue]);

  return <>{prefix}{Number.isFinite(displayed) ? displayed.toFixed(decimals) : '0'}{suffix}</>;
}

// ── Loading panel ─────────────────────────────────────────────────────────────
export function LoadingPanel({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3 p-5" data-testid="status-loading">
      <div className="h-3 w-24 animate-pulse rounded bg-[#263140]" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-[#1c2632]" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

// ── Query error ───────────────────────────────────────────────────────────────
export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 p-6" data-testid="status-query-error">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#e98c86]">
        <AlertTriangle className="h-4 w-4" /> Data endpoint unavailable
      </div>
      <p className="text-xs text-[#7e8b9c]">The research service did not return a usable response.</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry connection</Button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ label = 'Not available', detail = 'No data returned.' }: { label?: string; detail?: string }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center px-5 py-7 text-center" data-testid="status-empty">
      <span className="font-mono text-sm text-[#9aa6b5]">{label}</span>
      {detail && <span className="mt-1 text-xs text-[#657386]">{detail}</span>}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
export function StatusPill({ status, tone = 'gold' }: { status: string; tone?: 'gold' | 'green' | 'red' | 'muted' }) {
  const colors = {
    gold:  'border-[#644f27] bg-[#332a19] text-[#f2c25e]',
    green: 'border-[#235545] bg-[#132b27] text-[#69d8b5]',
    red:   'border-[#5a3031] bg-[#2b1b1e] text-[#ef9491]',
    muted: 'border-[#33404e] bg-[#19212b] text-[#9aa6b5]',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.1em]', colors[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{status}
    </span>
  );
}

// ── Metric ────────────────────────────────────────────────────────────────────
export function Metric({ label, value, note, accent = false }: { label: string; value: ReactNode; note?: string; accent?: boolean }) {
  return (
    <div className="border-l-2 border-[#2a3644] pl-4">
      <p className="font-mono text-[10px] uppercase tracking-[.13em] text-[#657386]">{label}</p>
      <p className={cn('mt-2 text-[22px] font-bold tracking-[-.04em]', accent ? 'text-[#f2c25e]' : 'text-[#e7edf4]')}>
        {value}
      </p>
      {note && <p className="mt-1 text-[11px] text-[#728095]">{note}</p>}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
export function Sparkline({ values, color = '#f2c25e', height = 92, fill = false }: { values: (number | null)[]; color?: string; height?: number; fill?: boolean }) {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (clean.length < 2) return <EmptyState label="Insufficient data" detail="" />;
  const min = Math.min(...clean); const max = Math.max(...clean); const range = max - min || 1;
  const points = clean.map((v, i) => `${(i / (clean.length - 1)) * 100},${height - 8 - ((v - min) / range) * (height - 18)}`).join(' ');
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Trend chart">
      {fill && <polygon points={`0,${height} ${points} 100,${height}`} fill={color} opacity=".08" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Candlestick series ────────────────────────────────────────────────────────
type CandleBar = { open: number; high: number; low: number; close: number };
type IndicatorOverlays = {
  ema9?: boolean; ema21?: boolean; sma50?: boolean; bb?: boolean;
};
type IndicatorValues = {
  ema9?: number; ema21?: number; sma50?: number;
  bollingerUpper?: number; bollingerLower?: number;
} | null | undefined;

export function CandlestickSeries({ candles, overlays, indicators }: {
  candles: CandleBar[];
  overlays?: IndicatorOverlays;
  indicators?: IndicatorValues;
}) {
  if (candles.length < 2) return <EmptyState label="Insufficient candle data." detail="" />;

  const highs = candles.map(c => c.high);
  const lows  = candles.map(c => c.low);
  let max = Math.max(...highs);
  let min = Math.min(...lows);

  // expand range for overlays
  if (overlays?.bb && indicators?.bollingerUpper) max = Math.max(max, indicators.bollingerUpper);
  if (overlays?.bb && indicators?.bollingerLower) min = Math.min(min, indicators.bollingerLower);

  const range = max - min || 1;
  const y = (v: number) => 5 + ((max - v) / range) * 90;
  const step      = 100 / candles.length;
  const bodyWidth = Math.max(0.6, step * 0.52);

  // Simple EMA approximation for overlay lines
  const closes = candles.map(c => c.close);
  const buildEmaLine = (span: number) => {
    const k = 2 / (span + 1);
    let ema = closes[0]!;
    return closes.map((c, i) => { ema = i === 0 ? c : (c - ema) * k + ema; return ema; });
  };
  const smaN = (n: number) => closes.map((_, i) => i < n - 1 ? null : closes.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);

  const ema9Line  = overlays?.ema9  ? buildEmaLine(9)  : null;
  const ema21Line = overlays?.ema21 ? buildEmaLine(21) : null;
  const sma50Line = overlays?.sma50 ? smaN(50)         : null;

  const linePoints = (vals: (number | null)[]) =>
    vals.map((v, i) => v !== null ? `${i * step + step / 2},${y(v)}` : null)
        .filter(Boolean).join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Candlestick chart">
      {/* Grid lines */}
      {[20, 40, 60, 80].map(line => (
        <line key={line} x1="0" x2="100" y1={line} y2={line} stroke="#1d2834" strokeWidth=".3" vectorEffect="non-scaling-stroke" />
      ))}

      {/* Bollinger Bands */}
      {overlays?.bb && indicators?.bollingerUpper && indicators?.bollingerLower && (
        <rect x="0" y={y(indicators.bollingerUpper)} width="100" height={y(indicators.bollingerLower) - y(indicators.bollingerUpper)}
          fill="#f2c25e" opacity=".04" />
      )}

      {/* SMA50 line */}
      {sma50Line && (
        <polyline points={linePoints(sma50Line)} fill="none" stroke="#b07efa" strokeWidth="0.8"
          strokeDasharray="2 1.5" vectorEffect="non-scaling-stroke" />
      )}

      {/* EMA21 line */}
      {ema21Line && (
        <polyline points={linePoints(ema21Line)} fill="none" stroke="#7aa4f5" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
      )}

      {/* EMA9 line */}
      {ema9Line && (
        <polyline points={linePoints(ema9Line)} fill="none" stroke="#f2c25e" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
      )}

      {/* Candles */}
      {candles.map((c, index) => {
        const x      = index * step + step / 2;
        const top    = y(Math.max(c.open, c.close));
        const bottom = y(Math.min(c.open, c.close));
        const bodyH  = Math.max(1.0, bottom - top);
        const isUp   = c.close >= c.open;
        const color  = isUp ? '#69d8b5' : '#ef9491';
        return (
          <g key={`${c.open}-${index}`}>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth=".6" vectorEffect="non-scaling-stroke" />
            <rect x={x - bodyWidth / 2} y={top} width={bodyWidth} height={bodyH} fill={color} opacity=".9" rx=".2" />
          </g>
        );
      })}
    </svg>
  );
}

// ── Data key ──────────────────────────────────────────────────────────────────
export function DataKey({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#202a36] py-3 last:border-0">
      <span className="text-xs text-[#788597]">{label}</span>
      <span className={cn('font-mono text-xs', tone ?? 'text-[#d7e0ea]')}>{value}</span>
    </div>
  );
}

// ── Section link ──────────────────────────────────────────────────────────────
export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[.12em] text-[#a4b1c1] hover:text-[#f2c25e] transition-colors">
      {children}<ChevronRight className="h-3 w-3" />
    </Link>
  );
}

// ── Mini legend ───────────────────────────────────────────────────────────────
export function MiniLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-2 text-[11px] text-[#798698]">
          <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}
        </span>
      ))}
    </div>
  );
}

// ── Upload box ────────────────────────────────────────────────────────────────
export function UploadBox({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={cn('flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-all duration-200',
        dragging ? 'border-[#f2c25e] bg-[#332a19]/30 shadow-[0_0_20px_rgba(242,194,94,.15)]' : 'border-[#3a4755] bg-[#0e141c] hover:border-[#77879a]',
      )}>
      <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[#3c4857] bg-[#161e28] text-[#f2c25e]">
        <Upload className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold text-[#d8e0eb]">Drop a market CSV here</span>
      <span className="mt-1 text-xs text-[#718095]">or click · OHLC columns required</span>
      <span className="mt-2 font-mono text-[9px] text-[#4e5e70]">Supported formats: MetaTrader, Investing.com, Yahoo Finance</span>
    </label>
  );
}
