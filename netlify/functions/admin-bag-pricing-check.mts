import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { parseBagWeightGrams } from './lib/weight';

interface BagOption {
  label: string;
  price: number;
}

// One-off read-only report, not a permanent admin page - for the user to
// open once in their browser and paste the JSON back for review. Checks
// each sellable coffee's bag options for the usual "smaller bag = higher
// per-gram price" expectation (bigger bags should be the better deal,
// since packaging/handling cost is roughly fixed per bag regardless of
// weight) and flags any coffee where that's violated, so they can decide
// whether each flagged case is an intentional choice or just an oversight.
// Never writes anything.
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const db = getDb();
  const rows = (await db.sql`
    SELECT id, name, bag_options, cost_per_gram_twd
    FROM coffees
    WHERE sells_beans = true AND archived = false
    ORDER BY name
  `) as { id: string; name: string; bag_options: BagOption[] | string; cost_per_gram_twd: number | string | null }[];

  const report = rows.map(row => {
    const bagOptions = (typeof row.bag_options === 'string' ? JSON.parse(row.bag_options) : row.bag_options) as BagOption[];
    const costPerGramTwd = row.cost_per_gram_twd === null ? null : Number(row.cost_per_gram_twd);

    const parsed = bagOptions.map(b => {
      const grams = parseBagWeightGrams(b.label);
      return {
        label: b.label,
        price: b.price,
        grams,
        pricePerGram: grams !== null && grams > 0 ? Math.round((b.price / grams) * 100) / 100 : null,
        marginPerGram: grams !== null && grams > 0 && costPerGramTwd !== null
          ? Math.round((b.price / grams - costPerGramTwd) * 100) / 100
          : null,
      };
    });

    const unparseable = parsed.filter(b => b.grams === null).map(b => b.label);
    const sized = parsed.filter((b): b is typeof b & { grams: number; pricePerGram: number } => b.grams !== null && b.pricePerGram !== null)
      .sort((a, b) => a.grams - b.grams);

    // Flags a pair where the *larger* bag's per-gram price isn't strictly
    // cheaper than the smaller one's - i.e. no volume discount, or (worse)
    // the big bag costs more per gram than the small one.
    const flaggedPairs: { smaller: string; larger: string; smallerPerGram: number; largerPerGram: number }[] = [];
    for (let i = 0; i < sized.length - 1; i++) {
      for (let j = i + 1; j < sized.length; j++) {
        if (sized[j].pricePerGram >= sized[i].pricePerGram) {
          flaggedPairs.push({
            smaller: sized[i].label, larger: sized[j].label,
            smallerPerGram: sized[i].pricePerGram, largerPerGram: sized[j].pricePerGram,
          });
        }
      }
    }

    return {
      id: row.id, name: row.name, costPerGramTwd,
      bagOptions: parsed, unparseable, flagged: flaggedPairs.length > 0, flaggedPairs,
    };
  });

  return json({
    totalCoffees: report.length,
    flaggedCount: report.filter(r => r.flagged).length,
    unparseableCount: report.filter(r => r.unparseable.length > 0).length,
    coffees: report,
  });
};

export const config: Config = {
  path: '/api/admin/bag-pricing-check',
};
