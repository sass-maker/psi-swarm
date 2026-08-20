type AuditKind = 'savings-ms' | 'savings-kb' | 'identification' | 'diagnostic' | 'binary';

export interface ActionableAuditSpec {
  id: string;
  label: string;
  kind: AuditKind;
  // What metric the savings most directly affect.
  affects?: Array<'lcp' | 'fcp' | 'tbt' | 'cls' | 'ttfb' | 'overall'>;
}

// The audits we capture and aggregate across runs. Ordered roughly by
// "diagnostic value when a metric is bad."
export const ACTIONABLE_AUDITS: ActionableAuditSpec[] = [
  // Identification — tells you WHICH element / resource is the problem.
  {
    id: 'largest-contentful-paint-element',
    label: 'LCP element',
    kind: 'identification',
    affects: ['lcp'],
  },
  {
    id: 'lcp-lazy-loaded',
    label: 'LCP element lazy-loaded (anti-pattern)',
    kind: 'binary',
    affects: ['lcp'],
  },
  {
    id: 'prioritize-lcp-image',
    label: 'Prioritise the LCP image',
    kind: 'savings-ms',
    affects: ['lcp'],
  },

  // Render path
  {
    id: 'render-blocking-resources',
    label: 'Eliminate render-blocking resources',
    kind: 'savings-ms',
    affects: ['fcp', 'lcp'],
  },
  {
    id: 'critical-request-chains',
    label: 'Critical request chain depth',
    kind: 'diagnostic',
    affects: ['lcp'],
  },
  {
    id: 'server-response-time',
    label: 'Server response time',
    kind: 'savings-ms',
    affects: ['ttfb', 'lcp'],
  },

  // Bytes — JS/CSS/images
  {
    id: 'unused-javascript',
    label: 'Reduce unused JavaScript',
    kind: 'savings-kb',
    affects: ['lcp', 'tbt'],
  },
  { id: 'unused-css-rules', label: 'Reduce unused CSS', kind: 'savings-kb', affects: ['lcp'] },
  { id: 'unminified-javascript', label: 'Minify JavaScript', kind: 'savings-kb', affects: ['lcp'] },
  { id: 'unminified-css', label: 'Minify CSS', kind: 'savings-kb', affects: ['lcp'] },
  {
    id: 'uses-text-compression',
    label: 'Enable text compression (gzip/brotli)',
    kind: 'savings-kb',
    affects: ['lcp', 'fcp'],
  },

  // Images
  {
    id: 'uses-optimized-images',
    label: 'Properly encode images',
    kind: 'savings-kb',
    affects: ['lcp'],
  },
  {
    id: 'uses-responsive-images',
    label: 'Properly size images',
    kind: 'savings-kb',
    affects: ['lcp'],
  },
  {
    id: 'modern-image-formats',
    label: 'Serve images in AVIF/WebP',
    kind: 'savings-kb',
    affects: ['lcp'],
  },
  {
    id: 'offscreen-images',
    label: 'Lazy-load offscreen images',
    kind: 'savings-ms',
    affects: ['lcp'],
  },
  {
    id: 'efficient-animated-content',
    label: 'Use video instead of animated GIF',
    kind: 'savings-kb',
    affects: ['lcp'],
  },

  // Network / connection hints
  {
    id: 'uses-rel-preconnect',
    label: 'Preconnect to required origins',
    kind: 'savings-ms',
    affects: ['lcp', 'fcp'],
  },
  { id: 'uses-rel-preload', label: 'Preload key requests', kind: 'savings-ms', affects: ['lcp'] },

  // JS execution / main thread (TBT drivers)
  { id: 'bootup-time', label: 'JavaScript execution time', kind: 'savings-ms', affects: ['tbt'] },
  {
    id: 'mainthread-work-breakdown',
    label: 'Main-thread work',
    kind: 'savings-ms',
    affects: ['tbt'],
  },
  {
    id: 'third-party-summary',
    label: 'Third-party impact',
    kind: 'savings-ms',
    affects: ['lcp', 'tbt'],
  },
  {
    id: 'third-party-facades',
    label: 'Lazy-load third-party embeds (facades)',
    kind: 'savings-ms',
    affects: ['tbt'],
  },

  // Page weight
  { id: 'total-byte-weight', label: 'Total page weight', kind: 'diagnostic', affects: ['lcp'] },
  { id: 'network-requests', label: 'Network requests', kind: 'diagnostic', affects: ['lcp'] },
  { id: 'dom-size', label: 'DOM size', kind: 'diagnostic', affects: ['tbt', 'cls'] },

  // CLS
  {
    id: 'layout-shift-elements',
    label: 'Largest layout shifts',
    kind: 'identification',
    affects: ['cls'],
  },
  {
    id: 'non-composited-animations',
    label: 'Non-composited animations',
    kind: 'diagnostic',
    affects: ['cls'],
  },
  {
    id: 'unsized-images',
    label: 'Images without explicit width/height',
    kind: 'diagnostic',
    affects: ['cls'],
  },
];

/**
 * A captured audit snapshot from a single Lighthouse run. We keep it small
 * (no nested arrays of arrays) so storing N copies is cheap.
 */
