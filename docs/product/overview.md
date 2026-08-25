---
title: Product overview
description: What psi-swarm is, the problem it solves, what's in and out of scope.
---

# Product overview

## The problem

A single PageSpeed Insights / Lighthouse run tells you almost nothing. Two
runs on the same URL can disagree by 30%+ on LCP because of network jitter,
CPU contention, third-party scripts, and server-side variance. Deciding
"are we under 2.5 s LCP?" from one number is a coin flip.

## What psi-swarm does

It runs the **same** Lighthouse audit many times across a matrix of realistic
device/network presets and reports the **shape** of the distribution —
p50 / p75 / p90 / p99 plus min / max / σ — not one point. Then it explains
*why* the numbers are what they are, grounded in the actual audit data (LCP
element, LCP phase breakdown, ranked opportunities with byte/ms savings).

- **Free, open source (MIT), fully local.** No account, no signup, no
  telemetry — nothing leaves your machine.
- **Two surfaces, one engine.** A terminal UI (Ink) and a browser UI
  (Astro + React) both drive the same local CLI engine. Compute always
  happens on your machine; the browser is just the controller.
- **Local history.** SQLite at `~/.psi-swarm/history.db` — tag swarms
  (`--tag before-deploy`) and compare p75/p99 across deploys.
- **Optional AI reasoning.** Streamed LLM narrative via a local-ai wrapper
  (no API key) or any OpenAI-compatible endpoint.

## Surfaces at a glance

| Surface | What it is | Where |
| --- | --- | --- |
| CLI | The engine. `run`, `discover`, `serve`, `history`, `compare`, `watch`, `connect`, `whoami`; distributed as a versioned GitHub Release package | `cli/` |
| Web UI | Browser controller for the local `serve` agent | `web/` |
| Deployed site | Static Astro build on Cloudflare Pages (`psi-swarm-web`) | https://performance.sassmaker.com |
| Agent skill | Claude/Codex usage path | `SKILL.md` (installed via `pnpm install:skill`) |

See [Surfaces](./surfaces.md) for the full command/route/API inventory.

## In scope

- Lab measurement via headless Chrome + Lighthouse 13.
- Local history, comparisons, regression watchlist.
- Local browser controller.
- Optional AI reasoning over results.
- Trace-insight adapter (builtin + external hook).

## Out of scope (deferred / parked)

- Hosted RUM or real-user p99 collection — psi-swarm is **lab data**, not a
  RUM replacement. For real-user p75 use CrUX; for real-user p99 use a RUM
  tool.
- Cloud execution — compute is intentionally local.
- Paid monitoring, team accounts, alerting — deferred behind a stronger
  local workflow.

The full deferred / blocked list lives in
[GitHub Issues](https://github.com/sass-maker/psi-swarm/issues).

## Honest about what it is

- All measurements use **emulated** network and CPU on a single machine.
  Real-user p99 is dominated by device/network variance you can't reproduce
  locally.
- **INP can't be measured in lab navigation mode** — it requires real user
  input. The row is hidden when absent; CrUX still reports it (real users
  can trigger it).
- **Custom-domain Worker TTFB floor** (intentional, do not re-open without a
  budget decision): Cloudflare Workers/Pages on custom domains floor at
  400–1000 ms TTFB in Lighthouse cold-sim without Argo Smart Routing. Argo
  (cost) and Vercel (external dep) were both ruled out. `*.workers.dev` URLs
  hit <500 ms; custom domains do not. Recorded in the PSI Swarm GitHub issue
  queue linked above.
