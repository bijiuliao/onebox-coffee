import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, type CoffeeRow } from './lib/coffees';
import { requireAdmin } from './lib/auth';

interface CartItemInput {
  id: string;
  temp: string;
  size: string;
  qty: number;
}

export default async (req: Request) => {
  const db = getDb();

  if (req.method === 'GET') {
    const unauthorized = requireAdmin(req);
    if (unauthorized) return unauthorized;

    const rows = (await db.sql`
      SELECT id, created_at, customer_name, items, total FROM orders ORDER BY created_at DESC LIMIT 200
    `) as { id: number; created_at: string; customer_name: string; items: unknown; total: number }[];
    const orders = rows.map(r => ({
      id: r.id,
      createdAt: r.created_at,
      customerName: r.customer_name,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      total: r.total,
    }));
    return json(orders);
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  if (!customerName) return json({ error: 'customerName is required' }, 400);
  if (customerName.length > 40) return json({ error: 'customerName is too long' }, 400);

  const items: CartItemInput[] = Array.isArray(body.items) ? (body.items as CartItemInput[]) : [];
  if (items.length === 0) return json({ error: 'cart is empty' }, 400);

  const lines: { id: string; name: string; temp: string; size: string; qty: number; unitPrice: number; linePrice: number }[] = [];

  for (const item of items) {
    const [row] = (await db.sql`SELECT * FROM coffees WHERE id = ${item.id}`) as CoffeeRow[];
    if (!row) return json({ error: `unknown coffee: ${item.id}` }, 400);
    const coffee = toCoffee(row);
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
    const unitPrice = coffee.price + (item.size === '大杯' ? 20 : 0);
    lines.push({ id: coffee.id, name: coffee.name, temp: item.temp, size: item.size, qty, unitPrice, linePrice: unitPrice * qty });
  }

  const total = lines.reduce((sum, l) => sum + l.linePrice, 0);
  const [order] = (await db.sql`
    INSERT INTO orders (customer_name, items, total) VALUES (${customerName}, ${JSON.stringify(lines)}, ${total})
    RETURNING id, created_at
  `) as { id: number; created_at: string }[];

  return json({ id: order.id, createdAt: order.created_at, customerName, items: lines, total }, 201);
};

export const config: Config = {
  path: '/api/orders',
};
