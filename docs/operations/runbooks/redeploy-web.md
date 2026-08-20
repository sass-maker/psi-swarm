---
title: Runbook — manual web redeploy
description: How to redeploy psi-swarm-web to Cloudflare Pages when CI hasn't or can't.
---

# Runbook: manual web redeploy

Use this when the `deploy.yml` workflow can't be triggered through the
guarded path, or when you need to push the current `main` build to
production by hand.

## Preferred: the guardrail

```bash
pnpm run deploy
```

> Use `pnpm run deploy`, not `pnpm deploy`. With current pnpm, `pnpm deploy`
> invokes pnpm's built-in workspace deploy command and exits with
> `ERR_PNPM_NOTHING_TO_DEPLOY` instead of running the package script.

`scripts/manual-component-deploy.mjs` checks branch, clean tree, sync with
origin, `gh` auth, and a green `ci.yml` on the current HEAD, then dispatches
`deploy.yml`. See [deploy](../deploy.md) for the full gate list and the
**missing `ci.yml` gap** — if `pnpm run deploy` fails at the CI-green check,
that's why.

## Fallback: dispatch the workflow directly

If the guardrail is blocked by the missing-CI gap and you've manually
verified the build is good:

```bash
# 1. Confirm you're on a clean, synced main.
git status --porcelain          # must be empty
git fetch --quiet origin
git rev-list --left-right --count @{u}...HEAD   # 0 0

# 2. Build locally to confirm it compiles.
pnpm install --filter psi-swarm-web... --frozen-lockfile --ignore-scripts
pnpm --filter psi-swarm-web run build

# 3. Dispatch the deploy workflow.
gh workflow run deploy.yml --ref main

# 4. Watch the run.
gh run watch --workflow deploy.yml

# 5. Smoke production after it completes.
curl --fail --retry 5 --retry-delay 5 --max-time 20 https://psi-swarm-web.pages.dev/ >/dev/null
curl --fail --retry 5 --retry-delay 5 --max-time 20 https://psi-swarm-web.pages.dev/projects/ >/dev/null
```

## Fallback: deploy from local machine (last resort)

Only if GitHub Actions is unavailable. Requires `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` in the environment.

```bash
pnpm install --filter psi-swarm-web... --ignore-scripts
pnpm --filter psi-swarm-web run build
cd web
npx wrangler pages deploy dist --project-name=psi-swarm-web --branch=main --commit-dirty=true
```

Then smoke the two URLs above.

## Post-deploy verification

- `https://psi-swarm-web.pages.dev/` returns 200.
- `https://psi-swarm-web.pages.dev/projects/` returns 200.
- Load the site in a browser and confirm a bare page load (no `?agent=`)
  does **not** produce failed `127.0.0.1:7777/7778` network requests (the
  PR #10 fix — see [ADR: local-first](../../architecture/decisions/local-first-no-cloud-execution.md)).

## What not to do

- Don't deploy from a non-`main` branch.
- Don't deploy with a dirty working tree.
- Don't skip the smoke check — a green build is not a working site (see the
  2026-06-26 history note in [deploy](../deploy.md)).
