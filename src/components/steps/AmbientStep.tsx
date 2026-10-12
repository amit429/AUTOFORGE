'use client';

import { AMBIENT_MODES, AMBIENT_PRESETS, keysOf } from '@/data/options';
import { Block, Range, Segmented, Swatches } from '@/components/config/controls';
import { ColourRing } from '@/components/config/ColourRing';

export function AmbientStep() {
  return (
    <>
      <Block title="Colour" em="amb">
        <ColourRing kind="amb" />
      </Block>
      <Block title="Presets">
        <Swatches
          k="amb"
          label="Ambient presets"
          items={keysOf(AMBIENT_PRESETS).map((k) => ({
            v: AMBIENT_PRESETS[k].c,
            n: AMBIENT_PRESETS[k].n,
            c: AMBIENT_PRESETS[k].c,
          }))}
        />
      </Block>
      <Block title="Mode" em="ambMode">
        <Segmented
          k="ambMode"
          options={keysOf(AMBIENT_MODES).map((k) => ({ v: k, label: AMBIENT_MODES[k].n }))}
        />
      </Block>
      <Block title="Brightness" em="ambBri">
        <Range k="ambBri" min={0.15} max={1} step={0.01} label="Ambient brightness" />
      </Block>
    </>
  );
}
