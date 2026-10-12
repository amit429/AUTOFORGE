'use client';

import { CALIPERS, WHEEL_FINISHES, WHEEL_SIZES, WHEELS, keysOf } from '@/data/options';
import { priceTag } from '@/engine';
import { Block, Cards, Segmented, Swatches } from '@/components/config/controls';
import { useEvaluation } from '@/components/config/useEngine';
import { useBuild } from '@/store/build';
import { WheelIcon } from './WheelIcon';

export function WheelsStep() {
  const region = useBuild((st) => st.build.region);
  const ev = useEvaluation();
  return (
    <>
      <Block title="Design" em="wheel">
        <Cards
          k="wheel"
          items={keysOf(WHEELS).map((k) => ({
            v: k,
            n: WHEELS[k].n,
            sub: priceTag(WHEELS[k].p, region),
            icon: <WheelIcon design={k} />,
          }))}
        />
      </Block>
      <Block title="Size" em="size">
        <Segmented
          k="size"
          options={WHEEL_SIZES.map((n) => ({ v: n, label: `${n}"`, why: ev.available.size?.[n]?.reason }))}
        />
      </Block>
      <Block title="Finish" em="wfin">
        <Swatches
          k="wfin"
          items={keysOf(WHEEL_FINISHES).map((k) => ({
            v: k,
            n: WHEEL_FINISHES[k].n,
            c: WHEEL_FINISHES[k].c,
            usdTag: priceTag(WHEEL_FINISHES[k].p, region),
          }))}
        />
      </Block>
      <Block title="Brake calipers" em="caliper">
        <Swatches
          k="caliper"
          items={keysOf(CALIPERS).map((k) => ({
            v: k,
            n: CALIPERS[k].n,
            c: CALIPERS[k].c,
            usdTag: priceTag(CALIPERS[k].p, region),
          }))}
        />
      </Block>
    </>
  );
}
