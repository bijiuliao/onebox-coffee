import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json, pathSegments } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { isForeignKeyError, parseRecipeFields, toBrewRecipe, type BrewRecipeRow } from './lib/brewRecipes';

// Edit (PATCH) or delete (DELETE) a single brewing-log recipe.
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const id = Number(pathSegments(req)[3]);
  if (!Number.isInteger(id)) return json({ error: 'invalid id' }, 400);

  const db = getDb();

  if (req.method === 'DELETE') {
    const { rowCount } = await db.pool.query('DELETE FROM brew_recipes WHERE id = $1', [id]);
    if (!rowCount) return json({ error: 'not found' }, 404);
    return json({ id, deleted: true });
  }

  if (req.method !== 'PATCH') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const parsed = parseRecipeFields(body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);

  const entries = Object.entries(parsed.fields);
  if (entries.length === 0) return json({ error: 'no fields to update' }, 400);

  const sets = entries.map(([column], i) => `${column} = $${i + 1}`);
  sets.push('updated_at = now()');
  const values = [...entries.map(([, v]) => v), id];

  try {
    const { rows } = await db.pool.query(
      `UPDATE brew_recipes SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (rows.length === 0) return json({ error: 'not found' }, 404);
    return json(toBrewRecipe(rows[0] as BrewRecipeRow));
  } catch (err) {
    if (isForeignKeyError(err)) return json({ error: '找不到選擇的豆子或特調品項' }, 400);
    throw err;
  }
};

export const config: Config = {
  path: '/api/admin/brew-recipes/:id',
};
