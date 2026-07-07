import { useRef, useState } from 'react';

export function CoverUploader({
  coverUrl,
  onUpload,
  onSetUrl,
}: {
  coverUrl: string | null;
  onUpload: (file: File) => void;
  onSetUrl: (url: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  return (
    <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
      <div
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onUpload(file);
        }}
        style={{
          width: 210, height: 262, flex: 'none', borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
          border: `1px dashed ${dragOver ? '#1a1714' : '#d3c9b6'}`, background: '#f6f2ea',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="封面預覽" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ font: "400 13px 'Iansui'", color: '#a89a84', textAlign: 'center', padding: '0 16px' }}>拖曳 / 點擊上傳豆袋照</span>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
      </div>
      <div style={{ flex: 1, paddingTop: 4 }}>
        <div style={{ font: "500 15px 'Iansui'", color: '#1a1714' }}>上傳豆袋 / 包裝封面</div>
        <div style={{ font: "400 13px/1.7 'Iansui'", color: '#8a7a68', marginTop: 6 }}>
          拖曳圖片到左側方框，或點擊選擇檔案。建議直式 <b>4:5</b>、去背或純色背景效果最佳，會直接顯示在顧客的商品頁。
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76', marginBottom: 7, display: 'block' }}>或貼上圖片網址</label>
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && urlDraft.trim()) {
                onSetUrl(urlDraft.trim());
                setUrlDraft('');
              }
            }}
            placeholder="https://… 按 Enter 套用"
            style={{ width: '100%', maxWidth: 420, padding: '11px 13px', border: '1px solid #e2dac9', borderRadius: 10, background: '#fff', font: "400 14px 'Iansui'", color: '#1a1714', outline: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
