# Project Status

Last updated: 2026-08-26 (v0.4.2)

## Why / What

psi-swarm is a local-first website performance tracker. It measures Web Vitals
across repeated Lighthouse runs and realistic device/network presets so users
can reason about p50, p75, p90, and p99 instead of trusting one noisy
PageSpeed/Lighthouse result.

In scope: lab measurement via headless Chrome + Lighthouse, local history and
comparisons, a local browser controller, and optional AI reasoning over
results. Out of scope (see section 6): hosted RUM, cloud execution, paid
monitoring/alerting.

## Dependencies

External:
- **Lighthouse 13** (`lighthouse`) — the measurement engine. Requires
  Node >=22.19 and supports Node 24. Upgraded from Lighthouse 12 to
  eliminate the `extract-zip@2.0.1` transitive dependency
  (GHSA-jmr9-qjv8-65gv) — Lighthouse 13 uses `puppeteer-core@25` →
  `@puppeteer/browsers@3` → `modern-tar` instead of `extract-zip`.
- **Headless Chrome** via `chrome-launcher` — runs the Lighthouse audits.
- **better-sqlite3** — local run history, watchlist, insights, and DR cache
  (SQLite on disk).
- **Optional reasoning backends** (`--reason-backend openai | local-ai | auto`):
  any OpenAI-compatible Chat Completions endpoint (OpenAI, OpenRouter, Groq,
  own gateway) or the local-ai CLI wrapper at `http://localhost:3456`.
- **Ahrefs free public DR endpoint** — Domain Rating for custom-domain
  projects (skipped for `*.pages.dev` / `*.workers.dev`).
- **Cloudflare Pages** — hosts the static web app (`psi-swarm-web`), deployed
  via `cloudflare/wrangler-action@v3` on GitHub Actions (wrangler pinned as a
  `web` devDependency).
- CLI UX: `commander`, `ink` + React 19, `chalk`, `boxen`, `cli-table3`, `ora`.
- Web app: Astro 5 + React 19 + Tailwind v4 (`@tailwindcss/vite`), static build.
- Tooling: pnpm workspaces (`pnpm@10.33.2`), TypeScript 5.7, tsx, and the
  Fleet Ultracite/Biome lint contract.

Internal (fleet):
- **SaaS Maker auth hub** — CLI device-flow helper (`connect` / `whoami`)
  stores fleet Cockpit tokens.
- **local-ai** — optional dev-time reasoning bridge (out-of-fleet service).
- Claude/Codex usage paths documented via the installable skill
  (`scripts/install-skill.mjs`) and AGENTS guidance notes.

## Timeline

- **2026-08-26 — v0.4.2 public CLI distribution:** Published an
  npm-compatible package on GitHub Releases, verified clean global installs on
  Node 22 and 24 (including SQLite history), and replaced the controller's
  source-clone/build setup with one exact versioned install command. Runtime
  compute, history, and reasoning remain local.
- **2026-08-20 — Standalone ownership restored:** Synchronized PSI Swarm out of
  Fleet Workspace into `sass-maker/psi-swarm`, restored its repository-owned
  CLI, controller, docs, checks, and installable skill, and left production
  deployment manual. Fleet retains only portfolio and orchestration references.
- **2026-08-13** — Replaced the disconnected controller's broken npm command
  with a verified four-step local-agent setup: supported prerequisites, the
  compatible public v0.4.0 source, copyable commands, and a CORS origin derived
  from the current controller page.
- **2026-08-13** — Added a first-class Quick check to the local browser
  controller: two serial desktop audits produce honestly labeled directional
  medians, while Full swarm remains the five-run mobile-and-desktop confidence
  path and Custom swarm preserves expert controls.
- **2026-08-09** — Adopted the Fleet Ultracite/Biome lint contract with zero
  findings across 59 applicable files. The migration also fixed report-link
  generation in project page rows by passing the existing agent client through
  the component boundary.
- **2026-07-31** — Completed the public social-search metadata contract with a
  real 1200×630 product preview plus Open Graph and Twitter image metadata on
  every public route. The production homepage audit now has a source-side fix
  for its only remaining critical on-page SEO failure; rollout remains manual.
