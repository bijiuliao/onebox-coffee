import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { getDb } from './lib/db';
import { json, pathSegments } from './lib/coffees';
import { toSpecial, type SpecialRow } from './lib/specials';
import { requireAdmin } from './lib/auth';

const MAX_BYTES = 8 * 1024 * 1024;

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const id = decodeURIComponent(pathSegments(req)[2] ?? '');
  if (!id) return json({ error: 'missing id' }, 400);

  const db = getDb();
  const existing = (await db.sql`SELECT * FROM specials WHERE id = ${id}`) as SpecialRow[];
  if (existing.length === 0) return json({ error: 'not found' }, 404);

  const form = await req.formData().catch(() => null);
  const file = form?.get('cover');
  if (!(file instanceof File)) return json({ error: 'no file uploaded' }, 400);
  if (!file.type.startsWith('image/')) return json({ error: 'only image uploads are allowed' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'file too large (max 8MB)' }, 400);

  // Shares the coffee-covers blob store - blob keys are namespaced by id already.
  const store = getStore('coffee-covers');
  const key = `${id}-${Date.now()}`;
  await store.set(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });

  const coverUrl = `/api/cover-image/${key}`;
  await db.sql`UPDATE specials SET cover_url = ${coverUrl} WHERE id = ${id}`;
  const [updated] = (await db.sql`SELECT * FROM specials WHERE id = ${id}`) as SpecialRow[];
  return json(toSpecial(updated));
};

export const config: Config = {
  path: '/api/specials/:id/cover',
};
