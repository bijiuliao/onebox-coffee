export interface Coffee {
  id: string;
  name: string;
  originEN: string;
  roast: string;
  level: number;
  notes: string[];
  price: number;
  color: string;
  score: number;
  process: string;
  altitude: string;
  varietal: string;
  harvest: string;
  desc: string;
  roaster: string;
  temps: { hot: boolean; ice: boolean };
  sizes: { std: boolean; large: boolean };
  active: boolean;
  coverUrl: string | null;
}

export interface CoffeeRow {
  id: string;
  name: string;
  origin_en: string;
  roast: string;
  level: number;
  notes: string[] | string;
  price: number;
  color: string;
  score: number;
  process: string;
  altitude: string;
  varietal: string;
  harvest: string;
  description: string;
  roaster: string;
  hot_enabled: boolean;
  ice_enabled: boolean;
  std_enabled: boolean;
  large_enabled: boolean;
  active: boolean;
  cover_url: string | null;
  sort_order: number;
}

export function toCoffee(row: CoffeeRow): Coffee {
  const notes = typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes;
  return {
    id: row.id,
    name: row.name,
    originEN: row.origin_en,
    roast: row.roast,
    level: row.level,
    notes,
    price: row.price,
    color: row.color,
    score: row.score,
    process: row.process,
    altitude: row.altitude,
    varietal: row.varietal,
    harvest: row.harvest,
    desc: row.description,
    roaster: row.roaster,
    temps: { hot: row.hot_enabled, ice: row.ice_enabled },
    sizes: { std: row.std_enabled, large: row.large_enabled },
    active: row.active,
    coverUrl: row.cover_url,
  };
}

// API field name -> DB column name, for the fields PATCH is allowed to touch directly.
export const EDITABLE_COLUMNS: Record<string, string> = {
  name: 'name',
  originEN: 'origin_en',
  roast: 'roast',
  level: 'level',
  notes: 'notes',
  price: 'price',
  color: 'color',
  score: 'score',
  process: 'process',
  altitude: 'altitude',
  varietal: 'varietal',
  harvest: 'harvest',
  desc: 'description',
  roaster: 'roaster',
  active: 'active',
  coverUrl: 'cover_url',
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'bean';
}

// Path is always /api/coffees[/:id[/cover]] - segments[0]='api', [1]='coffees'.
export function pathSegments(req: Request): string[] {
  return new URL(req.url).pathname.split('/').filter(Boolean);
}
