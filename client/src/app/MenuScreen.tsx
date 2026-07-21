import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { CartButton, NoteChip, RoastDots } from '../components';
import { BRAND_NAME, DEFAULT_TEMP, SHOW_SCORES } from '../constants';
import { useCart } from '../cart';
import { useCoffees, useSpecials } from '../useCoffees';
import type { Coffee } from '../types';

const CATEGORIES = [
  { key: 'drip', label: '手沖咖啡' },
  { key: 'beans', label: '買豆子' },
  { key: 'special', label: '特調' },
] as const;
type CategoryKey = typeof CATEGORIES[number]['key'];

const TITLES: Record<CategoryKey, { eyebrow: string; heading: [string, string] }> = {
  drip: { eyebrow: "TODAY'S DRIP BAR · 本日手沖", heading: ['今天，', '想喝哪一支？'] },
  beans: { eyebrow: 'BEANS TO GO · 買豆子回家', heading: ['想帶哪支豆子', '回家？'] },
  special: { eyebrow: "TODAY'S SPECIAL · 本日特調", heading: ['今天，', '想喝點特別的？'] },
};

const ROAST_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'light', label: '淺' },
  { key: 'mid', label: '中' },
  { key: 'dark', label: '深' },
] as const;
type FilterKey = typeof ROAST_FILTERS[number]['key'];

function inFilter(c: Coffee, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'light') return c.level <= 2;
  if (filter === 'mid') return c.level === 3;
  return c.level >= 4;
}

