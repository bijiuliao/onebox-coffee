import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Coffee, Order } from '../types';
import { AdminTopBar } from './AdminTopBar';
import { parseBagWeightGrams } from '../weight';

interface StockRow {
  id: string;
  name: string;
  roaster: string;
  archived: boolean;
  remainingGrams: number | null;
  soldGrams: number;
  soldRevenue: number;
}

interface RoasterRow {
  roaster: string;
  soldGrams: number;
  soldRevenue: number;
}

interface ProfitRow {
  id: string;
  name: string;
  paidRevenue: number;
  paidGrams: number;
  // null when the bean has no 每克成本 set on its edit page - cost (and so
  // profit) for it is unknown rather than assumed zero, so a bean nobody's
  // priced out yet doesn't silently inflate the total.
  cost: number | null;
  profit: number | null;
}

export function StockView() {
  const navigate = useNavigate();
  const [coffees, setCoffees] = useState<Coffee[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listCoffees(true), api.listOrders()]).then(
      ([c, o]) => { setCoffees(c); setOrders(o); },
      err => setError(err instanceof Error ? err.message : '載入失敗'),
    );
  }, []);

  const loaded = coffees !== null && orders !== null;

  // Sold grams/revenue are summed from each order line's itemId/kind - name
  // alone isn't a stable key (a coffee can be renamed after the order was
  // placed), so this only works for lines that carry itemId. Orders placed
  // before that field existed are silently excluded from these totals
  // rather than guessed at by matching display names.
  const rows: StockRow[] = loaded
    ? coffees
      .filter(c => c.sellsBeans || orders.some(o => o.items.some(l => l.kind === 'beans' && l.itemId === c.id)))
      .map(c => {
        let soldGrams = 0;
        let soldRevenue = 0;
        for (const order of orders) {
          for (const line of order.items) {
            if (line.kind !== 'beans' || line.itemId !== c.id) continue;
            soldRevenue += line.linePrice;
            const grams = parseBagWeightGrams(line.detail);
            if (grams !== null) soldGrams += grams * line.qty;
          }
        }
        return { id: c.id, name: c.name, roaster: c.roaster, archived: c.archived, remainingGrams: c.stockQty, soldGrams, soldRevenue };
      })
      .sort((a, b) => b.soldRevenue - a.soldRevenue)
    : [];

  const totalRevenue = rows.reduce((sum, r) => sum + r.soldRevenue, 0);

  // Settlement figure: paid orders only (unpaid is money not actually in
  // hand yet), beans retail only (hand-drip/specials have no cost basis to
  // subtract - see Coffee.costPerGramTwd's own comment). A bean with no
  // cost-per-gram set keeps profit as null rather than treating its cost
  // as $0, which would overstate the total.
  const profitRows: ProfitRow[] = loaded
    ? coffees
      .map(c => {
        let paidRevenue = 0;
        let paidGrams = 0;
        for (const order of orders) {
          if (!order.paid) continue;
          for (const line of order.items) {
            if (line.kind !== 'beans' || line.itemId !== c.id) continue;
            paidRevenue += line.linePrice;
            const grams = parseBagWeightGrams(line.detail);
            if (grams !== null) paidGrams += grams * line.qty;
          }
        }
        const cost = c.costPerGramTwd !== null ? Math.round(c.costPerGramTwd * paidGrams) : null;
        return { id: c.id, name: c.name, paidRevenue, paidGrams, cost, profit: cost !== null ? paidRevenue - cost : null };
      })
      .filter(r => r.paidRevenue > 0)
      .sort((a, b) => b.paidRevenue - a.paidRevenue)
    : [];
  const unknownCostCount = profitRows.filter(r => r.profit === null).length;
  const totalPaidRevenue = profitRows.reduce((s, r) => s + r.paidRevenue, 0);
  const totalProfit = profitRows.reduce((s, r) => s + (r.profit ?? 0), 0);

  // Same soldGrams/soldRevenue numbers as the per-coffee rows above, just
  // rolled up by roaster (a coffee's roaster can be blank if never set, so
  // those fall into a shared "未設定" bucket rather than being dropped).
  const roasterRows: RoasterRow[] = loaded
    ? Object.values(
      rows.reduce<Record<string, RoasterRow>>((acc, r) => {
        const key = r.roaster.trim() || '未設定';
        if (!acc[key]) acc[key] = { roaster: key, soldGrams: 0, soldRevenue: 0 };
        acc[key].soldGrams += r.soldGrams;
        acc[key].soldRevenue += r.soldRevenue;
        return acc;
      }, {}),
    ).sort((a, b) => b.soldRevenue - a.soldRevenue)
    : [];

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="stock" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>庫存 / STOCK</div>
          {loaded && <div style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>{rows.length} 款</div>}
        </div>

        {/* soldGrams/soldRevenue are a report aggregated from order history
            (see itemId on each order line), not independently stored - a
            bean sold before that tagging existed won't show up here. */}
        <div style={{ font: "400 11px 'Iansui'", color: '#b0a08c', marginBottom: 18 }}>
          已售出公克數/金額是從訂單紀錄彙整出來的——在這個功能上線之前的舊訂單不會被算進去
        </div>

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && !loaded && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {loaded && profitRows.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 10 }}>盈餘結算（已付款）/ PROFIT</div>
            <div style={{ font: "400 11px 'Iansui'", color: '#b0a08c', marginBottom: 10 }}>
              只算已付款的豆子零售；成本用豆單編輯頁的「每克成本」估算
              {unknownCostCount > 0 && `，${unknownCostCount} 款豆子還沒設定成本，不列入下面的盈餘加總`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {profitRows.map(r => (
                <div key={r.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 12, padding: '11px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ font: "600 14px 'Iansui'", color: '#1a1714' }}>{r.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <span style={{ font: "400 12px 'Space Mono'", color: '#9a8a76' }}>營收 ${r.paidRevenue}</span>
                    <span style={{ font: "400 12px 'Space Mono'", color: '#9a8a76' }}>{r.cost === null ? '未設定成本' : `成本 $${r.cost}`}</span>
                    <span style={{ font: "500 15px 'Room205',serif", color: r.profit === null ? '#b0a08c' : '#1a1714', minWidth: 70, textAlign: 'right' }}>
                      {r.profit === null ? '—' : `$${r.profit}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: 14, background: '#3d6b4f', color: '#faf8f3' }}>
              <span style={{ font: "600 13px 'Iansui'" }}>總盈餘（已付款，不含未設定成本的豆子）</span>
              <span style={{ font: "600 22px 'Room205'" }}>${totalProfit}<span style={{ font: "400 12px 'Space Mono'", opacity: .7, marginLeft: 10 }}>/ 營收 ${totalPaidRevenue}</span></span>
            </div>
          </div>
        )}

        {loaded && roasterRows.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 10 }}>依烘豆商彙總 / BY ROASTER</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {roasterRows.map(r => (
                <div key={r.roaster} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 12, padding: '11px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ font: "600 14px 'Iansui'", color: '#1a1714' }}>{r.roaster}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <span style={{ font: "400 12px 'Space Mono'", color: '#9a8a76' }}>{r.soldGrams}g</span>
                    <span style={{ font: "500 15px 'Room205',serif", color: '#1a1714', minWidth: 70, textAlign: 'right' }}>${r.soldRevenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loaded && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9a8a76', font: "400 14px 'Iansui'" }}>
            還沒有開放零售的豆款
          </div>
        )}

        {loaded && rows.length > 0 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {rows.map(r => (
                <div
                  key={r.id}
                  onClick={() => navigate(`/admin/stock/${encodeURIComponent(r.id)}`)}
                  className="press"
                  style={{ cursor: 'pointer', background: '#fff', border: '1px solid #ece5d6', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
                >
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ font: "500 16px 'Room205',serif", color: '#1a1714' }}>{r.name}</div>
                    {r.archived && (
                      <span style={{ font: "600 10px 'Iansui'", padding: '2px 8px', borderRadius: 10, background: '#f1e9db', color: '#8a7a68' }}>已封存</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 28, flex: 'none' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>剩餘庫存</div>
                      <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>
                        {r.remainingGrams === null ? '未追蹤' : `${r.remainingGrams}g`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>已售出</div>
                      <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>{r.soldGrams}g</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>銷售額</div>
                      <div style={{ font: "500 16px 'Room205'", color: '#1a1714', marginTop: 2 }}>${r.soldRevenue}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: 14, background: '#1a1714', color: '#faf8f3' }}>
              <span style={{ font: "600 13px 'Iansui'" }}>豆子零售總銷售額</span>
              <span style={{ font: "600 22px 'Room205'" }}>${totalRevenue}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
