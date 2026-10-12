import {
  ACCENTS,
  AMBIENT_PRESETS,
  CALIPERS,
  LIVERIES,
  LIVERY_COLOURS,
  PAINTS,
  QUILTS,
  ROOFS,
  SEAT_COLOURS,
  STITCHES,
  WHEEL_FINISHES,
  WHEELS,
  keysOf,
  type FinishId,
} from '@/data/options';
import { emit } from '@/lib/bus';
import { useBuild } from '@/store/build';

const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;

/** "Inspire me": a random but coherent build in the current region, applied as one undoable change. */
export function inspire() {
  const region = useBuild.getState().build.region;
  const ok = (rg?: string) => !rg || rg === region;
  useBuild.getState().snapshot(
    {
      paint: pick(keysOf(PAINTS).filter((k) => ok(PAINTS[k].rg))),
      finish: pick<FinishId>(['gloss', 'metallic', 'metallic', 'satin', 'matte', 'chroma']),
      livery: Math.random() < 0.4 ? 'none' : pick(keysOf(LIVERIES).filter((k) => ok(LIVERIES[k].rg))),
      livCol: pick(keysOf(LIVERY_COLOURS)),
      wheel: pick(keysOf(WHEELS)),
      wfin: pick(keysOf(WHEEL_FINISHES)),
      caliper: pick(keysOf(CALIPERS)),
      accent: pick(keysOf(ACCENTS)),
      roof: pick(keysOf(ROOFS)),
      seatCol: pick(keysOf(SEAT_COLOURS)),
      stitch: pick(keysOf(STITCHES)),
      quilt: pick(keysOf(QUILTS)),
      amb: pick(Object.values(AMBIENT_PRESETS)).c,
    },
    'Inspired build',
  );
  emit('spin', 1);
}
