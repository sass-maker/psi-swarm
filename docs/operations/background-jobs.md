---
title: Background jobs
description: The idle-time refresh jobs the serve agent runs — domain-rating scheduler, CrUX, Ahrefs.
---

# Background jobs

The `serve` agent (`cli/src/server.ts`) runs a couple of background refresh
jobs **only while idle** (no active swarms). They enrich the local history
and the `/projects` dashboard without ever sending data off the machine.

## Domain Rating scheduler (`cli/src/domain-rating-scheduler.ts`)

Ahrefs Domain Rating for custom-domain projects, used in `/projects`, CLI,
and HTML reports. Ratings persist in the `domain_ratings` SQLite table.

| Behaviour | Detail |
| --- | --- |
| When | Hourly idle probe; refreshes **once a week** while idle. |
| Startup delay | 30 s after `serve` starts (`DOMAIN_RATING_STARTUP_DELAY_MS`). |
| Check interval | 1 h (`DOMAIN_RATING_CHECK_INTERVAL_MS`). |
| Eligibility | Custom domains only — `*.pages.dev` / `*.workers.dev` skipped (DR on shared CF subdomains is not meaningful). |
| Concurrency | 3 parallel fetches. |
| Negative caching | A NULL `rating` row caches "Ahrefs has no rating for this domain" so it isn't re-fetched every cycle. |
| TTL stamp | `meta.ahrefs_last_refresh_at` is stamped only when at least one lookup resolved — a fully-failed pass doesn't suppress retries for a whole TTL. |
| Failure handling | `onError` callback; a failed pass doesn't block the next hourly probe. |

Source: `cli/src/domain-rating-scheduler.ts`, `cli/src/ahrefs.ts`,
`cli/src/domain.ts`. Uses Ahrefs' [free public DR endpoint](https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-free)
(no API key).

## CrUX enrichment (`cli/src/crux.ts`)

Real-user p75 from the Chrome UX Report API, rendered as a lab-vs-field
table.

- **Trigger:** after a swarm, unless `--no-crux`. Auto-skipped if
  `CRUX_API_KEY` is not set.
- **Lookup strategy:** `preferUrl: true` — tries URL-specific data first,
  falls back to origin-aggregate when the URL has insufficient traffic.
- **Metrics:** LCP, CLS, INP, FCP, TTFB (28-day real-user p75).
- **INP note:** INP appears in the CrUX table (real users can trigger it)
  even though it's hidden from the lab table.

## Ahrefs DR fetch (`cli/src/ahrefs.ts`)

The fetch layer behind the scheduler. Hardened with:

- Fetch timeouts (no hanging on a slow Ahrefs response).
- Negative caching via the nullable `rating` column (see
  [data model](../architecture/data-model.md#domain_ratings)).
- UI states for "no rating" vs "fetch failed" vs "not yet fetched".

## Why these are idle-only

Running Ahrefs/CrUX fetches during an active swarm would compete with
Lighthouse for network and add noise to the very measurements the user is
collecting. The scheduler's `isIdle()` check (wired in `server.ts`) ensures
enrichment only happens when no swarm is in flight.
