import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { BackButton } from '../components';
import { useLang } from '../i18n';
import { api } from '../api';
import type { MemberLevel, MysteryTier } from '../types';
import { getStoredEmail } from '../customerSession';
import { currentLevelStep } from '../memberLevel';

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const MYSTERY_TIER_ORDER: MysteryTier[] = ['daily', 'rare', 'competition', 'rare_competition'];
const MYSTERY_TIER_COLOR: Record<MysteryTier, string> = { daily: '#3d6b4f', rare: '#2b6f8a', competition: '#b5502f', rare_competition: '#8a5ca8' };
const MYSTERY_TIER_LABEL_KEY: Record<MysteryTier, string> = { daily: 'mysteryTier.daily', rare: 'mysteryTier.rare', competition: 'mysteryTier.competition', rare_competition: 'mysteryTier.rareCompetition' };

type MysteryWeights = { daily: number; rare: number; competition: number; rareCompetition: number };

function weightFor(weights: MysteryWeights, tier: MysteryTier): number {
  return tier === 'rare_competition' ? weights.rareCompetition : weights[tier];
}

// A real tier at Lv.2 can be as thin as 1% of the wheel - genuinely
// accurate, but a ~3.6deg sliver is invisible on a 150px wheel. This never
// touches the real odds (the legend below still shows the true %, and the
// server-side draw/landing math is untouched) - it only pads out thin
// slices to a minimum visible width for the *drawing*, shrinking the
// larger slices proportionally to make room so everything still sums to
// 100. Any tier at exactly 0% stays invisible (there's nothing there to
// show).
const MIN_VISUAL_PCT = 5;
function mysteryDisplayPct(weights: MysteryWeights): Record<MysteryTier, number> {
  const floored = {} as Record<MysteryTier, number>;
  for (const tier of MYSTERY_TIER_ORDER) {
    const pct = weightFor(weights, tier);
    floored[tier] = pct > 0 ? Math.max(pct, MIN_VISUAL_PCT) : 0;
  }
  const total = MYSTERY_TIER_ORDER.reduce((sum, tier) => sum + floored[tier], 0) || 1;
  const display = {} as Record<MysteryTier, number>;
  for (const tier of MYSTERY_TIER_ORDER) display[tier] = (floored[tier] / total) * 100;
  return display;
}

// Each tier's angular span on the wheel - daily first, then rare, then
// competition, then rare_competition, going clockwise from the top
// (matches conic-gradient's default start point, which is what the
// wheel's background is drawn with). Takes the already visually-padded
// percentages (see mysteryDisplayPct), not the raw weights.
function mysterySegmentBounds(displayPct: Record<MysteryTier, number>): Record<MysteryTier, [number, number]> {
  let acc = 0;
  const bounds = {} as Record<MysteryTier, [number, number]>;
  for (const tier of MYSTERY_TIER_ORDER) {
    const span = (displayPct[tier] / 100) * 360;
    bounds[tier] = [acc, acc + span];
    acc += span;
  }
  return bounds;
}

function mysteryWheelBackground(weights: MysteryWeights): string {
  const bounds = mysterySegmentBounds(mysteryDisplayPct(weights));
  const stops = MYSTERY_TIER_ORDER.map(t => `${MYSTERY_TIER_COLOR[t]} ${bounds[t][0]}deg ${bounds[t][1]}deg`).join(', ');
  return `conic-gradient(${stops})`;
}

// How far (in degrees) to rotate the wheel so the drawn tier's segment ends
// up under the pointer (fixed at the top) - lands at a random point inside
// the segment rather than dead center, plus a few extra full turns so the
// spin actually looks like a spin. Uses the same visually-padded bounds as
// the background, so the pointer always lands inside the wedge that's
// actually drawn on screen, not a sliver too thin to see.
function mysteryRotationForTier(weights: MysteryWeights, tier: MysteryTier): number {
  const [start, end] = mysterySegmentBounds(mysteryDisplayPct(weights))[tier];
  const span = end - start;
  const landingOffset = span > 0 ? (0.15 + Math.random() * 0.7) * span : 0;
  const targetAngle = (start + landingOffset) % 360;
  const spins = 6;
  return spins * 360 + ((360 - targetAngle) % 360);
}

