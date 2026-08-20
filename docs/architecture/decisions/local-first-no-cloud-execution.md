---
title: ADR — Local-first, no cloud execution
description: Why compute stays on the user's machine and the browser is only a controller.
---

# ADR: Local-first, no cloud execution

**Status:** Active · **Date:** 2026-06 (recorded from product positioning)

## Context

psi-swarm is positioned as "free, open source (MIT), fully local. No account,
no signup, no telemetry — nothing leaves your machine." The product thesis is
distributional lab measurement; the trust thesis is that the user owns the
data and the compute.

The web UI exists because a browser is a nicer controller than a terminal for
some workflows (dashboards, compare views, watchlist queues). But there is no
server to run swarms on behalf of users — and we don't want one, because it
would imply accounts, billing, a queue, and a trust boundary.

## Decision

Compute **always** happens on the user's machine. The deployed web app
(`psi-swarm-web` on Cloudflare Pages) is a **static** Astro build with no
server runtime. The browser UI drives a local HTTP agent (`psi-swarm serve`
on `127.0.0.1:7777`) over CORS + SSE. The agent spawns headless Chrome +
Lighthouse locally.

Concretely:

- The Cloudflare Pages deploy is `output: static` — no Workers, no SSR, no
  functions. See [operations → deploy](../../operations/deploy.md).
- The browser's agent connection is **quiet and opt-in** (`connectToAgent`
  in `web/src/lib/agent.ts`). A bare deployed page load fires zero
  `127.0.0.1` probes; probing only happens on explicit `?agent=` / `?token=`
  intent or a remembered past connection. This was a real shipped fix
  (PR #10): before it, the live site served failed `127.0.0.1:7777/7778`
  requests on every load.

## Consequences

- No hosted runner, no multi-region execution, no scheduled alerts. These are
  tracked as deferred work in the
  [PSI Swarm GitHub issue queue](https://github.com/sass-maker/psi-swarm/issues).
- The deployed site is cheap and simple to operate: a static build behind
  Cloudflare's CDN, no secrets needed at runtime (deploy secrets are only
  the CF API token in GitHub Actions).
- Users must run the CLI locally to use the interactive web UI. The
  `/gallery` route is the only interactive-looking page that works without
  the agent (static fixtures).
- Any future "cloud runner tier" is a separate product, not an extension of
  this one.
