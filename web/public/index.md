# psi-swarm

psi-swarm is a local-first performance tracker that runs Lighthouse repeatedly across realistic device and network presets. It reports p50, p75, p90, and p99 Web Vitals instead of treating one noisy run as truth.

## What the controller does

- Starts swarms against a URL through the local psi-swarm agent
- Shows distributional Lighthouse and Core Web Vitals evidence
- Keeps run history and compute on the operator's machine
- Supports comparisons, watchlists, and project-level history

The deployed site is a static controller and demo. It does not run remote audits, collect telemetry, or require an account.
