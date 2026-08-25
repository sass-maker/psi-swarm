---
name: psi-swarm
description: Subskill of site-health — distributional Lighthouse audits with grounded LLM reasoning on any URL. Use when the user asks about web performance, Core Web Vitals (LCP/CLS/INP/TBT/FCP/TTFB), PageSpeed Insights, Lighthouse scores, "is my site fast?", "why is X slow?", comparing perf before/after a change, or analysing render-blocking resources / hero image weight / unused JS. Returns p50/p75/p90/p99 across realistic device/network presets plus a natural-language explanation grounded in actual audit findings (LCP element, phase breakdown, ranked opportunities with byte/ms savings).
---

# psi-swarm — distributional Lighthouse with reasoning

Subskill of `site-health` — invoked directly or via the parent router.

You have access to **psi-swarm** — a CLI tool that runs Lighthouse many times against a URL across realistic device/network presets, then explains the results. This standalone repository is its canonical home.

## When to invoke

Use this skill when the user asks any of:
- "Check the perf of <url>"
- "What's wrong with <url>'s Lighthouse score?"
- "Why is <url> slow on mobile?"
- "Is <url> Core Web Vitals compliant?"
- "How does <url> compare to <other-url>?"
- "Compare perf before/after this deploy"
- Anything mentioning LCP, CLS, INP, TBT, FCP, TTFB, render-blocking, hero image, page weight, unused JS

