'use client';

/**
 * The reveal: the user's finished car as a scroll story, like the landing page but about their
 * build. Scrolling turns the camera round the car, opens it up into its parts, lifts the roof
 * off the cabin and ends on a full turn with the itemised specification and next steps.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import {
  AMBIENT_MODES,
  BODY_TYPES,
  COMFORTS,
  DEFAULT_BUILD,
  EXHAUSTS,
  FINISHES,
  GRAPHICS,
  HEADLINERS,
  LIVERY_COLOURS,
  MODS,
  QUILTS,
  REGIONS,
  SEATINGS,
  SEAT_COLOURS,
  SEAT_MATERIALS,
  STEERINGS,
  TRIMS,
  WHEEL_FINISHES,
  WHEELS,
  type Build,
  type OptionKey,
} from '@/data/options';
import {
  BUILD_KEYS,
  chipColour,
  commissionNumber,
  encodeBuild,
  money,
  optionLabel,
  paintHex,
  priceTag,
  sameValue,
} from '@/engine';
import { useEvaluation } from '@/components/config/useEngine';
import { useGo } from '@/components/shell/useGo';
import { Button } from '@/components/ui/Button';
import { Odometer } from '@/components/ui/Odometer';
import { prefersReducedMotion } from '@/lib/motion';
import { useBuild } from '@/store/build';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import styles from './Reveal.module.css';

gsap.registerPlugin(ScrollTrigger);

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
const lower = (s: string) => s.toLowerCase();
/** Lower-cases a name for use mid-sentence, keeping acronyms such as SUV and MPV. */
const inSentence = (s: string) =>
  s
    .split(' ')
    .map((w) => (w === w.toUpperCase() ? w : w.toLowerCase()))
    .join(' ');

interface Row {
  label: string;
  value: string;
  colour?: string | null;
}

/** The chapter cards' content, written from the build. */
function chapters(b: Build) {
  const graphic = (k: 'doorArt' | 'rearArt') =>
    b[k] === 'none' ? 'None' : `${GRAPHICS[b[k]].n}${b[k] === 'number' ? ` ${b.raceNo}` : ''}`;
  const exterior: Row[] = [
    {
      label: 'Paint',
      value: `${optionLabel('paint', b).name}, ${lower(FINISHES[b.finish].n)}`,
      colour: paintHex(b),
    },
    {
      label: 'Livery',
      value:
        b.livery === 'none'
          ? 'None'
          : `${optionLabel('livery', b).name} in ${lower(LIVERY_COLOURS[b.livCol].n)}`,
      colour: b.livery === 'none' ? null : LIVERY_COLOURS[b.livCol].c,
    },
    {
      label: 'Door graphics',
      value: graphic('doorArt'),
      colour: b.doorArt === 'none' ? null : LIVERY_COLOURS[b.artCol].c,
    },
    {
      label: 'Wheels',
      value: `${WHEELS[b.wheel].n}, ${b.size} inch, ${lower(WHEEL_FINISHES[b.wfin].n)}`,
      colour: WHEEL_FINISHES[b.wfin].c,
    },
    { label: 'Calipers', value: optionLabel('caliper', b).name, colour: chipColour('caliper', b) },
  ];
  const kit: Row[] = [
    {
      label: 'Rear graphics',
      value: graphic('rearArt'),
      colour: b.rearArt === 'none' ? null : LIVERY_COLOURS[b.artCol].c,
    },
    {
      label: 'Roof and accents',
      value: `${optionLabel('roof', b).name}; ${lower(optionLabel('accent', b).name)} accents`,
    },
    { label: 'Rear aero', value: optionLabel('spoiler', b).name },
    {
      label: 'Lights',
      value: `${optionLabel('sig', b).name}, ${lower(optionLabel('ltint', b).name)}`,
      colour: chipColour('ltint', b),
    },
    { label: 'Exhaust', value: EXHAUSTS[b.exhaust].n },
    { label: 'Mods', value: b.mods.length ? b.mods.map((m) => MODS[m].n).join(', ') : 'None' },
    ...(b.glow === 'none'
      ? []
      : [{ label: 'Underglow', value: optionLabel('glow', b).name, colour: chipColour('glow', b) }]),
  ];
  const cabin: Row[] = [
    { label: 'Seating', value: SEATINGS[b.seating].n },
    {
      label: 'Seats',
      value: `${SEAT_MATERIALS[b.seatMat].n} in ${lower(SEAT_COLOURS[b.seatCol].n)}, ${lower(QUILTS[b.quilt].n)} quilting`,
      colour: SEAT_COLOURS[b.seatCol].c,
    },
    { label: 'Trim', value: TRIMS[b.trim].n, colour: TRIMS[b.trim].a },
    {
      label: 'Steering and roof lining',
      value: `${STEERINGS[b.steer].n} wheel; ${lower(HEADLINERS[b.headliner].n)} headliner`,
    },
    {
      label: 'Ambient light',
      value: `${AMBIENT_MODES[b.ambMode].n}, ${Math.round(b.ambBri * 100)}%`,
      colour: b.amb,
    },
    {
      label: 'Comfort',
      value: b.comfort.length ? b.comfort.map((c) => COMFORTS[c].n).join(', ') : 'Standard',
    },
  ];
  return { exterior, kit, cabin };
}

