import { COFFEE_GRADES } from './coffeeGrade';

interface CoffeeForLaunchNotify {
  id: string;
  name: string;
  roast: string;
  process: string;
  notes: string[];
  desc: string;
  bagOptions: { label: string; price: number }[];
  coverUrl: string | null;
  grade: string | null;
}

function gradeLabel(key: string | null): string | null {
  return COFFEE_GRADES.find(g => g.key === key)?.label ?? null;
}

const SITE_URL = 'https://onebox-coffee.netlify.app';

// coverUrl can be a bare /api/cover-image/... path (see coffees-item.mts's
// validation) - email clients can't resolve that relatively, so it needs
// the full site origin in front of it.
function absoluteCoverUrl(coverUrl: string | null): string | null {
  if (!coverUrl) return null;
  return coverUrl.startsWith('/') ? `${SITE_URL}${coverUrl}` : coverUrl;
}

// Best-effort "new beans" announcement to the given recipients (see
// admin-notify-beans.mts, which sends it to every past customer - not just
// past bean buyers). The admin picks which beans to include and triggers
// this manually, so several same-day launches go out as ONE combined email
// instead of one per bean. Sent individually per recipient (not a single
// bulk/BCC call) so one bad address can't affect anyone else's delivery,
// and so this never throws.
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

    // mode=beans lands straight on the bag-size picker (DetailScreen falls
    // back to this query param when there's no router state, i.e. a cold
    // link from an email) instead of the default 手沖 mode.
    const coffeeUrl = `${SITE_URL}/coffee/${encodeURIComponent(coffee.id)}?mode=beans`;

    const grade = gradeLabel(coffee.grade);

    return `
      <div style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #ece5d6">
        ${img ? `<a href="${coffeeUrl}" target="_blank"><img src="${img}" alt="${escapeHtml(coffee.name)}" style="width:100%;max-width:420px;height:auto;border-radius:12px;margin-bottom:12px;display:block;border:none;"></a>` : ''}
        ${grade ? `<span style="display:inline-block;background-color:#c98a2e;color:#ffffff;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:10px;margin-bottom:6px;">${escapeHtml(grade)}</span>` : ''}
        <h3 style="margin:0 0 6px;font-size:18px"><a href="${coffeeUrl}" target="_blank" style="color:#1a1714;text-decoration:none;">${escapeHtml(coffee.name)}</a></h3>
        ${coffee.notes.length ? `<p style="margin:0 0 4px;color:#8a7a68">風味：${coffee.notes.map(escapeHtml).join(' · ')}</p>` : ''}
        <p style="margin:0 0 4px;color:#4a3c2e">${escapeHtml(coffee.roast)} · ${escapeHtml(coffee.process)}</p>
        ${coffee.desc ? `<p style="margin:10px 0;color:#4a3c2e">${escapeHtml(coffee.desc)}</p>` : ''}
        ${bagRows ? `<ul style="margin:10px 0;padding-left:20px">${bagRows}</ul>` : ''}
        <a href="${coffeeUrl}" target="_blank" style="display:inline-block; background-color:#4a3c2e; color:#ffffff; text-decoration:none; padding:10px 24px; border-radius:6px; font-size:16px; margin-top:12px; font-weight:bold;">立即選購</a>
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

interface FeedbackCoffee {
  name: string;
  token: string;
}

// 30-days-later "how was it" follow-up (see feedback-reminder.mts). Each
// coffee in the order gets its own row of 5 one-click star links - no form
// to fill in, since most email clients can't submit one anyway. Clicking a
// star hits GET /api/feedback?token=...&rating=N directly, which both
// records the rating and shows a thank-you page - see feedback.mts.
export async function notifyFeedbackRequest(customerName: string, customerEmail: string, orderId: number, coffees: FeedbackCoffee[]): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('notifyFeedbackRequest: RESEND_API_KEY not set, skipping email notification');
    return false;
  }
  if (coffees.length === 0) return false;

  const coffeeBlocks = coffees.map(c => {
    const stars = [1, 2, 3, 4, 5].map(n => {
      const url = `${SITE_URL}/api/feedback?token=${encodeURIComponent(c.token)}&rating=${n}`;
      return `<a href="${url}" style="text-decoration:none;color:#c98a2e;font-size:26px;padding:0 2px">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</a>`;
    });
    // Each link is the FULL star row at its own rating (1 star ... 5 stars),
    // stacked so tapping one visually-correct row is a single click, not a
    // picker - simplest thing that works in plain HTML email.
    return `
      <div style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #ece5d6">
        <p style="margin:0 0 10px;font-weight:bold">${escapeHtml(c.name)}</p>
        <div style="display:flex;flex-direction:column;gap:4px">${stars.map(s => `<div>${s}</div>`).join('')}</div>
      </div>
    `;
  }).join('');

  const html = `
    <div style="font-family:sans-serif;color:#1a1714;max-width:480px">
      <h2 style="margin:0 0 6px">☕ ${escapeHtml(customerName)}，上次買的豆子還喜歡嗎？</h2>
      <p style="margin:0 0 20px;color:#4a3c2e">訂單 #${orderId} 大概是一個月前的事了，點一下星星幫這支豆子評分，一秒完成：</p>
      ${coffeeBlocks}
      <p style="margin-top:4px;color:#8a7a68">評分會直接顯示在商品頁的公開評分上，謝謝你的回饋 🙏</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'onebox coffee <order@oneboxcoffee.app>',
        to: [customerEmail],
        subject: `☕ 這支豆子你還喜歡嗎？（訂單 #${orderId}）`,
        html,
      }),
    });
    if (!res.ok) {
      console.error('notifyFeedbackRequest: Resend API error', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('notifyFeedbackRequest: failed to send', err);
    return false;
  }
}
