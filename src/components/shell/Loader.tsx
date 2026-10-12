'use client';

import gsap from 'gsap';
import { useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import { useUi } from '@/store/ui';
import styles from './Loader.module.css';

/**
 * First-load loader: the logo strokes draw, the counter runs to 100, then the screen splits top
 * and bottom and hands over to the hero (which starts the camera intro).
 */
export function Loader() {
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const finish = () => {
      useUi.setState({ introStarted: true });
      setDone(true);
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    let tl: gsap.core.Timeline | null = null;
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      const paths = [...el.querySelectorAll<SVGPathElement>('path')];
      paths.forEach((p) => {
        const L = p.getTotalLength();
        p.style.strokeDasharray = String(L);
        p.style.strokeDashoffset = String(L);
      });
      const num = el.querySelector<HTMLElement>('[data-num]');
      const bar = el.querySelector<HTMLElement>('[data-bar]');
      const cnt = { v: 0 };
      tl = gsap
        .timeline({ onComplete: () => setDone(true) })
        .to(paths[0]!, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut' })
        .to(paths[1]!, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 0.5)
        .to(
          cnt,
          {
            v: 100,
            duration: 1.6,
            ease: 'power2.inOut',
            onUpdate: () => {
              if (num) num.textContent = String(Math.round(cnt.v));
              if (bar) bar.style.transform = `scaleX(${cnt.v / 100})`;
            },
          },
          0,
        )
        .to(el.querySelector('[data-in]'), { y: -20, opacity: 0, duration: 0.45, ease: 'power2.in' }, '+=.1')
        .to(el.querySelector('[data-top]'), { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=.1')
        .to(el.querySelector('[data-bottom]'), { yPercent: 100, duration: 1.1, ease: 'expo.inOut' }, '<')
        .add(() => useUi.setState({ introStarted: true }), '<0.2');
    };
    void (document.fonts?.ready ?? Promise.resolve()).then(run);
    const fallback = setTimeout(run, 2500);
    return () => {
      clearTimeout(fallback);
      tl?.kill();
    };
  }, []);

  if (done) return null;
  return (
    <div ref={root} className={styles.loader} aria-live="polite" aria-label="Loading AutoForge">
      <div className={styles.half} data-top style={{ top: 0 }} />
      <div className={styles.half} data-bottom style={{ bottom: 0 }} />
      <div className={styles.inner} data-in>
        <svg viewBox="0 0 120 60" aria-hidden="true">
          <path d="M14 54 L44 6 L74 54 M27 34 H61" />
          <path d="M70 20 H108 M76 36 H104" />
        </svg>
        <div className={styles.word}>AUTOFORGE</div>
        <div className={styles.bar}>
          <i data-bar />
        </div>
        <div className={styles.num}>
          <span data-num>0</span>%
        </div>
      </div>
    </div>
  );
}
