interface CoffeeForLaunchNotify {
  id: string;
  name: string;
  roast: string;
  process: string;
  notes: string[];
  desc: string;
  bagOptions: { label: string; price: number }[];
  coverUrl: string | null;
}

const SITE_URL = 'https://onebox-coffee.netlify.app';

// coverUrl can be a bare /api/cover-image/... path (see coffees-item.mts's
// validation) - email clients can't resolve that relatively, so it needs
// the full site origin in front of it.
function absoluteCoverUrl(coverUrl: string | null): string | null {
  if (!coverUrl) return null;
  return coverUrl.startsWith('/') ? `${SITE_URL}${coverUrl}` : coverUrl;
}

// Best-effort "new beans" announcement to past bean customers - the admin
// picks which beans to include and triggers this manually (see
// admin-notify-beans.mts), so several same-day launches go out as ONE
// combined email instead of one per bean. Sent individually per recipient
// (not a single bulk/BCC call) so one bad address can't affect anyone
// else's delivery, and so this never throws.
export async function notifyNewBeanLaunch(coffees: CoffeeForLaunchNotify[], recipients: string[]): Promise<{ sent: number; failed: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('notifyNewBeanLaunch: RESEND_API_KEY not set, skipping email notification');
    return { sent: 0, failed: recipients.length };
  }
  if (recipients.length === 0 || coffees.length === 0) return { sent: 0, failed: 0 };

  const beanBlocks = coffees.map(coffee => {
    const img = absoluteCoverUrl(coffee.coverUrl);
    const bagRows = coffee.bagOptions
      .map(b => `<li>${escapeHtml(b.label)} — $${b.price}</li>`)
      .join('');
    return `
      <div style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #ece5d6">
        ${img ? `<img src="${img}" alt="${escapeHtml(coffee.name)}" style="width:100%;max-width:420px;height:auto;border-radius:12px;margin-bottom:12px;display:block">` : ''}
        <h3 style="margin:0 0 6px;font-size:18px">${escapeHtml(coffee.name)}</h3>
        ${coffee.notes.length ? `<p style="margin:0 0 4px;color:#8a7a68">風味：${coffee.notes.map(escapeHtml).join(' · ')}</p>` : ''}
        <p style="margin:0 0 4px;color:#4a3c2e">${escapeHtml(coffee.roast)} · ${escapeHtml(coffee.process)}</p>
        ${coffee.desc ? `<p style="margin:10px 0;color:#4a3c2e">${escapeHtml(coffee.desc)}</p>` : ''}
        ${bagRows ? `<ul style="margin:10px 0;padding-left:20px">${bagRows}</ul>` : ''}
      </div>
    `;
  }).join('');

  const title = coffees.length === 1 ? `☕ 新豆上架：${escapeHtml(coffees[0].name)}` : `☕ 新豆上架：${coffees.length} 款新豆`;
  const namesJoined = coffees.length <= 3
    ? coffees.map(c => c.name).join('、')
    : `${coffees.slice(0, 2).map(c => c.name).join('、')}等 ${coffees.length} 款新豆`;
  const subject = `☕ 新豆上架：${namesJoined}`;

  const html = `
    <div style="font-family:sans-serif;color:#1a1714;max-width:480px">
      <h2 style="margin:0 0 16px">${title}</h2>
      ${beanBlocks}
      <p style="margin-top:4px">歡迎回到 onebox 選購 ☕</p>
    </div>
  `;

  const results = await Promise.allSettled(recipients.map(to =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'onebox coffee <news@oneboxcoffee.app>',
        to: [to],
        subject,
        html,
      }),
    }).then(res => {
      if (!res.ok) throw new Error(`Resend API error ${res.status}`);
    }),
  ));
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) {
    console.error(`notifyNewBeanLaunch: ${failed}/${recipients.length} sends failed`);
  }
  return { sent: recipients.length - failed, failed };
}

