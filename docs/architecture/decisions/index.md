---
title: Architecture decisions
description: ADRs — why the stack and boundaries are the way they are.
---

# Architecture decisions

Architecture Decision Records (ADRs). Each records **why** a choice was made,
not just what — so the same question doesn't get re-litigated. Code is
authoritative for the current state; these explain the constraints behind it.

| Decision | Status | Summary |
| --- | --- | --- |
| [Node 22 LTS + Lighthouse 12 pin](./node-22-lighthouse-12-pin.md) | Active | Hard-pin `node >=20 <24` because Lighthouse 12 breaks on Node 24. |
| [Local-first, no cloud execution](./local-first-no-cloud-execution.md) | Active | Compute stays on the user's machine; the browser is only a controller. |
| [pnpm workspaces](./pnpm-migration.md) | Active | Migrated from npm workspaces to pnpm (PR #8). |
| [OSS integration evaluation](./oss-integration-evaluation.md) | Active | Keep Lighthouse as the engine; prefer a Chrome DevTools trace-insight adapter over sitespeed/WebPageTest. |

## Format

Each ADR is a standalone Markdown file. Keep it short: context, decision,
consequences. Mark superseded decisions `Status: Superseded` and point at the
replacing ADR rather than deleting.
