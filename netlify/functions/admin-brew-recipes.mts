import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { BREW_KINDS, isForeignKeyError, parseRecipeFields, toBrewRecipe, type BrewKind, type BrewRecipeRow } from './lib/brewRecipes';

// Admin brewing log - GET lists recipes (optionally ?kind=espresso|pourover|special),
// newest brew first; POST creates one. Editing/deleting a single recipe is
// admin-brew-recipes-item.mts (/:id).
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const db = getDb();

  if (req.method === 'GET') {
    const kind = new URL(req.url).searchParams.get('kind');
    if (kind && !BREW_KINDS.includes(kind as BrewKind)) return json({ error: 'invalid kind' }, 400);
    const rows = (kind
      ? await db.sql`SELECT * FROM brew_recipes WHERE kind = ${kind} ORDER BY brewed_on DESC, id DESC`
      : await db.sql`SELECT * FROM brew_recipes ORDER BY brewed_on DESC, id DESC`) as BrewRecipeRow[];
    return json(rows.map(toBrewRecipe));
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (!('kind' in body)) return json({ error: 'kind is required' }, 400);
  const parsed = parseRecipeFields(body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);

  const columns = Object.keys(parsed.fields);
  const values = Object.values(parsed.fields);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  try {
    const { rows } = await db.pool.query(
      `INSERT INTO brew_recipes (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values,
    );
    return json(toBrewRecipe(rows[0] as BrewRecipeRow), 201);
  } catch (err) {
    if (isForeignKeyError(err)) return json({ error: '找不到選擇的豆子或特調品項' }, 400);
    throw err;
  }
};

export const config: Config = {
  path: '/api/admin/brew-recipes',
};
