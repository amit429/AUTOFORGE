'use client';

import { LAMP_TINTS, LIGHT_SIGNATURES, keysOf } from '@/data/options';
import { emit } from '@/lib/bus';
import { Block, Segmented, Swatches, controlStyles as s } from '@/components/config/controls';
import { useEvaluation } from '@/components/config/useEngine';
import { Button } from '@/components/ui/Button';

export function LightsStep() {
  const ev = useEvaluation();
  return (
    <>
      <Block title="Signature" em="sig">
        <Segmented
          k="sig"
          options={keysOf(LIGHT_SIGNATURES).map((k) => ({ v: k, label: LIGHT_SIGNATURES[k].n }))}
        />
      </Block>
      <Block title="Lamp tint" em="ltint">
        <Swatches
          k="ltint"
          items={keysOf(LAMP_TINTS).map((k) => ({
            v: k,
            n: LAMP_TINTS[k].n,
            c: LAMP_TINTS[k].c,
            why: ev.available.ltint?.[k]?.reason,
          }))}
        />
      </Block>
      <Block>
        <Button variant="ghost" className={s.wide} onClick={() => emit('welcome')}>
          Play the welcome sequence
        </Button>
      </Block>
    </>
  );
}