// A small "enchanting circle" (rotating ring + counter-orbiting sparks +
// a pulsing glow) for the crafting-in-progress state - the same kind of
// tense, ritual-feeling buildup classic MMO item-enchant animations use,
// instead of a flat progress spinner, since a 50/50 craft is meant to
// feel like a gamble being cast, not a loading bar.
function CraftingCircle({ color }: { color: string }) {
  const sparkAngles = [0, 60, 120, 180, 240, 300];
  return (
    <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto' }}>
      <div style={{
        position: 'absolute', inset: 10, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
        animation: 'craftGlow 1.1s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `2px dashed ${color}`, opacity: .8,
        animation: 'craftSpin 2.4s linear infinite',
      }} />
      <div style={{
        position: 'absolute', inset: 14, borderRadius: '50%',
        border: `1px solid ${color}`, opacity: .5,
        animation: 'craftSpin 1.6s linear infinite reverse',
      }} />
      <div style={{ position: 'absolute', inset: 0, animation: 'craftSpin 1.3s linear infinite' }}>
        {sparkAngles.map(angle => (
          <div
            key={angle}
            style={{
              position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: '50%',
              background: color, boxShadow: `0 0 6px ${color}`,
              transform: `rotate(${angle}deg) translate(44px) translate(-2.5px,-2.5px)`,
            }}
          />
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>⚗️</div>
    </div>
  );
}

function MysteryWheelPanel({ weights, spinning, rotation, onSpin, t }: {
  weights: MysteryWeights;
  spinning: boolean;
  rotation: number;
  onSpin: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 10px', background: '#faf8f3', borderRadius: 14 }}>
      <div style={{ position: 'relative', width: 150, height: 150 }}>
        <div style={{
          position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
          width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid #1a1714',
        }} />
        <div style={{
          width: 150, height: 150, borderRadius: '50%', background: mysteryWheelBackground(weights), border: '4px solid #fff',
          boxShadow: '0 4px 16px rgba(0,0,0,.15)',
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 3.2s cubic-bezier(.17,.67,.2,1)' : 'none',
        }} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {MYSTERY_TIER_ORDER.map(tier => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 5, font: "500 11px 'Iansui'", color: '#6b5c4a' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: MYSTERY_TIER_COLOR[tier], flexShrink: 0 }} />
            {t(MYSTERY_TIER_LABEL_KEY[tier])} {weightFor(weights, tier)}%
          </div>
        ))}
      </div>
      <div
        onClick={() => !spinning && onSpin()}
        className="press"
        style={{
          cursor: spinning ? 'default' : 'pointer', opacity: spinning ? .6 : 1,
          padding: '11px 26px', borderRadius: 12, background: '#1a1714', color: '#faf8f3', font: "600 13px 'Iansui'",
        }}
      >
        {spinning ? t('memberLevel.spinning') : t('memberLevel.spinWheel')}
      </div>
    </div>
  );
}

