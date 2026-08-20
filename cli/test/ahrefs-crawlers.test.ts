import assert from 'node:assert/strict';
import test from 'node:test';
import { isAhrefsCrawlerIp } from '../src/ahrefs.js';

test('isAhrefsCrawlerIp matches an exact known IP', () => {
  assert.equal(isAhrefsCrawlerIp('54.36.148.1', ['54.36.148.1'], []), true);
});

test('isAhrefsCrawlerIp rejects an unrelated IP', () => {
  assert.equal(isAhrefsCrawlerIp('8.8.8.8', ['54.36.148.1'], ['54.36.148.0/24']), false);
});

test('isAhrefsCrawlerIp matches an IP inside a CIDR range', () => {
  assert.equal(isAhrefsCrawlerIp('54.36.148.200', [], ['54.36.148.0/24']), true);
});

test('isAhrefsCrawlerIp respects CIDR boundaries', () => {
  assert.equal(isAhrefsCrawlerIp('54.36.149.1', [], ['54.36.148.0/24']), false);
});

test('isAhrefsCrawlerIp treats /32 as an exact match', () => {
  assert.equal(isAhrefsCrawlerIp('1.2.3.4', [], ['1.2.3.4/32']), true);
  assert.equal(isAhrefsCrawlerIp('1.2.3.5', [], ['1.2.3.4/32']), false);
});

test('isAhrefsCrawlerIp handles malformed input without throwing', () => {
  assert.equal(isAhrefsCrawlerIp('not-an-ip', [], ['54.36.148.0/24']), false);
  assert.equal(isAhrefsCrawlerIp('54.36.148.1', [], ['not-a-cidr']), false);
});
