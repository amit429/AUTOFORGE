'use client';

import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import { registerCurtain } from '@/lib/navigation';
import styles from './Shell.module.css';

/** Six vertical blinds that cover the screen during a page change (cover → swap → reveal). */
export function Curtain() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bars = () => [...(root.current?.children ?? [])];
    const screen = () => document.getElementById('screen');
    registerCurtain({
      cover: (soft) =>
        new Promise((resolve) => {
          if (soft) {
            gsap.to(screen(), { opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: () => resolve() });
            return;
          }
          gsap
            .timeline({ onComplete: () => resolve() })
            .set(bars(), { transformOrigin: '50% 100%' })
            .to(bars(), { scaleY: 1, duration: 0.48, ease: 'power3.in', stagger: 0.045 });
        }),
      reveal: (soft) =>
        new Promise((resolve) => {
          if (soft) {
            gsap.fromTo(
              screen(),
              { opacity: 0 },
              { opacity: 1, duration: 0.45, ease: 'power2.out', onComplete: () => resolve() },
            );
            return;
          }
          gsap.set(screen(), { opacity: 1 });
          gsap
            .timeline({ onComplete: () => resolve() })
            .set(bars(), { transformOrigin: '50% 0%' })
            .to(bars(), { scaleY: 0, duration: 0.65, ease: 'power3.out', stagger: 0.045, delay: 0.08 });
        }),
    });
    return () => registerCurtain(null);
  }, []);

  return (
    <div ref={root} className={styles.wipe} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
