import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';

import { computeStats } from './stats.js';
import type { Diagnosis } from './diagnose.js';
import type { RunResultWithArtifact, MetricSet } from './runner.js';

const DEFAULT_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const DEFAULT_LOCAL_AI = 'http://localhost:3456';

export type ReasonBackend = 'openai' | 'local-ai';
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const SYSTEM_PROMPT = `You are analysing Lighthouse-derived performance data for a webpage. The data comes from N repeated Lighthouse runs against the same URL under controlled lab conditions (emulated network and CPU). Your job is to explain WHY the metrics are what they are and what specific changes would most improve them.

Core Web Vitals thresholds:
- LCP: ≤2.5s good, 2.5-4s needs work, >4s poor
- INP: ≤200ms good, 200-500ms needs work, >500ms poor (not measured in lab)
- CLS: ≤0.1 good, 0.1-0.25 needs work, >0.25 poor
- TBT: ≤200ms good, 200-600ms needs work, >600ms poor
- FCP: ≤1.8s good, 1.8-3s needs work, >3s poor
- TTFB: ≤800ms good, 800-1800ms needs work, >1800ms poor

You will be given:
1. Aggregated metric percentiles per preset (mobile / desktop).
2. Ranked Lighthouse opportunities — what to fix, with estimated savings.
3. The LCP element identification when available.

Respond in plain text (no markdown headers, no asterisks, no bullets unless natural). 4-7 sentences. Be specific: cite the actual byte counts, time savings, and LCP element names that appear in the data. Do not invent numbers. Do not give generic advice ("optimise images") — say which images, by URL or selector, and how much they would save. If the data does not support a confident root-cause, say so.

Order: (1) what's bad in one sentence, (2) the most likely cause grounded in the audit data, (3) the highest-impact fix with the expected gain, (4) a secondary fix if material.`;

export interface ReasonOptions {
  backend?: ReasonBackend;
  model?: string;
  // openai-compatible — works with OpenAI, OpenRouter, Groq, free-ai, etc.
  baseUrl?: string;
  apiKey?: string;
  /** Optional provider-specific body fields. */
  extraBody?: Record<string, JsonValue>;
  /** Optional extra headers. */
  extraHeaders?: Record<string, string>;
  // local-ai
  localAiUrl?: string;
  localAiProvider?: 'claude' | 'codex' | 'gemini';
  onChunk?: (chunk: string) => void;
}

function compactMetrics(
  results: RunResultWithArtifact[]
): Record<string, Record<string, number | null>> {
  const out: Record<string, Record<string, number | null>> = {};
  const byPreset = new Map<string, RunResultWithArtifact[]>();
  for (const r of results) {
    if (r.error) continue;
    const arr = byPreset.get(r.preset.name) ?? [];
    arr.push(r);
    byPreset.set(r.preset.name, arr);
  }
  const keys: (keyof MetricSet)[] = ['lcp', 'cls', 'tbt', 'fcp', 'ttfb', 'si', 'performance_score'];
  for (const [name, rs] of byPreset) {
    const block: Record<string, number | null> = {};
    for (const k of keys) {
      const vs = rs.map((r) => r.metrics?.[k]).filter((v): v is number => typeof v === 'number');
      const s = computeStats(vs);
      block[`${k}_p50`] = s ? Math.round(s.p50 * 100) / 100 : null;
      block[`${k}_p75`] = s ? Math.round(s.p75 * 100) / 100 : null;
      block[`${k}_p99`] = s ? Math.round(s.p99 * 100) / 100 : null;
      block[`${k}_stddev`] = s ? Math.round(s.stddev * 100) / 100 : null;
    }
    block['n'] = rs.length;
    out[name] = block;
  }
  return out;
}

function compactDiagnosis(d: Diagnosis): Record<string, unknown> {
  const ops = d.audits
    .filter((a) => a.failedIn / Math.max(1, a.totalRuns) >= 0.5)
    .slice(0, 12)
    .map((a) => {
      const top = a.topItems.slice(0, 3).map((it) => ({
        url: it.url,
        selector: it.node?.selector,
        snippet: it.node?.snippet?.slice(0, 140) ?? it.snippet?.slice(0, 140),
        wastedBytes: it.wastedBytes,
        wastedMs: it.wastedMs,
        totalBytes: it.totalBytes,
      }));
      return {
        id: a.spec.id,
        label: a.spec.label,
        kind: a.spec.kind,
        affects: a.spec.affects,
        failedInRuns: a.failedIn,
        ofRuns: a.totalRuns,
        medianValue: a.medianNumericValue,
        unit: a.unit,
        displayValue: a.displayValue,
        topItems: top,
      };
    });
  return {
    preset: d.preset,
    presetLabel: d.presetLabel,
    formFactor: d.formFactor,
    runs: d.runs,
    okRuns: d.okRuns,
    lcpElement: d.lcpElement,
    lcpPhases: d.lcpPhases,
    rankedOpportunities: ops,
  };
}

