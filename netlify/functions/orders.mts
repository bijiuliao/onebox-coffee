import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, type CoffeeRow } from './lib/coffees';

interface CartItemInput {
  id: string;
  temp: string;
  size: string;
  qty: number;
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const items: CartItemInput[] = Array.isArray(body.items) ? (body.items as CartItemInput[]) : [];
  if (items.length === 0) return json({ error: 'cart is empty' }, 400);

  const db = getDb();
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
    INSERT INTO orders (items, total) VALUES (${JSON.stringify(lines)}, ${total})
    RETURNING id, created_at
  `) as { id: number; created_at: string }[];

  return json({ id: order.id, createdAt: order.created_at, items: lines, total }, 201);
};

export const config: Config = {
  path: '/api/orders',
};
