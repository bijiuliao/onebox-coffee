export interface CoffeeGrade {
  key: string;
  label: string;
}

// Fixed rarity classes the admin picks from (coffees.grade column) - order
// here is also the order shown everywhere (admin dropdown, menu filter
// pills). Mirrors client/src/coffeeGrade.ts (can't share a module graph
// between the two, not worth it for one array).
export const COFFEE_GRADES: CoffeeGrade[] = [
  { key: 'espresso', label: '義式豆' },
  { key: 'daily', label: '日常豆' },
  { key: 'rare', label: '稀有豆' },
  { key: 'competition', label: '競賽等級豆' },
];

export function isValidGrade(key: unknown): key is string {
  return typeof key === 'string' && COFFEE_GRADES.some(g => g.key === key);
}
