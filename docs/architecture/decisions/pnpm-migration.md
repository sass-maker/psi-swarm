---
title: ADR — pnpm workspaces
description: Why the monorepo moved from npm workspaces to pnpm.
---

# ADR: pnpm workspaces

**Status:** Active · **Date:** 2026-06-20 (PR #8)

## Context

The repo was originally an **npm workspaces** monorepo: root `package.json`
declared `workspaces: ["cli", "web"]` and there was no `pnpm-workspace.yaml`.
The CLI README and the web README still documented `npm install` / `npm run
build`.

The fleet standardised on **pnpm** across its projects, and the Cloudflare
Pages CI deploy needed deterministic, fast installs with a pinned package
manager inside the monorepo.

## Decision

Migrate to **pnpm workspaces**:

- Add `pnpm-workspace.yaml` listing `cli` and `web`.
- Pin `packageManager: pnpm@10.33.2` in the root `package.json`.
- Root scripts use `pnpm --filter <pkg>` to target workspaces.
- CI (`.github/workflows/deploy.yml`) uses `pnpm/action-setup@v6` +
  `setup-node` with `cache: 'pnpm'`, and installs with
  `--frozen-lockfile --ignore-scripts` for the web workspace.
- `onlyBuiltDependencies` in `pnpm-workspace.yaml` allow-lists the native
  builds (`better-sqlite3`, `esbuild`, `sharp`).

## Consequences

- Contributors use `pnpm run setup` / `pnpm run cli -- ...` instead of npm.
  See [development → workflow](../../development/workflow.md).
- The npm-publishable `cli` package still works under npm for end users
  installing it as a dependency — the `engines` field and `prepublishOnly`
  build are unchanged. pnpm is required only for **repo** development.
- The CLI and web READMEs were updated to lead with pnpm for repo clones.
- `_Unresolved:_` the `cli/README.md` "Quick start" historically showed
  `npm install` / `npm run build`. That is correct for consumers installing
  the published package, but stale for repo contributors — the repo workflow
  now leads with pnpm.
