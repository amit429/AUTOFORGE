'use client';

/**
 * Blueprint view: a tape drawing of the build (side elevation + plan) generated from the same
 * section curves as the 3D body, with live fills, the livery overlay and dimensions in mm.
 */
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  ACCENTS,
  CALIPERS,
  FINISHES,
  LAMP_TINTS,
  LIGHT_SIGNATURES,
  LIVERIES,
  LIVERY_COLOURS,
  RIM_RADIUS,
  ROOFS,
  SPOILERS,
  WHEEL_FINISHES,
  WHEELS,
} from '@/data/options';
import { optionLabel, paintHex } from '@/engine/labels';
import { dur, prefersReducedMotion } from '@/lib/motion';
import { liveryOverlay } from '@/lib/patterns';
import { useBuild } from '@/store/build';
import { useUi } from '@/store/ui';
import { bodyShape, cabinShape, doorShape, roofLine, roofShape } from '@/three/car/shapes';
import styles from './BlueprintView.module.css';

const S = 100;
const X = (x: number) => (x + 2.78) * S;
const Y = (y: number) => (1.7 - y) * S;
const TY = (z: number) => 345 + z * S;
const path = (pts: { x: number; y: number }[]) =>
  'M' + pts.map((p) => `${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' L') + ' Z';

const DARK = '#121316';

export function BlueprintView() {
  const b = useBuild((s) => s.build);
  const view = useBuild((s) => s.view);
  const screen = useUi((s) => s.screen);
  const visible = screen === 'config' && view === 'blueprint';
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const curves = useMemo(
    () => ({
      body: path(bodyShape().getPoints(20)),
      door: path(doorShape().getPoints(4)),
      cab: path(cabinShape().getPoints(20)),
      roof: path(roofShape().getPoints(6)),
      roofXs: roofLine().map((p) => p.x),
    }),
    [],
  );

  const livery = LIVERIES[b.livery];
  const side = useMemo(
    () => (visible ? liveryOverlay(livery.id, LIVERY_COLOURS[b.livCol].c, b.livScale, false) : null),
    [visible, livery.id, b.livCol, b.livScale],
  );
  const top = useMemo(
    () => (visible ? liveryOverlay(livery.id, LIVERY_COLOURS[b.livCol].c, b.livScale, true) : null),
    [visible, livery.id, b.livCol, b.livScale],
  );

  // Fade in/out and draw the strokes in like tape when the view opens.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.killTweensOf(el);
    if (!visible) {
      gsap.to(el, {
        opacity: 0,
        duration: dur(0.35),
        onComplete: () => void (el.style.visibility = 'hidden'),
      });
      return;
    }
    el.style.visibility = 'visible';
    gsap.to(el, { opacity: 1, duration: dur(0.5) });
    const s = svg.current;
    if (!s || prefersReducedMotion()) return;
    const strokes = [...s.querySelectorAll<SVGGeometryElement>(`.${styles.ln}, .${styles.dim}`)];
    strokes.forEach((p) => {
      let L = 600;
      try {
        L = p.getTotalLength();
      } catch {
        // Some elements (e.g. inside clip paths) can't report a length; use a safe default.
      }
      p.style.strokeDasharray = String(L);
      p.style.strokeDashoffset = String(L);
    });
    gsap.to(strokes, {
      strokeDashoffset: 0,
      duration: 1.3,
      ease: 'power2.inOut',
      stagger: 0.012,
      onComplete: () =>
        strokes.forEach((p) => (p.style.strokeDasharray = p.classList.contains(styles.dash!) ? '5 5' : '')),
    });
    const fills = [...s.querySelectorAll<SVGElement>(`.${styles.fill}`)];
    gsap.fromTo(
      fills,
      { attr: { 'fill-opacity': 0 } },
      {
        attr: { 'fill-opacity': (_: number, el: SVGElement) => Number(el.dataset.fo ?? 1) },
        duration: 0.8,
        delay: 0.7,
        stagger: 0.02,
      },
    );
    gsap.from(s.querySelectorAll('text, image'), {
      opacity: 0,
      y: 6,
      duration: 0.6,
      delay: 0.5,
      stagger: 0.015,
    });
  }, [visible]);

  useEffect(() => {
    if (root.current) root.current.style.visibility = 'hidden';
  }, []);

  const paint = paintHex(b);
  const accent = b.accent === 'body' ? paint : DARK;
  const roofC = b.roof === 'body' ? paint : b.roof === 'carbon' ? '#2a2e34' : DARK;
  const R = RIM_RADIUS[`${b.size}`];
  const glassOpacity = 0.55 + (1 - b.vlt / 100) * 0.4;

  const callouts: [string, string, number, number][] = [
    ['Paint', `${optionLabel('paint', b).name}, ${FINISHES[b.finish].n.toLowerCase()}`, X(-0.75), Y(0.76)],
    ['Livery', LIVERIES[b.livery].n, X(-1.7), Y(0.55)],
    ['Wheels', `${WHEELS[b.wheel].n}, ${b.size}"`, X(1.41), Y(0.37)],
    ['Lights', `${LIGHT_SIGNATURES[b.sig].n}, ${LAMP_TINTS[b.ltint].n.toLowerCase()}`, X(2.38), Y(0.68)],
    ['Roof', ROOFS[b.roof].n, X(-0.6), Y(1.36)],
    ['Rear aero', SPOILERS[b.spoiler].n, X(-2.1), Y(1.02)],
    ['Side glass', `${b.vlt}% light`, X(-1.2), Y(1.08)],
    ['Accents', ACCENTS[b.accent].n, X(0.5), TY(1.08)],
  ];

  const spokes = (cx: number, cy: number) => {
    const out: React.ReactNode[] = [];
    const sp = (a: number, w: number, k: string) => (
      <path
        key={k}
        d={`M${cx + Math.cos(a) * 7} ${cy + Math.sin(a) * 7} L${cx + Math.cos(a) * R * S * 0.94} ${cy + Math.sin(a) * R * S * 0.94}`}
        stroke="#17181b"
        strokeWidth={w}
        fill="none"
      />
    );
    if (b.wheel === 'five')
      for (let i = 0; i < 5; i++) {
        out.push(
          sp((i / 5) * Math.PI * 2 - 0.12, 2.4, `a${i}`),
          sp((i / 5) * Math.PI * 2 + 0.12, 2.4, `b${i}`),
        );
      }
    else if (b.wheel === 'ten')
      for (let i = 0; i < 10; i++) out.push(sp((i / 10) * Math.PI * 2, 1.6, `${i}`));
    else if (b.wheel === 'turbine')
      for (let i = 0; i < 14; i++) out.push(sp((i / 14) * Math.PI * 2, 1.3, `${i}`));
    else if (b.wheel === 'mesh') for (let i = 0; i < 16; i++) out.push(sp((i / 16) * Math.PI * 2, 1, `${i}`));
    else
      out.push(
        <circle key="d" cx={cx} cy={cy} r={R * S * 0.7} fill="none" stroke="#17181b" strokeWidth={1.2} />,
      );
    return out;
  };

  const planD = `M${X(-2.2)} ${TY(-0.99)} L${X(2.15)} ${TY(-0.99)} Q${X(2.42)} ${TY(-0.99)} ${X(2.42)} ${TY(-0.62)} L${X(2.42)} ${TY(0.62)} Q${X(2.42)} ${TY(0.99)} ${X(2.15)} ${TY(0.99)} L${X(-2.2)} ${TY(0.99)} Q${X(-2.36)} ${TY(0.99)} ${X(-2.36)} ${TY(0.7)} L${X(-2.36)} ${TY(-0.7)} Q${X(-2.36)} ${TY(-0.99)} ${X(-2.2)} ${TY(-0.99)} Z`;
  const rx0 = Math.min(...curves.roofXs);
  const rx1 = Math.max(...curves.roofXs);
  const ln = styles.ln!;
  const fill = styles.fill!;

  return (
    <div ref={root} className={styles.bp} aria-hidden={!visible} style={{ opacity: 0 }}>
      <svg ref={svg} viewBox="-40 -40 1060 520" role="img" aria-label="Blueprint of your build">
        <defs>
          <clipPath id="bpClipS">
            <path d={curves.body} />
            <path d={curves.door} />
          </clipPath>
          <clipPath id="bpClipT">
            <path d={planD} />
          </clipPath>
        </defs>
        <text x={X(-2.7)} y={-14}>
          Side elevation
        </text>
        <path d={`M${X(-2.75)} ${Y(0)} H${X(2.78)}`} className={`${ln} ${styles.dash}`} />
        <path d={curves.body} className={`${ln} ${fill}`} fill={paint} />
        <path d={curves.door} className={`${ln} ${styles.thin} ${fill}`} fill={paint} />
        {side && <image href={side} x={0} y={0} width={556} height={170} clipPath="url(#bpClipS)" />}
        <path d={curves.door} className={`${ln} ${styles.thin}`} />
        <path
          d={curves.cab}
          className={`${ln} ${fill}`}
          fill="#0b0e12"
          fillOpacity={glassOpacity}
          data-fo={glassOpacity}
        />
        {b.roof !== 'glass' && <path d={curves.roof} className={`${ln} ${fill}`} fill={roofC} />}
        <rect
          x={X(0.42)}
          y={Y(1.12)}
          width={20}
          height={11}
          rx={3}
          className={`${ln} ${fill}`}
          fill={accent}
        />
        {b.spoiler === 'duck' && (
          <path
            d={`M${X(-1.95)} ${Y(1.0)} L${X(-2.3)} ${Y(1.07)} L${X(-2.28)} ${Y(0.98)} Z`}
            className={`${ln} ${fill}`}
            fill={accent}
          />
        )}
        {b.spoiler === 'wing' && (
          <>
            <path d={`M${X(-1.98)} ${Y(0.98)} L${X(-2.06)} ${Y(1.24)}`} className={ln} />
            <rect
              x={X(-2.29)}
              y={Y(1.29)}
              width={38}
              height={5}
              rx={2}
              className={`${ln} ${fill}`}
              fill={accent}
            />
          </>
        )}
        <rect
          x={X(2.36)}
          y={Y(0.7)}
          width={7}
          height={6}
          rx={1}
          className={fill}
          fill={LAMP_TINTS[b.ltint].c}
        />
        <rect x={X(-2.38)} y={Y(0.82)} width={6} height={5} rx={1} className={fill} fill="#e0202c" />
        {[1.41, -1.45].map((wx) => {
          const cx = X(wx);
          const cy = Y(0.37);
          return (
            <g key={wx}>
              <circle cx={cx} cy={cy} r={0.37 * S} className={`${ln} ${fill}`} fill="#17181b" />
              <circle cx={cx} cy={cy} r={R * S} className={`${ln} ${fill}`} fill={WHEEL_FINISHES[b.wfin].c} />
              {spokes(cx, cy)}
              <rect
                x={cx - R * S * 0.75}
                y={cy - R * S * 0.5}
                width={7}
                height={12}
                rx={2}
                fill={CALIPERS[b.caliper].c}
                className={fill}
              />
              <circle cx={cx} cy={cy} r={5} fill="#17181b" />
            </g>
          );
        })}
        <DimH x1={X(-2.36)} x2={X(2.42)} y={Y(0) + 26} t="4,780" />
        <DimH x1={X(-1.45)} x2={X(1.41)} y={Y(0) + 52} t="2,860 wheelbase" />
        <path
          d={`M${X(-2.66)} ${Y(0)} V${Y(1.39)} M${X(-2.66) - 5} ${Y(0)} H${X(-2.66) + 5} M${X(-2.66) - 5} ${Y(1.39)} H${X(-2.66) + 5}`}
          className={styles.dim}
        />
        <text
          x={X(-2.66) - 8}
          y={Y(0.7)}
          textAnchor="middle"
          className={styles.dt}
          transform={`rotate(-90 ${X(-2.66) - 8} ${Y(0.7)})`}
        >
          1,400
        </text>

        <text x={X(-2.7)} y={TY(-0.99) - 22}>
          Plan
        </text>
        <path d={planD} className={`${ln} ${fill}`} fill={paint} />
        {top && <image href={top} x={0} y={TY(-1.05)} width={556} height={210} clipPath="url(#bpClipT)" />}
        {[1, -1].map((sd) => (
          <g key={sd}>
            <rect
              x={X(0.42)}
              y={sd > 0 ? TY(0.99) : TY(-1.17)}
              width={18}
              height={18}
              rx={4}
              className={`${ln} ${fill}`}
              fill={accent}
            />
            {[1.41, -1.45].map((wx) => (
              <rect
                key={wx}
                x={X(wx - 0.37)}
                y={sd > 0 ? TY(0.72) : TY(-0.97)}
                width={74}
                height={25}
                rx={6}
                className={`${ln} ${styles.dash}`}
              />
            ))}
          </g>
        ))}
        <rect
          x={X(-1.84)}
          y={TY(-0.83)}
          width={2.4 * S}
          height={1.66 * S}
          rx={22}
          className={`${ln} ${fill}`}
          fill="#0b0e12"
          fillOpacity={0.55}
          data-fo={0.55}
        />
        {b.roof !== 'glass' && (
          <rect
            x={X(rx0)}
            y={TY(-0.78)}
            width={(rx1 - rx0) * S}
            height={1.56 * S}
            rx={10}
            className={`${ln} ${fill}`}
            fill={roofC}
          />
        )}
        {b.spoiler === 'wing' && (
          <rect
            x={X(-2.29)}
            y={TY(-0.92)}
            width={36}
            height={1.84 * S}
            rx={4}
            className={`${ln} ${fill}`}
            fill={accent}
          />
        )}
        <path d={`M${X(-2.6)} ${TY(0)} H${X(2.6)}`} className={`${ln} ${styles.dash}`} />
        <path
          d={`M${X(2.64)} ${TY(-0.99)} V${TY(0.99)} M${X(2.64) - 5} ${TY(-0.99)} H${X(2.64) + 5} M${X(2.64) - 5} ${TY(0.99)} H${X(2.64) + 5}`}
          className={styles.dim}
        />
        <text
          x={X(2.64) + 16}
          y={TY(0)}
          textAnchor="middle"
          className={styles.dt}
          transform={`rotate(90 ${X(2.64) + 16} ${TY(0)})`}
        >
          1,980
        </text>

        <text x={640} y={-14}>
          Specification
        </text>
        {callouts.map(([a, v, ax, ay], i) => {
          const y = 16 + i * 52;
          return (
            <g key={a}>
              <text x={640} y={y} className={styles.ct}>
                {v}
              </text>
              <text x={640} y={y + 16}>
                {a}
              </text>
              <path d={`M630 ${y - 4} L606 ${y - 4} L${ax} ${ay}`} className={styles.dim} opacity={0.55} />
              <circle cx={ax} cy={ay} r={2.6} fill="var(--datum)" />
            </g>
          );
        })}
        <text x={640} y={452}>
          All dimensions in millimetres.
        </text>
        <text x={640} y={470}>
          Drawn from the 3D model&apos;s own section curves.
        </text>
      </svg>
    </div>
  );
}

function DimH({ x1, x2, y, t }: { x1: number; x2: number; y: number; t: string }) {
  return (
    <>
      <path
        d={`M${x1} ${y} H${x2} M${x1} ${y - 5} V${y + 5} M${x2} ${y - 5} V${y + 5}`}
        className={styles.dim}
      />
      <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className={styles.dt}>
        {t}
      </text>
    </>
  );
}
