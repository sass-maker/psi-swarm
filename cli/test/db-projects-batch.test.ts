import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { HistoryDB } from '../src/db.js';

const preset = 'mobile-mid';

function makeRun(url: string, tag: string | undefined, lcp: number, startedAt: number) {
  return {
    url,
    preset,
    started_at: startedAt,
    finished_at: startedAt + 1,
    metrics: { lcp },
    tag,
  };
}

test('projects() uses the latest batch p75, not individual-sample noise', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'psi-batch-'));
  const db = new HistoryDB(join(dir, 'history.db'));
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const url = 'https://example.com/';
  const now = Date.now();
  // Batch A: 5 samples with LCP ranging 71-99 (noisy)
  const batchA = 'batch-a';
  const lcpA = [800, 1200, 2100, 3500, 3900];
  for (let i = 0; i < lcpA.length; i++) {
    db.insert(makeRun(url, batchA, lcpA[i], now - 10000 + i));
  }
  // Batch B: 5 samples with lower LCP (latest batch)
  const batchB = 'batch-b';
  const lcpB = [1500, 1700, 2000, 2200, 2400];
  for (let i = 0; i < lcpB.length; i++) {
    db.insert(makeRun(url, batchB, lcpB[i], now - 1000 + i));
  }

  const projects = db.projects(30);
  assert.equal(projects.length, 1);
  const p = projects[0];
  assert.equal(p.url, url);

  // Latest batch B p75: sorted [1500, 1700, 2000, 2200, 2400], p75 = 2200
  assert.equal(p.mobileLcpP75, 2200);

  // NOT the p75 across all 10 samples (which would be higher ~2400+)
  // and NOT the newest individual sample (2400).
});

test('projects() falls back to untagged runs as single-sample batches', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'psi-untagged-'));
  const db = new HistoryDB(join(dir, 'history.db'));
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const url = 'https://example.com/';
  const now = Date.now();
  // Untagged runs — each is its own batch
  db.insert(makeRun(url, undefined, 3000, now - 10000));
  db.insert(makeRun(url, undefined, 1500, now - 1000)); // latest

  const projects = db.projects(30);
  assert.equal(projects.length, 1);
  // Latest untagged run has LCP 1500, p75 of a single sample = that sample
  assert.equal(projects[0].mobileLcpP75, 1500);
});

test('projects() returns undefined when no valid runs exist', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'psi-empty-'));
  const db = new HistoryDB(join(dir, 'history.db'));
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const url = 'https://example.com/';
  const now = Date.now();
  // Insert a run with error — should be excluded
  db.insert({
    url,
    preset,
    started_at: now,
    finished_at: now + 1,
    metrics: { lcp: 2000 },
    error: 'some error',
  });

  const projects = db.projects(30);
  assert.equal(projects.length, 1);
  assert.equal(projects[0].mobileLcpP75, undefined);
});
