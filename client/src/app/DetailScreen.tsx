import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton, CartButton, LangToggle, NoteChip, Reveal } from '../components';
import { SHOW_SCORES } from '../constants';
import { isSoldOut, useCart, dripPrice } from '../cart';
import { useLang } from '../i18n';
import { useCoffee } from '../useCoffees';
import { useToast } from '../toast';
import type { Size, Temp } from '../types';
import { BoxStatsHero } from './BoxStatsHero';

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

  // Carries the tab the customer came from (手沖咖啡/買豆子/過往豆單) back to
  // the menu, so returning lands on that tab instead of always 手沖咖啡.
  const fromCategory = (location.state as { fromCategory?: string } | null)?.fromCategory;
  const backToMenu = fromCategory ? { state: { category: fromCategory } } : undefined;

  const soft = coffee.color + '22';
  const soldOut = isSoldOut(coffee);
  const unavailable = coffee.archived || soldOut;
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
    <MobileShell style={{ background: soft }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 22px 6px' }}>
        <BackButton onClick={() => navigate('/menu', backToMenu)} translucent />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LangToggle translucent />
          <CartButton count={cart.count} onClick={() => navigate('/cart')} translucent />
        </div>
      </div>

      {/* HERO: giant title first, then the cover photo rises in underneath it - */}
      {/* ordering/scale borrowed from onyxcoffeelab.com's product pages. */}
      <div style={{ padding: '28px 22px 0' }}>
        <div key={`${coffee.id}-origin`} className="slide-in-left" style={{ font: "700 11px 'Space Mono'", letterSpacing: 3, color: coffee.color }}>{coffee.originEN}</div>
        <div
          key={`${coffee.id}-name`}
          className="slide-in-left"
          style={{ animationDelay: '.07s', font: "600 clamp(42px,15vw,80px)/.98 'Room205',serif", color: '#1a1714', marginTop: 10, wordBreak: 'break-word' }}
        >
          {coffee.name}
        </div>
        {coffee.notes.length > 0 && (
          <div key={`${coffee.id}-notes-line`} className="slide-in-left" style={{ animationDelay: '.14s', font: "700 11px 'Space Mono'", letterSpacing: 1.5, color: '#8a7a68', marginTop: 16 }}>
            {coffee.notes.map((n, i) => (
              <span key={n}>
                {n}
                {i < coffee.notes.length - 1 && <span style={{ color: '#d3c9b6', margin: '0 9px' }}>|</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      <BoxStatsHero
        src={coffee.coverUrl}
        color={coffee.color}
        placeholderLabel={`${coffee.originEN} · ${coffee.name}`}
        tiltHint={t('detail.tiltHint')}
        roastLabel={coffee.roast}
        desc={coffee.desc}
      />

      <Reveal style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {coffee.archived ? (
            <span style={{ padding: '5px 12px', borderRadius: 20, background: '#1a1714', color: '#fff', font: "700 12px 'Space Mono'" }}>{t('stock.discontinued')}</span>
          ) : soldOut && (
            <span style={{ padding: '5px 12px', borderRadius: 20, background: '#1a1714', color: '#fff', font: "700 12px 'Space Mono'" }}>{t('stock.soldOut')}</span>
          )}
          {SHOW_SCORES && (
            <span style={{ padding: '5px 12px', borderRadius: 20, background: coffee.color, color: '#fff', font: "700 12px 'Space Mono'" }}>
              ⌾ CUP {coffee.score}
            </span>
          )}
          <span style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(26,23,20,.06)', font: "600 12px 'Iansui'", color: '#4a3c2e' }}>{coffee.roast}</span>
        </div>
        <div style={{ font: "400 15px/1.9 'Iansui'", color: '#4a3c2e', marginTop: 18 }}>{coffee.desc}</div>
      </Reveal>

      <Reveal style={{ padding: '22px 24px 4px' }}>
        <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10 }}>{t('detail.tastingNotes')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {coffee.notes.map(n => <NoteChip key={n} label={n} color={coffee.color} soft={soft} />)}
        </div>
      </Reveal>

      <Reveal style={{ margin: '20px 24px 0', background: 'rgba(255,255,255,.6)', borderRadius: 18, padding: '6px 18px' }}>
        {specs.map(s => (
          <div key={s.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid rgba(26,23,20,.08)' }}>
            <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>{s.k}</span>
            <span style={{ font: "500 14px 'Iansui'", color: '#1a1714' }}>{s.v || '—'}</span>
          </div>
        ))}
      </Reveal>

      {canDrip && canBeans && (
        <Reveal style={{ padding: '22px 24px 0' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div onClick={() => setMode('drip')} className="press" style={seg(mode === 'drip')}>{t('detail.mode.drip')}</div>
            <div onClick={() => setMode('beans')} className="press" style={seg(mode === 'beans')}>{t('detail.mode.beans')}</div>
          </div>
        </Reveal>
      )}

      {mode === 'drip' && (
        <Reveal>
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
        </Reveal>
      )}

      {mode === 'beans' && (
        <Reveal style={{ padding: '22px 24px 0' }}>
          <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10 }}>{t('detail.weight')}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {coffee.bagOptions.map(b => (
              <div key={b.label} onClick={() => setBagLabel(b.label)} className="press" style={{ ...seg(bagLabel === b.label), flex: 'none', padding: '13px 18px' }}>
                {b.label} · ${b.price}
              </div>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal style={{ padding: '22px 24px 130px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76' }}>{t('common.qty')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div onClick={() => setQty(q => Math.max(1, q - 1))} className="press" style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 20px 'Room205'" }}>−</div>
            <span style={{ font: "500 22px 'Room205'", color: '#1a1714', minWidth: 24, textAlign: 'center' }}>{qty}</span>
            <div onClick={() => setQty(q => q + 1)} className="press" style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 20px 'Room205'" }}>＋</div>
          </div>
        </div>
      </Reveal>

      <div style={{ position: 'sticky', bottom: 0, padding: '14px 24px 24px', background: `linear-gradient(180deg,${coffee.color}00,${soft} 40%)` }}>
        <div
          onClick={() => {
            if (unavailable) return;
            if (mode === 'beans') {
              if (!bag) return;
              cart.addBeans(coffee, bag, qty);
            } else {
              cart.addDrip(coffee, temp, size, qty);
            }
            showToast(t('detail.addedToast') + coffee.name);
            navigate('/menu', backToMenu);
          }}
          className="press"
          style={{
            cursor: unavailable ? 'default' : 'pointer', opacity: unavailable ? .5 : 1,
            background: '#1a1714', color: '#f4f1ea', borderRadius: 20, padding: '18px 22px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span style={{ font: "600 16px 'Iansui'" }}>{coffee.archived ? t('stock.discontinued') : soldOut ? t('stock.soldOut') : t('detail.addToCart')}</span>
          <span style={{ font: "500 18px 'Room205'" }}>${total}</span>
        </div>
      </div>
    </MobileShell>
  );
}
