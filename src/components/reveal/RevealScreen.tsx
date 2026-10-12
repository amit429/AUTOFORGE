'use client';

import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { REGIONS } from '@/data/options';
import { commissionNumber, encodeBuild, money, priceTag } from '@/engine';
import { useEvaluation } from '@/components/config/useEngine';
import { useGo } from '@/components/shell/useGo';
import { Button } from '@/components/ui/Button';
import { Odometer } from '@/components/ui/Odometer';
import { prefersReducedMotion } from '@/lib/motion';
import { useBuild } from '@/store/build';
import { toast } from '@/store/toasts';
import styles from './Reveal.module.css';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

/** The ceremony at the end: itemised spec, final price and a commission number that decodes in. */
export function RevealScreen() {
  const go = useGo();
  const build = useBuild((s) => s.build);
  const hydrated = useBuild((s) => s.hydrated);
  const regionChosen = useBuild((s) => s.regionChosen);
  const ev = useEvaluation();
  const R = REGIONS[build.region];
  const code = commissionNumber(build);
  const codeEl = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hydrated && !regionChosen) go('region');
  }, [hydrated, regionChosen, go]);

  useEffect(() => {
    const el = codeEl.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.textContent = code;
      return;
    }
    const o = { p: 0 };
    const tw = gsap.to(o, {
      p: 1,
      duration: 1.4,
      delay: 0.5,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = [...code]
          .map((c, i) =>
            i / code.length < o.p || c === '-' ? c : CHARS[Math.floor(Math.random() * CHARS.length)],
          )
          .join('');
      },
    });
    return () => void tw.kill();
  }, [code]);

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-col]', { opacity: 0, x: -50, duration: 1, ease: 'expo.out', delay: 0.1 });
      gsap.from('[data-row]', {
        opacity: 0,
        x: -18,
        duration: 0.6,
        stagger: 0.03,
        delay: 0.35,
        ease: 'expo.out',
      });
      gsap.from('[data-badge]', { opacity: 0, y: 30, duration: 1, delay: 0.4, ease: 'expo.out' });
    }, root);
    return () => ctx.revert();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${code} ${location.origin}/build/paint?b=${encodeBuild(build)}`);
      toast('Build code copied.');
    } catch {
      toast(`This browser blocked copying. Your commission number is ${code}.`, 'warn');
    }
  };

  return (
    <section ref={root} className={styles.summary} aria-label="Your build">
      <div className={styles.col} data-col>
        <div className={styles.head}>
          <div className={styles.k}>Built for {R.n}</div>
          <h2>Your Vesper GT</h2>
          <p>
            Hand-finished at the Halden atelier and delivered to {R.city} in about {R.weeks} weeks. A client
            advisor can turn this build into an order.
          </p>
        </div>
        <div className={styles.body}>
          {ev.lineItems.map((g) => (
            <div key={g.title} className={styles.group}>
              <h4 data-row>{g.title}</h4>
              {g.items.map((it) => (
                <div key={it.label} className={styles.row} data-row>
                  <i style={{ background: it.colour ?? 'transparent' }} />
                  <span>
                    {it.label}
                    <small>{it.detail}</small>
                  </span>
                  <em>
                    {it.usd == null
                      ? ''
                      : it.base
                        ? money(it.usd, build.region)
                        : priceTag(it.usd, build.region)}
                  </em>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.foot}>
          <div className={styles.total}>
            <small>Estimated on-road price</small>
            <Odometer value={ev.formatted} className={styles.odo} />
            <span className="sr">Estimated on-road price {ev.formatted}</span>
          </div>
          <div className={styles.actions}>
            <Button size="sm" onClick={copy}>
              Copy build code
            </Button>
            <Button size="sm" variant="ghost" onClick={() => go('config')}>
              Edit build
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                useBuild.getState().startOver();
                go('config');
              }}
            >
              Start over
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.badge} data-badge>
        <div className="d" ref={codeEl} aria-label={`Commission number ${code}`}>
          {code}
        </div>
        <small>Commission number</small>
      </div>
    </section>
  );
}
