---
title: CLI release
description: Version, package, smoke, publish, verify, and roll back the supported public local-agent distribution.
---

# CLI release

The supported public PSI Swarm agent is an npm-compatible package tarball on a
GitHub Release. Users install it globally with npm, but no npm registry account
or token is required:

```bash
npm install --global --allow-scripts=better-sqlite3 https://github.com/sass-maker/psi-swarm/releases/download/v0.4.1/psi-swarm-0.4.1.tgz
```

The installed CLI keeps Lighthouse compute and SQLite history local. GitHub is
only an installation source; running PSI Swarm has no GitHub dependency.
The targeted script allowance is required by npm 12 to install the
`better-sqlite3` native binding; it does not enable scripts for other packages.

## Compatibility contract

- `cli/package.json` is the CLI and agent-health version authority.
- The root package version matches it as repository release metadata.
- The static controller imports the CLI package version at build time and pins
  the exact release artifact in its disconnected setup flow.
- `psi-swarm --version` and `/api/health.version` both read the package version
  through `cli/src/version.ts`.
- Existing source-built agents remain API-compatible within the v0.4 line, but
  the controller's displayed install path is the exact tested release.

## Release procedure

1. Update the root and CLI package versions together.
2. Run `pnpm run release:verify -- vX.Y.Z` and `pnpm run quality`.
3. Merge the release source to `main` and confirm current-main CI is green.
4. Create and push the matching annotated tag:

   ```bash
   git tag -a vX.Y.Z -m "psi-swarm vX.Y.Z"
   git push origin vX.Y.Z
   ```

5. `.github/workflows/release-cli.yml` installs dependencies, verifies the tag,
   builds and packs the CLI, installs it into fresh temporary prefixes on Node
   22 and 24, checks `--version`, `presets`, and an SQLite-backed `history`
   command, and creates the GitHub Release only after those checks pass.
6. Install the public asset URL into another fresh prefix and repeat the three
   smoke commands before deploying the controller.

## Rollback

Do not overwrite a version with different source. If a release is defective,
mark it as a prerelease, restore the controller link to the last verified
version, and ship a new patch version. Delete a release asset only when it is
provably corrupt and the same tagged source can reproduce the identical
replacement.

## npm registry status

The unscoped `psi-swarm` name was unused when this path shipped, but registry
publication is intentionally separate. Do not add a registry publish step until
an authenticated owner explicitly approves it and a trusted-publishing or 2FA
contract is documented.
