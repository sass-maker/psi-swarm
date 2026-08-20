import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AgentClient,
  connectToAgent,
  type HealthResponse,
  type PresetsResponse,
  type RunMetrics,
  type RunnerEvent,
  type DiagnosisResponse,
} from '../lib/agent.js';
import { applyRunStart, applyRunComplete, type PresetState } from '../lib/preset-state.js';
import { DisconnectedPanel } from './DisconnectedPanel.js';
import { auditUrlError, RunForm, type RunPlan } from './RunForm.js';

type View = 'connecting' | 'disconnected' | 'form' | 'running' | 'done';

interface RunSummary {
  byPreset: Record<
    string,
    Record<
      string,
      {
        p50: number;
        p75: number;
        p90: number;
        p99: number;
        min: number;
        max: number;
        stddev: number;
        n: number;
      } | null
    >
  >;
}

interface Suggestion {
  url: string;
  path: string;
  text: string;
}

const METRIC_SPECS: {
  key: keyof RunMetrics;
  label: string;
  unit: 'ms' | 'index' | 'score';
  good?: number;
  poor?: number;
  higherIsBetter?: boolean;
}[] = [
  {
    key: 'performance_score',
    label: 'Perf Score',
    unit: 'score',
    good: 90,
    poor: 50,
    higherIsBetter: true,
  },
  { key: 'lcp', label: 'LCP', unit: 'ms', good: 2500, poor: 4000 },
  { key: 'inp', label: 'INP', unit: 'ms', good: 200, poor: 500 },
  { key: 'cls', label: 'CLS', unit: 'index', good: 0.1, poor: 0.25 },
  { key: 'tbt', label: 'TBT', unit: 'ms', good: 200, poor: 600 },
  { key: 'fcp', label: 'FCP', unit: 'ms', good: 1800, poor: 3000 },
  { key: 'ttfb', label: 'TTFB', unit: 'ms', good: 800, poor: 1800 },
  { key: 'si', label: 'SI', unit: 'ms', good: 3400, poor: 5800 },
];

