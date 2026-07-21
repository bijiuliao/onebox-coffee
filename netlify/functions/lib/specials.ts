export interface Special {
  id: string;
  name: string;
  desc: string;
  price: number;
  color: string;
  notes: string[];
  temps: { hot: boolean; ice: boolean };
  active: boolean;
  coverUrl: string | null;
}

export interface SpecialRow {
  id: string;
  name: string;
  description: string;
  price: number;
  color: string;
  notes: string[] | string;
  hot_enabled: boolean;
  ice_enabled: boolean;
  active: boolean;
  cover_url: string | null;
  sort_order: number;
}

export function toSpecial(row: SpecialRow): Special {
  const notes = typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes;
  return {
    id: row.id,
    name: row.name,
    desc: row.description,
    price: row.price,
    color: row.color,
    notes,
    temps: { hot: row.hot_enabled, ice: row.ice_enabled },
    active: row.active,
    coverUrl: row.cover_url,
  };
}

export const EDITABLE_COLUMNS: Record<string, string> = {
  name: 'name',
  desc: 'description',
  price: 'price',
  color: 'color',
  notes: 'notes',
  active: 'active',
  coverUrl: 'cover_url',
};

export const JSON_COLUMNS = new Set(['notes']);
