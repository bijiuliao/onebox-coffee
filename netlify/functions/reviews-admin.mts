import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';

export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const db = getDb();
  const rows = (await db.sql`
    SELECT r.id, r.coffee_id, r.rating, r.flavor_tags, r.created_at, c.name AS coffee_name, c.color AS coffee_color
    FROM coffee_reviews r
    JOIN coffees c ON c.id = r.coffee_id
    ORDER BY r.created_at DESC
    LIMIT 300
  `) as {
    id: number; coffee_id: string; rating: number; flavor_tags: string[] | string;
    created_at: string; coffee_name: string; coffee_color: string;
  }[];

  const reviews = rows.map(r => ({
    id: r.id,
    coffeeId: r.coffee_id,
    coffeeName: r.coffee_name,
    coffeeColor: r.coffee_color,
    rating: r.rating,
    flavorTags: typeof r.flavor_tags === 'string' ? JSON.parse(r.flavor_tags) : r.flavor_tags,
    createdAt: r.created_at,
  }));
  return json(reviews);
};

export const config: Config = {
  path: '/api/admin/reviews',
};