export interface CapturedAudit {
  id: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;
  // For audits like render-blocking-resources, unused-js — the top items.
  topItems?: AuditItem[];
  // LCP-element-only: phase breakdown (TTFB / Load Delay / Load Time / Render Delay).
  lcpPhases?: LcpPhase[];
}

export interface LcpPhase {
  phase: string;
  timingMs: number;
  percent: string;
}

export interface AuditItem {
  url?: string;
  source?: string;
  snippet?: string;
  node?: { snippet?: string; selector?: string; nodeLabel?: string };
  wastedBytes?: number;
  wastedMs?: number;
  totalBytes?: number;
  duration?: number;
  // Catch-all for other shapes (CLS elements, etc.).
  [k: string]: unknown;
}

// Shape Lighthouse uses (loose — we read with care).
interface LhAudit {
  id?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;
  details?: {
    type?: string;
    items?: Array<Record<string, unknown>>;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
  };
}

const MAX_ITEMS_PER_AUDIT = 5;

/**
 * Some audits (notably largest-contentful-paint-element) wrap their items
 * inside an outer { type: 'list', items: [{ type: 'table', items: [...] }, ...] }.
 * Recurse one level so callers see the leaf items directly.
 */
function flattenItems(
  items: Array<Record<string, unknown>> | undefined
): Array<Record<string, unknown>> {
  if (!Array.isArray(items)) return [];
  const flat: Array<Record<string, unknown>> = [];
  for (const it of items) {
    if (it && typeof it === 'object' && Array.isArray((it as { items?: unknown[] }).items)) {
      const inner = (it as { items: Array<Record<string, unknown>> }).items;
      for (const sub of inner) flat.push(sub);
    } else {
      flat.push(it);
    }
  }
  return flat;
}

function extractLcpPhases(
  items: Array<Record<string, unknown>> | undefined
): LcpPhase[] | undefined {
  if (!Array.isArray(items)) return undefined;
  // The LCP audit's outer details.items[1] is a table whose inner items have phase + timing + percent.
  for (const outer of items) {
    const inner = (outer as { items?: unknown[] }).items;
    if (!Array.isArray(inner)) continue;
    if (inner.length === 0) continue;
    const first = inner[0] as Record<string, unknown>;
    if (typeof first.phase !== 'string' || typeof first.timing !== 'number') continue;
    return inner
      .filter((row): row is { phase: string; timing: number; percent: string } => {
        const r = row as Record<string, unknown>;
        return typeof r.phase === 'string' && typeof r.timing === 'number';
      })
      .map((r) => ({ phase: r.phase, timingMs: r.timing, percent: r.percent }));
  }
  return undefined;
}

export function captureAuditsFromLhr(audits: Record<string, LhAudit>): CapturedAudit[] {
  const out: CapturedAudit[] = [];
  for (const spec of ACTIONABLE_AUDITS) {
    const a = audits[spec.id];
    if (!a) continue;
    const captured: CapturedAudit = {
      id: spec.id,
      score: typeof a.score === 'number' ? a.score : a.score === null ? null : null,
      scoreDisplayMode: a.scoreDisplayMode,
      displayValue: a.displayValue,
      numericValue: a.numericValue,
      numericUnit: a.numericUnit,
    };
    // Use overallSavings* as numericValue fallback if specific audit didn't set it.
    if (captured.numericValue === undefined) {
      if (typeof a.details?.overallSavingsMs === 'number') {
        captured.numericValue = a.details.overallSavingsMs;
        captured.numericUnit = 'millisecond';
      } else if (typeof a.details?.overallSavingsBytes === 'number') {
        captured.numericValue = a.details.overallSavingsBytes;
        captured.numericUnit = 'byte';
      }
    }
    const rawItems = a.details?.items;
    const items = flattenItems(rawItems);
    if (items.length > 0) {
      captured.topItems = items.slice(0, MAX_ITEMS_PER_AUDIT).map((it) => {
        const node = it.node as
          | { snippet?: string; selector?: string; nodeLabel?: string }
          | undefined;
        const hasNode = node && (node.snippet || node.selector || node.nodeLabel);
        return {
          url: typeof it.url === 'string' ? it.url : undefined,
          source: typeof it.source === 'string' ? it.source : undefined,
          snippet: typeof it.snippet === 'string' ? it.snippet : undefined,
          node: hasNode
            ? { snippet: node.snippet, selector: node.selector, nodeLabel: node.nodeLabel }
            : undefined,
          wastedBytes: typeof it.wastedBytes === 'number' ? it.wastedBytes : undefined,
          wastedMs: typeof it.wastedMs === 'number' ? it.wastedMs : undefined,
          totalBytes: typeof it.totalBytes === 'number' ? it.totalBytes : undefined,
          duration: typeof it.duration === 'number' ? it.duration : undefined,
        };
      });
    }
    if (spec.id === 'largest-contentful-paint-element') {
      const phases = extractLcpPhases(rawItems);
      if (phases) captured.lcpPhases = phases;
    }
    out.push(captured);
  }
  return out;
}
