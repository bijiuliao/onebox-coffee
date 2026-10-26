import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton } from '../components';
import { useLang } from '../i18n';
import { api } from '../api';
import type { MemberLevel } from '../types';

const EMAIL_STORAGE_KEY = 'onebox-customer-email';

export function MemberLevelScreen() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? localStorage.getItem(EMAIL_STORAGE_KEY) ?? '');
  const [result, setResult] = useState<MemberLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const em = email.trim();
    if (!em) {
      setError(t('memberLevel.needEmail'));
      setResult(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const found = await api.getMemberLevel(em);
      setResult(found);
    } catch {
      setResult(null);
      setError(t('memberLevel.failed'));
    } finally {
      setSearching(false);
    }
  };

  // Arriving here via a link that already carries ?email= (e.g. from the
  // menu header after checkout) searches right away.
  useEffect(() => {
    if (searchParams.get('email')) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPct = result ? Math.max(0, Math.min(100, ((500 - result.toNextLevel) / 500) * 100)) : 0;

  return (
    <MobileShell>
      <div style={{ padding: '20px 22px 60px' }}>
        <BackButton onClick={() => navigate('/menu')} />

        <div style={{ marginTop: 24 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#8a7a68' }}>{t('memberLevel.eyebrow')}</div>
          <div style={{ font: "600 28px 'Iansui',serif", color: '#1a1714', marginTop: 8 }}>{t('memberLevel.heading')}</div>
          <div style={{ font: "400 12px 'Iansui'", color: '#9a8a76', marginTop: 8 }}>{t('memberLevel.hint')}</div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 7, display: 'block' }}>{t('memberLevel.emailLabel')}</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
              type="email"
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2dac9', borderRadius: 12, background: '#fff', font: "400 15px 'Iansui'", color: '#1a1714', outline: 'none' }}
            />
          </div>
          <div
            onClick={search}
            className="press"
            style={{
              cursor: searching ? 'default' : 'pointer', opacity: searching ? .6 : 1, textAlign: 'center',
              marginTop: 4, padding: 14, borderRadius: 14, background: '#1a1714', color: '#faf8f3', font: "600 15px 'Iansui'",
            }}
          >
            {searching ? t('memberLevel.searching') : t('memberLevel.submit')}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 20, font: "400 13px 'Iansui'", color: '#c8342b' }}>{error}</div>
        )}

        {result && (
          <div style={{ marginTop: 28, background: '#fff', border: '1px solid #ece5d6', borderRadius: 18, padding: 24, textAlign: 'center' }}>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>{t('memberLevel.currentLevel')}</div>
            <div style={{ font: "700 48px 'Room205',serif", color: '#c98a2e', marginTop: 8 }}>Lv.{result.level}</div>
            <div style={{ font: "400 13px 'Iansui'", color: '#6b5c4a', marginTop: 6 }}>{t('memberLevel.beansSpent', { amount: result.beansSpent })}</div>

            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 11px 'Space Mono'", color: '#9a8a76', marginBottom: 6 }}>
                <span>Lv.{result.level}</span>
                <span>{t('memberLevel.toNext', { level: result.level + 1, amount: result.toNextLevel })}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: '#f1ece2', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${progressPct}%`, background: '#c98a2e' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
