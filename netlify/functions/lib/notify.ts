interface OrderForNotify {
  id: number;
  customerName: string;
  items: { name: string; qty: number; temp: string; size: string; linePrice: number }[];
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
    .map(l => `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(l.name)} × ${l.qty}</td><td style="padding:4px 0;color:#8a7a68">${escapeHtml(l.temp)} · ${escapeHtml(l.size)}</td><td style="padding:4px 0;text-align:right">$${l.linePrice}</td></tr>`)
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
