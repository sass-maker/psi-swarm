import assert from 'node:assert/strict';
import test from 'node:test';
import { computeStats, percentile } from '../src/stats.js';
import {
  isCloudflarePlatformHost,
  hostnameFromUrl,
  shouldFetchDomainRating,
} from '../src/domain.js';

// --- stats.ts ---

test('computeStats returns null for an empty array', () => {
  assert.equal(computeStats([]), null);
});

test('computeStats returns null when all values are non-finite', () => {
  assert.equal(computeStats([NaN, Infinity, -Infinity]), null);
});

test('computeStats filters out non-finite values before computing', () => {
  const s = computeStats([1, 2, NaN, 3, Infinity]);
  assert.equal(s?.n, 3);
  assert.equal(s?.min, 1);
  assert.equal(s?.max, 3);
});

test('computeStats computes mean and stddev for a simple sample', () => {
  const s = computeStats([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(s?.n, 8);
  assert.equal(s?.mean, 5);
  assert.ok(Math.abs((s?.stddev ?? -1) - 2) < 1e-9);
  assert.equal(s?.min, 2);
  assert.equal(s?.max, 9);
});

test('computeStats percentiles match expected values for a known sample', () => {
  const s = computeStats([100, 200, 300, 400, 500]);
  assert.equal(s?.p50, 300);
  assert.equal(s?.min, 100);
  assert.equal(s?.max, 500);
});

test('computeStats handles a single value', () => {
  const s = computeStats([42]);
  assert.equal(s?.n, 1);
  assert.equal(s?.mean, 42);
  assert.equal(s?.p50, 42);
  assert.equal(s?.p75, 42);
  assert.equal(s?.p99, 42);
});

test('percentile returns NaN for an empty array', () => {
  assert.ok(Number.isNaN(percentile([], 50)));
});

test('percentile returns the single element for a one-element array', () => {
  assert.equal(percentile([10], 99), 10);
});

test('percentile interpolates between adjacent ranks', () => {
  // 4 elements: indices 0..3, p50 → idx 1.5 → 20*0.5 + 30*0.5 = 25
  assert.equal(percentile([10, 20, 30, 40], 50), 25);
});

// --- domain.ts ---

test('isCloudflarePlatformHost detects *.pages.dev', () => {
  assert.equal(isCloudflarePlatformHost('foo.pages.dev'), true);
});

test('isCloudflarePlatformHost detects *.workers.dev', () => {
  assert.equal(isCloudflarePlatformHost('bar.workers.dev'), true);
});

test('isCloudflarePlatformHost is case-insensitive', () => {
  assert.equal(isCloudflarePlatformHost('Foo.Pages.Dev'), true);
});

test('isCloudflarePlatformHost rejects a real domain', () => {
  assert.equal(isCloudflarePlatformHost('example.com'), false);
});

test('isCloudflarePlatformHost strips trailing dot', () => {
  assert.equal(isCloudflarePlatformHost('foo.pages.dev.'), true);
});

test('hostnameFromUrl extracts hostname from a valid URL', () => {
  assert.equal(hostnameFromUrl('https://example.com/path'), 'example.com');
});

test('hostnameFromUrl strips trailing dot', () => {
  assert.equal(hostnameFromUrl('https://example.com./path'), 'example.com');
});

test('hostnameFromUrl returns null for malformed input', () => {
  assert.equal(hostnameFromUrl('not-a-url'), null);
});

test('shouldFetchDomainRating returns true for a normal domain', () => {
  assert.equal(shouldFetchDomainRating('https://example.com'), true);
});

test('shouldFetchDomainRating returns false for localhost', () => {
  assert.equal(shouldFetchDomainRating('http://localhost:3000'), false);
});

test('shouldFetchDomainRating returns false for a bare IP', () => {
  assert.equal(shouldFetchDomainRating('http://192.168.1.1'), false);
});

test('shouldFetchDomainRating returns false for Cloudflare platform hosts', () => {
  assert.equal(shouldFetchDomainRating('https://foo.pages.dev'), false);
});

test('shouldFetchDomainRating returns false for malformed input', () => {
  assert.equal(shouldFetchDomainRating('not-a-url'), false);
});