export function MenuScreen() {
  const navigate = useNavigate();
  const cart = useCart();
  const { coffees } = useCoffees();
  const { specials } = useSpecials();
  const [category, setCategory] = useState<CategoryKey>('drip');
  const [filter, setFilter] = useState<FilterKey>('all');

  const title = TITLES[category];

  return (
    <MobileShell>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#f4f1ea', padding: '20px 22px 12px', borderBottom: '1px solid #e4ddcd' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div onClick={() => navigate('/')} className="press" style={{ cursor: 'pointer', font: "500 19px 'Room205',serif", color: '#1a1714' }}>
            {BRAND_NAME}<span style={{ color: '#c98a2e' }}>.</span>
          </div>
          <CartButton count={cart.count} onClick={() => navigate('/cart')} />
        </div>
      </div>

      <div className="rise" style={{ display: 'flex', gap: 8, padding: '18px 22px 0', animationDelay: '.04s' }}>
        {CATEGORIES.map(c => (
          <div
            key={c.key}
            onClick={() => setCategory(c.key)}
            className="press"
            style={{
              flex: 1, textAlign: 'center', padding: '11px 8px', borderRadius: 14, font: "600 13px 'Iansui'",
              background: category === c.key ? '#1a1714' : '#fff',
              color: category === c.key ? '#f4f1ea' : '#4a3c2e',
              border: category === c.key ? 'none' : '1px solid #e4ddcd',
            }}
          >
            {c.label}
          </div>
        ))}
      </div>

      <div className="rise" style={{ padding: '20px 22px 6px', animationDelay: '.08s' }}>
        <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#8a7a68' }}>{title.eyebrow}</div>
        <div style={{ font: "600 34px/1.1 'Iansui',serif", color: '#1a1714', marginTop: 10 }}>{title.heading[0]}<br />{title.heading[1]}</div>
      </div>

      {category !== 'special' && (
        <div className="rise" style={{ display: 'flex', gap: 8, padding: '16px 22px 6px', flexWrap: 'wrap', animationDelay: '.2s' }}>
          {ROAST_FILTERS.map(r => (
            <div
              key={r.key}
              onClick={() => setFilter(r.key)}
              className="press"
              style={{
                padding: '9px 16px', borderRadius: 22, font: "600 13px 'Iansui'",
                background: filter === r.key ? '#1a1714' : '#fff',
                color: filter === r.key ? '#f4f1ea' : '#4a3c2e',
                border: filter === r.key ? 'none' : '1px solid #e4ddcd',
              }}
            >
              {r.label}
            </div>
          ))}
        </div>
      )}

      <div className="rise" style={{ padding: '10px 22px 40px', display: 'flex', flexDirection: 'column', gap: 16, animationDelay: '.32s' }}>
        {category === 'drip' && (
          <>
            {coffees === null && <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>載入中…</div>}
            {coffees?.filter(c => inFilter(c, filter)).map(c => (
              <div
                key={c.id}
                onClick={() => navigate(`/coffee/${c.id}`)}
                className="lift"
                style={{ cursor: 'pointer', background: '#fff', border: '1px solid #e9e2d3', borderRadius: 22, overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', background: c.color + '22', color: c.color }}>
                  <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5 }}>{c.originEN}</span>
                  {SHOW_SCORES && <span style={{ font: "700 11px 'Space Mono'", color: c.color }}>⌾ {c.score}</span>}
                </div>
                <div style={{ padding: '16px 18px 18px' }}>
                  <div style={{ font: "500 22px/1.15 'Room205',serif", color: '#1a1714' }}>{c.name}</div>
                  <div style={{ font: "400 13px 'Space Mono'", color: '#9a8a76', marginTop: 3 }}>{c.originEN} · {c.roast}</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
                    {c.notes.map(n => <NoteChip key={n} label={n} color={c.color} soft={c.color + '22'} />)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ font: "700 9px 'Space Mono'", color: '#b0a08c', letterSpacing: 1 }}>ROAST</span>
                      <RoastDots level={c.level} color={c.color} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ font: "500 18px 'Room205',serif", color: '#1a1714' }}>${c.price}</span>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          cart.addDrip(c, DEFAULT_TEMP, '標準', 1);
                        }}
                        className="press"
                        style={{
                          cursor: 'pointer', width: 38, height: 38, borderRadius: '50%', background: c.color, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', font: "400 22px 'Room205'",
                        }}
                      >
                        ＋
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {category === 'beans' && (
          <>
            {coffees === null && <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>載入中…</div>}
            {coffees?.filter(c => c.sellsBeans && inFilter(c, filter)).map(c => (
              <div key={c.id} style={{ background: '#fff', border: '1px solid #e9e2d3', borderRadius: 22, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', background: c.color + '22', color: c.color }}>
                  <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5 }}>{c.originEN}</span>
                  {SHOW_SCORES && <span style={{ font: "700 11px 'Space Mono'", color: c.color }}>⌾ {c.score}</span>}
                </div>
                <div style={{ padding: '16px 18px 18px' }}>
                  <div style={{ font: "500 22px/1.15 'Room205',serif", color: '#1a1714' }}>{c.name}</div>
                  <div style={{ font: "400 13px 'Space Mono'", color: '#9a8a76', marginTop: 3 }}>{c.originEN} · {c.roast}</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
                    {c.notes.map(n => <NoteChip key={n} label={n} color={c.color} soft={c.color + '22'} />)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                    {c.bagOptions.length === 0 && (
                      <div style={{ font: "400 12px 'Iansui'", color: '#b0a08c' }}>尚未設定零售重量</div>
                    )}
                    {c.bagOptions.map(bag => (
                      <div key={bag.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderTop: '1px solid #f0ebdf' }}>
                        <span style={{ font: "500 14px 'Iansui'", color: '#4a3c2e' }}>{bag.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ font: "500 16px 'Room205',serif", color: '#1a1714' }}>${bag.price}</span>
                          <div
                            onClick={() => cart.addBeans(c, bag, 1)}
                            className="press"
                            style={{
                              cursor: 'pointer', width: 32, height: 32, borderRadius: '50%', background: c.color, color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', font: "400 18px 'Room205'",
                            }}
                          >
                            ＋
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {coffees && coffees.filter(c => c.sellsBeans).length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>目前沒有開放零售的豆子</div>
            )}
          </>
        )}

        {category === 'special' && (
          <>
            {specials === null && <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>載入中…</div>}
            {specials?.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>今天還沒有特調</div>
            )}
            {specials?.map(s => (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #e9e2d3', borderRadius: 22, overflow: 'hidden' }}>
                <div style={{ padding: '11px 18px', background: s.color + '22', color: s.color }}>
                  <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5 }}>SPECIAL · 特調</span>
                </div>
                <div style={{ padding: '16px 18px 18px' }}>
                  <div style={{ font: "500 22px/1.15 'Room205',serif", color: '#1a1714' }}>{s.name}</div>
                  {s.desc && <div style={{ font: "400 13px 'Iansui'", color: '#6b5c4a', marginTop: 6 }}>{s.desc}</div>}
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
                    {s.notes.map(n => <NoteChip key={n} label={n} color={s.color} soft={s.color + '22'} />)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                    <span style={{ font: "500 18px 'Room205',serif", color: '#1a1714' }}>${s.price}</span>
                    <div
                      onClick={() => cart.addSpecial(s, s.temps.hot ? '熱' : '冰', 1)}
                      className="press"
                      style={{
                        cursor: 'pointer', width: 38, height: 38, borderRadius: '50%', background: s.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', font: "400 22px 'Room205'",
                      }}
                    >
                      ＋
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </MobileShell>
  );
}
