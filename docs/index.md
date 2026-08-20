---
title: psi-swarm docs
description: Local-first distributional Lighthouse performance tracker — product, architecture, development, and operations knowledge.
---

# psi-swarm docs

psi-swarm is a local-first website performance tracker. It runs Lighthouse many
times across realistic device/network presets and reports the **p50 / p75 / p90 /
p99** of your Web Vitals instead of one noisy point. Compute stays on your
machine; the browser UI is only a controller.

> **Source of truth.** The Markdown in this `docs/` tree is the canonical
> knowledge system. [Blume](https://useblume.dev) renders it for the web, but
> Blume is only the presentation and search layer — the committed Markdown
> stands on its own. See [Development → Workflow](./development/workflow.md)
> for how to preview and validate docs.

## Where to start

| You want to | Read |
| --- | --- |
| Understand what psi-swarm is and who it's for | [Product → Overview](./product/overview.md) |
| See every CLI command, web route, and agent API endpoint | [Product → Surfaces](./product/surfaces.md) |
| Know which preset / profile to use | [Product → Presets & profiles](./product/presets-profiles.md) |
| Understand how the pieces fit together | [Architecture → Overview](./architecture/overview.md) |
| Read the SQLite schema and what each table is for | [Architecture → Data model](./architecture/data-model.md) |
| See why we chose this stack | [Architecture → Decisions](./architecture/decisions/) |
| Set up the repo and build | [Development → Workflow](./development/workflow.md) |
| Configure the LLM "why is it slow" narrative | [Development → Reasoning backends](./development/reasoning-backends.md) |
| Know the test/quality situation | [Development → Testing](./development/testing.md) |
| Deploy the web app or run a redeploy | [Operations → Deploy](./operations/deploy.md) |
| Understand the background refresh jobs | [Operations → Background jobs](./operations/background-jobs.md) |
| Learn from past attempts and non-obvious gotchas | [Knowledge](./knowledge/) |

## Living snapshot vs. durable ledger

- [`STATUS.md`](../STATUS.md) — short, current snapshot: today's objective,
  active work, blockers, unresolved questions, next steps.
- [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) — the fleet-mandated durable
  ledger: why/what, dependencies, full timeline, shipped features, and the
  long-form todo / deferred / blocked list. This is the canonical history; do
  not duplicate it here.

## Structure

```
docs/
├── index.md                  ← this page
├── product/                  ← what it is, surfaces, presets
├── architecture/             ← system design, data model, decisions (ADRs)
│   └── decisions/
├── development/              ← workflow, reasoning backends, testing
├── operations/               ← deploy, background jobs, runbooks
│   └── runbooks/
├── knowledge/                ← learnings and failed approaches
│   ├── learnings/
│   └── failed-approaches/
├── current/                  ← active/proposed feature specs
├── prds/                     ← shipped v0.4.0 PRDs (kept in place)
└── PROJECT_RECOMMENDATION_CONTEXT.md  ← auto-generated audit context (reference)
```

## Maintenance rules

1. Markdown here is the source of truth. Code and executable config remain
   authoritative for implementation details and schedules — don't duplicate
   what's discoverable from code.
2. One home per fact. If a fact lives in `PROJECT_STATUS.md`, link to it
   instead of restating it.
3. Mark unresolved questions explicitly (`_Unresolved:_`).
4. Don't create empty folders or placeholder pages.
5. Before merging docs changes, run `pnpm docs:check` (validates frontmatter
   and internal links). CI runs the same check on every PR touching `docs/`.
