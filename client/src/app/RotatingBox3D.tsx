import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// "Package box mockup" by _simone.rizzi (CC-BY-4.0), sourced from Sketchfab:
// https://sketchfab.com/3d-models/package-box-mockup-3b68aaab1d7d4bce889a2803b131a375
// The model's own diffuse texture ships with a placeholder label panel at a
// known pixel rect - we redraw that rect with each coffee's own cover photo
// rather than replacing the whole texture, so the surrounding cardboard
// material (and the model's UVs) stay untouched.
const BOX_MODEL_URL = '/assets/package-box.glb';
const TEXTURE_SIZE = 2048;
const LABEL_RECT = { x: 1075, y: 733, width: 519, height: 790 };

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
  paintLabel: (img: HTMLImageElement | null, color: string) => void;
}

export function RotatingBox3D({ src, color, placeholderLabel, onRotationChange, onReady }: {
  src: string | null; color: string; placeholderLabel: string;
  onRotationChange?: (rotationY: number) => void;
  onReady?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Rendering here is all imperative (direct Three.js calls), so `dragging`
  // only needs to gate the move handler - a ref avoids the stale-closure
  // window a useState value would have between pointerdown and its re-render.
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const rotationAtDragStart = useRef(0);

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

    function paintLabel(img: HTMLImageElement | null, fallbackColor: string) {
      const st = stateRef.current;
      if (!st?.baseImage) return;
      labelCtx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      labelCtx.drawImage(st.baseImage, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      if (img) {
        try {
          // cover-fit the coffee's photo into the label rect
          const rectAspect = LABEL_RECT.width / LABEL_RECT.height;
          const imgAspect = img.width / img.height;
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          if (imgAspect > rectAspect) {
            sw = img.height * rectAspect;
            sx = (img.width - sw) / 2;
          } else {
            sh = img.width / rectAspect;
            sy = (img.height - sh) / 2;
          }
          labelCtx.drawImage(img, sx, sy, sw, sh, LABEL_RECT.x, LABEL_RECT.y, LABEL_RECT.width, LABEL_RECT.height);
        } catch {
          // tainted canvas (cross-origin photo without CORS headers) - leave
          // the plain base cardboard showing rather than breaking the page.
          labelCtx.fillStyle = fallbackColor;
          labelCtx.fillRect(LABEL_RECT.x, LABEL_RECT.y, LABEL_RECT.width, LABEL_RECT.height);
        }
      } else {
        labelCtx.fillStyle = fallbackColor;
        labelCtx.fillRect(LABEL_RECT.x, LABEL_RECT.y, LABEL_RECT.width, LABEL_RECT.height);
      }
      texture.needsUpdate = true;
      render();
    }

    // The model's labeled face sits opposite the camera by default (its
    // own authored orientation, unrelated to the label's position within
    // the texture) - start rotated to face it so customers see the label
    // immediately instead of having to drag first.
    const INITIAL_ROTATION = Math.PI;
    boxGroup.rotation.y = INITIAL_ROTATION;
    stateRef.current = { renderer, scene, camera, boxGroup, material, labelCanvas, labelCtx, baseImage: null, rotationY: INITIAL_ROTATION, render, paintLabel };

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
        paintLabel(null, color);
        setReady(true);
        onReady?.();
        onRotationChange?.(INITIAL_ROTATION);

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

  // Repaint just the label whenever the coffee (photo/color) changes - the
  // model and base cardboard texture are already loaded and stay put.
  useEffect(() => {
    const st = stateRef.current;
    if (!st || !ready) return;
    if (!src) {
      st.paintLabel(null, color);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => st.paintLabel(img, color);
    img.onerror = () => st.paintLabel(null, color);
    img.src = src;
  }, [src, color, ready]);

  if (failed) {
    // Model failed to load (offline, blocked, etc.) - fall back to a flat
    // placeholder rather than an empty box.
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(140deg,${color}22,#fff)` }}>
        {src ? (
          <img src={src} alt={placeholderLabel} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ font: "700 11px 'Space Mono'", letterSpacing: 2, color, opacity: .7 }}>{placeholderLabel}</span>
        )}
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
        onPointerDown={(e) => {
          const st = stateRef.current;
          if (!st) return;
          dragging.current = true;
          dragStartX.current = e.clientX;
          rotationAtDragStart.current = st.rotationY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const st = stateRef.current;
          if (!st || !dragging.current) return;
          st.rotationY = rotationAtDragStart.current + (e.clientX - dragStartX.current) / 140;
          st.boxGroup.rotation.y = st.rotationY;
          st.render();
          onRotationChange?.(st.rotationY);
        }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        style={{ position: 'relative', width: '100%', height: '100%', cursor: 'grab', touchAction: 'pan-y', opacity: ready ? 1 : 0, transition: 'opacity .4s ease' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  );
}
