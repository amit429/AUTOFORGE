'use client';

import gsap from 'gsap';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { REGIONS, STEPS, type Step } from '@/data/options';
import { STEP_PANELS } from '@/components/steps';
import { useGo } from '@/components/shell/useGo';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Odometer } from '@/components/ui/Odometer';
import { emit } from '@/lib/bus';
import { dur, isMobile, prefersReducedMotion, spring } from '@/lib/motion';
import { useBuild, type View } from '@/store/build';
import { useUi } from '@/store/ui';
import { inspire } from './inspire';
import { useEvaluation } from './useEngine';
import styles from './Configurator.module.css';

const stepTitle = (s: Step, regionName: string) => (s.id === 'region' ? `${regionName} pack` : s.n);

export function Configurator() {
  useShortcuts();
  return (
    <section className={styles.config} aria-label="Configurator">
      <Spine />
      <ViewSwitch />
      <Tools />
      <Panel />
      <Tape />
      <Entrance />
    </section>
  );
}

/** Ctrl/Cmd+Z undoes; Escape returns to the studio view. */
function useShortcuts() {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useBuild.getState().undo();
      }
      if (e.key === 'Escape' && useBuild.getState().view !== 'studio') useBuild.getState().setView('studio');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
}

/** Staggered entrance of the configurator chrome, as in the prototype. */
function Entrance() {
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(`.${styles.sp}, .${styles.spG}`, {
        opacity: 0,
        x: -24,
        duration: 0.7,
        stagger: 0.035,
        delay: 0.15,
        ease: 'expo.out',
      });
      gsap.from(`.${styles.panel}`, { opacity: 0, x: 50, duration: 0.9, delay: 0.1, ease: 'expo.out' });
      gsap.from(`.${styles.tape}`, { opacity: 0, y: 40, duration: 0.9, delay: 0.2, ease: 'expo.out' });
      gsap.from(`.${styles.viewsw}`, { opacity: 0, y: -20, duration: 0.8, delay: 0.25, ease: 'expo.out' });
      gsap.from(`.${styles.tool}`, {
        opacity: 0,
        scale: 0.5,
        duration: 0.6,
        stagger: 0.06,
        delay: 0.4,
        ease: 'back.out(2)',
      });
    });
    return () => ctx.revert();
  }, []);
  return null;
}

