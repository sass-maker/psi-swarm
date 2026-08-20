import { useState } from 'react';
import type { PresetsResponse } from '../lib/agent.js';

type RunIntent = 'quick' | 'full' | 'custom';

export interface RunPlan {
  intent: RunIntent;
  label: string;
  runs: number;
  presets: string;
  parallel: '1' | 'auto';
  tag?: string;
}

interface RunFormProps {
  url: string;
  setUrl: (value: string) => void;
  runs: number;
  setRuns: (value: number) => void;
  presetGroup: string;
  setPresetGroup: (value: string) => void;
  parallelMode: '1' | 'auto';
  setParallelMode: (value: '1' | 'auto') => void;
  tag: string;
  setTag: (value: string) => void;
  presetsData: PresetsResponse;
  onStart: (plan: RunPlan) => void;
  showWarnIfParallel: boolean;
}

const PRESET_GROUP_HELP: Record<string, string> = {
  psi: 'Google PSI-style mobile and desktop conditions.',
  realistic: 'All four device and network classes.',
  mobile: 'Slow, mid-range, and fast mobile conditions.',
  desktop: 'Desktop cable conditions only.',
  fast: 'Fast mobile and desktop conditions.',
  coverage: 'All four classes for broad device coverage.',
};

export function auditUrlError(value: string): string | null {
  const target = value.trim();
  if (!target) return 'Enter an HTTP or HTTPS URL.';
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Use an HTTP or HTTPS URL.';
    }
    return null;
  } catch {
    return 'Enter a complete URL, including https://';
  }
}

export function RunForm(props: RunFormProps) {
  const [urlTouched, setUrlTouched] = useState(false);
  const runTag = props.tag || undefined;
  const urlProblem = auditUrlError(props.url);
  const canRun = urlProblem === null;
  const showUrlError = urlTouched && urlProblem;

  return (
    <form
      className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg p-5 space-y-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setUrlTouched(true);
        if (canRun) {
          props.onStart({
            intent: 'quick',
            label: 'Quick check',
            runs: 2,
            presets: 'desktop',
            parallel: '1',
            tag: runTag,
          });
        }
      }}
    >
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <label className="block text-sm font-medium" htmlFor="audit-url">
            URL to audit
          </label>
          <span className="text-xs text-[var(--color-dim)]">Runs locally in Lighthouse</span>
        </div>
        <input
          id="audit-url"
          type="url"
          value={props.url}
          onChange={(event) => props.setUrl(event.target.value)}
          onBlur={() => setUrlTouched(true)}
          placeholder="https://example.com"
          aria-invalid={showUrlError ? 'true' : undefined}
          aria-describedby={showUrlError ? 'audit-url-error' : undefined}
          className="min-h-11 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-[var(--color-cyan)] focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/30"
        />
        {showUrlError && (
          <p id="audit-url-error" className="mt-2 text-xs text-[var(--color-poor)]">
            {showUrlError}
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <button
          type="submit"
          disabled={!canRun}
          className="min-h-20 rounded bg-[var(--color-cyan)] px-4 py-3 text-left text-black transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="block font-semibold">Quick check</span>
          <span className="mt-1 block text-sm text-black/70">
            2 desktop runs · directional result in about a minute
          </span>
        </button>
        <button
          type="button"
          onClick={() =>
            props.onStart({
              intent: 'full',
              label: 'Full swarm',
              runs: 5,
              presets: 'psi',
              parallel: '1',
              tag: runTag,
            })
          }
          disabled={!canRun}
          className="min-h-20 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-left transition hover:border-[var(--color-cyan)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="block font-semibold">Full swarm</span>
          <span className="mt-1 block text-sm text-[var(--color-dim)]">
            5 runs × mobile + desktop · reliable percentiles
          </span>
        </button>
      </div>

      <details className="group border-t border-[var(--color-border)] pt-4">
        <summary className="flex min-h-11 cursor-pointer list-none flex-col items-start justify-center gap-1 text-sm font-medium focus-visible:outline-none focus-visible:text-[var(--color-cyan)] sm:flex-row sm:items-center sm:justify-between sm:gap-3 [&::-webkit-details-marker]:hidden">
          <span>Custom swarm</span>
          <span className="text-xs font-normal text-[var(--color-dim)]">
            Tune runs, presets, parallelism, and tag{' '}
            <span aria-hidden="true" className="inline-block transition group-open:rotate-180">
              ↓
            </span>
          </span>
        </summary>

        <div className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm text-[var(--color-dim)] mb-1.5" htmlFor="run-count">
                Runs per preset
              </label>
              <input
                id="run-count"
                type="number"
                min={1}
                max={200}
                value={props.runs}
                onChange={(event) =>
                  props.setRuns(
                    Math.min(200, Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                  )
                }
                className="min-h-11 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-[var(--color-cyan)] focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/30"
              />
            </div>

            <div>
              <label
                className="block text-sm text-[var(--color-dim)] mb-1.5"
                htmlFor="preset-group"
              >
                Preset group
              </label>
              <select
                id="preset-group"
                value={props.presetGroup}
                onChange={(event) => props.setPresetGroup(event.target.value)}
                aria-describedby="preset-group-help"
                className="min-h-11 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-cyan)] focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/30"
              >
                {Object.entries(props.presetsData.groups).map(([name, members]) => (
                  <option key={name} value={name}>
                    {name} ({members.length})
                  </option>
                ))}
              </select>
              <p id="preset-group-help" className="mt-1.5 text-xs text-[var(--color-dim)]">
                {PRESET_GROUP_HELP[props.presetGroup] ??
                  `${props.presetsData.groups[props.presetGroup]?.length ?? 1} preset conditions.`}
              </p>
            </div>

            <div>
              <label className="block text-sm text-[var(--color-dim)] mb-1.5" htmlFor="parallelism">
                Parallelism
              </label>
              <select
                id="parallelism"
                value={props.parallelMode}
                onChange={(event) => props.setParallelMode(event.target.value as '1' | 'auto')}
                className="min-h-11 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-cyan)] focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/30"
              >
                <option value="1">Serial (most accurate)</option>
                <option value="auto">Auto (faster, mild TBT noise)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--color-dim)] mb-1.5" htmlFor="run-tag">
              Tag (optional, for comparing later)
            </label>
            <input
              id="run-tag"
              value={props.tag}
              onChange={(event) => props.setTag(event.target.value)}
              placeholder="e.g. before-deploy"
              className="min-h-11 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-[var(--color-cyan)] focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/30"
            />
          </div>

          {props.showWarnIfParallel && (
            <p className="text-xs text-[var(--color-warn)]">
              Parallel Chrome instances are faster, but can add noise to CPU-bound metrics such as
              TBT.
            </p>
          )}

          <button
            type="button"
            onClick={() =>
              props.onStart({
                intent: 'custom',
                label: 'Custom swarm',
                runs: props.runs,
                presets: props.presetGroup,
                parallel: props.parallelMode,
                tag: runTag,
              })
            }
            disabled={!canRun}
            className="min-h-11 w-full rounded border border-[var(--color-cyan)] px-4 py-2 font-medium text-[var(--color-cyan)] transition hover:bg-[var(--color-cyan)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cyan)]/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run custom swarm
          </button>
        </div>
      </details>
    </form>
  );
}
