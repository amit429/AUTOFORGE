'use client';

import { FINISHES, PAINTS, REGIONS, keysOf } from '@/data/options';
import { MOODS } from '@/data/presentation';
import { priceTag } from '@/engine';
import { emit } from '@/lib/bus';
import { Block, Segmented, Swatches, controlStyles as s } from '@/components/config/controls';
import { ColourRing } from '@/components/config/ColourRing';
import { useEvaluation } from '@/components/config/useEngine';
import { useBuild } from '@/store/build';

export function PaintStep() {
  const region = useBuild((st) => st.build.region);
  const ev = useEvaluation();
  const R = REGIONS[region];
  const swatch = (k: keyof typeof PAINTS) => ({
    v: k,
    n: PAINTS[k].n,
    c: PAINTS[k].c,
    usdTag: priceTag(PAINTS[k].p, region),
    rg: !!PAINTS[k].rg,
    why: ev.available.paint?.[k]?.reason,
  });
  return (
    <>
      <Block title="Finish" em="finish">
        <Segmented k="finish" options={keysOf(FINISHES).map((k) => ({ v: k, label: FINISHES[k].n }))} />
      </Block>
      <Block title="Paint" em="paint">
        <Swatches
          k="paint"
          items={keysOf(PAINTS)
            .filter((k) => !PAINTS[k].rg)
            .map(swatch)}
        />
      </Block>
      <Block title={`Only in ${R.n}`}>
        <Swatches k="paint" label={`Paints only in ${R.n}`} items={R.paints.map(swatch)} />
      </Block>
      <Block title="Paint to sample">
        <ColourRing kind="custom" />
      </Block>
      <Block title="Start from a mood">
        <div className={s.moods}>
          {MOODS.map((m) => (
            <button
              key={m.n}
              className={s.mood}
              onClick={() => {
                useBuild.getState().snapshot(m.patch, `Mood: ${m.n}`);
                emit('spin', 1);
              }}
            >
              <span className={s.sw3}>
                {m.swatches.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <span>
                <b>{m.n}</b>
                <small>{m.d}</small>
              </span>
            </button>
          ))}
        </div>
      </Block>
    </>
  );
}
