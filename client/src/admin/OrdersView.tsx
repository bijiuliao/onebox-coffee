import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Order } from '../types';
import { AdminTopBar } from './AdminTopBar';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function OrdersView() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listOrders().then(setOrders, err => setError(err.message));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ea', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="orders" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>訂單紀錄 / ORDERS</div>
          {orders && <div style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>{orders.length} 筆</div>}
        </div>

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && orders === null && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {orders && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            還沒有訂單
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders?.map(order => (
            <div key={order.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <div style={{ font: "600 15px 'Iansui'" }}>訂單 #{order.id}</div>
                  <div style={{ font: "500 15px 'Room205',serif", color: '#1a1714' }}>{order.customerName || '（未填寫姓名）'}</div>
                  <span style={{
                    font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10,
                    background: order.orderType === '外送' ? '#e2eef2' : '#efe7d8',
                    color: order.orderType === '外送' ? '#2b6f8a' : '#8a7a68',
                  }}>{order.orderType}</span>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '1px solid #ece5d6' }}>
                <span style={{ font: "600 17px 'Room205'" }}>${order.total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
