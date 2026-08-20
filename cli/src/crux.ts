const CRUX_ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

type CruxFormFactor = 'PHONE' | 'DESKTOP' | 'TABLET';

interface CruxMetricSnapshot {
  p75: number;
}

export interface CruxRecord {
  source: 'origin' | 'url';
  origin?: string;
  url?: string;
  formFactor?: CruxFormFactor;
  collectionPeriod?: string;
  metrics: {
    lcp?: CruxMetricSnapshot;
    cls?: CruxMetricSnapshot;
    inp?: CruxMetricSnapshot;
    fcp?: CruxMetricSnapshot;
    ttfb?: CruxMetricSnapshot;
  };
}

export interface FetchCruxOptions {
  apiKey?: string;
  formFactor?: CruxFormFactor;
  /** If true, try URL-specific first then fall back to origin. */
  preferUrl?: boolean;
}

interface CruxApiMetric {
  histogram?: unknown;
  percentiles?: { p75?: number | string };
}

interface CruxApiResponse {
  record?: {
    key?: { origin?: string; url?: string; formFactor?: CruxFormFactor };
    metrics?: Record<string, CruxApiMetric>;
    collectionPeriod?: {
      firstDate?: { year: number; month: number; day: number };
      lastDate?: { year: number; month: number; day: number };
    };
  };
}

const METRIC_MAP: Record<string, keyof CruxRecord['metrics']> = {
  largest_contentful_paint: 'lcp',
  cumulative_layout_shift: 'cls',
  interaction_to_next_paint: 'inp',
  first_contentful_paint: 'fcp',
  experimental_time_to_first_byte: 'ttfb',
};

function parsePercentile(raw: number | string | undefined): number | undefined {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function fmtDate(d?: { year: number; month: number; day: number }): string | undefined {
  if (!d) return undefined;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

async function callCrux(
  body: Record<string, unknown>,
  apiKey: string
): Promise<{ status: number; data?: CruxApiResponse; error?: string }> {
  const res = await fetch(`${CRUX_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 404) return { status: 404 };
  if (!res.ok) {
    const txt = await res.text();
    return { status: res.status, error: txt.slice(0, 200) };
  }
  const data = (await res.json()) as CruxApiResponse;
  return { status: 200, data };
}

function buildRecord(api: CruxApiResponse, source: 'origin' | 'url'): CruxRecord | null {
  const record = api.record;
  if (!record) return null;
  const metrics: CruxRecord['metrics'] = {};
  if (record.metrics) {
    for (const [apiKey, snapshot] of Object.entries(record.metrics)) {
      const ourKey = METRIC_MAP[apiKey];
      if (!ourKey) continue;
      const p75 = parsePercentile(snapshot.percentiles?.p75);
      if (typeof p75 === 'number') metrics[ourKey] = { p75 };
    }
  }
  if (Object.keys(metrics).length === 0) return null;
  return {
    source,
    origin: record.key?.origin,
    url: record.key?.url,
    formFactor: record.key?.formFactor,
    collectionPeriod: record.collectionPeriod
      ? `${fmtDate(record.collectionPeriod.firstDate) ?? '?'} → ${fmtDate(record.collectionPeriod.lastDate) ?? '?'}`
      : undefined,
    metrics,
  };
}

/**
 * Fetch CrUX field data for a page or its origin.
 * - Returns null if CRUX_API_KEY is not set OR if Google has no data for this site.
 * - Throws only on hard API errors (auth/quota/network).
 */
export async function fetchCrux(
  pageUrl: string,
  opts: FetchCruxOptions = {}
): Promise<CruxRecord | null> {
  const apiKey = opts.apiKey ?? process.env.CRUX_API_KEY;
  if (!apiKey) return null;

  const metricsRequested = [
    'largest_contentful_paint',
    'cumulative_layout_shift',
    'interaction_to_next_paint',
    'first_contentful_paint',
    'experimental_time_to_first_byte',
  ];
  const formFactor = opts.formFactor;

  // Try URL-specific first if requested, then fall back to origin.
  if (opts.preferUrl) {
    const urlBody: Record<string, unknown> = { url: pageUrl, metrics: metricsRequested };
    if (formFactor) urlBody.formFactor = formFactor;
    const urlResult = await callCrux(urlBody, apiKey);
    if (urlResult.status === 200 && urlResult.data) {
      const rec = buildRecord(urlResult.data, 'url');
      if (rec) return rec;
    } else if (urlResult.status !== 404) {
      throw new Error(`CrUX HTTP ${urlResult.status}: ${urlResult.error}`);
    }
  }

  const origin = new URL(pageUrl).origin;
  const originBody: Record<string, unknown> = { origin, metrics: metricsRequested };
  if (formFactor) originBody.formFactor = formFactor;
  const originResult = await callCrux(originBody, apiKey);
  if (originResult.status === 404) return null;
  if (originResult.status !== 200 || !originResult.data) {
    throw new Error(`CrUX HTTP ${originResult.status}: ${originResult.error}`);
  }
  return buildRecord(originResult.data, 'origin');
}
