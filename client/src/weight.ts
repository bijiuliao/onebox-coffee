// Mirrors netlify/functions/lib/weight.ts (separate module graph, can't be
// shared directly) - keep both in sync. Bag weight options are free-text
// labels (e.g. "半磅 227g", "1kg") with no structured weight field, so this
// pulls the gram figure back out of the text for stock display/validation.
// Returns null when the label has no recognizable weight at all (e.g. "半磅"
// alone) - callers treat that as "can't verify against stock", not blocked.
export function parseBagWeightGrams(label: string): number | null {
  const kgMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:kg|KG|Kg|公斤)/);
  if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);
  const gMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:g|G|克|公克)/);
  if (gMatch) return Math.round(parseFloat(gMatch[1]));
  return null;
}
