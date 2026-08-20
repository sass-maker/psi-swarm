import {
  ACTIONABLE_AUDITS,
  type CapturedAudit,
  type AuditItem,
  type ActionableAuditSpec,
} from './audits.js';
import type { RunResultWithArtifact } from './runner.js';

export interface AggregatedAudit {
  spec: ActionableAuditSpec;
  // How many runs included this audit at all (capture coverage).
  observedIn: number;
  totalRuns: number;
  // How many runs reported the audit as failing (score < 0.9).
  failedIn: number;
  // Median of numericValue across runs that captured a finite number.
  medianNumericValue?: number;
  // Numeric unit (millisecond | byte | unitless).
  unit?: string;
  // Most descriptive displayValue seen (longest).
  displayValue?: string;
  // Union of top items across runs, deduplicated by URL or selector.
  topItems: AuditItem[];
}

export interface Diagnosis {
  url: string;
  preset: string;
  presetLabel?: string;
  formFactor?: 'mobile' | 'desktop';
  runs: number;
  okRuns: number;
  audits: AggregatedAudit[];
  // Quick-access derived insight.
  lcpElement?: {
    snippet?: string;
    selector?: string;
    nodeLabel?: string;
  };
  lcpPhases?: Array<{ phase: string; medianMs: number; percent: string }>;
  consistencyNotes: string[];
}

const FAILING_SCORE_THRESHOLD = 0.9;

