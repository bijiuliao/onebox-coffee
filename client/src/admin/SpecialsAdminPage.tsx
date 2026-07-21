import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Special } from '../types';
import { ACCENT_PALETTE } from './palette';
import { CoverUploader } from './CoverUploader';
import { AdminTopBar } from './AdminTopBar';
import { useToast } from '../toast';

function soft(color: string) {
  return color + '22';
}

export function SpecialsAdminPage() {
  const { showToast } = useToast();
  const [specials, setSpecials] = useState<Special[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    api.listSpecials(true).then(list => {
      setSpecials(list);
      setSelectedId(list[0]?.id ?? null);
    });
  }, []);

  if (!specials || specials.length === 0 || !selectedId) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f1ea', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
        <AdminTopBar active="specials" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#9a8a76' }}>
          {specials === null ? (
            '載入中…'
          ) : (
            <>
              <div style={{ marginBottom: 16, font: "400 14px 'Iansui'" }}>還沒有特調品項</div>
              <div
                onClick={async () => {
                  const created = await api.createSpecial('New Special');
                  setSpecials([created]);
                  setSelectedId(created.id);
                }}
                className="press"
                style={{ cursor: 'pointer', background: '#1a1714', color: '#f4f1ea', borderRadius: 11, padding: '12px 22px', font: "600 14px 'Iansui'" }}
              >
                ＋ 新增特調
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const sel = specials.find(s => s.id === selectedId) ?? specials[0];

  const patch = (p: Partial<Special>) => {
    setSpecials(prev => prev!.map(s => (s.id === selectedId ? { ...s, ...p } : s)));
  };

  const persist = async (id: string, payload: Partial<Special>) => {
    try {
      await api.updateSpecial(id, payload);
      setSpecials(prev => prev!.map(s => (s.id === id ? { ...s, ...payload } : s)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失敗');
      throw err;
    }
  };

  const addSpecial = async () => {
    try {
      const created = await api.createSpecial('New Special');
      setSpecials(prev => [...(prev ?? []), created]);
      setSelectedId(created.id);
      showToast('已建立新特調，記得填資料');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '建立失敗');
    }
  };

  const toggleActive = () => {
    const next = !sel.active;
    patch({ active: next });
    persist(sel.id, { active: next }).catch(() => patch({ active: !next }));
  };

  const save = async () => {
    try {
      await persist(sel.id, {
        name: sel.name, desc: sel.desc, price: sel.price, color: sel.color, notes: sel.notes, temps: sel.temps,
      });
      showToast('已儲存 · ' + sel.name);
    } catch {
      // toast already shown by persist()
    }
  };

  const uploadCover = async (file: File) => {
    try {
      const updated = await api.uploadSpecialCover(sel.id, file);
      patch({ coverUrl: updated.coverUrl });
    } catch (err) {
      showToast(err instanceof Error ? err.message : '上傳失敗');
    }
  };

  const setCoverUrl = async (url: string) => {
    await persist(sel.id, { coverUrl: url });
  };

  const addNote = () => {
    const v = noteDraft.trim();
    if (v) patch({ notes: [...sel.notes, v] });
    setNoteDraft('');
  };
  const removeNote = (i: number) => patch({ notes: sel.notes.filter((_, j) => j !== i) });

  const chipStyle = { display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 20, background: soft(sel.color), color: sel.color, font: "600 13px 'Iansui'" } as const;

  const pillStyle = (active: boolean, accent: string) => ({
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 18px', borderRadius: 12,
    font: "600 14px 'Iansui'", background: active ? accent : '#f4f1ea', color: active ? '#fff' : '#8a7a68',
    border: active ? 'none' : '1px solid #e2dac9',
  });

  const section = { background: '#fff', border: '1px solid #ece5d6', borderRadius: 18, padding: 22, marginBottom: 20 } as const;
  const sectionTitle = { font: "700 11px 'Space Mono'", letterSpacing: 3, color: '#1a1714', whiteSpace: 'nowrap' as const, marginBottom: 18 };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ea', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="specials" />

      <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: 1380, minWidth: 1200, margin: '0 auto' }}>
        <div style={{ width: 296, flex: 'none', position: 'sticky', top: 62, height: 'calc(100vh - 62px)', borderRight: '1px solid #e4ddcd', background: '#faf7f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '22px 20px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ font: "600 17px 'Iansui'" }}>特調</span>
              <span style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>{specials.length} 款</span>
            </div>
            <div onClick={addSpecial} className="press" style={{ cursor: 'pointer', marginTop: 14, background: '#1a1714', color: '#f4f1ea', borderRadius: 11, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: "600 14px 'Iansui'" }}>
              <span style={{ font: "400 18px 'Room205'" }}>＋</span> 新增特調
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 18px' }}>
            {specials.map(s => (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="row press"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 12, marginBottom: 3, background: s.id === sel.id ? '#efe7d8' : undefined }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, flex: 'none', background: s.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "500 15px 'Room205',serif", color: '#1a1714', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ font: "400 10px 'Space Mono'", color: '#9a8a76', marginTop: 2 }}>${s.price}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: s.active ? '#3d6b4f' : '#d3c9b6' }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: '26px 30px 80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>編輯特調 / EDIT SPECIAL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div onClick={toggleActive} className="press" style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '11px 16px', borderRadius: 11, font: "600 13px 'Iansui'", background: sel.active ? '#e6f0ea' : '#efe7d8', color: sel.active ? '#3d6b4f' : '#9a8a76' }}>
                {sel.active ? '● 上架中' : '○ 未上架'}
              </div>
              <div onClick={save} className="press" style={{ cursor: 'pointer', background: '#3d6b4f', color: '#fff', borderRadius: 11, padding: '11px 22px', font: "600 14px 'Iansui'" }}>儲存</div>
            </div>
          </div>
          <input
            value={sel.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Special name"
            style={{ width: '100%', border: 'none', background: 'transparent', font: "500 46px 'Room205',serif", color: '#1a1714', outline: 'none', padding: '2px 0', marginBottom: 22 }}
          />

          <div style={section}>
            <div style={sectionTitle}>封面 · C O V E R</div>
            <CoverUploader coverUrl={sel.coverUrl} onUpload={uploadCover} onSetUrl={setCoverUrl} />
          </div>

          <div style={section}>
            <div style={sectionTitle}>風味與價格 · P R O F I L E</div>

            <div>
              <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 9, display: 'block' }}>風味標籤 TASTING NOTES</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {sel.notes.map((n, i) => (
                  <span key={i} style={chipStyle}>
                    {n}
                    <span onClick={() => removeNote(i)} style={{ cursor: 'pointer', marginLeft: 7, opacity: .6, fontWeight: 700 }}>×</span>
                  </span>
                ))}
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } }}
                  placeholder="輸入後按 Enter…"
                  style={{ flex: 1, minWidth: 150, padding: '9px 12px', border: '1px dashed #d3c9b6', borderRadius: 20, background: '#faf7f0', font: "400 13px 'Iansui'", color: '#1a1714', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10, display: 'block' }}>專屬色彩 ACCENT</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {ACCENT_PALETTE.map(c => (
                  <div
                    key={c}
                    onClick={() => patch({ color: c })}
                    className="press"
                    style={{ cursor: 'pointer', width: 34, height: 34, borderRadius: 10, background: c, boxShadow: c === sel.color ? `0 0 0 3px #f4f1ea, 0 0 0 5px ${c}` : 'none' }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10, display: 'block' }}>價格 PRICE (NT$)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ font: "500 20px 'Room205'", color: '#1a1714' }}>$</span>
                <input type="number" value={sel.price} onChange={(e) => patch({ price: Number(e.target.value) || 0 })} style={{ width: 120, padding: '10px 12px', border: '1px solid #e2dac9', borderRadius: 10, background: '#fff', font: "500 17px 'Room205'", color: '#1a1714', outline: 'none' }} />
              </div>
            </div>
          </div>

          <div style={section}>
            <div style={sectionTitle}>供應設定 · S E R V I C E</div>
            <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10, display: 'block' }}>供應溫度 SERVE</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div onClick={() => patch({ temps: { ...sel.temps, hot: !sel.temps.hot } })} className="press" style={pillStyle(sel.temps.hot, '#b5502f')}><span style={{ fontSize: 16 }}>♨</span> 熱</div>
              <div onClick={() => patch({ temps: { ...sel.temps, ice: !sel.temps.ice } })} className="press" style={pillStyle(sel.temps.ice, '#2b6f8a')}><span style={{ fontSize: 16 }}>❄</span> 冰</div>
            </div>
          </div>

          <div style={section}>
            <div style={sectionTitle}>描述 · S T O R Y</div>
            <textarea
              value={sel.desc}
              onChange={(e) => patch({ desc: e.target.value })}
              placeholder="寫下這杯特調的故事…"
              style={{ width: '100%', minHeight: 110, resize: 'vertical', padding: 14, border: '1px solid #e2dac9', borderRadius: 12, background: '#fff', font: "400 15px/1.8 'Iansui'", color: '#1a1714', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ width: 372, flex: 'none', position: 'sticky', top: 62, height: 'calc(100vh - 62px)', overflowY: 'auto', borderLeft: '1px solid #e4ddcd', background: '#efe9dd', padding: '24px 22px' }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 14 }}>即時預覽 / LIVE PREVIEW</div>
          <div style={{ borderRadius: 22, overflow: 'hidden', background: '#f4f1ea', boxShadow: '0 20px 40px -22px rgba(30,22,16,.45)', border: '1px solid #e4ddcd' }}>
            <div style={{ padding: 18, background: soft(sel.color) }}>
              <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: sel.color }}>SPECIAL · 特調</span>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ font: "500 26px 'Room205',serif", color: '#1a1714' }}>{sel.name}</div>
              {sel.desc && <div style={{ font: "400 13px 'Iansui'", color: '#6b5c4a', marginTop: 6 }}>{sel.desc}</div>}
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
                {sel.notes.map(n => <span key={n} style={chipStyle}>{n}</span>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <span style={{ font: "600 24px 'Room205'", color: '#1a1714' }}>${sel.price}</span>
                <div style={{ background: '#1a1714', color: '#f4f1ea', borderRadius: 12, padding: '11px 18px', font: "600 13px 'Iansui'" }}>加入購物車</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, textAlign: 'center', font: "600 12px 'Iansui'", padding: 10, borderRadius: 12, background: sel.active ? '#e6f0ea' : '#f1e9db', color: sel.active ? '#3d6b4f' : '#9a8a76' }}>
            {sel.active ? '顧客可在商店看到這款' : '目前未上架，顧客看不到'}
          </div>
        </div>
      </div>
    </div>
  );
}
