import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton, CartButton, LangToggle, NoteChip } from '../components';
import { SHOW_SCORES } from '../constants';
import { useCart, dripPrice } from '../cart';
import { useLang } from '../i18n';
import { useCoffee } from '../useCoffees';
import { useToast } from '../toast';
import type { Size, Temp } from '../types';

type Mode = 'drip' | 'beans';

export function DetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const { t } = useLang();
  const { showToast } = useToast();
  const { coffee } = useCoffee(id);

  const [mode, setMode] = useState<Mode | null>(null);
  const [temp, setTemp] = useState<Temp | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [bagLabel, setBagLabel] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!coffee) return;
    const canDrip = coffee.temps.hot || coffee.temps.ice;
    const canBeans = coffee.sellsBeans && coffee.bagOptions.length > 0;
    const requested = (location.state as { mode?: Mode } | null)?.mode;
    setMode(requested === 'beans' && canBeans ? 'beans' : canDrip ? 'drip' : 'beans');
    setTemp(coffee.temps.hot ? '熱' : '冰');
    setSize(coffee.sizes.std ? '標準' : '大杯');
    setBagLabel(coffee.bagOptions[0]?.label ?? null);
    setQty(1);
  }, [coffee, location.state]);

  if (!coffee || !mode || !temp || !size) {
    return <MobileShell><div style={{ padding: 60, textAlign: 'center', color: '#9a8a76' }}>{t('common.loading')}</div></MobileShell>;
  }

  const soft = coffee.color + '22';
  const canDrip = coffee.temps.hot || coffee.temps.ice;
  const canBeans = coffee.sellsBeans && coffee.bagOptions.length > 0;
  const bag = coffee.bagOptions.find(b => b.label === bagLabel) ?? coffee.bagOptions[0] ?? null;
  const total = (mode === 'beans' ? (bag?.price ?? 0) : dripPrice(coffee.price, size)) * qty;
  const tempOpts: { key: Temp; label: string }[] = [];
  if (coffee.temps.hot) tempOpts.push({ key: '熱', label: t('detail.tempHot') });
  if (coffee.temps.ice) tempOpts.push({ key: '冰', label: t('detail.tempIce') });
  const sizeOpts: { key: Size; label: string }[] = [];
  if (coffee.sizes.std) sizeOpts.push({ key: '標準', label: t('detail.sizeStd') });
  if (coffee.sizes.large) sizeOpts.push({ key: '大杯', label: t('detail.sizeLarge') });

  const specs = [
    { k: t('detail.spec.roaster'), v: coffee.roaster },
    { k: t('detail.spec.process'), v: coffee.process },
    { k: t('detail.spec.altitude'), v: coffee.altitude },
    { k: t('detail.spec.varietal'), v: coffee.varietal },
    { k: t('detail.spec.roast'), v: coffee.roast },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LangToggle translucent />
          <CartButton count={cart.count} onClick={() => navigate('/cart')} translucent />
        </div>
      </div>

      <div style={{ margin: '6px 22px 2px', height: 250, borderRadius: 22, overflow: 'hidden', position: 'relative', background: `linear-gradient(140deg,${soft},#fff)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {coffee.coverUrl ? (
          <img src={coffee.coverUrl} alt={coffee.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
        <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10 }}>{t('detail.tastingNotes')}</div>
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

      {canDrip && canBeans && (
        <div style={{ padding: '22px 24px 0' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div onClick={() => setMode('drip')} className="press" style={seg(mode === 'drip')}>{t('detail.mode.drip')}</div>
            <div onClick={() => setMode('beans')} className="press" style={seg(mode === 'beans')}>{t('detail.mode.beans')}</div>
          </div>
        </div>
      )}

      {mode === 'drip' && (
        <>
          <div style={{ padding: '22px 24px 0' }}>
            <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10 }}>{t('detail.temperature')}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {tempOpts.map(opt => (
                <div key={opt.key} onClick={() => setTemp(opt.key)} className="press" style={seg(temp === opt.key)}>{opt.label}</div>
              ))}
            </div>
          </div>

          <div style={{ padding: '18px 24px 0' }}>
            <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10 }}>{t('detail.size')}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {sizeOpts.map(s => (
                <div key={s.key} onClick={() => setSize(s.key)} className="press" style={seg(size === s.key)}>{s.label}</div>
              ))}
            </div>
          </div>
        </>
      )}

      {mode === 'beans' && (
        <div style={{ padding: '22px 24px 0' }}>
          <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10 }}>{t('detail.weight')}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {coffee.bagOptions.map(b => (
              <div key={b.label} onClick={() => setBagLabel(b.label)} className="press" style={{ ...seg(bagLabel === b.label), flex: 'none', padding: '13px 18px' }}>
                {b.label} · ${b.price}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px 130px' }}>
        <span style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76' }}>{t('common.qty')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div onClick={() => setQty(q => Math.max(1, q - 1))} className="press" style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 20px 'Room205'" }}>−</div>
          <span style={{ font: "500 22px 'Room205'", color: '#1a1714', minWidth: 24, textAlign: 'center' }}>{qty}</span>
          <div onClick={() => setQty(q => q + 1)} className="press" style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 20px 'Room205'" }}>＋</div>
        </div>
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: '14px 24px 24px', background: 'linear-gradient(180deg,rgba(244,241,234,0),#f4f1ea 40%)' }}>
        <div
          onClick={() => {
            if (mode === 'beans') {
              if (!bag) return;
              cart.addBeans(coffee, bag, qty);
            } else {
              cart.addDrip(coffee, temp, size, qty);
            }
            showToast(t('detail.addedToast') + coffee.name);
            navigate('/menu');
          }}
          className="press"
          style={{ cursor: 'pointer', background: '#1a1714', color: '#f4f1ea', borderRadius: 20, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ font: "600 16px 'Iansui'" }}>{t('detail.addToCart')}</span>
          <span style={{ font: "500 18px 'Room205'" }}>${total}</span>
        </div>
      </div>
    </MobileShell>
  );
}
