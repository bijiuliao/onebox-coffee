import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

function page(title: string, body: string) {
  return new Response(`<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;
    background: #faf8f3; color: #1a1714; font-family: 'Iansui', 'Archivo', system-ui, sans-serif; text-align: center; }
  .card { background: #fff; border: 1px solid #ece5d6; border-radius: 20px; padding: 36px 28px; max-width: 360px; }
  .stars { color: #c98a2e; font-size: 30px; letter-spacing: 3px; margin: 14px 0; }
  p { line-height: 1.6; }
  a { color: #3d6b4f; }
</style>
</head>
<body><div class="card">${body}</div></body>
</html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// One-click star-rating redemption for the 30-day feedback email (see
// notify.ts's notifyFeedbackRequest). A GET, not a POST, because the
// entire point is "tap a link in an email, done" - no form most email
// clients could submit anyway. The rating lands directly in coffee_reviews,
// the same table the public per-coffee star average and the admin reviews
// list already read, so there's no separate feedback surface to build.
export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('method not allowed', { status: 405 });

  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const rating = Math.round(Number(url.searchParams.get('rating')));
  if (!token || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return page('連結無效', '<p>這個回饋連結似乎不完整，歡迎直接到商品頁為這支豆子評分，謝謝！</p>');
  }

  const db = getDb();
  const [row] = (await db.sql`
    SELECT oft.coffee_id, oft.redeemed_at, c.name AS coffee_name
    FROM order_feedback_tokens oft
    JOIN coffees c ON c.id = oft.coffee_id
    WHERE oft.token = ${token}
  `) as { coffee_id: string; redeemed_at: string | null; coffee_name: string }[];

  if (!row) return page('找不到這筆回饋', '<p>這個連結可能已經失效了，謝謝你願意給回饋！</p>');
  if (row.redeemed_at) {
    return page('已經評分過了', `<p>你已經對「${escapeHtml(row.coffee_name)}」評過分囉，謝謝你的回饋！</p>`);
  }

  await db.pool.query(
    `INSERT INTO coffee_reviews (coffee_id, rating, flavor_tags, client_ip) VALUES ($1, $2, $3, $4)`,
    [row.coffee_id, rating, JSON.stringify([]), 'email-feedback'],
  );
  await db.sql`UPDATE order_feedback_tokens SET redeemed_at = now() WHERE token = ${token}`;

  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  return page('感謝回饋', `<div class="stars">${stars}</div><p>謝謝你對「${escapeHtml(row.coffee_name)}」的評分！</p>`);
};

export const config: Config = {
  path: '/api/feedback',
};
