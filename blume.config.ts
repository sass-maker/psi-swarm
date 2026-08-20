import { defineConfig } from 'blume';

// Blume presentation config for the psi-swarm docs knowledge system.
//
// IMPORTANT: Markdown under `docs/` is the source of truth. Blume is only the
// presentation + search layer. Generated output goes to `docs-dist/` (git-
// ignored) — never edit files there; edit the Markdown and re-run
// `pnpm docs:build`.
//
// The docs and source share this standalone repository.
export default defineConfig({
  title: 'psi-swarm docs',
  description:
    'Local-first distributional Lighthouse performance tracker — product, architecture, development, and operations knowledge.',

  content: {
    root: 'docs',
  },

  theme: {
    // Match the product UI, which accents on cyan.
    accent: 'cyan',
    radius: 'md',
    mode: 'system',
  },

  // Local search index — no external service, fits the local-first ethos.
  search: {
    provider: 'orama',
  },

  navigation: {
    tabs: [
      { label: 'Product', path: '/product', icon: 'rocket' },
      { label: 'Architecture', path: '/architecture', icon: 'layers' },
      { label: 'Development', path: '/development', icon: 'code' },
      { label: 'Operations', path: '/operations', icon: 'server' },
      { label: 'Knowledge', path: '/knowledge', icon: 'book-open' },
    ],
    // STATUS.md and PROJECT_STATUS.md live at the repo root (outside the
    // docs/ content root) so they aren't Blume pages; they're linked from
    // docs/index.md instead.
  },

  // The project already invests in agent indexing (llms.txt, /api/ai) on the
  // product site; have the docs site emit llms.txt too.
  ai: {
    llmsTxt: true,
  },

  markdown: {
    imageZoom: true,
    code: {
      icons: true,
      wrap: false,
    },
  },

  seo: {
    sitemap: true,
    robots: true,
    // `site` is unset: the docs site doesn't have a fixed public URL yet.
    // Set `deployment.site` (and re-enable `seo.og`) when the docs are
    // published. See STATUS.md → Unresolved questions.
  },

  deployment: {
    output: 'static',
    // site: "https://docs.psi-swarm.example" // set when published
  },
});
