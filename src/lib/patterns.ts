/**
 * JavaScript mirror of the paint shader's pattern function (src/three/materials/paint.ts), used
 * for option card previews and the blueprint livery overlay so 2D and 3D always agree.
 */
import { clamp, lerp, smoothstep as sstep } from './motion';
import { hexToRgb } from './color';

const fr = (v: number) => v - Math.floor(v);
const md = (a: number, b: number) => a - b * Math.floor(a / b);

function hsh(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnz(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hsh(ix, iy), hsh(ix + 1, iy), fx), lerp(hsh(ix, iy + 1), hsh(ix + 1, iy + 1), fx), fy);
}
function hexD(qx: number, qy: number) {
  const ry = 1.7320508;
  const ax = md(qx, 1) - 0.5;
  const ay = md(qy, ry) - ry / 2;
  const bx = md(qx - 0.5, 1) - 0.5;
  const by = md(qy - ry / 2, ry) - ry / 2;
  let gx: number;
  let gy: number;
  if (ax * ax + ay * ay < bx * bx + by * by) {
    gx = ax;
    gy = ay;
  } else {
    gx = bx;
    gy = by;
  }
  gx = Math.abs(gx);
  gy = Math.abs(gy);
  return Math.max(gx * 0.5 + gy * 0.8660254, gx);
}

/** Pattern coverage 0..1 at a point in car space. `top` picks the plan (xz) projection. */
export function patternMask(
  id: number,
  px: number,
  py: number,
  pz: number,
  top: boolean,
  sc: number,
): number {
  if (id < 0.5) return 0;
  const u = px * sc;
  const v = (top ? pz : py) * sc;
  switch (id) {
    case 1: {
      const w = 0.075 * sc;
      return 1 - sstep(w - 0.008, w, Math.abs(Math.abs(pz) - 0.2));
    }
    case 2: {
      const yl = 0.48 + 0.12 * sc;
      return 1 - sstep(yl - 0.008, yl + 0.008, py);
    }
    case 3:
      return sstep(0.43, 0.47, hexD(u * 5, v * 5));
    case 4:
      return Math.max(
        hsh(Math.floor(u * 9), Math.floor(v * 9)) >= 0.66 ? 1 : 0,
        hsh(Math.floor(u * 4.5) + 7.3, Math.floor(v * 4.5) + 7.3) >= 0.72 ? 1 : 0,
      );
    case 5: {
      const t = fr(u * 2.2 + Math.abs(fr(v * 2.2) - 0.5));
      return sstep(0.48, 0.5, t) * (1 - sstep(0.78, 0.8, t));
    }
    case 6:
      return sstep(0.44, 0.47, Math.abs(fr(v * 9) - 0.5));
    case 7: {
      const qx = u * 4.5;
      const qy = v * 4.5;
      const c1 = Math.abs(Math.hypot(fr(qx) - 0.5, fr(qy) - 0.5) - 0.36);
      const c2 = Math.abs(Math.hypot(fr(qx + 0.5) - 0.5, fr(qy + 0.5) - 0.5) - 0.36);
      return 1 - sstep(0.025, 0.05, Math.min(c1, c2));
    }
    case 8: {
      let qx = u * 4;
      const qy = v * 6;
      qx += md(Math.floor(qy), 2) * 0.5;
      const d = Math.hypot(fr(qx) - 0.5, fr(qy)) * 1.6;
      return (1 - sstep(0.12, 0.2, Math.abs(fr(d * 3) - 0.5))) * (d <= 1 ? 1 : 0);
    }
    case 9: {
      const gx = fr(u * 3.5) - 0.5;
      const gy = fr(v * 3.5) - 0.5;
      const st = Math.min(Math.max(Math.abs(gx), Math.abs(gy)), (Math.abs(gx) + Math.abs(gy)) * 0.70710678);
      return Math.max(
        1 - sstep(0.018, 0.036, Math.abs(st - 0.3)),
        1 - sstep(0.012, 0.028, Math.abs(st - 0.16)),
      );
    }
    case 10: {
      const w = Math.sin(u * 1.6 + Math.sin(v * 2.4 + u * 0.8) * 1.6 + vnz(u * 1.3, v * 1.3) * 2);
      return sstep(0.2, 0.9, w) * 0.9;
    }
    case 11: {
      const cx = u * 22;
      const cy = v * 22;
      const chk = md(Math.floor(cx) + Math.floor(cy), 2);
      const fib = chk > 0.5 ? fr(cx) : fr(cy);
      return (chk > 0.5 ? 0.75 : 0.15) * (0.6 + 0.4 * Math.sin(fib * Math.PI));
    }
    case 12:
      return 0.5 + 0.5 * Math.sin((u * 1.5 + vnz(u * 1.2, v * 6) * 1.8) * 18);
    case 13:
      return hsh(Math.floor(v * 260), Math.floor(u * 1.5)) * 0.6;
    case 14: {
      const rx = (u - v) * 0.70710678 * 7;
      const ry = (u + v) * 0.70710678 * 7;
      return 1 - sstep(0.012, 0.035, 0.5 - Math.max(Math.abs(fr(rx) - 0.5), Math.abs(fr(ry) - 0.5)));
    }
    case 15:
      return sstep(0.455, 0.485, hexD(u * 9, v * 9));
    case 16:
      return sstep(0.445, 0.48, Math.abs(fr(u * 8) - 0.5));
    case 17:
      return 1 - sstep(0.14, 0.2, Math.hypot(fr(u * 22) - 0.5, fr(v * 22) - 0.5));
  }
  return 0;
}

