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
    SELECT r.id, r.coffee_id, r.rating, r.flavor_tags, r.created_at, r.client_ip, r.order_id,
      c.name AS coffee_name, c.color AS coffee_color,
      o.customer_name, o.customer_email
    FROM coffee_reviews r
    JOIN coffees c ON c.id = r.coffee_id
    LEFT JOIN orders o ON o.id = r.order_id
    ORDER BY r.created_at DESC
    LIMIT 300
  `) as {
    id: number; coffee_id: string; rating: number; flavor_tags: string[] | string;
    created_at: string; client_ip: string; order_id: number | null; coffee_name: string; coffee_color: string;
    customer_name: string | null; customer_email: string | null;
  }[];

  const reviews = rows.map(r => ({
    id: r.id,
    coffeeId: r.coffee_id,
    coffeeName: r.coffee_name,
    coffeeColor: r.coffee_color,
    rating: r.rating,
    flavorTags: typeof r.flavor_tags === 'string' ? JSON.parse(r.flavor_tags) : r.flavor_tags,
    createdAt: r.created_at,
    // 'email' = rated via the 30-day feedback email link (tied to an order,
    // see feedback.mts); 'page' = anonymous rating on the product page.
    source: r.client_ip === 'email-feedback' ? 'email' : 'page',
    orderId: r.order_id,
    customerName: r.customer_name ?? null,
    customerEmail: r.customer_email || null,
  }));
  return json(reviews);
};

export const config: Config = {
  path: '/api/admin/reviews',
};
