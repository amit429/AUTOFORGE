'use client';

import { BODY_TYPES, keysOf } from '@/data/options';
import { money, paintHex } from '@/engine';
import { Block, Cards, Note } from '@/components/config/controls';
import { useBuild } from '@/store/build';
import { BodySilhouette } from './BodySilhouette';

export function ShapeStep() {
  const body = useBuild((st) => st.build.body);
  const region = useBuild((st) => st.build.region);
  const paint = useBuild((st) => paintHex(st.build));
  return (
    <>
      <Block title="Body style" em="body">
        <Cards
          k="body"
          items={keysOf(BODY_TYPES).map((k) => ({
            v: k,
            n: BODY_TYPES[k].n,
            sub: `From ${money(BODY_TYPES[k].p, region)}`,
            icon: <BodySilhouette body={k} paint={paint} />,
          }))}
        />
      </Block>
      <Note>{BODY_TYPES[body].d}</Note>
    </>
  );
}
