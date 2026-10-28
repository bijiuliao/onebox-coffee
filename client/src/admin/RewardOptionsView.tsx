import { useEffect, useState } from 'react';
import { api } from '../api';
import type { RewardOption } from '../types';
import { AdminTopBar } from './AdminTopBar';
import { useToast } from '../toast';

const inputStyle = { padding: '9px 11px', border: '1px solid #e2dac9', borderRadius: 9, background: '#fff', font: "400 13px 'Iansui'", color: '#1a1714', outline: 'none' } as const;
const label = (text: string) => <label style={{ font: "700 9px 'Space Mono'", letterSpacing: 1, color: '#9a8a76', marginBottom: 5, display: 'block' }}>{text}</label>;

export function RewardOptionsView() {
  const { showToast } = useToast();
  const [options, setOptions] = useState<RewardOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMinLevel, setNewMinLevel] = useState('2');
  const [newMaxLevel, setNewMaxLevel] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.listRewardOptions().then(setOptions, err => setError(err.message));
  }, []);

  const patchOption = (id: number, p: Partial<RewardOption>) => {
    setOptions(prev => prev && prev.map(o => (o.id === id ? { ...o, ...p } : o)));
  };

  const save = async (id: number, patch: Partial<RewardOption>) => {
    try {
      const updated = await api.updateRewardOption(id, patch);
      patchOption(id, updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '更新失敗');
    }
  };

  const toggleActive = (o: RewardOption) => {
    patchOption(o.id, { active: !o.active });
    save(o.id, { active: !o.active });
  };

  const remove = async (o: RewardOption) => {
    if (!window.confirm(`確定要刪除「${o.label}」嗎？如果已經有客戶選過，會刪除失敗，請改成停用。`)) return;
    try {
      await api.deleteRewardOption(o.id);
      setOptions(prev => prev && prev.filter(x => x.id !== o.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : '刪除失敗');
    }
  };

  const create = async () => {
    const key = newKey.trim();
    const labelText = newLabel.trim();
    if (!key || !labelText || creating) return;
    setCreating(true);
    try {
      const created = await api.createRewardOption({
        key, label: labelText, desc: newDesc.trim(),
        minLevel: Number(newMinLevel) || 2,
        maxLevel: newMaxLevel.trim() ? Number(newMaxLevel) : null,
      });
      setOptions(prev => [...(prev ?? []), created]);
      setNewKey(''); setNewLabel(''); setNewDesc(''); setNewMinLevel('2'); setNewMaxLevel('');
      showToast('已新增技能');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '新增失敗');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', color: '#1a1714', fontFamily: "'Iansui','Archivo',system-ui,sans-serif" }}>
      <AdminTopBar active="rewards" />
      <div style={{ maxWidth: 900, minWidth: 600, margin: '0 auto', padding: '30px 30px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 2, color: '#9a8a76' }}>等級禮物 / LEVEL REWARDS</div>
          {options && <div style={{ font: "700 10px 'Space Mono'", color: '#9a8a76' }}>{options.length} 項</div>}
        </div>
        <div style={{ font: "400 11px 'Iansui'", color: '#b0a08c', marginBottom: 20 }}>
          客戶升等（Lv.2 以上）時可以選一個技能，這裡設定有哪些技能、各自從第幾級到第幾級出現（上限留空代表沒有上限）。停用的技能不會再被提供選擇，但已經選過的人歷史紀錄還是看得到；已經有人選過的技能無法直接刪除，只能停用。
        </div>

        {error && <div style={{ color: '#c8342b', font: "400 14px 'Iansui'" }}>載入失敗：{error}</div>}
        {!error && options === null && <div style={{ color: '#9a8a76', font: "400 14px 'Iansui'" }}>載入中…</div>}

        {options && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {options.map(o => (
                <div key={o.id} style={{ background: '#fff', border: '1px solid #ece5d6', borderRadius: 14, padding: 18, opacity: o.active ? 1 : .6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 12 }}>
                    <div>
                      {label('名稱')}
                      <input
                        value={o.label}
                        onChange={(e) => patchOption(o.id, { label: e.target.value })}
                        onBlur={(e) => save(o.id, { label: e.target.value })}
                        style={{ ...inputStyle, width: '100%' }}
                      />
                    </div>
                    <div>
                      {label('KEY（唯一識別碼，建立後不能改）')}
                      <input value={o.key} disabled style={{ ...inputStyle, width: '100%', background: '#faf8f3', color: '#9a8a76' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    {label('說明')}
                    <input
                      value={o.desc}
                      onChange={(e) => patchOption(o.id, { desc: e.target.value })}
                      onBlur={(e) => save(o.id, { desc: e.target.value })}
                      style={{ ...inputStyle, width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      {label('最低等級')}
                      <input
                        type="number" value={o.minLevel}
                        onChange={(e) => patchOption(o.id, { minLevel: Number(e.target.value) || 2 })}
                        onBlur={(e) => save(o.id, { minLevel: Number(e.target.value) || 2 })}
                        style={{ ...inputStyle, width: 80 }}
                      />
                    </div>
                    <div>
                      {label('最高等級（留空＝無上限）')}
                      <input
                        type="number" value={o.maxLevel ?? ''} placeholder="無上限"
                        onChange={(e) => patchOption(o.id, { maxLevel: e.target.value ? Number(e.target.value) : null })}
                        onBlur={(e) => save(o.id, { maxLevel: e.target.value ? Number(e.target.value) : null })}
                        style={{ ...inputStyle, width: 100 }}
                      />
                    </div>
                    <div style={{ flex: 1 }} />
                    <div
                      onClick={() => toggleActive(o)}
                      className="press"
                      style={{
                        cursor: 'pointer', font: "600 12px 'Iansui'", padding: '9px 16px', borderRadius: 10,
                        background: o.active ? '#fff' : '#3d6b4f',
                        color: o.active ? '#8a7a68' : '#faf8f3',
                        border: '1px solid ' + (o.active ? '#ece5d6' : '#3d6b4f'),
                      }}
                    >{o.active ? '停用' : '啟用'}</div>
                    <div
                      onClick={() => remove(o)}
                      className="press"
                      style={{ cursor: 'pointer', font: "600 12px 'Iansui'", padding: '9px 16px', borderRadius: 10, background: '#fff', color: '#c8342b', border: '1px solid #ece5d6' }}
                    >刪除</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1px dashed #d3c9b6', borderRadius: 14, padding: 18 }}>
              <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 14 }}>新增技能</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 12 }}>
                <div>
                  {label('名稱')}
                  <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="下一單 85 折" style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div>
                  {label('KEY（英數字和底線）')}
                  <input value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase())} placeholder="discount15" style={{ ...inputStyle, width: '100%' }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                {label('說明')}
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="下次購買豆子結帳打 85 折" style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div>
                  {label('最低等級')}
                  <input type="number" value={newMinLevel} onChange={(e) => setNewMinLevel(e.target.value)} style={{ ...inputStyle, width: 80 }} />
                </div>
                <div>
                  {label('最高等級（留空＝無上限）')}
                  <input type="number" value={newMaxLevel} onChange={(e) => setNewMaxLevel(e.target.value)} placeholder="無上限" style={{ ...inputStyle, width: 100 }} />
                </div>
                <div style={{ flex: 1 }} />
                <div
                  onClick={create}
                  className="press"
                  style={{
                    cursor: creating ? 'default' : 'pointer', opacity: !newKey.trim() || !newLabel.trim() || creating ? .5 : 1,
                    font: "600 13px 'Iansui'", padding: '10px 20px', borderRadius: 10, background: '#1a1714', color: '#faf8f3',
                  }}
                >新增</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
