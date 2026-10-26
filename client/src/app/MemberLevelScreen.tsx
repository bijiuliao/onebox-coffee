import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton } from '../components';
import { useLang } from '../i18n';
import { api } from '../api';
import type { MemberLevel } from '../types';
import { REWARD_OPTIONS } from '../memberLevel';

const EMAIL_STORAGE_KEY = 'onebox-customer-email';

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function MemberLevelScreen() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? localStorage.getItem(EMAIL_STORAGE_KEY) ?? '');
  const [result, setResult] = useState<MemberLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [claiming, setClaiming] = useState(false);

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

  // Re-fetches after a successful pick, which naturally reveals the next
  // unclaimed level if a single order jumped several at once - the
  // customer claims them one at a time rather than all in one screen.
  const claim = async (rewardKey: string) => {
    const em = email.trim();
    if (!result?.unclaimedLevel || claiming) return;
    setClaiming(true);
    try {
      await api.claimMemberReward(em, result.unclaimedLevel, rewardKey);
      const refreshed = await api.getMemberLevel(em);
      setResult(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('memberLevel.claimFailed'));
    } finally {
      setClaiming(false);
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

        {result?.unclaimedLevel && (
          <div className="rise" style={{
            marginTop: 20, borderRadius: 20, padding: '22px 20px',
            background: 'linear-gradient(150deg,#1a1714,#332b22)', textAlign: 'center',
          }}>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#c98a2e' }}>{t('memberLevel.levelUpEyebrow')}</div>
            <div style={{ font: "700 20px 'Iansui',serif", color: '#faf8f3', marginTop: 6 }}>
              {t('memberLevel.levelUpHeading', { level: result.unclaimedLevel })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, textAlign: 'left' }}>
              {REWARD_OPTIONS.map(r => (
                <div
                  key={r.key}
                  onClick={() => claim(r.key)}
                  className="press"
                  style={{
                    cursor: claiming ? 'default' : 'pointer', opacity: claiming ? .5 : 1,
                    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 14, padding: '13px 16px',
                  }}
                >
                  <div style={{ font: "600 14px 'Iansui'", color: '#faf8f3' }}>{r.label}</div>
                  <div style={{ font: "400 11px 'Iansui'", color: 'rgba(250,248,243,.7)', marginTop: 3 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && result.rewards.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 10 }}>{t('memberLevel.rewardHistory')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.rewards.map(r => {
                const option = REWARD_OPTIONS.find(o => o.key === r.rewardKey);
                return (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 12, padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: "600 13px 'Iansui'", color: '#1a1714' }}>Lv.{r.level} · {option?.label ?? r.rewardKey}</div>
                      <div style={{ font: "400 11px 'Space Mono'", color: '#9a8a76', marginTop: 2 }}>{formatTime(r.chosenAt)}</div>
                    </div>
                    <span style={{
                      font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10, flexShrink: 0,
                      background: r.redeemedAt ? '#e3f0e5' : '#f1e9db', color: r.redeemedAt ? '#3f7a4a' : '#8a7a68',
                    }}>{r.redeemedAt ? t('memberLevel.redeemed') : t('memberLevel.pending')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
