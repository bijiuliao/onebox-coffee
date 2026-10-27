export interface BagOption {
  label: string;
  price: number;
}

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
  sellsBeans: boolean;
  bagOptions: BagOption[];
  createdAt: string;
  archived: boolean;
  stockQty: number | null;
  costPerGramTwd: number | null;
  // Whether the one-time "new bean launched" email has already fired for
  // this coffee (see coffees-item.mts) - exposed so the admin UI only asks
  // "send the launch email?" at the one moment it's actually relevant.
  launchNotified: boolean;
  // Rarity class (see lib/coffeeGrade.ts) - null until the admin sets one.
  grade: string | null;
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
  sells_beans: boolean;
  bag_options: BagOption[] | string;
  created_at: string;
  archived: boolean;
  stock_qty: number | null;
  launch_notified: boolean;
  cost_per_gram_twd: number | string | null;
  grade: string | null;
}

export function toCoffee(row: CoffeeRow): Coffee {
  const notes = typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes;
  const bagOptions = typeof row.bag_options === 'string' ? JSON.parse(row.bag_options) : row.bag_options;
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
    sellsBeans: row.sells_beans,
    bagOptions,
    createdAt: row.created_at,
    archived: row.archived,
    stockQty: row.stock_qty,
    costPerGramTwd: row.cost_per_gram_twd === null ? null : Number(row.cost_per_gram_twd),
    launchNotified: row.launch_notified,
    grade: row.grade,
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
  sellsBeans: 'sells_beans',
  bagOptions: 'bag_options',
  archived: 'archived',
  stockQty: 'stock_qty',
  costPerGramTwd: 'cost_per_gram_twd',
  grade: 'grade',
};

// Fields whose value must be JSON.stringify'd before binding to a jsonb column.
export const JSON_COLUMNS = new Set(['notes', 'bagOptions']);

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    // Without an explicit charset, a browser that's navigated straight to
    // an API URL (not fetched by the app's own JS, which always treats a
    // JSON response body as UTF-8 per the Fetch spec regardless of this
    // header) can fall back to the OS's legacy default encoding to render
    // it as a document - garbling any CJK text in the response.
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'bean';
}

// Path is always /api/coffees[/:id[/cover]] - segments[0]='api', [1]='coffees'.
export function pathSegments(req: Request): string[] {
  return new URL(req.url).pathname.split('/').filter(Boolean);
}
