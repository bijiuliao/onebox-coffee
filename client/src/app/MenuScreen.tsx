import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { MobileShell } from '../AppShell';
import { CartButton, LangToggle, NoteChip, RoastDots } from '../components';
import { BRAND_NAME, SHOW_SCORES } from '../constants';
import { isSoldOut, useCart } from '../cart';
import { useLang } from '../i18n';
import { useArchivedCoffees, useCoffees, useSpecials } from '../useCoffees';
import type { Coffee } from '../types';

function PillOptions<T extends string>({ options, value, onChange }: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
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
  );
}

// Multi-select checkbox list (round custom checkboxes), modeled on onyx
// coffee lab's filter panel - lets a customer pick several values in the
// same category (e.g. two origins at once) instead of just one.
function CheckboxList<T extends string>({ options, selected, onToggle }: {
  options: readonly { key: T; label: string }[];
  selected: ReadonlySet<T>;
  onToggle: (key: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {options.map(o => {
        const checked = selected.has(o.key);
        return (
          <div key={o.key} onClick={() => onToggle(o.key)} className="press" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%', flex: 'none',
              border: checked ? 'none' : '1px solid #c2b9a6',
              background: checked ? '#1a1714' : 'transparent',
              transition: 'background .12s ease',
            }} />
            <span style={{ font: "500 14px 'Iansui'", color: '#4a3c2e' }}>{o.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function AccordionRow({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid #ece5d6' }}>
      <div onClick={onToggle} className="press" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '17px 2px' }}>
        <span style={{ font: "600 15px 'Iansui'", color: '#1a1714' }}>{title}</span>
        <span style={{ font: "400 20px 'Room205'", color: '#9a8a76', lineHeight: 1 }}>{isOpen ? '−' : '+'}</span>
      </div>
      {isOpen && <div style={{ paddingBottom: 18 }}>{children}</div>}
    </div>
  );
}

// Page-edge gutter: stays 22px on mobile, grows with the viewport once the
// shell goes full-bleed on desktop so content doesn't hug the browser edge.
const PAD_X = 'clamp(22px, 4vw, 64px)';

const CATEGORY_KEYS = ['drip', 'beans', 'special', 'history'] as const;
type CategoryKey = typeof CATEGORY_KEYS[number];

const ROAST_FILTER_KEYS = ['light', 'mid', 'dark'] as const;
type RoastFilterKey = typeof ROAST_FILTER_KEYS[number];
const ROAST_FILTER_I18N: Record<RoastFilterKey, string> = {
  light: 'filter.roastLight', mid: 'filter.roastMid', dark: 'filter.roastDark',
};

function matchesRoastFilter(c: Coffee, selected: ReadonlySet<RoastFilterKey>) {
  if (selected.size === 0) return true;
  if (selected.has('light') && c.level <= 2) return true;
  if (selected.has('mid') && c.level === 3) return true;
  if (selected.has('dark') && c.level >= 4) return true;
  return false;
}

type SortKey = 'default' | 'newest' | 'price-asc' | 'price-desc';
const SORT_KEYS: SortKey[] = ['default', 'newest', 'price-asc', 'price-desc'];
const SORT_I18N: Record<SortKey, string> = {
  default: 'sort.default', newest: 'sort.newest', 'price-asc': 'sort.priceAsc', 'price-desc': 'sort.priceDesc',
};

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

function isCategoryKey(v: unknown): v is CategoryKey {
  return typeof v === 'string' && (CATEGORY_KEYS as readonly string[]).includes(v);
}

type FilterSection = 'roast' | 'origin' | 'roaster' | 'sort';

export function MenuScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const { t } = useLang();
  const { coffees } = useCoffees();
  const { specials } = useSpecials();
  const { coffees: archivedCoffees } = useArchivedCoffees();
  // Returning from a coffee's detail page (via its back button) restores
  // whichever tab the customer actually came from, instead of always
  // bouncing back to 手沖咖啡.
  const initialCategory = (location.state as { category?: unknown } | null)?.category;
  const [category, setCategory] = useState<CategoryKey>(isCategoryKey(initialCategory) ? initialCategory : 'drip');
  // Empty set == no restriction on that category (matches every coffee),
  // same convention onyx coffee lab's filter checkboxes use.
  const [roastFilter, setRoastFilter] = useState<Set<RoastFilterKey>>(() => new Set());
  const [originFilter, setOriginFilter] = useState<Set<string>>(() => new Set());
  const [roasterFilter, setRoasterFilter] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [filterOpen, setFilterOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<FilterSection>>(() => new Set(['roast']));

  useEffect(() => {
    setRoastFilter(new Set());
    setOriginFilter(new Set());
    setRoasterFilter(new Set());
    setSortKey('default');
    setFilterOpen(false);
  }, [category]);

  useEffect(() => {
    if (!filterOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [filterOpen]);

  const title = {
    eyebrow: t(`title.${category}.eyebrow`),
    heading: [t(`title.${category}.heading1`), t(`title.${category}.heading2`)] as [string, string],
  };
  const categories = CATEGORY_KEYS.map(k => ({ key: k, label: t(`category.${k}`) }));
  const roastFilterOptions = ROAST_FILTER_KEYS.map(k => ({ key: k, label: t(ROAST_FILTER_I18N[k]) }));
  const sortOptions = SORT_KEYS.map(k => ({ key: k, label: t(SORT_I18N[k]) }));

  const categoryCoffees = category === 'beans' ? (coffees ?? []).filter(c => c.sellsBeans) : (coffees ?? []);
  const origins = Array.from(new Set(categoryCoffees.map(c => c.originEN))).filter(Boolean).sort();
  const roasters = Array.from(new Set(categoryCoffees.map(c => c.roaster))).filter(Boolean).sort();
  const visibleCoffees = sortCoffees(
    categoryCoffees.filter(c =>
      matchesRoastFilter(c, roastFilter) &&
      (originFilter.size === 0 || originFilter.has(c.originEN)) &&
      (roasterFilter.size === 0 || roasterFilter.has(c.roaster))
    ),
    sortKey,
    category,
  );
  const activeFilterCount = [roastFilter.size > 0, originFilter.size > 0, roasterFilter.size > 0, sortKey !== 'default'].filter(Boolean).length;
  const clearAllFilters = () => {
    setRoastFilter(new Set());
    setOriginFilter(new Set());
    setRoasterFilter(new Set());
    setSortKey('default');
  };
  function toggleInSet<T>(setFn: (updater: (prev: Set<T>) => Set<T>) => void, key: T) {
    setFn(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function toggleSection(key: FilterSection) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <MobileShell wide>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#f4f1ea', padding: `20px ${PAD_X} 12px`, borderBottom: '1px solid #e4ddcd' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div onClick={() => navigate('/')} className="press" style={{ cursor: 'pointer', font: "500 19px 'Room205',serif", color: '#1a1714' }}>
            {BRAND_NAME}<span style={{ color: '#c98a2e' }}>.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LangToggle />
            <CartButton count={cart.count} onClick={() => navigate('/cart')} />
          </div>
        </div>
      </div>

      <div className="rise" style={{ display: 'flex', gap: 8, padding: `18px ${PAD_X} 0`, maxWidth: 560, animationDelay: '.04s' }}>
        {categories.map(c => (
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

      <div className="rise" style={{ padding: `20px ${PAD_X} 6px`, animationDelay: '.08s' }}>
        <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#8a7a68' }}>{title.eyebrow}</div>
        <div style={{ font: "600 34px/1.1 'Iansui',serif", color: '#1a1714', marginTop: 10 }}>{title.heading[0]}<br />{title.heading[1]}</div>
        {category === 'history' && (
          <div style={{ font: "400 13px 'Iansui'", color: '#9a8a76', marginTop: 10 }}>{t('menu.historyHint')}</div>
        )}
      </div>

      {category !== 'special' && category !== 'history' && (
        <div className="rise" style={{ padding: `16px ${PAD_X} 6px`, animationDelay: '.2s' }}>
          <div
            onClick={() => setFilterOpen(true)}
            className="press"
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 22,
              background: filterOpen ? '#1a1714' : '#fff', border: filterOpen ? 'none' : '1px solid #e4ddcd',
              font: "700 12px 'Space Mono'", letterSpacing: 1, color: filterOpen ? '#f4f1ea' : '#4a3c2e', transition: 'all .2s ease',
            }}
          >
            {t('filter.button')}
            {activeFilterCount > 0 && (
              <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: filterOpen ? '#f4f1ea' : '#1a1714', color: filterOpen ? '#1a1714' : '#fff', font: "700 10px 'Space Mono'", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {activeFilterCount}
              </span>
            )}
          </div>
        </div>
      )}

      {filterOpen && createPortal(
        <div className="mobile-shell mobile-shell-wide" style={{ position: 'fixed', inset: 0, margin: '0 auto', zIndex: 40, overflow: 'hidden' }}>
          <div onClick={() => setFilterOpen(false)} className="filter-backdrop" style={{ position: 'absolute', inset: 0, background: 'rgba(26,23,20,.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          <div className="filter-drawer" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '80%', maxWidth: 360, background: '#f4f1ea', zIndex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '24px 0 50px -20px rgba(30,22,16,.4)' }}>
            <div style={{ padding: '22px 22px 16px', borderBottom: '1px solid #e4ddcd' }}>
              <span style={{ font: "700 18px 'Iansui'" }}>{t('filter.title')}</span>
              <div style={{ font: "600 12px 'Space Mono'", color: '#9a8a76', marginTop: 6 }}>{t('filter.results', { count: visibleCoffees.length })}</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '2px 22px' }}>
              <AccordionRow title={t('filter.roast')} isOpen={openSections.has('roast')} onToggle={() => toggleSection('roast')}>
                <CheckboxList options={roastFilterOptions} selected={roastFilter} onToggle={k => toggleInSet(setRoastFilter, k)} />
              </AccordionRow>
              {origins.length > 1 && (
                <AccordionRow title={t('filter.origin')} isOpen={openSections.has('origin')} onToggle={() => toggleSection('origin')}>
                  <CheckboxList
                    options={origins.map(o => ({ key: o, label: o }))}
                    selected={originFilter}
                    onToggle={k => toggleInSet(setOriginFilter, k)}
                  />
                </AccordionRow>
              )}
              {roasters.length > 1 && (
                <AccordionRow title={t('filter.roaster')} isOpen={openSections.has('roaster')} onToggle={() => toggleSection('roaster')}>
                  <CheckboxList
                    options={roasters.map(r => ({ key: r, label: r }))}
                    selected={roasterFilter}
                    onToggle={k => toggleInSet(setRoasterFilter, k)}
                  />
                </AccordionRow>
              )}
              <AccordionRow title={t('filter.sort')} isOpen={openSections.has('sort')} onToggle={() => toggleSection('sort')}>
                <PillOptions options={sortOptions} value={sortKey} onChange={setSortKey} />
              </AccordionRow>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px 22px', alignItems: 'center' }}>
              {activeFilterCount > 0 && (
                <div onClick={clearAllFilters} className="press" style={{ cursor: 'pointer', font: "600 13px 'Iansui'", color: '#8a7a68', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                  {t('filter.clearAll')}
                </div>
              )}
              <div onClick={() => setFilterOpen(false)} className="press" style={{ cursor: 'pointer', flex: 1, textAlign: 'center', background: '#1a1714', color: '#f4f1ea', borderRadius: 16, padding: 16, font: "600 15px 'Iansui'" }}>
                {t('filter.done')}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <div className="rise" style={{ padding: `10px ${PAD_X} 40px`, animationDelay: '.32s' }}>
        {category === 'drip' && (
          <>
            {coffees === null && <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>{t('common.loading')}</div>}
            {coffees && categoryCoffees.length > 0 && visibleCoffees.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>{t('menu.noDripMatch')}</div>
            )}
            <div className="coffee-grid coffee-grid-1col">
              {visibleCoffees.map(c => {
                const soldOut = isSoldOut(c);
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/coffee/${c.id}`, { state: { fromCategory: 'drip' } })}
                    className="lift"
                    style={{ cursor: 'pointer', background: '#fff', border: '1px solid #e9e2d3', borderRadius: 22, overflow: 'hidden', opacity: soldOut ? .6 : 1 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', background: c.color + '22', color: c.color }}>
                      <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5 }}>{c.originEN}</span>
                      {soldOut ? (
                        <span style={{ padding: '4px 10px', borderRadius: 12, background: '#1a1714', color: '#fff', font: "700 10px 'Space Mono'" }}>{t('stock.soldOut')}</span>
                      ) : SHOW_SCORES && <span style={{ font: "700 11px 'Space Mono'", color: c.color }}>⌾ {c.score}</span>}
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
                        <span style={{ font: "500 18px 'Room205',serif", color: '#1a1714' }}>${c.price}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {category === 'beans' && (
          <>
            {coffees === null && <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>{t('common.loading')}</div>}
            <div className="coffee-grid coffee-grid-2col">
              {visibleCoffees.map(c => {
                const soldOut = isSoldOut(c);
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/coffee/${c.id}`, { state: { mode: 'beans', fromCategory: 'beans' } })}
                    className="lift"
                    style={{ cursor: 'pointer', background: '#fff', border: '1px solid #e9e2d3', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: soldOut ? .6 : 1 }}
                  >
                    <div style={{ aspectRatio: '3 / 4', position: 'relative', background: `linear-gradient(140deg,${c.color}22,#fff)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.coverUrl ? (
                        <img src={c.coverUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: c.color, opacity: .7, textAlign: 'center', padding: '0 10px' }}>
                          {c.originEN}
                        </span>
                      )}
                      {soldOut && (
                        <span style={{ position: 'absolute', top: 10, right: 10, padding: '4px 10px', borderRadius: 12, background: '#1a1714', color: '#fff', font: "700 10px 'Space Mono'" }}>{t('stock.soldOut')}</span>
                      )}
                    </div>
                    <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: c.color }}>{c.originEN} · {c.roast}</div>
                      <div style={{ font: "500 17px/1.2 'Room205',serif", color: '#1a1714', marginTop: 5 }}>{c.name}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                        {c.bagOptions.length === 0 && (
                          <div style={{ font: "400 11px 'Iansui'", color: '#b0a08c' }}>{t('menu.noBagOptions')}</div>
                        )}
                        {c.bagOptions.map(bag => (
                          <div key={bag.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ font: "500 12px 'Iansui'", color: '#6b5c4a' }}>{bag.label}</span>
                            <span style={{ font: "500 14px 'Room205',serif", color: '#1a1714' }}>${bag.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {coffees && categoryCoffees.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>{t('menu.noBeansAtAll')}</div>
            )}
            {coffees && categoryCoffees.length > 0 && visibleCoffees.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>{t('menu.noBeansMatch')}</div>
            )}
          </>
        )}

        {category === 'special' && (
          <>
            {specials === null && <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>{t('common.loading')}</div>}
            {specials?.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>{t('menu.noSpecialsToday')}</div>
            )}
            <div className="coffee-grid coffee-grid-1col">
              {specials?.map(s => (
                <div key={s.id} style={{ background: '#fff', border: '1px solid #e9e2d3', borderRadius: 22, overflow: 'hidden' }}>
                  <div style={{ padding: '11px 18px', background: s.color + '22', color: s.color }}>
                    <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5 }}>{t('menu.specialBadge')}</span>
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
            </div>
          </>
        )}

        {category === 'history' && (
          <>
            {archivedCoffees === null && <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76' }}>{t('common.loading')}</div>}
            {archivedCoffees?.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9a8a76', font: "400 14px 'Iansui'" }}>{t('menu.noHistory')}</div>
            )}
            <div className="coffee-grid coffee-grid-2col">
              {archivedCoffees?.map(c => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/coffee/${c.id}`, { state: { fromCategory: 'history' } })}
                  className="lift"
                  style={{ cursor: 'pointer', background: '#fff', border: '1px solid #e9e2d3', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: .75 }}
                >
                  <div style={{ aspectRatio: '3 / 4', position: 'relative', background: `linear-gradient(140deg,${c.color}22,#fff)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.coverUrl ? (
                      <img src={c.coverUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(.3)' }} />
                    ) : (
                      <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: c.color, opacity: .7, textAlign: 'center', padding: '0 10px' }}>
                        {c.originEN}
                      </span>
                    )}
                    <span style={{ position: 'absolute', top: 10, right: 10, padding: '4px 10px', borderRadius: 12, background: '#1a1714', color: '#fff', font: "700 10px 'Space Mono'" }}>{t('stock.discontinued')}</span>
                  </div>
                  <div style={{ padding: '12px 12px 14px' }}>
                    <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: c.color }}>{c.originEN} · {c.roast}</div>
                    <div style={{ font: "500 17px/1.2 'Room205',serif", color: '#1a1714', marginTop: 5 }}>{c.name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {c.notes.map(n => <NoteChip key={n} label={n} color={c.color} soft={c.color + '22'} />)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}
