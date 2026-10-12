'use client';

import { useEffect, useRef } from 'react';
import { REGIONS, type RegionId } from '@/data/options';
import styles from './Region.module.css';

/** Rough continent blobs [lat, lon, radius°] used to decide which dots are land. */
const LAND: [number, number, number][] = [
  [45, -100, 24],
  [55, -110, 18],
  [-15, -60, 17],
  [50, 15, 12],
  [5, 20, 24],
  [-20, 25, 14],
  [45, 90, 28],
  [60, 100, 22],
  [21, 78, 9],
  [-25, 135, 13],
  [24, 45, 9],
  [36, 138, 4],
  [63, 15, 7],
  [30, 110, 14],
  [15, 105, 8],
];

function dots() {
  const N = 1500;
  const out: [number, number, boolean][] = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = i * 2.39996;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (((Math.atan2(Math.sin(th) * rr, Math.cos(th) * rr) * 180) / Math.PI + 540) % 360) - 180;
    const land = LAND.some(([la, lo, r]) => {
      const dl = la - lat;
      const dn = (((lo - lon + 540) % 360) - 180) * Math.cos((lat * Math.PI) / 180);
      return dl * dl + dn * dn < r * r;
    });
    out.push([lat, lon, land]);
  }
  return out;
}

/** A dotted globe that eases round to the focused region, with a pulsing marker on the selection. */
export function Globe({ focus, selected }: { focus: RegionId; selected: RegionId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ rot: REGIONS[focus].lon, focus, selected });
  useEffect(() => {
    state.current.focus = focus;
    state.current.selected = selected;
  }, [focus, selected]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const pts = dots();
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const W = cv.clientWidth;
      if (!W) return;
      const dpr = Math.min(devicePixelRatio, 2);
      if (cv.width !== W * dpr) cv.width = cv.height = W * dpr;
      const x = cv.getContext('2d')!;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, W, W);
      const cs = getComputedStyle(document.documentElement);
      const ink = cs.getPropertyValue('--ink').trim();
      const clay = cs.getPropertyValue('--clay').trim();
      const s = state.current;
      s.rot += (((REGIONS[s.focus].lon - s.rot + 540) % 360) - 180) * 0.06;
      const c = W / 2;
      const R = W * 0.44;
      const ct = Math.cos(-0.32);
      const st = Math.sin(-0.32);
      const P = (lat: number, lon: number) => {
        const la = (lat * Math.PI) / 180;
        const lo = ((lon - s.rot) * Math.PI) / 180;
        const X = Math.cos(la) * Math.sin(lo);
        const Y = Math.sin(la);
        const Z = Math.cos(la) * Math.cos(lo);
        return [c + X * R, c - (Y * ct - Z * st) * R, Y * st + Z * ct] as const;
      };
      x.strokeStyle = ink;
      x.globalAlpha = 0.12;
      x.lineWidth = 1;
      x.beginPath();
      x.arc(c, c, R, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = ink;
      for (const [la, lo, land] of pts) {
        const [sx, sy, z] = P(la, lo);
        if (z < 0) continue;
        x.globalAlpha = land ? 0.25 + z * 0.6 : 0.05 + z * 0.1;
        x.beginPath();
        x.arc(sx, sy, land ? 1.6 : 1, 0, Math.PI * 2);
        x.fill();
      }
      const t = performance.now() / 1000;
      for (const k of Object.keys(REGIONS) as RegionId[]) {
        const Rg = REGIONS[k];
        const [sx, sy, z] = P(Rg.lat, Rg.lon);
        if (z < 0) continue;
        const on = k === s.selected;
        x.globalAlpha = on ? 1 : 0.55;
        x.fillStyle = clay;
        x.beginPath();
        x.arc(sx, sy, on ? 5 : 3.5, 0, Math.PI * 2);
        x.fill();
        if (on) {
          const ph = (t % 1.6) / 1.6;
          x.globalAlpha = 1 - ph;
          x.strokeStyle = clay;
          x.lineWidth = 1.5;
          x.beginPath();
          x.arc(sx, sy, 5 + ph * 18, 0, Math.PI * 2);
          x.stroke();
        }
      }
      x.globalAlpha = 1;
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const R = REGIONS[selected];
  return (
    <div className={styles.globeWrap}>
      <canvas ref={canvas} className={styles.globe} aria-hidden="true" />
      <div className={styles.globeCap}>
        {R.n}: {R.drive === 'RHD' ? 'right' : 'left'}-hand drive, {R.cur}, delivery to {R.city}
      </div>
    </div>
  );
}
