---
title: ADR — OSS integration evaluation
description: Evaluated OSS perf tools to integrate; decided to keep Lighthouse and add an optional trace-insight adapter.
---

# ADR: OSS integration evaluation

**Status:** Active · **Date:** 2026-06-09

> Originally a standalone evaluation; moved into `architecture/decisions/`
> because its output is a decision. Content preserved as-is.

Last updated: 2026-06-09

## Scope

Evaluate OSS integrations that strengthen psi-swarm as a local-first website
performance tracker without replacing the current Lighthouse/Web Vitals repeated
run loop.

## Shortlist

| Candidate | Source | Fit | Cost | Decision |
| --- | --- | --- | --- | --- |
| sitespeed.io | https://github.com/sitespeedio/sitespeed.io | Mature open-source performance testing suite with real browser runs, video, and monitoring-oriented outputs. | High: overlaps psi-swarm's product surface and adds a large orchestration stack. | Use as product/reference benchmark, not a dependency. |
| Browsertime | https://github.com/sitespeedio/browsertime | Lower-level browser measurement engine from the sitespeed ecosystem. Better fit than full sitespeed if psi-swarm needs video/filmstrip repeatability. | Medium/high: would sit beside Lighthouse and require output normalization. | Watchlist for a future engine adapter. |
| Chrome DevTools MCP | https://github.com/ChromeDevTools/chrome-devtools-mcp | Agent-oriented Chrome control plus trace analysis. Strong fit for LLM-readable performance evidence and deterministic insight extraction. | Medium: adapter can be optional and local-only. | Best low-risk next integration candidate. |
| WebPageTest | https://github.com/catchpoint/WebPageTest | Strong waterfall/video model and public API ecosystem. | High: self-hosting/API keys, Polyform Shield license on active branch, and hosted dependency conflict with local-first scope. | Park. Use only as comparison vocabulary. |
| GoogleChrome web-vitals | https://github.com/GoogleChrome/web-vitals | Useful if psi-swarm adds optional field/RUM probes or hosted report pages. | Low/medium but not needed for lab-only CLI. | Park until hosted/RUM scope exists. |
| Lighthouse | https://github.com/GoogleChrome/lighthouse | Already installed and central to psi-swarm. | None for current path. | Do not recommend as new integration; continue using it. |
| PSI Node client | https://github.com/GoogleChromeLabs/psi | Simple PageSpeed Insights wrapper. | Low but stale and hosted/API dependent. | Reject for local-first product direction. |

## Decision

Do not replace Lighthouse or add sitespeed.io in this pass. The highest-ROI
future work is an optional Chrome DevTools MCP or trace-insight adapter that
turns one psi-swarm run's trace/Lighthouse evidence into a compact,
LLM-readable diagnosis while preserving the existing percentile tables.

## Suggested Implementation Slice

1. Export one run's trace/Lighthouse artifact bundle through a stable local path.
2. Add an optional adapter that calls a Chrome DevTools trace parser or MCP flow
   only when installed.
3. Store the derived insight next to the existing SQLite history row.
4. Compare before/after report readability on one fixture URL.

## Verification

Docs-only evaluation in this pass. Run:

```bash
pnpm run build:cli
pnpm run build:web
```
