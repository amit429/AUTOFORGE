'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  LAMP_TINTS,
  LIVERIES,
  PACKS,
  PAINTS,
  REGIONS,
  REGION_IDS,
  SEAT_MATERIALS,
  TRIMS,
} from '@/data/options';
import { useGo } from '@/components/shell/useGo';
import { Button } from '@/components/ui/Button';
import { prefersReducedMotion } from '@/lib/motion';
import s from './Doc.module.css';

gsap.registerPlugin(ScrollTrigger);

const CHAPTERS = [
  'The idea',
  'Research',
  'Experience principles',
  'User flow',
  'Part taxonomy',
  'Configuration engine',
  '3D and 2D pipeline',
  'Regional engine',
  'Design system',
  'Motion system',
  'Access and performance',
  'Architecture',
  'Measures and roadmap',
];

const Tiles = ({ cols = 2, items }: { cols?: 2 | 3; items: [string, string][] }) => (
  <div className={cols === 3 ? s.g3 : s.g2}>
    {items.map(([h, p]) => (
      <div key={h} className={`${s.tile} rv`}>
        <h4>{h}</h4>
        <p>{p}</p>
      </div>
    ))}
  </div>
);

const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
  <div className={`${s.tblWrap} rv`} tabIndex={0} role="region" aria-label={`Table: ${head.join(', ')}`}>
    <table>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

function Chapter({
  n,
  title,
  lede,
  children,
}: {
  n: number;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className={s.sec} id={`c${n}`} data-chapter={n}>
      <header>
        <div className={s.n}>{String(n).padStart(2, '0')}</div>
        <div>
          <h2>{title}</h2>
          <p>{lede}</p>
        </div>
      </header>
      <div className={s.bd}>{children}</div>
    </section>
  );
}

const EASES: [string, string, number, string][] = [
  ['Arrive · expo out', 'expo.out', 0.8, '420–800 ms'],
  ['Camera move · power3 in-out', 'power3.inOut', 1.0, '900–1400 ms'],
  ['Selection pill · spring', 'elastic.out(1,0.7)', 0.9, '~600 ms'],
  ['Leave · power2 in', 'power2.in', 0.3, '240 ms'],
  ['Paint sweep · power2 in-out', 'power2.inOut', 1.6, '1600 ms'],
];

