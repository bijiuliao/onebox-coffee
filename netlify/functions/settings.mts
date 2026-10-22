import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';

interface SettingsRow {
  drip_enabled: boolean;
}

export default async (req: Request) => {
  const db = getDb();

  if (req.method === 'GET') {
    // Public - MenuScreen/DetailScreen need this to hide the 手沖 tab/options
    // when the shop has paused drip service, so no admin auth here.
    const [row] = (await db.sql`SELECT drip_enabled FROM site_settings WHERE id = 1`) as SettingsRow[];
    return json({ dripEnabled: row?.drip_enabled ?? true });
  }

  if (req.method === 'PATCH') {
    const unauthorized = requireAdmin(req);
    if (unauthorized) return unauthorized;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    if (typeof body.dripEnabled !== 'boolean') return json({ error: 'dripEnabled must be a boolean' }, 400);

    const [row] = (await db.sql`
      UPDATE site_settings SET drip_enabled = ${body.dripEnabled} WHERE id = 1
      RETURNING drip_enabled
    `) as SettingsRow[];
    return json({ dripEnabled: row.drip_enabled });
  }

  return json({ error: 'method not allowed' }, 405);
};

export const config: Config = {
  path: '/api/settings',
};
