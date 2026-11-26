// Shared row mapping/validation for the admin brewing log (brew_recipes
// table, see the create-brew-recipes migration). Used by both
// admin-brew-recipes.mts (list/create) and admin-brew-recipes-item.mts
// (edit/delete).

export type BrewKind = 'espresso' | 'pourover' | 'special';
export const BREW_KINDS: BrewKind[] = ['espresso', 'pourover', 'special'];

export interface BrewRecipeRow {
  id: number;
  kind: BrewKind;
  coffee_id: string | null;
  special_id: string | null;
  title: string;
  params: Record<string, unknown> | string;
  notes: string;
  rating: number | null;
  favorite: boolean;
  brewed_on: string | Date;
  created_at: string;
  updated_at: string;
}

function toDateString(v: string | Date): string {
  if (v instanceof Date) {
    // DATE columns can come back as a local-midnight Date - format from
    // local parts so the day doesn't shift when the server isn't on UTC.
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

export function toBrewRecipe(row: BrewRecipeRow) {
  return {
    id: row.id,
    kind: row.kind,
    coffeeId: row.coffee_id,
    specialId: row.special_id,
    title: row.title,
    params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
    notes: row.notes,
    rating: row.rating,
    favorite: row.favorite,
    brewedOn: toDateString(row.brewed_on),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Validates the user-editable fields present in body, returning either an
// error message or a column -> value map ready to bind. Fields absent from
// body are left out entirely (PATCH semantics).
export function parseRecipeFields(body: Record<string, unknown>): { error: string } | { fields: Record<string, unknown> } {
  const fields: Record<string, unknown> = {};

  if ('kind' in body) {
    if (!BREW_KINDS.includes(body.kind as BrewKind)) return { error: 'kind 必須是 espresso / pourover / special' };
    fields.kind = body.kind;
  }
  if ('coffeeId' in body) {
    if (body.coffeeId !== null && typeof body.coffeeId !== 'string') return { error: 'coffeeId 必須是字串或 null' };
    fields.coffee_id = body.coffeeId || null;
  }
  if ('specialId' in body) {
    if (body.specialId !== null && typeof body.specialId !== 'string') return { error: 'specialId 必須是字串或 null' };
    fields.special_id = body.specialId || null;
  }
  if ('title' in body) {
    if (typeof body.title !== 'string') return { error: 'title 必須是字串' };
    fields.title = body.title.trim().slice(0, 200);
  }
  if ('params' in body) {
    if (!body.params || typeof body.params !== 'object' || Array.isArray(body.params)) return { error: 'params 必須是物件' };
    const encoded = JSON.stringify(body.params);
    if (encoded.length > 20000) return { error: 'params 太大了' };
    fields.params = encoded;
  }
  if ('notes' in body) {
    if (typeof body.notes !== 'string') return { error: 'notes 必須是字串' };
    fields.notes = body.notes.slice(0, 5000);
  }
  if ('rating' in body) {
    const rating = body.rating === null ? null : Number(body.rating);
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return { error: 'rating 必須是 1-5 的整數或 null' };
    fields.rating = rating;
  }
  if ('favorite' in body) {
    if (typeof body.favorite !== 'boolean') return { error: 'favorite 必須是 true/false' };
    fields.favorite = body.favorite;
  }
  if ('brewedOn' in body) {
    if (typeof body.brewedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.brewedOn)) return { error: 'brewedOn 格式必須是 YYYY-MM-DD' };
    fields.brewed_on = body.brewedOn;
  }

  return { fields };
}

// Postgres foreign-key violation - the picked coffee/special id doesn't exist.
export function isForeignKeyError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === '23503';
}
