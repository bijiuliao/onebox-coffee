import { useNavigate } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton } from '../components';
import { useLang } from '../i18n';
import { useLeaderboard } from '../useCoffees';

// Top-3 get a colored rank badge (gold/silver/bronze-ish, matching the
// existing warm palette) instead of the plain numbered circle everyone
// else gets - the only "gamified" touch, no medal emoji per the site's
// usual typographic style.
const RANK_COLORS: Record<number, string> = { 1: '#c98a2e', 2: '#8a7a68', 3: '#8a5a3a' };

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { leaderboard } = useLeaderboard();

  return (
    <MobileShell>
      <div style={{ padding: '20px 22px 60px' }}>
        <BackButton onClick={() => navigate('/menu')} />

        <div style={{ marginTop: 24 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#8a7a68' }}>{t('leaderboard.eyebrow')}</div>
          <div style={{ font: "600 28px 'Iansui',serif", color: '#1a1714', marginTop: 8 }}>{t('leaderboard.heading')}</div>
          <div style={{ font: "400 12px 'Iansui'", color: '#9a8a76', marginTop: 8 }}>{t('leaderboard.hint')}</div>
        </div>

        {leaderboard === null && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>{t('common.loading')}</div>
        )}
        {leaderboard?.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>{t('leaderboard.empty')}</div>
        )}

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {leaderboard?.map(entry => (
            <div
              key={entry.rank}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, background: '#fff',
                border: '1px solid #ece5d6', borderRadius: 16, padding: '13px 16px',
              }}
            >
              <span style={{
                flex: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: RANK_COLORS[entry.rank] ?? '#f1ece2', color: RANK_COLORS[entry.rank] ? '#fff' : '#8a7a68',
                font: "700 13px 'Space Mono'",
              }}>
                {entry.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 15px 'Iansui'", color: '#1a1714' }}>{entry.name}</div>
                <div style={{ font: "400 11px 'Space Mono'", color: '#9a8a76', marginTop: 2 }}>{t('leaderboard.orderCount', { count: entry.orderCount })}</div>
              </div>
              <span style={{ font: "600 17px 'Room205',serif", color: '#1a1714' }}>${entry.totalSpent}</span>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}