function Spine() {
  const step = useBuild((s) => s.step);
  const visited = useBuild((s) => s.visited);
  const region = useBuild((s) => s.build.region);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isMobile()) return;
    ref.current?.querySelector(`[data-step="${step}"]`)?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [step]);

  return (
    <nav ref={ref} className={styles.spine} aria-label="Build steps">
      {STEPS.map((s, i) => {
        const heading =
          i === 0 || STEPS[i - 1]!.g !== s.g ? (
            <div key={`g-${s.g}`} className={styles.spG}>
              {s.g}
            </div>
          ) : null;
        const on = i === step;
        return [
          heading,
          <button
            key={s.id}
            data-step={i}
            className={`${styles.sp} ${on ? styles.on : ''} ${visited.includes(i) && !on ? styles.done : ''}`}
            aria-current={on ? 'step' : undefined}
            onClick={() => useBuild.getState().goStep(i)}
          >
            {on && (
              <motion.span
                layoutId="spine-pill"
                className={styles.spPill}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className={styles.n}>{String(i + 1).padStart(2, '0')}</span>
            <span>{stepTitle(s, REGIONS[region].n)}</span>
            <Icon name="check" className={styles.ck} />
          </button>,
        ];
      })}
    </nav>
  );
}

const VIEWS: { v: View; label: string }[] = [
  { v: 'studio', label: 'Studio' },
  { v: 'exploded', label: 'Exploded' },
  { v: 'blueprint', label: 'Blueprint' },
  { v: 'cabin', label: 'Cabin' },
];

function ViewSwitch() {
  const view = useBuild((s) => s.view);
  return (
    <div className={styles.viewsw} role="tablist" aria-label="View">
      {VIEWS.map((v) => (
        <button
          key={v.v}
          role="tab"
          aria-selected={view === v.v}
          className={view === v.v ? styles.on : undefined}
          onClick={() => view !== v.v && useBuild.getState().setView(v.v)}
        >
          {v.label}
          {view === v.v && <motion.span layoutId="view-pill" className={styles.pill} transition={spring} />}
        </button>
      ))}
    </div>
  );
}

function Tools() {
  const lightsOn = useUi((s) => s.lightsOn);
  const shuffle = useRef<HTMLButtonElement>(null);
  return (
    <div className={styles.tools}>
      <button
        ref={shuffle}
        className={styles.tool}
        data-tip="Inspire me"
        aria-label="Inspire me with a random build"
        onClick={() => {
          inspire();
          if (shuffle.current)
            gsap.fromTo(
              shuffle.current,
              { rotate: 0 },
              { rotate: 360, duration: dur(0.8), ease: 'expo.out' },
            );
        }}
      >
        <Icon name="shuffle" />
      </button>
      <button
        className={`${styles.tool} ${lightsOn ? styles.on : ''}`}
        data-tip={lightsOn ? 'Lights off' : 'Lights on'}
        aria-label="Toggle lights"
        aria-pressed={lightsOn}
        onClick={() => emit('lights', !lightsOn)}
      >
        <Icon name="lamp" />
      </button>
      <button
        className={styles.tool}
        data-tip="Reset camera"
        aria-label="Reset camera"
        onClick={() => emit('resetCamera')}
      >
        <Icon name="camera" />
      </button>
    </div>
  );
}

function Panel() {
  const step = useBuild((s) => s.step);
  const region = useBuild((s) => s.build.region);
  const go = useGo();
  // Remember the previous step during render to know which way the panel content slides.
  const [track, setTrack] = useState({ step, dir: 1 });
  if (track.step !== step) setTrack({ step, dir: step >= track.step ? 1 : -1 });
  const dir = track.step !== step ? (step >= track.step ? 1 : -1) : track.dir;

  const S = STEPS[step]!;
  const R = REGIONS[region];
  const title = stepTitle(S, R.n);
  const desc = S.id === 'region' ? `Packs built for driving in ${R.n}. They are only offered here.` : S.d;
  const next = STEPS[step + 1];
  const Body = STEP_PANELS[S.id];

  return (
    <aside className={styles.panel} aria-label="Options">
      <div className={styles.pnH}>
        <div className={styles.k}>
          Step {step + 1} of {STEPS.length}, {S.g.toLowerCase()}
        </div>
        <h3 aria-label={title} key={title}>
          {[...title].map((c, i) => (
            <span key={i} className={styles.chMask} aria-hidden="true">
              <motion.span
                className={styles.ch}
                initial={prefersReducedMotion() ? false : { y: '110%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1 }}
                transition={{ duration: 0.55, delay: i * 0.012, ease: [0.16, 1, 0.3, 1] }}
              >
                {c === ' ' ? ' ' : c}
              </motion.span>
            </span>
          ))}
        </h3>
        <motion.p
          key={desc}
          initial={prefersReducedMotion() ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06 }}
        >
          {desc}
        </motion.p>
      </div>
      <div className={styles.pnBody} id="panel-body">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <StepBody key={S.id} dir={dir}>
            <Body />
          </StepBody>
        </AnimatePresence>
      </div>
      <div className={styles.pnF}>
        <Button
          variant="ghost"
          size="sm"
          back
          style={{ visibility: step ? 'visible' : 'hidden' }}
          onClick={() => useBuild.getState().goStep(step - 1)}
        >
          Back
        </Button>
        <Button
          size="sm"
          className={styles.next}
          onClick={() => (next ? useBuild.getState().goStep(step + 1) : go('summary'))}
        >
          {next ? `Next: ${stepTitle(next, R.n)}` : 'Reveal my build'}
        </Button>
      </div>
    </aside>
  );
}

/** Step content: blurs out on exit; on enter, its blocks stagger in with the blur clearing. */
function StepBody({ dir, children }: { dir: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.parentElement?.scrollTo({ top: 0 });
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      el.children,
      { opacity: 0, y: 18 * dir, filter: 'blur(6px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.6,
        stagger: 0.05,
        ease: 'expo.out',
        clearProps: 'filter,transform',
      },
    );
  }, [dir]);
  return (
    <motion.div
      ref={ref}
      exit={
        prefersReducedMotion()
          ? undefined
          : {
              opacity: 0,
              y: -10 * dir,
              filter: 'blur(4px)',
              transition: { duration: 0.2, ease: [0.55, 0, 1, 0.45] },
            }
      }
    >
      {children}
    </motion.div>
  );
}

function Tape() {
  const history = useBuild((s) => s.history);
  const go = useGo();
  const ev = useEvaluation();
  const chips = history.slice(-16);
  return (
    <div className={styles.tape}>
      <div className={styles.hist} aria-label="Your changes">
        {!history.length && <span className={styles.empty}>Your changes collect here. Undo any time.</span>}
        <AnimatePresence initial={false}>
          {chips.map((h) => (
            <motion.span
              key={h.id}
              layout
              className={styles.hc}
              initial={{ opacity: 0, x: 30, scale: 0.8 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                transition: { type: 'spring', stiffness: 420, damping: 22 },
              }}
              exit={{ opacity: 0, x: 20, transition: { duration: 0.3 } }}
            >
              <i style={{ background: h.colour ?? 'var(--clay)' }} />
              {h.label}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <div className={styles.histCtl}>
        <button
          className={styles.tool}
          aria-label="Undo last change"
          data-tip="Undo"
          onClick={() => useBuild.getState().undo()}
        >
          <Icon name="undo" />
        </button>
      </div>
      <div className={styles.price}>
        <small>Estimated on-road price</small>
        <Odometer value={ev.formatted} />
        <span className="sr" aria-live="polite">
          Estimated price {ev.formatted}
        </span>
      </div>
      <Button magnetic cursor="Reveal" className={styles.reveal} onClick={() => go('summary')}>
        Reveal my build
      </Button>
    </div>
  );
}
