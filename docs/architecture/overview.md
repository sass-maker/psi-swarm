---
title: Architecture overview
description: How the CLI engine, headless Chrome, the local agent, and the web UI fit together.
---

# Architecture overview

## The one diagram

```
            ┌────────────────┐
   CLI ────▶│ SwarmRunner    │ ───── spawns ─────▶ headless Chrome
            │ (event emitter)│                          │
            └───────┬────────┘                          ▼
                    │                              Lighthouse
                    ▼                                   │
            ┌────────────────┐                          ▼
            │ Ink terminal   │ ◀──── events ──── metrics + artifacts
            │ progress UI    │                       (LCP, CLS, INP,
            └────────────────┘                        TBT, FCP, TTFB,
                                                      Scripts bundle)
                    OR
                    ▼
            ┌────────────────┐    SSE     ┌─────────────────┐
            │ HTTP agent     │ ─────────▶ │ Browser web UI   │
            │ (localhost)    │            │ (Astro + React)  │
            └────────────────┘            └─────────────────┘
```

## The pieces

### `SwarmRunner` (`cli/src/runner.ts`)

The core. An `EventEmitter` that, for each preset, runs Lighthouse `N` times.
Each `runOnce` call:

1. Launches a fresh headless Chrome via `chrome-launcher` with
   `--headless=new --no-sandbox --disable-dev-shm-usage` (required for
   CI/Docker; omitting causes silent hangs).
2. Calls Lighthouse as a Node module with an inline config (not a file):
   `onlyCategories: ['performance']`, the preset's `formFactor`,
   `throttling`, and `screenEmulation`.
3. Reads numeric audit values out of the LHR and captures script bundles +
   audit details for downstream diagnosis.
4. **Always** kills Chrome in the `finally` block.

> **Cold-Chrome cost.** Every run pays a cold Chrome start (~0.3–0.8 s) × N
> × presets. Warm-Chrome reuse is a proposed optimisation — see
> [current → adaptive sampling](../current/adaptive-sampling.md).

### Terminal UI (`cli/src/ui.tsx`)

Ink (React-for-terminals) component that subscribes to `SwarmRunner` events
and renders live progress + final percentile tables. Uses Yoga (Flexbox) for
layout.

### HTTP agent (`cli/src/server.ts`)

A plain `node:http` server on `127.0.0.1:7777` (with `7778` / `localhost`
fallbacks). It wraps `SwarmRunner` and exposes the [agent API](../product/surfaces.md#agent-http-api).
Runs are tracked in an in-memory `Map<runId, RunRecord>`; subscribers receive
events over SSE. It also owns the report registry (URL → generated HTML
report paths) and starts the [background jobs](../operations/background-jobs.md).

### Web UI (`web/`)

Astro + React + Tailwind 4 static site. Each page is an `.astro` shell
mounting a React island (`RunDashboard`, `ProjectsView`, `CompareView`,
`WatchlistView`, `GalleryView`). The browser talks to the local agent over
CORS + SSE through the typed client in `web/src/lib/agent.ts`.

Compute **never** happens in the browser. The browser is only a controller;
the agent on the user's machine does the work.

### History (`cli/src/db.ts`)

`better-sqlite3` at `~/.psi-swarm/history.db`. Stores runs, domain ratings,
insights, and the watchlist. See [data model](./data-model.md).

### Reasoning (`cli/src/reason.ts`)

After a swarm, optionally streams an LLM narrative. The LLM receives a
compacted summary of the audit data (ranked opportunities + LCP element +
LCP phase breakdown), so its output cites specific byte counts and
percentages. Two backends — see [reasoning backends](../development/reasoning-backends.md).

### Trace insight (`cli/src/trace-insight.ts` + `cli/src/artifacts.ts`)

After a saved swarm: export the Lighthouse artifact bundle to
`~/.psi-swarm/artifacts/<swarm-id>/`, derive a builtin diagnosis (dominant
LCP phase, top opportunities, optional baseline delta), store it in
`run_insights`, and render it in terminal/HTML reports. An external adapter
hook is supported at `~/.psi-swarm/adapters/trace-insight.mjs` (or
`PSI_TRACE_INSIGHT_ADAPTER`). See the
[trace-insight PRD](../prds/trace-insight-adapter.md).

## Data flow for one `run`

1. CLI (or browser → agent) resolves presets via `resolvePresets`.
2. `SwarmRunner` runs `runOnce` per preset × `--runs`, serial by default.
3. Each run emits `run-start` / `run-complete` events; the terminal UI or
   SSE subscribers render them live.
4. Results are written to SQLite (`runs` table), tagged with `--tag` if given.
5. `exportSwarmArtifacts` + `deriveTraceInsights` run synchronously after the
   swarm completes (unless `--no-insight`).
6. `renderSwarmReport` / `renderHtmlReport` produce the terminal and HTML
   views; `streamReasoning` streams the LLM narrative if `--reason`.
7. CrUX and Ahrefs enrichment are fetched (unless `--no-crux` / `--no-ahrefs`).

## Non-obvious constraints

- **Serial runs by default.** Parallel Chrome instances pollute CPU
  throttling. Integrity > speed. `--parallel auto` is opt-in.
- **INP is suppressed in lab output** via a silent `if (!s) continue` guard
  in `computeStats` (`report.ts`); the notes footer documents this. CrUX
  still shows INP (real users can trigger it).
- **CrUX lookup tries URL first, then origin.** `preferUrl: true` in
  `cli/src/crux.ts` — falls back to origin-aggregate when the URL has
  insufficient traffic.
- **Ahrefs DR is skipped on Cloudflare platform hostnames** (`*.pages.dev`,
  `*.workers.dev`) — DR on shared CF subdomains is not meaningful.
- **Agent auto-probe is gated to localhost / explicit intent.** A bare
  deployed page load fires zero `127.0.0.1` requests. This was a real
  shipped fix (PR #10) — before it, the live site served failed
  `127.0.0.1:7777/7778` requests on every load.
