# Performance watchlist

The watchlist is a local regression queue over psi-swarm's SQLite history. It compares recent measurements with a chosen baseline tag or earlier swarm.

## What it tracks

- URLs selected by the operator
- The latest available repeated-run evidence
- Changes from a tagged baseline or prior swarm
- Regressions that need another measurement or investigation

The watchlist is local-first. The deployed page contains the controller, while watchlist entries and results remain on the operator's machine.
