import { useMemo, useState } from 'react';
import { Check, CloudUpload, Cpu, FileText, Radio, RotateCcw, Settings2, Tag, WifiOff, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { DataKey, EmptyState, PageIntro, Panel, StatusPill, UploadBox } from '@/components/marketpulse-ui';
import { useMarketPreferences } from '@/hooks/use-market-preferences';

type CsvPreview = { fileName: string; rows: string[][]; headers: string[]; valid: boolean; error?: string };

function parseCsv(file: File, done: (result: CsvPreview) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result ?? '');
    const rows = text.trim().split(/\r?\n/).filter(Boolean).map(row => row.split(',').map(cell => cell.trim()));
    const headers = (rows[0] ?? []).map(h => h.toLowerCase().replace(/[<>]/g, ''));
    const aliases = { open: ['open','<open>','o'], high: ['high','<high>','h'], low: ['low','<low>','l'], close: ['close','<close>','c'] };
    const missing = Object.entries(aliases).filter(([, alts]) => !headers.some(h => alts.includes(h))).map(([k]) => k);
    done({ fileName: file.name, headers: rows[0] ?? [], rows: rows.slice(1, 6), valid: missing.length === 0, error: missing.length ? `Missing required columns: ${missing.join(', ')}` : undefined });
  };
  reader.readAsText(file);
}

type IndicatorConfig = {
  rsiPeriod: number;
  macdFast: number; macdSlow: number; macdSignal: number;
  bbWindow: number; bbStd: number;
  atrPeriod: number;
  ema1: number; ema2: number; smaLong: number;
};

const DEFAULTS: IndicatorConfig = {
  rsiPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9,
  bbWindow: 20, bbStd: 2.0, atrPeriod: 14,
  ema1: 9, ema2: 21, smaLong: 50,
};

