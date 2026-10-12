'use client';

import { TRIMS, keysOf } from '@/data/options';
import { priceTag } from '@/engine';
import { Block, Cards } from '@/components/config/controls';
import { useEvaluation } from '@/components/config/useEngine';
import { useBuild } from '@/store/build';

export function TrimStep() {
  const region = useBuild((st) => st.build.region);
  const ev = useEvaluation();
  const shown = keysOf(TRIMS).filter((k) => !TRIMS[k].rg || TRIMS[k].rg === region);
  return (
    <Block title="Material" em="trim">
      <Cards
        k="trim"
        items={shown.map((k) => ({
          v: k,
          n: TRIMS[k].n,
          sub: priceTag(TRIMS[k].p, region),
          rg: TRIMS[k].rg,
          why: ev.available.trim?.[k]?.reason,
          pattern: { id: TRIMS[k].id, a: TRIMS[k].a, b: TRIMS[k].b, mode: 'trim' },
        }))}
      />
    </Block>
  );
}
