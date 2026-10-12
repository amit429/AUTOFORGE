/**
 * The studio around the car: an equirectangular environment painted into a canvas (soft cyc
 * gradient plus softbox strips), key/rim/hemisphere lights, a shadow-catching floor and the
 * turntable ring. Built from an equirect texture, not PMREM.fromScene, which rendered black on
 * some GPUs in the prototype (docs/3D_PIPELINE.md).
 */
import * as THREE from 'three';

/** Physically based lights need π× the prototype's legacy intensities for the same look. */
export const LIGHT_K = Math.PI;
export const LIGHTS = { hemi: 0.45 * LIGHT_K, key: 1.5 * LIGHT_K, rim: 0.7 * LIGHT_K };

export function studioEnvironment() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#f4f5f7');
  g.addColorStop(0.38, '#a9adb3');
  g.addColorStop(0.5, '#5d6168');
  g.addColorStop(0.62, '#2a2c30');
  g.addColorStop(1, '#0b0b0d');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 512);
  const box = (cx: number, cy: number, w: number, h: number, a: number) => {
    const r = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
    r.addColorStop(0, `rgba(255,255,255,${a})`);
    r.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = r;
    x.fillRect(cx - w * 1.2, cy - h * 1.2, w * 2.4, h * 2.4);
    x.fillStyle = `rgba(255,255,255,${a})`;
    x.fillRect(cx - w / 2, cy - h / 2, w, h);
  };
  box(512, 40, 520, 46, 1);
  box(140, 200, 40, 170, 0.95);
  box(380, 215, 26, 150, 0.8);
  box(660, 210, 30, 160, 0.85);
  box(900, 200, 44, 170, 0.95);
  box(256, 250, 300, 10, 0.6);
  box(768, 252, 300, 10, 0.6);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radial(inner: string, outer: string, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export interface Studio {
  group: THREE.Group;
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  turntable: THREE.Group;
  ringMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function buildStudio(mobile: boolean): Studio {
  const group = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4048, LIGHTS.hemi);
  const key = new THREE.DirectionalLight(0xffffff, LIGHTS.key);
  key.position.set(4, 9, 5);
  key.castShadow = true;
  const sm = mobile ? 1024 : 2048;
  key.shadow.mapSize.set(sm, sm);
  Object.assign(key.shadow.camera, { left: -4.2, right: 4.2, top: 4.2, bottom: -4.2, near: 1, far: 26 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  const rim = new THREE.DirectionalLight(0xbcd0ff, LIGHTS.rim);
  rim.position.set(-6, 4, -5);
  group.add(hemi, key, rim);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.26 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.receiveShadow = true;
  const blobTex = radial('rgba(0,0,0,.75)', 'rgba(0,0,0,0)');
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 3.4),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.002;
  group.add(shadow, blob);

  const turntable = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x14171c,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.315, 160), ringMat);
  ring.rotation.x = -Math.PI / 2;
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(3.55, 3.56, 160), ringMat);
  ring2.rotation.x = -Math.PI / 2;
  turntable.add(ring, ring2);
  // Tick marks merged into one geometry: 120 ticks, one draw call.
  const ticks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const L = i % 10 === 0 ? 0.16 : 0.07;
    const g = new THREE.PlaneGeometry(0.008, L);
    g.rotateX(-Math.PI / 2);
    g.rotateY(a);
    g.translate(Math.sin(a) * (3.33 + L / 2), 0.001, Math.cos(a) * (3.33 + L / 2));
    ticks.push(g);
  }
  const merged = mergeGeometries(ticks);
  turntable.add(new THREE.Mesh(merged, ringMat));
  turntable.position.y = 0.003;
  group.add(turntable);

  return {
    group,
    hemi,
    key,
    rim,
    shadow,
    turntable,
    ringMat,
    dispose: () => {
      group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      blobTex.dispose();
      ringMat.dispose();
      shadow.material.dispose();
      (blob.material as THREE.Material).dispose();
    },
  };
}

/** Minimal merge for non-indexed-compatible plane geometries (position/normal/uv + index). */
function mergeGeometries(geos: THREE.BufferGeometry[]) {
  const out = new THREE.BufferGeometry();
  const attrs = ['position', 'normal', 'uv'] as const;
  const arrays: Record<string, number[]> = { position: [], normal: [], uv: [] };
  const index: number[] = [];
  let offset = 0;
  for (const g of geos) {
    for (const a of attrs) arrays[a]!.push(...(g.getAttribute(a).array as Float32Array));
    const idx = g.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) index.push(idx.getX(i) + offset);
    offset += g.getAttribute('position').count;
    g.dispose();
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(arrays.position!, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(arrays.normal!, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(arrays.uv!, 2));
  out.setIndex(index);
  return out;
}

/** Day/night studio: turntable ink, shadow strength and exposure follow the theme. */
export function themeStudio(studio: Studio, renderer: THREE.WebGLRenderer, dark: boolean, ink: string) {
  studio.ringMat.color.set(ink || '#14171c');
  studio.ringMat.opacity = dark ? 0.16 : 0.22;
  studio.shadow.material.opacity = dark ? 0.5 : 0.26;
  renderer.toneMappingExposure = dark ? 1 : 1.08;
}
