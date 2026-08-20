import React, { useState, useEffect } from 'react';
import { Box, Text, render } from 'ink';
import type { Preset } from './presets.js';
import type { RunnerEvent, RunResultWithArtifact, SwarmRunner } from './runner.js';
import { percentile } from './stats.js';

interface PresetState {
  preset: Preset;
  done: number;
  total: number;
  failed: number;
  lcps: number[];
  lastLcp?: number;
  active: boolean;
}

interface AppState {
  presets: Map<string, PresetState>;
  totalDone: number;
  total: number;
  parallel: number;
  startedAt: number;
  finishedAt?: number;
  results: RunResultWithArtifact[];
}

function progressBar(done: number, total: number, width = 18): string {
  if (total === 0) return '';
  const filled = Math.round((done / total) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function fmtMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function lcpColor(ms: number | undefined): 'green' | 'yellow' | 'red' | 'gray' {
  if (ms === undefined) return 'gray';
  if (ms <= 2500) return 'green';
  if (ms <= 4000) return 'yellow';
  return 'red';
}

interface ProgressAppProps {
  runner: SwarmRunner;
  url: string;
  initialPresets: Preset[];
  runsPerPreset: number;
  parallel: number;
  onComplete: (results: RunResultWithArtifact[]) => void;
}

const ProgressApp: React.FC<ProgressAppProps> = ({
  runner,
  url,
  initialPresets,
  runsPerPreset,
  parallel,
  onComplete,
}) => {
  const [state, setState] = useState<AppState>(() => {
    const presets = new Map<string, PresetState>();
    for (const p of initialPresets) {
      presets.set(p.name, {
        preset: p,
        done: 0,
        total: runsPerPreset,
        failed: 0,
        lcps: [],
        active: false,
      });
    }
    return {
      presets,
      totalDone: 0,
      total: initialPresets.length * runsPerPreset,
      parallel,
      startedAt: Date.now(),
      results: [],
    };
  });

  useEffect(() => {
    const handler = (e: RunnerEvent) => {
      setState((s) => {
        const presets = new Map(s.presets);
        switch (e.type) {
          case 'run-start': {
            const cur = presets.get(e.preset.name);
            if (cur) presets.set(e.preset.name, { ...cur, active: true });
            return { ...s, presets };
          }
          case 'run-complete': {
            const cur = presets.get(e.preset.name);
            if (cur) {
              const failed = cur.failed + (e.result.error ? 1 : 0);
              const lcps = e.result.metrics?.lcp ? [...cur.lcps, e.result.metrics.lcp] : cur.lcps;
              presets.set(e.preset.name, {
                ...cur,
                done: cur.done + 1,
                failed,
                lcps,
                lastLcp: e.result.metrics?.lcp ?? cur.lastLcp,
                active: cur.done + 1 < cur.total,
              });
            }
            return {
              ...s,
              presets,
              totalDone: e.done,
              results: [...s.results, e.result],
            };
          }
          case 'all-complete': {
            return { ...s, finishedAt: Date.now(), results: e.results };
          }
          case 'cancelled': {
            return { ...s, finishedAt: Date.now(), results: e.results };
          }
          default:
            return s;
        }
      });
    };
    runner.on('event', handler);
    return () => {
      runner.off('event', handler);
    };
  }, [runner]);

  useEffect(() => {
    if (state.finishedAt) {
      onComplete(state.results);
    }
  }, [state.finishedAt, state.results, onComplete]);

  const elapsedMs = (state.finishedAt ?? Date.now()) - state.startedAt;
  // avgPerRun is wall-clock time per completed run — already amortized across workers,
  // so multiplying by remaining gives the right ETA whether serial or parallel.
  const avgPerRun = state.totalDone > 0 ? elapsedMs / state.totalDone : 0;
  const remaining = state.total - state.totalDone;
  const etaMs = remaining * avgPerRun;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          psi-swarm
        </Text>
        <Text color="gray"> · </Text>
        <Text>{url}</Text>
        <Text color="gray"> · </Text>
        <Text>{state.parallel === 1 ? 'serial' : `${state.parallel}× parallel`}</Text>
      </Box>
      {Array.from(state.presets.values()).map((p) => {
        const lcpSorted = p.lcps.slice().sort((a, b) => a - b);
        const p50 = percentile(lcpSorted, 50);
        const p90 = percentile(lcpSorted, 90);
        return (
          <Box key={p.preset.name} flexDirection="row">
            <Box width={14}>
              <Text bold color={p.active ? 'cyan' : 'white'}>
                {p.active ? '● ' : '  '}
                {p.preset.name}
              </Text>
            </Box>
            <Box width={18}>
              <Text>{progressBar(p.done, p.total, 12)}</Text>
              <Text color="gray">
                {' '}
                {p.done}/{p.total}
              </Text>
            </Box>
            <Box width={18}>
              <Text color="gray">last </Text>
              <Text color={lcpColor(p.lastLcp)}>{fmtMs(p.lastLcp)}</Text>
            </Box>
            <Box width={26}>
              <Text color="gray">p50 </Text>
              <Text color={lcpColor(p50)}>{fmtMs(p50)}</Text>
              <Text color="gray"> p90 </Text>
              <Text color={lcpColor(p90)}>{fmtMs(p90)}</Text>
            </Box>
            {p.failed > 0 && (
              <Box>
                <Text color="red">{p.failed} failed</Text>
              </Box>
            )}
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text color="gray">Total: </Text>
        <Text>
          {state.totalDone}/{state.total}
        </Text>
        <Text color="gray"> Elapsed: </Text>
        <Text>{(elapsedMs / 1000).toFixed(1)}s</Text>
        {!state.finishedAt && state.totalDone > 0 && (
          <>
            <Text color="gray"> ETA: </Text>
            <Text>{(etaMs / 1000).toFixed(0)}s</Text>
          </>
        )}
        {state.finishedAt && (
          <>
            <Text color="gray"> </Text>
            <Text color="green">done</Text>
          </>
        )}
      </Box>
    </Box>
  );
};

export function renderProgress(
  runner: SwarmRunner,
  url: string,
  presets: Preset[],
  runsPerPreset: number,
  parallel: number
): Promise<RunResultWithArtifact[]> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <ProgressApp
        runner={runner}
        url={url}
        initialPresets={presets}
        runsPerPreset={runsPerPreset}
        parallel={parallel}
        onComplete={(results) => {
          setTimeout(() => {
            unmount();
            resolve(results);
          }, 50);
        }}
      />
    );
  });
}
