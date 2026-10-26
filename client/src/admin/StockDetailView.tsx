import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Coffee, Order } from '../types';
import { AdminTopBar } from './AdminTopBar';
import { parseBagWeightGrams } from '../weight';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function StockDetailView() {
  const navigate = useNavigate();
  const { id: rawId } = useParams<{ id: string }>();
  const id = decodeURIComponent(rawId || '');
  const [coffees, setCoffees] = useState<Coffee[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listCoffees(true), api.listOrders()]).then(
      ([c, o]) => { setCoffees(c); setOrders(o); },
      err => setError(err instanceof Error ? err.message : '載入失敗'),
    );
  }, []);

  const loaded = coffees !== null && orders !== null;
  const coffee = loaded ? coffees.find(c => c.id === id) : undefined;

  // Each entry is one order that bought this coffee's beans, carrying just
  // the matching line(s) from that order - not the order's unrelated items -
  // plus the pre-summed revenue/grams for that order alone, sorted newest
  // first so a recent spike in demand is easy to spot.
  const purchases = loaded
    ? orders
      .map(o => {
        const lines = o.items.filter(l => l.kind === 'beans' && l.itemId === id);
        const revenue = lines.reduce((sum, l) => sum + l.linePrice, 0);
        const grams = lines.reduce((sum, l) => {
          const g = parseBagWeightGrams(l.detail);
          return g !== null ? sum + g * l.qty : sum;
        }, 0);
        return { order: o, lines, revenue, grams };
      })
      .filter(p => p.lines.length > 0)
      .sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt))
    : [];

  const totalRevenue = purchases.reduce((sum, p) => sum + p.revenue, 0);
  const totalGrams = purchases.reduce((sum, p) => sum + p.grams, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="stock" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div
          onClick={() => navigate('/admin/stock')}
          className="press"
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, font: "700 11px 'Space Mono'", letterSpacing: 1, color: '#9a8a76', marginBottom: 16 }}
        >
          ← 返回庫存
        </div>

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && !loaded && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {loaded && !coffee && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            找不到這支豆子
          </div>
        )}

        {loaded && coffee && (
          <>
            <div style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "500 20px 'Room205',serif", color: '#1a1714' }}>{coffee.name}</div>
                <div style={{ font: "400 13px 'Space Mono'", color: '#9a8a76', marginTop: 4 }}>{coffee.roaster || '未設定烘豆商'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 28, flex: 'none' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>剩餘庫存</div>
                  <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>{coffee.stockQty === null ? '未追蹤' : `${coffee.stockQty}g`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>已售出</div>
                  <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>{totalGrams}g</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 90 }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>銷售額</div>
                  <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>${totalRevenue}</div>
                </div>
              </div>
            </div>

            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 14 }}>
              購買紀錄 ({purchases.length})
            </div>

            {purchases.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
                還沒有人買過這支豆子
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {purchases.map(({ order, lines, revenue }) => (
                <div key={order.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                      <div
                        onClick={() => order.customerEmail && navigate(`/admin/customers/${encodeURIComponent(order.customerEmail)}`)}
                        className={order.customerEmail ? 'press' : undefined}
                        style={{ cursor: order.customerEmail ? 'pointer' : 'default', font: "500 15px 'Room205',serif", color: '#1a1714' }}
                      >
                        {order.customerName || '（未填寫姓名）'}
                      </div>
                      {order.customerEmail && (
                        <span style={{ font: "400 12px 'Space Mono'", color: '#9a8a76' }}>{order.customerEmail}</span>
                      )}
                      <span style={{ font: "400 12px 'Space Mono'", color: '#c2b9a6' }}>訂單 #{order.id}</span>
                      <span style={{
                        font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10,
                        background: order.fulfilled ? '#e3f0e5' : '#faeee0',
                        color: order.fulfilled ? '#3f7a4a' : '#b5742e',
                      }}>{order.fulfilled ? '已出貨' : '待出貨'}</span>
                      <span style={{
                        font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10,
                        background: order.paid ? '#e3f0e5' : '#f1e9db',
                        color: order.paid ? '#3f7a4a' : '#8a7a68',
                      }}>{order.paid ? '已付款' : '未付款'}</span>
                    </div>
                    <div style={{ font: "400 12px 'Space Mono'", color: '#9a8a76' }}>{formatTime(order.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {lines.map((line, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', font: "400 13px 'Iansui'", color: '#4a3c2e' }}>
                        <span>{line.detail} × {line.qty}</span>
                        <span style={{ font: "500 13px 'Room205'" }}>${line.linePrice}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '1px solid #ece5d6' }}>
                    <span style={{ font: "600 17px 'Room205'" }}>${revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
