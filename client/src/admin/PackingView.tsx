import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Customer, Order, OrderLine } from '../types';
import { AdminTopBar } from './AdminTopBar';

const MYSTERY_TIER_LABEL: Record<string, string> = { daily: '日常豆', rare: '稀有豆', competition: '競賽豆', rare_competition: '稀有競賽豆' };
const MYSTERY_TIER_COLOR: Record<string, string> = { daily: '#3d6b4f', rare: '#2b6f8a', competition: '#b5502f', rare_competition: '#8a5ca8' };

const ON_HAND_STORAGE_KEY = 'onebox-admin-beans-on-hand';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isUnpackedBeansLine(line: OrderLine) {
  return line.kind === 'beans' && !!line.itemId && !line.packed;
}

export function PackingView() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mysteryActing, setMysteryActing] = useState<number | null>(null);
  const [onHand, setOnHand] = useState<Set<string>>(() => {
    const raw = localStorage.getItem(ON_HAND_STORAGE_KEY);
    try {
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  // Deferred for this browser session only (not persisted) - lets the
  // admin move past an order they could pack right now without actually
  // marking anything, e.g. to come back to it after finishing a batch of a
  // particular bean first.
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [acting, setActing] = useState(false);

  useEffect(() => {
    api.listOrders().then(setOrders, err => setError(err.message));
    api.listCustomers().then(setCustomers, err => setError(err.message));
  }, []);

  // Every mystery-pool reward that's been drawn (a coffee was picked) but
  // not yet handed to the customer - this is deliberately separate from
  // the beans-order queue below: a mystery draw isn't an order line, it's
  // a member_rewards row, so it needs its own small checklist here.
  const pendingMysteryDraws = useMemo(() => {
    const out: { id: number; email: string; name: string; coffeeName: string; tier: string; drawnAt: string }[] = [];
    for (const c of customers ?? []) {
      for (const r of c.rewards) {
        if (r.isMysteryPool && r.mysteryCoffeeName && !r.redeemedAt) {
          out.push({ id: r.id, email: c.email, name: c.name, coffeeName: r.mysteryCoffeeName, tier: r.mysteryTier ?? 'daily', drawnAt: r.mysteryDrawnAt ?? '' });
        }
      }
    }
    return out.sort((a, b) => a.drawnAt.localeCompare(b.drawnAt));
  }, [customers]);

  async function markMysteryShipped(rewardId: number) {
    if (mysteryActing !== null) return;
    setMysteryActing(rewardId);
    try {
      await api.setMemberRewardRedeemed(rewardId, true);
      setCustomers(prev => prev && prev.map(c => ({
        ...c,
        rewards: c.rewards.map(r => (r.id === rewardId ? { ...r, redeemedAt: new Date().toISOString() } : r)),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗');
    } finally {
      setMysteryActing(null);
    }
  }

  useEffect(() => {
    localStorage.setItem(ON_HAND_STORAGE_KEY, JSON.stringify(Array.from(onHand)));
  }, [onHand]);

  // Pending orders that still have at least one beans line not yet bagged -
  // this is the full pool PackingView cares about, before cross-referencing
  // against what's actually on hand right now.
  const pendingBeansOrders = useMemo(
    () => (orders ?? [])
      .filter(o => !o.fulfilled && o.items.some(isUnpackedBeansLine))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [orders],
  );

  // Checklist options - only coffees actually needed by some unpacked line,
  // not the whole catalog, so the list stays short and relevant to right now.
  const neededCoffees = useMemo(() => {
    const names = new Map<string, string>();
    for (const o of pendingBeansOrders) {
      for (const l of o.items) {
        if (isUnpackedBeansLine(l)) names.set(l.itemId!, l.name.replace(/（豆）$/, ''));
      }
    }
    return Array.from(names, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }, [pendingBeansOrders]);

  const queue = useMemo(
    () => pendingBeansOrders.filter(o =>
      !skipped.has(o.id) && o.items.some(l => isUnpackedBeansLine(l) && onHand.has(l.itemId!))
    ),
    [pendingBeansOrders, onHand, skipped],
  );

  const current = queue[0] ?? null;

  function toggleOnHand(id: string) {
    setOnHand(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function act(order: Order, coverableIndexes: number[], markFulfilled: boolean) {
    if (acting || coverableIndexes.length === 0) return;
    setActing(true);
    try {
      const updated = await api.packOrderLines(order.id, coverableIndexes, markFulfilled ? { fulfilled: true } : undefined);
      setOrders(prev => prev && prev.map(o => (o.id === order.id ? updated : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗');
    } finally {
      setActing(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="packing" />
      <div style={{ maxWidth: 700, minWidth: 500, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 20 }}>打包出貨 / PACKING</div>

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'", marginBottom: 16 }}>{error}</div>}
        {!error && orders === null && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {pendingMysteryDraws.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 12 }}>🎡 神秘豆待出貨</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingMysteryDraws.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#faf8f3' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "600 13px 'Iansui'", color: '#1a1714' }}>
                      {d.name || d.email}
                      <span style={{
                        marginLeft: 8, font: "600 10px 'Iansui'", padding: '2px 8px', borderRadius: 9,
                        background: MYSTERY_TIER_COLOR[d.tier] + '22', color: MYSTERY_TIER_COLOR[d.tier],
                      }}>{MYSTERY_TIER_LABEL[d.tier] ?? d.tier}</span>
                    </div>
                    <div style={{ font: "500 12px 'Iansui'", color: '#5a4a9e', marginTop: 2 }}>抽到：{d.coffeeName}</div>
                  </div>
                  <div
                    onClick={() => markMysteryShipped(d.id)}
                    className="press"
                    style={{
                      cursor: mysteryActing === null ? 'pointer' : 'default', opacity: mysteryActing === d.id ? .5 : 1, flexShrink: 0,
                      padding: '9px 14px', borderRadius: 10, font: "600 12px 'Iansui'", background: '#1a1714', color: '#faf8f3',
                    }}
                  >
                    標記已出貨
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {orders && (
          <>
            <div style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 12 }}>目前手邊有的豆子</div>
              {neededCoffees.length === 0 ? (
                <div style={{ font: "400 13px 'Iansui'", color: '#9a8a76' }}>目前沒有待出貨的豆子訂單</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {neededCoffees.map(c => (
                    <div
                      key={c.id}
                      onClick={() => toggleOnHand(c.id)}
                      className="press"
                      style={{
                        cursor: 'pointer', padding: '9px 16px', borderRadius: 18,
                        background: onHand.has(c.id) ? '#3d6b4f' : '#fff',
                        color: onHand.has(c.id) ? '#faf8f3' : '#4a3c2e',
                        border: '1px solid ' + (onHand.has(c.id) ? '#3d6b4f' : '#e4ddcd'),
                        font: "600 13px 'Iansui'",
                      }}
                    >
                      {onHand.has(c.id) ? '✓ ' : ''}{c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {neededCoffees.length > 0 && onHand.size === 0 && (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#9a8a76', font: "400 13px 'Iansui'" }}>
                先勾選手邊有的豆子，才會列出現在能做的單
              </div>
            )}

            {onHand.size > 0 && !current && (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#9a8a76', font: "400 13px 'Iansui'" }}>
                {skipped.size > 0 ? '手邊的豆子都先跳過了，重新整理可以再看一次' : '手邊這些豆子目前沒有能做的單'}
              </div>
            )}

            {current && (() => {
              const beansLines = current.items
                .map((l, i) => ({ l, i }))
                .filter(({ l }) => l.kind === 'beans' && !!l.itemId);
              const coverableIndexes = beansLines.filter(({ l }) => !l.packed && onHand.has(l.itemId!)).map(({ i }) => i);
              const remainingCount = beansLines.filter(({ l }) => !l.packed).length;
              const allCoverable = coverableIndexes.length === remainingCount;

              return (
                <div style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 18, padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div style={{ font: "600 17px 'Iansui'" }}>訂單 #{current.id} · {current.customerName || '（未填寫姓名）'}</div>
                    <div style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>佇列還有 {queue.length} 筆</div>
                  </div>
                  <div style={{ font: "400 12px 'Space Mono'", color: '#9a8a76', marginBottom: 16 }}>
                    {current.orderType} · {formatTime(current.createdAt)}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {beansLines.map(({ l, i }) => {
                      const done = !!l.packed;
                      const ready = !done && onHand.has(l.itemId!);
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10,
                            background: done ? '#e3f0e5' : ready ? '#e2eef2' : '#faeee0',
                            color: done ? '#3f7a4a' : ready ? '#2b6f8a' : '#b5742e',
                          }}
                        >
                          <span style={{ font: "500 13px 'Iansui'" }}>
                            {done ? '✓' : ready ? '✓' : '○'} {l.name.replace(/（豆）$/, '')} · {l.detail}
                          </span>
                          <span style={{ font: "400 11px 'Iansui'" }}>{done ? '已封' : ready ? '可以封' : '等到貨'}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div
                      onClick={() => act(current, coverableIndexes, allCoverable)}
                      className="press"
                      style={{
                        cursor: acting ? 'default' : 'pointer', opacity: acting ? 0.5 : 1,
                        flex: 1, textAlign: 'center', padding: 14, borderRadius: 12,
                        background: '#1a1714', color: '#faf8f3', font: "600 14px 'Iansui'",
                      }}
                    >
                      {allCoverable ? '全部封完' : `部分封完（${coverableIndexes.length}/${remainingCount} 包）`}
                    </div>
                    <div
                      onClick={() => !acting && setSkipped(prev => new Set(prev).add(current.id))}
                      className="press"
                      style={{ cursor: acting ? 'default' : 'pointer', padding: '14px 18px', borderRadius: 12, border: '1px solid #ece5d6', font: "600 14px 'Iansui'", color: '#8a7a68' }}
                    >
                      下一位
                    </div>
                    <div
                      onClick={() => navigate(`/admin/orders/${current.id}/labels`)}
                      className="press"
                      style={{ cursor: 'pointer', padding: '14px 18px', borderRadius: 12, border: '1px solid #ece5d6', font: "600 14px 'Iansui'", color: '#8a7a68' }}
                    >
                      列印標籤
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
