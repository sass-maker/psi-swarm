# Compare performance swarms

The compare view places two tagged psi-swarm runs side by side. It is intended for checking whether a code or deployment change improved or regressed performance.

## Comparison evidence

- p50, p75, p90, and p99 values rather than a single Lighthouse score
- Core Web Vitals and Lighthouse category changes
- Tagged baseline and candidate runs from local history
- Differences grounded in the stored run observations

A comparison requires the local psi-swarm agent and its SQLite history. The public page is the controller; no private history is uploaded.
