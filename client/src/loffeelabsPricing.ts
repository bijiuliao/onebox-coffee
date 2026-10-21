import type { LoffeelabsBean } from './types';

// loffeelabs' price-low/price-high read as USD regardless of the roaster's
// own country - e.g. a Japan-based roaster's listing still prices like
// $18/150g (~$0.12/g, a normal specialty-coffee price), not like it was
// literally 18 Japanese yen (which would be an unrealistically tiny
// fraction of a cent per gram). So this converts directly from USD, not
// from a country -> local-currency guess.
//
// The rate itself is a static reference snapshot, not a live feed - good
// enough to compare listings at a glance while browsing, not a basis for
// actual retail pricing decisions.
const USD_TO_TWD = 32;

// Returns an approximate NT$/gram figure from the bean's low-end price/gram
// pair, or null when price/weight data is missing.
export function estimateTwdPerGram(bean: LoffeelabsBean): number | null {
  if (!bean.priceLow || !bean.gramLow) return null;
  return (bean.priceLow / bean.gramLow) * USD_TO_TWD;
}
