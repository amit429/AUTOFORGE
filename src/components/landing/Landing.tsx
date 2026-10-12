'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LIVERIES, PAINTS, REGIONS, REGION_IDS, type RegionId } from '@/data/options';
import { useGo } from '@/components/shell/useGo';
import { Button } from '@/components/ui/Button';
import { emit } from '@/lib/bus';
import { prefersReducedMotion } from '@/lib/motion';
import { useUi } from '@/store/ui';
import styles from './Landing.module.css';

gsap.registerPlugin(ScrollTrigger);

const HERO = 'Built panel by panel, by you.';
const FINAL = 'Your Vesper GT starts here.';

const Words = ({ text }: { text: string }) => (
  <>
    {text.split(' ').map((w, i) => (
      <Fragment key={i}>
        {i > 0 && ' '}
        <span className={styles.mask}>
          <span className={styles.word} data-word>
            {w}
          </span>
        </span>
      </Fragment>
    ))}
  </>
);

interface Chapter {
  step: string;
  title: string;
  body: string;
  facts?: [string, string][];
  right?: boolean;
  demo?: boolean;
}

const CHAPTERS: Chapter[] = [
  {
    step: 'Exterior',
    title: 'Paint is only the first coat.',
    body: 'Twenty-two paints across five finishes, plus paint to sample in any colour, from gloss to a colour-shifting chroma flip. Lay a livery over it, then keep going: roof, mirrors, aero, grille, wheels, calipers, lamps and glass are all yours to set.',
    facts: [
      ['22', 'paints'],
      ['10', 'liveries'],
      ['5', 'finishes'],
    ],
    right: true,
  },
  {
    step: 'Component view',
    title: 'See how it comes apart.',
    body: 'Every customisable part is its own piece of the model. Pull the car apart to understand what you are choosing, then tap any part to jump straight to it.',
    facts: [
      ['14', 'part groups'],
      ['4', 'views'],
      ['1', 'live price'],
    ],
  },
  {
    step: 'Interior',
    title: 'Sit inside before it exists.',
    body: 'Lift the roof off and look in. Seat material, quilting, stitch colour, trim and ambient light all render live in the cabin, with the steering wheel on the side you drive.',
    facts: [
      ['6', 'leathers'],
      ['5', 'quilts'],
      ['∞', 'light colours'],
    ],
    right: true,
  },
  {
    step: 'Regional',
    title: 'Built for where you drive.',
    body: "Your region sets the drive side, the currency, the legal tint limit and which exclusives you can order. Try one: the car shows that region's signature paint.",
    demo: true,
  },
];

