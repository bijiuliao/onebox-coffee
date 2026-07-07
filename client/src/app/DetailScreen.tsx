import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton, CartButton, NoteChip } from '../components';
import { SHOW_SCORES } from '../constants';
import { useCart, priceOf } from '../cart';
import { useCoffee } from '../useCoffees';
import { useToast } from '../toast';
import type { Size, Temp } from '../types';

export function DetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cart = useCart();
  const { showToast } = useToast();
  const { coffee } = useCoffee(id);

  const [temp, setTemp] = useState<Temp | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!coffee) return;
    setTemp(coffee.temps.hot ? '熱' : '冰');
    setSize(coffee.sizes.std ? '標準' : '大杯');
    setQty(1);
  }, [coffee]);

  if (!coffee || !temp || !size) {
    return <MobileShell><div style={{ padding: 60, textAlign: 'center', color: '#9a8a76' }}>載入中…</div></MobileShell>;
  }

  const soft = coffee.color + '22';
  const total = priceOf(coffee.price, size) * qty;
  const tempOpts: { key: Temp; label: string }[] = [];
  if (coffee.temps.hot) tempOpts.push({ key: '熱', label: '熱手沖' });
  if (coffee.temps.ice) tempOpts.push({ key: '冰', label: '冰手沖' });
  const sizeOpts: { key: Size; label: string }[] = [];
  if (coffee.sizes.std) sizeOpts.push({ key: '標準', label: '標準' });
  if (coffee.sizes.large) sizeOpts.push({ key: '大杯', label: '大杯 +$20' });

  const specs = [
    { k: 'ROASTER 烘豆商', v: coffee.roaster },
    { k: 'PROCESS 處理法', v: coffee.process },
    { k: 'ALTITUDE 海拔', v: coffee.altitude },
    { k: 'VARIETAL 品種', v: coffee.varietal },
    { k: 'ROAST 烘焙', v: coffee.roast },
  ];

  const seg = (active: boolean) => ({
    flex: 1, cursor: 'pointer', textAlign: 'center' as const, padding: 13, borderRadius: 14, font: "600 14px 'Iansui'",
    background: active ? coffee.color : 'rgba(255,255,255,.7)',
    color: active ? '#fff' : '#4a3c2e',
  });

  return (
    <MobileShell style={{ background: `linear-gradient(180deg,${soft} 0%,#f4f1ea 62%)` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 22px 6px' }}>
        <BackButton onClick={() => navigate('/menu')} translucent />
        <CartButton count={cart.count} onClick={() => navigate('/cart')} translucent />
      </div>

      <div style={{ margin: '6px 22px 2px', height: 250, borderRadius: 22, overflow: 'hidden', position: 'relative', background: `linear-gradient(140deg,${soft},#fff)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {coffee.coverUrl ? (
          <img src={coffee.coverUrl} alt={coffee.name + ' 豆袋封面'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ font: "700 11px 'Space Mono'", letterSpacing: 2, color: coffee.color, opacity: .7 }}>{coffee.originEN} · {coffee.name}</span>
        )}
      </div>

      <div style={{ padding: '18px 24px 4px' }}>
        <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: coffee.color }}>{coffee.originEN}</div>
        <div style={{ font: "500 44px/1.05 'Room205',serif", color: '#1a1714', marginTop: 12 }}>{coffee.name}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {SHOW_SCORES && (
            <span style={{ padding: '5px 12px', borderRadius: 20, background: coffee.color, color: '#fff', font: "700 12px 'Space Mono'" }}>
              ⌾ CUP {coffee.score}
            </span>
          )}
          <span style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(26,23,20,.06)', font: "600 12px 'Iansui'", color: '#4a3c2e' }}>{coffee.roast}</span>
        </div>
        <div style={{ font: "400 15px/1.9 'Iansui'", color: '#4a3c2e', marginTop: 18 }}>{coffee.desc}</div>
      </div>

      <div style={{ padding: '22px 24px 4px' }}>
        <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10 }}>TASTING NOTES · 風味</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {coffee.notes.map(n => <NoteChip key={n} label={n} color={coffee.color} soft={soft} />)}
        </div>
      </div>

      <div style={{ margin: '20px 24px 0', background: 'rgba(255,255,255,.6)', borderRadius: 18, padding: '6px 18px' }}>
        {specs.map(s => (
          <div key={s.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid rgba(26,23,20,.08)' }}>
            <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>{s.k}</span>
            <span style={{ font: "500 14px 'Iansui'", color: '#1a1714' }}>{s.v || '—'}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '22px 24px 0' }}>
        <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10 }}>溫度</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tempOpts.map(t => (
            <div key={t.key} onClick={() => setTemp(t.key)} className="press" style={seg(temp === t.key)}>{t.label}</div>
          ))}
        </div>
      </div>

      <div style={{ padding: '18px 24px 0' }}>
        <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10 }}>份量</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {sizeOpts.map(s => (
            <div key={s.key} onClick={() => setSize(s.key)} className="press" style={seg(size === s.key)}>{s.label}</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px 130px' }}>
        <span style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76' }}>數量</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div onClick={() => setQty(q => Math.max(1, q - 1))} className="press" style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 20px 'Room205'" }}>−</div>
          <span style={{ font: "500 22px 'Room205'", color: '#1a1714', minWidth: 24, textAlign: 'center' }}>{qty}</span>
          <div onClick={() => setQty(q => q + 1)} className="press" style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 20px 'Room205'" }}>＋</div>
        </div>
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: '14px 24px 24px', background: 'linear-gradient(180deg,rgba(244,241,234,0),#f4f1ea 40%)' }}>
        <div
          onClick={() => {
            cart.addLine(coffee, temp, size, qty);
            showToast('已加入 · ' + coffee.name);
            navigate('/menu');
          }}
          className="press"
          style={{ cursor: 'pointer', background: '#1a1714', color: '#f4f1ea', borderRadius: 20, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ font: "600 16px 'Iansui'" }}>加入購物車</span>
          <span style={{ font: "500 18px 'Room205'" }}>${total}</span>
        </div>
      </div>
    </MobileShell>
  );
}
