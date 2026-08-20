---
title: Resolved — Node 24 with Lighthouse 12
description: Node 24 broke Lighthouse 12 via an internal TraceEngineResult performance mark. Resolved by upgrading to Lighthouse 13, which supports Node 24.
---

# Resolved: Node 24 with Lighthouse 12

**Tried:** running the CLI on Node 24 with Lighthouse 12.
**Result:** every Lighthouse audit failed before it started.
**Status:** Resolved — upgraded to Lighthouse 13 in August 2026.

## What broke

Lighthouse 12, called programmatically as a Node module, threw on an
internal `TraceEngineResult` performance mark under Node 24. The failure was
immediate and total — not a metric skew, a hard crash on every audit.

## Why it couldn't be patched locally

The mark was internal to Lighthouse's trace engine. We didn't own that code,
and the call site (`cli/src/runner.ts`) passed a standard inline config
(`{ port, logLevel: 'silent', output: 'json' }` + `onlyCategories:
['performance']`); there was no flag that avoided the trace-engine path while
still producing performance metrics.

## What we did

Upgraded to Lighthouse 13, which requires Node >=22.19 and supports Node 24.
This also eliminated the `extract-zip@2.0.1` transitive dependency
(GHSA-jmr9-qjv8-65gv) because Lighthouse 13 uses `puppeteer-core@25` →
`@puppeteer/browsers@3` → `modern-tar` instead of `extract-zip`. The
`engines` field is now `>=22.19` in both `package.json` files. See
[ADR: Node 22 LTS pin](../../architecture/decisions/node-22-lighthouse-12-pin.md).

> **Note:** `better-sqlite3@11.10.0` has a separate native crash on Node 24
> that is unrelated to Lighthouse. That crash affects the
> `db-projects-batch.test.ts` test only and is tracked separately.