function buildReasoningPayload(
  url: string,
  results: RunResultWithArtifact[],
  diagnoses: Diagnosis[]
): {
  url: string;
  metrics: Record<string, Record<string, number | null>>;
  perPresetDiagnosis: Record<string, unknown>;
} {
  const perPreset: Record<string, unknown> = {};
  for (const d of diagnoses) perPreset[d.preset] = compactDiagnosis(d);
  return { url, metrics: compactMetrics(results), perPresetDiagnosis: perPreset };
}

export interface ReasonResult {
  text: string;
  modelUsed?: string;
  durationMs: number;
}

/**
 * Stream a reasoning response. Explicit `backend` opt overrides.
 * - `openai` works with any OpenAI-compatible Chat Completions endpoint
 *   (OpenAI, OpenRouter, Groq, your own gateway, etc.).
 * - `local-ai` wraps a locally-running CLI (Claude / Codex / Gemini).
 */
export async function streamReasoning(
  url: string,
  results: RunResultWithArtifact[],
  diagnoses: Diagnosis[],
  opts: ReasonOptions = {}
): Promise<ReasonResult> {
  const backend: ReasonBackend = opts.backend ?? 'openai';
  const payload = buildReasoningPayload(url, results, diagnoses);
  const userMessage = `Analyse this swarm. URL = ${url}\n\nData (JSON):\n${JSON.stringify(payload, null, 2)}`;
  const startedAt = Date.now();
  if (backend === 'local-ai') {
    return streamLocalAi(userMessage, opts, startedAt);
  }
  return streamOpenAi(userMessage, opts, startedAt);
}

function normalizeModelSpec(spec: string | undefined): string | undefined {
  if (!spec || spec === 'auto') return undefined;
  return spec;
}

function parseExtraJson(raw: string | undefined): Record<string, JsonValue> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, JsonValue>;
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function* sseDataLines(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]' || !data) continue;
      yield data;
    }
  }
}

function resolveOpenAiConfig(opts: ReasonOptions): {
  apiKey: string;
  baseUrl: string;
  model: string;
  extraBody: Record<string, JsonValue>;
  extraHeaders: Record<string, string>;
} {
  const apiKey = opts.apiKey ?? process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing AI_API_KEY env var. Set it for the configured free-provider endpoint, or use --reason-backend local-ai.'
    );
  }
  const baseUrl = (opts.baseUrl ?? process.env.AI_BASE_URL ?? DEFAULT_OPENAI_BASE).replace(
    /\/$/,
    ''
  );
  const model =
    normalizeModelSpec(opts.model) ??
    normalizeModelSpec(process.env.AI_MODEL) ??
    'gemini-2.5-flash';
  const extraBody = { ...parseExtraJson(process.env.AI_EXTRA_BODY), ...(opts.extraBody ?? {}) };
  const extraHeaders = {
    ...parseExtraJson(process.env.AI_EXTRA_HEADERS),
    ...(opts.extraHeaders ?? {}),
  } as Record<string, string>;
  return { apiKey, baseUrl, model, extraBody, extraHeaders };
}

async function streamOpenAi(
  userMessage: string,
  opts: ReasonOptions,
  startedAt: number
): Promise<ReasonResult> {
  const { apiKey, baseUrl, model, extraBody, extraHeaders } = resolveOpenAiConfig(opts);
  const provider = createOpenAICompatible({
    name: 'psi-swarm-direct',
    baseURL: baseUrl,
    apiKey,
    headers: extraHeaders,
  });
  const result = streamText({
    model: provider.chatModel(model),
    system: SYSTEM_PROMPT,
    prompt: userMessage,
    ...(Object.keys(extraBody).length > 0
      ? { providerOptions: { 'psi-swarm-direct': extraBody } }
      : {}),
    maxRetries: 2,
  });
  let text = '';
  for await (const delta of result.textStream) {
    text += delta;
    opts.onChunk?.(delta);
  }
  return { text: text.trim(), modelUsed: model, durationMs: Date.now() - startedAt };
}

async function streamLocalAi(
  userMessage: string,
  opts: ReasonOptions,
  startedAt: number
): Promise<ReasonResult> {
  const baseUrl = opts.localAiUrl ?? process.env.LOCAL_AI_URL ?? DEFAULT_LOCAL_AI;
  const provider = opts.localAiProvider ?? 'claude';
  const model = opts.model && opts.model !== 'auto' ? opts.model : undefined;

  const body = JSON.stringify({
    provider,
    model,
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`local-ai HTTP ${res.status}: ${txt.slice(0, 400)}`);
  }
  if (!res.body) throw new Error('local-ai returned no body');

  let acc = '';
  for await (const data of sseDataLines(res)) {
    try {
      const parsed = JSON.parse(data);
      const chunk = (parsed.text as string | undefined) ?? (parsed.delta as string | undefined);
      if (chunk) {
        acc += chunk;
        opts.onChunk?.(chunk);
      }
    } catch {
      /* skip */
    }
  }
  return {
    text: acc.trim(),
    modelUsed: `local-ai:${provider}`,
    durationMs: Date.now() - startedAt,
  };
}

export async function probeLocalAi(baseUrl: string = DEFAULT_LOCAL_AI): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`);
    if (!res.ok) return false;
    const json = (await res.json()) as { status?: string };
    return json.status === 'ok';
  } catch {
    return false;
  }
}
