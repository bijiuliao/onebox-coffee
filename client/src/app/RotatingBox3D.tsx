import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REST_ROTATION } from './boxRotation';

// "Coffee capsules pack" box mockup (geometry only - the model's own
// branded packaging texture is stripped out at build time; we paint our own
// solid-color + printed-text label over the whole box instead, onyx-style).
// TODO: fill in the Sketchfab source URL/author/license here once known -
// the uploaded source files didn't carry that metadata embedded.
const BOX_MODEL_URL = '/assets/cube-box.glb';
const TEXTURE_SIZE = 2048;
// UV bounding box (scaled to TEXTURE_SIZE) of the model's +Z face, measured
// directly from its own mesh data - this is the face that ends up pointed at
// the camera at rest (see REST_ROTATION in boxRotation.ts).
const LABEL_RECT = { x: 1040, y: 793, width: 921, height: 621 };
const LABEL_INK = '#f4f1ea';

let cachedGeometry: Promise<THREE.BufferGeometry> | null = null;

function loadBoxGeometry(): Promise<THREE.BufferGeometry> {
  if (!cachedGeometry) {
    cachedGeometry = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        BOX_MODEL_URL,
        (gltf) => {
          let mesh: THREE.Mesh | undefined;
          gltf.scene.traverse((obj) => {
            if (!mesh && (obj as THREE.Mesh).isMesh) mesh = obj as THREE.Mesh;
          });
          if (!mesh) { reject(new Error('cube-box.glb: no mesh found')); return; }
          resolve(mesh.geometry);
        },
        undefined,
        (err) => reject(err instanceof Error ? err : new Error('failed to load cube-box.glb')),
      );
    });
  }
  return cachedGeometry;
}

// A flat solid fill alone reads as cheap plastic, especially once it's
// partly see-through during the scroll fade - a faint paper-grain speckle
// breaks up that flatness without being an obviously "textured" pattern.
// Built once (resolution-independent as a repeating pattern) and reused
// across every repaint and every box instance.
let cachedGrainPattern: CanvasPattern | null = null;
function getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (cachedGrainPattern) return cachedGrainPattern;
  const tile = document.createElement('canvas');
  const tileSize = 160;
  tile.width = tileSize;
  tile.height = tileSize;
  const tileCtx = tile.getContext('2d')!;
  const imageData = tileCtx.createImageData(tileSize, tileSize);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = Math.random() * 14; // very faint - texture, not pattern
  }
  tileCtx.putImageData(imageData, 0, 0);
  cachedGrainPattern = ctx.createPattern(tile, 'repeat');
  return cachedGrainPattern;
}

// Greedy word-wrap against the context's *currently set* font, capped at
// `maxLines` - the caller shrinks the font and retries if that cap is hit.
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  boxGroup: THREE.Group;
  material: THREE.MeshStandardMaterial;
  labelCanvas: HTMLCanvasElement;
  labelCtx: CanvasRenderingContext2D;
  rotationY: number;
  render: () => void;
  paintLabel: (origin: string, roasterName: string, boxColor: string) => void;
}

