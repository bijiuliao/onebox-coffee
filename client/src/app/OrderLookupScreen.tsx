import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton } from '../components';
import { useLang } from '../i18n';
import { api } from '../api';
import type { Order } from '../types';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function OrderLookupScreen() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get('id') ?? '');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const id = Number(orderId.trim());
    const em = email.trim();
    if (!Number.isInteger(id) || !em) {
      setError(t('lookup.needBoth'));
      setOrder(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const found = await api.lookupOrder(id, em);
      setOrder(found);
    } catch {
      setOrder(null);
      setError(t('lookup.notFound'));
    } finally {
      setSearching(false);
    }
  };

  // Arriving here from the order-success page's link carries both id and
  // email already - search right away instead of making them press the
  // button again for data they just typed moments ago.
  useEffect(() => {
    if (searchParams.get('id') && searchParams.get('email')) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Looked up by id+email pair, not a customer account, so the only status
  // worth surfacing is whether it's been handed over yet (see orders.fulfilled) -
  // matches the pickup/delivery wording already used in OrdersView.
  const fulfilledLabel = order?.orderType === '外送' ? t('lookup.fulfilledDelivery') : t('lookup.fulfilledPickup');

  return (
    <MobileShell>
      <div style={{ padding: '20px 22px 60px' }}>
        <BackButton onClick={() => navigate('/menu')} />

        <div style={{ marginTop: 24 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#8a7a68' }}>{t('lookup.eyebrow')}</div>
          <div style={{ font: "600 28px 'Iansui',serif", color: '#1a1714', marginTop: 8 }}>{t('lookup.heading')}</div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 7, display: 'block' }}>{t('lookup.idLabel')}</label>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder={t('lookup.idPlaceholder')}
              inputMode="numeric"
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2dac9', borderRadius: 12, background: '#fff', font: "400 15px 'Iansui'", color: '#1a1714', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 7, display: 'block' }}>{t('lookup.emailLabel')}</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
              type="email"
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2dac9', borderRadius: 12, background: '#fff', font: "400 15px 'Iansui'", color: '#1a1714', outline: 'none' }}
            />
          </div>
          <div
            onClick={search}
            className="press"
            style={{
              cursor: searching ? 'default' : 'pointer', opacity: searching ? .6 : 1, textAlign: 'center',
              marginTop: 4, padding: 14, borderRadius: 14, background: '#1a1714', color: '#f4f1ea', font: "600 15px 'Iansui'",
            }}
          >
            {searching ? t('lookup.searching') : t('lookup.submit')}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 20, font: "400 13px 'Iansui'", color: '#c8342b' }}>{error}</div>
        )}

        {order && (
          <div style={{ marginTop: 28, background: '#fff', border: '1px solid #ece5d6', borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div style={{ font: "600 17px 'Iansui'" }}>#{order.id}</div>
              <span style={{
                font: "600 12px 'Iansui'", padding: '4px 11px', borderRadius: 10,
                background: order.fulfilled ? '#e3f0e5' : '#faeee0',
                color: order.fulfilled ? '#3f7a4a' : '#b5742e',
              }}>{order.fulfilled ? fulfilledLabel : t('lookup.pending')}</span>
            </div>
            <div style={{ font: "400 12px 'Space Mono'", color: '#9a8a76', marginBottom: 14 }}>{formatTime(order.createdAt)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {order.items.map((line, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', font: "400 14px 'Iansui'", color: '#4a3c2e' }}>
                  <span>{line.name} × {line.qty}<span style={{ color: '#9a8a76', marginLeft: 8, font: "400 11px 'Space Mono'" }}>{line.detail}</span></span>
                  <span style={{ font: "500 14px 'Room205'" }}>${line.linePrice}</span>
                </div>
              ))}
              {order.orderType === '外送' && order.deliveryFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 14px 'Iansui'", color: '#8a7a68' }}>
                  <span>外送費</span>
                  <span style={{ font: "500 14px 'Room205'" }}>${order.deliveryFee}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, paddingTop: 14, borderTop: '1px solid #ece5d6' }}>
              <span style={{ font: "600 19px 'Room205'" }}>${order.total}</span>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
