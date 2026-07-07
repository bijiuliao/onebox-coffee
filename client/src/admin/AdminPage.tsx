import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Coffee } from '../types';
import { ACCENT_PALETTE } from './palette';
import { CoverUploader } from './CoverUploader';
import { AdminTopBar } from './AdminTopBar';
import { useToast } from '../toast';

function soft(color: string) {
  return color + '22';
}

export function AdminPage() {
  const { showToast } = useToast();
  const [beans, setBeans] = useState<Coffee[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    api.listCoffees(true).then(list => {
      setBeans(list);
      setSelectedId(list[0]?.id ?? null);
    });
  }, []);

  if (!beans || !selectedId) {
    return <div style={{ minHeight: '100vh', background: '#f4f1ea', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a8a76' }}>載入中…</div>;
  }
  const sel = beans.find(b => b.id === selectedId) ?? beans[0];

  const patch = (p: Partial<Coffee>) => {
    setBeans(prev => prev!.map(b => (b.id === selectedId ? { ...b, ...p } : b)));
  };

  // Merges only the saved fields back in, so any other in-progress local
  // edits (not yet saved) aren't clobbered by the server's response.
  const persist = async (id: string, payload: Partial<Coffee>) => {
    try {
      await api.updateCoffee(id, payload);
      setBeans(prev => prev!.map(b => (b.id === id ? { ...b, ...payload } : b)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '操作失敗');
      throw err;
    }
  };

  const addBean = async () => {
    try {
      const created = await api.createCoffee('New Coffee');
      setBeans(prev => [...(prev ?? []), created]);
      setSelectedId(created.id);
      showToast('已建立新豆款，記得填資料');
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
        name: sel.name, originEN: sel.originEN, roast: sel.roast, level: sel.level, notes: sel.notes,
        price: sel.price, color: sel.color, score: sel.score, process: sel.process, altitude: sel.altitude,
        varietal: sel.varietal, harvest: sel.harvest, desc: sel.desc, roaster: sel.roaster,
        temps: sel.temps, sizes: sel.sizes,
      });
      showToast('已儲存 · ' + sel.name);
    } catch {
      // toast already shown by persist()
    }
  };

  const uploadCover = async (file: File) => {
    try {
      const updated = await api.uploadCover(sel.id, file);
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

  const label = (text: string) => (
    <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 7, display: 'block' }}>{text}</label>
  );
  const textInputStyle = { width: '100%', padding: '11px 13px', border: '1px solid #e2dac9', borderRadius: 10, background: '#fff', font: "400 14px 'Iansui'", color: '#1a1714', outline: 'none' } as const;
  const section = { background: '#fff', border: '1px solid #ece5d6', borderRadius: 18, padding: 22, marginBottom: 20 } as const;
  const sectionTitle = { font: "700 11px 'Space Mono'", letterSpacing: 3, color: '#1a1714', whiteSpace: 'nowrap' as const, marginBottom: 18 };

  const pvNotes = sel.notes;
  const pvStats = [
    { k: 'ROASTER', v: sel.roaster || '—' },
    { k: 'PROCESS', v: sel.process || '—' },
    { k: 'ELEVATION', v: sel.altitude || '—' },
    { k: 'VARIETY', v: sel.varietal || '—' },
    { k: 'ROAST', v: sel.roast || '—' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ea', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="beans" />

      <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: 1380, minWidth: 1200, margin: '0 auto' }}>
        <div style={{ width: 296, flex: 'none', position: 'sticky', top: 62, height: 'calc(100vh - 62px)', borderRight: '1px solid #e4ddcd', background: '#faf7f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '22px 20px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ font: "600 17px 'Iansui'" }}>豆款</span>
              <span style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>{beans.length} 款</span>
            </div>
            <div onClick={addBean} className="press" style={{ cursor: 'pointer', marginTop: 14, background: '#1a1714', color: '#f4f1ea', borderRadius: 11, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: "600 14px 'Iansui'" }}>
              <span style={{ font: "400 18px 'Room205'" }}>＋</span> 新增豆款
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 18px' }}>
            {beans.map(b => (
              <div
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className="row press"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 12, marginBottom: 3, background: b.id === sel.id ? '#efe7d8' : undefined }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, flex: 'none', background: b.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "500 15px 'Room205',serif", color: '#1a1714', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</div>
                  <div style={{ font: "400 10px 'Space Mono'", color: '#9a8a76', marginTop: 2 }}>{b.originEN} · ${b.price}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: b.active ? '#3d6b4f' : '#d3c9b6' }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: '26px 30px 80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>編輯豆款 / EDIT PRODUCT</div>
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
            placeholder="Coffee name"
            style={{ width: '100%', border: 'none', background: 'transparent', font: "500 46px 'Room205',serif", color: '#1a1714', outline: 'none', padding: '2px 0', marginBottom: 22 }}
          />

          <div style={section}>
            <div style={sectionTitle}>封面 · C O V E R</div>
            <CoverUploader coverUrl={sel.coverUrl} onUpload={uploadCover} onSetUrl={setCoverUrl} />
          </div>

          <div style={section}>
            <div style={sectionTitle}>風味與烘焙 · P R O F I L E</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 22px' }}>
              <div>
                {label('產區（英文）ORIGIN')}
                <input value={sel.originEN} onChange={(e) => patch({ originEN: e.target.value })} placeholder="ETHIOPIA" style={{ ...textInputStyle, font: "700 13px 'Space Mono'", letterSpacing: 1 }} />
              </div>
              <div>
                {label('烘豆商 ROASTER')}
                <input value={sel.roaster} onChange={(e) => patch({ roaster: e.target.value })} placeholder="onebox roastery" style={{ ...textInputStyle, font: "400 14px 'Room205',serif" }} />
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22, marginTop: 22, alignItems: 'start' }}>
              <div>
                <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10, display: 'block' }}>烘焙度 ROAST LEVEL</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 9 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} onClick={() => patch({ level: n })} className="press" style={{ cursor: 'pointer', width: 15, height: 15, borderRadius: '50%', background: n <= sel.level ? sel.color : '#e6dece' }} />
                    ))}
                  </div>
                  <input value={sel.roast} onChange={(e) => patch({ roast: e.target.value })} placeholder="淺焙" style={{ width: 96, padding: '9px 12px', border: '1px solid #e2dac9', borderRadius: 10, background: '#fff', font: "400 13px 'Iansui'", color: '#1a1714', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10, display: 'block' }}>CUP 評分</label>
                <input type="number" value={sel.score} onChange={(e) => patch({ score: Number(e.target.value) || 0 })} style={{ width: 110, padding: '9px 12px', border: '1px solid #e2dac9', borderRadius: 10, background: '#fff', font: "500 15px 'Room205'", color: '#1a1714', outline: 'none' }} />
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
          </div>

          <div style={section}>
            <div style={sectionTitle}>產地資料 · O R I G I N  D A T A</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 22px' }}>
              <div>{label('處理法 PROCESS')}<input value={sel.process} onChange={(e) => patch({ process: e.target.value })} placeholder="水洗 Washed" style={textInputStyle} /></div>
              <div>{label('海拔 ELEVATION')}<input value={sel.altitude} onChange={(e) => patch({ altitude: e.target.value })} placeholder="1,900–2,100m" style={textInputStyle} /></div>
              <div>{label('品種 VARIETY')}<input value={sel.varietal} onChange={(e) => patch({ varietal: e.target.value })} placeholder="原生種 Heirloom" style={textInputStyle} /></div>
              <div>{label('採收季 HARVEST')}<input value={sel.harvest} onChange={(e) => patch({ harvest: e.target.value })} placeholder="11–1 月" style={textInputStyle} /></div>
            </div>
          </div>

          <div style={section}>
            <div style={sectionTitle}>供應設定 · S E R V I C E</div>
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              <div>
                <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10, display: 'block' }}>供應溫度 SERVE</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div onClick={() => patch({ temps: { ...sel.temps, hot: !sel.temps.hot } })} className="press" style={pillStyle(sel.temps.hot, '#b5502f')}><span style={{ fontSize: 16 }}>♨</span> 熱手沖</div>
                  <div onClick={() => patch({ temps: { ...sel.temps, ice: !sel.temps.ice } })} className="press" style={pillStyle(sel.temps.ice, '#2b6f8a')}><span style={{ fontSize: 16 }}>❄</span> 冰手沖</div>
                </div>
                <div style={{ font: "400 11px 'Iansui'", color: '#b0a08c', marginTop: 8 }}>顧客點餐時可選的冷 / 熱選項</div>
              </div>
              <div>
                <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10, display: 'block' }}>份量 SIZE</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div onClick={() => patch({ sizes: { ...sel.sizes, std: !sel.sizes.std } })} className="press" style={pillStyle(sel.sizes.std, '#1a1714')}>標準</div>
                  <div onClick={() => patch({ sizes: { ...sel.sizes, large: !sel.sizes.large } })} className="press" style={pillStyle(sel.sizes.large, '#1a1714')}>大杯 +$20</div>
                </div>
              </div>
              <div>
                <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 10, display: 'block' }}>價格 PRICE (NT$)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: "500 20px 'Room205'", color: '#1a1714' }}>$</span>
                  <input type="number" value={sel.price} onChange={(e) => patch({ price: Number(e.target.value) || 0 })} style={{ width: 120, padding: '10px 12px', border: '1px solid #e2dac9', borderRadius: 10, background: '#fff', font: "500 17px 'Room205'", color: '#1a1714', outline: 'none' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={section}>
            <div style={sectionTitle}>描述 · S T O R Y</div>
            <textarea
              value={sel.desc}
              onChange={(e) => patch({ desc: e.target.value })}
              placeholder="寫下這支豆的風味與故事…"
              style={{ width: '100%', minHeight: 110, resize: 'vertical', padding: 14, border: '1px solid #e2dac9', borderRadius: 12, background: '#fff', font: "400 15px/1.8 'Iansui'", color: '#1a1714', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ width: 372, flex: 'none', position: 'sticky', top: 62, height: 'calc(100vh - 62px)', overflowY: 'auto', borderLeft: '1px solid #e4ddcd', background: '#efe9dd', padding: '24px 22px' }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76', marginBottom: 14 }}>即時預覽 / LIVE PREVIEW</div>
          <div style={{ borderRadius: 22, overflow: 'hidden', background: '#f4f1ea', boxShadow: '0 20px 40px -22px rgba(30,22,16,.45)', border: '1px solid #e4ddcd' }}>
            <div style={{ padding: 22, background: `linear-gradient(180deg,${soft(sel.color)} 0%,#f4f1ea 100%)` }}>
              <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: sel.color }}>{sel.originEN}</div>
              <div style={{ font: "500 30px/1.1 'Room205',serif", color: '#1a1714', marginTop: 8 }}>{sel.name}</div>
              <div style={{ display: 'inline-flex', marginTop: 12, padding: '4px 11px', borderRadius: 20, background: sel.color, color: '#fff', font: "700 11px 'Space Mono'" }}>⌾ CUP {sel.score}</div>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {pvNotes.map(n => <span key={n} style={chipStyle}>{n}</span>)}
              </div>
              <div style={{ marginTop: 16, borderTop: '1px solid #e6dece' }}>
                {pvStats.map(s => (
                  <div key={s.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #ece5d6' }}>
                    <span style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76' }}>{s.k}</span>
                    <span style={{ font: "500 13px 'Iansui'", color: '#1a1714' }}>{s.v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {sel.temps.hot && <span style={{ padding: '6px 13px', borderRadius: 20, background: '#f4e7e1', color: '#b5502f', font: "600 12px 'Iansui'" }}>♨ 熱</span>}
                {sel.temps.ice && <span style={{ padding: '6px 13px', borderRadius: 20, background: '#e2eef2', color: '#2b6f8a', font: "600 12px 'Iansui'" }}>❄ 冰</span>}
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