export function Landing() {
  const go = useGo();
  const scroller = useRef<HTMLElement>(null);
  const [demo, setDemo] = useState<RegionId | null>(null);

  // Scroll progress drives the 3D story (0..5 across six chapters).
  useLayoutEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    useUi.setState({ storyT: 0 });
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        scroller: sc,
        trigger: sc.firstElementChild!,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (s) => useUi.setState({ storyT: s.progress * 5 }),
      });
      if (prefersReducedMotion()) return;
      sc.querySelectorAll<HTMLElement>('[data-story]').forEach((st) => {
        const kids = st.querySelectorAll('[data-kid]');
        gsap.set(st, { clipPath: 'inset(0% 0% 100% 0% round 22px)', y: 60 });
        gsap.set(kids, { opacity: 0, y: 22 });
        ScrollTrigger.create({
          scroller: sc,
          trigger: st,
          start: 'top 82%',
          onEnter: () => {
            gsap.to(st, { clipPath: 'inset(0% 0% 0% 0% round 22px)', y: 0, duration: 1.2, ease: 'expo.out' });
            gsap.to(kids, { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, delay: 0.2, ease: 'expo.out' });
            st.querySelectorAll<HTMLElement>('[data-count]').forEach((b) => {
              const n = Number(b.dataset.count);
              const o = { v: 0 };
              gsap.to(o, {
                v: n,
                duration: 1.4,
                delay: 0.4,
                ease: 'power3.out',
                onUpdate: () => void (b.textContent = String(Math.round(o.v))),
              });
            });
          },
          onLeaveBack: () => {
            gsap.to(st, {
              clipPath: 'inset(0% 0% 100% 0% round 22px)',
              y: 60,
              duration: 0.5,
              ease: 'power2.in',
            });
            gsap.to(kids, { opacity: 0, y: 22, duration: 0.3 });
          },
        });
      });
      const fin = sc.querySelectorAll('[data-final] [data-word]');
      gsap.set(fin, { yPercent: 110 });
      ScrollTrigger.create({
        scroller: sc,
        trigger: sc.querySelector('[data-final]')!,
        start: 'top 90%',
        onEnter: () => gsap.to(fin, { yPercent: 0, duration: 1, stagger: 0.07, ease: 'expo.out' }),
        onLeaveBack: () => gsap.to(fin, { yPercent: 110, duration: 0.4 }),
      });
    }, sc);
    return () => ctx.revert();
  }, []);

  // The hero rises once the loader hands over.
  useEffect(() => {
    const sc = scroller.current;
    if (!sc || prefersReducedMotion()) return;
    const words = sc.querySelectorAll('[data-hero] [data-word]');
    const rest = sc.querySelectorAll('[data-hero-rest]');
    const header = document.querySelectorAll('[data-header] > *');
    const play = () => {
      gsap.from(words, { yPercent: 115, rotate: 4, duration: 1.2, stagger: 0.08, ease: 'expo.out' });
      gsap.from(rest, { opacity: 0, y: 24, duration: 1, stagger: 0.1, delay: 0.45, ease: 'expo.out' });
      gsap.from(header, {
        opacity: 0,
        y: -18,
        duration: 0.9,
        stagger: 0.08,
        delay: 0.3,
        ease: 'expo.out',
        clearProps: 'all',
      });
      gsap.delayedCall(1.3, () => emit('welcome'));
    };
    if (useUi.getState().introStarted) return;
    gsap.set(words, { yPercent: 115 });
    return useUi.subscribe((s, p) => {
      if (s.introStarted && !p.introStarted) {
        gsap.set(words, { yPercent: 0 });
        play();
      }
    });
  }, []);

  const tryRegion = (r: RegionId) => {
    setDemo(r);
    const R = REGIONS[r];
    const L = R.liveries[0];
    emit('previewPaint', {
      colour: PAINTS[R.paints[0]!].c,
      pattern: L ? LIVERIES[L].id : 0,
      patternColour: '#eceef0',
    });
  };

  return (
    <section ref={scroller} className={styles.landing} aria-label="Introduction">
      <div className={styles.track}>
        <div className={`${styles.chap} ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <h1 data-hero aria-label={HERO}>
              <Words text={HERO} />
            </h1>
            <p data-hero-rest>
              The Halden Vesper GT, configured down to the stitch. Paint, livery, wheels, lamps, glass,
              leather and light: each one chosen, seen in 3D and priced for where you live, as you go.
            </p>
            <div className={styles.cta} data-hero-rest>
              <Button magnetic arrow cursor="Start" onClick={() => go('region')}>
                Start your build
              </Button>
              <Button magnetic variant="ghost" onClick={() => go('doc')}>
                Read the design blueprint
              </Button>
            </div>
          </div>
          <div className={styles.cue}>
            <i />
            Scroll to take it apart
          </div>
        </div>
        {CHAPTERS.map((c) => (
          <div key={c.step} className={`${styles.chap} ${c.right ? styles.right : ''}`}>
            <div className={styles.story} data-story>
              <div className={styles.stp} data-kid>
                {c.step}
              </div>
              <h2 data-kid>{c.title}</h2>
              <p data-kid>{c.body}</p>
              {c.facts && (
                <div className={styles.facts}>
                  {c.facts.map(([n, l]) => (
                    <div key={l} data-kid>
                      <b data-count={/^\d+$/.test(n) ? n : undefined}>{n}</b>
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
              )}
              {c.demo && (
                <div className={styles.regDemo}>
                  {REGION_IDS.map((r) => {
                    const p = PAINTS[REGIONS[r].paints[0]!];
                    return (
                      <button
                        key={r}
                        data-kid
                        aria-pressed={demo === r}
                        className={demo === r ? styles.on : undefined}
                        onClick={() => tryRegion(r)}
                      >
                        <i style={{ background: p.c }} />
                        <span>{REGIONS[r].n}</span>
                        <small>{p.n}</small>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        <div className={`${styles.chap} ${styles.final}`} data-final>
          <h2 aria-label={FINAL}>
            <Words text={FINAL} />
          </h2>
          <p>About ten minutes, saved as you go.</p>
          <div className={styles.cta}>
            <Button magnetic arrow cursor="Start" onClick={() => go('region')}>
              Start your build
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
