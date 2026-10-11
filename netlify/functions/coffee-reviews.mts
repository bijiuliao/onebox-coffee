import type { Config, Context } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, type CoffeeRow } from './lib/coffees';
import { summarize, type ReviewRow } from './lib/reviews';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = '5 minutes';
// One rating per coffee per IP per day - keeps someone from refreshing to
// bump a single bean's average, without permanently locking out a shared
// IP (shop wifi, a family's home connection, ...).
const DEDUPE_WINDOW = '24 hours';

export default async (req: Request, context: Context) => {
  const db = getDb();
  const id = decodeURIComponent(new URL(req.url).pathname.split('/')[3] ?? '');
  if (!id) return json({ error: 'missing id' }, 400);

  if (req.method === 'GET') {
    const rows = (await db.sql`SELECT * FROM coffee_reviews WHERE coffee_id = ${id}`) as ReviewRow[];
    return json(summarize(rows));
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const [coffeeRow] = (await db.sql`SELECT * FROM coffees WHERE id = ${id}`) as CoffeeRow[];
  if (!coffeeRow) return json({ error: 'not found' }, 404);
  const coffee = toCoffee(coffeeRow);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const rating = Math.round(Number(body.rating));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: 'rating must be an integer from 1 to 5' }, 400);
  }
  // Only the coffee's own listed tasting notes are valid picks - anything
  // else submitted is silently dropped rather than rejecting the whole thing.
  const requestedTags = Array.isArray(body.flavorTags) ? (body.flavorTags as unknown[]) : [];
  const flavorTags = requestedTags.filter((t): t is string => typeof t === 'string' && coffee.notes.includes(t));

  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';

  const [{ count: recentCount }] = (await db.sql`
    SELECT COUNT(*)::int as count FROM coffee_reviews
    WHERE client_ip = ${ip} AND created_at > now() - ${RATE_LIMIT_WINDOW}::interval
  `) as { count: number }[];
  if (recentCount >= RATE_LIMIT_MAX) {
    return json({ error: '短時間內送出太多評分，請稍後再試' }, 429);
  }

  const [dup] = (await db.sql`
    SELECT id FROM coffee_reviews
    WHERE client_ip = ${ip} AND coffee_id = ${id} AND created_at > now() - ${DEDUPE_WINDOW}::interval
    LIMIT 1
  `) as { id: number }[];
  if (dup) {
    return json({ error: '你已經評過這支豆子了，明天再來吧' }, 429);
  }

  // flavor_tags is jsonb - goes through db.pool.query (not the db.sql tagged
  // template) so the JSON string binds with an explicit text->jsonb cast,
  // same as every other jsonb write in this codebase (see coffees-item.mts).
  await db.pool.query(
    `INSERT INTO coffee_reviews (coffee_id, rating, flavor_tags, client_ip) VALUES ($1, $2, $3, $4)`,
    [id, rating, JSON.stringify(flavorTags), ip],
  );

  const rows = (await db.sql`SELECT * FROM coffee_reviews WHERE coffee_id = ${id}`) as ReviewRow[];
  return json(summarize(rows), 201);
};

export const config: Config = {
  path: '/api/coffees/:id/reviews',
};