export type PreviewMode = 'liv' | 'seat' | 'trim';

/** Paints a pattern swatch into a canvas, lit with a soft top-down falloff. */
export function drawPattern(
  canvas: HTMLCanvasElement,
  opts: { id: number; a: string; b: string; mode: PreviewMode; scale?: number },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: W, height: H } = canvas;
  const img = ctx.createImageData(W, H);
  const A = hexToRgb(opts.a);
  const B = hexToRgb(opts.b);
  const span = opts.mode === 'liv' ? 2.2 : opts.mode === 'seat' ? 0.62 : 0.8;
  const sc = opts.mode === 'liv' ? (opts.scale ?? 1) : 1;
  for (let j = 0; j < H; j++) {
    const yy = 1 - j / H;
    for (let i = 0; i < W; i++) {
      const px = (i / W - 0.5) * span;
      const py = opts.mode === 'liv' ? lerp(0.25, 1.25, yy) : 0.7 + (yy * span * H) / W;
      const pz = (j / H - 0.5) * ((span * H) / W);
      const m = clamp(patternMask(opts.id, px, py, pz, opts.id === 1, sc), 0, 1);
      const sh = 0.82 + 0.28 * yy;
      const o = (j * W + i) * 4;
      img.data[o] = (A[0] * (1 - m) + B[0] * m) * sh;
      img.data[o + 1] = (A[1] * (1 - m) + B[1] * m) * sh;
      img.data[o + 2] = (A[2] * (1 - m) + B[2] * m) * sh;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Livery overlay for the blueprint: pattern colour with alpha = coverage, in car units. */
export function liveryOverlay(id: number, colour: string, scale: number, top: boolean): string | null {
  if (!id || typeof document === 'undefined') return null;
  const S = 100;
  const W = 556;
  const H = top ? 210 : 170;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  const B = hexToRgb(colour);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const x = i / S - 2.78;
      const y = top ? 0 : 1.7 - j / S;
      const z = top ? j / S - 1.05 : 0.99;
      const m = clamp(patternMask(id, x, y, z, top, scale), 0, 1);
      const o = (j * W + i) * 4;
      img.data[o] = B[0];
      img.data[o + 1] = B[1];
      img.data[o + 2] = B[2];
      img.data[o + 3] = m * 255;
    }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}
