import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useLang } from './i18n';
import { useCoffees, useMemberLevel } from './useCoffees';
import { clearStoredEmail, getStoredEmail, setStoredEmail } from './customerSession';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
// How many of the most-recently-added beans to announce in the ticker -
// enough to loop smoothly, not so many it takes forever to repeat.
const TICKER_RECENT_COUNT = 6;

// Black promo marquee above the header - scrolls on a CSS loop (pauses on
// hover), always rendered twice back-to-back so a 50% translateX wraps
// seamlessly regardless of how long the translated copy ends up being.
export function Ticker() {
  const { t, lang } = useLang();
  // Doubles as a "what's new" announcement for newly added beans instead of
  // static evergreen promo copy - sorted newest-createdAt-first, independent
  // of the menu's own sort_order. Falls back to the static messages below
  // while coffees is still loading, or if the list comes back empty, so the
  // ticker is never left showing nothing.
  const { coffees } = useCoffees();
  const recent = coffees
    ? [...coffees].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, TICKER_RECENT_COUNT)
    : [];
  const items = recent.length > 0
    ? recent.map(c => (lang === 'en' ? `New · ${c.originEN} · ${c.name}` : `新上架・${c.originEN}・${c.name}`))
    : TICKER_KEYS.map(k => t(k));
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

// Replaces the old pair of separate "查詢訂單" / "我的等級" header links with
// one button: logged out it reads "登入" and opens an email prompt; once an
// email is remembered (same localStorage key checkout already writes to),
// it shows the customer's level and opens a small menu (level / order
// lookup / log out) instead of making them retype their email every visit.
export function AccountButton() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => getStoredEmail());
  const [open, setOpen] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const { memberLevel } = useMemberLevel(email);

  const login = () => {
    const em = loginInput.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) { setLoginError(true); return; }
    setStoredEmail(em);
    setEmail(em);
    setLoginInput('');
    setLoginError(false);
    setOpen(false);
  };

  const logout = () => {
    clearStoredEmail();
    setEmail('');
    setOpen(false);
  };

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="press"
        role="button"
        style={{
          position: 'relative', height: 40, minWidth: 40, padding: '0 14px', borderRadius: 20,
          background: '#fff', border: '1px solid #e4ddcd',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: "700 12px 'Space Mono'", letterSpacing: .5, color: '#1a1714', whiteSpace: 'nowrap',
        }}
      >
        {email ? (memberLevel ? `Lv.${memberLevel.level}` : '···') : t('account.login')}
        {/* A level-up reward is waiting to be picked (unclaimedLevel set) -
            flagged right on the header button so a customer notices without
            having to think to open the member-level page on their own. */}
        {memberLevel?.unclaimedLevel && (
          <span
            aria-label={t('account.rewardAvailable')}
            style={{
              position: 'absolute', top: -4, right: -4, width: 17, height: 17, borderRadius: '50%',
              background: '#c8342b', color: '#fff', font: "700 11px 'Iansui'",
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #faf8f3',
            }}
          >
            !
          </span>
        )}
      </div>

      {open && createPortal(
        <div className="mobile-shell mobile-shell-wide" style={{ position: 'fixed', inset: 0, margin: '0 auto', zIndex: 45, overflow: 'hidden' }}>
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(26,23,20,.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'absolute', top: 68, right: 20, width: 230, background: '#fff', borderRadius: 16, boxShadow: '0 20px 50px -20px rgba(30,22,16,.4)', overflow: 'hidden' }}>
            {email ? (
              <>
                <AccountMenuRow label={t('memberLevel.entryLink')} onClick={() => { setOpen(false); navigate('/member-level'); }} />
                <AccountMenuRow label={t('lookup.entryLink')} onClick={() => { setOpen(false); navigate('/order-lookup'); }} />
                <AccountMenuRow label={t('account.logout')} onClick={logout} danger />
              </>
            ) : (
              <div style={{ padding: 16 }}>
                <div style={{ font: "600 12px 'Iansui'", color: '#6b5c4a', marginBottom: 10 }}>{t('account.loginHeading')}</div>
                <input
                  value={loginInput}
                  onChange={(e) => { setLoginInput(e.target.value); setLoginError(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') login(); }}
                  type="email"
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1px solid ${loginError ? '#c8342b' : '#e2dac9'}`, borderRadius: 10, font: "400 14px 'Iansui'", color: '#1a1714', outline: 'none' }}
                />
                {loginError && <div style={{ font: "400 11px 'Iansui'", color: '#c8342b', marginTop: 6 }}>{t('account.loginNeedEmail')}</div>}
                <div
                  onClick={login}
                  className="press"
                  style={{ marginTop: 10, textAlign: 'center', padding: 11, borderRadius: 10, background: '#1a1714', color: '#faf8f3', font: "600 13px 'Iansui'", cursor: 'pointer' }}
                >
                  {t('account.loginSubmit')}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function AccountMenuRow({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <div
      onClick={onClick}
      className="press"
      style={{ padding: '13px 16px', font: "600 13px 'Iansui'", color: danger ? '#c8342b' : '#1a1714', cursor: 'pointer', borderBottom: '1px solid #f1ece2' }}
    >
      {label}
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
