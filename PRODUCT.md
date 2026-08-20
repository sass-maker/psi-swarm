# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers and operators who need repeatable Lighthouse evidence across realistic device and network presets instead of relying on one noisy lab run.

## Product Purpose

psi-swarm runs Lighthouse repeatedly, summarizes percentile distributions, stores local history, and makes before/after performance comparisons inspectable from a CLI or local browser controller.

## Positioning

The product treats web performance as a distribution: p50, p75, p90, and p99 across repeated runs, with compute and history staying on the user’s machine.

## Capabilities and Constraints

- Lighthouse compute runs locally; the deployed site is a static controller and demo.
- Node 22 LTS is the supported runtime.
- No hosted RUM, cloud execution, account, or telemetry.
- Production deploys are manual.

## Evidence on Hand

Verified product history lives in `PROJECT_STATUS.md`; implementation lives in `cli/` and `web/`; shipped product specifications live under `docs/prds/`.

## Product Principles

- Measure distributions, not anecdotes.
- Keep compute and history local.
- Make regression evidence inspectable.
- Keep planned work in GitHub Issues.
