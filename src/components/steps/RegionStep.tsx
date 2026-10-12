'use client';

import { PACKS, REGIONS } from '@/data/options';
import { priceTag } from '@/engine';
import { Block, Toggle, controlStyles as s } from '@/components/config/controls';
import { useGo } from '@/components/shell/useGo';
import { Button } from '@/components/ui/Button';
import { useBuild } from '@/store/build';

export function RegionStep() {
  const b = useBuild((st) => st.build);
  const go = useGo();
  const R = REGIONS[b.region];
  return (
    <>
      <Block title="Market packs" em="packs">
        {R.packs.map((k) => {
          const on = b.packs.includes(k);
          return (
            <div key={k} className={s.row} data-on={on}>
              <div className={s.tx}>
                <b>{PACKS[k].n}</b>
                <small>{PACKS[k].d}</small>
              </div>
              <span className={s.pr}>{priceTag(PACKS[k].p, b.region)}</span>
              <Toggle
                on={on}
                label={`${PACKS[k].n}, ${priceTag(PACKS[k].p, b.region)}`}
                onToggle={() => useBuild.getState().togglePack(k)}
              />
            </div>
          );
        })}
      </Block>
      <Block title={`Built for ${R.n}`}>
        <Fact label="Drive side" value={R.drive === 'RHD' ? 'Right-hand drive' : 'Left-hand drive'} />
        <Fact label="Prices" sub="Including local taxes and duties" value={R.cur} />
        <Fact label="Side glass" value={`At least ${R.vlt}% light`} />
        <Fact
          label="Delivery"
          sub={`Built to order and delivered to ${R.city}`}
          value={`About ${R.weeks} weeks`}
        />
        <Button variant="ghost" className={s.wide} style={{ marginTop: 14 }} onClick={() => go('region')}>
          Change region
        </Button>
      </Block>
    </>
  );
}

function Fact({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <div className={s.row}>
      <div className={s.tx}>
        <b>{label}</b>
        {sub && <small>{sub}</small>}
      </div>
      <span className={s.pr}>{value}</span>
    </div>
  );
}
