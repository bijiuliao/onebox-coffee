export interface ReviewRow {
  id: number;
  coffee_id: string;
  rating: number;
  flavor_tags: string[] | string;
  created_at: string;
}

export interface ReviewSummary {
  count: number;
  avgRating: number;
  tagCounts: Record<string, number>;
}

// Anonymous star rating + "which of this coffee's own tasting notes did you
// taste" chip picks - no free text, so there's nothing per-review worth
// showing to customers; the public endpoint only ever returns this
// aggregate. Individual rows (for admin moderation) are read separately.
export function summarize(rows: ReviewRow[]): ReviewSummary {
  const count = rows.length;
  const avgRating = count === 0 ? 0 : rows.reduce((sum, r) => sum + r.rating, 0) / count;
  const tagCounts: Record<string, number> = {};
  for (const row of rows) {
    const tags = typeof row.flavor_tags === 'string' ? JSON.parse(row.flavor_tags) : row.flavor_tags;
    for (const tag of tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  }
  return { count, avgRating: Math.round(avgRating * 10) / 10, tagCounts };
}
