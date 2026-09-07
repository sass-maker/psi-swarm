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
