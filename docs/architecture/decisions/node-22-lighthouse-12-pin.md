---
title: ADR — Node 22 LTS + Lighthouse 12 pin
description: Why the engines field hard-gates node to >=20 <24.
---

# ADR: Node 22 LTS + Lighthouse 12 pin

**Status:** Active · **Date:** 2026-06 (recorded from existing constraints)

## Context

psi-swarm's measurement engine is Lighthouse 12, called programmatically as a
Node module (`import lighthouse from 'lighthouse'`). Lighthouse 12 has a
known incompatibility with **Node 24**: an internal `TraceEngineResult`
performance mark throws, so every audit fails before it starts.

This is an upstream Lighthouse issue, not something we can patch locally.

## Decision

Hard-pin the Node version via the `engines` field in both `package.json`
(root) and `cli/package.json`:

```json
"engines": { "node": ">=20 <24" }
```

The supported path is **Node 22 LTS**. The root `package.json` carries a
comment explaining the Lighthouse 12 / Node 24 trace-mark issue.

## Consequences

- Contributors on Node 24 must switch to Node 22 before `pnpm install` /
  `pnpm run setup` will work. The `better-sqlite3` native binding must also
  match the Node version — re-run `pnpm install` after changing Node.
- The pin blocks accidental upgrades and makes the failure mode immediate
  instead of a confusing runtime trace.
- When Lighthouse 13 (or a patch) drops the Node 24 incompatibility, bump
  the `engines` ceiling here and in both `package.json` files. See
  [failed approaches → Node 24](../../knowledge/failed-approaches/node-24-lighthouse-12.md).

## Note on the skill

The installable `SKILL.md` says "use the Node version that installed
`node_modules`" and mentions Node 24 verification for the current fleet
installation. That refers to the fleet machine's working install where the
native binding was built against whatever Node is present — it does **not**
contradict this pin for fresh clones. For a fresh clone, use Node 22 LTS.
