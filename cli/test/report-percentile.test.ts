import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSwarmReport } from '../src/report.js';
import { PRESETS } from '../src/presets.js';

// With two values, flooring the percentile index incorrectly selects 2000ms
// and passes the gate. Linear interpolation (also used by the table) is 2750ms.
test('report verdict uses the same interpolated p75 as its table', () => {
  const results = [2000, 3000].map((lcp) => ({
    preset: PRESETS.desktop,
    startedAt: 0,
    finishedAt: 1000,
    metrics: { lcp },
  }));
  const report = renderSwarmReport('https://example.com', results, 2000);
  assert.match(report, /NEEDS WORK/);
  assert.match(report, /observed p75 = 2\.75s/);
  assert.doesNotMatch(report, /observed p75 = 2\.00s/);
});

const run = (lcp: number) => ({
  preset: PRESETS.desktop,
  startedAt: 0,
  finishedAt: 1000,
  metrics: { lcp },
});

test('failed or absent measurements cannot produce a passing verdict', () => {
  for (const results of [
    [],
    [{ ...run(100), error: 'navigation failed' }],
    [{ ...run(100), metrics: {} }],
  ]) {
    const report = renderSwarmReport('https://example.com', results, 1000);
    assert.doesNotMatch(report, /CWV LCP gate/);
    assert.match(report, /0 ok/);
  }
});

test('LCP verdict includes the boundary and excludes failed outliers', () => {
  for (const [lcp, verdict] of [
    [2500, 'GOOD'],
    [4000, 'NEEDS WORK'],
    [4001, 'POOR'],
  ] as const) {
    const report = renderSwarmReport(
      'https://example.com',
      [run(lcp), { ...run(90000), error: 'failed' }],
      1000
    );
    assert.match(report, new RegExp(`gate.*${verdict}`));
    assert.match(report, /1 ok, 1 failed/);
  }
});

test('traffic summary normalizes available weights and omits missing metrics', () => {
  const results = [run(2000), { ...run(6000), preset: { ...PRESETS.desktop, name: 'slow' } }];
  const report = renderSwarmReport('https://example.com', results, 1000, {
    trafficProfile: { name: 'audience', weights: { desktop: 3, slow: 1, absent: 100 } },
  });
  assert.match(report, /Weighted verdict \(audience\).*LCP 3\.00s/);
  assert.match(report, /75% desktop \+ 25% slow/);
  assert.doesNotMatch(report, /CLS 0/);
  assert.doesNotMatch(
    renderSwarmReport('https://example.com', results, 1000, {
      trafficProfile: { name: 'none', weights: { desktop: 0, slow: -1 } },
    }),
    /Weighted verdict/
  );
});

test('field comparisons retain source scope and distinguish optimistic lab runs', () => {
  for (const [lab, field, expected] of [
    [2000, 4000, /2\.0× more optimistic/],
    [6000, 3000, /2\.0× more pessimistic/],
    [800, 800, /lab matches reality/],
  ] as const) {
    const report = renderSwarmReport('https://example.com', [run(lab)], 1000, {
      cruxByFormFactor: {
        desktop: {
          source: 'url',
          collectionPeriod: '2026-08-01 to 2026-08-28',
          metrics: {
            lcp: { p75: field },
            cls: { p75: 0.2 },
            inp: { p75: 600 },
            fcp: { p75: 2000 },
            ttfb: { p75: 500 },
          },
        },
      },
    });
    assert.match(report, expected);
    assert.match(report, /URL-specific.*2026-08-01 to 2026-08-28/);
    assert.match(report, /28-day field data/);
    assert.match(report, /mobile \(PHONE\)/);
  }
});

test('unavailable field metrics do not fabricate a lab comparison', () => {
  for (const cruxByFormFactor of [{}, { desktop: { source: 'origin' as const, metrics: {} } }]) {
    const report = renderSwarmReport('https://example.com', [run(1000)], 1000, {
      cruxByFormFactor,
    });
    assert.doesNotMatch(report, /Lab vs field gap/);
  }
});
