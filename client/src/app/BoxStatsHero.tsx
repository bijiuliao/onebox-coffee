import { lazy, Suspense, useEffect, useRef, useState } from 'react';

// Three.js is a big chunk (~140KB gzip) - only worth paying for on the one
// screen that actually renders the 3D box, not on every page load.
const RotatingBox3D = lazy(() => import('./RotatingBox3D').then(m => ({ default: m.RotatingBox3D })));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Remaps `v` from the range [a,b] onto [0,1], clamped - lets each visual
// property run its fade/grow over its own slice of the overall scroll
// progress instead of all moving in lockstep.
const remap = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

function responsiveSizes() {
  const w = typeof window === 'undefined' ? 400 : window.innerWidth;
  return {
    boxWidthPx: Math.min(w * 0.62, 300),
    circleMaxPx: Math.min(w * 0.7, 320),
  };
}

// Onyx coffee lab's product pages render the rotating box and the big
// circular "spec wheel" as ONE element: scrolling continuously morphs the
// small box-with-ring into the large stat circle (box shrinks and fades to
// a faint background shape while the ring beneath it grows to fill that
// role) rather than showing them as two disconnected sections. This
// component re-creates that: a tall scroll track with a pinned stage inside
// it, where every visual property is driven by scroll progress (0-1)
// computed from the track's position in the viewport.
export function BoxStatsHero({
  src, color, placeholderLabel, tiltHint, roastLabel, desc,
}: {
  src: string | null;
  color: string;
  placeholderLabel: string;
  tiltHint: string;
  roastLabel: string;
  desc: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [rotationY, setRotationY] = useState(Math.PI);
  const [boxReady, setBoxReady] = useState(false);
  const [sizes, setSizes] = useState(responsiveSizes);

  useEffect(() => {
    let raf = 0;
    function update() {
      raf = 0;
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const p = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
      setProgress(p);
      setSizes(responsiveSizes());
    }
    function onScrollOrResize() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const { boxWidthPx, circleMaxPx } = sizes;
  const boxHeightPx = boxWidthPx * 1.25;

  // The box container itself never resizes or moves - only the box *visual*
  // inside it scales/fades. That keeps the container's center a fixed
  // reference point for the ring's geometry across the whole animation.
  const boxScale = lerp(1, 0.46, remap(progress, 0, 0.55));
  const boxOpacity = lerp(1, 0.16, remap(progress, 0, 0.6));
  const hintOpacity = boxReady ? lerp(0.65, 0, remap(progress, 0, 0.12)) : 0;

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

  const dotLeft = 50 + 50 * Math.cos(rotationY);
  const dotTop = 50 + 50 * Math.sin(rotationY);

  return (
    <>
      <div ref={trackRef} style={{ height: '170vh', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute', left: '50%', top: '42%', width: boxWidthPx, height: boxHeightPx,
              transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ width: '100%', height: '100%', position: 'relative', transform: `scale(${boxScale})`, opacity: boxOpacity, transformOrigin: 'center center' }}>
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

            <div
              style={{
                position: 'absolute', left: '50%', top: '50%', width: ringW, height: ringH,
                transform: `translate(-50%, calc(-50% + ${ringCenterY}px))`, borderRadius: '50%', pointerEvents: 'none',
              }}
            >
              <div style={{ position: 'absolute', inset: '-40%', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(26,23,20,.22) 0%, rgba(26,23,20,0) 70%)', opacity: shadowOpacity }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.9)', opacity: whiteBorderOpacity }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${color}66`, opacity: colorBorderOpacity }} />
              <div style={{ position: 'absolute', width: 9, height: 9, left: `${dotLeft}%`, top: `${dotTop}%`, marginLeft: -4.5, marginTop: -4.5, borderRadius: '50%', background: '#1a1714' }} />
              <div
                style={{
                  position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: ringW * 0.74,
                  textAlign: 'center', opacity: textOpacity, padding: '0 8px',
                }}
              >
                <div style={{ font: "600 clamp(22px,7vw,34px)/1 'Room205',serif", color: '#1a1714' }}>{roastLabel}</div>
                <div style={{ font: "400 13px/1.6 'Iansui'", color: '#6b5c4a', marginTop: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                  {desc}
                </div>
              </div>
            </div>
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
    </>
  );
}
