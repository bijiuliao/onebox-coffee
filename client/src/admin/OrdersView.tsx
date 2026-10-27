import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Order } from '../types';
import { AdminTopBar } from './AdminTopBar';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

type FulfillFilter = 'pending' | 'fulfilled' | 'all';
type PaidFilter = 'unpaid' | 'paid' | 'all';

export function OrdersView() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FulfillFilter>('pending');
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    api.listOrders().then(setOrders, err => setError(err.message));
  }, []);

  const visible = orders?.filter(o =>
    (filter === 'all' || (filter === 'fulfilled') === o.fulfilled) &&
    (paidFilter === 'all' || (paidFilter === 'paid') === o.paid)
  );

  // Beans-only (not drip/specials) revenue across whatever's currently
  // filtered - e.g. switch to 已付款 to see confirmed bean income so far.
  const beansTotal = (visible ?? []).reduce((sum, o) =>
    sum + o.items.filter(l => l.kind === 'beans').reduce((s, l) => s + l.linePrice, 0), 0);

  async function toggleFulfilled(order: Order) {
    setTogglingId(order.id);
    try {
      const next = !order.fulfilled;
      await api.setOrderFulfilled(order.id, next);
      setOrders(prev => prev && prev.map(o => (o.id === order.id ? { ...o, fulfilled: next } : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗');
    } finally {
      setTogglingId(null);
    }
  }

  async function togglePaid(order: Order) {
    setTogglingId(order.id);
    try {
      const next = !order.paid;
      await api.setOrderPaid(order.id, next);
      setOrders(prev => prev && prev.map(o => (o.id === order.id ? { ...o, paid: next } : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗');
    } finally {
      setTogglingId(null);
    }
  }

  async function removeOrder(order: Order) {
    if (!window.confirm(`確定要刪除訂單 #${order.id}（${order.customerName || '未填寫姓名'}）嗎？這個動作無法復原。`)) return;
    setTogglingId(order.id);
    try {
      await api.deleteOrder(order.id);
      setOrders(prev => prev && prev.filter(o => o.id !== order.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="orders" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>訂單紀錄 / ORDERS</div>
          {orders && <div style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>{visible?.length} 筆</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {([
            { key: 'pending', label: '待出貨' },
            { key: 'fulfilled', label: '已出貨' },
            { key: 'all', label: '全部' },
          ] as const).map(tab => (
            <div
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="press"
              style={{
                cursor: 'pointer', font: "600 12px 'Iansui'", padding: '7px 16px', borderRadius: 20,
                background: filter === tab.key ? '#1a1714' : '#fff',
                color: filter === tab.key ? '#faf8f3' : '#8a7a68',
                border: '1px solid ' + (filter === tab.key ? '#1a1714' : '#ece5d6'),
              }}
            >{tab.label}</div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {([
            { key: 'all', label: '付款：全部' },
            { key: 'unpaid', label: '未付款' },
            { key: 'paid', label: '已付款' },
          ] as const).map(tab => (
            <div
              key={tab.key}
              onClick={() => setPaidFilter(tab.key)}
              className="press"
              style={{
                cursor: 'pointer', font: "600 12px 'Iansui'", padding: '7px 16px', borderRadius: 20,
                background: paidFilter === tab.key ? '#3d6b4f' : '#fff',
                color: paidFilter === tab.key ? '#faf8f3' : '#8a7a68',
                border: '1px solid ' + (paidFilter === tab.key ? '#3d6b4f' : '#ece5d6'),
              }}
            >{tab.label}</div>
          ))}
        </div>

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && orders === null && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {orders && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            還沒有訂單
          </div>
        )}
        {orders && orders.length > 0 && visible?.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            沒有符合的訂單
          </div>
        )}

        {visible && visible.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderRadius: 14, background: '#1a1714', color: '#faf8f3', marginBottom: 20 }}>
            <span style={{ font: "600 13px 'Iansui'" }}>豆子銷售額（目前篩選）</span>
            <span style={{ font: "600 20px 'Room205'" }}>${beansTotal}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {visible?.map(order => (
            <div key={order.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <div style={{ font: "600 15px 'Iansui'" }}>訂單 #{order.id}</div>
                  <div style={{ font: "500 15px 'Room205',serif", color: '#1a1714' }}>{order.customerName || '（未填寫姓名）'}</div>
                  {order.customerEmail && (
                    <span style={{ font: "400 12px 'Space Mono'", color: '#9a8a76' }}>{order.customerEmail}</span>
                  )}
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
                  <span style={{
                    font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10,
                    background: order.paid ? '#e3f0e5' : '#f1e9db',
                    color: order.paid ? '#3f7a4a' : '#8a7a68',
                  }}>{order.paid ? '已付款' : '未付款'}</span>
                </div>
                <div style={{ font: "400 12px 'Space Mono'", color: '#9a8a76' }}>{formatTime(order.createdAt)}</div>
              </div>
              {order.orderType === '外送' && (
                <div style={{ font: "400 12px 'Iansui'", color: '#6b5c4a', marginBottom: 10 }}>
                  距離約 {order.deliveryDistanceKm} 公里 · 運費 ${order.deliveryFee}
                  {order.customerLat != null && order.customerLng != null && (
                    <> · <a href={`https://www.google.com/maps?q=${order.customerLat},${order.customerLng}`} target="_blank" rel="noreferrer" style={{ color: '#2b6f8a', textDecoration: 'underline' }}>在地圖上開啟</a></>
                  )}
                </div>
              )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #ece5d6' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div
                    onClick={() => toggleFulfilled(order)}
                    className="press"
                    style={{
                      cursor: togglingId === order.id ? 'default' : 'pointer',
                      opacity: togglingId === order.id ? 0.5 : 1,
                      font: "600 12px 'Iansui'", padding: '7px 14px', borderRadius: 10,
                      background: order.fulfilled ? '#fff' : '#1a1714',
                      color: order.fulfilled ? '#8a7a68' : '#faf8f3',
                      border: '1px solid ' + (order.fulfilled ? '#ece5d6' : '#1a1714'),
                    }}
                  >{order.fulfilled ? '標記為待出貨' : (order.orderType === '外送' ? '標記為已送達' : '標記為已取走')}</div>
                  <div
                    onClick={() => togglePaid(order)}
                    className="press"
                    style={{
                      cursor: togglingId === order.id ? 'default' : 'pointer',
                      opacity: togglingId === order.id ? 0.5 : 1,
                      font: "600 12px 'Iansui'", padding: '7px 14px', borderRadius: 10,
                      background: order.paid ? '#fff' : '#3d6b4f',
                      color: order.paid ? '#8a7a68' : '#faf8f3',
                      border: '1px solid ' + (order.paid ? '#ece5d6' : '#3d6b4f'),
                    }}
                  >{order.paid ? '標記為未付款' : '標記為已付款'}</div>
                  {order.items.some(l => l.kind === 'beans') && (
                    <div
                      onClick={() => navigate(`/admin/orders/${order.id}/labels`)}
                      className="press"
                      style={{
                        cursor: 'pointer', font: "600 12px 'Iansui'", padding: '7px 14px', borderRadius: 10,
                        background: '#fff', color: '#6b5c4a', border: '1px solid #ece5d6',
                      }}
                    >列印標籤</div>
                  )}
                  <div
                    onClick={() => togglingId === null && removeOrder(order)}
                    className="press"
                    style={{
                      cursor: togglingId === null ? 'pointer' : 'default',
                      opacity: togglingId === order.id ? 0.5 : 1,
                      font: "600 12px 'Iansui'", padding: '7px 14px', borderRadius: 10,
                      background: '#fff', color: '#c8342b', border: '1px solid #ece5d6',
                    }}
                  >刪除</div>
                </div>
                <span style={{ font: "600 17px 'Room205'" }}>${order.total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
