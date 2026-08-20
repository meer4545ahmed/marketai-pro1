import { ArrowDownRight, ArrowUpRight, BrainCircuit, Clock3, Info, SlidersHorizontal, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { getGetFeatureExplanationsQueryKey, getGetModelInfoQueryKey, getGetPredictionQueryKey, useGetFeatureExplanations, useGetModelInfo, useGetPrediction } from '@workspace/api-client-react';
import { DataKey, EmptyState, GlowCard, LoadingPanel, PageIntro, Panel, PulseDot, QueryError, StatusPill } from '@/components/marketpulse-ui';
import { useMarketPreferences } from '@/hooks/use-market-preferences';

export default function PredictionPage() {
  const { preferences } = useMarketPreferences();
  const prediction = useGetPrediction({ asset: preferences.asset }, { query: { queryKey: getGetPredictionQueryKey({ asset: preferences.asset }), refetchInterval: 30000 } });
  const factors    = useGetFeatureExplanations({ query: { queryKey: getGetFeatureExplanationsQueryKey() } });
  const model      = useGetModelInfo({ query: { queryKey: getGetModelInfoQueryKey() } });

  const result  = prediction.data;
  const isBull  = result?.direction === 'BULLISH';
  const prob    = result ? result.probability * 100 : null;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageIntro
        eyebrow="Workspace / prediction"
        title="Model prediction &amp; explainability"
        description="Every directional output paired with confidence, horizon, and the features that drove the decision."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">

        {/* ── Prediction card ── */}
        <GlowCard bullish={!!isBull}>
          <Panel title="Latest prediction" detail={result ? new Date(result.timestamp).toLocaleString() : 'waiting'} icon={BrainCircuit}>
            {prediction.isLoading ? <LoadingPanel lines={6} /> :
             prediction.isError   ? <QueryError onRetry={() => void prediction.refetch()} /> :
             result ? (
              <div className="p-6 sm:p-8">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md border border-[#344253] bg-[#17202b] px-2.5 py-1 font-mono text-[11px] text-[#b6c2d0]">{result.asset}</span>
                    <StatusPill status={result.modelStatus} tone={result.modelStatus === 'loaded' ? 'green' : 'gold'} />
                  </div>
                  <div className="flex items-center gap-2">
                    <PulseDot active color={isBull ? '#69d8b5' : '#ef9491'} />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#6e7d90]">LIVE / {result.horizon}</span>
                  </div>
                </div>

                {/* Big prediction */}
                <div className="my-10 flex flex-col items-center text-center">
                  <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-lg ${isBull ? 'border-[#245445] bg-[#142b26] text-[#69d8b5] shadow-[0_0_30px_rgba(105,216,181,.2)]' : 'border-[#5d3032] bg-[#2b1d21] text-[#ef9491] shadow-[0_0_30px_rgba(239,148,145,.2)]'}`}>
                    {isBull ? <TrendingUp className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
                  </div>

                  <span className={`text-5xl font-extrabold tracking-[-.07em] ${isBull ? 'text-[#69d8b5]' : 'text-[#ef9491]'}`}>
                    {result.direction}
                  </span>

                  {prob !== null && (
                    <>
                      <span className="mt-4 font-mono text-[52px] font-medium tracking-[-.08em] text-[#f2c25e]">
                        {prob.toFixed(1)}<small className="ml-1 text-xl">%</small>
                      </span>
                      <span className="mt-1 text-xs text-[#758397]">model confidence in stated direction</span>
                    </>
                  )}

                  {/* Prob bar */}
                  <div className="mt-6 w-full max-w-xs space-y-1">
                    <div className="flex justify-between font-mono text-[10px] text-[#637386]">
                      <span>BEAR {((1 - result.probability) * 100).toFixed(1)}%</span>
                      <span>BULL {(result.probability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#1e2d3d]">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${isBull ? 'bg-gradient-to-r from-[#244e44] to-[#69d8b5]' : 'bg-gradient-to-r from-[#ef9491] to-[#5d1d1d]'}`}
                        style={{ width: `${result.probability * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-4 border-t border-[#202a36] pt-5">
                  <DataKey label="Asset"     value={result.asset} />
                  <DataKey label="Horizon"   value={result.horizon} />
                  <DataKey label="Timestamp" value={new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                  <DataKey label="Status"    value={result.modelStatus} tone={result.modelStatus === 'loaded' ? 'text-[#69d8b5]' : 'text-[#f2c25e]'} />
                </div>

                {/* Disclaimer */}
                <div className="mt-5 rounded-lg border border-[#4b3d21] bg-[#2c2519] p-3.5">
                  <p className="text-[11px] leading-relaxed text-[#c5ad74]">
                    <Info className="mr-2 inline h-3.5 w-3.5" />
                    {result.disclaimer}
                  </p>
                </div>
              </div>
            ) : <EmptyState />}
          </Panel>
        </GlowCard>

        {/* ── Right column ── */}
        <div className="space-y-5">
          <Panel title="Inference context" detail="model metadata" icon={SlidersHorizontal} className="animate-in delay-1">
            {model.isLoading ? <LoadingPanel lines={4} /> : model.data ? (
              <div className="px-5 py-2">
                <DataKey label="Model name"   value={model.data.modelName}    />
                <DataKey label="Version"      value={model.data.version}      />
                <DataKey label="Features"     value={`${model.data.featureCount} indicators`} />
                  <DataKey label="Market input" value={`${preferences.asset} live candle context`} />
                <DataKey label="Metadata"     value={model.data.metadataAvailable ? 'Loaded' : 'Missing'} tone={model.data.metadataAvailable ? 'text-[#69d8b5]' : 'text-[#ef9491]'} />
              </div>
            ) : <EmptyState />}
          </Panel>

          <Panel title="How to read this" icon={Clock3} className="animate-in delay-2">
            <div className="space-y-4 p-5 text-xs leading-relaxed text-[#7d8a9b]">
              <p><span className="font-semibold text-[#c7d1dc]">Probability</span> is the model's confidence — not a guaranteed price move.</p>
              <p><span className="font-semibold text-[#c7d1dc]">Direction</span> predicts whether the next daily close will be higher or lower.</p>
               <p><span className="font-semibold text-[#c7d1dc]">Model</span> uses the selected market's latest candles with a browser-safe technical baseline over 37 engineered features.</p>
              <p><span className="font-semibold text-[#c7d1dc]">Customise</span> RSI, MACD, and other parameters in Settings.</p>
            </div>
          </Panel>
        </div>
      </div>

      {/* ── Feature explanations ── */}
      <Panel title="Technical feature context" detail="baseline feature contributions · research dataset" icon={Zap} className="mt-5 animate-in delay-2">
        {factors.isLoading ? <LoadingPanel lines={6} /> :
         factors.isError   ? <QueryError onRetry={() => void factors.refetch()} /> :
         factors.data?.length ? (
          <div className="divide-y divide-[#202a36]">
            {factors.data.map((factor, i) => (
              <div key={`${factor.feature}-${i}`} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.4fr_1fr_90px] sm:items-center group hover:bg-[#14202e]/40 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-[#d6dfe9]">{factor.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#657386]">{factor.feature} · val {factor.value.toFixed(3)}</p>
                </div>
                <div className="relative h-2 overflow-hidden rounded-full bg-[#26313e]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${factor.direction === 'positive' ? 'bg-[#69d8b5]' : 'bg-[#ef9491]'}`}
                    style={{ width: `${Math.min(100, factor.contribution * 500)}%` }}
                  />
                </div>
                <span className={`flex items-center justify-end gap-1 font-mono text-xs ${factor.direction === 'positive' ? 'text-[#69d8b5]' : 'text-[#ef9491]'}`}>
                  {factor.direction === 'positive' ? '+' : '−'}{factor.contribution.toFixed(3)}
                  {factor.direction === 'positive' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                </span>
              </div>
            ))}
          </div>
        ) : <EmptyState label="No feature data" detail="Feature explanations not available." />}
      </Panel>
    </div>
  );
}
