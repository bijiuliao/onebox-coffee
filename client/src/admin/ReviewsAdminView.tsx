import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminReview } from '../types';
import { AdminTopBar } from './AdminTopBar';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function ReviewsAdminView() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    api.listAdminReviews().then(setReviews, err => setError(err.message));
  }, []);

  async function remove(id: number) {
    setDeletingId(id);
    try {
      await api.deleteAdminReview(id);
      setReviews(prev => prev?.filter(r => r.id !== id) ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ea', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="reviews" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>評分與風味回饋 / REVIEWS</div>
          {reviews && <div style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>{reviews.length} 筆</div>}
        </div>

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && reviews === null && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {reviews && reviews.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            還沒有任何評分
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reviews?.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <span style={{ padding: '4px 10px', borderRadius: 10, background: r.coffeeColor + '22', color: r.coffeeColor, font: "600 12px 'Iansui'", flexShrink: 0 }}>{r.coffeeName}</span>
                <span style={{ font: "600 15px 'Room205'", color: '#c98a2e', flexShrink: 0 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                {r.flavorTags.length > 0 && (
                  <span style={{ font: "400 12px 'Iansui'", color: '#8a7a68', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.flavorTags.join(' · ')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                <span style={{ font: "400 11px 'Space Mono'", color: '#9a8a76' }}>{formatTime(r.createdAt)}</span>
                <div
                  onClick={() => deletingId === null && remove(r.id)}
                  className="press"
                  style={{ cursor: deletingId === null ? 'pointer' : 'default', opacity: deletingId === r.id ? .5 : 1, font: "600 12px 'Iansui'", color: '#c8342b', padding: '5px 10px' }}
                >
                  刪除
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
