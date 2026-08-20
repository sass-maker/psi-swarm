import type { DiscoveredLink } from './discover.js';
import type { ScriptArtifact } from './runner.js';

const ROUTE_RE = /<Route\s+(?:[^>]*?\s+)?path\s*=\s*["']([^"'*?:]+)["']/gi;
// React Router data-router shape: { path: "/foo", ... }
const PATH_OBJ_RE = /[{,]\s*path\s*:\s*["']([^"'*?:]+)["']/gi;
// Generic string literals that look like route paths.
const ROUTE_STRING_RE = /["'](\/[a-z0-9_\-/]{1,80})["']/gi;
const NEXTDATA_RE = /__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*<\/script>/i;

const SKIP_PATHS = new Set([
  '/',
  '/api',
  '/static',
  '/_next',
  '/favicon.ico',
  '/sitemap.xml',
  '/robots.txt',
  '/manifest.json',
]);
const SKIP_PREFIXES = ['/_next/', '/static/', '/api/', '/assets/', '/fonts/', '/images/'];
const SKIP_EXT_RE = /\.(js|css|map|json|png|jpe?g|gif|svg|webp|woff2?|ttf)(\?|$)/i;

function isPlausibleRoute(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.length > 80) return false;
  if (SKIP_PATHS.has(path)) return false;
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return false;
  if (SKIP_EXT_RE.test(path)) return false;
  // Skip paths with double-slashes, query strings already in source, or obvious non-routes.
  if (path.includes('//') || path.includes('\\')) return false;
  return true;
}

function toLink(pathname: string, base: string): DiscoveredLink | null {
  try {
    const abs = new URL(pathname, base);
    return { url: abs.toString(), path: abs.pathname + abs.search, text: '' };
  } catch {
    return null;
  }
}

function dedupe(links: DiscoveredLink[]): DiscoveredLink[] {
  const seen = new Map<string, DiscoveredLink>();
  for (const l of links) if (!seen.has(l.url)) seen.set(l.url, l);
  return Array.from(seen.values());
}

export interface RouteDiscovery {
  framework: 'next' | 'react-router' | 'generic' | 'unknown';
  routes: DiscoveredLink[];
}

function tryNextJs(pageUrl: string, scripts: ScriptArtifact[]): DiscoveredLink[] | null {
  // Look for the Next.js buildManifest among the captured scripts.
  const buildManifest = scripts.find(
    (s) => s.url.includes('/_next/static/') && s.url.endsWith('_buildManifest.js')
  );
  if (!buildManifest) return null;
  const routes: DiscoveredLink[] = [];
  // _buildManifest assigns pages: { "/about": [...], "/foo/[bar]": [...] }
  const pageMatches = buildManifest.content.matchAll(/["'](\/[^"'?#)\\:*]+)["']\s*:/g);
  for (const m of pageMatches) {
    const path = m[1];
    if (!isPlausibleRoute(path)) continue;
    if (path.includes('[')) continue; // parameterized route
    const l = toLink(path, pageUrl);
    if (l) routes.push(l);
  }
  return dedupe(routes);
}

function tryReactRouter(pageUrl: string, scripts: ScriptArtifact[]): DiscoveredLink[] | null {
  const routes: DiscoveredLink[] = [];
  for (const s of scripts) {
    for (const m of s.content.matchAll(ROUTE_RE)) {
      const path = m[1];
      if (!isPlausibleRoute(path)) continue;
      if (path.includes(':') || path.includes('*')) continue;
      const l = toLink(path, pageUrl);
      if (l) routes.push(l);
    }
    for (const m of s.content.matchAll(PATH_OBJ_RE)) {
      const path = m[1];
      if (!isPlausibleRoute(path)) continue;
      if (path.includes(':') || path.includes('*')) continue;
      const l = toLink(path, pageUrl);
      if (l) routes.push(l);
    }
  }
  return routes.length > 0 ? dedupe(routes) : null;
}

function tryGenericStringHarvest(pageUrl: string, scripts: ScriptArtifact[]): DiscoveredLink[] {
  // Last resort: scan for string literals that look like paths.
  // High false-positive rate, so we cap aggressively and only return if other methods failed.
  const candidates = new Map<string, number>(); // path -> occurrence count
  for (const s of scripts) {
    for (const m of s.content.matchAll(ROUTE_STRING_RE)) {
      const path = m[1];
      if (!isPlausibleRoute(path)) continue;
      candidates.set(path, (candidates.get(path) ?? 0) + 1);
    }
  }
  // Keep only paths that appear at least 2 times (filters noise like one-off log messages).
  const filtered = Array.from(candidates.entries())
    .filter(([_, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([p]) => p);
  const links: DiscoveredLink[] = [];
  for (const path of filtered) {
    const l = toLink(path, pageUrl);
    if (l) links.push(l);
  }
  return dedupe(links);
}

export async function detectFrameworkRoutes(
  pageUrl: string,
  scripts: ScriptArtifact[] | undefined,
  pageHtml?: string
): Promise<RouteDiscovery> {
  if (!scripts || scripts.length === 0) {
    return { framework: 'unknown', routes: [] };
  }

  // Try Next.js first — most distinctive signal.
  if (
    scripts.some((s) => s.url.includes('/_next/static/')) ||
    (pageHtml && NEXTDATA_RE.test(pageHtml))
  ) {
    const nextRoutes = tryNextJs(pageUrl, scripts);
    if (nextRoutes && nextRoutes.length > 0) {
      return { framework: 'next', routes: nextRoutes };
    }
  }

  // React Router patterns.
  const rrRoutes = tryReactRouter(pageUrl, scripts);
  if (rrRoutes && rrRoutes.length > 0) {
    return { framework: 'react-router', routes: rrRoutes };
  }

  // Generic string harvest — high false-positive, only when nothing else worked.
  const generic = tryGenericStringHarvest(pageUrl, scripts);
  if (generic.length > 0) {
    return { framework: 'generic', routes: generic };
  }
  return { framework: 'unknown', routes: [] };
}
