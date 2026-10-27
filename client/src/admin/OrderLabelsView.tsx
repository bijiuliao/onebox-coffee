import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Coffee, Order } from '../types';

interface Label {
  coffeeName: string;
  detail: string;
  roaster: string;
  origin: string;
}

// One label per physical bag, not per order line - a line's qty is how
// many bags of that size were ordered, and beans get packed and sealed one
// bag at a time with no min/max on how much goes in each, so each bag
// needs its own sticker to match it back to the right order line.
// Roaster/varietal/origin/process aren't stored on the order line itself
// (only name/detail/price are, frozen at checkout) - they're looked up
// live from the coffee's current admin data, same as the labels print
// page's own print-time view of "what this bag actually is" rather than a
// historical snapshot.
function labelsFor(order: Order, coffeesById: Map<string, Coffee>): Label[] {
  const labels: Label[] = [];
  for (const line of order.items) {
    if (line.kind !== 'beans') continue;
    const coffee = line.itemId ? coffeesById.get(line.itemId) : undefined;
    const origin = [coffee?.originEN, coffee?.process, coffee?.varietal].filter(Boolean).join(' · ');
    for (let i = 0; i < line.qty; i++) {
      labels.push({
        coffeeName: line.name.replace(/（豆）$/, ''),
        detail: line.detail,
        roaster: coffee?.roaster ?? '',
        origin,
      });
    }
  }
  return labels;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function OrderLabelsView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [coffees, setCoffees] = useState<Coffee[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listOrders().then(setOrders, err => setError(err.message));
    // all=true so a discontinued/archived bean's details still resolve -
    // an order against it can still need packing and labeling.
    api.listCoffees(true).then(setCoffees, err => setError(err.message));
  }, []);

  const order = orders?.find(o => o.id === Number(id));
  const coffeesById = new Map((coffees ?? []).map(c => [c.id, c]));
  const labels = order && coffees ? labelsFor(order, coffeesById) : [];
  const buyer = order?.customerName || '（未填寫姓名）';

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <div className="no-print" style={{ maxWidth: 900, margin: '0 auto', padding: '24px 30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => navigate('/admin/orders')} className="press" style={{ cursor: 'pointer', font: "600 13px 'Iansui'", color: '#6b5c4a' }}>← 返回訂單</div>
        {labels.length > 0 && (
          <div onClick={() => window.print()} className="press" style={{ cursor: 'pointer', padding: '10px 20px', borderRadius: 10, background: '#1a1714', color: '#faf8f3', font: "600 13px 'Iansui'" }}>
            列印標籤
          </div>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 30px 80px' }}>
        {error && <div className="no-print" style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && (orders === null || coffees === null) && <div className="no-print" style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}
        {orders && coffees && !order && <div className="no-print" style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>找不到這筆訂單</div>}
        {order && coffees && labels.length === 0 && (
          <div className="no-print" style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>這筆訂單沒有豆子品項，不用貼標籤</div>
        )}

        {order && labels.length > 0 && (
          <>
            <div className="no-print" style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 16 }}>
              訂單 #{order.id} · {buyer} · 共 {labels.length} 張標籤
            </div>
            <div className="label-sheet">
              {labels.map((l, i) => (
                <div key={i} className="label-card">
                  <div className="label-coffee">{l.coffeeName}</div>
                  {l.roaster && <div className="label-roaster">{l.roaster}</div>}
                  <div className="label-detail">{l.detail}</div>
                  {l.origin && <div className="label-origin">{l.origin}</div>}
                  <div className="label-divider" />
                  <div className="label-buyer">{buyer}</div>
                  <div className="label-meta">#{order.id} · {formatDate(order.createdAt)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
