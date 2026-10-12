'use client';

/**
 * Blueprint view: a tape drawing of the build (side elevation + plan) generated from the same
 * section curves as the 3D body, with live fills, the livery overlay and dimensions in mm.
 */
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
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
import { bodyGeometry } from '@/three/car/bodies';
import styles from './BlueprintView.module.css';

const S = 100;
const X = (x: number) => (x + 2.78) * S;
const Y = (y: number) => (1.92 - y) * S;
const TY = (z: number) => 372 + z * S;
const path = (pts: { x: number; y: number }[]) =>
  'M' + pts.map((p) => `${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' L') + ' Z';
const planPath = (pts: { x: number; z: number }[]) =>
  'M' + pts.map((p) => `${X(p.x).toFixed(1)} ${TY(p.z).toFixed(1)}`).join(' L') + ' Z';
const mm = (m: number) => Math.round(m * 1000).toLocaleString('en-GB');

const DARK = '#121316';

export function BlueprintView() {
  const b = useBuild((s) => s.build);
  const view = useBuild((s) => s.view);
  const screen = useUi((s) => s.screen);
  const visible = screen === 'config' && view === 'blueprint';
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const geo = bodyGeometry(b.body);
  const sp = geo.spec;
  const curves = useMemo(() => {
    const g = bodyGeometry(b.body);
    return {
      body: path(g.sideOutline()),
      doors: g.spec.doors.map(([x0, x1]) => path(g.doorSideOutline(x0, x1))),
      cab: path(g.cabinOutline()),
      roof: path(g.roofOutline()),
      plan: planPath(g.planOutline()),
    };
  }, [b.body]);

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
  }, [visible, b.body]);

  useEffect(() => {
    if (root.current) root.current.style.visibility = 'hidden';
  }, []);

  const paint = paintHex(b);
  const accent = b.accent === 'body' ? paint : DARK;
  const roofC = b.roof === 'body' ? paint : b.roof === 'carbon' ? '#2a2e34' : DARK;
  const R = RIM_RADIUS[`${b.size}`] * (sp.tyreR / 0.37);
  const T = sp.tyreR;
  const glassOpacity = 0.55 + (1 - b.vlt / 100) * 0.4;

  const door0 = sp.doors[0]!;
  const dmx = (door0[0] + door0[1]) / 2;
  const mirX = sp.aBase - 0.06;
  const roofAero = sp.cBase < sp.rear + 0.3;
  const aeroX = roofAero ? sp.roofRear - 0.02 : sp.rear + 0.26;
  const aeroY = roofAero ? geo.roofLine(aeroX) + 0.01 : geo.topY(aeroX);
  const roofX0 = sp.roofRear - (sp.roofRear - sp.cBase) * 0.28;
  const roofX1 = sp.roofFront + (sp.aBase - sp.roofFront) * 0.18;
  const glassHalf = geo.glassPoint((sp.roofFront + sp.roofRear) / 2, 0).z;
  const callouts: [string, string, number, number][] = [
    ['Body', `${optionLabel('body', b).name}`, X(dmx + 0.35), Y(geo.belt(dmx) - 0.18)],
    [
      'Paint',
      `${optionLabel('paint', b).name}, ${FINISHES[b.finish].n.toLowerCase()}`,
      X(dmx),
      Y(geo.belt(dmx) - 0.1),
    ],
    ['Livery', LIVERIES[b.livery].n, X(sp.rearAxle - 0.5), Y(geo.belt(sp.rearAxle - 0.5) - 0.2)],
    ['Wheels', `${WHEELS[b.wheel].n}, ${b.size}"`, X(sp.frontAxle), Y(T)],
    [
      'Lights',
      `${LIGHT_SIGNATURES[b.sig].n}, ${LAMP_TINTS[b.ltint].n.toLowerCase()}`,
      X(sp.front - 0.03),
      Y(geo.headY),
    ],
    ['Roof', ROOFS[b.roof].n, X((sp.roofFront + sp.roofRear) / 2), Y(sp.roofY)],
    ['Rear aero', SPOILERS[b.spoiler].n, X(aeroX), Y(aeroY + 0.03)],
    [
      'Side glass',
      `${b.vlt}% light`,
      X((sp.roofRear + sp.cBase) / 2),
      Y(geo.roofLine((sp.roofRear + sp.cBase) / 2) - 0.15),
    ],
  ];

  const spokes = (cx: number, cy: number) => {
    const out: React.ReactNode[] = [];
    const spk = (a: number, w: number, k: string) => (
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
          spk((i / 5) * Math.PI * 2 - 0.12, 2.4, `a${i}`),
          spk((i / 5) * Math.PI * 2 + 0.12, 2.4, `b${i}`),
        );
      }
    else if (b.wheel === 'ten')
      for (let i = 0; i < 10; i++) out.push(spk((i / 10) * Math.PI * 2, 1.6, `${i}`));
    else if (b.wheel === 'turbine')
      for (let i = 0; i < 14; i++) out.push(spk((i / 14) * Math.PI * 2, 1.3, `${i}`));
    else if (b.wheel === 'mesh')
      for (let i = 0; i < 16; i++) out.push(spk((i / 16) * Math.PI * 2, 1, `${i}`));
    else
      out.push(
        <circle key="d" cx={cx} cy={cy} r={R * S * 0.7} fill="none" stroke="#17181b" strokeWidth={1.2} />,
      );
    return out;
  };

  const ln = styles.ln!;
  const fill = styles.fill!;
  const dimX = X(sp.rear) - 30;
  const planDimX = X(sp.front) + 22;

  return (
    <div ref={root} className={styles.bp} aria-hidden={!visible} style={{ opacity: 0 }}>
      <svg ref={svg} viewBox="-40 -30 1060 540" role="img" aria-label="Blueprint of your build">
        <defs>
          <clipPath id="bpClipS">
            <path d={curves.body} />
          </clipPath>
          <clipPath id="bpClipT">
            <path d={curves.plan} />
          </clipPath>
        </defs>
        <text x={X(-2.7)} y={-14}>
          Side elevation
        </text>
        <path d={`M${X(sp.rear) - 40} ${Y(0)} H${X(sp.front) + 30}`} className={`${ln} ${styles.dash}`} />
        <path d={curves.body} className={`${ln} ${fill}`} fill={paint} />
        {side && <image href={side} x={0} y={Y(1.7)} width={556} height={170} clipPath="url(#bpClipS)" />}
        {curves.doors.map((d, i) => (
          <path key={i} d={d} className={`${ln} ${styles.thin}`} />
        ))}
        <path
          d={curves.cab}
          className={`${ln} ${fill}`}
          fill="#0b0e12"
          fillOpacity={glassOpacity}
          data-fo={glassOpacity}
        />
        {b.roof !== 'glass' && <path d={curves.roof} className={`${ln} ${fill}`} fill={roofC} />}
        <rect
          x={X(mirX) - 4}
          y={Y(geo.belt(mirX) + 0.13)}
          width={20}
          height={11}
          rx={3}
          className={`${ln} ${fill}`}
          fill={accent}
        />
        {b.spoiler === 'duck' && (
          <path
            d={`M${X(aeroX + 0.13)} ${Y(aeroY)} L${X(aeroX - 0.2)} ${Y(aeroY + 0.08)} L${X(aeroX - 0.18)} ${Y(aeroY - 0.01)} Z`}
            className={`${ln} ${fill}`}
            fill={accent}
          />
        )}
        {b.spoiler === 'wing' && (
          <>
            <path
              d={`M${X(aeroX + 0.1)} ${Y(aeroY)} L${X(aeroX + 0.04)} ${Y(aeroY + 0.24)}`}
              className={ln}
            />
            <rect
              x={X(aeroX - 0.19)}
              y={Y(aeroY + 0.29)}
              width={38}
              height={5}
              rx={2}
              className={`${ln} ${fill}`}
              fill={accent}
            />
          </>
        )}
        <rect
          x={X(sp.front) - 9}
          y={Y(geo.headY) - 3}
          width={7}
          height={6}
          rx={1}
          className={fill}
          fill={LAMP_TINTS[b.ltint].c}
        />
        <rect
          x={X(sp.rear) + 1}
          y={Y(sp.tailY) - 3}
          width={6}
          height={5}
          rx={1}
          className={fill}
          fill="#e0202c"
        />
        {[sp.frontAxle, sp.rearAxle].map((wx) => {
          const cx = X(wx);
          const cy = Y(T);
          return (
            <g key={wx}>
              <circle cx={cx} cy={cy} r={T * S} className={`${ln} ${fill}`} fill="#17181b" />
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
        <DimH x1={X(sp.rear)} x2={X(sp.front)} y={Y(0) + 24} t={mm(geo.length)} />
        <DimH
          x1={X(sp.rearAxle)}
          x2={X(sp.frontAxle)}
          y={Y(0) + 48}
          t={`${mm(sp.frontAxle - sp.rearAxle)} wheelbase`}
        />
        <path
          d={`M${dimX} ${Y(0)} V${Y(sp.roofY)} M${dimX - 5} ${Y(0)} H${dimX + 5} M${dimX - 5} ${Y(sp.roofY)} H${dimX + 5}`}
          className={styles.dim}
        />
        <text
          x={dimX - 8}
          y={Y(sp.roofY / 2)}
          textAnchor="middle"
          className={styles.dt}
          transform={`rotate(-90 ${dimX - 8} ${Y(sp.roofY / 2)})`}
        >
          {mm(sp.roofY)}
        </text>

        <text x={X(-2.7)} y={TY(-sp.halfWidth) - 24}>
          Plan
        </text>
        <path d={curves.plan} className={`${ln} ${fill}`} fill={paint} />
        {top && <image href={top} x={0} y={TY(-1.05)} width={556} height={210} clipPath="url(#bpClipT)" />}
        {[1, -1].map((sd) => (
          <g key={sd}>
            <rect
              x={X(mirX) - 4}
              y={sd > 0 ? TY(geo.halfW(mirX)) - 2 : TY(-geo.halfW(mirX)) - 16}
              width={18}
              height={18}
              rx={4}
              className={`${ln} ${fill}`}
              fill={accent}
            />
            {[sp.frontAxle, sp.rearAxle].map((wx) => (
              <rect
                key={wx}
                x={X(wx - T)}
                y={sd > 0 ? TY(sp.track - 0.12) : TY(-sp.track - 0.13)}
                width={T * 2 * S}
                height={25}
                rx={6}
                className={`${ln} ${styles.dash}`}
              />
            ))}
          </g>
        ))}
        <rect
          x={X(sp.cBase)}
          y={TY(-glassHalf)}
          width={(sp.aBase - sp.cBase) * S}
          height={glassHalf * 2 * S}
          rx={22}
          className={`${ln} ${fill}`}
          fill="#0b0e12"
          fillOpacity={0.55}
          data-fo={0.55}
        />
        {b.roof !== 'glass' && (
          <rect
            x={X(roofX0)}
            y={TY(-glassHalf * 0.92)}
            width={(roofX1 - roofX0) * S}
            height={glassHalf * 1.84 * S}
            rx={10}
            className={`${ln} ${fill}`}
            fill={roofC}
          />
        )}
        {b.spoiler === 'wing' && (
          <rect
            x={X(aeroX - 0.19)}
            y={TY(-sp.halfWidth * 0.92)}
            width={36}
            height={sp.halfWidth * 1.84 * S}
            rx={4}
            className={`${ln} ${fill}`}
            fill={accent}
          />
        )}
        <path d={`M${X(sp.rear) - 25} ${TY(0)} H${X(sp.front) + 18}`} className={`${ln} ${styles.dash}`} />
        <path
          d={`M${planDimX} ${TY(-sp.halfWidth)} V${TY(sp.halfWidth)} M${planDimX - 5} ${TY(-sp.halfWidth)} H${planDimX + 5} M${planDimX - 5} ${TY(sp.halfWidth)} H${planDimX + 5}`}
          className={styles.dim}
        />
        <text
          x={planDimX + 16}
          y={TY(0)}
          textAnchor="middle"
          className={styles.dt}
          transform={`rotate(90 ${planDimX + 16} ${TY(0)})`}
        >
          {mm(sp.halfWidth * 2)}
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
        <text x={640} y={472}>
          All dimensions in millimetres.
        </text>
        <text x={640} y={490}>
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