- **2026-07-31** — Validated the optional external trace-insight boundary
  against controlled Chrome DevTools MCP traces for a clean control,
  `DocumentLatency`, and LCP render-delay regression. Added a deterministic
  CLI-owned test covering adapter discovery, diagnosis, artifact linkage, and
  SQLite persistence without adding a runtime dependency.
- **2026-07-31** — Made every public controller route independently
  discoverable: the Fleet registry now writes agent surfaces into the deployed
  Astro `web/public` directory, the six canonical routes share complete search
  and structured metadata, and each route has substantive Markdown in the
  sitemap and `/api/ai` catalog. Removed the obsolete duplicate `site/public`
  tree and moved its public verification file into the deployed directory.
- **2026-07-29** — Added the owned `/changelog` surface with verified editorial
  milestones, plus internal links from every public web route. Roadmap and
  Source resolve to the Fleet issues view and canonical monorepo directory.
- **2026-07-03** — Finished the local web controller: `psi-swarm web` command starts the agent + opens the browser UI in one step. Compare API (`/api/compare`, `/api/tags`) for tagged swarm diffs. Agent connection refactored to quiet opt-in probing (`connectToAgent`). WatchlistView fixed to use the new connection API. Non-CLI users can now run, compare, and inspect swarms entirely in the browser.
- **2026-06-03/04** — core build-out: `/projects` fleet dashboard backed by
  local SQLite history, Astro/React HTML reports (self-contained files),
  multi-page projects grouped by URL origin, `coverage` preset/profile for
  global device representation, inline "analysis →" report links; first
  PROJECT_STATUS.
- **2026-06-05** — logged fleet perf-push follow-ups; fleet-wide CF Cache
  Rules deployer; removed one-off Pages-cleanup workflow.
- **2026-06-09** — evaluated OSS performance-tool integrations
  (`docs/architecture/decisions/oss-integration-evaluation.md`).
- **2026-06-10** — Ahrefs Domain Rating in reports, projects dashboard, and
  weekly idle refresh; hardened with negative caching, fetch timeouts, and
  UI states.
- **2026-06-12/13** — shipped v0.4.0: three PRDs (watchlist, demo gallery,
  trace insight) plus correctness fixes (report-URL decoding, waiting for
  project runs, dashboard run-subscription cleanup).
- **2026-06-19** — continue-on-error for batch page runs with per-page
  failure reporting; committed `docs/knowledge/learnings/` notes.
