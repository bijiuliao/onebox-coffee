import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { BrewKind, BrewRecipe, Coffee, Ingredient, PourStep, Special } from '../types';
import { AdminTopBar } from './AdminTopBar';
import { useToast } from '../toast';

// Admin brewing log: record how each of the shop's own beans was brewed,
// split into 義式 / 手沖 / 特調. The bean is always picked from the existing
// coffees catalog (including archived ones), so recipes stay tied to the
// real bean even after it's renamed. A recipe being edited lives in a local
// draft until 儲存 - id null means "not created on the server yet".

type Draft = Omit<BrewRecipe, 'id' | 'createdAt' | 'updatedAt'> & { id: number | null };

const KINDS: { key: BrewKind; label: string; en: string; accent: string }[] = [
  { key: 'espresso', label: '義式', en: 'ESPRESSO', accent: '#8f4a30' },
  { key: 'pourover', label: '手沖', en: 'POUR-OVER', accent: '#c98a2e' },
  { key: 'special', label: '特調', en: 'SIGNATURE', accent: '#9a4f7d' },
];

function isKind(v: string | null): v is BrewKind {
  return v === 'espresso' || v === 'pourover' || v === 'special';
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultParams(kind: BrewKind): Draft['params'] {
  if (kind === 'espresso') return { dose: 18, yield: 36, time: 28, temp: 93, grind: '', preinfusion: null, pressure: 9, equipment: '' };
  if (kind === 'pourover') {
    return {
      dose: 15, water: 240, temp: 92, grind: '', dripper: 'V60', filter: '', totalTime: '2:30',
      pours: [{ at: '0:00', water: 30, note: '悶蒸' }, { at: '0:30', water: 120, note: '' }, { at: '1:10', water: 90, note: '' }],
    };
  }
  return { serve: '冰', base: 'espresso', dose: 18, yield: 36, time: 28, ingredients: [{ name: '牛奶', amount: 180, unit: 'ml' }], steps: [''], glass: '' };
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

function ratio(dose: number | null | undefined, out: number | null | undefined): string | null {
  if (!dose || !out) return null;
  return `1 : ${fmt(out / dose)}`;
}

function summary(r: Draft, specials: Special[]): string {
  const p = r.params;
  if (r.kind === 'espresso') {
    const parts = [`${fmt(p.dose)}g → ${fmt(p.yield)}g`];
    if (p.time) parts.push(`${fmt(p.time)}s`);
    const rt = ratio(p.dose, p.yield);
    if (rt) parts.push(rt);
    return parts.join(' · ');
  }
  if (r.kind === 'pourover') {
    const parts = [`${fmt(p.dose)}g : ${fmt(p.water)}g`];
    if (p.temp) parts.push(`${fmt(p.temp)}°C`);
    const rt = ratio(p.dose, p.water);
    if (rt) parts.push(rt);
    return parts.join(' · ');
  }
  const parts: string[] = [];
  const sp = specials.find(s => s.id === r.specialId);
  if (sp) parts.push(sp.name);
  if (p.serve) parts.push(p.serve);
  const n = (p.ingredients ?? []).filter(i => i.name.trim()).length;
  if (n) parts.push(`${n} 種材料`);
  return parts.join(' · ') || '—';
}

function toDraft(r: BrewRecipe): Draft {
  return { id: r.id, kind: r.kind, coffeeId: r.coffeeId, specialId: r.specialId, title: r.title, params: r.params, notes: r.notes, rating: r.rating, favorite: r.favorite, brewedOn: r.brewedOn };
}

function payload(d: Draft) {
  return { kind: d.kind, coffeeId: d.coffeeId, specialId: d.specialId, title: d.title, params: d.params, notes: d.notes, rating: d.rating, favorite: d.favorite, brewedOn: d.brewedOn };
}

function useNarrow(maxWidth = 900) {
  const query = `(max-width: ${maxWidth}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

// ---------- small form pieces ----------

const labelStyle: CSSProperties = { font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 8, display: 'block' };
const inputStyle: CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2dac9', borderRadius: 10, background: '#fff', font: "400 15px 'Iansui'", color: '#1a1714', outline: 'none' };
const section: CSSProperties = { background: '#fff', border: '1px solid #ece5d6', borderRadius: 18, padding: 20, marginBottom: 18 };
const sectionTitle: CSSProperties = { font: "700 11px 'Space Mono'", letterSpacing: 3, color: '#1a1714', marginBottom: 16 };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 };

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={section}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 10 }}>
        <div style={{ ...sectionTitle, whiteSpace: 'nowrap' }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function NumField({ label, unit, value, onChange, step = 0.1 }: { label: string; unit?: string; value: number | null | undefined; onChange: (v: number | null) => void; step?: number }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          style={{ ...inputStyle, font: "500 17px 'Room205'", paddingRight: unit ? 40 : 12 }}
        />
        {unit && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', font: "700 11px 'Space Mono'", color: '#9a8a76', pointerEvents: 'none' }}>{unit}</span>}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string | undefined; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110, padding: '12px 14px', borderRadius: 12, background: accent + '14' }}>
      <div style={{ font: "700 9px 'Space Mono'", letterSpacing: 1.5, color: accent }}>{label}</div>
      <div style={{ font: "500 22px 'Room205'", color: '#1a1714', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Stars({ value, onChange, size = 22 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={onChange ? () => onChange(value === n ? null : n) : undefined}
          className={onChange ? 'press' : undefined}
          style={{ cursor: onChange ? 'pointer' : 'default', fontSize: size, lineHeight: 1, color: value !== null && n <= value ? '#c98a2e' : '#ddd3c1' }}
        >★</span>
      ))}
    </div>
  );
}

const smallBtn: CSSProperties = { cursor: 'pointer', font: "600 12px 'Iansui'", color: '#8a7a68', padding: '6px 10px', borderRadius: 8, border: '1px dashed #d3c9b6', background: '#faf7f0', whiteSpace: 'nowrap' };
const removeBtn: CSSProperties = { cursor: 'pointer', flex: 'none', width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b0a08c', fontWeight: 700, background: '#faf7f0' };

// ---------- main view ----------

export function RecipesView() {
  const { showToast } = useToast();
  const narrow = useNarrow();
  const [searchParams, setSearchParams] = useSearchParams();
  const kindParam = searchParams.get('kind');
  const kind: BrewKind = isKind(kindParam) ? kindParam : 'espresso';

  const [coffees, setCoffees] = useState<Coffee[] | null>(null);
  const [specials, setSpecials] = useState<Special[]>([]);
  const [recipes, setRecipes] = useState<BrewRecipe[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [beanFilter, setBeanFilter] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.listCoffees(true), api.listSpecials(true), api.listBrewRecipes()])
      .then(([c, s, r]) => { setCoffees(c); setSpecials(s); setRecipes(r); })
      .catch(err => setLoadError(err instanceof Error ? err.message : '載入失敗'));
  }, []);

  const coffeeById = useMemo(() => new Map((coffees ?? []).map(c => [c.id, c])), [coffees]);
  const original = draft?.id != null ? recipes?.find(r => r.id === draft.id) : undefined;
  const dirty = !!draft && (draft.id === null || JSON.stringify(payload(draft)) !== JSON.stringify(payload(toDraft(original!))));
  const meta = KINDS.find(k => k.key === kind)!;

  const confirmDiscard = () => !dirty || window.confirm('這筆食譜還有未儲存的變更，確定要放棄嗎？');

  const switchKind = (k: BrewKind) => {
    if (k === kind || !confirmDiscard()) return;
    setDraft(null);
    setSearchParams({ kind: k }, { replace: true });
  };

  const select = (r: BrewRecipe) => {
    if (draft?.id === r.id) return;
    if (!confirmDiscard()) return;
    setDraft(toDraft(r));
  };

  const startNew = () => {
    if (!confirmDiscard()) return;
    // Prefill from the latest recipe of this kind for the chosen bean (or the
    // bean used most recently), so dialing in a bean starts from last time.
    const ofKind = (recipes ?? []).filter(r => r.kind === kind);
    const coffeeId = beanFilter || ofKind[0]?.coffeeId || (coffees ?? []).find(c => !c.archived)?.id || null;
    const last = ofKind.find(r => r.coffeeId === coffeeId);
    setDraft({
      id: null, kind, coffeeId, specialId: last?.specialId ?? null, title: '',
      params: last ? structuredClone(last.params) : defaultParams(kind),
      notes: '', rating: null, favorite: false, brewedOn: today(),
    });
  };

  const duplicate = () => {
    if (!draft) return;
    if (!confirmDiscard()) return;
    const base = original ? toDraft(original) : draft;
    setDraft({ ...structuredClone(base), id: null, brewedOn: today(), rating: null, favorite: false, notes: '' });
    showToast('已複製成新紀錄，調整參數後記得儲存');
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const saved = draft.id === null
        ? await api.createBrewRecipe(payload(draft))
        : await api.updateBrewRecipe(draft.id, payload(draft));
      setRecipes(prev => {
        const rest = (prev ?? []).filter(r => r.id !== saved.id);
        return [saved, ...rest].sort((a, b) => (a.brewedOn === b.brewedOn ? b.id - a.id : a.brewedOn < b.brewedOn ? 1 : -1));
      });
      setDraft(toDraft(saved));
      showToast('已儲存食譜');
    } catch (err) {
      showToast(err instanceof Error ? `儲存失敗：${err.message}` : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft) return;
    if (draft.id === null) { setDraft(null); return; }
    if (!window.confirm('確定要刪除這筆食譜嗎？刪除後無法復原。')) return;
    try {
      await api.deleteBrewRecipe(draft.id);
      const id = draft.id;
      setRecipes(prev => (prev ?? []).filter(r => r.id !== id));
      setDraft(null);
      showToast('已刪除');
    } catch (err) {
      showToast(err instanceof Error ? `刪除失敗：${err.message}` : '刪除失敗');
    }
  };

  const shell = (body: ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <div style={{ overflowX: 'auto' }}><AdminTopBar active="recipes" /></div>
      {body}
    </div>
  );

  if (loadError) return shell(<div style={{ padding: 80, textAlign: 'center', color: '#c8342b' }}>載入失敗：{loadError}</div>);
  if (!coffees || !recipes) return shell(<div style={{ padding: 80, textAlign: 'center', color: '#9a8a76' }}>載入中…</div>);

  const ofKind = recipes.filter(r => r.kind === kind);
  const visible = ofKind.filter(r => (!beanFilter || r.coffeeId === beanFilter) && (!favOnly || r.favorite));
  const beansUsed = new Set(ofKind.map(r => r.coffeeId).filter(Boolean));
  const activeCoffees = coffees.filter(c => !c.archived);
  const archivedCoffees = coffees.filter(c => c.archived);

  const patch = (p: Partial<Draft>) => setDraft(d => (d ? { ...d, ...p } : d));
  const patchParams = (p: Partial<Draft['params']>) => setDraft(d => (d ? { ...d, params: { ...d.params, ...p } } : d));

  const beanOptions = (
    <>
      {activeCoffees.length > 0 && (
        <optgroup label="現有豆款">
          {activeCoffees.map(c => <option key={c.id} value={c.id}>{c.name}{c.roaster ? ` · ${c.roaster}` : ''}</option>)}
        </optgroup>
      )}
      {archivedCoffees.length > 0 && (
        <optgroup label="已封存">
          {archivedCoffees.map(c => <option key={c.id} value={c.id}>{c.name}{c.roaster ? ` · ${c.roaster}` : ''}</option>)}
        </optgroup>
      )}
    </>
  );

  // ----- sidebar (tabs + filter + list) -----
  const sidebar = (
    <div style={narrow
      ? { background: '#faf7f0' }
      : { width: 330, flex: 'none', position: 'sticky', top: 62, height: 'calc(100vh - 62px)', borderRight: '1px solid #e4ddcd', background: '#faf7f0', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ padding: '18px 16px 10px' }}>
        <div style={{ display: 'flex', gap: 6, background: '#efe7d8', padding: 4, borderRadius: 13 }}>
          {KINDS.map(k => {
            const on = k.key === kind;
            const count = recipes.filter(r => r.kind === k.key).length;
            return (
              <div
                key={k.key}
                onClick={() => switchKind(k.key)}
                className="press"
                style={{ cursor: 'pointer', flex: 1, textAlign: 'center', padding: '9px 4px', borderRadius: 10, background: on ? '#1a1714' : 'transparent', color: on ? '#faf8f3' : '#8a7a68' }}
              >
                <div style={{ font: "600 15px 'Iansui'" }}>{k.label}<span style={{ font: "700 10px 'Space Mono'", marginLeft: 4, opacity: 0.7 }}>{count}</span></div>
                <div style={{ font: "700 8px 'Space Mono'", letterSpacing: 1.2, marginTop: 2, color: on ? k.accent : '#b0a08c' }}>{k.en}</div>
              </div>
            );
          })}
        </div>

        <div onClick={startNew} className="press" style={{ cursor: 'pointer', marginTop: 12, background: meta.accent, color: '#fff', borderRadius: 11, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: "600 14px 'Iansui'" }}>
          <span style={{ font: "400 18px 'Room205'" }}>＋</span> 新增{meta.label}食譜
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <select value={beanFilter} onChange={e => setBeanFilter(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '8px 10px', font: "400 13px 'Iansui'", background: '#fff' }}>
            <option value="">全部豆子</option>
            {activeCoffees.filter(c => beansUsed.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            {archivedCoffees.filter(c => beansUsed.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}（已封存）</option>)}
          </select>
          <div
            onClick={() => setFavOnly(v => !v)}
            className="press"
            title="只看最愛"
            style={{ cursor: 'pointer', flex: 'none', padding: '8px 11px', borderRadius: 10, border: '1px solid #e2dac9', background: favOnly ? '#c98a2e' : '#fff', color: favOnly ? '#fff' : '#b0a08c', font: "600 13px 'Iansui'" }}
          >♥</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: narrow ? undefined : 'auto', padding: '4px 10px 24px' }}>
        {draft?.id === null && draft.kind === kind && (
          <RecipeRow draft={draft} coffee={draft.coffeeId ? coffeeById.get(draft.coffeeId) : undefined} specials={specials} active unsaved onClick={() => {}} />
        )}
        {visible.length === 0 && draft?.id !== null && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9a8a76', font: "400 13px/1.8 'Iansui'" }}>
            {ofKind.length === 0 ? `還沒有${meta.label}食譜，按上面的「新增」開始記錄吧` : '沒有符合篩選的食譜'}
          </div>
        )}
        {visible.map(r => (
          <RecipeRow
            key={r.id}
            draft={draft?.id === r.id ? draft : toDraft(r)}
            coffee={r.coffeeId ? coffeeById.get(r.coffeeId) : undefined}
            specials={specials}
            active={draft?.id === r.id}
            unsaved={draft?.id === r.id && dirty}
            onClick={() => select(r)}
          />
        ))}
      </div>
    </div>
  );

  // ----- editor -----
  const editor = draft && draft.kind === kind ? (
    <Editor
      draft={draft}
      coffee={draft.coffeeId ? coffeeById.get(draft.coffeeId) : undefined}
      specials={specials}
      beanOptions={beanOptions}
      accent={meta.accent}
      kindLabel={`${meta.label} · ${meta.en}`}
      dirty={dirty}
      saving={saving}
      narrow={narrow}
      onBack={() => { if (confirmDiscard()) setDraft(null); }}
      patch={patch}
      patchParams={patchParams}
      onSave={save}
      onDuplicate={duplicate}
      onDelete={remove}
    />
  ) : (
    <div style={{ padding: '120px 30px', textAlign: 'center', color: '#9a8a76', font: "400 14px/1.9 'Iansui'" }}>
      從左邊選一筆{meta.label}食譜，或按「新增{meta.label}食譜」<br />豆子會直接從你現有的豆款裡挑。
    </div>
  );

  if (narrow) return shell(draft && draft.kind === kind ? editor : sidebar);

  return shell(
    <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: 1280, margin: '0 auto' }}>
      {sidebar}
      <div style={{ flex: 1, minWidth: 0 }}>{editor}</div>
    </div>,
  );
}

function RecipeRow({ draft, coffee, specials, active, unsaved, onClick }: { draft: Draft; coffee: Coffee | undefined; specials: Special[]; active: boolean; unsaved: boolean; onClick: () => void }) {
  const color = coffee?.color ?? '#d3c9b6';
  return (
    <div
      onClick={onClick}
      className="row press"
      style={{ cursor: 'pointer', display: 'flex', gap: 12, padding: '11px 12px', borderRadius: 12, marginBottom: 3, background: active ? '#efe7d8' : undefined }}
    >
      <div style={{ width: 6, borderRadius: 3, flex: 'none', background: color }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ font: "500 15px 'Room205',serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{coffee?.name ?? (draft.kind === 'special' ? '（未指定豆子）' : '（未選擇豆子）')}</span>
          {draft.favorite && <span style={{ color: '#c98a2e', fontSize: 12 }}>♥</span>}
          {unsaved && <span style={{ font: "700 9px 'Space Mono'", color: '#c8342b', marginLeft: 'auto', flex: 'none' }}>{draft.id === null ? 'NEW' : '未儲存'}</span>}
        </div>
        {draft.title && <div style={{ font: "600 12px 'Iansui'", color: '#6b5c4a', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{draft.title}</div>}
        <div style={{ font: "400 11px 'Space Mono'", color: '#8a7a68', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary(draft, specials)}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ font: "400 10px 'Space Mono'", color: '#b0a08c' }}>{draft.brewedOn}</span>
          {draft.rating !== null && <Stars value={draft.rating} size={11} />}
        </div>
      </div>
    </div>
  );
}

interface EditorProps {
  draft: Draft;
  coffee: Coffee | undefined;
  specials: Special[];
  beanOptions: ReactNode;
  accent: string;
  kindLabel: string;
  dirty: boolean;
  saving: boolean;
  narrow: boolean;
  onBack: () => void;
  patch: (p: Partial<Draft>) => void;
  patchParams: (p: Partial<Draft['params']>) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function Editor({ draft, coffee, specials, beanOptions, accent, kindLabel, dirty, saving, narrow, onBack, patch, patchParams, onSave, onDuplicate, onDelete }: EditorProps) {
  const p = draft.params;

  return (
    <div style={{ padding: narrow ? '16px 16px 100px' : '24px 30px 80px', maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {narrow && <div onClick={onBack} className="press" style={{ cursor: 'pointer', font: "600 14px 'Iansui'", color: '#8a7a68' }}>← 列表</div>}
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: accent }}>{draft.id === null ? '新食譜' : '編輯食譜'} / {kindLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {draft.id !== null && <div onClick={onDuplicate} className="press" style={{ ...smallBtn, padding: '10px 14px', font: "600 13px 'Iansui'" }}>複製成新紀錄</div>}
          <div onClick={onDelete} className="press" style={{ cursor: 'pointer', padding: '10px 14px', borderRadius: 11, font: "600 13px 'Iansui'", color: '#c8342b', background: '#f7e4e1', whiteSpace: 'nowrap' }}>{draft.id === null ? '取消' : '刪除'}</div>
          <div
            onClick={onSave}
            className="press"
            style={{ cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, background: dirty ? '#3d6b4f' : '#9ab5a3', color: '#fff', borderRadius: 11, padding: '10px 22px', font: "600 14px 'Iansui'", whiteSpace: 'nowrap' }}
          >{saving ? '儲存中…' : dirty ? '儲存' : '已儲存'}</div>
        </div>
      </div>

      {/* Bean + basics */}
      <Section title="豆子 · B E A N">
        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>{draft.kind === 'special' ? '使用的豆子（可不選）' : '選擇豆子'}</label>
            <select value={draft.coffeeId ?? ''} onChange={e => patch({ coffeeId: e.target.value || null })} style={inputStyle}>
              <option value="">{draft.kind === 'special' ? '— 不指定 —' : '— 請選擇 —'}</option>
              {beanOptions}
            </select>
          </div>
          {draft.kind === 'special' && (
            <div>
              <label style={labelStyle}>對應特調品項（可不選）</label>
              <select value={draft.specialId ?? ''} onChange={e => patch({ specialId: e.target.value || null })} style={inputStyle}>
                <option value="">— 不指定 —</option>
                {specials.map(s => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : '（未上架）'}</option>)}
              </select>
            </div>
          )}
          <TextField label={draft.kind === 'special' ? '食譜名稱' : '版本名稱（可不填）'} value={draft.title} onChange={v => patch({ title: v })} placeholder={draft.kind === 'special' ? '例如：橙香冰拿鐵' : '例如：早班穩定版、淺一點的版本'} />
          <div>
            <label style={labelStyle}>沖煮日期</label>
            <input type="date" value={draft.brewedOn} onChange={e => e.target.value && patch({ brewedOn: e.target.value })} style={inputStyle} />
          </div>
        </div>

        {coffee && (
          <div style={{ marginTop: 16, display: 'flex', gap: 14, alignItems: 'center', padding: 14, borderRadius: 14, background: coffee.color + '14' }}>
            {coffee.coverUrl
              ? <img src={coffee.coverUrl} alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'cover', flex: 'none' }} />
              : <div style={{ width: 54, height: 54, borderRadius: 12, background: coffee.color, flex: 'none' }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "500 19px 'Room205',serif" }}>{coffee.name}{coffee.archived && <span style={{ font: "600 11px 'Iansui'", color: '#9a8a76', marginLeft: 8 }}>已封存</span>}</div>
              <div style={{ font: "400 12px 'Iansui'", color: '#6b5c4a', marginTop: 3 }}>
                {[coffee.originEN, coffee.roaster, coffee.roast, coffee.process].filter(Boolean).join(' · ')}
              </div>
              {coffee.notes.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                  {coffee.notes.map(n => <span key={n} style={{ padding: '3px 9px', borderRadius: 20, background: coffee.color + '22', color: coffee.color, font: "600 11px 'Iansui'" }}>{n}</span>)}
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      {draft.kind === 'espresso' && <EspressoFields p={p} patchParams={patchParams} accent={accent} />}
      {draft.kind === 'pourover' && <PouroverFields p={p} patchParams={patchParams} accent={accent} />}
      {draft.kind === 'special' && <SpecialFields p={p} patchParams={patchParams} accent={accent} />}

      <Section
        title="風味筆記 · N O T E S"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Stars value={draft.rating} onChange={v => patch({ rating: v })} />
            <span onClick={() => patch({ favorite: !draft.favorite })} className="press" title="加入最愛" style={{ cursor: 'pointer', fontSize: 20, color: draft.favorite ? '#c98a2e' : '#ddd3c1' }}>♥</span>
          </div>
        }
      >
        <textarea
          value={draft.notes}
          onChange={e => patch({ notes: e.target.value })}
          placeholder="喝起來怎樣？下次想怎麼調整？（例如：酸偏尖，下次磨細一格）"
          style={{ ...inputStyle, minHeight: 110, resize: 'vertical', font: "400 15px/1.8 'Iansui'" }}
        />
      </Section>
    </div>
  );
}

type ParamsProps = { p: Draft['params']; patchParams: (p: Partial<Draft['params']>) => void; accent: string };

function EspressoFields({ p, patchParams, accent }: ParamsProps) {
  const flow = p.yield && p.time ? `${fmt(p.yield / p.time, 2)} g/s` : '–';
  return (
    <Section title="萃取參數 · E X T R A C T I O N">
      <div style={grid}>
        <NumField label="粉量 DOSE" unit="g" value={p.dose} onChange={v => patchParams({ dose: v })} />
        <NumField label="萃取量 YIELD" unit="g" value={p.yield} onChange={v => patchParams({ yield: v })} />
        <NumField label="時間 TIME" unit="s" step={1} value={p.time} onChange={v => patchParams({ time: v })} />
        <NumField label="水溫 TEMP" unit="°C" step={0.5} value={p.temp} onChange={v => patchParams({ temp: v })} />
        <NumField label="預浸 PRE-INF" unit="s" step={1} value={p.preinfusion} onChange={v => patchParams({ preinfusion: v })} />
        <NumField label="壓力 PRESSURE" unit="bar" step={0.5} value={p.pressure} onChange={v => patchParams({ pressure: v })} />
        <TextField label="研磨 GRIND" value={p.grind} onChange={v => patchParams({ grind: v })} placeholder="例如：EK 2.5" />
        <TextField label="器材 GEAR" value={p.equipment} onChange={v => patchParams({ equipment: v })} placeholder="機器 / 磨豆機 / 粉碗" />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <Stat label="粉水比 RATIO" value={ratio(p.dose, p.yield) ?? '–'} accent={accent} />
        <Stat label="流速 FLOW" value={flow} accent={accent} />
      </div>
    </Section>
  );
}

function PouroverFields({ p, patchParams, accent }: ParamsProps) {
  const pours: PourStep[] = p.pours ?? [];
  const poured = pours.reduce((sum, s) => sum + (s.water ?? 0), 0);
  const setPour = (i: number, patch: Partial<PourStep>) => patchParams({ pours: pours.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  let running = 0;

  return (
    <>
      <Section title="沖煮參數 · B R E W">
        <div style={grid}>
          <NumField label="粉量 DOSE" unit="g" value={p.dose} onChange={v => patchParams({ dose: v })} />
          <NumField label="總水量 WATER" unit="g" step={1} value={p.water} onChange={v => patchParams({ water: v })} />
          <NumField label="水溫 TEMP" unit="°C" step={0.5} value={p.temp} onChange={v => patchParams({ temp: v })} />
          <TextField label="總時間 TIME" value={p.totalTime} onChange={v => patchParams({ totalTime: v })} placeholder="2:30" />
          <TextField label="研磨 GRIND" value={p.grind} onChange={v => patchParams({ grind: v })} placeholder="例如：C40 24 格" />
          <TextField label="濾杯 DRIPPER" value={p.dripper} onChange={v => patchParams({ dripper: v })} placeholder="V60 / Kalita / Origami" />
          <TextField label="濾紙 FILTER" value={p.filter} onChange={v => patchParams({ filter: v })} placeholder="例如：Cafec Abaca" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <Stat label="粉水比 RATIO" value={ratio(p.dose, p.water) ?? '–'} accent={accent} />
          <Stat label="已排注水 POURED" value={`${fmt(poured)} g`} accent={accent} />
        </div>
      </Section>

      <Section
        title="注水段落 · P O U R S"
        right={<div onClick={() => patchParams({ pours: [...pours, { at: '', water: null, note: '' }] })} className="press" style={smallBtn}>＋ 加一段</div>}
      >
        {pours.length === 0 && <div style={{ color: '#9a8a76', font: "400 13px 'Iansui'" }}>還沒有分段，按「加一段」記錄每次注水。</div>}
        {pours.map((s, i) => {
          running += s.water ?? 0;
          return (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ flex: 'none', width: 26, font: "700 11px 'Space Mono'", color: accent }}>#{i + 1}</div>
              <input value={s.at} onChange={e => setPour(i, { at: e.target.value })} placeholder="0:00" style={{ ...inputStyle, width: 72, flex: 'none', font: "500 15px 'Room205'" }} />
              <div style={{ position: 'relative', width: 96, flex: 'none' }}>
                <input type="number" inputMode="decimal" value={s.water ?? ''} onChange={e => setPour(i, { water: e.target.value === '' ? null : Number(e.target.value) })} style={{ ...inputStyle, paddingRight: 26, font: "500 15px 'Room205'" }} />
                <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', font: "700 10px 'Space Mono'", color: '#9a8a76' }}>g</span>
              </div>
              <div style={{ flex: 'none', width: 58, font: "400 11px 'Space Mono'", color: '#9a8a76' }}>→{fmt(running)}g</div>
              <input value={s.note ?? ''} onChange={e => setPour(i, { note: e.target.value })} placeholder="悶蒸 / 繞圈 / 中心注水…" style={{ ...inputStyle, flex: '1 1 180px', minWidth: 0 }} />
              <div onClick={() => patchParams({ pours: pours.filter((_, j) => j !== i) })} className="press" style={removeBtn}>×</div>
            </div>
          );
        })}
        {p.water && pours.length > 0 && poured !== p.water && (
          <div style={{ marginTop: 6, font: "400 12px 'Iansui'", color: '#b5502f' }}>分段加總 {fmt(poured)}g，跟總水量 {fmt(p.water)}g 不一樣喔</div>
        )}
      </Section>
    </>
  );
}

function SpecialFields({ p, patchParams, accent }: ParamsProps) {
  const ingredients: Ingredient[] = p.ingredients ?? [];
  const steps: string[] = p.steps ?? [];
  const setIng = (i: number, patch: Partial<Ingredient>) => patchParams({ ingredients: ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const pill = (on: boolean, color: string): CSSProperties => ({
    cursor: 'pointer', padding: '9px 16px', borderRadius: 11, font: "600 14px 'Iansui'", whiteSpace: 'nowrap',
    background: on ? color : '#faf8f3', color: on ? '#fff' : '#8a7a68', border: on ? '1px solid transparent' : '1px solid #e2dac9',
  });

  return (
    <>
      <Section title="咖啡基底 · B A S E">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <div onClick={() => patchParams({ serve: '熱' })} className="press" style={pill(p.serve === '熱', '#b5502f')}>♨ 熱</div>
          <div onClick={() => patchParams({ serve: '冰' })} className="press" style={pill(p.serve === '冰', '#2b6f8a')}>❄ 冰</div>
          <div style={{ width: 1, background: '#e2dac9', margin: '0 4px' }} />
          <div onClick={() => patchParams({ base: 'espresso' })} className="press" style={pill(p.base === 'espresso', accent)}>濃縮</div>
          <div onClick={() => patchParams({ base: 'pourover' })} className="press" style={pill(p.base === 'pourover', accent)}>手沖 / 冷萃</div>
          <div onClick={() => patchParams({ base: 'other' })} className="press" style={pill(p.base === 'other', accent)}>其他</div>
        </div>
        <div style={grid}>
          <NumField label="粉量 DOSE" unit="g" value={p.dose} onChange={v => patchParams({ dose: v })} />
          <NumField label="咖啡液 YIELD" unit="g" value={p.yield} onChange={v => patchParams({ yield: v })} />
          <NumField label="萃取時間 TIME" unit="s" step={1} value={p.time} onChange={v => patchParams({ time: v })} />
          <TextField label="杯型 / 份量 GLASS" value={p.glass} onChange={v => patchParams({ glass: v })} placeholder="例如：12oz 冰杯" />
        </div>
      </Section>

      <Section
        title="材料 · I N G R E D I E N T S"
        right={<div onClick={() => patchParams({ ingredients: [...ingredients, { name: '', amount: null, unit: 'ml' }] })} className="press" style={smallBtn}>＋ 加材料</div>}
      >
        {ingredients.length === 0 && <div style={{ color: '#9a8a76', font: "400 13px 'Iansui'" }}>還沒有材料，例如牛奶、糖漿、氣泡水、冰塊。</div>}
        {ingredients.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input value={x.name} onChange={e => setIng(i, { name: e.target.value })} placeholder="材料名稱" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
            <input type="number" inputMode="decimal" value={x.amount ?? ''} onChange={e => setIng(i, { amount: e.target.value === '' ? null : Number(e.target.value) })} placeholder="量" style={{ ...inputStyle, width: 84, flex: 'none', font: "500 15px 'Room205'" }} />
            <select value={x.unit} onChange={e => setIng(i, { unit: e.target.value })} style={{ ...inputStyle, width: 76, flex: 'none', padding: '10px 6px' }}>
              {['ml', 'g', 'oz', '份', '顆', '匙', '滴', '片', '適量'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div onClick={() => patchParams({ ingredients: ingredients.filter((_, j) => j !== i) })} className="press" style={removeBtn}>×</div>
          </div>
        ))}
      </Section>

      <Section
        title="做法 · S T E P S"
        right={<div onClick={() => patchParams({ steps: [...steps, ''] })} className="press" style={smallBtn}>＋ 加步驟</div>}
      >
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 'none', width: 26, height: 26, marginTop: 7, borderRadius: '50%', background: accent + '22', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', font: "700 11px 'Space Mono'" }}>{i + 1}</div>
            <textarea
              value={s}
              onChange={e => patchParams({ steps: steps.map((x, j) => (j === i ? e.target.value : x)) })}
              placeholder={i === 0 ? '例如：杯中先放冰塊與糖漿' : '下一步…'}
              rows={1}
              style={{ ...inputStyle, flex: 1, minWidth: 0, resize: 'vertical', font: "400 14px/1.6 'Iansui'" }}
            />
            <div onClick={() => patchParams({ steps: steps.filter((_, j) => j !== i) })} className="press" style={{ ...removeBtn, marginTop: 5 }}>×</div>
          </div>
        ))}
      </Section>
    </>
  );
}
