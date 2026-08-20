---
title: Deploy
description: How the web app deploys to Cloudflare Pages — CI, the guarded manual redeploy, and the missing-ci gap.
---

# Deploy

The deployed surface is the **static** Astro web build on Cloudflare Pages
(project `psi-swarm-web`, hostname `performance.sassmaker.com`, platform
hostname `psi-swarm-web.pages.dev`). The CLI is not deployed — it runs on
the user's machine. See [ADR: local-first](../architecture/decisions/local-first-no-cloud-execution.md).

## What gets deployed

```bash
pnpm --filter psi-swarm-web run build    # → web/dist
wrangler pages deploy web/dist --project-name=psi-swarm-web
```

The deploy is `output: static` — no Workers, no SSR, no functions, no
runtime secrets.

## CI deploy (`.github/workflows/deploy.yml`)

- **Trigger:** `workflow_dispatch` only (manual). Not on push.
- **Concurrency:** cancels in-progress runs of the same workflow + ref.
- **Steps:** checkout → pnpm setup → Node 22 →
  `pnpm install --filter psi-swarm-web... --frozen-lockfile --ignore-scripts`
  (skips the CLI's native builds — the static site doesn't need
  `better-sqlite3`/`sharp`) → `astro build` →
  `cloudflare/wrangler-action@v3` deploying from `workingDirectory: web`
  using the locally-pinned wrangler devDep.
- **Smoke:** curls `/` and `/projects/` against
  `https://psi-swarm-web.pages.dev` with retries after deploy.
- **Secrets:** `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (now
  available in the `sarthak-fleet` org — this is why the repo was
  transferred there in 2026-06-28).

### Why the action runs from `web/`

The action's own wrangler install fails inside this pnpm monorepo
(`ERR_PNPM_ADDING_TO_ROOT` / npm arborist null). Running from
`workingDirectory: web` lets the action find the locally-pinned wrangler in
`web/node_modules` and skips the on-the-fly install. Same pattern as
anime-list's deploy.

## Guarded manual redeploy (`pnpm run deploy`)

> Use `pnpm run deploy`, not `pnpm deploy`. With current pnpm, `pnpm deploy`
> invokes pnpm's built-in workspace deploy command and exits with
> `ERR_PNPM_NOTHING_TO_DEPLOY` instead of running the package script.

`scripts/manual-component-deploy.mjs` is a guardrail around dispatching the deploy
workflow. The root script runs it as
`manual-deploy.mjs deploy.yml deploy.yml` — i.e. it passes `deploy.yml` as
**both** the workflow to dispatch and the green-gate workflow. It refuses to
run unless:

1. Current branch is `main`.
2. Working tree is clean.
3. `main` is synced with `origin` (not ahead/behind).
4. `gh` is authenticated.
5. **`deploy.yml` has run on the current `main` HEAD and is green.**

It then dispatches `deploy.yml` via `gh workflow run`.

### Path-scoped CI and deploy gate

`.github/workflows/psi-swarm-ci.yml` runs the CLI regression suite, CLI/web
builds, and docs checks for helper pull requests and pushes to `main`.
`docs.yml` separately covers docs-specific paths.

_Unresolved:_ the guarded deploy command still uses `deploy.yml` as its
green-gate instead of the independent PSI Swarm CI workflow. See
[testing](../development/testing.md).

## Deploy history note (2026-06-26)

PR #10 had merged but the live site still served the pre-fix build —
psi-swarm had **no deploy automation** at the time. The main build was
rebuilt and deployed manually; the live bundle then carried the
`shouldAutoProbeAgent` localhost gate so a bare deployed page load no longer
fired failed `127.0.0.1:7777/7778` requests. CI deploy was added the same
day to prevent recurrence.

## Runbook: manual redeploy

See [runbooks/redeploy-web.md](./runbooks/redeploy-web.md).
