# psi-swarm-web

Web UI for [psi-swarm](..). Drives the local agent (`psi-swarm serve`) from your browser — compute stays on your machine, the browser just renders.

## Local dev

```bash
# 1. In one terminal, start the agent from the psi-swarm CLI:
cd ..
node dist/cli.js serve --origin http://localhost:4321

# 2. In another terminal, start this dev server:
npm install
npm run dev
# → open http://localhost:4321
```

The UI auto-detects the agent at `127.0.0.1:7777`. If it's not running, you'll see install instructions.

## Architecture

```
Browser  ───CORS GET/POST───▶  http://127.0.0.1:7777  (psi-swarm agent)
   ▲                                   │
   │           SSE                     │  spawns headless Chrome
   └─── /api/runs/:id/events ◀─────────┘  → Lighthouse → metrics
```

- Frontend: Astro + React + Tailwind 4 (this dir)
- Local agent: Node HTTP server inside the existing psi-swarm CLI (`../cli/src/server.ts`)
- Compute: headless Chrome via Lighthouse on the user's own machine
- No third-party services, no cloud, no telemetry — just localhost.

## Deploy

Eventually ships to Cloudflare Pages as a static site (`npm run build` produces `dist/`). Users install the CLI separately. The web app's only runtime dependency is the agent's HTTP API.

## License

MIT
