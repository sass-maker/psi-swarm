---
title: Reasoning backends
description: How the --reason LLM narrative is configured and auto-detected.
---

# Reasoning backends

After a swarm, `--reason` streams an LLM-generated explanation grounded in
the actual audit data. The LLM gets a compacted summary (ranked opportunities
+ LCP element + LCP phase breakdown), so its output cites specific byte
counts and percentages — not generic advice.

Source of truth: `cli/src/reason.ts`. The system prompt there enforces
"respond in plain text, 4–7 sentences, cite the actual numbers, do not
invent, do not give generic advice."

## Auto-detection (`--reason-backend auto`, the default)

| Priority | Backend | Trigger |
| --- | --- | --- |
| 1 | `local-ai` (no API key) | Reachable at `localhost:3456`. Wraps an already-authenticated Claude / Codex / Gemini CLI. |
| 2 | `openai` (OpenAI-compatible) | `OPENAI_API_KEY` env var set. Any provider via `OPENAI_BASE_URL`. |

If neither is set, the swarm still runs and shows the deterministic "Why?"
section (LCP element + phases + opportunities) — just no streaming
narrative.

## local-ai backend

Run [local-ai](https://github.com/sarthakagrawal927/local-ai) on `:3456`. It
proxies to whichever LLM CLI you're already logged into (Claude, Codex,
Gemini). No API key needed anywhere.

The local-ai path POSTs `{ provider, model, systemPrompt, messages }` to
`/api/chat` and reads SSE `data:` lines, extracting either `parsed.text` or
`parsed.delta`. The openai path uses the standard `choices[0].delta.content`
field.

## openai-compatible backend

Any endpoint that implements `POST /chat/completions` with the standard
request/response shape and SSE streaming works: OpenAI, OpenRouter, Groq,
Together, DeepInfra, Anyscale, vLLM, Ollama (`/v1/chat/completions`), LM
Studio, or a custom gateway.

```bash
export OPENAI_API_KEY=<your key>
# Optional — default is https://api.openai.com/v1
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
# Optional — default is gpt-4o-mini
export OPENAI_MODEL=anthropic/claude-3.5-sonnet
# Optional — JSON merged into request body (project IDs, etc.)
export OPENAI_EXTRA_BODY='{"project_id":"psi-swarm"}'
```

## Choosing

- **Zero-config local path** → run local-ai on `:3456`, use `--reason`
  (auto picks local-ai).
- **Cloud / any provider** → set `OPENAI_API_KEY` (+ `OPENAI_BASE_URL` if
  not OpenAI), use `--reason`.
- **Explicit** → `--reason-backend local-ai` or `--reason-backend openai`
  to skip probing.

## Gotchas

- The local-ai probe (`probeLocalAi`) fires a `fetch` to `localhost:3456`;
  if it's not running, auto falls through to the openai backend silently.
- The narrative is **grounded but not verified** — it cites the audit data
  it was given, but it's still an LLM. Treat the deterministic "Why?"
  section as the source of truth and the narrative as a readable summary.
