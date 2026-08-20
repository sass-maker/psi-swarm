---
title: External Trace Insight Validation
description: Reproducible Chrome DevTools MCP regression fixtures for the optional trace-insight adapter boundary.
---

# External trace-insight validation

The optional external-adapter boundary is validated against two known
performance regressions and one control. The fixture server lives at
`cli/test/fixtures/trace-regression-server.mjs`; the external adapter fixture
lives beside it.

## Chrome DevTools oracle

Captured with Chrome DevTools MCP performance traces on 2026-07-31, without CPU
or network throttling:

| Fixture | Observed LCP | Phase evidence | DevTools insight |
| --- | ---: | --- | --- |
| `/` | 41 ms | TTFB 1 ms; render delay 40 ms | no regression |
| `/document-delay` | 839 ms | TTFB 805 ms; render delay 35 ms | `DocumentLatency` |
| `/render-delay` | 864 ms | TTFB 3 ms; render delay 862 ms | `LCPBreakdown` |

`DocumentLatency` uses Chrome DevTools' 600 ms initial-response threshold. The
render-delay fixture uses the same threshold to keep the regression boundary
explicit and well above trace noise.

## Reproduce

Start the fixture server:

```bash
node cli/test/fixtures/trace-regression-server.mjs
```

Then use Chrome DevTools MCP to record a reload trace for each route and inspect
`DocumentLatency` or `LCPBreakdown`. Run the deterministic adapter validation:

```bash
pnpm --filter psi-swarm test
```

The test discovers the fixture through `PSI_TRACE_INSIGHT_ADAPTER`, derives one
insight per case, and verifies the external adapter id, diagnosis, artifact
path, and persisted SQLite row. The fixture adapter is validation-only; PSI
Swarm still ships no Chrome DevTools MCP runtime dependency.
