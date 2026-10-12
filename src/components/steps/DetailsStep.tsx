'use client';

import { useRef } from 'react';
import {
  COMFORTS,
  DASH_TONES,
  HEADLINERS,
  SEAT_COLOURS,
  STEERINGS,
  keysOf,
  type ComfortId,
  type SteeringId,
} from '@/data/options';
import { priceTag } from '@/engine';
import { Block, Cards, Segmented, Swatches, Toggle, controlStyles as s } from '@/components/config/controls';
import { useEvaluation } from '@/components/config/useEngine';
import { shake } from '@/lib/feedback';
import { useBuild } from '@/store/build';
import { toast } from '@/store/toasts';

function WheelStyleIcon({ style }: { style: SteeringId }) {
  const ring =
    style === 'round' ? (
      <circle cx={60} cy={50} r={34} />
    ) : style === 'flat' ? (
      <path d="M45 81 A34 34 0 1 1 75 81 Z" />
    ) : (
      <path d="M30 28 Q24 50 34 74 H86 Q96 50 90 28" />
    );
  return (
    <svg viewBox="0 0 120 100" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round">
        {ring}
        <path d={style === 'yoke' ? 'M30 50 H90' : 'M26 50 H94 M60 50 V84'} strokeWidth={6} opacity={0.7} />
      </g>
      <circle cx={60} cy={50} r={11} fill="currentColor" />
    </svg>
  );
}

function HeadlinerIcon({ colour, stars }: { colour: string; stars: boolean }) {
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true">
      <rect x={6} y={6} width={108} height={68} rx={12} fill={colour} />
      {stars &&
        Array.from({ length: 34 }, (_, i) => (
          <circle
            key={i}
            cx={14 + ((i * 37) % 92)}
            cy={14 + ((i * 23) % 52)}
            r={i % 5 === 0 ? 1.8 : 1}
            fill="#eaf1ff"
          />
        ))}
    </svg>
  );
}

function ComfortRow({ id }: { id: ComfortId }) {
  const b = useBuild((st) => st.build);
  const ev = useEvaluation();
  const row = useRef<HTMLDivElement>(null);
  const c = COMFORTS[id];
  const on = b.comfort.includes(id);
  const why = ev.available.comfort?.[id]?.reason;
  return (
    <div className={s.row} ref={row} data-on={on} aria-disabled={why ? true : undefined}>
      <div className={s.tx}>
        <b>{c.n}</b>
        <small>{why ?? c.d}</small>
      </div>
      <span className={s.pr}>{priceTag(c.p, b.region)}</span>
      <Toggle
        on={on}
        label={`${c.n}, ${priceTag(c.p, b.region)}${why ? `. ${why}` : ''}`}
        onToggle={() => {
          if (why && !on) {
            shake(row.current);
            toast(why, 'warn');
            return;
          }
          useBuild.getState().toggleComfort(id);
        }}
      />
    </div>
  );
}

export function DetailsStep() {
  const region = useBuild((st) => st.build.region);
  const ev = useEvaluation();
  return (
    <>
      <Block title="Steering wheel" em="steer">
        <Cards
          k="steer"
          items={keysOf(STEERINGS).map((k) => ({
            v: k,
            n: STEERINGS[k].n,
            sub: priceTag(STEERINGS[k].p, region),
            icon: <WheelStyleIcon style={k} />,
          }))}
        />
      </Block>
      <Block title="Dashboard" em="dashTone">
        <Segmented k="dashTone" options={keysOf(DASH_TONES).map((k) => ({ v: k, label: DASH_TONES[k].n }))} />
      </Block>
      <Block title="Headliner" em="headliner">
        <Cards
          k="headliner"
          items={keysOf(HEADLINERS).map((k) => ({
            v: k,
            n: HEADLINERS[k].n,
            sub: priceTag(HEADLINERS[k].p, region),
            why: ev.available.headliner?.[k]?.reason,
            icon: <HeadlinerIcon colour={HEADLINERS[k].c} stars={k === 'starlight'} />,
          }))}
        />
      </Block>
      <Block title="Floor mats" em="carpet">
        <Swatches
          k="carpet"
          items={keysOf(SEAT_COLOURS).map((k) => ({ v: k, n: SEAT_COLOURS[k].n, c: SEAT_COLOURS[k].c }))}
        />
      </Block>
      <Block title="Comfort" em="comfort">
        {keysOf(COMFORTS).map((id) => (
          <ComfortRow key={id} id={id} />
        ))}
      </Block>
    </>
  );
}
