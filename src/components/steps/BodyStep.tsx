'use client';

import { ACCENTS, GRILLES, ROOFS, SPOILERS, keysOf, type ShortNamed } from '@/data/options';
import { Block, Note, Segmented } from '@/components/config/controls';
import { useBuild } from '@/store/build';

const short = <K extends string>(o: Record<K, ShortNamed>) => keysOf(o).map((k) => ({ v: k, label: o[k].s }));

export function BodyStep() {
  const autobahn = useBuild((st) => st.build.packs.includes('autobahn'));
  return (
    <>
      <Block title="Roof" em="roof">
        <Segmented k="roof" options={short(ROOFS)} />
      </Block>
      <Block title="Accent parts" em="accent">
        <Segmented k="accent" options={short(ACCENTS)} />
      </Block>
      <Note style={{ marginTop: 10 }}>Mirrors, front splitter, rear diffuser and side skirts.</Note>
      <Block title="Rear aero" em="spoiler">
        <Segmented k="spoiler" options={short(SPOILERS)} />
      </Block>
      {autobahn && (
        <Note style={{ marginTop: 10 }}>
          <b>Included</b> with the Autobahn aero pack.
        </Note>
      )}
      <Block title="Grille" em="grille">
        <Segmented k="grille" options={short(GRILLES)} />
      </Block>
    </>
  );
}