export function BlueprintDoc() {
  const go = useGo();
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(1);

  const playEase = (row: HTMLElement) => {
    const trk = row.querySelector<HTMLElement>('[data-trk]');
    const dot = trk?.firstElementChild;
    if (!trk || !dot) return;
    gsap.fromTo(
      dot,
      { x: 0 },
      {
        x: trk.clientWidth - 30,
        duration: prefersReducedMotion() ? 0.01 : Number(row.dataset.d),
        ease: row.dataset.ease,
      },
    );
  };

  useLayoutEffect(() => {
    const sc = root.current;
    if (!sc) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        scroller: sc,
        trigger: sc.firstElementChild!,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (st) => gsap.set('[data-progress]', { scaleX: st.progress }),
      });
      sc.querySelectorAll<HTMLElement>('[data-chapter]').forEach((sec) =>
        ScrollTrigger.create({
          scroller: sc,
          trigger: sec,
          start: 'top 45%',
          end: 'bottom 45%',
          onToggle: (st) => st.isActive && setActive(Number(sec.dataset.chapter)),
        }),
      );
      if (prefersReducedMotion()) return;
      gsap.set('.rv', { opacity: 0, y: 28 });
      ScrollTrigger.batch('.rv', {
        scroller: sc,
        start: 'top 90%',
        onEnter: (b) =>
          gsap.to(b, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: 'expo.out',
            stagger: { amount: Math.min(0.5, b.length * 0.08) },
            overwrite: true,
          }),
      });
      const edges = sc.querySelectorAll<SVGPathElement>('[data-edge]');
      edges.forEach((p) => {
        const L = p.getTotalLength();
        p.style.strokeDasharray = String(L);
        p.style.strokeDashoffset = String(L);
      });
      ScrollTrigger.create({
        scroller: sc,
        trigger: '[data-flow]',
        start: 'top 80%',
        once: true,
        onEnter: () => {
          gsap.to(edges, {
            strokeDashoffset: 0,
            duration: 0.8,
            stagger: 0.12,
            delay: 0.3,
            ease: 'power2.inOut',
          });
          gsap.from('[data-node]', {
            opacity: 0,
            scale: 0.9,
            transformOrigin: '50% 50%',
            duration: 0.6,
            stagger: 0.05,
            ease: 'back.out(2)',
          });
        },
      });
      ScrollTrigger.create({
        scroller: sc,
        trigger: '[data-eases]',
        start: 'top 85%',
        once: true,
        onEnter: () =>
          sc
            .querySelectorAll<HTMLElement>('[data-ease]')
            .forEach((r, i) => gsap.delayedCall(0.3 + i * 0.15, () => playEase(r))),
      });
    }, sc);
    return () => ctx.revert();
  }, []);

  const jump = (n: number) => {
    const sc = root.current;
    const t = sc?.querySelector<HTMLElement>(`#c${n}`);
    if (!sc || !t) return;
    sc.scrollTo({
      top: t.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 80,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  return (
    <section ref={root} id="doc-scroller" className={s.screen} aria-label="Design blueprint">
      <div className={s.doc}>
        <nav className={s.toc} aria-label="Blueprint chapters">
          <div className={s.pr}>
            <i data-progress />
          </div>
          {CHAPTERS.map((c, i) => (
            <a
              key={c}
              href={`#c${i + 1}`}
              className={active === i + 1 ? s.on : undefined}
              aria-current={active === i + 1 ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault();
                jump(i + 1);
              }}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              {c}
            </a>
          ))}
        </nav>
        <div className={s.main}>
          <div className={s.hero}>
            <h1 className="rv">The Halden Atelier blueprint</h1>
            <p className="rv">
              How a brand site becomes a coachbuilder&apos;s workshop: a part-by-part car configurator with
              live 3D, an exploded component view, a 2D tape-drawing view and region-aware rules. This is the
              research, the reasoning and the system behind the configurator you can open from the Build tab.
            </p>
            <div className={`${s.meta} rv`}>
              {[
                ['Product', 'Bespoke car configurator'],
                ['Model', 'Halden Vesper GT (fictional)'],
                ['Platforms', 'Web, desktop first, full mobile'],
                ['Status', 'Interactive build'],
              ].map(([b, v]) => (
                <div key={b}>
                  <b>{b}</b>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <Chapter
            n={1}
            title="The idea"
            lede="Most configurators let you pick a trim, a paint and some wheels. Halden lets you specify the car the way a coachbuilder would: every visible part, inside and out, one at a time."
          >
            <Tiles
              cols={3}
              items={[
                [
                  'The problem',
                  'Buyers of premium cars want ownership of the result, but brand configurators flatten choice into packages. Visualisation is slow or static, prices jump at the end, and local rules (tint law, drive side, wheel limits) are hidden until a dealer says no.',
                ],
                [
                  'The promise',
                  'Choose any part, see it on the car immediately, understand what it is, know what it costs in your currency, and trust that everything you can pick can be built and driven legally where you live.',
                ],
                [
                  'The job of the site',
                  'Turn curiosity into a confident, shareable specification that a client advisor can turn into an order with no surprises, while making the process itself feel like the first part of owning the car.',
                ],
              ]}
            />
          </Chapter>

          <Chapter
            n={2}
            title="Research"
            lede="Desk research and a heuristic review of current premium configurators, plus proto-personas built from the patterns that review surfaced. The study plan at the end is how these hypotheses get tested with real buyers before build."
          >
            <h3 className="rv">What current configurators do well, and where they stop</h3>
            <Table
              head={['Pattern observed', 'Why it works or fails', 'What Halden does']}
              rows={[
                [
                  'Step-by-step trim, paint, wheels, interior',
                  'Familiar and easy to follow, but depth ends at a handful of headline options',
                  'Keeps the familiar spine, goes ten steps deep with part-level choices in each',
                ],
                [
                  'Pre-rendered image sequences',
                  'Photoreal, but slow to update and limited to fixed angles',
                  'Real-time 3D for exploring, server renders only for the final reveal shots',
                ],
                [
                  'Price shown only on the summary page',
                  'Causes late surprises and abandonment at the final step',
                  'Live price on every option and on a running tape at the bottom',
                ],
                [
                  '"Not available" options greyed with no reason',
                  'Feels arbitrary; users assume a bug or an upsell trick',
                  'Every disabled option says why, in one sentence, when tapped',
                ],
                [
                  'Region chosen by a country dropdown in the footer',
                  'Easy to miss, so users configure in the wrong market',
                  'Region is the first decision, suggested from the device, changeable any time',
                ],
                [
                  'Interior shown as a single camera position',
                  'Hard to judge material and stitching combinations',
                  'Cabin view lifts the roof off so seats, trim and light are visible together',
                ],
              ]}
            />
            <h3 className="rv">Proto-personas</h3>
            <div className={s.g3}>
              {[
                [
                  'AR',
                  'Arjun, Pune',
                  'First performance car, researches for weeks',
                  'Compares builds on his phone at night, shares screenshots with family before deciding. Cares about road clearance, monsoon readiness and the real on-road price in rupees.',
                  'Show me the final price with duties, not a number I’ll never pay.',
                ],
                [
                  'LE',
                  'Lena, Munich',
                  'Enthusiast, second Halden',
                  'Knows exactly what she wants and wants every detail: caliper colour, stitch colour, aero. Uses a large screen, saves several builds and compares them.',
                  'Let me change one thing and see only that thing change.',
                ],
                [
                  'KH',
                  'Khalid, Dubai',
                  'Bespoke buyer, works with an advisor',
                  'Wants something nobody else has. Starts the build himself, then hands it to a client advisor. Values exclusivity, heat performance and a clear commission record.',
                  'If it’s exclusive to my region, tell me. That’s the point.',
                ],
              ].map(([av, n, sub, p, q]) => (
                <div key={n} className={`${s.tile} rv`}>
                  <div className={s.persona}>
                    <div className={s.av}>{av}</div>
                    <div>
                      <h4>{n}</h4>
                      <small>{sub}</small>
                    </div>
                  </div>
                  <p>{p}</p>
                  <div className={s.quote}>“{q}”</div>
                </div>
              ))}
            </div>
            <h3 className="rv">Insights that shaped the design</h3>
            <Tiles
              items={[
                [
                  'Change must be seen, not inferred',
                  'When a buyer changes paint and the whole car flickers to the new colour, they compare against memory. A visible sweep from old to new lets them compare side by side on the same panel.',
                ],
                [
                  'The camera should follow the decision',
                  'Picking calipers while looking at the roof is useless. Each step moves the camera to where that part lives, so the user never has to hunt for their change.',
                ],
                [
                  'Constraints build trust when explained',
                  'A rule with a reason reads as expertise. A rule without one reads as a bug. The region engine always carries a one-line reason.',
                ],
                [
                  'Depth needs a way back',
                  'Ten steps of choice create fear of losing a good combination. A visible change history with undo makes experimentation safe.',
                ],
                [
                  'Understanding precedes desire',
                  'Many buyers don’t know what a diffuser or a ducktail is. The exploded view names every part in place, which makes the vocabulary of the car learnable.',
                ],
                [
                  'The ending is a ceremony',
                  'The summary is the moment of commitment. Treat it as a reveal with a commission number, not a receipt.',
                ],
              ]}
            />
            <h3 className="rv">Validation study plan</h3>
            <div className={`${s.prose} rv`}>
              <p>
                Twelve moderated sessions across three markets (India, Germany, UAE), four per market, mixing
                first-time and repeat premium buyers. Tasks: build a car you&apos;d buy, change region
                mid-build, find out why an option is unavailable, share your build. Measure task success, time
                to first change, number of undos, comprehension of the exploded view labels, and price
                confidence on a 5-point scale. Follow with an unmoderated test of the mobile flow (n=40)
                focusing on bottom-sheet reach and 3D gesture conflicts.
              </p>
            </div>
          </Chapter>

          <Chapter
            n={3}
            title="Experience principles"
            lede="Five rules used to settle design arguments. When two ideas compete, the one that better serves these wins."
          >
            <Tiles
              items={[
                [
                  'The car is the interface',
                  'The 3D model takes most of the screen; panels float over it and never cover the part being changed. Hotspots on the car itself are a second way into every step.',
                ],
                [
                  'One change, one visible consequence',
                  'Each choice produces exactly one clear motion on the car: a paint sweep, a wheel spin, a light sequence, a roof lift. Nothing else on screen competes with it.',
                ],
                [
                  'Price is never a surprise',
                  'Every option shows its price in local currency. The running total rolls like an odometer so the change is noticed but not alarming.',
                ],
                [
                  'Rules speak in reasons',
                  'Unavailable is never silent. Tapping a locked option shakes it and states why in one sentence.',
                ],
                [
                  'Everything is reversible',
                  'Undo, a visible history tape, region switching with automatic, explained substitutions, and a copyable build code.',
                ],
              ]}
            />
          </Chapter>

          <Chapter
            n={4}
            title="User flow"
            lede="One primary path with a loop in the middle. Views can be switched at any point; the spine of steps can be walked in order or jumped."
          >
            <FlowDiagram />
            <h3 className="rv">Edge flows</h3>
            <Tiles
              items={[
                [
                  'Region change mid-build',
                  'Rules re-run against the current build. Anything no longer orderable is swapped for the closest valid choice, with a toast naming each swap. The steering wheel animates across if the drive side changes.',
                ],
                [
                  'Locked option tapped',
                  'The option shakes, the reason appears as a toast, and focus stays where it was. No modal, no dead end.',
                ],
                [
                  'Returning visitor',
                  'Builds autosave locally. A returning user lands on their last step with their build intact; a shared link opens the exact same build.',
                ],
                [
                  'Advisor handoff',
                  'The build code opens the same configuration in an advisor console with notes and region-specific lead times attached.',
                ],
              ]}
            />
          </Chapter>

          <Chapter
            n={5}
            title="Part taxonomy"
            lede="The information architecture follows the physical car. Each leaf is a node in the 3D model, an option set in the rules engine and a row in the summary. Open the groups to see the full tree."
          >
            <div className={s.g2}>
              <div className={`${s.tree} rv`}>
                <details open>
                  <summary>Exterior</summary>
                  <Tree
                    title="Paint system"
                    leaves={[
                      'Colour: 10 core, 2 regional exclusives per market, paint to sample',
                      'Finish: gloss, metallic, satin, matte, chroma flip',
                      'Livery: 6 core patterns plus regional patterns, pattern colour, scale',
                    ]}
                  />
                  <Tree
                    title="Wheels and brakes"
                    leaves={[
                      'Design: aero disc, five-spoke, turbine, mesh, ten-spoke',
                      'Size: 19 to 22 inch, region-limited',
                      'Finish and caliper colour',
                    ]}
                  />
                  <Tree
                    title="Bodywork"
                    leaves={[
                      'Roof: body, black, carbon, panoramic glass',
                      'Accent parts: mirrors, splitter, diffuser, skirts',
                      'Rear aero: none, ducktail, swan-neck wing',
                      'Grille: honeycomb, slats, sealed',
                    ]}
                  />
                  <Tree
                    title="Lighting"
                    leaves={[
                      'Light signature: blade, quad, arc',
                      'Lamp tint, region-limited',
                      'Welcome sequence',
                    ]}
                  />
                  <Tree title="Glass" leaves={['Side glass tint, bounded by legal light transmission']} />
                </details>
              </div>
              <div className={`${s.tree} rv`}>
                <details open>
                  <summary>Interior</summary>
                  <Tree
                    title="Seating"
                    leaves={[
                      'Material: nappa, alcantara, recycled knit, regional wool',
                      'Colour, quilting, stitch colour',
                    ]}
                  />
                  <Tree
                    title="Cabin trim"
                    leaves={[
                      'Forged carbon, walnut, brushed aluminium, piano black, regional woods and pearl',
                    ]}
                  />
                  <Tree title="Ambient light" leaves={['Any colour, brightness, static, breathe or flow']} />
                  <Tree title="Steering" leaves={['Position set by region drive side']} />
                </details>
                <details open>
                  <summary>Regional</summary>
                  <div className={s.lf}>
                    Market packs (two per region), currency and taxes, legal limits, exclusives, delivery hub
                    and lead time
                  </div>
                </details>
              </div>
            </div>
          </Chapter>

          <Chapter
            n={6}
            title="Configuration engine"
            lede="The UI never decides what is valid. A rules engine evaluates the build on every change and returns availability, price and reasons. The front end only renders that result, which keeps web, advisor console and dealer tools consistent."
          >
            <Tiles
              items={[
                [
                  'Option graph',
                  'Each option is a node with price, lead-time impact, region availability, and edges of three kinds: requires, excludes and includes. Packs are nodes that include others, so the Autobahn pack includes the swan wing at no extra cost.',
                ],
                [
                  'Evaluation',
                  'On change, the engine re-checks the build, resolves conflicts by the most recent choice winning, and returns a diff: what changed, what was swapped, and the reason string for each locked option.',
                ],
              ]}
            />
            <h3 className="rv">Rule shape</h3>
            <pre className={`${s.code} rv`} tabIndex={0} aria-label="Example rule">{`{
  "id": "wheel.size.22",
  "price": { "USD": 2900 },
  "availability": { "exclude": ["IN", "JP"] },
  "reason": {
    "IN": "Not offered here: 22-inch wheels reduce ground clearance below what regional roads need.",
    "JP": "Over-width rules for this model make 22-inch wheels unavailable here."
  },
  "leadTimeWeeks": 1
}`}</pre>
            <div className={`${s.prose} rv`} style={{ marginTop: 18 }}>
              <p>
                Legal values here are representative. Production uses a per-jurisdiction table maintained by
                homologation, since tint law in particular varies by state and by window.
              </p>
            </div>
          </Chapter>

          <Chapter
            n={7}
            title="3D and 2D pipeline"
            lede="How the car on screen is made, from engineering data to the browser, and how one source feeds the studio, exploded, blueprint and cabin views."
          >
            <Tiles
              cols={3}
              items={[
                [
                  'From CAD to glTF',
                  'Class-A surface data is tessellated and retopologised per part. Every customisable part becomes a named node (body, door_l, wheel_fl/caliper) so options map to nodes one-to-one. Exported as glTF with Draco or meshopt compression and KTX2 textures.',
                ],
                [
                  'Materials as variants',
                  'Paints, trims and leathers are physically based materials, so switching is a material change, not a model load. Car paint uses a clearcoat layer; chroma flip uses a view-angle colour shift.',
                ],
                [
                  'Liveries without textures',
                  'Patterns are generated in the shader from the part’s own coordinates, so they flow across panel gaps, scale without blurring, and cost no download.',
                ],
                [
                  'Exploded view',
                  'Each part carries an authored offset vector. One value from 0 to 1 drives all of them, which lets the same animation be scrubbed by scroll on the landing page and played by a button in the configurator.',
                ],
                [
                  'Blueprint view',
                  'The 2D drawing is generated from the same section curves as the 3D body, so it can never disagree with it. Fills update live with the build; strokes draw in like tape on a studio board.',
                ],
                [
                  'Cabin view',
                  'Rather than a camera trapped inside the seats, the roof and glass lift away and the camera looks down into the cabin, which shows seats, trim and light in one composition.',
                ],
              ]}
            />
            <h3 className="rv">Fidelity tiers</h3>
            <Table
              head={['Device', 'Rendering', 'Budget']}
              rows={[
                [
                  'Desktop with discrete GPU',
                  'Full 3D, soft shadows, HDR studio lighting, high-resolution reflections',
                  '~18 MB geometry and textures, 60 fps',
                ],
                [
                  'Recent phones and laptops',
                  '3D with reduced shadow map, capped pixel ratio, medium LOD',
                  '~8 MB, 60 fps target, 30 fps floor',
                ],
                [
                  'Low-end or no WebGL',
                  'Server-rendered image turntable (36 frames) per configuration, cached at the edge',
                  '~1.5 MB per view',
                ],
                [
                  'Reveal and sharing',
                  'Path-traced stills rendered server-side for the summary and social cards',
                  'Generated on demand, cached by build code',
                ],
              ]}
            />
          </Chapter>

          <Chapter
            n={8}
            title="Regional engine"
            lede="The region is chosen first, suggested from the device's time zone and always editable. It sets six things at once."
          >
            <Table
              head={[
                'Region',
                'Drive',
                'Currency',
                'Min. side glass light',
                'Exclusive paints',
                'Exclusive livery or trim',
                'Market packs',
              ]}
              rows={REGION_IDS.map((r) => {
                const R = REGIONS[r];
                const extras = [
                  ...R.liveries.map((l) => `${LIVERIES[l].n} livery`),
                  ...R.trims.map((t) => `${TRIMS[t].n} trim`),
                  ...R.seats.map((x) => `${SEAT_MATERIALS[x].n} seats`),
                  ...R.tints.map((x) => `${LAMP_TINTS[x].n} lamps`),
                ];
                return [
                  R.n,
                  R.drive,
                  R.cur,
                  `${R.vlt}%`,
                  <>
                    {R.paints.map((p) => (
                      <div key={p}>
                        <span className={s.swI} style={{ background: PAINTS[p].c }} />
                        {PAINTS[p].n}
                      </div>
                    ))}
                  </>,
                  extras.length ? (
                    extras.map((e) => <div key={e}>{e}</div>)
                  ) : (
                    <span className="muted">None</span>
                  ),
                  <>
                    {R.packs.map((k) => (
                      <div key={k}>{PACKS[k].n}</div>
                    ))}
                    {Object.keys(R.noSize).length > 0 && <div className="muted">No 22-inch wheels</div>}
                  </>,
                ];
              })}
            />
          </Chapter>

          <Chapter
            n={9}
            title="Design system"
            lede="The visual language comes from where cars are actually designed: primer-grey paint booths, clay models carved by hand and tape drawings on white boards. Two studio moods, day and night, share one set of tokens."
          >
            <h3 className="rv">Colour</h3>
            <div className={`${s.tok} rv`}>
              {[
                ['#D8DBDE', 'Primer', '#D8DBDE, day background'],
                ['#161A20', 'Paint booth', '#161A20, night background'],
                ['#9E7038', 'Clay', '#9E7038 day, #D3AB70 night; selection and progress'],
                ['#2C4BDB', 'Datum', '#2C4BDB; dimensions, focus, technical lines'],
                ['#14171C', 'Ink', '#14171C; text and primary actions'],
                ['#535A64', 'Graphite', '#535A64; secondary text'],
                ['#B4441C', 'Limit', '#B4441C; legal limits and locked reasons'],
                ['#2E7D5B', 'Valid', '#2E7D5B; confirmations'],
              ].map(([c, n, d]) => (
                <div key={n}>
                  <i style={{ background: c }} />
                  <p>
                    {n}
                    <small>{d}</small>
                  </p>
                </div>
              ))}
            </div>
            <div className={`${s.prose} rv`} style={{ marginTop: 16 }}>
              <p>
                The interface stays neutral so the car&apos;s paint is the only saturated colour on screen.
                Clay is used only for what the user has chosen and how far they&apos;ve come.
              </p>
            </div>
            <h3 className="rv">Type</h3>
            <div className="rv">
              <div className={s.typeRow}>
                <small>Display, Michroma</small>
                <div className="d" style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: '-.035em' }}>
                  Vesper GT
                </div>
              </div>
              <div className={s.typeRow}>
                <small>Heading, Michroma</small>
                <div className="d" style={{ fontSize: 22 }}>
                  Wheels and brakes
                </div>
              </div>
              <div className={s.typeRow}>
                <small>Body, Instrument Sans</small>
                <div style={{ fontSize: 16, lineHeight: 1.6, maxWidth: 520 }}>
                  Every option shows its price in your currency, and the total updates as you go.
                </div>
              </div>
              <div className={s.typeRow}>
                <small>Caption</small>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Included with the Autobahn pack</div>
              </div>
            </div>
            <h3 className="rv">Shape and space</h3>
            <div className={`${s.radius} rv`}>
              {[
                [4, '4 · tags'],
                [10, '10 · cards'],
                [22, '22 · panels'],
                [999, 'pill · controls'],
              ].map(([r, l]) => (
                <div key={l} style={{ borderRadius: r }}>
                  {l}
                </div>
              ))}
            </div>
            <h3 className="rv">Component inventory</h3>
            <div className={s.g3}>
              {[
                [
                  'Selection',
                  [
                    'Paint swatch with finish highlight and region dot',
                    'Pattern card with live preview',
                    'Segmented control with sliding pill',
                    'Colour ring for custom paint and light',
                  ],
                ],
                [
                  'Feedback',
                  [
                    'Odometer price',
                    'History tape with undo',
                    'Toast with reason',
                    'Legal limit marker on sliders',
                  ],
                ],
                [
                  'Navigation',
                  [
                    'Step spine with progress',
                    'View switcher',
                    'Hotspots on the car',
                    'Exploded view labels',
                  ],
                ],
              ].map(([h, items]) => (
                <div key={h as string} className={`${s.tile} rv`}>
                  <h4>{h}</h4>
                  <ul>
                    {(items as string[]).map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Chapter>

          <Chapter
            n={10}
            title="Motion system"
            lede="Motion exists to show what changed. Each user action gets one primary motion on the car and one quiet confirmation in the UI. Click a row to replay its curve."
          >
            <div className={`${s.eases} rv`} data-eases>
              {EASES.map(([label, ease, d, ms]) => (
                <button
                  key={label}
                  className={s.edRow}
                  data-ease={ease}
                  data-d={d}
                  onClick={(e) => playEase(e.currentTarget)}
                >
                  <span>{label}</span>
                  <span className={s.trk} data-trk>
                    <i />
                  </span>
                  <small>{ms}</small>
                </button>
              ))}
            </div>
            <h3 className="rv">Choreography rules</h3>
            <Tiles
              items={[
                [
                  'Leave faster than you arrive',
                  'Exits run at roughly 60% of entry duration so the next thing is never waiting on the last one.',
                ],
                [
                  'Stagger reads as order',
                  'Lists enter at 35 ms steps, top to bottom, matching reading order. More than twelve items share the last delay.',
                ],
                [
                  'The camera is a director',
                  'Each step has a camera mark. Moves ease in and out and are interrupted instantly by the user’s hand: dragging always wins.',
                ],
                [
                  'Shared elements, not cuts',
                  'Selection rings, view pills and the step marker move between options instead of reappearing, so the eye follows them.',
                ],
              ]}
            />
            <h3 className="rv">Implementation</h3>
            <div className={`${s.prose} rv`}>
              <p>
                UI motion uses Motion: <code>layoutId</code> for shared selection elements,{' '}
                <code>AnimatePresence</code> for panel content and toasts, and springs (stiffness 260, damping
                30) for pills and toggles. GSAP with ScrollTrigger drives the scroll story and the 3D camera
                and part timelines, which need precise scrubbing and sequencing.
              </p>
            </div>
          </Chapter>

          <Chapter
            n={11}
            title="Access and performance"
            lede="A luxury experience that excludes people or stalls on a phone isn't luxury."
          >
            <div className={s.g2}>
              <div className={`${s.tile} rv`}>
                <h4>Accessible by default</h4>
                <ul>
                  <li>Every option is a real button with name, price and state announced</li>
                  <li>Price changes are announced through a polite live region</li>
                  <li>Colour is never the only signal: every swatch has a name</li>
                  <li>Visible focus in the datum colour; full keyboard path through the steps</li>
                  <li>
                    Reduced motion: sweeps become instant, camera cuts instead of flying, card reveals are
                    static
                  </li>
                </ul>
              </div>
              <div className={`${s.tile} rv`}>
                <h4>Fast by budget</h4>
                <ul>
                  <li>First meaningful paint under 1.5 s with the 3D loading behind the intro</li>
                  <li>Interaction to next paint under 100 ms for any option</li>
                  <li>Pixel ratio capped at 2 and lowered automatically if frame time rises</li>
                  <li>Rendering pauses when the 3D view is hidden, as on this page</li>
                </ul>
              </div>
            </div>
          </Chapter>

          <Chapter n={12} title="Architecture" lede="The stack for the production build.">
            <Table
              head={['Layer', 'Choice', 'Role']}
              rows={[
                [
                  'App',
                  'Next.js (App Router), TypeScript',
                  'Routes per screen and per step for deep links; build state in the URL',
                ],
                ['3D', 'React Three Fiber, three.js', 'Scene, studio lighting, materials, camera rig'],
                [
                  'Motion',
                  'Motion, GSAP and ScrollTrigger',
                  'UI transitions and shared layout; scroll story and 3D timelines',
                ],
                ['State', 'Zustand store', 'Build state with grouped undo history, step and view'],
                [
                  'Rules',
                  'Pure TypeScript engine over a JSON option table',
                  'Availability, price, reasons, swaps; unit tested',
                ],
                [
                  'Assets',
                  'CDN with glTF, KTX2 and HDR environments',
                  'Per-step streaming, cache by model year',
                ],
              ]}
            />
          </Chapter>

          <Chapter
            n={13}
            title="Measures and roadmap"
            lede="What success looks like, and the order to build in."
          >
            <div className={`${s.kpi} rv`}>
              {[
                ['55%', 'of starters reach the reveal'],
                ['<20 s', 'to first change'],
                ['30%', 'of reveals shared or saved'],
                ['3×', 'advisor bookings vs. current site'],
              ].map(([b, l]) => (
                <div key={l}>
                  <b>{b}</b>
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <div className={`${s.prose} rv`} style={{ margin: '14px 0 30px' }}>
              <p>
                Targets are starting hypotheses to be calibrated against the current site&apos;s analytics in
                the first month.
              </p>
            </div>
            <div className={`${s.phase} rv`}>
              {[
                [
                  'Phase 1 · Core',
                  'Region, exterior steps, studio and exploded views, live price, share code.',
                ],
                ['Phase 2 · Cabin', 'Interior steps, cabin view, blueprint view, saved builds and compare.'],
                ['Phase 3 · Advisor', 'Advisor console, commission records, reservations with deposit.'],
                [
                  'Phase 4 · Beyond',
                  'AR placement in your driveway, shared live builds with family, pixel-streamed photoreal mode.',
                ],
              ].map(([b, p]) => (
                <div key={b}>
                  <b>{b}</b>
                  <p>{p}</p>
                </div>
              ))}
            </div>
            <div className={s.end}>
              <h3>See it working</h3>
              <Button magnetic arrow onClick={() => go('region')}>
                Start your build
              </Button>
              <Button magnetic variant="ghost" onClick={() => go('landing')}>
                Back to the atelier
              </Button>
            </div>
          </Chapter>
        </div>
      </div>
    </section>
  );
}

function Tree({ title, leaves }: { title: string; leaves: string[] }) {
  return (
    <details>
      <summary>{title}</summary>
      {leaves.map((l) => (
        <div key={l} className={s.lf}>
          {l}
        </div>
      ))}
    </details>
  );
}

function FlowDiagram() {
  const node = (x: number, y: number, w: number, h: number, t: string, sub?: string, hi?: boolean) => (
    <g key={t} className={`${s.nd} ${hi ? s.hi : ''}`} data-node>
      <rect x={x} y={y} width={w} height={h} rx={12} />
      <text x={x + 16} y={sub ? y + 28 : y + h / 2 + 5}>
        {t}
      </text>
      {sub && (
        <text className={s.sub} x={x + 16} y={y + 48}>
          {sub}
        </text>
      )}
    </g>
  );
  const edges: [string, boolean][] = [
    ['M170 62 H200', false],
    ['M350 62 H400', false],
    ['M600 62 H660', false],
    ['M810 62 H840', false],
    ['M500 94 V 186', true],
    ['M420 330 H452', false],
    ['M622 330 H660', false],
    ['M735 362 C 735 430, 335 430, 335 368', true],
    ['M500 250 V 296', true],
    ['M275 30 C 275 -10, 540 -10, 540 28', true],
  ];
  return (
    <svg
      className={`${s.flow} rv`}
      viewBox="0 -20 1000 490"
      role="img"
      aria-label="User flow diagram"
      data-flow
    >
      <defs>
        <marker
          id="ah"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" fill="var(--ink-3)" />
        </marker>
      </defs>
      {edges.map(([d, alt]) => (
        <path
          key={d}
          d={d}
          className={`${s.ed} ${alt ? s.alt : ''}`}
          markerEnd="url(#ah)"
          data-edge={alt ? undefined : true}
        />
      ))}
      <text className={s.lb} x={514} y={146}>
        switch any time
      </text>
      <text className={s.lb} x={460} y={452}>
        jump to any step, or follow the spine
      </text>
      <text className={s.lb} x={330} y={-2}>
        change region mid-build
      </text>
      {node(20, 30, 150, 64, 'Land', 'scroll story, 3D intro')}
      {node(200, 30, 150, 64, 'Choose region', 'suggested from device')}
      {node(400, 30, 200, 64, 'Configure', 'ten steps, live price, undo', true)}
      {node(660, 30, 150, 64, 'Reveal', 'commission number')}
      {node(840, 30, 150, 64, 'Next steps', 'share, advisor, reserve')}
      {node(250, 190, 115, 56, 'Studio')}
      {node(380, 190, 115, 56, 'Exploded')}
      {node(510, 190, 115, 56, 'Blueprint')}
      {node(640, 190, 115, 56, 'Cabin')}
      {node(250, 298, 170, 64, 'Exterior', 'paint to glass, 6 steps')}
      {node(452, 298, 170, 64, 'Interior', 'seats, trim, light')}
      {node(660, 298, 150, 64, 'Regional pack', 'local exclusives')}
    </svg>
  );
}
