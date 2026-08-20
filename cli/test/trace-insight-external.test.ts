import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { HistoryDB } from '../src/db.js';
import type { LcpPhase } from '../src/audits.js';
import type { RunResultWithArtifact } from '../src/runner.js';
import { deriveTraceInsights, resolveTraceInsightAdapter } from '../src/trace-insight.js';

const adapterPath = fileURLToPath(
  new URL('./fixtures/chrome-devtools-trace-insight.mjs', import.meta.url)
);

const preset = {
  name: 'desktop',
  label: 'Desktop',
  formFactor: 'desktop' as const,
  throttling: {} as never,
  screenEmulation: {} as never,
};

function result(lcp: number, ttfb: number, phases: LcpPhase[]): RunResultWithArtifact {
  return {
    preset,
    startedAt: Date.now(),
    finishedAt: Date.now() + 1,
    metrics: { lcp, ttfb },
    audits: [
      {
        id: 'largest-contentful-paint-element',
        score: 1,
        lcpPhases: phases,
      },
    ],
  };
}

const cases = [
  {
    name: 'keeps the control free of known regressions',
    url: 'http://127.0.0.1:43189/',
    result: result(41, 1, [
      { phase: 'TTFB', timingMs: 1, percent: '2.4%' },
      { phase: 'Render Delay', timingMs: 40, percent: '97.6%' },
    ]),
    expectedPhase: undefined,
    expectedSummary: 'No known Chrome DevTools regression detected',
  },
  {
    name: 'matches the Chrome DevTools DocumentLatency regression',
    url: 'http://127.0.0.1:43189/document-delay',
    result: result(839, 805, [
      { phase: 'TTFB', timingMs: 805, percent: '95.9%' },
      { phase: 'Render Delay', timingMs: 35, percent: '4.1%' },
    ]),
    expectedPhase: 'TTFB',
    expectedSummary: 'DocumentLatency regression: 805ms TTFB',
  },
  {
    name: 'matches the Chrome DevTools LCPBreakdown regression',
    url: 'http://127.0.0.1:43189/render-delay',
    result: result(864, 3, [
      { phase: 'TTFB', timingMs: 3, percent: '0.3%' },
      { phase: 'Render Delay', timingMs: 862, percent: '99.7%' },
    ]),
    expectedPhase: 'Render Delay',
    expectedSummary: 'LCPBreakdown regression: 862ms render delay',
  },
] as const;

test('external trace-insight adapter matches Chrome DevTools regression oracles', async (t) => {
  const previousPath = process.env.PSI_TRACE_INSIGHT_ADAPTER;
  process.env.PSI_TRACE_INSIGHT_ADAPTER = adapterPath;

  const dir = mkdtempSync(join(tmpdir(), 'psi-trace-insight-'));
  const db = new HistoryDB(join(dir, 'history.db'));

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    if (previousPath === undefined) {
      delete process.env.PSI_TRACE_INSIGHT_ADAPTER;
    } else {
      process.env.PSI_TRACE_INSIGHT_ADAPTER = previousPath;
    }
  });

  const adapter = await resolveTraceInsightAdapter();
  assert.equal(adapter.name, 'chrome-devtools-mcp-validation');

  for (const regression of cases) {
    await t.test(regression.name, async () => {
      db.insert({
        url: regression.url,
        preset: preset.name,
        started_at: regression.result.startedAt,
        finished_at: regression.result.finishedAt,
        metrics: regression.result.metrics,
      });

      const artifactPath = `/tmp/${regression.url.split('/').pop() || 'control'}.json`;
      const insights = await deriveTraceInsights(db, regression.url, [regression.result], {
        adapter,
        artifactPaths: new Map([[preset.name, artifactPath]]),
      });

      assert.equal(insights.length, 1);
      assert.equal(insights[0].adapter, adapter.name);
      assert.equal(insights[0].bottleneckPhase, regression.expectedPhase);
      assert.equal(insights[0].summary, regression.expectedSummary);
      assert.equal(insights[0].artifactPath, artifactPath);

      const stored = db.runInsightsForUrl(regression.url, 1);
      assert.equal(stored.length, 1);
      assert.equal(stored[0].adapter, adapter.name);
      assert.equal(stored[0].bottleneck_phase, regression.expectedPhase ?? null);
      assert.equal(stored[0].summary, regression.expectedSummary);
      assert.equal(stored[0].artifact_path, artifactPath);
    });
  }
});
