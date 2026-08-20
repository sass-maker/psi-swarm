---
title: Development workflow
description: Setup, build, dev commands, Node version, and how to preview/validate docs.
---

# Development workflow

## Prerequisites

- **Node 22.19+** (required). Lighthouse 13 requires Node >=22.19 and supports Node 24 — see
  [ADR](../architecture/decisions/node-22-lighthouse-12-pin.md). The
  `engines` field gates to `>=22.19`.
- **pnpm 10.33.2** (pinned via `packageManager`). The repo is a pnpm
  workspace (`cli`, `web`). See [ADR](../architecture/decisions/pnpm-migration.md).
- **Chrome** installed locally — `chrome-launcher` finds it. On CI/Docker
  the runner passes `--no-sandbox --disable-dev-shm-usage`.

## One-time setup

```bash
pnpm run setup          # pnpm install + builds the CLI
```

If `pnpm install` fails on `better-sqlite3`, your Node version doesn't match
the one the native binding was built against — re-run `pnpm install` after
switching to Node 22.

## Day-to-day commands

Root scripts (from `package.json`):

| Command | What it does |
| --- | --- |
| `pnpm run cli -- <cmd>` | Run the built CLI: `pnpm run cli -- run https://example.com` |
| `pnpm run cli -- run <url> --runs 5 --parallel auto` | A swarm. |
| `pnpm run serve` | Start the local HTTP agent (for the web UI). |
| `pnpm run web` | Start the Astro dev server (`localhost:4321`). |
| `pnpm run dev:cli` | Run the CLI from source via `tsx` (no rebuild needed). |
| `pnpm run build:cli` | `tsc` build the CLI into `cli/dist`. |
| `pnpm run build:web` | Astro build the web app into `web/dist`. |
| `pnpm quality` | Run formatting, lint, builds, coverage, unused-code, complexity, duplication, cycle, dependency-risk, suppression, and docs checks. |
| `pnpm run install:skill` | Install the Claude/Codex skill into `~/.claude/skills/`. |
| `pnpm run deploy` | Guarded manual web redeploy — see [operations](../operations/deploy.md). Use `pnpm run deploy`, not `pnpm deploy` (which invokes pnpm's built-in workspace deploy command). |

### Typical dev loop

```bash
# Terminal 1 — the agent
pnpm run serve

# Terminal 2 — the web UI
pnpm run web
# → open http://localhost:4321
```

Or develop the CLI without rebuilding:

```bash
pnpm run dev:cli -- run https://example.com --runs 3
```

## Docs workflow

The `docs/` tree is the source of truth and is rendered by
[Blume](https://useblume.dev) for the web. Blume is a devDependency at the
repo root.

| Command | What it does |
| --- | --- |
| `pnpm docs:dev` | Blume dev server with hot reload. |
| `pnpm docs:build` | Build static docs site into `docs-dist/`. |
| `pnpm docs:check` | Validate frontmatter + internal links across `docs/`. |

Rules:

- **Markdown is the source of truth.** Blume is only the presentation and
  search layer. Never edit generated files in `docs-dist/`.
- One home per fact — link to `PROJECT_STATUS.md` instead of restating
  history.
- Run `pnpm docs:check` before merging docs changes. CI runs the same check
  (`.github/workflows/docs.yml`).

## Checks

There are **no generic root `test` or `lint` scripts**. Package-owned tests
remain in their packages, while `pnpm quality` provides the root orchestration
used by CI. See [testing](./testing.md). The relevant checks for a docs change
are:

- `pnpm docs:check` — markdown validation + internal link integrity.
- `pnpm run build:cli` / `pnpm run build:web` — type-check by side effect
  when touching code.
- `pnpm quality` — the complete merge gate for code-health changes.

## Repo layout

```
psi-swarm/
├── cli/          ← Node CLI + headless Chrome runner + HTTP agent
├── web/          ← Astro + React + Tailwind dashboard
│   └── public/   ← deployed agent-indexing surfaces and static assets
├── scripts/      ← deploy, skill install, cache-rules
├── docs/         ← this knowledge system (source of truth)
├── blume.config.ts  ← Blume presentation config
└── SKILL.md      ← installable agent skill (do not edit from docs work)
```
