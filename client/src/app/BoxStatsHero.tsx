import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MAX_SWING, REST_ROTATION } from './boxRotation';

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
  const boxWidthPx = Math.max(170, Math.min(stageWidth * 0.48, stageHeight * 0.4, 420));
  return {
    stageWidth,
    stageHeight,
    boxWidthPx,
    // The ring is tied to the box's own width (not an independent stage
    // formula) so the "ring is clearly wider than the box, even at rest"
    // proportion from onyx's real page - a flat ellipse roughly 1.7x the
    // box's width sitting under it - holds at every viewport size, and the
    // fully-grown circle stays comfortably bigger again than that.
    startRingW: boxWidthPx * 1.7,
    circleMaxPx: Math.min(boxWidthPx * 2.5, stageHeight * 0.82, stageWidth * 0.88, 820),
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
const clampRotation = (r: number) => Math.min(REST_ROTATION + MAX_SWING, Math.max(REST_ROTATION - MAX_SWING, r));
// The mouse-angle range that maps onto the clamped rotation range (see
// clampRotation) - independent of REST_ROTATION, since rotationY = REST +
// PI/2 - angle, so REST cancels out when solving for angle's own bounds.
const ANGLE_MIN = Math.PI / 2 - MAX_SWING;
const ANGLE_MAX = Math.PI / 2 + MAX_SWING;

export function BoxStatsHero({
  src, color, placeholderLabel, roastLabel, desc, left, right,
}: {
  src: string | null;
  color: string;
  placeholderLabel: string;
  roastLabel: string;
  desc: string;
  left: SpecItem[];
  right: SpecItem[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // atan2 wraps at ±π - if we fed its raw result straight into rotationY,
  // dragging the dot past the ellipse's leftmost point would see the angle
  // jump from near +π to near -π in one pointermove, snapping the box to
  // the opposite swing limit instead of stopping at the near one. Tracking
  // the continuous (unwrapped) angle via per-move deltas, then clamping
  // that instead of the raw angle, keeps the drag smooth right up to the
  // limit from either direction.
  const continuousAngle = useRef(Math.PI / 2);
  const lastRawAngle = useRef(Math.PI / 2);
  const [progress, setProgress] = useState(0);
  const [rotationY, setRotationY] = useState(REST_ROTATION);
  const [grabbing, setGrabbing] = useState(false);
  const [boxReady, setBoxReady] = useState(false);
  const [sizes, setSizes] = useState(() => computeSizes(400, 800));
  const [activeItem, setActiveItem] = useState<SpecItem | null>(null);

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

  const { boxWidthPx, startRingW, circleMaxPx, stageWidth } = sizes;
  const boxHeightPx = boxWidthPx * 1.25;
  const isWide = stageWidth >= WIDE_BREAKPOINT;

  // The box container itself never resizes or moves - only the box *visual*
  // inside it scales/fades. That keeps the container's center a fixed
  // reference point for the ring's geometry across the whole animation.
  const boxScale = lerp(1, 0.46, remap(progress, 0, 0.55));
  const boxOpacity = lerp(1, 0.16, remap(progress, 0, 0.6));
  // Once the ring has clearly become the stat circle, dragging the dot to
  // "spin" the box no longer makes sense - stop reacting to pointer input
  // and let the dot fade out along with it, rather than leaving a dead
  // control on screen. Also gated on the box having actually loaded, so
  // there's nothing to grab before there's a box to respond.
  const dotInteractive = boxReady && progress < 0.5;
  const dotOpacity = 1 - remap(progress, 0.5, 0.72);

  const ringT = remap(progress, 0.15, 0.8);
  // A thin, flat ellipse at rest (matching onyx's own "turntable" ring),
  // not an oval closer to a circle - startRingW already comes in at ~1.7x
  // the box's width (see computeSizes).
  const startRingH = startRingW / 12;
  const startRingCenterY = boxHeightPx / 2 - boxHeightPx * 0.08 - startRingH / 2;
  const ringW = lerp(startRingW, circleMaxPx, ringT);
  const ringH = lerp(startRingH, circleMaxPx, ringT);
  const ringCenterY = lerp(startRingCenterY, 0, ringT);

  // The box needs to sit low enough early on to clear the fixed bottom buy
  // bar while it's still draggable (see the anchor div below), but once
  // that interactive phase is over and it's settled into the big stat
  // circle, pinning it down there just makes the circle look off-center in
  // the viewport. Drift the anchor back toward true center as that happens.
  const anchorTopPct = lerp(28, 50, remap(progress, 0.2, 0.75));

  const shadowOpacity = 1 - remap(progress, 0.2, 0.55);
  // Onyx's own shadow isn't a static patch - it slides as the box turns,
  // like it's cast by the box's current face rather than painted once and
  // left alone. Shifting the gradient's center (not the whole shadow
  // div, which would drag it off the ring) approximates that cheaply.
  const shadowShiftPct = ((rotationY - REST_ROTATION) / MAX_SWING) * 22;
  const whiteBorderOpacity = 1 - remap(progress, 0.5, 0.85);
  const colorBorderOpacity = remap(progress, 0.5, 0.85);
  const textOpacity = remap(progress, 0.55, 0.88);
  const infoOpacity = remap(progress, 0.62, 0.92);

  // rotationY=REST_ROTATION is RotatingBox3D's resting orientation (the
  // labeled face turned toward the camera) - offset the dot's angle so that
  // resting state reads as sitting front-and-center on the ring, not off at
  // its left edge. The minus sign (rather than a plus) matches Three.js's
  // rotation.y handedness to the screen: without it, dragging the dot right
  // turned the box the opposite way from how it visibly moved.
  const dotAngle = Math.PI / 2 - (rotationY - REST_ROTATION);
  const dotLeft = 50 + 50 * Math.cos(dotAngle);
  const dotTop = 50 + 50 * Math.sin(dotAngle);

  // Hovering a stat label keeps it bright and dims the rest, swapping its
  // value into the circle's center - no click-to-open card needed. Touch
  // has no real hover, but tapping still fires a synthetic mouseenter right
  // before the click, so this alone is enough to make tap-to-show work too;
  // an onClick toggle here would just race that synthetic mouseenter and
  // immediately cancel it back out.
  const specTrigger = (s: SpecItem, align: 'left' | 'right') => {
    const isActive = activeItem?.k === s.k;
    const dimmed = activeItem !== null && !isActive;
    return (
      <button
        key={s.k}
        type="button"
        onMouseEnter={() => setActiveItem(s)}
        onMouseLeave={() => setActiveItem(prev => (prev && prev.k === s.k ? null : prev))}
        style={{
          pointerEvents: 'auto', cursor: 'pointer', background: 'none', border: 'none', padding: '5px 0',
          display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          flexDirection: align === 'right' ? 'row' : 'row-reverse',
          opacity: dimmed ? 0.35 : 1, transition: 'opacity .2s ease, color .2s ease',
        }}
      >
        <span style={{ font: "700 12px 'Space Mono'", letterSpacing: 1.5, color: isActive ? '#1a1714' : '#9a8a76' }}>{s.k}</span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flex: 'none' }} />
      </button>
    );
  };

  const sideColGap = ringW / 2 + 30;
  const ringTransform = `translate(-50%, calc(-50% + ${ringCenterY}px))`;

  return (
    <>
      <div ref={trackRef} style={{ height: '170vh', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
          <div
            style={{
              // Lower than 28% and the ring/dot collide with the fixed
              // bottom buy bar before the sticky stage has even finished
              // pinning (it still sits in normal flow, lower than its final
              // position, until scroll passes the hero text above it) -
              // anchorTopPct drifts back up to 50% once that phase is over.
              position: 'absolute', left: '50%', top: `${anchorTopPct}%`, width: boxWidthPx, height: boxHeightPx,
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

            <div style={{ width: '100%', height: '100%', position: 'relative', transform: `scale(${boxScale})`, opacity: boxOpacity, transformOrigin: 'center center', pointerEvents: 'none' }}>
              <Suspense fallback={<div style={{ width: '100%', height: '100%', background: `linear-gradient(140deg,${color}22,#fff)` }} />}>
                <RotatingBox3D
                  src={src}
                  color={color}
                  placeholderLabel={placeholderLabel}
                  rotationY={rotationY}
                  onReady={() => setBoxReady(true)}
                />
              </Suspense>
            </div>

            <div ref={ringRef} style={{ position: 'absolute', left: '50%', top: '50%', width: ringW, height: ringH, transform: ringTransform, borderRadius: '50%', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: '-8%', borderRadius: '50%', background: `radial-gradient(ellipse at ${50 + shadowShiftPct}% 50%, rgba(26,23,20,.4) 0%, rgba(26,23,20,.15) 55%, rgba(26,23,20,0) 80%)`, opacity: shadowOpacity }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.9)', opacity: whiteBorderOpacity, clipPath: 'inset(50% 0 0 0)' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${color}66`, opacity: colorBorderOpacity, clipPath: 'inset(50% 0 0 0)' }} />
              {/* The dot is the only drag handle - dragging the box itself
                  does nothing. Its hit area is bigger than the visible dot
                  so it's actually grabbable on a touch screen. */}
              <div
                onPointerDown={(e) => {
                  if (!dotInteractive) return;
                  dragging.current = true;
                  setGrabbing(true);
                  const rect = ringRef.current?.getBoundingClientRect();
                  if (rect) {
                    const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
                    const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
                    lastRawAngle.current = Math.atan2(ny, nx);
                  }
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragging.current) return;
                  const rect = ringRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
                  const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
                  const rawAngle = Math.atan2(ny, nx);
                  let delta = rawAngle - lastRawAngle.current;
                  if (delta > Math.PI) delta -= Math.PI * 2;
                  else if (delta < -Math.PI) delta += Math.PI * 2;
                  lastRawAngle.current = rawAngle;
                  continuousAngle.current = Math.min(ANGLE_MAX, Math.max(ANGLE_MIN, continuousAngle.current + delta));
                  setRotationY(clampRotation(REST_ROTATION + Math.PI / 2 - continuousAngle.current));
                }}
                onPointerUp={() => { dragging.current = false; setGrabbing(false); }}
                onPointerCancel={() => { dragging.current = false; setGrabbing(false); }}
                style={{
                  position: 'absolute', width: 44, height: 44, left: `${dotLeft}%`, top: `${dotTop}%`,
                  marginLeft: -22, marginTop: -22, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: dotOpacity, pointerEvents: dotInteractive ? 'auto' : 'none',
                  cursor: grabbing ? 'grabbing' : 'grab', touchAction: 'none',
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', background: '#1a1714',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: "400 10px 'Space Mono'", color: '#f4f1ea', letterSpacing: 2,
                }}>
                  &lt;&gt;
                </span>
              </div>
              <div
                style={{
                  position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: ringW * 0.74,
                  textAlign: 'center', opacity: textOpacity, padding: '0 8px',
                }}
              >
                {activeItem ? (
                  <>
                    <div style={{ font: "700 12px 'Space Mono'", letterSpacing: 1.5, color: '#9a8a76' }}>{activeItem.k}</div>
                    <div style={{ font: "600 clamp(26px,7.5vw,40px)/1.1 'Room205',serif", color: '#1a1714', marginTop: 12 }}>{activeItem.v || '—'}</div>
                  </>
                ) : (
                  <>
                    <div style={{ font: "600 clamp(28px,8vw,42px)/1 'Room205',serif", color: '#1a1714' }}>{roastLabel}</div>
                    <div style={{ font: "400 15px/1.6 'Iansui'", color: '#6b5c4a', marginTop: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}>
                      {desc}
                    </div>
                  </>
                )}
              </div>
            </div>

            {isWide ? (
              <>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 200, transform: `translate(calc(-100% - ${sideColGap}px), calc(-50% + ${ringCenterY}px))`, display: 'flex', flexDirection: 'column', gap: 6, opacity: infoOpacity }}>
                  {left.map(s => specTrigger(s, 'right'))}
                </div>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 200, transform: `translate(${sideColGap}px, calc(-50% + ${ringCenterY}px))`, display: 'flex', flexDirection: 'column', gap: 6, opacity: infoOpacity }}>
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
    </>
  );
}