interface OrderForNotify {
  id: number;
  customerName: string;
  customerEmail: string;
  items: { name: string; detail: string; qty: number; linePrice: number }[];
  total: number;
  orderType: string;
  deliveryFee: number;
  deliveryDistanceKm: number | null;
  customerLat: number | null;
  customerLng: number | null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

// Best-effort: a notification failure must never break checkout, so this
// never throws - it just logs and returns.
export async function notifyNewOrder(order: OrderForNotify) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey || !to) {
    console.warn('notifyNewOrder: RESEND_API_KEY or NOTIFY_EMAIL not set, skipping email notification');
    return;
  }

  const rows = order.items
    .map(l => `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(l.name)} × ${l.qty}</td><td style="padding:4px 0;color:#8a7a68">${escapeHtml(l.detail)}</td><td style="padding:4px 0;text-align:right">$${l.linePrice}</td></tr>`)
    .join('');

  const fulfillmentLine = order.orderType === '外送'
    ? `外送 · 距離約 ${order.deliveryDistanceKm} 公里 · 運費 $${order.deliveryFee}` +
      (order.customerLat != null && order.customerLng != null
        ? ` · <a href="https://www.google.com/maps?q=${order.customerLat},${order.customerLng}">在地圖上開啟</a>`
        : '')
    : '自取';

  const html = `
    <div style="font-family:sans-serif;color:#1a1714">
      <h2 style="margin:0 0 4px">☕ 新訂單 #${order.id}</h2>
      <p style="margin:0 0 4px;color:#4a3c2e"><b>取餐姓名：</b>${escapeHtml(order.customerName)}</p>
      <p style="margin:0 0 4px;color:#4a3c2e"><b>Email：</b>${escapeHtml(order.customerEmail)}</p>
      <p style="margin:0 0 16px;color:#4a3c2e"><b>取貨方式：</b>${fulfillmentLine}</p>
      <table style="border-collapse:collapse;width:100%;max-width:420px">${rows}</table>
      <p style="margin-top:16px;font-size:18px"><b>總計：$${order.total}</b></p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'onebox coffee <onboarding@resend.dev>',
        to: [to],
        subject: `☕ 新訂單 #${order.id} · ${order.customerName}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error('notifyNewOrder: Resend API error', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('notifyNewOrder: failed to send', err);
  }
}

// Best-effort order confirmation sent to the customer themselves - separate
// from notifyNewOrder above, which alerts the shop owner instead. Includes a
// link back to /order-lookup (id+email, no account needed) so they can check
// status later. Never throws - a failed confirmation email must not block checkout.
export async function notifyCustomerOrderConfirmation(order: OrderForNotify) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('notifyCustomerOrderConfirmation: RESEND_API_KEY not set, skipping email notification');
    return;
  }

  const rows = order.items
    .map(l => `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(l.name)} × ${l.qty}</td><td style="padding:4px 0;color:#8a7a68">${escapeHtml(l.detail)}</td><td style="padding:4px 0;text-align:right">$${l.linePrice}</td></tr>`)
    .join('');

  const fulfillmentLine = order.orderType === '外送'
    ? `外送 · 距離約 ${order.deliveryDistanceKm} 公里 · 運費 $${order.deliveryFee}`
    : '門市自取';

  const lookupUrl = `https://onebox-coffee.netlify.app/order-lookup?id=${order.id}&email=${encodeURIComponent(order.customerEmail)}`;

  const html = `
    <div style="font-family:sans-serif;color:#1a1714">
      <h2 style="margin:0 0 4px">☕ 訂單確認 #${order.id}</h2>
      <p style="margin:0 0 16px;color:#4a3c2e">謝謝你的訂購，${escapeHtml(order.customerName)}！<b>取貨方式：</b>${fulfillmentLine}</p>
      <table style="border-collapse:collapse;width:100%;max-width:420px">${rows}</table>
      <p style="margin-top:16px;font-size:18px"><b>總計：$${order.total}</b></p>
      <p style="margin-top:20px"><a href="${lookupUrl}" style="color:#3d6b4f">查看訂單狀態 →</a></p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'onebox coffee <order@oneboxcoffee.app>',
        to: [order.customerEmail],
        subject: `☕ 訂單確認 #${order.id}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error('notifyCustomerOrderConfirmation: Resend API error', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('notifyCustomerOrderConfirmation: failed to send', err);
  }
}
