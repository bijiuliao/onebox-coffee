import type { Config } from '@netlify/functions';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';

const LOFFEELABS_BASE = 'https://loffeelabs.com/api/v2/beans';
// Kept modest and fixed server-side (not client-controlled) - loffeelabs
// meters exports against a daily quota (see `meta.remainingQuota` in its
// response), so every page turn in the admin UI should cost as little of
// that budget as reasonably possible.
const PAGE_LIMIT = 20;
const FETCH_TIMEOUT_MS = 10000;

interface LoffeelabsRawBean {
  id: string | number;
  date: string | null;
  roaster: string | null;
  'roast-name': string | null;
  link: string | null;
  origin: string | null;
  region: string | null;
  producer: string | null;
  'min-elev': number | null;
  'max-elev': number | null;
  variety: string | null;
  process: string | null;
  tasting: string | null;
  harvest: string | null;
  degree: string | null;
  'price-low': number | null;
  'gram-low': number | null;
  'price-high': number | null;
  'gram-high': number | null;
  'roaster-country': string | null;
}

// loffeelabs' own field names are kebab-case, awkward to use from the
// client - reshaped to camelCase here, matching how this codebase already
// converts the DB's snake_case into camelCase for the client (see
// netlify/functions/lib/coffees.ts's toCoffee).
function toLoffeelabsBean(raw: LoffeelabsRawBean) {
  return {
    id: String(raw.id),
    date: raw.date,
    roaster: raw.roaster,
    roastName: raw['roast-name'],
    link: raw.link,
    origin: raw.origin,
    region: raw.region,
    producer: raw.producer,
    minElev: raw['min-elev'],
    maxElev: raw['max-elev'],
    variety: raw.variety,
    process: raw.process,
    tasting: raw.tasting,
    harvest: raw.harvest,
    degree: raw.degree,
    priceLow: raw['price-low'],
    gramLow: raw['gram-low'],
    priceHigh: raw['price-high'],
    gramHigh: raw['gram-high'],
    roasterCountry: raw['roaster-country'],
  };
}

export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const apiKey = process.env.LOFFEELABS_API_KEY;
  if (!apiKey) return json({ error: 'LOFFEELABS_API_KEY is not configured on this site' }, 500);

  const url = new URL(req.url);
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));

  const upstreamUrl = `${LOFFEELABS_BASE}?api_key=${encodeURIComponent(apiKey)}&page=${page}&limit=${PAGE_LIMIT}`;

  let upstreamRes: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    upstreamRes = await fetch(upstreamUrl, { signal: controller.signal }).finally(() => clearTimeout(timer));
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    console.error('loffeelabs-beans: fetch failed', err);
    return json({ error: timedOut ? 'loffeelabs 回應逾時，請稍後再試' : '無法連線到 loffeelabs' }, 502);
  }

  if (!upstreamRes.ok) {
    console.error('loffeelabs-beans: upstream error', upstreamRes.status, await upstreamRes.text().catch(() => ''));
    return json({ error: `loffeelabs 回應錯誤（${upstreamRes.status}），請稍後再試` }, 502);
  }

  let data: { meta?: Record<string, unknown>; beans?: LoffeelabsRawBean[] };
  try {
    data = await upstreamRes.json();
  } catch {
    return json({ error: 'loffeelabs 回應格式異常' }, 502);
  }

  return json({
    beans: (data.beans ?? []).map(toLoffeelabsBean),
    meta: data.meta ?? null,
  });
};

export const config: Config = {
  path: '/api/admin/loffeelabs-beans',
};
