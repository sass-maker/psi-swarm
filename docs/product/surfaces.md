---
title: Surfaces
description: Every CLI command, web route, agent HTTP endpoint, and the installable skill.
---

# Surfaces

The CLI is the engine. The web UI and the agent skill are thin controllers over
the same engine. This page is the inventory; for behaviour details follow the
links.

## CLI

Binary: `cli/dist/cli.js` (built from `cli/src/cli.ts`). Run via
`pnpm run cli -- <command>` or directly `node cli/dist/cli.js <command>`.

| Command | Purpose |
| --- | --- |
| `run <url>` | Run a swarm of Lighthouse audits against a URL. Core command. |
| `presets` | List available presets and preset groups. |
| `history <url>` | Show recent history for a URL (formatted as a report). |
| `urls` | List all URLs seen in local history. |
| `compare <url> --baseline <tag> --candidate <tag>` | Compare two tagged swarms (default p75). |
| `watch list \| add \| remove \| check` | Local regression watchlist over tagged history. |
| `discover <url>` | List same-origin links from a page (static-only discovery). |
| `serve` | Start the local HTTP agent the web UI drives. |
| `web` | Start the agent **and** open the browser UI in one step. |
| `connect` | SaaS Maker device-flow auth (stores fleet Cockpit token). |
| `whoami` | Show the stored fleet auth identity. |

### `run` options (the important ones)

| Flag | Default | Purpose |
| --- | --- | --- |
| `-r, --runs <n>` | `5` | Runs per preset. Use 10–30 for stable percentiles. |
| `-p, --presets <spec>` | `psi` | Preset group or comma list. See [presets](./presets-profiles.md). |
| `-t, --tag <tag>` | — | Tag this swarm for later `compare`. |
| `--parallel <1\|N\|auto>` | `1` | Preset-level parallelism. `auto` adds CPU-throttling noise. |
| `--profile <name>` | — | Weighted "fleet verdict" line matching your traffic mix. |
| `--reason` | off | Stream an LLM explanation after the percentile tables. |
| `--reason-backend local-ai\|openai\|auto` | `auto` | Pick the reasoning backend. See [reasoning backends](../development/reasoning-backends.md). |
| `--output html --output-path <path>` | terminal | Write a self-contained shareable HTML report. |
| `--no-crux` | — | Skip CrUX field-data lookup (auto-skipped if `CRUX_API_KEY` unset). |
| `--no-ahrefs` | — | Skip Ahrefs Domain Rating (custom domains only). |
| `--no-insight` | — | Skip trace-insight export and derived diagnosis. |
| `--insight-baseline <tag>` | — | Compare insight against a tagged baseline swarm. |
| `--no-save` | — | Skip saving to local history db. |
| `--no-suggest` | — | Skip post-run link suggestions. |

Full flag list: `pnpm run cli -- run --help`. Source of truth for flags is
`cli/src/cli.ts`.

## Web UI (browser)

Astro + React + Tailwind 4 static site in `web/`. Talks to the local `serve`
agent over CORS + SSE. Pages in `web/src/pages/`:

| Route | Component | Notes |
| --- | --- | --- |
| `/` | `RunDashboard.tsx` | Quick two-run desktop check, full five-run PSI swarm, or custom run; live progress via SSE. |
| `/projects/` | `ProjectsView.tsx` | Fleet dashboard backed by local SQLite history, grouped by URL origin. |
| `/compare/` | `CompareView.tsx` | Before/after comparison of tagged swarms. |
| `/watchlist/` | `WatchlistView.tsx` | Regression watchlist queue (requires `serve`). |
| `/gallery/` | `GalleryView.tsx` | Static before/after fixtures — **works without the local agent**. |

Agent connection is quiet and opt-in (`web/src/lib/agent.ts` →
`connectToAgent`). A bare deployed page load fires **zero** `127.0.0.1`
probes; probing only happens on explicit `?agent=` / `?token=` intent or a
remembered past connection. See
[ADR: local-first](../architecture/decisions/local-first-no-cloud-execution.md)
for why this matters.

When no agent is available, the home route presents a numbered setup flow for
Node 22, Git, Chrome, the compatible public v0.4.0 agent source, and the final
connection action. Its start command derives the CORS `--origin` value from the
current controller URL rather than assuming localhost.

The home dashboard uses progressive evidence levels. **Quick check** gets a
new user to a directional desktop result with two serial audits. **Full swarm**
runs five audits for both PSI presets and remains the confidence path. Existing
run count, preset, parallelism, and tag controls remain available under
**Custom swarm**. A completed quick check links directly to the full swarm for
the same URL.

## Agent HTTP API

Served by `cli/src/server.ts` on `127.0.0.1:7777` (fallback `7778`,
`localhost:7777`). All routes are localhost-only.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health + machine profile (cores, mem, recommended parallelism). |
| GET | `/api/presets` | Available presets and preset groups. |
| POST | `/api/run` | Start a swarm. Body: `{ url, runs, presets, parallel, tag? }`. |
| GET | `/api/runs/:id` | Run status (`pending` / `running` / `complete` / `error`). |
| GET | `/api/runs/:id/events` | SSE stream of `RunnerEvent`s. |
| GET | `/api/runs/:id/suggestions` | Discovered same-origin links for the run. |
| GET | `/api/runs/:id/diagnosis` | LCP element + phase breakdown + ranked opportunities. |
| GET | `/api/runs/:id/reason` | SSE stream of LLM reasoning chunks. |
| GET | `/api/aggregate?runId=` | Per-preset percentile stats. |
| GET | `/api/urls` | All URLs in history. |
| GET | `/api/projects` | Projects grouped by origin (with Domain Rating). |
| GET | `/api/projects/history` | Per-project history. |
| GET | `/api/history?url=` | Recent history for a URL. |
| GET | `/api/tags?url=` | Tags seen for a URL. |
| GET | `/api/compare?url=&baseline=&candidate=&pct=` | Tagged comparison. |
| GET | `/api/report?url=&which=` | Path to the latest HTML report for a URL. |
| GET | `/api/reports` | Report registry (URL → file paths). |
| GET | `/api/insights?url=` | Stored trace insights. |
| GET \| POST \| DELETE | `/api/watchlist` | Watchlist CRUD. |
| POST | `/api/watchlist/refresh` | Force a watchlist queue refresh. |
| POST | `/api/discover` | Link discovery for a URL. |

Source of truth: `cli/src/server.ts`. The TypeScript client shape lives in
`web/src/lib/agent.ts`.

## Installable skill

`SKILL.md` is the canonical skill definition (symlinked into
`~/.claude/skills/psi-swarm/` by `scripts/install-skill.mjs`). It tells
Claude Code when to invoke psi-swarm for perf-related questions and which
flags to use. Codex users: copy the "For Codex users" section from
`SKILL.md` into `~/.codex/AGENTS.md` (Codex has no skill system).

> **Do not edit `SKILL.md` from this docs work.** It is a tooling definition
> owned by the fleet-ops skill layer, not part of the docs knowledge system.

## Public agent-indexing surfaces

The deployed site exposes machine-readable entrypoints directly from
`web/public/`, the Astro build's canonical static asset directory:

| File | Purpose |
| --- | --- |
| `/llms.txt` | LLM index of product surfaces. |
| `/llms-full.txt` | Full-text LLM index. |
| `/index.md` | Product brief without JS. |
| `/api/ai.json` | JSON inventory of public surfaces. |
| `/robots.txt` | Allows agents on the indexing paths. |
