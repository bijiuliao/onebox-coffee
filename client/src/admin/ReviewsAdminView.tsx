import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [filter, setFilter] = useState<'all' | 'email' | 'page'>('all');
  const navigate = useNavigate();
  const shown = reviews?.filter(r => filter === 'all' || r.source === filter) ?? null;

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
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="reviews" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>評分與風味回饋 / REVIEWS</div>
          {shown && <div style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>{shown.length} 筆</div>}
        </div>

        {reviews && reviews.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {([['all', '全部'], ['email', '回饋信（看得到是誰）'], ['page', '商品頁（匿名）']] as const).map(([key, label]) => (
              <div
                key={key}
                onClick={() => setFilter(key)}
                className="press"
                style={{
                  cursor: 'pointer', padding: '7px 14px', borderRadius: 10, font: "600 13px 'Iansui'",
                  background: filter === key ? '#1a1714' : '#fff', color: filter === key ? '#faf8f3' : '#8a7a68',
                  border: filter === key ? '1px solid #1a1714' : '1px solid #e2dac9',
                }}
              >{label} <span style={{ font: "700 10px 'Space Mono'", opacity: .7 }}>{key === 'all' ? reviews.length : reviews.filter(r => r.source === key).length}</span></div>
            ))}
          </div>
        )}

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && reviews === null && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {reviews && reviews.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            還沒有任何評分
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown?.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <span style={{ padding: '4px 10px', borderRadius: 10, background: r.coffeeColor + '22', color: r.coffeeColor, font: "600 12px 'Iansui'", flexShrink: 0 }}>{r.coffeeName}</span>
                <span style={{ font: "600 15px 'Room205'", color: '#c98a2e', flexShrink: 0 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                {r.flavorTags.length > 0 && (
                  <span style={{ font: "400 12px 'Iansui'", color: '#8a7a68', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.flavorTags.join(' · ')}
                  </span>
                )}
              </div>
              <div style={{ marginTop: 7, font: "400 12px 'Iansui'", color: '#9a8a76', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {r.source === 'page' ? (
                  <span>匿名（商品頁評分）</span>
                ) : r.orderId === null ? (
                  <span>回饋信 · 對不到原本的訂單</span>
                ) : (
                  <>
                    <span style={{ padding: '2px 8px', borderRadius: 8, background: '#e6f0ea', color: '#3d6b4f', font: "600 11px 'Iansui'" }}>回饋信</span>
                    <span
                      onClick={r.customerEmail ? () => navigate(`/admin/customers/${encodeURIComponent(r.customerEmail!)}`) : undefined}
                      className={r.customerEmail ? 'press' : undefined}
                      style={{ cursor: r.customerEmail ? 'pointer' : 'default', color: '#1a1714', font: "600 13px 'Iansui'", textDecoration: r.customerEmail ? 'underline' : 'none', textDecorationColor: '#d3c9b6' }}
                    >{r.customerName || '（沒有填名字）'}</span>
                    {r.customerEmail && <span style={{ font: "400 11px 'Space Mono'" }}>{r.customerEmail}</span>}
                    <span style={{ font: "400 11px 'Space Mono'" }}>訂單 #{r.orderId}</span>
                  </>
                )}
              </div>
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
