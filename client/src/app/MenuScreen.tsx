import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { CartButton, NoteChip, RoastDots } from '../components';
import { BRAND_NAME, DEFAULT_TEMP, SHOW_SCORES } from '../constants';
import { useCart } from '../cart';
import { useCoffees, useSpecials } from '../useCoffees';
import type { Coffee } from '../types';

function PillRow<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div>
      <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map(o => (
          <div
            key={o.key}
            onClick={() => onChange(o.key)}
            className="press"
            style={{
              padding: '9px 16px', borderRadius: 22, font: "600 13px 'Iansui'",
              background: value === o.key ? '#1a1714' : '#fff',
              color: value === o.key ? '#f4f1ea' : '#4a3c2e',
              border: value === o.key ? 'none' : '1px solid #e4ddcd',
            }}
          >
            {o.label}
          </div>
        ))}
      </div>
    </div>
  );
}

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

type SortKey = 'default' | 'newest' | 'price-asc' | 'price-desc';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: '預設' },
  { key: 'newest', label: '最新上架' },
  { key: 'price-asc', label: '價格低到高' },
  { key: 'price-desc', label: '價格高到低' },
];

// Bag labels are free text like "半磅 227g" or "227公克" - pull the gram count
// back out so beans with different bag sizes can be compared on a common
// per-10g basis. Labels that don't carry a parseable weight fall back to
// raw price further down, so sorting never silently does nothing.
function gramsFromBagLabel(label: string): number | null {
  const m = label.match(/(\d+(?:\.\d+)?)\s*(?:g|公克|克)/i);
  return m ? Number(m[1]) : null;
}

function cheapestPer10g(c: Coffee): number | null {
  const rates = c.bagOptions
    .map(b => {
      const g = gramsFromBagLabel(b.label);
      return g ? (b.price / g) * 10 : null;
    })
    .filter((v): v is number => v !== null);
  return rates.length ? Math.min(...rates) : null;
}

function cheapestBagPrice(c: Coffee): number | null {
  return c.bagOptions.length ? Math.min(...c.bagOptions.map(b => b.price)) : null;
}

// Prefer the weight-normalized rate; if no bag label had a parseable
// weight, fall back to comparing raw bag price rather than excluding
// the coffee from sorting entirely.
function beansPriceMetric(c: Coffee): number | null {
  return cheapestPer10g(c) ?? cheapestBagPrice(c);
}

function sortCoffees(list: Coffee[], sortKey: SortKey, category: CategoryKey): Coffee[] {
  if (sortKey === 'default') return list;
  const sorted = [...list];
  if (sortKey === 'newest') {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted;
  }
  const priceOf = (c: Coffee) => (category === 'beans' ? beansPriceMetric(c) : c.price);
  sorted.sort((a, b) => {
    const av = priceOf(a);
    const bv = priceOf(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return sortKey === 'price-asc' ? av - bv : bv - av;
  });
  return sorted;
}

export function MenuScreen() {
  const navigate = useNavigate();
  const cart = useCart();
  const { coffees } = useCoffees();
  const { specials } = useSpecials();
  const [category, setCategory] = useState<CategoryKey>('drip');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [roasterFilter, setRoasterFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('default');

  useEffect(() => {
    setFilter('all');
    setOriginFilter('all');
    setRoasterFilter('all');
    setSortKey('default');
  }, [category]);

  const title = TITLES[category];

  const categoryCoffees = category === 'beans' ? (coffees ?? []).filter(c => c.sellsBeans) : (coffees ?? []);
  const origins = Array.from(new Set(categoryCoffees.map(c => c.originEN))).filter(Boolean).sort();
  const roasters = Array.from(new Set(categoryCoffees.map(c => c.roaster))).filter(Boolean).sort();
  const visibleCoffees = sortCoffees(
    categoryCoffees.filter(c =>
      inFilter(c, filter) &&
      (originFilter === 'all' || c.originEN === originFilter) &&
      (roasterFilter === 'all' || c.roaster === roasterFilter)
    ),
    sortKey,
    category,
  );

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
        <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 22px 6px', animationDelay: '.2s' }}>
          <PillRow label="烘焙度 ROAST" options={ROAST_FILTERS} value={filter} onChange={setFilter} />
          {origins.length > 1 && (
            <PillRow
              label="產區 ORIGIN"
              options={[{ key: 'all', label: '全部' }, ...origins.map(o => ({ key: o, label: o }))]}
              value={originFilter}
              onChange={setOriginFilter}
            />
          )}
          {roasters.length > 1 && (
            <PillRow
              label="烘豆商 ROASTER"
              options={[{ key: 'all', label: '全部' }, ...roasters.map(r => ({ key: r, label: r }))]}
              value={roasterFilter}
              onChange={setRoasterFilter}
            />
          )}
          <PillRow label="排序 SORT" options={SORT_OPTIONS} value={sortKey} onChange={setSortKey} />
        </div>
      )}

      <div className="rise" style={{ padding: '10px 22px 40px', display: 'flex', flexDirection: 'column', gap: 16, animationDelay: '.32s' }}>
        {category === 'drip' && (
          <>
            {coffees === null && <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>載入中…</div>}
            {coffees && categoryCoffees.length > 0 && visibleCoffees.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>沒有符合篩選條件的咖啡，試試看調整篩選條件</div>
            )}
            {visibleCoffees.map(c => (
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {visibleCoffees.map(c => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/coffee/${c.id}`, { state: { mode: 'beans' } })}
                  className="lift"
                  style={{ cursor: 'pointer', background: '#fff', border: '1px solid #e9e2d3', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ aspectRatio: '3 / 4', background: `linear-gradient(140deg,${c.color}22,#fff)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.coverUrl ? (
                      <img src={c.coverUrl} alt={c.name + ' 豆袋封面'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: c.color, opacity: .7, textAlign: 'center', padding: '0 10px' }}>
                        {c.originEN}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: c.color }}>{c.originEN} · {c.roast}</div>
                    <div style={{ font: "500 17px/1.2 'Room205',serif", color: '#1a1714', marginTop: 5 }}>{c.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                      {c.bagOptions.length === 0 && (
                        <div style={{ font: "400 11px 'Iansui'", color: '#b0a08c' }}>尚未設定零售重量</div>
                      )}
                      {c.bagOptions.map(bag => (
                        <div key={bag.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ font: "500 12px 'Iansui'", color: '#6b5c4a' }}>{bag.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ font: "500 14px 'Room205',serif", color: '#1a1714' }}>${bag.price}</span>
                            <div
                              onClick={(e) => { e.stopPropagation(); cart.addBeans(c, bag, 1); }}
                              className="press"
                              style={{
                                cursor: 'pointer', width: 26, height: 26, borderRadius: '50%', background: c.color, color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', font: "400 15px 'Room205'", flex: 'none',
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
            </div>
            {coffees && categoryCoffees.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>目前沒有開放零售的豆子</div>
            )}
            {coffees && categoryCoffees.length > 0 && visibleCoffees.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>沒有符合篩選條件的豆子，試試看調整篩選條件</div>
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
