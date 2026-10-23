import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../toast';

export function AdminTopBar({ active }: { active: 'beans' | 'specials' | 'orders' | 'reviews' | 'customers' | 'stock' | 'notify-beans' }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [dripEnabled, setDripEnabled] = useState<boolean | null>(null);
  const [togglingDrip, setTogglingDrip] = useState(false);

  useEffect(() => {
    api.getSettings().then(s => setDripEnabled(s.dripEnabled), () => {});
  }, []);

  async function sendTestEmail() {
    if (sending) return;
    setSending(true);
    try {
      const res = await api.sendTestEmail();
      showToast(`測試信已寄出 → ${res.sentTo}`);
    } catch (err) {
      showToast(err instanceof Error ? `寄送失敗：${err.message}` : '寄送失敗');
    } finally {
      setSending(false);
    }
  }

  async function toggleDrip() {
    if (dripEnabled === null || togglingDrip) return;
    const next = !dripEnabled;
    setTogglingDrip(true);
    try {
      const s = await api.updateSettings({ dripEnabled: next });
      setDripEnabled(s.dripEnabled);
      showToast(s.dripEnabled ? '手沖供應已開啟' : '手沖供應已暫停');
    } catch (err) {
      showToast(err instanceof Error ? `更新失敗：${err.message}` : '更新失敗');
    } finally {
      setTogglingDrip(false);
    }
  }

  const navStyle = (isActive: boolean) => ({
    cursor: 'pointer',
    font: "700 11px 'Space Mono'",
    letterSpacing: 1,
    color: isActive ? '#f4f1ea' : '#8a7a68',
    borderBottom: isActive ? '2px solid #c98a2e' : '2px solid transparent',
    paddingBottom: 4,
  });

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 30, height: 62, background: '#1a1714', color: '#f4f1ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ font: "500 22px 'Room205',serif" }}>onebox<span style={{ color: '#c98a2e' }}>.</span></div>
        <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#c98a2e', border: '1px solid rgba(201,154,106,.5)', padding: '4px 9px', borderRadius: 6 }}>ADMIN</div>
        <div
          onClick={sendTestEmail}
          className="press"
          style={{ cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.5 : 1, font: "600 10px 'Iansui'", color: '#8a7a68', textDecoration: 'underline', whiteSpace: 'nowrap' }}
        >{sending ? '寄送中…' : '寄測試信'}</div>
        {dripEnabled !== null && (
          <div
            onClick={toggleDrip}
            className="press"
            style={{
              cursor: togglingDrip ? 'default' : 'pointer', opacity: togglingDrip ? 0.5 : 1, whiteSpace: 'nowrap',
              font: "700 10px 'Space Mono'", letterSpacing: 1, padding: '5px 10px', borderRadius: 8,
              background: dripEnabled ? 'rgba(61,107,79,.18)' : 'rgba(200,52,43,.18)',
              color: dripEnabled ? '#6fae84' : '#e0897f',
            }}
          >{dripEnabled ? '● 手沖供應中' : '○ 手沖已暫停'}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div onClick={() => navigate('/admin')} className="press" style={navStyle(active === 'beans')}>豆款管理</div>
        <div onClick={() => navigate('/admin/specials')} className="press" style={navStyle(active === 'specials')}>特調管理</div>
        <div onClick={() => navigate('/admin/orders')} className="press" style={navStyle(active === 'orders')}>訂單 ORDERS</div>
        <div onClick={() => navigate('/admin/stock')} className="press" style={navStyle(active === 'stock')}>庫存 STOCK</div>
        <div onClick={() => navigate('/admin/customers')} className="press" style={navStyle(active === 'customers')}>客戶 CUSTOMERS</div>
        <div onClick={() => navigate('/admin/reviews')} className="press" style={navStyle(active === 'reviews')}>評分 REVIEWS</div>
        <div onClick={() => navigate('/admin/notify-beans')} className="press" style={navStyle(active === 'notify-beans')}>新豆公告</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#c98a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "600 14px 'Iansui'", color: '#1a1714' }}>主</div>
          <span style={{ font: "500 13px 'Iansui'" }}>店長</span>
        </div>
      </div>
    </div>
  );
}