Don't use this for: general web-dev advice without a URL, RUM/field-data-only questions where you'd want CrUX directly, or questions about Lighthouse internals (those don't need a swarm).

## Setup — check it's available

Prefer the public `psi-swarm` command. Verify it first:

```bash
psi-swarm --version
```

If it is unavailable, install the exact supported release:

```bash
npm install --global --allow-remote=root --allow-scripts=better-sqlite3 https://github.com/sass-maker/psi-swarm/releases/download/v0.4.2/psi-swarm-0.4.2.tgz
```

For repository development, psi-swarm lives at `~/Desktop/fleet/psi-swarm/` and
retains the `pnpm run setup` workflow. Node 22.19 through 24 and Chrome are
required; the current Fleet installation is verified on Node 24.

## How to invoke

### Default — run the simulations AND produce an HTML report

**Always use `--output html` so the user gets a shareable artifact**, not just terminal text.

For **product-level "is my site fast enough" questions** — use the `coverage` preset group + `coverage` profile. This runs every device class (slow 3G low-end Android, slow 4G mid Android, fast 4G iPhone, desktop cable) and gives a single weighted verdict representing ~globally-distributed real users:

```bash
psi-swarm run <URL> --runs 5 --presets coverage --profile coverage --reason --output html
```

For **focused PSI-style checks** (PageSpeed Insights matches mobile-mid + desktop only):

```bash
psi-swarm run <URL> --runs 5 --presets psi --reason --output html
```

After the run completes, tell the user:
1. The headline lab numbers from the terminal output (p75 LCP per preset, verdict, biggest opportunity)
2. The HTML file path with an `open <path>` command so they can view the full report in a browser

The HTML is self-contained (~10-17 KB, inline CSS, no external assets). They can share it via email, Slack, GitHub gist, etc.

### Quick smoke test (~45 s)

For a fast directional check:

```bash
psi-swarm run <URL> --runs 2 --presets desktop --reason --output html
```

### Comparing two URLs or two states

```bash
psi-swarm run <URL> --runs 5 --tag before-deploy
# ... user ships the change ...
psi-swarm run <URL> --runs 5 --tag after-deploy
psi-swarm compare <URL> --baseline before-deploy --candidate after-deploy
```

### What's a "simulation"?

Each "run" = **one real Lighthouse audit**: headless Chrome navigates to the live URL with artificial network throttling (latency + bandwidth ceiling) and CPU throttling (idle-cycle insertion). The site is live; the throttling is what makes a fast laptop pretend to be a mid-range Android on Slow 4G.

`--runs N --presets psi` means N × 2 audits (psi = mobile-mid + desktop). 5 runs × psi = 10 audits per URL.

## Reasoning backend — auto-detected

The `--reason` flag streams an LLM explanation. Backend is auto-detected:

| Priority | Backend | Trigger |
| -------- | ------- | ------- |
| 1 | `local-ai` (no API key) | Reachable at `localhost:3456` — wraps already-authenticated Claude/Codex/Gemini CLI. Start it from [github.com/sarthakagrawal927/local-ai](https://github.com/sarthakagrawal927/local-ai). |
| 2 | `openai` (OpenAI-compatible) | `OPENAI_API_KEY` env var set. Any provider via `OPENAI_BASE_URL` (OpenAI, OpenRouter, Groq, Together, vLLM/Ollama). |

If neither is set, the swarm still runs and shows the deterministic "Why?" section (LCP element + phases + opportunities) — just no streaming narrative. Tell the user how to enable it.

## Useful flags

| Flag | Purpose |
| ---- | ------- |
| `--presets psi|realistic|mobile|desktop|fast` | Preset group. Default `psi` matches PageSpeed Insights (mobile-mid + desktop). |
| `--runs <N>` | Runs per preset. Default 5. Use 10-30 for stable percentiles. |
| `--parallel auto` | Concurrent preset execution. Faster but adds CPU-throttling noise. |
| `--profile mobile-heavy|desktop-heavy|balanced|mobile-only` | Weighted "fleet verdict" line matching your traffic mix. |
| `--no-crux` | Skip CrUX field-data lookup. (Auto-skipped if `CRUX_API_KEY` not set.) |
| `--tag <name>` | Tag this swarm for later `compare`. |

## Interpreting the output

A complete run produces these sections in order:
1. **Header box** — URL, run counts, elapsed time
2. **Per-preset percentile table** — LCP/CLS/TBT/FCP/TTFB/SI as p50/p75/p90/p99/min/max/σ
3. **`CWV LCP gate (p75 ≤ 2.5s)`** — naive overall verdict
4. **`Weighted verdict (<profile>)`** — only if `--profile` is set; matches traffic mix
5. **`Real users (CrUX p75)`** — only if `CRUX_API_KEY` is set and site is in CrUX
6. **`Lab vs field gap`** — only if both lab and CrUX data exist; tells you whether the lab is over- or under-stating real-user experience
7. **`Why <preset>?`** — LCP element + LCP phase breakdown (TTFB / Load Delay / Load Time / Render Delay) + ranked opportunities table
8. **`Reasoning`** — LLM narrative (only with `--reason`)

**Quick-read heuristic for the user:**
- If `mobile-mid` LCP is "POOR" but `mobile-fast` and `desktop` are "GOOD" → the test was strict for the bottom-quartile user, not a real product issue.
- If `Lab vs field gap` shows "lab is 3× more pessimistic" → the lab is calibrated harshly, real users are fine.
- If `Render Delay > 40%` of LCP → it's a CSS / blocking-JS issue, NOT an image issue. Don't recommend image optimisation.
- If `Load Delay + Load Time > 60%` of LCP → it IS an image/asset loading issue. Recommend resize + preload.

## Output styling

The terminal output uses Ink-style boxes and ANSI colours. When showing it back to the user, you can:
- Quote the LLM narrative verbatim (it's already grounded in the audit data — don't re-summarise unless asked)
- Pull out the top 2-3 opportunities by impact for a quick action list
- Highlight the verdict colour: GOOD / NEEDS WORK / POOR

When the user runs with `--output html`, point them at the generated file with `open <path>` (macOS) or just the file path.

## For Codex users

Codex (OpenAI's CLI) reads `AGENTS.md` files instead of Claude's skill system. To get the same behaviour, add a short section to `~/.codex/AGENTS.md`:

```markdown
## psi-swarm (web perf tool)

When the user asks about web performance of a URL (Lighthouse / Core Web Vitals / LCP / "is X slow"), run:
  psi-swarm run <URL> --runs 5 --reason

Full docs: https://github.com/sass-maker/psi-swarm
```

The CLI is otherwise identical — no Codex-specific changes needed.
