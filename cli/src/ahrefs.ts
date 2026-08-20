import { hostnameFromUrl, shouldFetchDomainRating } from './domain.js';
import type { HistoryDB } from './db.js';

const AHREFS_ENDPOINT = 'https://api.ahrefs.com/v3/public/domain-rating-free';
const AHREFS_TOP_DOMAINS_ENDPOINT = 'https://api.ahrefs.com/v3/public/domain-rating-top-domains';
const AHREFS_CRAWLER_IPS_ENDPOINT = 'https://api.ahrefs.com/v3/public/crawler-ips';
const AHREFS_CRAWLER_IP_RANGES_ENDPOINT = 'https://api.ahrefs.com/v3/public/crawler-ip-ranges';
export const DOMAIN_RATING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// AhrefsBot's crawling infrastructure changes rarely; refresh daily at most.
const CRAWLER_IPS_TTL_MS = 24 * 60 * 60 * 1000;

export interface DomainRatingResult {
  domain: string;
  rating: number;
  fetchedAt: number;
}

/** Stored record. rating === null is a negative-cache sentinel: Ahrefs has no rating. */
export interface StoredDomainRating {
  domain: string;
  rating: number | null;
  fetchedAt: number;
}

interface AhrefsApiResponse {
  domain_rating?: { domain_rating?: number };
  error?: string;
}

const memoryCache = new Map<string, StoredDomainRating>();

function cacheKey(domain: string): string {
  return domain.toLowerCase();
}

function readMemoryCache(domain: string): StoredDomainRating | null {
  const hit = memoryCache.get(cacheKey(domain));
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > DOMAIN_RATING_TTL_MS) {
    memoryCache.delete(cacheKey(domain));
    return null;
  }
  return hit;
}

function writeMemoryCache(record: StoredDomainRating): StoredDomainRating {
  memoryCache.set(cacheKey(record.domain), record);
  return record;
}

function readStored(db: HistoryDB | undefined, domain: string): StoredDomainRating | null {
  if (!db) return null;
  const stored = db.getDomainRating(domain);
  if (!stored) return null;
  if (Date.now() - stored.fetchedAt > DOMAIN_RATING_TTL_MS) return null;
  return writeMemoryCache(stored);
}

function persist(db: HistoryDB | undefined, record: StoredDomainRating): StoredDomainRating {
  writeMemoryCache(record);
  db?.upsertDomainRating(record);
  return record;
}

/**
 * Ahrefs requires an API key (free to generate, no paid plan needed) on the
 * `public` endpoints starting 2026-08-10; before that date it's optional.
 * https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-free
 */
