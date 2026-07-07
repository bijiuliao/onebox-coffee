import type { CSSProperties, ReactNode } from 'react';

export function MobileShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="screen-in"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100vh',
        background: '#f4f1ea',
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
