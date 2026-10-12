'use client';

import { BODY_TYPES, QUILTS, SEATINGS, SEAT_COLOURS, SEAT_MATERIALS, STITCHES, keysOf } from '@/data/options';
import { priceTag, stitchHex } from '@/engine';
import { Block, Cards, Note, Segmented, Swatches } from '@/components/config/controls';
import { useEvaluation } from '@/components/config/useEngine';
import { useBuild } from '@/store/build';
import { SeatLayoutIcon } from './SeatLayoutIcon';

export function SeatsStep() {
  const b = useBuild((st) => st.build);
  const ev = useEvaluation();
  const stitch = stitchHex(b);
  const mats = keysOf(SEAT_MATERIALS).filter(
    (k) => !SEAT_MATERIALS[k].rg || SEAT_MATERIALS[k].rg === b.region,
  );
  const layouts = BODY_TYPES[b.body].layouts;
  return (
    <>
      <Block title="Layout" em="seating">
        <Cards
          k="seating"
          items={layouts.map((k) => ({
            v: k,
            n: SEATINGS[k].n,
            sub: priceTag(SEATINGS[k].p, b.region),
            icon: <SeatLayoutIcon layout={k} />,
          }))}
        />
      </Block>
      <Note>
        {SEATINGS[b.seating].d}
        {layouts.length === 1 && ` The ${BODY_TYPES[b.body].n} is offered with this layout only.`}
      </Note>
      <Block title="Material" em="seatMat">
        <Segmented
          k="seatMat"
          options={mats.map((k) => ({
            v: k,
            label: SEAT_MATERIALS[k].n,
            why: ev.available.seatMat?.[k]?.reason,
          }))}
        />
      </Block>
      <Block title="Colour" em="seatCol">
        <Swatches
          k="seatCol"
          items={keysOf(SEAT_COLOURS).map((k) => ({ v: k, n: SEAT_COLOURS[k].n, c: SEAT_COLOURS[k].c }))}
        />
      </Block>
      <Block title="Quilting" em="quilt">
        <Cards
          k="quilt"
          items={keysOf(QUILTS).map((k) => ({
            v: k,
            n: QUILTS[k].n,
            sub: priceTag(QUILTS[k].p, b.region),
            pattern: { id: QUILTS[k].id, a: SEAT_COLOURS[b.seatCol].c, b: stitch, mode: 'seat' },
          }))}
        />
      </Block>
      <Block title="Stitching" em="stitch">
        <Swatches
          k="stitch"
          items={keysOf(STITCHES).map((k) => ({ v: k, n: STITCHES[k].n, c: STITCHES[k].c ?? stitch }))}
        />
      </Block>
    </>
  );
}