- **2026-06-20** — SaaS Maker auth hub (device-flow `connect`/`whoami`, PR #6);
  migrated npm workspaces to pnpm (PR #8).
- **2026-06-22** — made psi-swarm standalone OSS, decoupled from saas-maker
  (PR #9).
- **2026-06-26** — agent auto-probe gated to localhost/explicit intent
  (PR #10); manual redeploy promoted the fix to prod; CI deploy added
  (PRs #11–#14).
- **2026-06-28** — repo transferred to `sarthak-fleet` org (unblocking CF org
  secrets); README npm→pnpm fixes + AGENTS.md (PR #17).
- **2026-07-02** — guarded manual deploy command (`pnpm run deploy` →
  `scripts/manual-component-deploy.mjs`). Use `pnpm run deploy`, not
  `pnpm deploy`, which invokes pnpm's built-in workspace deploy command.

## Products

- **CLI (`cli/`)** — `psi-swarm` Node CLI (public GitHub Release package, v0.4.2)
  with `run`, `discover`, `serve`, `history`, `compare`, `watch`, `connect`,
  and `whoami` workflows. Compute stays local.
- **Local web controller (`web/`)** — Astro + React + Tailwind browser UI for
  the CLI `serve` agent, talking to it over CORS/SSE.
- **Deployed web app** — static Astro build on the Cloudflare Pages project
  `psi-swarm-web` (<https://performance.sassmaker.com>). The platform hostname
  remains `psi-swarm-web.pages.dev`. Build:
  `pnpm --filter psi-swarm-web run build` → `web/dist`. Includes a static
  `/gallery` demo that works without the local agent.
- **Public changelog** — `/changelog` records verified releases on the product
  domain; planned work remains in PSI Swarm's GitHub Issues.
- **CI/CD** — `.github/workflows/deploy.yml` builds the web workspace with
  pnpm and deploys `web/dist` via `cloudflare/wrangler-action@v3`. Trigger is
  **manual dispatch only** (not push) — `main` stays releasable but is not an
  automatic production trigger. The action runs from `workingDirectory: web`
  with the locally pinned wrangler (the action's own install fails inside this
  pnpm monorepo). Repo-local guarded deploy: `pnpm run deploy`
  (`pnpm deploy` invokes pnpm's built-in workspace deploy command).
  `.github/workflows/psi-swarm-ci.yml` runs the CLI regression suite, CLI/web
  builds, and docs checks for helper changes; `.github/workflows/docs.yml`
  separately validates docs paths. `.github/workflows/release-cli.yml` packages
  version tags, smoke-tests clean installs on Node 22 and 24, and publishes the
  tested tarball as a GitHub Release.
- **Installable skill** — `pnpm install:skill` installs the Claude/Codex skill
  documenting usage paths.

Deploy history note (2026-06-26): PR #10 had merged but the live site still
served the pre-fix build — psi-swarm had no deploy automation at the time. The
main build was rebuilt and deployed manually; the live bundle now carries the
`shouldAutoProbeAgent` localhost gate, so a bare deployed page load no longer
fires failed `127.0.0.1:7777/7778` requests. CI deploy was added the same day.

## Features (shipped)

Measurement engine:
- Headless Chrome + Lighthouse runs produce percentile tables (p50/p75/p90/p99),
  LCP element identification, ranked opportunities, and static HTML reports.
- Realistic device/network presets, including the `coverage` preset/profile.
- Batch page runs continue on error with per-page failure reporting.
- OSS integration decision: keep Lighthouse as the engine; prefer an optional
  Chrome DevTools trace-insight adapter before adopting a heavier
  sitespeed/WebPageTest-style stack (`docs/architecture/decisions/oss-integration-evaluation.md`).

History & analysis (SQLite):
- Local run history with tagged runs and before/after comparisons.
- **Trace insight adapter (PRD shipped):** saved swarms export Lighthouse
  bundles to `~/.psi-swarm/artifacts/`, derive a builtin diagnosis into
  `run_insights`, render it in CLI/HTML reports, and expose `/api/insights`.
  External adapter hook: `~/.psi-swarm/adapters/trace-insight.mjs` or
  `PSI_TRACE_INSIGHT_ADAPTER`; the hook is regression-tested against
  Chrome DevTools MCP trace oracles.
- **Local regression watchlist (PRD shipped):** `watchlist` table, `psi-swarm
  watch` subcommands, `/api/watchlist` endpoints, `/watchlist` web UI.
- Ahrefs Domain Rating for custom-domain projects in `/projects`, CLI, and
  HTML reports; CF platform hostnames skipped (DR not meaningful on shared CF
  subdomains); ratings persist in SQLite; `serve` refreshes weekly when idle
  (no active swarms), probed hourly.

Web controller & sharing:
- Astro + React + Tailwind local browser UI for the `serve` agent (CORS/SSE).
- Disconnected controller state guides users through the verified public
  local-agent install and generates the correct allowed origin for the current
  page.
- Quick, Full, and Custom run paths: Quick produces a directional two-run
  desktop result, then offers direct confirmation with the full PSI swarm.
- **Shareable demo gallery (PRD shipped):** static fixtures + `/gallery` route
  — works without the local agent.
- Agent auto-probe only fires on localhost or explicit `?agent=`/`?token=`
  intent (no failed `127.0.0.1` requests on the deployed site).

Fleet & tooling:
- Versioned public CLI package with a clean-prefix release gate and an exact
  controller-compatible install path; no registry account or source build is
  required.
- Fleet Ultracite/Biome lint contract covers the CLI, web app, tests, and
  scripts with zero findings across 59 applicable files.
- SaaS Maker auth hub: CLI device-flow `connect` / `whoami` for fleet Cockpit
  token storage.
- Optional AI reasoning via local-ai or any OpenAI-compatible backend.
- pnpm workspaces as canonical package manager (root scripts/docs updated).
- Installable skill + AGENTS guidance for Claude/Codex usage.
- Standalone OSS: decoupled from saas-maker, MIT-licensed.

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/sass-maker/psi-swarm/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.
