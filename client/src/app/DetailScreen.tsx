import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton, CartButton, LangToggle, NoteChip, Reveal } from '../components';
import { SHOW_SCORES } from '../constants';
import { isSoldOut, useCart, dripPrice } from '../cart';
import { useLang } from '../i18n';
import { useCoffee } from '../useCoffees';
import { useToast } from '../toast';
import type { Size, Temp } from '../types';

type Mode = 'drip' | 'beans';

// A real rotating 3D box (not a photo sequence - onyx renders theirs from an
// actual 360deg photo shoot per product, which onebox doesn't have). The box
// shape/geometry is the same for every coffee; only the front-face image
// (the coffee's own cover photo) changes, so dragging actually spins a real
// cuboid rather than faking a tilt on a flat photo.
function RotatingBox({ src, alt, placeholderLabel, color }: { src: string | null; alt: string; placeholderLabel: string; color: string }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const rotationAtDragStart = useRef(0);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const depth = width * 0.16;

  const face = src ? (
    <img src={src} alt={alt} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(140deg,${color}22,#fff)` }}>
      <span style={{ font: "700 11px 'Space Mono'", letterSpacing: 2, color, opacity: .7 }}>{placeholderLabel}</span>
    </div>
  );

  return (
    <div
      ref={sceneRef}
      onPointerDown={(e) => {
        setDragging(true);
        dragStartX.current = e.clientX;
        rotationAtDragStart.current = rotation;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        setRotation(rotationAtDragStart.current + (e.clientX - dragStartX.current) / 2.4);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      style={{ width: '100%', height: '100%', perspective: 1400, cursor: 'grab', touchAction: 'pan-y' }}
    >
      <div style={{
        position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
        transform: `rotateY(${rotation}deg)`, transition: dragging ? 'none' : 'transform .4s cubic-bezier(.2,.8,.2,1)',
      }}>
        {/* Front sits at z=0 - the hinge plane the left/right walls pivot off of. */}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', overflow: 'hidden' }}>
          {face}
        </div>
        {/* Back sits depth behind the front, connected by the two side walls. */}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: `translateZ(${-depth}px)`, background: `linear-gradient(160deg,${color}33,${color}11)` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: depth, transformOrigin: 'left', transform: 'rotateY(-90deg)', backfaceVisibility: 'hidden', background: color, opacity: .85 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: depth, transformOrigin: 'right', transform: 'rotateY(90deg)', backfaceVisibility: 'hidden', background: color, opacity: .7 }} />
      </div>
    </div>
  );
}

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
  // Same specs, laid out flanking the circular wheel on desktop - origin
  // joins the set here since the wheel is self-contained (unlike the simple
  // list, which leaves it to the eyebrow line above the title).
  const wheelLeft = [
    { k: t('detail.spec.roaster'), v: coffee.roaster },
    { k: t('detail.spec.process'), v: coffee.process },
    { k: t('detail.spec.altitude'), v: coffee.altitude },
  ];
  const wheelRight = [
    { k: t('detail.spec.varietal'), v: coffee.varietal },
    { k: t('detail.spec.roast'), v: coffee.roast },
    { k: t('detail.spec.origin'), v: coffee.originEN },
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

      <div
        key={`${coffee.id}-cover`}
        className="rise-from-below"
        style={{ animationDelay: '.2s', margin: '22px 0 0', aspectRatio: '4 / 5', position: 'relative' }}
      >
        <RotatingBox src={coffee.coverUrl} alt={coffee.name} placeholderLabel={`${coffee.originEN} · ${coffee.name}`} color={coffee.color} />
        <span style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: coffee.color, opacity: .65, pointerEvents: 'none' }}>
          ↔ {t('detail.tiltHint')}
        </span>
      </div>

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

      <Reveal className="spec-list-simple" style={{ margin: '20px 24px 0', background: 'rgba(255,255,255,.6)', borderRadius: 18, padding: '6px 18px' }}>
        {specs.map(s => (
          <div key={s.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid rgba(26,23,20,.08)' }}>
            <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>{s.k}</span>
            <span style={{ font: "500 14px 'Iansui'", color: '#1a1714' }}>{s.v || '—'}</span>
          </div>
        ))}
      </Reveal>

      {/* Desktop-only: the same specs laid out around a circle, borrowed
          from onyx coffee lab's product-page "spec wheel". */}
      <Reveal className="spec-wheel" style={{ margin: '48px 0 0', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, margin: '0 auto', width: 'fit-content' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
            {wheelLeft.map(s => (
              <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', textAlign: 'right' }}>
                <div>
                  <div style={{ font: "500 15px 'Iansui'", color: '#1a1714' }}>{s.v || '—'}</div>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76', marginTop: 3 }}>{s.k}</div>
                </div>
                <span style={{ width: 26, height: 1, background: 'rgba(26,23,20,.25)', flex: 'none' }} />
              </div>
            ))}
          </div>

          <div style={{
            width: 300, height: 300, borderRadius: '50%', flex: 'none', border: `1px solid ${coffee.color}66`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 36,
          }}>
            <div style={{ font: "600 34px 'Room205',serif", color: '#1a1714' }}>{coffee.roast}</div>
            <div style={{ font: "400 13px/1.7 'Iansui'", color: '#6b5c4a', marginTop: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
              {coffee.desc}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
            {wheelRight.map(s => (
              <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 26, height: 1, background: 'rgba(26,23,20,.25)', flex: 'none' }} />
                <div>
                  <div style={{ font: "500 15px 'Iansui'", color: '#1a1714' }}>{s.v || '—'}</div>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76', marginTop: 3 }}>{s.k}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
