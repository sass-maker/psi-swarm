export interface DiscoveredLink {
  url: string;
  path: string;
  text: string;
}

const HREF_RE = /<a\b[^>]*?\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const TAG_STRIP_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;
const SKIP_EXT_RE =
  /\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|tar|gz|mp4|mov|avi|woff2?|ttf|css|js|xml|json)(\?|$)/i;

function cleanText(raw: string): string {
  return raw.replace(TAG_STRIP_RE, '').replace(WHITESPACE_RE, ' ').trim().slice(0, 80);
}

export interface DiscoveryResult {
  links: DiscoveredLink[];
  source: 'html' | 'sitemap' | 'rendered' | 'framework' | 'merged' | 'none';
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) psi-swarm/0.1 link-discovery',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function rank(links: DiscoveredLink[]): DiscoveredLink[] {
  links.sort((a, b) => {
    const da = a.path.split('/').filter(Boolean).length;
    const db = b.path.split('/').filter(Boolean).length;
    if (da !== db) return da - db;
    return a.path.localeCompare(b.path);
  });
  return links;
}

function extractFromHtml(html: string, pageUrl: string): DiscoveredLink[] {
  const origin = new URL(pageUrl).origin;
  const seen = new Map<string, DiscoveredLink>();
  for (const match of html.matchAll(HREF_RE)) {
    const rawHref = match[1].trim();
    const rawText = cleanText(match[2] ?? '');
    if (!rawHref) continue;
    if (
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('tel:') ||
      rawHref.startsWith('javascript:')
    )
      continue;
    let abs: URL;
    try {
      abs = new URL(rawHref, pageUrl);
    } catch {
      continue;
    }
    if (abs.origin !== origin) continue;
    if (SKIP_EXT_RE.test(abs.pathname)) continue;
    abs.hash = '';
    const key = abs.toString();
    if (key === pageUrl) continue;
    if (!seen.has(key)) {
      seen.set(key, { url: key, path: abs.pathname + abs.search, text: rawText });
    } else if (rawText && !seen.get(key)!.text) {
      seen.get(key)!.text = rawText;
    }
  }
  return Array.from(seen.values());
}

function extractFromSitemap(xml: string, pageUrl: string): DiscoveredLink[] {
  const origin = new URL(pageUrl).origin;
  const links = new Map<string, DiscoveredLink>();
  const locs = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  for (const m of locs) {
    let abs: URL;
    try {
      abs = new URL(m[1]);
    } catch {
      continue;
    }
    if (abs.origin !== origin) continue;
    if (SKIP_EXT_RE.test(abs.pathname)) continue;
    abs.hash = '';
    const key = abs.toString();
    if (key === pageUrl) continue;
    if (!links.has(key)) {
      links.set(key, { url: key, path: abs.pathname + abs.search, text: '' });
    }
  }
  return Array.from(links.values());
}

export async function discover(
  pageUrl: string,
  opts: { timeoutMs?: number; maxLinks?: number } = {}
): Promise<DiscoveryResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxLinks = opts.maxLinks ?? 25;

  const html = await fetchText(pageUrl, timeoutMs);
  const htmlLinks = extractFromHtml(html, pageUrl);
  if (htmlLinks.length > 0) {
    return { links: rank(htmlLinks).slice(0, maxLinks), source: 'html' };
  }

  // Empty HTML shell — try sitemap.xml as a fallback (common on SaaS sites).
  const sitemapUrl = new URL('/sitemap.xml', pageUrl).toString();
  try {
    const xml = await fetchText(sitemapUrl, timeoutMs);
    const sitemapLinks = extractFromSitemap(xml, pageUrl);
    if (sitemapLinks.length > 0) {
      return { links: rank(sitemapLinks).slice(0, maxLinks), source: 'sitemap' };
    }
  } catch {
    // Sitemap not found / not parseable. Fall through.
  }
  return { links: [], source: 'none' };
}
