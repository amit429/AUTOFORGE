'use client';

import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import styles from './Shell.module.css';

/** Dot + trailing ring. The ring grows into a label ("Drag", "Start", "Reveal") over [data-cursor]. */
export function Cursor() {
  const root = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return;
    let mx = -99;
    let my = -99;
    let rx = -99;
    let ry = -99;
    const move = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    const tick = () => {
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      if (dot.current) dot.current.style.transform = `translate(${mx}px,${my}px)`;
      if (ring.current) ring.current.style.transform = `translate(${rx}px,${ry}px)`;
    };
    const over = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const el = root.current;
      if (!t?.closest || !el) return;
      const lab = t.closest<HTMLElement>('[data-cursor]');
      if (lab?.dataset.cursor) {
        el.dataset.mode = 'lab';
        if (label.current) label.current.textContent = lab.dataset.cursor;
      } else if (t.closest('button,a,input,summary,[role="radio"]')) el.dataset.mode = 'hov';
      else el.dataset.mode = '';
    };
    addEventListener('pointermove', move);
    document.addEventListener('pointerover', over);
    gsap.ticker.add(tick);
    return () => {
      removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      gsap.ticker.remove(tick);
    };
  }, []);

  return (
    <div ref={root} className={styles.cursor} aria-hidden="true">
      <div ref={dot} className={styles.cDot} />
      <div ref={ring} className={styles.cRing}>
        <span ref={label} />
      </div>
    </div>
  );
}
