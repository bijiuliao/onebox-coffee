import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLang } from './i18n';

// Fades/slides a section in once it scrolls into view (and stays revealed -
// the observer disconnects after the first trigger so it never re-hides).
export function Reveal({ children, delay = 0, style, className }: { children: ReactNode; delay?: number; style?: CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        obs.disconnect();
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal${inView ? ' reveal-in' : ''}${className ? ` ${className}` : ''}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

const TICKER_KEYS = ['ticker.msg1', 'ticker.msg2', 'ticker.msg3', 'ticker.msg4'] as const;

// Black promo marquee above the header - scrolls on a CSS loop (pauses on
// hover), always rendered twice back-to-back so a 50% translateX wraps
// seamlessly regardless of how long the translated copy ends up being.
export function Ticker() {
  const { t } = useLang();
  const items = TICKER_KEYS.map(k => t(k));
  const segment = (
    <div className="ticker-seg">
      {items.map((msg, i) => (
        <span key={i}>
          {msg}
          <span style={{ margin: '0 28px', opacity: .45 }}>✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {segment}
        {segment}
      </div>
    </div>
  );
}

export function NoteChip({ label, color, soft }: { label: string; color: string; soft: string }) {
  return (
    <span style={{ padding: '5px 11px', borderRadius: 20, background: soft, color, font: "600 12px 'Iansui'" }}>
      {label}
    </span>
  );
}

export function RoastDots({ level, color }: { level: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < level ? color : '#e2dac9' }} />
      ))}
    </div>
  );
}

export function CartButton({ count, onClick, translucent = false }: { count: number; onClick: () => void; translucent?: boolean }) {
  const { t } = useLang();
  const style: CSSProperties = translucent
    ? { background: 'rgba(255,255,255,.7)' }
    : { background: '#fff', border: '1px solid #e4ddcd' };
  return (
    <div
      onClick={onClick}
      className="press"
      role="button"
      aria-label={count > 0 ? t('a11y.cartCount', { count }) : t('a11y.cartEmpty')}
      style={{
        position: 'relative', width: 40, height: 40, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: "600 16px 'Iansui'", color: '#1a1714', ...style,
      }}
    >
      箱
      {count > 0 && (
        <span
          style={{
            position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px',
            borderRadius: 10, background: '#c8342b', color: '#fff', font: "700 11px 'Space Mono'",
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

export function LangToggle({ translucent = false }: { translucent?: boolean }) {
  const { lang, toggleLang, t } = useLang();
  return (
    <div
      onClick={toggleLang}
      className="press"
      role="button"
      aria-label={t('a11y.langToggle')}
      style={{
        height: 40, minWidth: 40, padding: '0 12px', borderRadius: 20,
        background: translucent ? 'rgba(255,255,255,.7)' : '#fff',
        border: translucent ? undefined : '1px solid #e4ddcd',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: "700 12px 'Space Mono'", letterSpacing: 1, color: '#1a1714',
      }}
    >
      {lang === 'zh' ? 'EN' : '中'}
    </div>
  );
}

export function BackButton({ onClick, translucent = false }: { onClick: () => void; translucent?: boolean }) {
  const { t } = useLang();
  return (
    <div
      onClick={onClick}
      className="press"
      role="button"
      aria-label={t('a11y.back')}
      style={{
        width: 40, height: 40, borderRadius: '50%',
        background: translucent ? 'rgba(255,255,255,.7)' : '#fff',
        border: translucent ? undefined : '1px solid #e4ddcd',
        display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 18px 'Room205'",
      }}
    >
      ←
    </div>
  );
}