function ahrefsAuthHeaders(): Record<string, string> {
  const key = process.env.AHREFS_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/**
 * Fetch Ahrefs Domain Rating (free public endpoint; needs `AHREFS_API_KEY`
 * from 2026-08-10, optional before that).
 * Returns null when the target is ineligible (CF platform host, localhost, etc.)
 * or when Ahrefs has no rating.
 */
export async function fetchDomainRating(
  target: string,
  opts: { force?: boolean; db?: HistoryDB } = {}
): Promise<DomainRatingResult | null> {
  if (!shouldFetchDomainRating(target)) return null;

  const domain = hostnameFromUrl(target);
  if (!domain) return null;

  if (!opts.force) {
    const cached = readMemoryCache(domain) ?? readStored(opts.db, domain);
    // A fresh sentinel (rating null) means "Ahrefs has no rating" — don't refetch.
    if (cached)
      return cached.rating === null
        ? null
        : { domain: cached.domain, rating: cached.rating, fetchedAt: cached.fetchedAt };
  }

  const res = await fetch(`${AHREFS_ENDPOINT}?target=${encodeURIComponent(domain)}&output=json`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; psi-swarm/0.2; +https://github.com/sarthakagrawal927/psi-swarm)',
      ...ahrefsAuthHeaders(),
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Ahrefs HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = (await res.json()) as AhrefsApiResponse;
  const fetchedAt = Date.now();
  const rating = data.error ? undefined : data.domain_rating?.domain_rating;
  if (typeof rating !== 'number' || !Number.isFinite(rating)) {
    // Negative-cache "no rating" so the scheduler doesn't refetch on every probe.
    persist(opts.db, { domain, rating: null, fetchedAt });
    return null;
  }

  persist(opts.db, { domain, rating, fetchedAt });
  return { domain, rating, fetchedAt };
}

export interface FetchDomainRatingsResult {
  ratings: Map<string, DomainRatingResult>;
  /** Domains where a lookup completed — a rating or a no-rating sentinel was recorded. */
  resolved: number;
}

/** Batch-fetch DR for multiple origins with modest concurrency. */
export async function fetchDomainRatings(
  targets: string[],
  opts: { concurrency?: number; force?: boolean; db?: HistoryDB } = {}
): Promise<FetchDomainRatingsResult> {
  const concurrency = opts.concurrency ?? 4;
  const eligible = [
    ...new Set(
      targets
        .map((t) => hostnameFromUrl(t))
        .filter((d): d is string => !!d && shouldFetchDomainRating(`https://${d}/`))
    ),
  ];

  const out = new Map<string, DomainRatingResult>();
  let resolved = 0;
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < eligible.length) {
      const domain = eligible[idx++];
      try {
        const result = await fetchDomainRating(`https://${domain}/`, {
          force: opts.force,
          db: opts.db,
        });
        // No throw = rating or no-rating sentinel recorded (domains are pre-filtered eligible).
        resolved += 1;
        if (result) out.set(domain, result);
      } catch {
        /* skip individual failures — dashboard still renders perf data */
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, eligible.length) }, () => worker()));
  return { ratings: out, resolved };
}

export interface TopDomainEntry {
  domain: string;
  domainRating: number;
  rank: number;
}

/**
 * Fetch a slice of Ahrefs' top-1M-domains-by-Domain-Rating leaderboard
 * (free, but requires `AHREFS_API_KEY` — no paid plan needed, just a key
 * generated from a free Ahrefs account). Up to 250k rows per request.
 * https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-top-domains
 */
