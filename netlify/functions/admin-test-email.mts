import type { Config } from '@netlify/functions';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';

// One-off diagnostic for confirming the Resend sender domain is actually
// working (e.g. after a DNS/domain-verification change), sent to the shop's
// own NOTIFY_EMAIL - not a customer-facing endpoint.
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey) return json({ error: 'RESEND_API_KEY is not configured on this site' }, 500);
  if (!to) return json({ error: 'NOTIFY_EMAIL is not configured on this site' }, 500);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'onebox coffee <news@oneboxcoffee.app>',
      to: [to],
      subject: '☕ 測試信：oneboxcoffee.app 寄信設定',
      html: '<p style="font-family:sans-serif;color:#1a1714">這是一封測試信，確認 <b>news@oneboxcoffee.app</b> 已經可以正常寄信給你。</p>',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ ok: false, status: res.status, error: detail }, 502);
  }
  return json({ ok: true, sentTo: to });
};

export const config: Config = {
  path: '/api/admin/test-email',
};
