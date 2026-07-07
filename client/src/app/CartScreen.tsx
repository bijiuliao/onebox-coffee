import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton } from '../components';
import { useCart, priceOf } from '../cart';
import { useToast } from '../toast';
import { api } from '../api';

export function CartScreen() {
  const navigate = useNavigate();
  const cart = useCart();
  const { showToast } = useToast();
  const [placing, setPlacing] = useState(false);

  const checkout = async () => {
    if (placing || cart.lines.length === 0) return;
    setPlacing(true);
    try {
      await api.placeOrder(cart.lines.map(l => ({ id: l.coffeeId, temp: l.temp, size: l.size, qty: l.qty })));
      cart.clear();
      showToast('訂單已送出，為你手沖中 ☕');
      navigate('/');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '送出失敗，請再試一次');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <MobileShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 22px 10px', borderBottom: '1px solid #e4ddcd' }}>
        <BackButton onClick={() => navigate('/menu')} />
        <div style={{ font: "600 17px 'Iansui'", color: '#1a1714' }}>購物車</div>
        <div style={{ width: 40 }} />
      </div>

      {cart.lines.length > 0 ? (
        <div>
          <div style={{ padding: '16px 22px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cart.lines.map((l, idx) => (
              <div key={idx} style={{ background: '#fff', border: '1px solid #e9e2d3', borderRadius: 18, padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flex: 'none', background: l.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "500 18px 'Room205',serif", color: '#1a1714' }}>{l.name}</div>
                  <div style={{ font: "400 11px 'Space Mono'", color: '#9a8a76', marginTop: 3 }}>{l.temp} · {l.size}</div>
                  <div style={{ font: "500 15px 'Room205'", color: '#1a1714', marginTop: 6 }}>${priceOf(l.basePrice, l.size) * l.qty}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div onClick={() => cart.dec(idx)} className="press" style={{ cursor: 'pointer', width: 30, height: 30, borderRadius: '50%', background: '#f2ece0', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 16px 'Room205'" }}>−</div>
                  <span style={{ font: "500 16px 'Room205'", minWidth: 16, textAlign: 'center' }}>{l.qty}</span>
                  <div onClick={() => cart.inc(idx)} className="press" style={{ cursor: 'pointer', width: 30, height: 30, borderRadius: '50%', background: '#f2ece0', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 16px 'Room205'" }}>＋</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ margin: '16px 22px 0', background: '#fff', border: '1px solid #e9e2d3', borderRadius: 18, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12 }}>
              <span style={{ font: "400 14px 'Iansui'", color: '#6b5c4a' }}>小計</span>
              <span style={{ font: "500 15px 'Room205'", color: '#1a1714' }}>${cart.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #eee3d3' }}>
              <span style={{ font: "400 14px 'Iansui'", color: '#6b5c4a' }}>取貨方式</span>
              <span style={{ font: "500 14px 'Iansui'", color: '#1a1714' }}>門市自取 · 免費</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14 }}>
              <span style={{ font: "600 15px 'Iansui'", color: '#1a1714' }}>總計</span>
              <span style={{ font: "600 26px 'Room205'", color: '#1a1714' }}>${cart.total}</span>
            </div>
          </div>

          <div style={{ padding: '20px 22px 12px' }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: '#eef2ec', borderRadius: 14, padding: 14 }}>
              <span style={{ font: "600 14px 'Iansui'", color: '#3d6b4f' }}>☕</span>
              <span style={{ font: "400 12px/1.6 'Iansui'", color: '#4a5f4e' }}>現點現沖，預計 <b>8–12 分鐘</b> 完成，我們會在吧台叫號。</span>
            </div>
          </div>

          <div style={{ padding: '6px 22px 34px' }}>
            <div
              onClick={checkout}
              className="press"
              style={{ cursor: placing ? 'default' : 'pointer', opacity: placing ? .6 : 1, background: '#1a1714', color: '#f4f1ea', borderRadius: 20, padding: 19, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ font: "600 16px 'Iansui'" }}>{placing ? '送出中…' : '送出訂單'}</span>
              <span style={{ font: "700 11px 'Space Mono'", letterSpacing: 1, color: '#c98a2e' }}>${cart.total} · PLACE ORDER →</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 40px' }}>
          <div style={{ font: "600 60px 'Room205'", color: '#e0d7c5' }}>∅</div>
          <div style={{ font: "600 20px 'Iansui'", color: '#1a1714', marginTop: 16 }}>箱子還空空的</div>
          <div style={{ font: "400 14px 'Iansui'", color: '#8a7a68', marginTop: 8 }}>挑一支今天的手沖吧</div>
          <div onClick={() => navigate('/menu')} className="press" style={{ cursor: 'pointer', marginTop: 24, background: '#1a1714', color: '#f4f1ea', borderRadius: 16, padding: '14px 28px', font: "600 15px 'Iansui'" }}>去看菜單</div>
        </div>
      )}
    </MobileShell>
  );
}