/** How many choices differ from the factory specification. */
function personalised(b: Build) {
  return BUILD_KEYS.filter((k: OptionKey) => k !== 'region' && !sameValue(b[k], DEFAULT_BUILD[k])).length;
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className={styles.rows}>
      {rows.map((r) => (
        <Fragment key={r.label}>
          <dt data-kid>{r.label}</dt>
          <dd data-kid>
            {r.colour && <i style={{ background: r.colour }} />}
            {r.value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function RevealScreen() {
  const go = useGo();
  const build = useBuild((s) => s.build);
  const hydrated = useBuild((s) => s.hydrated);
  const regionChosen = useBuild((s) => s.regionChosen);
  const ev = useEvaluation();
  const R = REGIONS[build.region];
  const body = BODY_TYPES[build.body];
  const code = commissionNumber(build);
  const codeEls = useRef<(HTMLElement | null)[]>([]);
  const root = useRef<HTMLElement>(null);
  const { exterior, kit, cabin } = chapters(build);

  useEffect(() => {
    if (hydrated && !regionChosen) go('region');
  }, [hydrated, regionChosen, go]);

  // The commission number decodes in, once per change of build.
  useEffect(() => {
    const els = codeEls.current.filter(Boolean) as HTMLElement[];
    if (prefersReducedMotion()) {
      els.forEach((el) => (el.textContent = code));
      return;
    }
    const o = { p: 0 };
    const tw = gsap.to(o, {
      p: 1,
      duration: 1.4,
      delay: 0.6,
      ease: 'power2.out',
      onUpdate: () => {
        const txt = [...code]
          .map((c, i) =>
            i / code.length < o.p || c === '-' ? c : CHARS[Math.floor(Math.random() * CHARS.length)],
          )
          .join('');
        els.forEach((el) => (el.textContent = txt));
      },
    });
    return () => void tw.kill();
  }, [code]);

  // Scroll drives the camera story; cards clip in as their chapter arrives.
  useLayoutEffect(() => {
    const sc = root.current;
    if (!sc) return;
    useUi.setState({ revealT: 0 });
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        scroller: sc,
        trigger: sc.firstElementChild!,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (s) => useUi.setState({ revealT: s.progress * 5 }),
      });
      if (prefersReducedMotion()) return;
      gsap.from('[data-hero] > *', {
        opacity: 0,
        y: 26,
        duration: 1,
        stagger: 0.08,
        delay: 0.5,
        ease: 'expo.out',
      });
      sc.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
        const kids = card.querySelectorAll('[data-kid]');
        gsap.set(card, { clipPath: 'inset(0% 0% 100% 0% round 22px)', y: 60 });
        gsap.set(kids, { opacity: 0, y: 16 });
        ScrollTrigger.create({
          scroller: sc,
          trigger: card,
          start: 'top 82%',
          onEnter: () => {
            gsap.to(card, {
              clipPath: 'inset(0% 0% 0% 0% round 22px)',
              y: 0,
              duration: 1.1,
              ease: 'expo.out',
            });
            gsap.to(kids, { opacity: 1, y: 0, duration: 0.7, stagger: 0.035, delay: 0.15, ease: 'expo.out' });
          },
          onLeaveBack: () => {
            gsap.to(card, {
              clipPath: 'inset(0% 0% 100% 0% round 22px)',
              y: 60,
              duration: 0.5,
              ease: 'power2.in',
            });
            gsap.to(kids, { opacity: 0, y: 16, duration: 0.3 });
          },
        });
      });
    }, sc);
    return () => ctx.revert();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${code} ${location.origin}/build/shape?b=${encodeBuild(build)}`);
      toast('Build code copied.');
    } catch {
      toast(`This browser blocked copying. Your commission number is ${code}.`, 'warn');
    }
  };

  return (
    <section ref={root} className={styles.reveal} aria-label="Your build">
      <div>
        {/* 0: hero */}
        <div className={`${styles.chap} ${styles.hero}`}>
          <div className={styles.heroCopy} data-hero>
            <div className={styles.k}>Built for {R.n}</div>
            <h1>Your {inSentence(body.n)} is ready.</h1>
            <p>
              Hand-finished at the Halden atelier and delivered to {R.city} in about {R.weeks} weeks. Scroll
              to see every part you chose.
            </p>
            <div className={styles.heroFacts}>
              <div>
                <small>Commission number</small>
                <b
                  className="d"
                  ref={(el) => void (codeEls.current[0] = el)}
                  aria-label={`Commission number ${code}`}
                >
                  {code}
                </b>
              </div>
              <div>
                <small>Estimated on-road price</small>
                <Odometer value={ev.formatted} className={styles.odo} />
                <span className="sr">Estimated on-road price {ev.formatted}</span>
              </div>
            </div>
          </div>
          <div className={styles.cue}>
            <i />
            Scroll to take it apart
          </div>
        </div>

        {/* 1: side */}
        <div className={`${styles.chap} ${styles.right}`}>
          <article className={styles.card} data-card>
            <div className={styles.stp} data-kid>
              Exterior
            </div>
            <h2 data-kid>The colour you picked, on every panel.</h2>
            <Rows rows={exterior} />
          </article>
        </div>

        {/* 2: rear */}
        <div className={styles.chap}>
          <article className={styles.card} data-card>
            <div className={styles.stp} data-kid>
              Details and kit
            </div>
            <h2 data-kid>Seen from behind, fitted out.</h2>
            <Rows rows={kit} />
          </article>
        </div>

        {/* 3: exploded */}
        <div className={`${styles.chap} ${styles.right}`}>
          <article className={styles.card} data-card>
            <div className={styles.stp} data-kid>
              Every part
            </div>
            <h2 data-kid>Taken apart, piece by piece.</h2>
            <p data-kid>Each labelled part is one you specified. Tap a label to change it.</p>
            <div className={styles.facts}>
              <div data-kid>
                <b>{personalised(build)}</b>
                <span>choices made</span>
              </div>
              <div data-kid>
                <b>{SEATINGS[build.seating].seats}</b>
                <span>seats</span>
              </div>
              <div data-kid>
                <b>{R.weeks}</b>
                <span>weeks to build</span>
              </div>
            </div>
          </article>
        </div>

        {/* 4: cabin */}
        <div className={styles.chap}>
          <article className={styles.card} data-card>
            <div className={styles.stp} data-kid>
              Interior
            </div>
            <h2 data-kid>Where you will sit.</h2>
            <Rows rows={cabin} />
          </article>
        </div>

        {/* 5: final */}
        <div className={`${styles.chap} ${styles.final}`}>
          <article className={`${styles.card} ${styles.spec}`} data-card>
            <div className={styles.stp} data-kid>
              Your Halden {body.n}
            </div>
            <div className={styles.code} data-kid>
              <b className="d" ref={(el) => void (codeEls.current[1] = el)}>
                {code}
              </b>
              <small>Commission number</small>
            </div>
            <div className={styles.list} tabIndex={0} role="region" aria-label="Specification">
              {ev.lineItems.map((g) => (
                <div key={g.title} className={styles.group}>
                  <h4>{g.title}</h4>
                  {g.items.map((it) => (
                    <div key={it.label} className={styles.item}>
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
            <div className={styles.total}>
              <small>Estimated on-road price</small>
              <Odometer value={ev.formatted} className={styles.odo} />
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
          </article>
        </div>
      </div>
    </section>
  );
}
