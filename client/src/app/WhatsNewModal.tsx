import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../i18n';

const SEEN_STORAGE_KEY = 'onebox-whats-new-seen';
// Bump this whenever a new batch of customer-facing features ships, to
// show the card again - unrelated to the app's own version/deploys, so a
// routine bug-fix deploy doesn't re-trigger it for everyone.
const WHATS_NEW_VERSION = '2026-10-level-rewards';

const ITEMS = [
  { titleKey: 'whatsNew.leaderboardTitle', descKey: 'whatsNew.leaderboardDesc' },
  { titleKey: 'whatsNew.levelTitle', descKey: 'whatsNew.levelDesc' },
  { titleKey: 'whatsNew.rewardTitle', descKey: 'whatsNew.rewardDesc' },
  { titleKey: 'whatsNew.loginTitle', descKey: 'whatsNew.loginDesc' },
] as const;

// A one-time card shown the next time a customer lands on the menu after a
// batch of new features ships - purely a "here's what changed" notice, not
// tied to login/email, so it's gated on its own localStorage flag rather
// than anything account-related.
export function WhatsNewModal() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SEEN_STORAGE_KEY) !== WHATS_NEW_VERSION) setOpen(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(SEEN_STORAGE_KEY, WHATS_NEW_VERSION);
    setOpen(false);
  };

  if (!open) return null;

  return createPortal(
    <div className="mobile-shell mobile-shell-wide" style={{ position: 'fixed', inset: 0, margin: '0 auto', zIndex: 50, overflow: 'hidden' }}>
      <div onClick={dismiss} style={{ position: 'absolute', inset: 0, background: 'rgba(26,23,20,.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
      <div className="rise" style={{
        position: 'absolute', left: 20, right: 20, bottom: 24, background: '#faf8f3', borderRadius: 22, padding: '26px 24px 22px',
        boxShadow: '0 30px 60px -20px rgba(30,22,16,.5)',
      }}>
        <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#c98a2e' }}>{t('whatsNew.eyebrow')}</div>
        <div style={{ font: "700 22px 'Iansui',serif", color: '#1a1714', marginTop: 8, marginBottom: 20 }}>{t('whatsNew.heading')}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ITEMS.map(item => (
            <div key={item.titleKey} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: '#c98a2e', marginTop: 7 }} />
              <div>
                <div style={{ font: "600 14px 'Iansui'", color: '#1a1714' }}>{t(item.titleKey)}</div>
                <div style={{ font: "400 12px 'Iansui'", color: '#8a7a68', marginTop: 3 }}>{t(item.descKey)}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          onClick={dismiss}
          className="press"
          style={{ marginTop: 24, textAlign: 'center', padding: 14, borderRadius: 14, background: '#1a1714', color: '#faf8f3', font: "600 15px 'Iansui'", cursor: 'pointer' }}
        >
          {t('whatsNew.dismiss')}
        </div>
      </div>
    </div>,
    document.body,
  );
}
