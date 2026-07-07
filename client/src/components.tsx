import type { CSSProperties } from 'react';

export function NoteChip({ label, color, soft }: { label: string; color: string; soft: string }) {
  return (
    <span style={{ padding: '5px 11px', borderRadius: 20, background: soft, color, font: "600 12px 'Iansui'" }}>
      {label}
    </span>
  );
}

export function RoastDots({ level, color }: { level: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < level ? color : '#e2dac9' }} />
      ))}
    </div>
  );
}

export function CartButton({ count, onClick, translucent = false }: { count: number; onClick: () => void; translucent?: boolean }) {
  const style: CSSProperties = translucent
    ? { background: 'rgba(255,255,255,.7)' }
    : { background: '#fff', border: '1px solid #e4ddcd' };
  return (
    <div
      onClick={onClick}
      className="press"
      role="button"
      aria-label={count > 0 ? `購物車，${count} 件商品` : '購物車'}
      style={{
        position: 'relative', width: 40, height: 40, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: "600 16px 'Iansui'", color: '#1a1714', ...style,
      }}
    >
      箱
      {count > 0 && (
        <span
          style={{
            position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px',
            borderRadius: 10, background: '#c8342b', color: '#fff', font: "700 11px 'Space Mono'",
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

export function BackButton({ onClick, translucent = false }: { onClick: () => void; translucent?: boolean }) {
  return (
    <div
      onClick={onClick}
      className="press"
      role="button"
      aria-label="返回"
      style={{
        width: 40, height: 40, borderRadius: '50%',
        background: translucent ? 'rgba(255,255,255,.7)' : '#fff',
        border: translucent ? undefined : '1px solid #e4ddcd',
        display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 18px 'Room205'",
      }}
    >
      ←
    </div>
  );
}
