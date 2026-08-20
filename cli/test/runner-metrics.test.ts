import assert from 'node:assert/strict';
import test from 'node:test';
import { hasValidMetrics, type MetricSet } from '../src/runner.js';

test('hasValidMetrics returns false for undefined metrics', () => {
  assert.equal(hasValidMetrics(undefined), false);
});

test('hasValidMetrics returns false for an empty metric set (auth wall / 401)', () => {
  const empty: MetricSet = {};
  assert.equal(hasValidMetrics(empty), false);
});

test('hasValidMetrics returns false when all values are undefined', () => {
  const allUndefined: MetricSet = {
    lcp: undefined,
    cls: undefined,
    inp: undefined,
    tbt: undefined,
    fcp: undefined,
    ttfb: undefined,
    si: undefined,
    performance_score: undefined,
  };
  assert.equal(hasValidMetrics(allUndefined), false);
});

test('hasValidMetrics returns false for non-finite values (NaN / Infinity)', () => {
  const nonFinite: MetricSet = {
    lcp: NaN,
    cls: Infinity,
    performance_score: NaN,
  };
  assert.equal(hasValidMetrics(nonFinite), false);
});

test('hasValidMetrics returns true when at least one metric is a real number', () => {
  const partial: MetricSet = {
    lcp: 2500,
    // all other metrics missing — common for INP-less lab runs
  };
  assert.equal(hasValidMetrics(partial), true);
});

test('hasValidMetrics returns true for a complete metric set', () => {
  const full: MetricSet = {
    lcp: 2100,
    cls: 0.05,
    inp: 120,
    tbt: 150,
    fcp: 900,
    ttfb: 200,
    si: 3000,
    performance_score: 95,
  };
  assert.equal(hasValidMetrics(full), true);
});

test('hasValidMetrics returns true when only performance_score is present', () => {
  const scoreOnly: MetricSet = { performance_score: 88 };
  assert.equal(hasValidMetrics(scoreOnly), true);
});
