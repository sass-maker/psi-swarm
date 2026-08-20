---
title: Presets & profiles
description: Device/network presets, preset groups, traffic-mix profiles, and how to pick one.
---

# Presets & profiles

Source of truth: `cli/src/presets.ts`. This page explains how to choose; the
code is authoritative for exact throttle numbers.

## Presets

Each preset is one (form factor × network × CPU slowdown) combination. The
throttle values mirror Lighthouse's built-in profiles so results are
comparable to PageSpeed Insights.

| Preset | Form factor | Network | CPU | Use when |
| --- | --- | --- | --- | --- |
| `mobile-slow` | Mobile | Slow 3G (300 ms RTT) | 6× | Bottom-quartile user / emerging markets. |
| `mobile-mid` | Mobile | Slow 4G (150 ms RTT) | 4× | Matches Google PSI mobile. Default in `psi`. |
| `mobile-fast` | Mobile | Fast 4G (75 ms RTT) | 2× | iPhone-class on good cellular. |
| `desktop` | Desktop | Cable (40 ms RTT) | 1× | Matches Google PSI desktop. |

Screen emulation: mobile presets use 412×823 @ 1.75 DPR; desktop uses
1350×940 @ 1 DPR.

## Preset groups

Pass a group name to `--presets`:

| Group | Presets | Notes |
| --- | --- | --- |
| `psi` | `mobile-mid`, `desktop` | **Default.** Matches Google PageSpeed Insights. |
| `realistic` | all four | Full device/network spread. |
| `mobile` | `mobile-slow`, `mobile-mid`, `mobile-fast` | Mobile-only. |
| `desktop` | `desktop` | Desktop-only. |
| `fast` | `mobile-fast`, `desktop` | Quick directional check. |
| `coverage` | all four | 99% device coverage — pair with `--profile coverage`. |

You can also pass a comma list: `--presets mobile-mid,desktop`.

## Traffic profiles (`--profile`)

A profile produces a single **weighted CWV verdict** across presets, matching
your traffic mix. Weights don't need to sum to 1 — they're normalised at use
time. Match these to your real audience for the most honest fleet-level
number.

| Profile | Weighting | Use when |
| --- | --- | --- |
| `mobile-heavy` | slow 0.15 / mid 0.55 / fast 0.20 / desktop 0.10 | Mobile-first consumer product. |
| `desktop-heavy` | mid 0.15 / fast 0.15 / desktop 0.70 | B2B / internal tool. |
| `balanced` | mid 0.5 / desktop 0.5 | Even split. |
| `mobile-only` | slow 0.25 / mid 0.5 / fast 0.25 | No desktop traffic. |
| `coverage` | slow 0.10 / mid 0.35 / fast 0.15 / desktop 0.40 | Globally-representative mix. Sources: StatCounter (60/40 mobile/desktop), Web Almanac CrUX breakdowns. |

## How to choose

- **"Is my site fast enough?" (product verdict)** →
  `--presets coverage --profile coverage --runs 5`. One weighted number
  representing ~globally-distributed real users.
- **PSI-style check** → default `--presets psi` (mobile-mid + desktop).
- **Quick smoke test (~45 s)** → `--presets desktop --runs 2`.
- **Stable percentiles** → `--runs 10–30`. p99 from fewer than ~15 runs is
  mostly noise (see [learnings](../knowledge/learnings/new-things.md)).

## What a run costs

`--runs N --presets <group>` = N × (presets in group) real Lighthouse audits.
Default `psi` × 5 = 10 audits (~2–3 min serial). Each audit is a real
headless-Chrome navigation with emulated throttling — the site is live, the
throttling is what makes a fast laptop pretend to be a mid-range Android.

## Parallelism trade-off

Runs are **serial by default**. Lighthouse's CPU throttling assumes a
dedicated core, so parallel Chrome instances pollute CPU-bound metrics
(TBT, INP, Performance Score). Use `--parallel auto` only when speed matters
more than perfect TBT integrity; auto-detect caps at 4 and leaves 2 cores
headroom (`cli/src/machine.ts`).
