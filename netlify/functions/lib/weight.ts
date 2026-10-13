// Bag weight options are free-text labels (e.g. "半磅 227g", "1kg") with no
// structured weight field - this pulls the gram figure back out of that text
// so stock can be tracked and deducted in grams. Prefers an explicit kg
// match (converted to grams) over a bare-gram match so "1.5kg" isn't misread
// via some other embedded digit; returns null when the label has no
// recognizable weight at all (e.g. "半磅" alone), which callers treat as
// "can't verify against stock" rather than blocking the option outright.
export function parseBagWeightGrams(label: string): number | null {
  const kgMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:kg|KG|Kg|公斤)/);
  if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);
  const gMatch = label.match(/(\d+(?:\.\d+)?)\s*(?:g|G|克|公克)/);
  if (gMatch) return Math.round(parseFloat(gMatch[1]));
  return null;
}
