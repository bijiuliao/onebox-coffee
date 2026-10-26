import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Coffee, Customer, Order } from '../types';
import { AdminTopBar } from './AdminTopBar';
import { useToast } from '../toast';
import { getMemberLevel, spendToNextLevel, LEVEL_STEP } from '../memberLevel';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function CustomerDetailView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { email: rawEmail } = useParams<{ email: string }>();
  const email = decodeURIComponent(rawEmail || '');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [coffees, setCoffees] = useState<Coffee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoffeeId, setSelectedCoffeeId] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([api.listOrders(), api.listCustomers(), api.listCoffees()]).then(
      ([o, c, beans]) => {
        setOrders(o); setCustomers(c); setCoffees(beans);
        const sellable = beans.filter(b => b.sellsBeans);
        setSelectedCoffeeId(sellable[0]?.id ?? '');
      },
      err => setError(err instanceof Error ? err.message : '載入失敗'),
    );
  }, []);

  const loaded = orders !== null && customers !== null && coffees !== null;
  const customer = loaded ? customers.find(c => c.email === email) : undefined;
  const sellableCoffees = coffees?.filter(c => c.sellsBeans) ?? [];
  const memberLevel = customer ? getMemberLevel(customer.beansSpent) : null;
  const toNextLevel = customer ? spendToNextLevel(customer.beansSpent) : 0;

  async function sendNotification() {
    if (!selectedCoffeeId || sending) return;
    setSending(true);
    try {
      await api.notifyCustomerNewBean(email, selectedCoffeeId);
      showToast('通知信已寄出');
    } catch (err) {
      showToast(err instanceof Error ? `寄送失敗：${err.message}` : '寄送失敗');
    } finally {
      setSending(false);
    }
  }
  // Orders carry no stable customer id - email is the join key everywhere
  // else in this codebase (customers-list.mts groups by it too), so reuse
  // that here rather than introducing a new lookup.
  const myOrders = loaded
    ? orders.filter(o => o.customerEmail === email).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
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
            <div style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ font: "500 20px 'Room205',serif", color: '#1a1714' }}>{customer.name || '（未填寫姓名）'}</div>
                    <span style={{ font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10, background: '#c98a2e22', color: '#c98a2e', flexShrink: 0 }}>Lv.{memberLevel}</span>
                  </div>
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
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>豆子消費</div>
                    <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>${customer.beansSpent}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 120 }}>
                    <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>最後上門</div>
                    <div style={{ font: "400 12px 'Space Mono'", color: '#4a3c2e', marginTop: 2 }}>{formatTime(customer.lastOrderAt)}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #ece5d6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ font: "600 12px 'Iansui'", color: '#c98a2e' }}>Lv.{memberLevel}</span>
                  <span style={{ font: "400 11px 'Space Mono'", color: '#9a8a76' }}>
                    距離 Lv.{(memberLevel ?? 1) + 1} 還差 ${toNextLevel}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#f1ece2', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${((LEVEL_STEP - toNextLevel) / LEVEL_STEP) * 100}%`,
                    background: '#c98a2e',
                  }} />
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 12 }}>
                寄送新豆通知給這位客戶
              </div>
              {sellableCoffees.length === 0 ? (
                <div style={{ font: "400 13px 'Iansui'", color: '#9a8a76' }}>目前沒有開放零售的豆款可以通知</div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <select
                    value={selectedCoffeeId}
                    onChange={e => setSelectedCoffeeId(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #e2dac9', borderRadius: 10, background: '#fff', font: "400 14px 'Iansui'", color: '#1a1714', outline: 'none' }}
                  >
                    {sellableCoffees.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div
                    onClick={sendNotification}
                    className="press"
                    style={{
                      cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.5 : 1, flex: 'none',
                      padding: '10px 18px', borderRadius: 10, font: "600 13px 'Iansui'", background: '#1a1714', color: '#faf8f3',
                    }}
                  >{sending ? '寄送中…' : '寄送通知'}</div>
                </div>
              )}
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
                      <span style={{
                        font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10,
                        background: order.paid ? '#e3f0e5' : '#f1e9db',
                        color: order.paid ? '#3f7a4a' : '#8a7a68',
                      }}>{order.paid ? '已付款' : '未付款'}</span>
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
