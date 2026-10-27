export interface CoffeeGrade {
  key: string;
  label: string;
}

// Mirrors netlify/functions/lib/coffeeGrade.ts.
export const COFFEE_GRADES: CoffeeGrade[] = [
  { key: 'espresso', label: '義式豆' },
  { key: 'daily', label: '日常豆' },
  { key: 'rare', label: '稀有豆' },
  { key: 'competition', label: '競賽等級豆' },
];

export function gradeLabel(key: string | null): string | null {
  return COFFEE_GRADES.find(g => g.key === key)?.label ?? null;
}