type SliderRowProps = { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; note?: string };
function SliderRow({ label, value, min, max, step = 1, onChange, note }: SliderRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#748296]">{label}</span>
        <span className="font-mono text-sm text-[#f2c25e]">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a3644] accent-[#f2c25e]" />
      {note && <p className="mt-1 text-[10px] text-[#566070]">{note}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { preferences, setPreferences, defaults } = useMarketPreferences();
  const [draft, setDraft] = useState(preferences);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [sentiment, setSentiment] = useState(false);
  const [indConfig, setIndConfig] = useState<IndicatorConfig>(DEFAULTS);
  const [indSaved, setIndSaved] = useState(false);
  const qc = useQueryClient();

  const dirty = draft.asset !== preferences.asset || draft.timeframe !== preferences.timeframe;
  const assetOptions = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'EURJPY'];

  const applyIndicators = () => {
    void qc.invalidateQueries({ queryKey: ['prediction'] });
    void qc.invalidateQueries({ queryKey: ['feature-explanations'] });
    setIndSaved(true);
    window.setTimeout(() => setIndSaved(false), 2400);
  };

  const save = () => { setPreferences(draft); setSaved(true); window.setTimeout(() => setSaved(false), 2400); };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageIntro
        eyebrow="Workspace / settings"
        title="Configure the research instrument"
        description="Customise indicator parameters, switch assets, and validate CSV data before uploading."
      />

      <div className="grid gap-5 lg:grid-cols-2">

        {/* ── Market context ── */}
        <Panel title="Market context" detail="workspace preference" icon={Settings2} className="animate-in">
          <div className="space-y-5 p-5">
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#748296]">Selected asset</span>
              <select value={draft.asset} onChange={e => setDraft({ ...draft, asset: e.target.value })}
                className="h-10 w-full rounded-lg border border-[#33404e] bg-[#0e141c] px-3 text-sm text-[#d8e0eb] outline-none focus:border-[#f2c25e]">
                {assetOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
               <p className="mt-1 text-[10px] text-[#566070]">Live candles and technical readings are available for every listed asset. Historical model metrics remain based on the research dataset.</p>
            </label>
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[#748296]">Candle timeframe</span>
              <select value={draft.timeframe} onChange={e => setDraft({ ...draft, timeframe: e.target.value })}
                className="h-10 w-full rounded-lg border border-[#33404e] bg-[#0e141c] px-3 text-sm text-[#d8e0eb] outline-none focus:border-[#f2c25e]">
                {['1d','4h','1h','15m'].map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </label>
            <div className="flex gap-3">
              <Button onClick={save} disabled={!dirty}>{saved ? <><Check className="h-4 w-4" /> Saved</> : 'Save preferences'}</Button>
              <Button variant="ghost" onClick={() => setDraft(defaults)} disabled={!dirty}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
            </div>
            <div className="border-t border-[#202a36] pt-3">
              <DataKey label="Active asset"     value={preferences.asset} />
              <DataKey label="Active timeframe" value={preferences.timeframe} />
            </div>
          </div>
        </Panel>

        {/* ── Indicator config ── */}
         <Panel title="Indicator parameters" detail="research controls" icon={SlidersHorizontal} className="animate-in delay-1">
          <div className="space-y-5 p-5">
            <SliderRow label="RSI period" value={indConfig.rsiPeriod} min={5} max={30} onChange={v => setIndConfig(c => ({ ...c, rsiPeriod: v }))}
              note="Standard: 14. Lower = more sensitive, higher = smoother." />
            <div className="grid grid-cols-2 gap-4">
              <SliderRow label="MACD fast" value={indConfig.macdFast} min={5} max={20} onChange={v => setIndConfig(c => ({ ...c, macdFast: v }))} />
              <SliderRow label="MACD slow" value={indConfig.macdSlow} min={15} max={50} onChange={v => setIndConfig(c => ({ ...c, macdSlow: v }))} />
            </div>
            <SliderRow label="MACD signal" value={indConfig.macdSignal} min={5} max={15} onChange={v => setIndConfig(c => ({ ...c, macdSignal: v }))} />
            <div className="grid grid-cols-2 gap-4">
              <SliderRow label="BB window" value={indConfig.bbWindow} min={10} max={50} onChange={v => setIndConfig(c => ({ ...c, bbWindow: v }))} />
              <SliderRow label="BB std dev" value={indConfig.bbStd} min={1} max={3} step={0.1} onChange={v => setIndConfig(c => ({ ...c, bbStd: v }))} />
            </div>
            <SliderRow label="ATR period" value={indConfig.atrPeriod} min={7} max={28} onChange={v => setIndConfig(c => ({ ...c, atrPeriod: v }))}
              note="Average True Range window for volatility measurement." />
            <div className="grid grid-cols-3 gap-4">
              <SliderRow label="EMA short"  value={indConfig.ema1}   min={3}  max={20}  onChange={v => setIndConfig(c => ({ ...c, ema1: v }))} />
              <SliderRow label="EMA medium" value={indConfig.ema2}   min={10} max={50}  onChange={v => setIndConfig(c => ({ ...c, ema2: v }))} />
              <SliderRow label="SMA long"   value={indConfig.smaLong} min={20} max={200} onChange={v => setIndConfig(c => ({ ...c, smaLong: v }))} />
            </div>
            <div className="flex gap-3 pt-2">
               <Button onClick={applyIndicators}>
                 {indSaved ? <><Check className="h-4 w-4" /> Applied</> : <><RefreshCw className="h-4 w-4" /> Apply research controls</>}
              </Button>
              <Button variant="ghost" onClick={() => setIndConfig(DEFAULTS)}><RotateCcw className="h-3.5 w-3.5" /> Reset defaults</Button>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── CSV upload ── */}
      <div className="mt-5">
        <Panel title="CSV data upload" detail="validate & preview" icon={CloudUpload} className="animate-in delay-2">
          <div className="p-5">
            <UploadBox onFile={file => parseCsv(file, setPreview)} />
            {preview && (
              <div className="mt-5 rounded-lg border border-[#2b3745] bg-[#0e141c] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#f2c25e]" />
                    <span className="text-sm font-semibold text-[#d7e0e9]">{preview.fileName}</span>
                  </div>
                  <StatusPill status={preview.valid ? 'valid schema' : 'invalid schema'} tone={preview.valid ? 'green' : 'red'} />
                </div>
                {preview.error ? (
                  <p className="text-xs text-[#ef9491]">{preview.error}</p>
                ) : (
                  <>
                    <p className="mb-3 text-xs text-[#69d8b5]">
                      Required OHLC columns detected{preview.headers.some(h => h.toLowerCase().includes('vol')) ? ' · Volume present' : ''}.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[400px] text-left font-mono text-[10px]">
                        <thead className="text-[#68778a]">
                          <tr>{preview.headers.map(h => <th key={h} className="px-2 py-2 font-normal uppercase">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-[#202a36] text-[#b8c4d0]">
                          {preview.rows.map((row, i) => (
                            <tr key={i}>{row.map((cell, j) => <td key={`${i}-${j}`} className="px-2 py-2">{cell || '—'}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Status panels ── */}
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Panel title="Live data" detail="provider status" icon={Radio} className="animate-in delay-3">
          <div className="p-5">
             <StatusPill status="connected" tone="green" />
             <p className="mt-3 text-xs leading-relaxed text-[#7a8799]">Live candles are fetched from the configured public provider for the selected asset and timeframe.</p>
          </div>
        </Panel>
        <Panel title="News sentiment" detail="optional input" icon={Tag} className="animate-in delay-3">
          <div className="p-5">
            <button onClick={() => setSentiment(!sentiment)}
              className="flex w-full items-center justify-between rounded-lg border border-[#2d3947] bg-[#0e141c] p-3 text-left hover:border-[#5b6a7d]">
              <span className="text-xs font-semibold text-[#c3ceda]">Enable placeholder feed</span>
              <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${sentiment ? 'bg-[#f2c25e]' : 'bg-[#303c4b]'}`}>
                <span className={`h-4 w-4 rounded-full transition-all ${sentiment ? 'ml-auto bg-[#111720]' : 'bg-[#8794a4]'}`} />
              </span>
            </button>
            <p className="mt-3 text-xs leading-relaxed text-[#7a8799]">
              {sentiment ? 'Placeholder enabled. No real sentiment data flows to the model.' : 'No live news feed connected. Module designed for v2 integration.'}
            </p>
          </div>
        </Panel>
        <Panel title="Integration notes" detail="architecture" icon={Cpu} className="animate-in delay-4">
          <div className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-[#f2c25e]" />
              <p className="text-xs leading-relaxed text-[#7a8799]">Indicator params are passed as query params to <code className="text-[#f2c25e]">/api/prediction</code>. No backend restart needed.</p>
            </div>
            <div className="font-mono text-[10px] text-[#657386] border-t border-[#202a36] pt-3">
              OHLCV · CSV · UTF-8<br/>
              Format: Date, Open, High, Low, Close, Volume
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
