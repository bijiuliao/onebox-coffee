import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLang } from '../i18n';
import { useToast } from '../toast';
import type { Coffee, ReviewSummary } from '../types';

function reviewedKey(coffeeId: string) {
  return `onebox-reviewed-${coffeeId}`;
}

function StarRow({ rating, onPick, size = 26 }: { rating: number; onPick?: (n: number) => void; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={onPick ? () => onPick(n) : undefined}
          className={onPick ? 'press' : undefined}
          style={{
            cursor: onPick ? 'pointer' : 'default',
            font: `${size}px 'Room205'`,
            lineHeight: 1,
            color: n <= rating ? '#c98a2e' : '#e2dac9',
          }}
        >
          {n <= rating ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}

export function ReviewSection({ coffee }: { coffee: Coffee }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setRating(0);
    setTags(new Set());
    setHasReviewed(localStorage.getItem(reviewedKey(coffee.id)) === '1');
    api.getReviewSummary(coffee.id).then(s => { if (!cancelled) setSummary(s); }, () => {});
    return () => { cancelled = true; };
  }, [coffee.id]);

  function toggleTag(tag: string) {
    setTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  async function submit() {
    if (rating === 0) { showToast(t('review.needRating')); return; }
    setSubmitting(true);
    try {
      const updated = await api.submitReview(coffee.id, rating, Array.from(tags));
      setSummary(updated);
      localStorage.setItem(reviewedKey(coffee.id), '1');
      setHasReviewed(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('review.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const soft = coffee.color + '22';
  const tagEntries = summary
    ? coffee.notes
      .map(n => [n, summary.tagCounts[n] ?? 0] as const)
      .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div style={{ padding: '22px 24px 0' }}>
      <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 12 }}>{t('review.eyebrow')}</div>

      {summary && summary.count > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <StarRow rating={Math.round(summary.avgRating)} />
          <span style={{ font: "500 18px 'Room205'", color: '#1a1714' }}>{summary.avgRating}</span>
          <span style={{ font: "400 13px 'Iansui'", color: '#9a8a76' }}>{t('review.count', { count: summary.count })}</span>
        </div>
      ) : (
        <div style={{ font: "400 13px 'Iansui'", color: '#9a8a76', marginBottom: 18 }}>{t('review.noneYet')}</div>
      )}

      {tagEntries.length > 0 && tagEntries.some(([, c]) => c > 0) && summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {tagEntries.map(([tag, c]) => {
            const pct = summary.count > 0 ? Math.round((c / summary.count) * 100) : 0;
            return (
              <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ font: "600 12px 'Iansui'", color: '#4a3c2e', width: 76, flexShrink: 0 }}>{tag}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: soft, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: coffee.color, borderRadius: 4, transition: 'width .4s ease' }} />
                </div>
                <span style={{ font: "500 11px 'Space Mono'", color: '#9a8a76', width: 32, textAlign: 'right' }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      {hasReviewed ? (
        <div style={{ padding: '16px 18px', borderRadius: 14, background: soft, font: "600 14px 'Iansui'", color: coffee.color, textAlign: 'center' }}>
          {t('review.thanks')}
        </div>
      ) : (
        <div style={{ padding: '18px 18px 20px', borderRadius: 16, background: 'rgba(255,255,255,.7)' }}>
          <div style={{ font: "600 14px 'Iansui'", color: '#1a1714', marginBottom: 12 }}>{t('review.prompt')}</div>
          <StarRow rating={rating} onPick={setRating} size={30} />

          {coffee.notes.length > 0 && (
            <>
              <div style={{ font: "400 12px 'Iansui'", color: '#9a8a76', margin: '16px 0 8px' }}>{t('review.flavorPrompt')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {coffee.notes.map(n => {
                  const active = tags.has(n);
                  return (
                    <span
                      key={n}
                      onClick={() => toggleTag(n)}
                      className="press"
                      style={{
                        cursor: 'pointer', padding: '7px 13px', borderRadius: 20,
                        font: "600 12px 'Iansui'",
                        background: active ? coffee.color : soft,
                        color: active ? '#fff' : coffee.color,
                      }}
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
            </>
          )}

          <div
            onClick={submitting ? undefined : submit}
            className="press"
            style={{
              cursor: submitting ? 'default' : 'pointer', opacity: submitting ? .6 : 1,
              marginTop: 18, textAlign: 'center', padding: '13px 18px', borderRadius: 14,
              background: coffee.color, color: '#fff', font: "600 14px 'Iansui'",
            }}
          >
            {submitting ? t('review.submitting') : t('review.submit')}
          </div>
        </div>
      )}
    </div>
  );
}
