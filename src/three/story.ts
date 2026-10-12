/** Landing scroll story keyframes (docs/3D_PIPELINE.md). Progress runs 0..5 across six chapters. */
import { clamp, lerp, smoothstep } from '@/lib/motion';

export interface StoryKey {
  theta: number;
  phi: number;
  r: number;
  tx: number;
  ty: number;
  ox: number;
  explode: number;
  cut: number;
}

export const STORY: StoryKey[] = [
  { theta: 0.95, phi: 1.33, r: 9.4, tx: 0, ty: 0.55, ox: 0.17, explode: 0, cut: 0 },
  { theta: 0.05, phi: 1.42, r: 8.3, tx: 0, ty: 0.55, ox: -0.17, explode: 0, cut: 0 },
  { theta: -0.75, phi: 1.08, r: 12.2, tx: 0, ty: 0.78, ox: 0.17, explode: 1, cut: 0 },
  { theta: 0.45, phi: 0.66, r: 6.4, tx: -0.4, ty: 0.8, ox: -0.16, explode: 0, cut: 1 },
  { theta: -2.3, phi: 1.3, r: 9, tx: 0, ty: 0.55, ox: 0.17, explode: 0, cut: 0 },
  { theta: -5.33, phi: 1.38, r: 10.6, tx: 0, ty: 0.85, ox: 0, explode: 0, cut: 0 },
];

/** The camera starts far out and blends into chapter 0 over the intro. */
export const INTRO = { theta: 2.5, phi: 1.12, r: 19, ty: 0.35 };

/** Interpolated story state at progress `p`, with a plateau around each chapter. */
export function storyAt(p: number, intro: number, mobile: boolean) {
  const t = clamp(p, 0, 5);
  const i = Math.min(4, Math.floor(t));
  const f = smoothstep(0.16, 0.84, t - i);
  const a = STORY[i]!;
  const b = STORY[i + 1]!;
  return {
    theta: lerp(INTRO.theta, lerp(a.theta, b.theta, f), intro),
    phi: lerp(INTRO.phi, lerp(a.phi, b.phi, f), intro),
    r: lerp(INTRO.r, lerp(a.r, b.r, f), intro),
    ty: lerp(INTRO.ty, lerp(a.ty, b.ty, f), intro),
    tx: lerp(a.tx, b.tx, f),
    ox: mobile ? 0 : lerp(a.ox, b.ox, f),
    oy: mobile ? 0.2 : 0,
    explode: lerp(a.explode, b.explode, f),
    cut: lerp(a.cut, b.cut, f),
  };
}

/** Paint demos cycled while chapter 1 ("Paint is only the first coat") is in view. */
export const PAINT_DEMO: [string, number, string][] = [
  ['#22339f', 1, '#eceef0'],
  ['#d9611a', 0, '#000000'],
  ['#a7c6b2', 2, '#121316'],
  ['#a8835a', 3, '#121316'],
  ['#5e1220', 6, '#c29a45'],
  ['#1c6853', 10, '#a4c2d3'],
];

/**
 * Reveal story: the user's finished build, scrolled through six chapters (hero, side, rear,
 * exploded, cabin, final turn). Authored for the 4.78 m coupe and fitted to the body by the
 * director. `ox` alternates so the car always sits opposite its chapter card.
 */
export const REVEAL: StoryKey[] = [
  { theta: 0.9, phi: 1.32, r: 9.6, tx: 0, ty: 0.55, ox: 0.17, explode: 0, cut: 0 },
  { theta: 0.06, phi: 1.42, r: 8.4, tx: 0, ty: 0.55, ox: -0.17, explode: 0, cut: 0 },
  { theta: -2.35, phi: 1.24, r: 8.8, tx: 0, ty: 0.6, ox: 0.17, explode: 0, cut: 0 },
  { theta: -0.75, phi: 1.06, r: 12.6, tx: 0, ty: 0.8, ox: -0.14, explode: 1, cut: 0 },
  { theta: 0.45, phi: 0.64, r: 6.6, tx: -0.4, ty: 0.8, ox: 0.16, explode: 0, cut: 1 },
  { theta: -5.4, phi: 1.36, r: 10, tx: 0, ty: 0.55, ox: 0.2, explode: 0, cut: 0 },
];

/** Interpolated reveal state at progress `p` (0..5). */
export function revealAt(p: number, mobile: boolean) {
  const t = clamp(p, 0, 5);
  const i = Math.min(4, Math.floor(t));
  const f = smoothstep(0.16, 0.84, t - i);
  const a = REVEAL[i]!;
  const b = REVEAL[i + 1]!;
  return {
    theta: lerp(a.theta, b.theta, f),
    phi: lerp(a.phi, b.phi, f),
    r: lerp(a.r, b.r, f),
    tx: lerp(a.tx, b.tx, f),
    ty: lerp(a.ty, b.ty, f),
    ox: mobile ? 0 : lerp(a.ox, b.ox, f),
    oy: mobile ? 0.2 : 0,
    explode: lerp(a.explode, b.explode, f),
    cut: lerp(a.cut, b.cut, f),
  };
}
