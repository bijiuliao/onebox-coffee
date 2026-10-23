import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Coffee } from '../types';
import { AdminTopBar } from './AdminTopBar';
import { useToast } from '../toast';

export function NotifyBeansView() {
  const { showToast } = useToast();
  const [coffees, setCoffees] = useState<Coffee[] | null>(null);
  const [recipients, setRecipients] = useState<{ email: string; name: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);

  useEffect(() => {
    api.listCoffees(true).then(
      list => {
        const sellable = list.filter(c => c.sellsBeans && c.active && !c.archived);
        setCoffees(sellable);
        // Pre-check beans that haven't been included in any announcement
        // yet, since that's the common case - picking older already-
        // announced ones back in is still one click away.
        setSelected(new Set(sellable.filter(c => !c.launchNotified).map(c => c.id)));
      },
      err => setError(err instanceof Error ? err.message : '載入失敗'),
    );
    // Fetched independently of which beans are selected - the recipient
    // set doesn't depend on that, so it's shown up front, not revealed
    // only right before sending.
    api.listBeanCustomers().then(
      list => {
        setRecipients(list);
        // Default to everyone, matching the "announce to all customers"
        // behavior before per-recipient picking existed - deselecting is
        // still just a click away for a smaller or test send.
        setSelectedRecipients(new Set(list.map(r => r.email)));
      },
      () => {},
    );
  }, []);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleRecipient(email: string) {
    setSelectedRecipients(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  }

  function toggleAllRecipients() {
    if (!recipients) return;
    setSelectedRecipients(prev => (prev.size === recipients.length ? new Set() : new Set(recipients.map(r => r.email))));
  }

  async function send() {
    if (selected.size === 0 || selectedRecipients.size === 0 || sending) return;
    setSending(true);
    try {
      const res = await api.notifyNewBeans(Array.from(selected), Array.from(selectedRecipients));
      showToast(`已寄出，共通知 ${res.recipientCount} 位客人`);
      setCoffees(prev => prev && prev.map(c => (selected.has(c.id) ? { ...c, launchNotified: true } : c)));
      setSelected(new Set());
    } catch (err) {
      showToast(err instanceof Error ? `寄送失敗：${err.message}` : '寄送失敗');
    } finally {
      setSending(false);
    }
  }

  const selectedCoffees = (coffees ?? []).filter(c => selected.has(c.id));

  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ea', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="notify-beans" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>新豆公告 / NOTIFY BEANS</div>
        </div>
        <div style={{ font: "400 12px 'Iansui'", color: '#b0a08c', marginBottom: 22 }}>
          勾選要一起公告的豆子，合併成一封信寄給所有訂過的客人，不會一款一款分開寄
        </div>

        {recipients && (
          <div style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>
            <div
              onClick={() => setRecipientsOpen(o => !o)}
              className="press"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}
            >
              <span style={{ font: "600 13px 'Iansui'", color: '#1a1714' }}>
                {recipients.length === 0 ? '目前沒有任何客人' : `已選 ${selectedRecipients.size} / ${recipients.length} 位客人`}
              </span>
              {recipients.length > 0 && (
                <span style={{ font: "700 11px 'Space Mono'", color: '#9a8a76' }}>{recipientsOpen ? '收合 ▲' : '選擇收件人 ▼'}</span>
              )}
            </div>
            {recipientsOpen && recipients.length > 0 && (
              <div style={{ borderTop: '1px solid #ece5d6' }}>
                <div
                  onClick={toggleAllRecipients}
                  className="press"
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid #ece5d6', background: '#faf7f0' }}
                >
                  <span style={{
                    width: 15, height: 15, borderRadius: 5, flex: 'none',
                    border: selectedRecipients.size === recipients.length ? 'none' : '1px solid #c2b9a6',
                    background: selectedRecipients.size === recipients.length ? '#1a1714' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', font: "700 10px sans-serif", color: '#fff',
                  }}>{selectedRecipients.size === recipients.length ? '✓' : ''}</span>
                  <span style={{ font: "600 12px 'Iansui'", color: '#4a3c2e' }}>
                    {selectedRecipients.size === recipients.length ? '取消全選' : '全選'}
                  </span>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {recipients.map(r => {
                    const checked = selectedRecipients.has(r.email);
                    return (
                      <div
                        key={r.email}
                        onClick={() => toggleRecipient(r.email)}
                        className="press"
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px' }}
                      >
                        <span style={{
                          width: 15, height: 15, borderRadius: 5, flex: 'none',
                          border: checked ? 'none' : '1px solid #c2b9a6',
                          background: checked ? '#1a1714' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', font: "700 10px sans-serif", color: '#fff',
                        }}>{checked ? '✓' : ''}</span>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 10, font: "400 13px 'Iansui'" }}>
                          <span style={{ color: '#1a1714' }}>{r.name || '（未填寫姓名）'}</span>
                          <span style={{ font: "400 12px 'Space Mono'", color: '#9a8a76' }}>{r.email}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && coffees === null && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}
        {coffees && coffees.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            目前沒有開放零售、上架中的豆子
          </div>
        )}

        {coffees && coffees.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 90 }}>
            {coffees.map(c => {
              const checked = selected.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className="press"
                  style={{
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                    background: '#fff', border: '1px solid ' + (checked ? '#1a1714' : '#ece5d6'), borderRadius: 14,
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 6, flex: 'none',
                    border: checked ? 'none' : '1px solid #c2b9a6',
                    background: checked ? '#1a1714' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    font: "700 12px sans-serif", color: '#fff',
                  }}>{checked ? '✓' : ''}</span>
                  {c.coverUrl ? (
                    <img src={c.coverUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flex: 'none', background: '#f1e9db' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 10, flex: 'none', background: c.color + '22' }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "500 15px 'Room205',serif", color: '#1a1714' }}>{c.name}</div>
                    <div style={{ font: "400 12px 'Space Mono'", color: '#9a8a76', marginTop: 2 }}>{c.originEN} · {c.roast}</div>
                  </div>
                  {c.launchNotified && (
                    <span style={{ marginLeft: 'auto', flex: 'none', font: "600 10px 'Iansui'", padding: '3px 9px', borderRadius: 10, background: '#f1e9db', color: '#8a7a68' }}>已公告過</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {coffees && coffees.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1a1714', padding: '16px 30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 840, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ color: '#c2b9a6', font: "400 13px 'Iansui'", minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.size === 0
                ? '還沒選擇豆子'
                : `已選 ${selected.size} 款：${selectedCoffees.map(c => c.name).join('、')} · ${selectedRecipients.size} 位客人`}
            </div>
            <div
              onClick={send}
              className="press"
              style={{
                cursor: selected.size === 0 || selectedRecipients.size === 0 || sending ? 'default' : 'pointer',
                opacity: selected.size === 0 || selectedRecipients.size === 0 || sending ? 0.5 : 1, flex: 'none',
                padding: '12px 24px', borderRadius: 12, font: "600 14px 'Iansui'", background: '#c98a2e', color: '#1a1714',
              }}
            >{sending ? '寄送中…' : '寄送合併公告信'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
