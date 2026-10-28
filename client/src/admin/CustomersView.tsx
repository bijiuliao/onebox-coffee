import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Customer } from '../types';
import { AdminTopBar } from './AdminTopBar';
import { getMemberLevel } from '../memberLevel';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function CustomersView() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.listCustomers().then(setCustomers, err => setError(err.message));
  }, []);

  const q = query.trim().toLowerCase();
  const visible = customers?.filter(c => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="customers" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>客戶 / CUSTOMERS</div>
          {customers && <div style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>{customers.length} 位</div>}
        </div>

        {/* This is a read-only report aggregated from order history (grouped
            by email), not an editable customer record - there's no separate
            customers table or accounts, so nothing here can be edited. */}
        <div style={{ font: "400 11px 'Iansui'", color: '#b0a08c', marginBottom: 18 }}>
          依訂單的 Email 自動彙整，不是獨立的客戶資料——姓名顯示該客戶最近一次下單時填寫的姓名
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋姓名或 Email"
          style={{ width: '100%', padding: '11px 14px', border: '1px solid #e2dac9', borderRadius: 12, background: '#fff', font: "400 14px 'Iansui'", color: '#1a1714', outline: 'none', marginBottom: 20 }}
        />

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && customers === null && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {customers && customers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            還沒有客戶資料
          </div>
        )}
        {customers && customers.length > 0 && visible?.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            找不到符合的客戶
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible?.map(c => {
            const level = getMemberLevel(c.beansSpent);
            return (
            <div
              key={c.email}
              onClick={() => navigate(`/admin/customers/${encodeURIComponent(c.email)}`)}
              className="press"
              style={{ cursor: 'pointer', background: '#fff', border: '1px solid #ece5d6', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ font: "500 16px 'Room205',serif", color: '#1a1714' }}>{c.name || '（未填寫姓名）'}</div>
                  <span style={{ font: "600 10px 'Iansui'", padding: '2px 8px', borderRadius: 10, background: '#c98a2e22', color: '#c98a2e', flexShrink: 0 }}>Lv.{level}</span>
                </div>
                <div style={{ font: "400 12px 'Space Mono'", color: '#9a8a76', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>
                {c.rewards.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                    {c.rewards.map(r => (
                      <span
                        key={r.id}
                        style={{
                          font: "600 10px 'Iansui'", padding: '3px 8px', borderRadius: 9,
                          background: r.redeemedAt ? '#e3f0e5' : '#f1e9db', color: r.redeemedAt ? '#3f7a4a' : '#8a7a68',
                        }}
                      >
                        Lv.{r.level} · {r.rewardLabel}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 28, flex: 'none' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>訂單數</div>
                  <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>{c.orderCount}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>總消費</div>
                  <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>${c.totalSpent}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>豆子消費</div>
                  <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>${c.beansSpent}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>最後上門</div>
                  <div style={{ font: "400 12px 'Space Mono'", color: '#4a3c2e', marginTop: 2 }}>{formatTime(c.lastOrderAt)}</div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
