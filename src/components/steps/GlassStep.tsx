'use client';

import { useRef } from 'react';
import { REGIONS } from '@/data/options';
import { RANGES, availability } from '@/engine';
import { shake } from '@/lib/feedback';
import { Block, Note, Range, controlStyles as s } from '@/components/config/controls';
import { useBuild } from '@/store/build';
import { toast } from '@/store/toasts';

export function GlassStep() {
  const region = useBuild((st) => st.build.region);
  const R = REGIONS[region];
  const legal = useRef<HTMLDivElement>(null);
  const lastWarn = useRef(0);
  const { min, max } = RANGES.vlt;
  const pct = ((R.vlt - min) / (max - min)) * 100;
  return (
    <>
      <Block title="Side glass" em="vlt">
        <Range
          k="vlt"
          min={min}
          max={max}
          step={1}
          label="Side glass light transmission"
          legalMin={R.vlt}
          onBlocked={() => {
            shake(legal.current);
            if (Date.now() - lastWarn.current > 1800) {
              lastWarn.current = Date.now();
              toast(availability('vlt', R.vlt - 1, region).reason ?? '', 'warn');
            }
          }}
        />
        <div className={s.legal} ref={legal}>
          <i style={{ left: `${pct}%` }} />
          <span style={{ left: `${pct}%` }}>Legal limit in {R.n}</span>
        </div>
      </Block>
      <Note>
        Lower numbers are darker. In {R.n}, front side glass must let through at least <b>{R.vlt}%</b> of
        light, so darker settings are blocked here.
        {R.packs.includes('heatshield') &&
          ' The ceramic heat shield in your regional pack cools the cabin without going darker.'}
      </Note>
    </>
  );
}