function median(xs: number[]): number | undefined {
  if (xs.length === 0) return undefined;
  const sorted = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function dedupeItems(items: AuditItem[]): AuditItem[] {
  const seen = new Set<string>();
  const out: AuditItem[] = [];
  for (const it of items) {
    const key =
      it.url ?? it.source ?? it.node?.selector ?? it.snippet ?? JSON.stringify(it).slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function diagnosePreset(
  url: string,
  presetName: string,
  results: RunResultWithArtifact[],
  presetLabel?: string,
  formFactor?: 'mobile' | 'desktop'
): Diagnosis {
  const okResults = results.filter((r) => !r.error && r.audits && r.audits.length > 0);
  const consistencyNotes: string[] = [];

  // Index audits by id across runs.
  const byId = new Map<string, CapturedAudit[]>();
  for (const r of okResults) {
    if (!r.audits) continue;
    for (const a of r.audits) {
      const list = byId.get(a.id) ?? [];
      list.push(a);
      byId.set(a.id, list);
    }
  }

  const aggregated: AggregatedAudit[] = [];
  for (const spec of ACTIONABLE_AUDITS) {
    const observations = byId.get(spec.id);
    if (!observations || observations.length === 0) continue;
    const failedIn = observations.filter(
      (o) => typeof o.score === 'number' && o.score < FAILING_SCORE_THRESHOLD
    ).length;
    const numericValues = observations
      .map((o) => o.numericValue)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const itemsCombined: AuditItem[] = [];
    let displayValue: string | undefined;
    let unit: string | undefined;
    for (const o of observations) {
      if (o.topItems) itemsCombined.push(...o.topItems);
      if (o.displayValue && (!displayValue || o.displayValue.length > displayValue.length)) {
        displayValue = o.displayValue;
      }
      if (!unit && o.numericUnit) unit = o.numericUnit;
    }
    aggregated.push({
      spec,
      observedIn: observations.length,
      totalRuns: okResults.length,
      failedIn,
      medianNumericValue: median(numericValues),
      unit,
      displayValue,
      topItems: dedupeItems(itemsCombined).slice(0, 5),
    });
  }

  // Pull LCP element + phase breakdown if available.
  let lcpElement: Diagnosis['lcpElement'];
  let lcpPhases: Diagnosis['lcpPhases'];
  const lcpAudit = aggregated.find((a) => a.spec.id === 'largest-contentful-paint-element');
  if (lcpAudit && lcpAudit.topItems.length > 0) {
    const first = lcpAudit.topItems[0];
    lcpElement = {
      snippet: first.node?.snippet ?? first.snippet,
      selector: first.node?.selector,
      nodeLabel: first.node?.nodeLabel,
    };
  }
  // Aggregate phase breakdown across all runs that captured it.
  const phaseObservations = new Map<string, { timings: number[]; percent: string }>();
  for (const r of okResults) {
    const lcpAuditRun = r.audits?.find((au) => au.id === 'largest-contentful-paint-element');
    const phases = lcpAuditRun?.lcpPhases;
    if (!phases) continue;
    for (const p of phases) {
      const cur = phaseObservations.get(p.phase) ?? { timings: [], percent: p.percent };
      cur.timings.push(p.timingMs);
      cur.percent = p.percent;
      phaseObservations.set(p.phase, cur);
    }
  }
  if (phaseObservations.size > 0) {
    lcpPhases = Array.from(phaseObservations.entries()).map(([phase, data]) => ({
      phase,
      medianMs: median(data.timings) ?? 0,
      percent: data.percent,
    }));
  }

  if (okResults.length < results.length) {
    consistencyNotes.push(
      `${results.length - okResults.length} of ${results.length} runs failed or had no audits captured.`
    );
  }

  return {
    url,
    preset: presetName,
    presetLabel,
    formFactor,
    runs: results.length,
    okRuns: okResults.length,
    audits: aggregated,
    lcpElement,
    lcpPhases,
    consistencyNotes,
  };
}

/**
 * Rank audits by likely impact on the worst-performing metric.
 * Returns a sorted slice of the diagnosis's audits.
 */
export function rankOpportunities(d: Diagnosis, limit = 8): AggregatedAudit[] {
  const failed = d.audits.filter((a) => a.failedIn / Math.max(1, a.totalRuns) >= 0.5);
  // Score = (potential savings normalised) * (failure consistency).
  const scored = failed
    .map((a) => {
      let normSavings = 0;
      if (a.spec.kind === 'savings-ms' && a.medianNumericValue) {
        normSavings = Math.min(1, a.medianNumericValue / 5000); // 5s = full credit
      } else if (a.spec.kind === 'savings-kb' && a.medianNumericValue) {
        normSavings = Math.min(1, a.medianNumericValue / (500 * 1024)); // 500 KB = full credit
      } else if (a.spec.kind === 'identification' || a.spec.kind === 'binary') {
        normSavings = 0.6; // implicit value
      } else if (a.spec.kind === 'diagnostic') {
        normSavings = 0.3;
      }
      const failRatio = a.failedIn / a.totalRuns;
      return { a, score: normSavings * (0.5 + 0.5 * failRatio) };
    })
    .sort((x, y) => y.score - x.score);
  return scored.slice(0, limit).map((s) => s.a);
}

export interface FormattedAudit {
  label: string;
  display: string;
  savings: string;
  affects: string;
  topItems: { label: string; detail?: string }[];
}

export function formatAggregatedAudit(a: AggregatedAudit): FormattedAudit {
  let display = a.displayValue ?? '';
  let savings = '';
  if (a.spec.kind === 'savings-ms' && a.medianNumericValue) {
    savings =
      a.medianNumericValue >= 1000
        ? `~${(a.medianNumericValue / 1000).toFixed(1)}s save`
        : `~${Math.round(a.medianNumericValue)}ms save`;
  } else if (a.spec.kind === 'savings-kb' && a.medianNumericValue) {
    const kb = a.medianNumericValue / 1024;
    savings = kb >= 1024 ? `~${(kb / 1024).toFixed(1)}MB save` : `~${Math.round(kb)}KB save`;
  } else if (a.spec.kind === 'binary') {
    savings = a.failedIn === a.totalRuns ? '⚠ all runs' : `${a.failedIn}/${a.totalRuns} runs`;
  }
  if (!display && a.medianNumericValue !== undefined && a.unit) {
    display = `${a.medianNumericValue.toFixed(0)} ${a.unit}`;
  }
  const topItems = a.topItems.slice(0, 3).map((it) => {
    const label =
      it.url ??
      it.source ??
      it.node?.nodeLabel ??
      it.node?.selector ??
      it.node?.snippet ??
      it.snippet ??
      '(item)';
    const truncated = label.length > 100 ? label.slice(0, 97) + '...' : label;
    let detail: string | undefined;
    if (typeof it.wastedBytes === 'number')
      detail = `${Math.round(it.wastedBytes / 1024)}KB wasted`;
    else if (typeof it.wastedMs === 'number') detail = `${Math.round(it.wastedMs)}ms`;
    else if (typeof it.totalBytes === 'number') detail = `${Math.round(it.totalBytes / 1024)}KB`;
    return { label: truncated, detail };
  });
  return {
    label: a.spec.label,
    display,
    savings,
    affects: (a.spec.affects ?? []).join(', '),
    topItems,
  };
}
