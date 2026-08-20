---
title: Project recommendation context
description: Auto-generated Starboard audit context — product identity, feature map, stack inventory. Reference only; not hand-maintained.
---

# Project Recommendation Context

Generated: 2026-06-06T21:14:19.580Z

This file is a CodeVetter Repo Unpacked-inspired audit written for Starboard recommendations. It is intentionally local, evidence-oriented, and safe to commit: it records product context, feature areas, stack inventory, and recommendation guidance without secrets or environment values.

## Project Identity

- Slug: `psi-swarm`
- Registry description: Website performance tracker that runs Lighthouse and Web Vitals checks across sites and reports performance distributions.
- Product grouping: `public-ready`
- Source path: `psi-swarm`

## Product Context

Website performance tracker that runs Lighthouse and Web Vitals checks across sites and reports performance distributions.

psi-swarm is a local-first website performance tracker. It measures Web Vitals across repeated Lighthouse runs and realistic device/network presets so users can reason about p50, p75, p90, and p99 instead of trusting one noisy PageSpeed/Lighthouse result.

psi-swarm Lighthouse, run many times across realistic device/network presets. See the p50 / p75 / p90 / p99 of your Web Vitals, not one noisy point. A single PageSpeed Insights run tells you almost nothing — two runs on the same URL can disagree by 30%+ on LCP because of network jitter, CPU contention, third-party scripts, and server-side variance. psi-swarm runs the same audit many times across a matrix of realistic conditions and reports the shape of the distribution, not just one point. Two ways to use it The CLI is the engine. The web app is a beautiful controller that drives the same engine through a tiny local HTTP server. Compute always happens on your machine — the browser is just th

## Feature Map

- **UI workflows**: Dashboards, tables, forms, component systems, charts, and user workflows. Keywords: ui, ux, dashboard, table, component, react, next, tailwind.
- **AI agents**: Agents, tool use, workflows, orchestration, RAG, evals, and model integration. Keywords: ai, agent, agents, llm, rag, embedding, eval, model.
- **Cloudflare and deploy**: Workers, Pages, edge runtime, queues, storage, and deploy automation. Keywords: cloudflare, worker, workers, pages, edge, deploy, wrangler, queue.
- **Database and storage**: SQL, document storage, migrations, cache, queues, vectors, and persistence. Keywords: database, db, sql, sqlite, postgres, turso, libsql, drizzle.
- **Analytics and intelligence**: Signal analysis, forecasting, monitoring, trends, metrics, and decision support. Keywords: analytics, intelligence, signal, forecast, monitoring, metric, trend, insight.
- **Browser and extensions**: Browser extensions, page capture, annotation, automation, and client-side integrations. Keywords: browser, extension, chrome, annotation, capture, webpage, reader.
- **Repo intelligence**: Repository understanding, metadata enrichment, code review, and evidence reports. Keywords: review, static, analysis, diff, history, evidence, verification.

## Runtime Surfaces and Entrypoints

- Not detected in this pass.

## Current Stack

- Languages: `Astro`, `TypeScript`
- Frameworks/tools: `Astro`, `React`, `Tailwind CSS`
- Config files:
- `web/astro.config.mjs`

## OSS Already In Use

Direct dependencies:
- `@astrojs/react`
- `@tailwindcss/vite`
- `astro`
- `better-sqlite3`
- `boxen`
- `chalk`
- `chrome-launcher`
- `cli-table3`
- `commander`
- `ink`
- `lighthouse`
- `ora`
- `react`
- `react-dom`
- `tailwindcss`

Development dependencies:
- `@types/better-sqlite3`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `tsx`
- `typescript`

Package scripts:
- `astro`
- `build`
- `build:cli`
- `build:web`
- `cli`
- `dev`
- `dev:cli`
- `install:skill`
- `prepublishOnly`
- `preview`
- `run`
- `serve`
- `setup`
- `start`
- `web`

## Testing and Quality Signals

- Not detected in this pass.

## Recommendation Guidance

Good matches:
- Repos that strengthen ui workflows without replacing already-installed libraries.
- Repos that strengthen ai agents without replacing already-installed libraries.
- Repos that strengthen cloudflare and deploy without replacing already-installed libraries.
- Repos that strengthen database and storage without replacing already-installed libraries.
- Repos that strengthen analytics and intelligence without replacing already-installed libraries.
- Repos that strengthen browser and extensions without replacing already-installed libraries.
- Repos that strengthen repo intelligence without replacing already-installed libraries.
- Tools with concrete support for psi-swarm, cli, lighthouse, astro, not, run, runs, across.
- Implementation repos, SDKs, CLIs, testing utilities, adapters, and focused libraries are higher value than generic awesome lists.

Avoid recommending:
- Do not recommend packages already listed under direct or development dependencies unless the task is migration research.
- Do not recommend broad framework replacements unless the project context explicitly calls for a rewrite.
- Downrank curated lists, archived repos, stale demos, and generic UI kits that do not map to the feature catalog.

## Evidence Read

Primary docs and handoff files:
- `PROJECT_STATUS.md`
- `README.md`

Package manifests:
- `cli/package.json`
- `package.json`
- `web/package.json`

Inventory notes:
- Files scanned: 47
- This pass uses deterministic repo inventory plus local documentation/source-path evidence. It does not claim a full manual line-by-line review of every source file.

## Confidence

Confidence: **needs review**

Why:
- PROJECT_STATUS.md present
- README.md present
- package dependencies inventoried

Refresh command:

```bash
cd /Users/sarthak/Desktop/fleet/starboard
pnpm fleet:audit-recommendation-context
pnpm fleet:extract-projects
```