export async function fetchAhrefsTopDomains(
  opts: { from?: number; to?: number } = {}
): Promise<TopDomainEntry[]> {
  const key = process.env.AHREFS_API_KEY;
  if (!key) throw new Error('AHREFS_API_KEY is required for domain-rating-top-domains');

  const from = opts.from ?? 1;
  const to = opts.to ?? 100;
  const res = await fetch(`${AHREFS_TOP_DOMAINS_ENDPOINT}?from=${from}&to=${to}&output=json`, {
    headers: { Authorization: `Bearer ${key}`, accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Ahrefs HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    domains?: Array<{ domain?: string; domain_rating?: number; rank?: number }>;
  };
  return (data.domains ?? [])
    .filter(
      (d): d is { domain: string; domain_rating: number; rank: number } =>
        typeof d.domain === 'string' &&
        typeof d.domain_rating === 'number' &&
        typeof d.rank === 'number'
    )
    .map((d) => ({ domain: d.domain, domainRating: d.domain_rating, rank: d.rank }));
}

/**
 * Read stored ratings for dashboard display (includes stale entries and
 * no-rating sentinels — callers must treat rating null as "no rating").
 */
export function domainRatingsForOrigins(
  origins: string[],
  db: HistoryDB
): Map<string, StoredDomainRating> {
  const stored = db.domainRatings();
  const out = new Map<string, StoredDomainRating>();
  for (const origin of origins) {
    const host = hostnameFromUrl(origin);
    if (!host) continue;
    const hit = stored.get(host.toLowerCase());
    if (hit) out.set(host, hit);
  }
  return out;
}

const CRAWLER_IPS_META_KEY = 'ahrefs_crawler_ips_v1';
const CRAWLER_RANGES_META_KEY = 'ahrefs_crawler_ip_ranges_v1';

interface CachedList {
  values: string[];
  fetchedAt: number;
}

function readCachedList(db: HistoryDB | undefined, key: string): CachedList | null {
  const raw = db?.getMeta(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedList;
    if (!Array.isArray(parsed.values) || typeof parsed.fetchedAt !== 'number') return null;
    if (Date.now() - parsed.fetchedAt > CRAWLER_IPS_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedList(db: HistoryDB | undefined, key: string, values: string[]): void {
  db?.setMeta(key, JSON.stringify({ values, fetchedAt: Date.now() } satisfies CachedList));
}

async function fetchAhrefsList(
  url: string,
  mapper: (data: unknown) => string[]
): Promise<string[]> {
  const res = await fetch(`${url}?output=json`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; psi-swarm/0.2; +https://github.com/sarthakagrawal927/psi-swarm)',
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Ahrefs HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return mapper(await res.json());
}

/**
 * Fetch Ahrefs' published AhrefsBot crawler IP addresses (free public
 * endpoint, no API key). Cached for `CRAWLER_IPS_TTL_MS` since the list
 * changes rarely. Use this to confirm a hit claiming to be AhrefsBot is
 * really Ahrefs' crawler before allowlisting it in a firewall or WAF rule.
 */
export async function fetchAhrefsCrawlerIps(
  opts: { force?: boolean; db?: HistoryDB } = {}
): Promise<string[]> {
  if (!opts.force) {
    const cached = readCachedList(opts.db, CRAWLER_IPS_META_KEY);
    if (cached) return cached.values;
  }
  const ips = await fetchAhrefsList(AHREFS_CRAWLER_IPS_ENDPOINT, (data) => {
    const body = data as { ips?: Array<{ ip_address?: string }> };
    return (body.ips ?? []).map((entry) => entry.ip_address).filter((ip): ip is string => !!ip);
  });
  writeCachedList(opts.db, CRAWLER_IPS_META_KEY, ips);
  return ips;
}

/** Same as {@link fetchAhrefsCrawlerIps} but for published CIDR ranges. */
export async function fetchAhrefsCrawlerIpRanges(
  opts: { force?: boolean; db?: HistoryDB } = {}
): Promise<string[]> {
  if (!opts.force) {
    const cached = readCachedList(opts.db, CRAWLER_RANGES_META_KEY);
    if (cached) return cached.values;
  }
  const ranges = await fetchAhrefsList(AHREFS_CRAWLER_IP_RANGES_ENDPOINT, (data) => {
    const body = data as { prefixes?: Array<{ ipv4Prefix?: string }> };
    return (body.prefixes ?? []).map((entry) => entry.ipv4Prefix).filter((p): p is string => !!p);
  });
  writeCachedList(opts.db, CRAWLER_RANGES_META_KEY, ranges);
  return ranges;
}

/** Parse an IPv4 dotted-decimal string into a 32-bit integer, or null if invalid. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    out = (out << 8) | n;
  }
  return out >>> 0;
}

function isIpv4InCidr(ip: string, cidr: string): boolean {
  const [base, prefixRaw] = cidr.split('/');
  const prefix = prefixRaw === undefined ? 32 : Number(prefixRaw);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (
    ipInt === null ||
    baseInt === null ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32
  ) {
    return false;
  }
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/**
 * True when `ip` matches one of Ahrefs' published crawler IPs or CIDR
 * ranges. IPv4 only — Ahrefs does not currently publish IPv6 ranges.
 */
export function isAhrefsCrawlerIp(ip: string, ips: string[], ranges: string[]): boolean {
  const normalized = ip.trim();
  if (ips.some((known) => known.trim() === normalized)) return true;
  return ranges.some((cidr) => isIpv4InCidr(normalized, cidr));
}
