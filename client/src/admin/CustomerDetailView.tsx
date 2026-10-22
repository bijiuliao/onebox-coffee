import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Customer, Order } from '../types';
import { AdminTopBar } from './AdminTopBar';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function CustomerDetailView() {
  const navigate = useNavigate();
  const { email: rawEmail } = useParams<{ email: string }>();
  const email = decodeURIComponent(rawEmail || '');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listOrders(), api.listCustomers()]).then(
      ([o, c]) => { setOrders(o); setCustomers(c); },
      err => setError(err instanceof Error ? err.message : '載入失敗'),
    );
  }, []);

  const loaded = orders !== null && customers !== null;
  const customer = loaded ? customers.find(c => c.email === email) : undefined;
  // Orders carry no stable customer id - email is the join key everywhere
  // else in this codebase (customers-list.mts groups by it too), so reuse
  // that here rather than introducing a new lookup.
  const myOrders = loaded
    ? orders.filter(o => o.customerEmail === email).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ea', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="customers" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div
          onClick={() => navigate('/admin/customers')}
          className="press"
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, font: "700 11px 'Space Mono'", letterSpacing: 1, color: '#9a8a76', marginBottom: 16 }}
        >
          ← 返回客戶名單
        </div>

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && !loaded && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {loaded && !customer && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            找不到這位客戶
          </div>
        )}

        {loaded && customer && (
          <>
            <div style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "500 20px 'Room205',serif", color: '#1a1714' }}>{customer.name || '（未填寫姓名）'}</div>
                <div style={{ font: "400 13px 'Space Mono'", color: '#9a8a76', marginTop: 4 }}>{customer.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 28, flex: 'none' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>訂單數</div>
                  <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>{customer.orderCount}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>總消費</div>
                  <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>${customer.totalSpent}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>最後上門</div>
                  <div style={{ font: "400 12px 'Space Mono'", color: '#4a3c2e', marginTop: 2 }}>{formatTime(customer.lastOrderAt)}</div>
                </div>
              </div>
            </div>

            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 14 }}>
              訂單紀錄 ({myOrders.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {myOrders.map(order => (
                <div key={order.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <div style={{ font: "600 15px 'Iansui'" }}>訂單 #{order.id}</div>
                      <span style={{
                        font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10,
                        background: order.orderType === '外送' ? '#e2eef2' : '#efe7d8',
                        color: order.orderType === '外送' ? '#2b6f8a' : '#8a7a68',
                      }}>{order.orderType}</span>
                      <span style={{
                        font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10,
                        background: order.fulfilled ? '#e3f0e5' : '#faeee0',
                        color: order.fulfilled ? '#3f7a4a' : '#b5742e',
                      }}>{order.fulfilled ? '已出貨' : '待出貨'}</span>
                    </div>
                    <div style={{ font: "400 12px 'Space Mono'", color: '#9a8a76' }}>{formatTime(order.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {order.items.map((line, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', font: "400 13px 'Iansui'", color: '#4a3c2e' }}>
                        <span>{line.name} × {line.qty}<span style={{ color: '#9a8a76', marginLeft: 8, font: "400 11px 'Space Mono'" }}>{line.detail}</span></span>
                        <span style={{ font: "500 13px 'Room205'" }}>${line.linePrice}</span>
                      </div>
                    ))}
                    {order.orderType === '外送' && order.deliveryFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 13px 'Iansui'", color: '#8a7a68' }}>
                        <span>外送費</span>
                        <span style={{ font: "500 13px 'Room205'" }}>${order.deliveryFee}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '1px solid #ece5d6' }}>
                    <span style={{ font: "600 17px 'Room205'" }}>${order.total}</span>
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
