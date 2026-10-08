import type { CSSProperties, ReactNode } from 'react';

// Mobile stays the same narrow phone-width column it always has. At desktop
// widths, `mobile-shell` widens to a comfortable reading column (forms,
// single-item pages) while `wide` (see index.css's `.mobile-shell-wide`)
// drops the cap almost entirely for grid/listing screens, matching how
// onyx coffee lab's own site bleeds its product grid to the edges on desktop.
export function MobileShell({ children, style, wide }: { children: ReactNode; style?: CSSProperties; wide?: boolean }) {
  return (
    <div
      className={`screen-in mobile-shell${wide ? ' mobile-shell-wide' : ''}`}
      style={{
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