export function MemberLevelScreen() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? getStoredEmail());
  const [result, setResult] = useState<MemberLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [openWheelFor, setOpenWheelFor] = useState<number | null>(null);
  const [spinningId, setSpinningId] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState<Record<number, number>>({});
  const [craftingTier, setCraftingTier] = useState<MysteryTier | null>(null);
  const [craftResult, setCraftResult] = useState<{ tier: MysteryTier; coffeeName: string; success: boolean } | null>(null);

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

  // Draws the actual coffee server-side first (that's the moment the result
  // is locked in - see member-level-mystery-draw.mts), then spins the wheel
  // to visually land on it. Doesn't refresh `result` until the animation's
  // own timer fires, so the reveal always happens in step with the wheel
  // actually stopping rather than snapping to the drawn state early.
  const spin = async (rewardId: number) => {
    const em = email.trim();
    if (!result || spinningId !== null) return;
    setSpinningId(rewardId);
    setError(null);
    try {
      const draw = await api.drawMysteryBean(em, rewardId);
      setWheelRotation(prev => ({ ...prev, [rewardId]: mysteryRotationForTier(result.mysteryWeights, draw.tier) }));
      setTimeout(async () => {
        try {
          const refreshed = await api.getMemberLevel(em);
          setResult(refreshed);
        } finally {
          setSpinningId(null);
          setOpenWheelFor(null);
        }
      }, 3400);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('memberLevel.mysteryFailed'));
      setSpinningId(null);
    }
  };

  // Combines 3 of the customer's own same-tier, still-undelivered mystery
  // draws into 1 - the server locks in success/fail and the resulting
  // coffee immediately (see member-level-mystery-craft.mts), same
  // "resolve first, animate after" pattern as spin() above, so the simple
  // pulsing animation always ends in step with a real result rather than
  // a result that was already decided before the animation even started.
  const craft = async (tier: MysteryTier) => {
    const em = email.trim();
    if (!result || craftingTier !== null) return;
    setCraftingTier(tier);
    setCraftResult(null);
    setError(null);
    try {
      const res = await api.craftMysteryBean(em, tier);
      setTimeout(async () => {
        try {
          const refreshed = await api.getMemberLevel(em);
          setResult(refreshed);
        } finally {
          setCraftingTier(null);
          setCraftResult(res);
        }
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('memberLevel.mysteryCraftFailed'));
      setCraftingTier(null);
    }
  };

  // Arriving here with ?email= in the URL, or already "logged in" (email
  // remembered from a past checkout / the header's account button),
  // searches right away instead of making them retype and press the button.
  useEffect(() => {
    if (email) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const levelStep = result ? currentLevelStep(result.beansSpent) : 500;
  const progressPct = result ? Math.max(0, Math.min(100, ((levelStep - result.toNextLevel) / levelStep) * 100)) : 0;

  // Every drawn-but-not-yet-shipped-or-merged mystery bean, grouped by
  // tier - the pool of "material" crafting can spend. redeemedAt already
  // covers both "admin shipped it" and "merging consumed it" (see
  // member-level-mystery-craft.mts), so a plain !redeemedAt check is
  // exactly "still sitting around, available".
  const pendingMysteryByTier: Partial<Record<MysteryTier, number>> = {};
  for (const r of result?.rewards ?? []) {
    if (r.isMysteryPool && r.mysteryCoffeeName && !r.redeemedAt && r.mysteryTier) {
      pendingMysteryByTier[r.mysteryTier] = (pendingMysteryByTier[r.mysteryTier] ?? 0) + 1;
    }
  }
  const hasCraftableMaterial = Object.values(pendingMysteryByTier).some(c => (c ?? 0) > 0);

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
              {result.availableRewards.map(r => (
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
                  {r.isDiscount && (
                    <div style={{ font: "400 10px 'Iansui'", color: '#c98a2e', marginTop: 4 }}>{t('memberLevel.discountHint')}</div>
                  )}
                  {r.isMysteryPool && (
                    <div style={{ font: "400 10px 'Iansui'", color: '#9d8fd9', marginTop: 4 }}>{t('memberLevel.mysteryHint')}</div>
                  )}
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
                const undrawnMystery = r.isMysteryPool && !r.mysteryCoffeeName;
                return (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 12, padding: '11px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ font: "600 13px 'Iansui'", color: '#1a1714' }}>Lv.{r.level} · {r.rewardLabel}</div>
                        <div style={{ font: "400 11px 'Space Mono'", color: '#9a8a76', marginTop: 2 }}>{formatTime(r.chosenAt)}</div>
                      </div>
                      {!undrawnMystery && (
                        <span style={{
                          font: "600 11px 'Iansui'", padding: '3px 9px', borderRadius: 10, flexShrink: 0,
                          background: r.isMysteryMerged ? '#f1ece2' : r.redeemedAt ? '#e3f0e5' : '#f1e9db',
                          color: r.isMysteryMerged ? '#8a7a68' : r.redeemedAt ? '#3f7a4a' : '#8a7a68',
                        }}>{r.isMysteryMerged ? t('memberLevel.mysteryMerged') : r.redeemedAt ? t('memberLevel.redeemed') : (r.isDiscount ? t('memberLevel.autoApply') : r.isMysteryPool ? t('memberLevel.mysteryPendingShip') : t('memberLevel.pending'))}</span>
                      )}
                    </div>

                    {r.isMysteryPool && r.mysteryCoffeeName && (
                      <div style={{ marginTop: 8, font: "600 12px 'Iansui'", color: r.isMysteryMerged ? '#9a8a76' : '#5a4a9e' }}>
                        {t('memberLevel.mysteryResult', { name: r.mysteryCoffeeName })}
                      </div>
                    )}

                    {undrawnMystery && (
                      <div style={{ marginTop: 10 }}>
                        {openWheelFor === r.id ? (
                          <MysteryWheelPanel
                            weights={result.mysteryWeights}
                            spinning={spinningId === r.id}
                            rotation={wheelRotation[r.id] ?? 0}
                            onSpin={() => spin(r.id)}
                            t={t}
                          />
                        ) : (
                          <div
                            onClick={() => setOpenWheelFor(r.id)}
                            className="press"
                            style={{ cursor: 'pointer', textAlign: 'center', padding: 11, borderRadius: 10, background: '#5a4a9e', color: '#faf8f3', font: "600 12px 'Iansui'" }}
                          >
                            🎡 {t('memberLevel.openWheel')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {result && hasCraftableMaterial && (
          <div style={{ marginTop: 24, background: '#fff', border: '1px solid #ece5d6', borderRadius: 18, padding: 18 }}>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 4 }}>{t('memberLevel.craftHeading')}</div>
            <div style={{ font: "400 11px 'Iansui'", color: '#b0a08c', marginBottom: 14 }}>{t('memberLevel.craftHint')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MYSTERY_TIER_ORDER.slice(0, -1).map(tier => {
                const count = pendingMysteryByTier[tier] ?? 0;
                if (count === 0) return null;
                const upgradeTier = MYSTERY_TIER_ORDER[MYSTERY_TIER_ORDER.indexOf(tier) + 1];
                const canCraft = count >= 3 && craftingTier === null;
                return (
                  <div key={tier} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', borderRadius: 12, background: '#faf8f3' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: MYSTERY_TIER_COLOR[tier], flexShrink: 0 }} />
                      <span style={{ font: "600 13px 'Iansui'", color: '#1a1714' }}>{t(MYSTERY_TIER_LABEL_KEY[tier])} × {count}</span>
                      <span style={{ font: "400 11px 'Iansui'", color: '#9a8a76' }}>→ {t(MYSTERY_TIER_LABEL_KEY[upgradeTier])}</span>
                    </div>
                    <div
                      onClick={() => canCraft && craft(tier)}
                      className="press"
                      style={{
                        cursor: canCraft ? 'pointer' : 'default', flexShrink: 0,
                        opacity: count < 3 ? .4 : craftingTier === tier ? .6 : 1,
                        padding: '9px 16px', borderRadius: 10, background: '#8a5ca8', color: '#fff', font: "600 12px 'Iansui'",
                      }}
                    >
                      {craftingTier === tier ? t('memberLevel.crafting') : count >= 3 ? t('memberLevel.craftButton') : t('memberLevel.craftNeedMore', { count: 3 - count })}
                    </div>
                  </div>
                );
              })}
            </div>

            {craftingTier && (
              <div className="rise" style={{ marginTop: 14, textAlign: 'center', padding: '20px 18px', borderRadius: 12, background: '#211a2b' }}>
                <CraftingCircle color={MYSTERY_TIER_COLOR[MYSTERY_TIER_ORDER[MYSTERY_TIER_ORDER.indexOf(craftingTier) + 1]]} />
                <div style={{ font: "500 12px 'Iansui'", color: '#c9b8ea', marginTop: 10, letterSpacing: 1 }}>{t('memberLevel.crafting')}</div>
              </div>
            )}

            {craftResult && !craftingTier && (
              <div style={{
                marginTop: 14, textAlign: 'center', padding: '16px 14px', borderRadius: 12,
                background: craftResult.success ? 'linear-gradient(150deg,#2e4a37,#3d6b4f)' : '#f1ece2',
                animation: craftResult.success ? 'craftBurst .6s cubic-bezier(.17,.67,.2,1) both' : 'craftShake .45s ease-in-out both',
              }}>
                <div style={{ fontSize: 22 }}>{craftResult.success ? '✨' : '💨'}</div>
                <div style={{ font: "600 13px 'Iansui'", color: craftResult.success ? '#faf8f3' : '#8a7a68', marginTop: 4 }}>
                  {craftResult.success
                    ? t('memberLevel.craftSuccess', { tier: t(MYSTERY_TIER_LABEL_KEY[craftResult.tier]), name: craftResult.coffeeName })
                    : t('memberLevel.craftFail', { tier: t(MYSTERY_TIER_LABEL_KEY[craftResult.tier]), name: craftResult.coffeeName })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
