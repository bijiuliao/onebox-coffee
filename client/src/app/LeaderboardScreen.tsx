import { useNavigate } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton } from '../components';
import { useLang } from '../i18n';
import { useLeaderboard } from '../useCoffees';
import type { LeaderboardEntry } from '../types';

// Top-3 get a colored rank badge (gold/silver/bronze-ish, matching the
// existing warm palette) instead of the plain numbered circle everyone
// else gets - the only "medal" touch, no emoji per the site's usual
// typographic style (a single CJK glyph in a circle, same trick as the
// cart button's 箱).
const RANK_COLORS: Record<number, string> = { 1: '#c98a2e', 2: '#8a7a68', 3: '#8a5a3a' };
const PODIUM_HEIGHT: Record<number, number> = { 1: 92, 2: 68, 3: 54 };
// Builds toward the winner: 3rd reveals first, then 2nd, then 1st pops in
// last with its own little bounce - a small dramatic beat on page load.
const PODIUM_DELAY: Record<number, string> = { 3: '.08s', 2: '.14s', 1: '.2s' };

function PodiumColumn({ entry }: { entry: LeaderboardEntry }) {
  const color = RANK_COLORS[entry.rank] ?? '#c98a2e';
  return (
    <div className="rise" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', animationDelay: PODIUM_DELAY[entry.rank] }}>
      <span style={{
        width: entry.rank === 1 ? 54 : 44, height: entry.rank === 1 ? 54 : 44, borderRadius: '50%', flex: 'none',
        background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: "700 18px 'Iansui'", marginBottom: 10,
        animation: entry.rank === 1 ? 'successPop .5s .32s cubic-bezier(.25,.9,.4,1.25) both' : undefined,
      }}>
        {entry.name[0]}
      </span>
      <div style={{ font: "600 13px 'Iansui'", color: '#1a1714', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{entry.name}</div>
      <div style={{ font: "600 15px 'Room205',serif", color: '#1a1714', marginTop: 2 }}>${entry.totalSpent}</div>
      <div style={{
        marginTop: 10, width: '100%', height: PODIUM_HEIGHT[entry.rank], borderRadius: '14px 14px 0 0',
        background: color, display: 'flex', justifyContent: 'center', paddingTop: 10,
      }}>
        <span style={{ font: "700 22px 'Space Mono'", color: 'rgba(255,255,255,.88)' }}>{entry.rank}</span>
      </div>
    </div>
  );
}

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { leaderboard } = useLeaderboard();

  const top3 = leaderboard?.slice(0, 3) ?? [];
  const rest = leaderboard?.filter(e => e.rank > 3) ?? [];

  return (
    <MobileShell>
      <div style={{ padding: '20px 22px 60px' }}>
        <BackButton onClick={() => navigate('/menu')} />

        <div
          className="rise"
          style={{
            marginTop: 20, borderRadius: 24, padding: '28px 22px 26px', textAlign: 'center',
            background: 'linear-gradient(150deg,#c98a2e,#e0a84f 60%,#eab868)',
            boxShadow: '0 20px 40px -22px rgba(201,138,46,.55)',
          }}
        >
          <span style={{
            width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
            font: "700 28px 'Iansui'", color: '#fff',
          }}>
            {leaderboard?.[0] ? leaderboard[0].name[0] : '✦'}
          </span>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: 'rgba(255,255,255,.85)', marginTop: 14 }}>{t('leaderboard.eyebrow')}</div>
          <div style={{ font: "700 26px 'Iansui',serif", color: '#fff', marginTop: 6 }}>{t('leaderboard.heading')}</div>
          <div style={{ font: "400 12px 'Iansui'", color: 'rgba(255,255,255,.85)', marginTop: 10 }}>{t('leaderboard.hint')}</div>
        </div>

        {leaderboard === null && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>{t('common.loading')}</div>
        )}
        {leaderboard?.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>{t('leaderboard.empty')}</div>
        )}

        {top3.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 28 }}>
            {top3.find(e => e.rank === 2) && <PodiumColumn entry={top3.find(e => e.rank === 2)!} />}
            {top3.find(e => e.rank === 1) && <PodiumColumn entry={top3.find(e => e.rank === 1)!} />}
            {top3.find(e => e.rank === 3) && <PodiumColumn entry={top3.find(e => e.rank === 3)!} />}
          </div>
        )}

        {rest.length > 0 && (
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rest.map((entry, i) => (
              <div
                key={entry.rank}
                className="rise"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, background: '#fff',
                  border: '1px solid #ece5d6', borderRadius: 16, padding: '13px 16px',
                  animationDelay: `${Math.min(.26 + i * .03, .6)}s`,
                }}
              >
                <span style={{
                  flex: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#f1ece2', color: '#8a7a68', font: "700 13px 'Space Mono'",
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
        )}
      </div>
    </MobileShell>
  );
}
