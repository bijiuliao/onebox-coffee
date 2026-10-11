import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MAX_SWING, REST_ROTATION } from './boxRotation';

// Three.js is a big chunk (~140KB gzip) - only worth paying for on the one
// screen that actually renders the 3D box, not on every page load.
const RotatingBox3D = lazy(() => import('./RotatingBox3D').then(m => ({ default: m.RotatingBox3D })));

type SpecItem = { k: string; v: string };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Sized off the stage's own rendered box, not window.innerWidth - the hero
// sits inside MobileShell's column, which is much narrower than the full
// browser window, so sizing against the raw viewport left the box tiny on
// wide monitors. The hard caps below dominate once the stage is roomy
// (desktop), the ratios dominate on a narrow phone-width stage.
function computeSizes(stageWidth: number, stageHeight: number) {
  // Bigger now that the label is printed text rather than a photo - it
  // reads fine at a larger size with no cover image to pixelate or crop.
  const boxWidthPx = Math.max(190, Math.min(stageWidth * 0.58, stageHeight * 0.48, 520));
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

// Onyx's own page doesn't ease the box-to-circle morph continuously as you
// scroll - crossing a small threshold commits decisively to the next stage,
// and the shape animation itself then runs on its own fixed-duration timer
// (see `transitionT` below), fully decoupled from however choppy the actual
// scroll input is. That's what makes it read as a smooth transition instead
// of a mechanical one tied 1:1 to scroll deltas.
const THRESHOLD = 0.3;
// How long the shape morph (box -> circle) takes once committed, either
// direction. Ease-out-quad, not cubic - quad's gentler deceleration reads
// closer to onyx's own reference tween than cubic's sharper snap-to-rest.
const TRANSITION_DURATION = 900;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

export function BoxStatsHero({
  origin, roasterName, color, placeholderLabel, roastLabel, desc, left, right,
}: {
  // Printed on the box itself, onyx-style - origin small up top, roaster
  // name big and centered (see RotatingBox3D's paintLabel).
  origin: string;
  roasterName: string;
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
  const [progress, setProgress] = useState(0);
  // The shape morph's own current value (0 = box, 1 = circle), driven by a
  // self-contained rAF tween below - not derived from `progress` directly,
  // so its motion is as smooth as rAF itself regardless of how discrete the
  // user's actual scroll input is.
  const transitionTRef = useRef(0);
  const [transitionT, setTransitionT] = useState(0);
  const [rotationY, setRotationY] = useState(REST_ROTATION);
  const [grabbing, setGrabbing] = useState(false);
  const [boxReady, setBoxReady] = useState(false);
  const [sizes, setSizes] = useState(() => computeSizes(400, 800));
  const [activeItem, setActiveItem] = useState<SpecItem | null>(null);
  // Moving the pointer from one label straight to an adjacent one crosses a
  // gap where neither is hovered - without this, that gap's onMouseLeave
  // clears activeItem a frame before the next label's onMouseEnter sets it
  // again, and the circle's center flashes back to the default roast/desc
  // in between. Debouncing the clear (but never the set, which is instant)
  // lets a same-column pointer move cancel it before it ever fires.
  const clearActiveTimer = useRef<number | null>(null);
  function setActiveItemDebounced(item: SpecItem | null) {
    if (clearActiveTimer.current) {
      window.clearTimeout(clearActiveTimer.current);
      clearActiveTimer.current = null;
    }
    if (item) {
      setActiveItem(item);
    } else {
      clearActiveTimer.current = window.setTimeout(() => {
        setActiveItem(null);
        clearActiveTimer.current = null;
      }, 150);
    }
  }

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

  // Crossing the threshold commits to the next stage; the shape morph then
  // plays out on its own fixed timer below, decoupled from scroll entirely.
  const committed = progress > THRESHOLD;

  // Self-contained, interruptible tween toward whichever end `committed`
  // currently points at - reads `transitionTRef.current` (wherever the
  // *previous* tween left off) as its own start point rather than assuming
  // 0 or 1, so scrolling back across the threshold mid-animation reverses
  // smoothly from exactly where the box already was instead of jumping.
  useEffect(() => {
    const target = committed ? 1 : 0;
    const start = transitionTRef.current;
    if (start === target) return;
    let raf = 0;
    const startTime = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - startTime) / TRANSITION_DURATION);
      const value = start + (target - start) * easeOutQuad(t);
      transitionTRef.current = value;
      setTransitionT(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [committed]);

  const { boxWidthPx, startRingW, circleMaxPx, stageWidth } = sizes;
  const boxHeightPx = boxWidthPx * 1.25;
  const isWide = stageWidth >= WIDE_BREAKPOINT;

  // The box container itself never resizes or moves - only the box *visual*
  // inside it scales down. That keeps the container's center a fixed
  // reference point for the ring's geometry across the whole animation.
  //
  // Scales all the way down to nothing rather than fading out - any amount
  // of opacity/transparency on the rendered box read as cheap/glassy, so it
  // disappears purely by shrinking to zero size instead. The settled state
  // is still bean info only - there's just nothing left to see once this
  // hits 0, rather than a faint box ghost sitting behind it.
  //
  // Every shape property below rides `transitionT` (the self-contained
  // tween above), not raw scroll progress - its motion is paced entirely by
  // rAF on a fixed timer, so it reads as a real transition no matter how
  // choppy the scroll input that triggered it was.
  const boxScale = lerp(1, 0, transitionT);
  const boxOpacity = 1;
  // Once committed, dragging the dot to "spin" the box no longer makes
  // sense - stop reacting to pointer input, rather than leaving a dead
  // control on screen. Also gated on the box having actually loaded, so
  // there's nothing to grab before there's a box to respond.
  const dotInteractive = boxReady && !committed;
  const dotOpacity = lerp(1, 0, transitionT);
  // The box doesn't just shrink in place - it keeps turning the same way
  // the dot was last dragged, well past the interactive swing limit, so it
  // reads as spinning away rather than deflating on the spot. Purely
  // additive on top of whatever angle the user left it at; never written
  // back into `rotationY` itself, so the dot (while it's still visible)
  // doesn't jump when this starts.
  const autoSpin = lerp(0, -MAX_SWING * 1.3, transitionT);
  const renderRotationY = rotationY + autoSpin;

  const ringT = transitionT;
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
  const anchorTopPct = lerp(28, 50, transitionT);

  const shadowOpacity = lerp(1, 0, transitionT);
  // Onyx's own shadow isn't a static patch - it slides as the box turns,
  // like it's cast by the box's current face rather than painted once and
  // left alone. Shifting the gradient's center (not the whole shadow
  // div, which would drag it off the ring) approximates that cheaply.
  const shadowShiftPct = ((renderRotationY - REST_ROTATION) / MAX_SWING) * 22;
  const whiteBorderOpacity = lerp(1, 0, transitionT);
  const colorBorderOpacity = transitionT;
  // Unlike the shape properties above, the text/label content reveal is a
  // plain CSS transition keyed directly off the `committed` boolean (see
  // the opacity/transform values used below in the JSX) rather than a JS
  // value computed here - its own independent timing is what gives the
  // content a separate, layered feel instead of locking it to the box's
  // morph tween.

  // rotationY=REST_ROTATION is RotatingBox3D's resting orientation (the
  // labeled face turned toward the camera) - offset the dot's angle so that
  // resting state reads as sitting front-and-center on the ring, not off at
  // its left edge. The minus sign (rather than a plus) matches Three.js's
  // rotation.y handedness to the screen: without it, dragging the dot right
  // turned the box the opposite way from how it visibly moved. Driven by
  // renderRotationY (not the raw drag value) so the dot keeps pace with the
  // box's auto-spin during the brief window it's still visible for.
  const dotAngle = Math.PI / 2 - (renderRotationY - REST_ROTATION);
  const dotLeft = 50 + 50 * Math.cos(dotAngle);
  const dotTop = 50 + 50 * Math.sin(dotAngle);

  // Hovering a stat label keeps it bright and dims the rest, swapping its
  // value into the circle's center - no click-to-open card needed. Touch
  // has no real hover, but tapping still fires a synthetic mouseenter right
  // before the click, so this alone is enough to make tap-to-show work too;
  // an onClick toggle here would just race that synthetic mouseenter and
  // immediately cancel it back out.
  //
  // Gated on the plain `committed` boolean, not an opacity threshold - while
  // the labels are still CSS-transitioning into position, Chrome
  // re-evaluates which element is under the pointer on every layout shift
  // even though the pointer itself never moved, so a label sweeping past
  // wherever the cursor happens to be resting could fire a real mouseenter
  // and get stuck "hovered" with nothing to mouseleave it back off again -
  // a boolean switch has no fractional state for that to slip through.
  const infoInteractive = committed;
  // Belt-and-suspenders alongside the pointerEvents gate above: if a stale
  // hover ever does slip through, don't let it keep showing in the circle
  // (or dimming its siblings) once we've scrolled back out of the settled
  // circle state.
  useEffect(() => {
    if (!infoInteractive) {
      if (clearActiveTimer.current) {
        window.clearTimeout(clearActiveTimer.current);
        clearActiveTimer.current = null;
      }
      setActiveItem(null);
    }
  }, [infoInteractive]);

  // Clearing activeItem on each label's own onMouseLeave meant moving off a
  // label for *any* reason - including toward the circle itself, or just
  // into the gap between it and the next label - dropped straight back to
  // the default intro. What's wanted instead: once a label's been hovered,
  // keep showing it until the pointer actually leaves the whole circle's
  // neighborhood, not just that one label. So triggers only ever *set*
  // activeItem now; clearing it is this one distance check on the whole
  // stage instead, measured from the ring's own center.
  function handleStageMouseMove(e: React.MouseEvent) {
    if (!infoInteractive || !activeItem) return;
    const rect = ringRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    const circleRadius = Math.max(rect.width, rect.height) / 2;
    // Reach out to just past the far edge of the flanking label columns
    // (sideColGap is already measured from this same center point, so this
    // isn't circleRadius + sideColGap - that double-counts, since
    // sideColGap itself is roughly a circle-radius out already) - or, on
    // the narrow layout where labels sit in a grid below the circle
    // instead, just past the circle itself. Generous on purpose so this
    // only fires once the pointer has genuinely left the neighborhood, not
    // while crossing an ordinary gap between elements - but not generous
    // enough to cover half the screen either.
    const reach = (isWide ? sideColGap + 220 : circleRadius + 80) + 60;
    if (dist > reach) setActiveItemDebounced(null);
  }

  const specTrigger = (s: SpecItem, align: 'left' | 'right') => {
    const isActive = activeItem?.k === s.k;
    const dimmed = activeItem !== null && !isActive;
    return (
      <button
        key={s.k}
        type="button"
        onMouseEnter={() => setActiveItemDebounced(s)}
        style={{
          pointerEvents: infoInteractive ? 'auto' : 'none', cursor: 'pointer', background: 'none', border: 'none', padding: '5px 0',
          display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          flexDirection: align === 'right' ? 'row' : 'row-reverse',
          opacity: dimmed ? 0.35 : 1, transition: 'opacity .2s ease, color .2s ease',
        }}
      >
        <span style={{ font: `700 ${isWide ? 19 : 12}px 'Space Mono'`, letterSpacing: 1.5, color: isActive ? '#1a1714' : '#9a8a76' }}>{s.k}</span>
        <span style={{ width: isWide ? 8 : 6, height: isWide ? 8 : 6, borderRadius: '50%', background: color, flex: 'none' }} />
      </button>
    );
  };

  const sideColGap = ringW / 2 + 30;
  const ringTransform = `translate(-50%, calc(-50% + ${ringCenterY}px))`;

  return (
    <>
      <div ref={trackRef} style={{ height: '170vh', position: 'relative' }}>
        <div onMouseMove={handleStageMouseMove} style={{ position: 'sticky', top: 0, height: '100vh' }}>
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
            {/* The shadow has to be painted *behind* the box (it used to live
                in the "near" ring group below, which sits in front of the
                box - a semi-transparent dark gradient drawn on top of the
                box reads exactly like the box itself is see-through). Behind
                it, the box's own opaque rendering naturally covers the part
                of the shadow that should be hidden underneath it, while the
                rest still shows around its footprint as intended. */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: ringW, height: ringH, transform: ringTransform, borderRadius: '50%', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: '-8%', borderRadius: '50%', background: `radial-gradient(ellipse at ${50 + shadowShiftPct}% 50%, rgba(26,23,20,.4) 0%, rgba(26,23,20,.15) 55%, rgba(26,23,20,0) 80%)`, opacity: shadowOpacity }} />
            </div>

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
                  origin={origin}
                  roasterName={roasterName}
                  color={color}
                  placeholderLabel={placeholderLabel}
                  rotationY={renderRotationY}
                  onReady={() => setBoxReady(true)}
                />
              </Suspense>
            </div>

            <div ref={ringRef} style={{ position: 'absolute', left: '50%', top: '50%', width: ringW, height: ringH, transform: ringTransform, borderRadius: '50%', pointerEvents: 'none' }}>
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
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragging.current) return;
                  const rect = ringRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  // The ring is a near-flat ellipse, so the dot's whole swing
                  // reads almost entirely off the pointer's *horizontal*
                  // position - the matching render-side formula is exactly
                  // `dotLeft = 50 + 50*cos(dotAngle)`, so inverting with acos
                  // here keeps the two in lockstep. This also sidesteps the
                  // instability an atan2-based angle would have: dragging
                  // out toward either swing limit and back often sweeps the
                  // pointer back across the ring's own center point (the
                  // ellipse is barely 60px tall), where atan2(ny, nx) is a
                  // near-singularity - a sub-pixel wobble in ny there used to
                  // flip the angle by nearly a full turn and snap the box to
                  // the opposite limit. acos only reads nx, so it never sees
                  // that crossing at all.
                  const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
                  const dotAngle = Math.acos(Math.min(1, Math.max(-1, nx)));
                  setRotationY(clampRotation(REST_ROTATION + Math.PI / 2 - dotAngle));
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
                  position: 'absolute', left: '50%', top: '50%', width: ringW * 0.74,
                  // Plain CSS transition keyed off `committed`, decoupled
                  // from the box's own JS-driven shape tween above - this is
                  // the "text appearance" half of the reference the user
                  // pointed at, running on its own independent timing/easing
                  // rather than being locked to transitionT.
                  transform: `translate(-50%,-50%) translateY(${committed ? 0 : 10}px)`,
                  transition: 'opacity .8s ease, transform .8s ease',
                  textAlign: 'center', opacity: committed ? 1 : 0, padding: '0 8px',
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
                {/* Spread top-to-bottom across most of the circle's own
                    height (space-between, not a tight stack) so the three
                    labels per side read as sitting around the circle's
                    edge, the way onyx's spec wheel does, rather than
                    clustered in a huddle at its vertical center. */}
                {/* opacity-only CSS transition, no transform shift - these
                    are the interactive hover targets, and animating their
                    position while `committed` just flipped is exactly the
                    layout-shift-under-the-pointer scenario `infoInteractive`
                    guards against (see its comment above); position is
                    already final from the start, only visibility fades. */}
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 200, height: ringH * 0.64, transform: `translate(calc(-100% - ${sideColGap}px), calc(-50% + ${ringCenterY}px))`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: committed ? 1 : 0, transition: 'opacity .8s ease' }}>
                  {left.map(s => specTrigger(s, 'right'))}
                </div>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 200, height: ringH * 0.64, transform: `translate(${sideColGap}px, calc(-50% + ${ringCenterY}px))`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: committed ? 1 : 0, transition: 'opacity .8s ease' }}>
                  {right.map(s => specTrigger(s, 'left'))}
                </div>
              </>
            ) : (
              <div
                style={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: `translate(-50%, calc(-50% + ${ringCenterY}px + ${ringH / 2}px + 26px))`,
                  width: Math.min(stageWidth * 0.8, 300), opacity: committed ? 1 : 0, transition: 'opacity .8s ease',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 10, rowGap: 2,
                }}
              >
                {[...left, ...right].map(s => specTrigger(s, 'left'))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* The box model changed (see RotatingBox3D.tsx) and its source/license
          isn't confirmed yet - no attribution link here until that's known,
          rather than crediting the wrong model. */}
    </>
  );
}
