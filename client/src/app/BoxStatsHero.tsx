import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Three.js is a big chunk (~140KB gzip) - only worth paying for on the one
// screen that actually renders the 3D box, not on every page load.
const RotatingBox3D = lazy(() => import('./RotatingBox3D').then(m => ({ default: m.RotatingBox3D })));

type SpecItem = { k: string; v: string };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Remaps `v` from the range [a,b] onto [0,1], clamped - lets each visual
// property run its fade/grow over its own slice of the overall scroll
// progress instead of all moving in lockstep.
const remap = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

// Sized off the stage's own rendered box, not window.innerWidth - the hero
// sits inside MobileShell's column, which is much narrower than the full
// browser window, so sizing against the raw viewport left the box tiny on
// wide monitors. The hard caps below dominate once the stage is roomy
// (desktop), the ratios dominate on a narrow phone-width stage.
function computeSizes(stageWidth: number, stageHeight: number) {
  return {
    stageWidth,
    boxWidthPx: Math.max(170, Math.min(stageWidth * 0.55, stageHeight * 0.44, 440)),
    circleMaxPx: Math.max(190, Math.min(stageWidth * 0.6, stageHeight * 0.58, 480)),
  };
}

// Flanking stat columns (onyx's "spec wheel" layout) only fit beside the
// circle once the stage itself is roomy enough; below that it reflows into
// a compact grid under the circle instead, inside the same element.
const WIDE_BREAKPOINT = 760;

