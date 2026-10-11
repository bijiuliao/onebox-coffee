import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REST_ROTATION } from './boxRotation';

// "Package box mockup" by _simone.rizzi (CC-BY-4.0), sourced from Sketchfab:
// https://sketchfab.com/3d-models/package-box-mockup-3b68aaab1d7d4bce889a2803b131a375
// The model's own diffuse texture ships with a placeholder label panel at a
// known pixel rect - we redraw that rect with the coffee's origin + roaster
// name (onyx-style, text printed straight on the box) rather than replacing
// the whole texture, so the surrounding cardboard material (and the model's
// UVs) stay untouched.
const BOX_MODEL_URL = '/assets/package-box.glb';
const TEXTURE_SIZE = 2048;
const LABEL_RECT = { x: 1075, y: 733, width: 519, height: 790 };
const LABEL_BG = '#f4f1ea';

interface BoxAssets {
  geometry: THREE.BufferGeometry;
  baseImage: HTMLImageElement;
}

function readChunkType(dv: DataView, offset: number): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += String.fromCharCode(dv.getUint8(offset + i));
  return s.replace(/\0/g, '').trim();
}

// GLTFLoader doesn't understand this model's legacy KHR_materials_pbrSpecularGlossiness
// extension, so it never populates material.map - the diffuse texture it
// references just never gets wired up. Geometry isn't affected by that (it's
// not part of the material), so GLTFLoader still handles that fine; the
// base texture image is pulled out by parsing the GLB's own binary chunks
// directly (same technique used to find the label's pixel rect originally).
async function extractBaseImage(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  let offset = 12;
  let json: { images?: { bufferView: number; mimeType?: string }[]; bufferViews?: { byteOffset?: number; byteLength: number }[] } | null = null;
  let binStart = -1;
  while (offset < buf.byteLength) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = readChunkType(dv, offset + 4);
    const dataStart = offset + 8;
    if (chunkType === 'JSON') {
      json = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(buf, dataStart, chunkLength)));
    } else if (chunkType === 'BIN') {
      binStart = dataStart;
    }
    offset = dataStart + chunkLength;
  }
  const imageDesc = json?.images?.[0];
  const bv = imageDesc && json?.bufferViews?.[imageDesc.bufferView];
  if (!imageDesc || !bv || binStart < 0) throw new Error('package-box.glb: no embedded image found');
  const imgBytes = new Uint8Array(buf, binStart + (bv.byteOffset || 0), bv.byteLength);
  const blob = new Blob([imgBytes], { type: imageDesc.mimeType || 'image/png' });
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to decode base texture image'));
    img.src = objectUrl;
  });
}

let cachedAssets: Promise<BoxAssets> | null = null;

function loadBoxAssets(): Promise<BoxAssets> {
  if (!cachedAssets) {
    const geometryPromise = new Promise<THREE.BufferGeometry>((resolve, reject) => {
      new GLTFLoader().load(
        BOX_MODEL_URL,
        (gltf) => {
          let mesh: THREE.Mesh | undefined;
          gltf.scene.traverse((obj) => {
            if (!mesh && (obj as THREE.Mesh).isMesh) mesh = obj as THREE.Mesh;
          });
          if (!mesh) { reject(new Error('package-box.glb: no mesh found')); return; }
          resolve(mesh.geometry);
        },
        undefined,
        (err) => reject(err instanceof Error ? err : new Error('failed to load package-box.glb')),
      );
    });
    cachedAssets = Promise.all([geometryPromise, extractBaseImage(BOX_MODEL_URL)])
      .then(([geometry, baseImage]) => ({ geometry, baseImage }));
  }
  return cachedAssets;
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
  baseImage: HTMLImageElement | null;
  rotationY: number;
  render: () => void;
  paintLabel: (origin: string, roasterName: string, textColor: string) => void;
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

    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88, metalness: 0 });

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

    function paintLabel(originText: string, roasterText: string, textColor: string) {
      const st = stateRef.current;
      if (!st?.baseImage) return;
      labelCtx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      labelCtx.drawImage(st.baseImage, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

      const { x, y, width, height } = LABEL_RECT;
      labelCtx.save();
      labelCtx.beginPath();
      labelCtx.rect(x, y, width, height);
      labelCtx.clip();
      labelCtx.fillStyle = LABEL_BG;
      labelCtx.fillRect(x, y, width, height);

      // This face's UVs run the u-axis backwards relative to the rest of
      // the model, so anything drawn normally comes out mirrored
      // left-to-right on the box - pre-mirror horizontally around the
      // rect's own center so it reads correctly once applied.
      const rectCx = x + width / 2;
      labelCtx.translate(rectCx, 0);
      labelCtx.scale(-1, 1);
      labelCtx.translate(-rectCx, 0);

      const cx = x + width / 2;
      labelCtx.fillStyle = textColor;
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

      labelCtx.restore();
      texture.needsUpdate = true;
      render();
    }

    boxGroup.rotation.y = REST_ROTATION;
    stateRef.current = { renderer, scene, camera, boxGroup, material, labelCanvas, labelCtx, baseImage: null, rotationY: REST_ROTATION, render, paintLabel };

    loadBoxAssets()
      .then(({ geometry, baseImage }) => {
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

        stateRef.current.baseImage = baseImage;
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
  // changes - the model and base cardboard texture are already loaded and
  // stay put.
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
