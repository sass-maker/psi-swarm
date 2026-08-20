import type { RunnerEvent } from './agent.js';

export interface PresetState {
  name: string;
  label: string;
  done: number;
  total: number;
  failed: number;
  active: boolean;
  lcps: number[];
  lastLcp?: number;
}

export function applyRunStart(
  prev: Map<string, PresetState>,
  presetName: string
): Map<string, PresetState> {
  const next = new Map(prev);
  const cur = next.get(presetName);
  if (cur) next.set(presetName, { ...cur, active: true });
  return next;
}

export function applyRunComplete(
  prev: Map<string, PresetState>,
  e: Extract<RunnerEvent, { type: 'run-complete' }>
): Map<string, PresetState> {
  const next = new Map(prev);
  const cur = next.get(e.preset.name);
  if (cur) {
    const failed = cur.failed + (e.result.error ? 1 : 0);
    const lcp = e.result.metrics?.lcp;
    const lcps = typeof lcp === 'number' ? [...cur.lcps, lcp] : cur.lcps;
    next.set(e.preset.name, {
      ...cur,
      done: cur.done + 1,
      failed,
      active: cur.done + 1 < cur.total,
      lcps,
      lastLcp: lcp ?? cur.lastLcp,
    });
  }
  return next;
}