// Onyx coffee lab's product pages render the rotating box and the big
// circular "spec wheel" as ONE element: scrolling continuously morphs the
// small box-with-ring into the large stat circle (box shrinks and fades to
// a faint background shape while the ring beneath it grows to fill that
// role) rather than showing them as two disconnected sections. This
// component re-creates that: a tall scroll track with a pinned stage inside
// it, where every visual property is driven by scroll progress (0-1)
// computed from the track's position in the viewport.
export function BoxStatsHero({
  src, color, placeholderLabel, tiltHint, roastLabel, desc, left, right,
}: {
  src: string | null;
  color: string;
  placeholderLabel: string;
  tiltHint: string;
  roastLabel: string;
  desc: string;
  left: SpecItem[];
  right: SpecItem[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [rotationY, setRotationY] = useState(Math.PI);
  const [boxReady, setBoxReady] = useState(false);
  const [sizes, setSizes] = useState(() => computeSizes(400, 800));
  const [openItem, setOpenItem] = useState<SpecItem | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    function update() {
      raf = 0;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const p = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
      setProgress(p);
      setSizes(computeSizes(rect.width, window.innerHeight));
    }
    function schedule() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    update();
    // A plain resize listener only catches the window itself changing size -
    // it misses the stage's own width shifting from a font/layout settle
    // (webfonts loading in, etc.), which a ResizeObserver on the element
    // picks up directly.
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const { boxWidthPx, circleMaxPx, stageWidth } = sizes;
  const boxHeightPx = boxWidthPx * 1.25;
  const isWide = stageWidth >= WIDE_BREAKPOINT;

  // The box container itself never resizes or moves - only the box *visual*
  // inside it scales/fades. That keeps the container's center a fixed
  // reference point for the ring's geometry across the whole animation.
  const boxScale = lerp(1, 0.46, remap(progress, 0, 0.55));
  const boxOpacity = lerp(1, 0.16, remap(progress, 0, 0.6));
  const hintOpacity = boxReady ? lerp(0.65, 0, remap(progress, 0, 0.12)) : 0;
  // Once the ring has clearly become the stat circle, dragging it to "spin"
  // no longer makes sense - stop reacting to pointer input and let the dot
  // fade out along with it, rather than leaving a dead control on screen.
  const boxInteractive = progress < 0.5;
  const dotOpacity = 1 - remap(progress, 0.5, 0.72);

  const ringT = remap(progress, 0.15, 0.8);
  const startRingW = boxWidthPx * 0.4;
  const startRingH = startRingW / 4.2;
  const startRingCenterY = boxHeightPx / 2 - boxHeightPx * 0.13 - startRingH / 2;
  const ringW = lerp(startRingW, circleMaxPx, ringT);
  const ringH = lerp(startRingH, circleMaxPx, ringT);
  const ringCenterY = lerp(startRingCenterY, 0, ringT);

  const shadowOpacity = 1 - remap(progress, 0.2, 0.55);
  const whiteBorderOpacity = 1 - remap(progress, 0.5, 0.85);
  const colorBorderOpacity = remap(progress, 0.5, 0.85);
  const textOpacity = remap(progress, 0.55, 0.88);
  const infoOpacity = remap(progress, 0.62, 0.92);

  // rotationY=PI is RotatingBox3D's resting orientation (the labeled face
  // turned toward the camera) - offset the dot's angle so that resting state
  // reads as sitting front-and-center on the ring, not off at its left edge.
  const dotAngle = rotationY - Math.PI / 2;
  const dotLeft = 50 + 50 * Math.cos(dotAngle);
  const dotTop = 50 + 50 * Math.sin(dotAngle);

  // Onyx reveals each stat as its own click-to-open card rather than
  // printing every value inline around the circle - these are just the
  // trigger points (label + a small dot), the actual value only shows once
  // tapped, via the modal below.
  const specTrigger = (s: SpecItem, align: 'left' | 'right') => (
    <button
      key={s.k}
      type="button"
      onClick={() => setOpenItem(s)}
      style={{
        pointerEvents: 'auto', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 0',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        flexDirection: align === 'right' ? 'row' : 'row-reverse',
      }}
    >
      <span style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76' }}>{s.k}</span>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flex: 'none' }} />
    </button>
  );

  const sideColGap = ringW / 2 + 30;
  const ringTransform = `translate(-50%, calc(-50% + ${ringCenterY}px))`;

  return (
    <>
      <div ref={trackRef} style={{ height: '170vh', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
          <div
            style={{
              position: 'absolute', left: '50%', top: '42%', width: boxWidthPx, height: boxHeightPx,
              transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* The ring's far half is painted *before* the box so the box
                visually occludes it, like a ring laid flat on the ground
                with the box standing in front of its back edge - without
                this split the ring reads as floating through the box
                instead of sitting under it. */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: ringW, height: ringH, transform: ringTransform, borderRadius: '50%', pointerEvents: 'none', clipPath: 'inset(0 0 50% 0)' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.9)', opacity: whiteBorderOpacity }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${color}66`, opacity: colorBorderOpacity }} />
            </div>

            <div style={{ width: '100%', height: '100%', position: 'relative', transform: `scale(${boxScale})`, opacity: boxOpacity, transformOrigin: 'center center', pointerEvents: boxInteractive ? 'auto' : 'none' }}>
              <Suspense fallback={<div style={{ width: '100%', height: '100%', background: `linear-gradient(140deg,${color}22,#fff)` }} />}>
                <RotatingBox3D
                  src={src}
                  color={color}
                  placeholderLabel={placeholderLabel}
                  onReady={() => setBoxReady(true)}
                  onRotationChange={setRotationY}
                />
              </Suspense>
              <span style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', font: "700 9px 'Space Mono'", letterSpacing: 1.5, color, opacity: hintOpacity, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                ↔ {tiltHint}
              </span>
            </div>

            <div style={{ position: 'absolute', left: '50%', top: '50%', width: ringW, height: ringH, transform: ringTransform, borderRadius: '50%', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: '-40%', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(26,23,20,.22) 0%, rgba(26,23,20,0) 70%)', opacity: shadowOpacity }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.9)', opacity: whiteBorderOpacity, clipPath: 'inset(50% 0 0 0)' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${color}66`, opacity: colorBorderOpacity, clipPath: 'inset(50% 0 0 0)' }} />
              <div style={{ position: 'absolute', width: 9, height: 9, left: `${dotLeft}%`, top: `${dotTop}%`, marginLeft: -4.5, marginTop: -4.5, borderRadius: '50%', background: '#1a1714', opacity: dotOpacity }} />
              <div
                style={{
                  position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: ringW * 0.74,
                  textAlign: 'center', opacity: textOpacity, padding: '0 8px',
                }}
              >
                <div style={{ font: "600 clamp(22px,7vw,34px)/1 'Room205',serif", color: '#1a1714' }}>{roastLabel}</div>
                <div style={{ font: "400 13px/1.6 'Iansui'", color: '#6b5c4a', marginTop: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}>
                  {desc}
                </div>
              </div>
            </div>

            {isWide ? (
              <>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 170, transform: `translate(calc(-100% - ${sideColGap}px), calc(-50% + ${ringCenterY}px))`, display: 'flex', flexDirection: 'column', gap: 4, opacity: infoOpacity }}>
                  {left.map(s => specTrigger(s, 'right'))}
                </div>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 170, transform: `translate(${sideColGap}px, calc(-50% + ${ringCenterY}px))`, display: 'flex', flexDirection: 'column', gap: 4, opacity: infoOpacity }}>
                  {right.map(s => specTrigger(s, 'left'))}
                </div>
              </>
            ) : (
              <div
                style={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: `translate(-50%, calc(-50% + ${ringCenterY}px + ${ringH / 2}px + 26px))`,
                  width: Math.min(stageWidth * 0.8, 300), opacity: infoOpacity,
                  display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 10, rowGap: 2,
                }}
              >
                {[...left, ...right].map(s => specTrigger(s, 'left'))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* "Package box mockup" by _simone.rizzi, CC-BY-4.0 - attribution
          required by the license. */}
      <div style={{ padding: '4px 24px 0', textAlign: 'right' }}>
        <a
          href="https://sketchfab.com/3d-models/package-box-mockup-3b68aaab1d7d4bce889a2803b131a375"
          target="_blank" rel="noopener noreferrer"
          style={{ font: "400 9px 'Space Mono'", color: '#b0a08c' }}
        >
          3D model by _simone.rizzi (CC-BY)
        </a>
      </div>

      {openItem && createPortal(
        <div
          onClick={() => setOpenItem(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(26,23,20,.4)', zIndex: 80,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', background: '#f4f1ea', borderRadius: 22, padding: '34px 40px',
              minWidth: 220, maxWidth: 320, textAlign: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenItem(null)}
              aria-label="close"
              style={{
                position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: '50%',
                border: 'none', background: 'rgba(26,23,20,.06)', cursor: 'pointer',
                font: "400 15px 'Space Mono'", color: '#6b5c4a', lineHeight: '30px',
              }}
            >
              ×
            </button>
            <div style={{ font: "700 10px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76' }}>{openItem.k}</div>
            <div style={{ font: "600 28px 'Room205',serif", color: '#1a1714', marginTop: 10 }}>{openItem.v || '—'}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
