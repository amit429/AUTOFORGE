'use client';

import gsap from 'gsap';
import { motion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { PAINTS, REGIONS, REGION_IDS, type RegionId } from '@/data/options';
import { guessRegion } from '@/engine';
import { useGo } from '@/components/shell/useGo';
import { Button } from '@/components/ui/Button';
import { emit } from '@/lib/bus';
import { prefersReducedMotion } from '@/lib/motion';
import { useBuild } from '@/store/build';
import { Globe } from './Globe';
import styles from './Region.module.css';

/**
 * The first decision: where the car will be driven. Suggested from the device time zone; picking
 * a region previews its signature paint on the car before anything is committed.
 */
export function RegionScreen() {
  const go = useGo();
  const root = useRef<HTMLElement>(null);
  const [suggested] = useState<RegionId>(() => guessRegion());
  const [selected, setSelected] = useState<RegionId>(() =>
    useBuild.getState().regionChosen ? useBuild.getState().build.region : suggested,
  );
  const [hover, setHover] = useState<RegionId | null>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-title]', { opacity: 0, y: 30, duration: 0.9, ease: 'expo.out' });
      gsap.from('[data-lede]', {
        opacity: 0,
        y: 20,
        duration: 0.9,
        stagger: 0.1,
        delay: 0.1,
        ease: 'expo.out',
      });
      gsap.from('[data-card]', {
        opacity: 0,
        y: 40,
        scale: 0.96,
        duration: 0.8,
        stagger: 0.06,
        delay: 0.15,
        ease: 'expo.out',
      });
      gsap.from('[data-go]', { opacity: 0, y: 20, duration: 0.7, delay: 0.5, ease: 'expo.out' });
    }, root);
    return () => ctx.revert();
  }, []);

  const pick = (r: RegionId) => {
    setSelected(r);
    emit('previewPaint', {
      colour: PAINTS[REGIONS[r].paints[0]!].c,
      pattern: 0,
      patternColour: '#000000',
      duration: 1.2,
    });
  };

  const enter = () => {
    useBuild.getState().chooseRegion(selected);
    go('config');
  };

  return (
    <section ref={root} className={styles.region} aria-label="Choose your region">
      <div className={styles.left}>
        <h2 data-title>Where will you drive it?</h2>
        <p data-lede>
          Your region decides the drive side, currency, legal limits and the exclusives you can order. You can
          change it later; anything that stops being available is swapped out and explained.
        </p>
        <div data-lede>
          <Globe focus={hover ?? selected} selected={selected} />
        </div>
      </div>
      <div>
        <div
          className={styles.list}
          role="radiogroup"
          aria-label="Region"
          onPointerLeave={() => setHover(null)}
        >
          {REGION_IDS.map((k) => {
            const R = REGIONS[k];
            const on = k === selected;
            return (
              <motion.button
                key={k}
                data-card
                role="radio"
                aria-checked={on}
                className={`${styles.rg} ${on ? styles.on : ''}`}
                onPointerEnter={() => setHover(k)}
                onClick={() => pick(k)}
                whileTap={{ scale: 0.97 }}
              >
                {k === suggested && <span className={styles.sug}>Suggested</span>}
                <div className={styles.nm}>{R.n}</div>
                <div className={styles.meta}>
                  {R.drive === 'RHD' ? 'Right' : 'Left'}-hand drive, prices in {R.cur}
                </div>
                <div className={styles.ex}>
                  {R.paints.map((p) => (
                    <i key={p} style={{ background: PAINTS[p].c }} />
                  ))}
                  <span>{R.paints.map((p) => PAINTS[p].n).join(' and ')}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
        <div className={styles.go} data-go>
          <Button magnetic arrow cursor="Enter" onClick={enter}>
            Start designing
          </Button>
          <small>Suggested from your device time zone.</small>
        </div>
      </div>
    </section>
  );
}
