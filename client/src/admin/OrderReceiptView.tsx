import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Order } from '../types';
import { BRAND_NAME } from '../constants';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function OrderReceiptView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listOrders().then(setOrders, err => setError(err.message));
  }, []);

  const order = orders?.find(o => o.id === Number(id));
  const deliveryFee = order?.orderType === '外送' ? order.deliveryFee : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <div className="no-print" style={{ maxWidth: 420, margin: '0 auto', padding: '24px 30px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => navigate('/admin/orders')} className="press" style={{ cursor: 'pointer', font: "600 13px 'Iansui'", color: '#6b5c4a' }}>← 返回訂單</div>
        {order && (
          <div onClick={() => window.print()} className="press" style={{ cursor: 'pointer', padding: '10px 20px', borderRadius: 10, background: '#1a1714', color: '#faf8f3', font: "600 13px 'Iansui'" }}>
            列印收據
          </div>
        )}
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 30px 80px' }}>
        {error && <div className="no-print" style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && orders === null && <div className="no-print" style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}
        {orders && !order && <div className="no-print" style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>找不到這筆訂單</div>}

        {order && (
          <div className="receipt-card">
            <div className="receipt-brand">{BRAND_NAME}<span style={{ color: '#c98a2e' }}>.</span></div>
            <div className="receipt-sub">RECEIPT · 收據</div>
            <div className="receipt-divider" />

            <div className="receipt-row"><span>訂單編號</span><span>#{order.id}</span></div>
            <div className="receipt-row"><span>日期</span><span>{formatDateTime(order.createdAt)}</span></div>
            <div className="receipt-row"><span>購買人</span><span>{order.customerName || '（未填寫姓名）'}</span></div>
            {order.customerEmail && <div className="receipt-row"><span>Email</span><span>{order.customerEmail}</span></div>}
            <div className="receipt-row"><span>方式</span><span>{order.orderType}</span></div>
            <div className="receipt-row"><span>付款狀態</span><span>{order.paid ? '已付款' : '未付款'}</span></div>

            <div className="receipt-divider" />

            <div className="receipt-items">
              {order.items.map((line, i) => (
                <div key={i} className="receipt-item">
                  <div className="receipt-item-left">
                    <div className="receipt-item-name">{line.name} × {line.qty}</div>
                    {line.detail && <div className="receipt-item-detail">{line.detail}</div>}
                  </div>
                  <div className="receipt-item-price">${line.linePrice}</div>
                </div>
              ))}
              {deliveryFee > 0 && (
                <div className="receipt-item">
                  <div className="receipt-item-left"><div className="receipt-item-name">外送費</div></div>
                  <div className="receipt-item-price">${deliveryFee}</div>
                </div>
              )}
            </div>

            <div className="receipt-divider" />
            <div className="receipt-total"><span>總計</span><span>${order.total}</span></div>
            <div className="receipt-footer">謝謝惠顧 · Thank you</div>
          </div>
        )}
      </div>
    </div>
  );
}