export function RotatingBox3D({ origin, roasterName, color, placeholderLabel, rotationY, onReady }: {
  origin: string;
  roasterName: string;
  color: string;
  placeholderLabel: string;
  // Rotation is controlled from outside - the ring's dot is the only drag
  // handle (see BoxStatsHero), this component just points the box wherever
  // it's told.
  rotationY: number;
  onReady?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    let cancelled = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.1, 6.2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-4, -1, 3);
    scene.add(fill);

    const boxGroup = new THREE.Group();
    scene.add(boxGroup);

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = TEXTURE_SIZE;
    labelCanvas.height = TEXTURE_SIZE;
    const labelCtx = labelCanvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // The label face is viewed at an angle, not head-on, so without this the
    // default anisotropy of 1 lets mipmapping blur the printed text badly
    // along the oblique axis - this is the single biggest sharpness knob.
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, metalness: 0 });

    function render() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      const canvasEl = renderer.domElement;
      if (canvasEl.width !== Math.round(w * renderer.getPixelRatio()) || canvasEl.height !== Math.round(h * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    }

    function paintLabel(originText: string, roasterText: string, boxColor: string) {
      // The whole box is a single solid color now (no cardboard photo to
      // underlay) - the coffee's theme color fills every face, and the
      // printed text sits in cream ink on top of the one face that's
      // pointed at the camera at rest.
      labelCtx.fillStyle = boxColor;
      labelCtx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      const grain = getGrainPattern(labelCtx);
      if (grain) {
        labelCtx.fillStyle = grain;
        labelCtx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      }

      const { x, y, width, height } = LABEL_RECT;
      const cx = x + width / 2;
      labelCtx.fillStyle = LABEL_INK;
      labelCtx.textAlign = 'center';
      labelCtx.textBaseline = 'middle';

      // Origin - small, letter-spaced caption near the top (onyx prints its
      // own origin the same way, above the big roaster wordmark).
      labelCtx.font = "700 34px 'Space Mono'";
      labelCtx.letterSpacing = '5px';
      labelCtx.fillText(originText.toUpperCase(), cx, y + height * 0.15);
      labelCtx.letterSpacing = '0px';

      // Roaster name - the big centerpiece. Shrinks and wraps (up to 3
      // lines) to fit whatever the actual name turns out to be.
      const maxWidth = width * 0.86;
      let fontSize = 104;
      let lines: string[] = [roasterText];
      while (fontSize > 46) {
        labelCtx.font = `600 ${fontSize}px 'Room205'`;
        lines = wrapLines(labelCtx, roasterText, maxWidth);
        if (lines.length <= 3 && lines.every(l => labelCtx.measureText(l).width <= maxWidth)) break;
        fontSize -= 6;
      }
      const lineHeight = fontSize * 1.08;
      const startY = y + height * 0.52 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, i) => labelCtx.fillText(line, cx, startY + i * lineHeight));

      texture.needsUpdate = true;
      render();
    }

    boxGroup.rotation.y = REST_ROTATION;
    stateRef.current = { renderer, scene, camera, boxGroup, material, labelCanvas, labelCtx, rotationY: REST_ROTATION, render, paintLabel };

    loadBoxGeometry()
      .then((geometry) => {
        if (cancelled || !stateRef.current) return;
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox!;
        const size = new THREE.Vector3();
        bb.getSize(size);
        const center = new THREE.Vector3();
        bb.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2.05 / maxDim;

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(-center.x, -center.y, -center.z);
        const inner = new THREE.Group();
        inner.add(mesh);
        inner.scale.setScalar(scale);
        boxGroup.add(inner);

        paintLabel(origin, roasterName, color);
        setReady(true);
        onReady?.();

        // Rise up out of the ring, like the box is being lifted into view
        // rather than just appearing. The ring/shadow themselves now live in
        // the external wrapper, which reads `ready` via onReady to time its
        // own entrance.
        const RISE_START_Y = -1.6;
        boxGroup.position.y = RISE_START_Y;
        const start = performance.now();
        const DURATION = 700;
        function tick(now: number) {
          if (cancelled) return;
          const t = Math.min(1, (now - start) / DURATION);
          const eased = 1 - Math.pow(1 - t, 3);
          boxGroup.position.y = RISE_START_Y * (1 - eased);
          render();
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    const ro = new ResizeObserver(() => render());
    ro.observe(container);

    return () => {
      cancelled = true;
      ro.disconnect();
      renderer.dispose();
      material.dispose();
      texture.dispose();
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint just the label whenever the coffee (origin/roaster/color)
  // changes - the model is already loaded and stays put.
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !ready) return;
    st.paintLabel(origin, roasterName, color);
  }, [origin, roasterName, color, ready]);

  // Point the box at whatever angle the dot (dragged externally) reports.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    st.rotationY = rotationY;
    st.boxGroup.rotation.y = rotationY;
    st.render();
  }, [rotationY]);

  if (failed) {
    // Model failed to load (offline, blocked, etc.) - fall back to a flat
    // placeholder rather than an empty box.
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(140deg,${color}22,#fff)` }}>
        <span style={{ font: "700 11px 'Space Mono'", letterSpacing: 2, color, opacity: .7 }}>{placeholderLabel}</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(140deg,${color}22,#fff)` }} />
      )}
      <div
        ref={containerRef}
        role="img"
        aria-label={placeholderLabel}
        style={{ position: 'relative', width: '100%', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity .4s ease' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  );
}
