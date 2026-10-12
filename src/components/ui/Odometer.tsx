'use client';

import { useLayoutEffect, useRef } from 'react';
import styles from './Odometer.module.css';

/**
 * Price display where each digit rolls independently to its new value. Digits further right
 * take slightly longer, so a change reads as a sweep. Decorative: callers announce the price
 * through a live region.
 */
export function Odometer({ value, className }: { value: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const chars = [...value];

  // Start new digits at 0 on first paint so they roll up, rather than appearing in place.
  useLayoutEffect(() => {
    const cols = root.current?.querySelectorAll<HTMLElement>('[data-d]');
    cols?.forEach((c) => {
      const target = c.dataset.d!;
      if (c.dataset.shown === undefined) {
        c.style.transition = 'none';
        c.style.transform = 'translateY(0%)';
        void c.offsetHeight;
        c.style.transition = '';
      }
      c.dataset.shown = target;
      c.style.transform = `translateY(${-10 * Number(target)}%)`;
    });
  }, [value]);

  return (
    <div ref={root} className={`${styles.odo} ${className ?? ''}`} aria-hidden="true">
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={`${chars.length}-${i}`} className={styles.dg}>
            <span data-d={ch} style={{ transitionDuration: `${0.7 + i * 0.05}s` }}>
              {'0123456789'.split('').map((n) => (
                <i key={n}>{n}</i>
              ))}
            </span>
          </span>
        ) : (
          <span key={`${chars.length}-${i}`} className={styles.sy}>
            {ch}
          </span>
        ),
      )}
    </div>
  );
}
