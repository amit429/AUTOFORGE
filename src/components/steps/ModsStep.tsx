'use client';

import {
  AMBIENT_PRESETS,
  BODY_TYPES,
  EXHAUSTS,
  MODS,
  UNDERGLOW_USD,
  keysOf,
  type ModId,
} from '@/data/options';
import { priceTag } from '@/engine';
import { Block, Note, Segmented, Swatches, Toggle, controlStyles as s } from '@/components/config/controls';
import { useBuild } from '@/store/build';

function ModRows({ ids }: { ids: ModId[] }) {
  const b = useBuild((st) => st.build);
  return (
    <>
      {ids.map((id) => {
        const m = MODS[id];
        const on = b.mods.includes(id);
        return (
          <div key={id} className={s.row}>
            <div className={s.tx}>
              <b>{m.n}</b>
              <small>{m.d}</small>
            </div>
            <span className={s.pr}>{priceTag(m.p, b.region)}</span>
            <Toggle
              on={on}
              label={`${m.n}, ${priceTag(m.p, b.region)}`}
              onToggle={() => useBuild.getState().toggleMod(id)}
            />
          </div>
        );
      })}
    </>
  );
}

export function ModsStep() {
  const body = useBuild((st) => st.build.body);
  const region = useBuild((st) => st.build.region);
  // Only mods that fit this body are offered; the engine enforces the same rule.
  const fits = keysOf(MODS).filter((id) => MODS[id].bodies.includes(body));
  const stance = fits.filter((id) => MODS[id].g === 'stance');
  const utility = fits.filter((id) => MODS[id].g === 'utility');
  return (
    <>
      <Block title="Stance and body" em="mods">
        <ModRows ids={stance} />
      </Block>
      {utility.length > 0 && (
        <Block title="Utility">
          <ModRows ids={utility} />
        </Block>
      )}
      <Note>
        {fits.length} mods fit the {BODY_TYPES[body].n}. Others appear when you pick a body they suit.
      </Note>
      <Block title="Exhaust" em="exhaust">
        <Segmented k="exhaust" options={keysOf(EXHAUSTS).map((k) => ({ v: k, label: EXHAUSTS[k].n }))} />
      </Block>
      <Block title="Underglow" em="glow">
        <Swatches
          k="glow"
          items={[
            { v: 'none', n: 'Off', c: 'transparent' },
            ...keysOf(AMBIENT_PRESETS).map((k) => ({
              v: k,
              n: AMBIENT_PRESETS[k].n,
              c: AMBIENT_PRESETS[k].c,
              usdTag: priceTag(UNDERGLOW_USD, region),
            })),
          ]}
        />
      </Block>
    </>
  );
}