function fmt(v: number | undefined, unit: 'ms' | 'index' | 'score'): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  if (unit === 'ms') return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`;
  if (unit === 'index') return v.toFixed(3);
  return v.toFixed(0);
}

function colorClass(v: number | undefined, spec: (typeof METRIC_SPECS)[number]): string {
  if (v === undefined || !Number.isFinite(v)) return 'text-[var(--color-dim)]';
  if (spec.higherIsBetter) {
    if (v >= (spec.good ?? 0)) return 'text-[var(--color-good)]';
    if (v >= ((spec.poor ?? 0) + (spec.good ?? 0)) / 2) return 'text-[var(--color-warn)]';
    return 'text-[var(--color-poor)]';
  }
  if (v <= (spec.good ?? 0)) return 'text-[var(--color-good)]';
  if (v <= (spec.poor ?? Infinity)) return 'text-[var(--color-warn)]';
  return 'text-[var(--color-poor)]';
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export default function RunDashboard() {
  const [view, setView] = useState<View>('connecting');
  const [client, setClient] = useState<AgentClient | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [presetsData, setPresetsData] = useState<PresetsResponse | null>(null);

  const [url, setUrl] = useState('https://web.dev');
  const [runs, setRuns] = useState(5);
  const [presetGroup, setPresetGroup] = useState('psi');
  const [parallelMode, setParallelMode] = useState<'1' | 'auto'>('1');
  const [tag, setTag] = useState('');

  const [runId, setRunId] = useState<string | null>(null);
  const [activeRunPlan, setActiveRunPlan] = useState<RunPlan | null>(null);
  const [presetStates, setPresetStates] = useState<Map<string, PresetState>>(new Map());
  const [totalDone, setTotalDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [finished, setFinished] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [aggregate, setAggregate] = useState<RunSummary | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResponse | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggestionSources, setSuggestionSources] = useState<string[]>([]);
  const [reasonText, setReasonText] = useState<string>('');
  const [reasonStatus, setReasonStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');
  const [reasonModel, setReasonModel] = useState<string | undefined>();
  const [reasonBackendUsed, setReasonBackendUsed] = useState<'openai' | 'local-ai' | undefined>();
  const [reasonBackendPref, setReasonBackendPref] = useState<'auto' | 'openai' | 'local-ai'>(
    'auto'
  );
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runUnsubRef = useRef<(() => void) | null>(null);

  // Probe for the local agent. Probing is quiet + opt-in (see connectToAgent):
  // on mount we only reconnect to a remembered/explicitly-requested agent with a
  // single request; the Connect button does the full candidate fan-out on demand.
  const connect = useCallback(async (mode: 'auto' | 'explicit') => {
    setError(null);
    setView('connecting');
    const conn = await connectToAgent(mode);
    if (!conn) {
      setView('disconnected');
      return;
    }
    setClient(conn.client);
    setHealth(conn.health);
    try {
      const ps = await conn.client.presets();
      setPresetsData(ps);
      setView('form');
    } catch (err) {
      setError((err as Error).message);
      setView('disconnected');
    }
  }, []);

  useEffect(() => {
    void connect('auto');
  }, [connect]);

  useEffect(() => {
    return () => {
      runUnsubRef.current?.();
      runUnsubRef.current = null;
    };
  }, []);

  // Tick every 250ms while running so elapsed/ETA update.
  useEffect(() => {
    if (view !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [view]);

  const startRun = async (plan: RunPlan) => {
    if (!client || !presetsData) return;
    const urlProblem = auditUrlError(url);
    if (urlProblem) {
      setError(urlProblem);
      return;
    }
    setError(null);
    runUnsubRef.current?.();
    runUnsubRef.current = null;
    const presetNames = presetsData.groups[plan.presets] ?? [plan.presets];
    const initial = new Map<string, PresetState>();
    for (const name of presetNames) {
      const meta = presetsData.presets[name];
      initial.set(name, {
        name,
        label: meta?.label ?? name,
        done: 0,
        total: plan.runs,
        failed: 0,
        active: false,
        lcps: [],
      });
    }
    setActiveRunPlan(plan);
    setPresetStates(initial);
    setTotalDone(0);
    setTotal(presetNames.length * plan.runs);
    setStartedAt(Date.now());
    setNow(Date.now());
    setFinished(false);
    setCancelling(false);
    setAggregate(null);
    setDiagnosis(null);
    setSuggestions(null);
    setSuggestionSources([]);
    setReasonText('');
    setReasonStatus('idle');
    setReasonError(null);
    setReasonModel(undefined);
    setView('running');

    try {
      const { runId: id } = await client.startRun({
        url: url.trim(),
        runs: plan.runs,
        presets: plan.presets,
        parallel: plan.parallel,
        tag: plan.tag,
      });
      setRunId(id);

      const unsubscribe = client.subscribe(id, (e: RunnerEvent) => handleEvent(e));
      runUnsubRef.current = unsubscribe;
      void client
        .waitForRunCompletion(id)
        .then(() => completeRun(id))
        .catch((err) => {
          runUnsubRef.current?.();
          runUnsubRef.current = null;
          setFinished(false);
          setError(
            `Run interrupted: ${(err as Error).message}. Check the local agent, then retry.`
          );
          setView('form');
        });
    } catch (err) {
      runUnsubRef.current?.();
      runUnsubRef.current = null;
      setError((err as Error).message);
      setView('form');
    }
  };

  const handleEvent = (e: RunnerEvent) => {
    if (e.type === 'run-start') {
      setPresetStates((prev) => applyRunStart(prev, e.preset.name));
    } else if (e.type === 'run-complete') {
      setPresetStates((prev) => applyRunComplete(prev, e));
      setTotalDone(e.done);
    } else if (e.type === 'all-complete') {
      setFinished(true);
    } else if (e.type === 'cancelled') {
      setFinished(true);
      setCancelling(false);
    }
  };

  const completeRun = async (completedRunId: string) => {
    if (!client) return;
    try {
      const agg = await client.aggregate(completedRunId);
      setAggregate(agg as RunSummary);
      const diag = await client.diagnosis(completedRunId);
      setDiagnosis(diag);
      const sug = await client.suggestions(completedRunId);
      setSuggestions(sug.links);
      setSuggestionSources(sug.sources);
    } catch (err) {
      setError((err as Error).message);
    }
    runUnsubRef.current?.();
    runUnsubRef.current = null;
    setView('done');
  };

  const stopRun = async () => {
    if (!client || !runId || cancelling) return;
    setCancelling(true);
    try {
      await client.cancelRun(runId);
    } catch (err) {
      setCancelling(false);
      setError(`Failed to cancel run: ${(err as Error).message}`);
    }
  };

  const startReasoning = () => {
    if (!client || !runId) return;
    setReasonText('');
    setReasonStatus('streaming');
    setReasonError(null);
    setReasonModel(undefined);
    setReasonBackendUsed(undefined);
    client.subscribeReason(
      runId,
      (e) => {
        if (e.type === 'backend') {
          setReasonBackendUsed(e.backend);
        } else if (e.type === 'chunk') {
          setReasonText((prev) => prev + e.text);
        } else if (e.type === 'done') {
          setReasonStatus('done');
          setReasonModel(e.modelUsed);
        } else if (e.type === 'error') {
          setReasonStatus('error');
          setReasonError(e.message);
        }
      },
      { backend: reasonBackendPref }
    );
  };

  const presetStateList = useMemo(() => Array.from(presetStates.values()), [presetStates]);
  const elapsedMs = startedAt ? now - startedAt : 0;
  const avgPerRun = totalDone > 0 ? elapsedMs / totalDone : 0;
  const remaining = total - totalDone;
  const etaMs = remaining * avgPerRun;

  if (view === 'connecting') {
    return <ConnectingPanel />;
  }
  if (view === 'disconnected') {
    return <DisconnectedPanel onRetry={() => void connect('explicit')} error={error} />;
  }
  if (!presetsData || !health) {
    return <ConnectingPanel />;
  }
  return (
    <div className="space-y-8">
      <ConnectedBadge baseUrl={client?.baseUrl ?? ''} health={health} />

      {view === 'form' || view === 'done' ? (
        <RunForm
          url={url}
          setUrl={setUrl}
          runs={runs}
          setRuns={setRuns}
          presetGroup={presetGroup}
          setPresetGroup={setPresetGroup}
          parallelMode={parallelMode}
          setParallelMode={setParallelMode}
          tag={tag}
          setTag={setTag}
          presetsData={presetsData}
          onStart={startRun}
          showWarnIfParallel={parallelMode === 'auto'}
        />
      ) : null}

      {(view === 'running' || view === 'done') && (
        <LiveProgress
          presets={presetStateList}
          total={total}
          totalDone={totalDone}
          elapsedMs={elapsedMs}
          etaMs={etaMs}
          finished={finished}
          plan={activeRunPlan}
          cancelling={cancelling}
          onStop={stopRun}
        />
      )}

      {view === 'done' && aggregate && activeRunPlan && (
        <ResultsView
          aggregate={aggregate}
          presetStates={presetStateList}
          plan={activeRunPlan}
          onConfirm={() =>
            void startRun({
              intent: 'full',
              label: 'Full swarm',
              runs: 5,
              presets: 'psi',
              parallel: '1',
              tag: tag || undefined,
            })
          }
        />
      )}

      {view === 'done' && diagnosis && (
        <WhyPanel
          diagnosis={diagnosis}
          reasonStatus={reasonStatus}
          reasonText={reasonText}
          reasonModel={reasonModel}
          reasonBackendUsed={reasonBackendUsed}
          reasonBackendPref={reasonBackendPref}
          setReasonBackendPref={setReasonBackendPref}
          reasonError={reasonError}
          onAskReason={startReasoning}
        />
      )}

      {view === 'done' && suggestions && (
        <SuggestionsView
          links={suggestions}
          sources={suggestionSources}
          onPick={(u) => setUrl(u)}
        />
      )}

      {error && <ErrorBanner error={error} />}
    </div>
  );
}

function ConnectingPanel() {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg p-5 text-center sm:p-8">
      <p className="text-[var(--color-dim)]">Looking for a local psi-swarm agent…</p>
    </div>
  );
}

function ConnectedBadge({ baseUrl, health }: { baseUrl: string; health: HealthResponse }) {
  return (
    <div className="flex flex-col gap-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-good)]" />
        <span className="text-[var(--color-dim)]">connected to</span>
        <span className="break-all font-mono">{baseUrl}</span>
        <span className="text-[var(--color-dim)]">·</span>
        <span className="font-mono text-xs text-[var(--color-dim)] sm:text-sm">
          {health.machine.cores} cores · {health.machine.totalMemGB.toFixed(1)} GB · max{' '}
          {health.machine.recommendedParallel}× parallel
        </span>
      </div>
      <span className="shrink-0 font-mono text-xs text-[var(--color-dim)]">v{health.version}</span>
    </div>
  );
}

interface LiveProgressProps {
  presets: PresetState[];
  total: number;
  totalDone: number;
  elapsedMs: number;
  etaMs: number;
  finished: boolean;
  plan: RunPlan | null;
  cancelling: boolean;
  onStop: () => void;
}

function LiveProgress(props: LiveProgressProps) {
  const { presets, total, totalDone, elapsedMs, etaMs, finished, plan, cancelling, onStop } = props;
  const failed = presets.reduce((sum, preset) => sum + preset.failed, 0);
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg p-5 space-y-4 sm:p-6">
      <p className="sr-only" aria-live="polite">
        {finished
          ? `${plan?.label ?? 'Run'} complete. ${total - failed} successful, ${failed} failed.`
          : `${plan?.label ?? 'Run'} progress: ${totalDone} of ${total} audits complete.`}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {finished
              ? cancelling
                ? `${plan?.label ?? 'Run'} cancelled`
                : `${plan?.label ?? 'Run'} complete`
              : `Running ${plan?.label.toLowerCase() ?? 'swarm'}`}
          </h2>
          <p className="mt-1 text-xs text-[var(--color-dim)]">
            {plan?.intent === 'quick'
              ? 'Directional desktop evidence. Confirm with the full swarm before treating percentiles as stable.'
              : `${plan?.runs ?? 0} runs per preset · ${plan?.presets ?? 'custom'} coverage`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-mono text-[var(--color-dim)] sm:text-right">
            {totalDone}/{total} · {(elapsedMs / 1000).toFixed(1)}s
            {!finished && totalDone > 0 && ` · ETA ${(etaMs / 1000).toFixed(0)}s`}
            {failed > 0 && <span className="text-[var(--color-poor)]"> · {failed} failed</span>}
          </div>
          {!finished && (
            <button
              type="button"
              onClick={onStop}
              disabled={cancelling}
              className="shrink-0 rounded border border-[var(--color-poor)] px-3 py-1 text-xs font-semibold text-[var(--color-poor)] transition-colors hover:bg-[var(--color-poor)] hover:text-[var(--color-panel)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {cancelling ? 'Stopping…' : 'Stop'}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {presets.map((p) => {
          const sorted = p.lcps.slice().sort((a, b) => a - b);
          const p50 = percentile(sorted, 50);
          const p90 = percentile(sorted, 90);
          const min = sorted[0];
          const max = sorted.at(-1);
          const pct = (p.done / p.total) * 100;
          return (
            <div key={p.name} className="space-y-2 rounded bg-[var(--color-bg)] px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  className={`text-sm font-mono ${p.active ? 'text-[var(--color-cyan)]' : 'text-[var(--color-text)]'}`}
                >
                  {p.active ? '●' : '○'} {p.name}
                </div>
                <div className="text-xs font-mono text-[var(--color-dim)]">
                  {p.done}/{p.total}
                  {p.failed > 0 && (
                    <span className="ml-2 text-[var(--color-poor)]">{p.failed} failed</span>
                  )}
                </div>
              </div>
              <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                <div
                  className="h-2 border border-[var(--color-border)] rounded overflow-hidden"
                  role="progressbar"
                  aria-label={`${p.label} audit progress`}
                  aria-valuemin={0}
                  aria-valuemax={p.total}
                  aria-valuenow={p.done}
                >
                  <div
                    className="h-full bg-[var(--color-cyan)] transition-all motion-reduce:transition-none"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono text-[var(--color-dim)]">
                  {plan?.intent === 'quick' ? (
                    <>
                      <span>median {fmt(Number.isFinite(p50) ? p50 : undefined, 'ms')}</span>
                      <span>
                        range {fmt(min, 'ms')}–{fmt(max, 'ms')}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>p50 {fmt(Number.isFinite(p50) ? p50 : undefined, 'ms')}</span>
                      <span>p90 {fmt(Number.isFinite(p90) ? p90 : undefined, 'ms')}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultsView({
  aggregate,
  presetStates,
  plan,
  onConfirm,
}: {
  aggregate: RunSummary;
  presetStates: PresetState[];
  plan: RunPlan;
  onConfirm: () => void;
}) {
  const candidates = presetStates
    .map((preset) => ({ preset, stats: aggregate.byPreset[preset.name] }))
    .filter(
      (
        candidate
      ): candidate is {
        preset: PresetState;
        stats: NonNullable<RunSummary['byPreset'][string]>;
      } => typeof candidate.stats?.lcp?.p75 === 'number'
    )
    .sort((a, b) => (b.stats.lcp?.p75 ?? 0) - (a.stats.lcp?.p75 ?? 0));
  const slowest = candidates[0];

  return (
    <div className="space-y-6">
      {slowest && (
        <ResultOverview
          preset={slowest.preset}
          stats={slowest.stats}
          plan={plan}
          onConfirm={onConfirm}
        />
      )}

      {plan.intent !== 'quick' &&
        presetStates.map((p) => {
          const stats = aggregate.byPreset[p.name];
          if (!stats) return null;
          return (
            <div
              key={p.name}
              className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-[var(--color-border)] flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[var(--color-dim)] text-sm ml-3">{p.label}</span>
                </div>
                <span className="text-[var(--color-dim)] text-xs font-mono">
                  n = {p.done - p.failed}
                  {p.failed > 0 && (
                    <span className="ml-2 text-[var(--color-poor)]">· {p.failed} failed</span>
                  )}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-[var(--color-dim)] text-xs uppercase tracking-wide">
                      <th className="text-left py-2 px-4">Metric</th>
                      <th className="text-right py-2 px-3">p50</th>
                      <th className="text-right py-2 px-3">p75</th>
                      <th className="text-right py-2 px-3">p90</th>
                      <th className="text-right py-2 px-3">p99</th>
                      <th className="text-right py-2 px-3">min</th>
                      <th className="text-right py-2 px-3">max</th>
                      <th className="text-right py-2 px-3">σ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRIC_SPECS.map((spec) => {
                      const s = stats[spec.key];
                      if (!s) return null;
                      const cls = (v: number) =>
                        `text-right py-1.5 px-3 font-mono ${colorClass(v, spec)}`;
                      return (
                        <tr key={spec.key} className="border-t border-[var(--color-border)]">
                          <td className="py-1.5 px-4 font-medium">{spec.label}</td>
                          <td className={cls(s.p50)}>{fmt(s.p50, spec.unit)}</td>
                          <td className={cls(s.p75)}>{fmt(s.p75, spec.unit)}</td>
                          <td className={cls(s.p90)}>{fmt(s.p90, spec.unit)}</td>
                          <td className={cls(s.p99)}>{fmt(s.p99, spec.unit)}</td>
                          <td className="text-right py-1.5 px-3 font-mono text-[var(--color-dim)]">
                            {fmt(s.min, spec.unit)}
                          </td>
                          <td className="text-right py-1.5 px-3 font-mono text-[var(--color-dim)]">
                            {fmt(s.max, spec.unit)}
                          </td>
                          <td className="text-right py-1.5 px-3 font-mono text-[var(--color-dim)]">
                            {fmt(s.stddev, spec.unit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function ResultOverview({
  preset,
  stats,
  plan,
  onConfirm,
}: {
  preset: PresetState;
  stats: NonNullable<RunSummary['byPreset'][string]>;
  plan: RunPlan;
  onConfirm: () => void;
}) {
  const summaryPoint = plan.intent === 'quick' ? 'p50' : 'p75';
  const lcp = stats.lcp?.[summaryPoint];
  const status =
    lcp === undefined ? null : lcp <= 2500 ? 'Good' : lcp <= 4000 ? 'Needs work' : 'Poor';
  const statusClass =
    status === 'Good'
      ? 'text-[var(--color-good)]'
      : status === 'Needs work'
        ? 'text-[var(--color-warn)]'
        : 'text-[var(--color-poor)]';
  const primaryMetrics = METRIC_SPECS.filter((spec) =>
    ['lcp', 'cls', 'tbt', 'ttfb'].includes(spec.key)
  );

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-mono text-[var(--color-dim)]">
            {plan.intent === 'quick' ? 'Directional desktop result' : 'Slowest measured preset'}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xl font-semibold">{preset.name}</h2>
            {status && <span className={`text-sm font-semibold ${statusClass}`}>{status}</span>}
          </div>
          <p className="mt-1 text-sm text-[var(--color-dim)]">
            {preset.label} · n = {preset.done - preset.failed}
            {preset.failed > 0 && (
              <span className="text-[var(--color-poor)]"> · {preset.failed} failed</span>
            )}
          </p>
        </div>

        {plan.intent === 'quick' && (
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 shrink-0 rounded bg-[var(--color-cyan)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)]"
          >
            Confirm with full swarm
          </button>
        )}
      </div>

      <dl className="grid grid-cols-2 border-t border-[var(--color-border)] lg:grid-cols-4">
        {primaryMetrics.map((spec) => {
          const metric = stats[spec.key];
          return (
            <div
              key={spec.key}
              className="border-b border-[var(--color-border)] px-5 py-4 even:border-l lg:border-b-0 lg:border-l lg:first:border-l-0"
            >
              <dt className="text-xs text-[var(--color-dim)]">
                {plan.intent === 'quick' ? 'Observed median' : 'p75'} {spec.label}
              </dt>
              <dd className={`mt-1 font-mono text-lg ${colorClass(metric?.[summaryPoint], spec)}`}>
                {fmt(metric?.[summaryPoint], spec.unit)}
              </dd>
            </div>
          );
        })}
      </dl>

      {plan.intent === 'quick' && (
        <p className="border-t border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-dim)] sm:px-6">
          Two runs are enough to spot obvious problems, not to trust tail percentiles. The full
          swarm adds mobile conditions and a larger sample.
        </p>
      )}
    </section>
  );
}

function SuggestionsView({
  links,
  sources,
  onPick,
}: {
  links: Suggestion[];
  sources: string[];
  onPick: (u: string) => void;
}) {
  if (links.length === 0) {
    return (
      <div className="text-sm text-[var(--color-dim)] italic px-2">
        No related pages found via static HTML, sitemap, or framework routes. Likely an auth-gated
        SPA.
      </div>
    );
  }
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <span className="font-semibold">Other pages you might want to test</span>
        <span className="text-[var(--color-dim)] text-xs ml-3 font-mono">
          sources: {sources.join(', ')}
        </span>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {links.map((l) => (
          <li
            key={l.url}
            className="px-5 py-2.5 flex items-center justify-between hover:bg-[var(--color-bg)] transition"
          >
            <div className="flex flex-col">
              <span className="font-mono text-sm">{l.path}</span>
              {l.text && <span className="text-xs text-[var(--color-dim)]">{l.text}</span>}
            </div>
            <button
              onClick={() => onPick(l.url)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-xs text-[var(--color-cyan)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/50"
            >
              run this →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div
      role="alert"
      className="border border-[var(--color-poor)] bg-red-950/30 text-[var(--color-poor)] rounded p-3 text-sm"
    >
      {error}
    </div>
  );
}

interface WhyPanelProps {
  diagnosis: DiagnosisResponse;
  reasonStatus: 'idle' | 'streaming' | 'done' | 'error';
  reasonText: string;
  reasonModel?: string;
  reasonBackendUsed?: 'openai' | 'local-ai';
  reasonBackendPref: 'auto' | 'openai' | 'local-ai';
  setReasonBackendPref: (b: 'auto' | 'openai' | 'local-ai') => void;
  reasonError: string | null;
  onAskReason: () => void;
}

function WhyPanel(props: WhyPanelProps) {
  const {
    diagnosis,
    reasonStatus,
    reasonText,
    reasonModel,
    reasonBackendUsed,
    reasonBackendPref,
    setReasonBackendPref,
    reasonError,
    onAskReason,
  } = props;
  const presets = Object.entries(diagnosis.byPreset);
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold">Why these numbers?</span>
        <div className="flex flex-wrap items-center gap-3">
          {reasonStatus === 'idle' && (
            <>
              <select
                value={reasonBackendPref}
                onChange={(e) =>
                  setReasonBackendPref(e.target.value as 'auto' | 'openai' | 'local-ai')
                }
                className="min-h-11 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-dim)] focus:outline-none focus:border-[var(--color-cyan)] focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/30"
                title="LLM backend"
              >
                <option value="auto">backend: auto</option>
                <option value="local-ai">local-ai (Claude CLI)</option>
                <option value="openai">OpenAI-compatible</option>
              </select>
              <button
                onClick={onAskReason}
                className="min-h-11 px-3 py-1.5 bg-[var(--color-cyan)] text-black rounded text-xs font-medium hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]"
              >
                Ask LLM ✨
              </button>
            </>
          )}
          {reasonStatus === 'streaming' && (
            <span className="text-xs text-[var(--color-dim)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-cyan)] animate-pulse" />
              streaming via {reasonBackendUsed ?? '...'}
            </span>
          )}
          {reasonStatus === 'done' && (
            <span className="text-xs text-[var(--color-dim)] font-mono">
              {reasonBackendUsed && `${reasonBackendUsed} · `}
              {reasonModel}
            </span>
          )}
        </div>
      </div>

      {(reasonText || reasonStatus !== 'idle') && (
        <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
          {reasonStatus === 'error' && reasonError && (
            <div className="text-[var(--color-poor)] text-sm font-mono">
              Reasoning failed: {reasonError}
            </div>
          )}
          {reasonText && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {reasonText}
              {reasonStatus === 'streaming' && (
                <span className="inline-block w-2 h-4 bg-[var(--color-cyan)] ml-0.5 align-middle animate-pulse" />
              )}
            </p>
          )}
        </div>
      )}

      <div className="divide-y divide-[var(--color-border)]">
        {presets.map(([name, data]) => (
          <PresetWhy key={name} name={name} data={data} />
        ))}
      </div>
    </div>
  );
}

function PresetWhy({ name, data }: { name: string; data: DiagnosisResponse['byPreset'][string] }) {
  const { diagnosis, topOpportunities } = data;
  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-semibold">{name}</span>
          <span className="text-[var(--color-dim)] text-xs ml-3 font-mono">
            n = {diagnosis.okRuns}
          </span>
        </div>
        {diagnosis.presetLabel && (
          <span className="text-xs text-[var(--color-dim)]">{diagnosis.presetLabel}</span>
        )}
      </div>

      {diagnosis.lcpElement && (
        <div className="text-sm">
          <span className="text-[var(--color-dim)]">LCP element: </span>
          <span className="font-mono text-[var(--color-warn)]">
            {diagnosis.lcpElement.nodeLabel ?? diagnosis.lcpElement.selector ?? '(unknown)'}
          </span>
          {diagnosis.lcpElement.snippet && (
            <div className="ml-4 text-xs text-[var(--color-dim)] font-mono mt-0.5 truncate">
              {diagnosis.lcpElement.snippet}
            </div>
          )}
        </div>
      )}

      {diagnosis.lcpPhases && diagnosis.lcpPhases.length > 0 && (
        <div className="text-sm flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[var(--color-dim)]">LCP phases:</span>
          {diagnosis.lcpPhases.map((p) => {
            const pct = parseInt(p.percent, 10);
            const color =
              pct >= 40
                ? 'text-[var(--color-poor)]'
                : pct >= 25
                  ? 'text-[var(--color-warn)]'
                  : 'text-[var(--color-dim)]';
            return (
              <span key={p.phase} className={`font-mono text-xs ${color}`}>
                {p.phase} {p.percent} (
                {p.medianMs >= 1000
                  ? `${(p.medianMs / 1000).toFixed(1)}s`
                  : `${Math.round(p.medianMs)}ms`}
                )
              </span>
            );
          })}
        </div>
      )}

      {topOpportunities.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-sm">
            <thead>
              <tr className="text-[var(--color-dim)] text-xs uppercase tracking-wide">
                <th className="text-left py-1.5">Opportunity</th>
                <th className="text-left py-1.5">Impact</th>
                <th className="text-left py-1.5">Top item</th>
              </tr>
            </thead>
            <tbody>
              {topOpportunities.map((op, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 pr-3 font-medium">{op.label}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs text-[var(--color-warn)]">
                    {op.savings || op.display || '—'}
                  </td>
                  <td className="py-1.5 font-mono text-xs text-[var(--color-dim)] truncate max-w-[420px]">
                    {op.topItems[0]?.label ?? '—'}
                    {op.topItems[0]?.detail && (
                      <span className="ml-1 text-[var(--color-dim)]">
                        ({op.topItems[0].detail})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
