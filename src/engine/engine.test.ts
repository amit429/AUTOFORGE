import { describe, expect, it } from 'vitest';
import { BASE_PRICE_USD, DEFAULT_BUILD, PACKS, REGIONS, type Build } from '@/data/options';
import {
  applyPatch,
  applyRegion,
  applySnapshot,
  availability,
  commissionNumber,
  decodeBuild,
  encodeBuild,
  evaluate,
  guessRegion,
  lineItems,
  money,
  normalize,
  optionsUSD,
  priceTag,
  setOption,
  singleEntry,
  snapshotEntry,
  stitchHex,
  toLocal,
  totalUSD,
  undoEntry,
  undoMessage,
} from './index';

const build = (over: Partial<Build> = {}): Build => ({ ...DEFAULT_BUILD, packs: [], ...over });

describe('regional exclusives', () => {
  it('locks paints to their region with a one-sentence reason', () => {
    expect(availability('paint', 'saffron', 'in')).toEqual({ ok: true });
    expect(availability('paint', 'saffron', 'eu')).toEqual({
      ok: false,
      reason: 'Saffron Dusk is exclusive to India.',
    });
  });
  it('always allows core paints and paint to sample', () => {
    for (const r of Object.keys(REGIONS) as Build['region'][]) {
      expect(availability('paint', 'silver', r).ok).toBe(true);
      expect(availability('paint', 'custom', r).ok).toBe(true);
    }
  });
  it('locks liveries, trims and seat materials to their region', () => {
    expect(availability('livery', 'seigaiha', 'jp').ok).toBe(true);
    expect(availability('livery', 'seigaiha', 'in').reason).toBe('Seigaiha waves is exclusive to Japan.');
    expect(availability('trim', 'pearl', 'me').ok).toBe(true);
    expect(availability('trim', 'pearl', 'us').reason).toBe('Mother of pearl is exclusive to Middle East.');
    expect(availability('seatMat', 'wool', 'nd').ok).toBe(true);
    expect(availability('seatMat', 'wool', 'eu').reason).toBe('Wool is exclusive to Nordics.');
  });
  it('refuses to set a locked option and leaves the build untouched', () => {
    const b = build({ region: 'eu' });
    const r = setOption(b, 'paint', 'monsoon');
    expect(r).toEqual({ ok: false, reason: 'Monsoon Teal is exclusive to India.' });
    expect(b.paint).toBe('silver');
  });
});

describe('lamp tint', () => {
  it('offers selective yellow only in Europe and Japan', () => {
    expect(availability('ltint', 'yellow', 'eu').ok).toBe(true);
    expect(availability('ltint', 'yellow', 'jp').ok).toBe(true);
    expect(availability('ltint', 'yellow', 'us')).toEqual({
      ok: false,
      reason: 'Selective yellow is offered only where it is road-legal: Europe and Japan.',
    });
    expect(availability('ltint', 'ice', 'us').ok).toBe(true);
  });
});

describe('wheel sizes', () => {
  it('blocks 22-inch wheels in India and Japan with the region reason', () => {
    expect(availability('size', 22, 'in').reason).toMatch(/^Not offered in India/);
    expect(availability('size', 22, 'jp').reason).toMatch(/^Not offered in Japan/);
    expect(availability('size', 22, 'eu').ok).toBe(true);
    expect(availability('size', 21, 'in').ok).toBe(true);
  });
});

describe('glass', () => {
  it('requires light transmission at or above the legal minimum', () => {
    expect(availability('vlt', 50, 'in').ok).toBe(true);
    expect(availability('vlt', 49, 'in')).toEqual({
      ok: false,
      reason: 'In India, side glass must let through at least 50% of light.',
    });
    expect(availability('vlt', 35, 'us').ok).toBe(true);
    expect(availability('vlt', 69, 'eu').ok).toBe(false);
  });
  it('clamps the slider range to 15–90', () => {
    expect(setOption(build({ region: 'us' }), 'vlt', 5).ok).toBe(false);
    const ok = setOption(build({ region: 'us' }), 'vlt', 120);
    expect(ok.ok && ok.build.vlt).toBe(90);
  });
});

describe('packs', () => {
  it("only allows the region's own packs", () => {
    expect(availability('packs', ['monsoon'], 'in').ok).toBe(true);
    expect(availability('packs', ['autobahn'], 'in').ok).toBe(false);
    expect(setOption(build({ region: 'in' }), 'packs', ['tow']).ok).toBe(false);
  });
  it('the Autobahn pack fits the wing and makes it free', () => {
    const b = build({ region: 'eu', spoiler: 'duck' });
    const r = setOption(b, 'packs', ['autobahn']);
    if (!r.ok || !r.changed) throw new Error('expected change');
    expect(r.build.spoiler).toBe('wing');
    expect(r.prev).toEqual({ packs: [], spoiler: 'duck' });
    expect(optionsUSD(r.build)).toBe(optionsUSD(b) - 1200 + PACKS.autobahn.p);
  });
  it('charges for the wing once the Autobahn pack is removed', () => {
    const withPack = build({ region: 'eu', spoiler: 'wing', packs: ['autobahn'] });
    const r = setOption(withPack, 'packs', []);
    if (!r.ok || !r.changed) throw new Error('expected change');
    expect(r.build.spoiler).toBe('wing');
    expect(optionsUSD(r.build)).toBe(optionsUSD(withPack) - PACKS.autobahn.p + 3600);
  });
});

describe('pricing', () => {
  it('sums the default build', () => {
    // five-spoke 2400 + 20" 900 + red calipers 700 + black roof 600 + black accents 800 + diamond 1100 + carbon 2800
    expect(optionsUSD(DEFAULT_BUILD)).toBe(9300);
    expect(totalUSD(DEFAULT_BUILD)).toBe(BASE_PRICE_USD + 9300);
  });
  it('rounds INR and JPY to 1,000 and other currencies to 10', () => {
    expect(toLocal(101700, 'in')).toBe(12044000);
    expect(toLocal(101700, 'jp')).toBe(16669000);
    expect(toLocal(101700, 'eu')).toBe(111340);
    expect(toLocal(101700, 'us')).toBe(109840);
    expect(toLocal(101700, 'me')).toBe(391900);
    expect(toLocal(101700, 'nd')).toBe(1347530);
  });
  it('formats in the region currency and says Included for free options', () => {
    expect(money(101700, 'us')).toBe('$109,840');
    expect(money(101700, 'in')).toBe('₹1,20,44,000');
    expect(priceTag(0, 'eu')).toBe('Included');
    expect(priceTag(1000, 'us')).toBe('+$1,080');
  });
  it('charges paint to sample at the custom price', () => {
    expect(optionsUSD(build({ paint: 'custom' })) - optionsUSD(DEFAULT_BUILD)).toBe(4900);
  });
  it('evaluate() total matches the line items exactly', () => {
    const b = build({
      region: 'eu',
      paint: 'riviera',
      finish: 'chroma',
      livery: 'hex',
      packs: ['autobahn', 'winter'],
      spoiler: 'wing',
      ambMode: 'flow',
    });
    const e = evaluate(b);
    const sum = lineItems(b)
      .flatMap((g) => g.items)
      .reduce((s, i) => s + (i.usd ?? 0), 0);
    expect(sum).toBe(e.totalUSD);
    expect(e.total).toBe(toLocal(e.totalUSD, 'eu'));
    expect(e.available.paint?.saffron?.ok).toBe(false);
    expect(e.available.size?.['22']?.ok).toBe(true);
    expect(e.available.packs?.tow?.ok).toBe(false);
  });
});

describe('region change', () => {
  it('swaps out everything no longer orderable and explains each swap', () => {
    const b = build({
      region: 'in',
      paint: 'saffron',
      livery: 'jaali',
      trim: 'rosewood',
      vlt: 50,
      packs: ['monsoon'],
    });
    const r = applyRegion(b, 'eu');
    expect(r.build.paint).toBe('vesper');
    expect(r.build.livery).toBe('none');
    expect(r.build.trim).toBe('carbon');
    expect(r.build.vlt).toBe(70);
    expect(r.build.packs).toEqual([]);
    expect(r.swaps).toEqual([
      'Saffron Dusk replaced with Vesper Black',
      'Jaali lattice replaced with None',
      'Indian rosewood replaced with Forged carbon',
      'Glass lightened to 70% to meet local law',
      'Packs from your previous region removed',
    ]);
    expect(r.driveChanged).toBe(true);
  });
  it('swaps locked wheel size, seat material and lamp tint', () => {
    const r = applyRegion(build({ region: 'nd', size: 22, seatMat: 'wool' }), 'jp');
    expect(r.build.size).toBe(20);
    expect(r.build.seatMat).toBe('nappa');
    const t = applyRegion(build({ region: 'eu', ltint: 'yellow' }), 'us');
    expect(t.build.ltint).toBe('ice');
    expect(t.swaps).toEqual(['Selective yellow replaced with Ice white']);
  });
  it('keeps everything that is still valid and reports no swaps', () => {
    const r = applyRegion(build({ region: 'eu' }), 'nd');
    expect(r.swaps).toEqual([]);
    expect(r.driveChanged).toBe(false);
  });
});

describe('history', () => {
  it('undoes a single change', () => {
    const b = build();
    const r = setOption(b, 'paint', 'ultra');
    if (!r.ok || !r.changed) throw new Error('expected change');
    const e = singleEntry('paint', r.prev, r.next, r.build);
    expect(e.label).toBe('Paint: Ultramarine');
    expect(undoEntry(r.build, e).paint).toBe('silver');
    expect(undoMessage(e)).toBe('Undid paint.');
  });
  it('undoes a grouped snapshot in one step', () => {
    const b = build();
    const snap = applySnapshot(b, {
      paint: 'vesper',
      finish: 'gloss',
      caliper: 'graphite',
      seatCol: 'oxblood',
      region: 'eu',
    });
    expect(snap.build.region).toBe('in');
    expect(snap.next).toEqual({ paint: 'vesper', finish: 'gloss', caliper: 'graphite', seatCol: 'oxblood' });
    const e = snapshotEntry('Mood: Noir', snap.prev, snap.next);
    const back = undoEntry(snap.build, e);
    expect(back).toEqual(b);
    expect(undoMessage(e)).toBe('Undid mood: noir.');
  });
  it('snapshots skip options locked in the region', () => {
    const snap = applySnapshot(build({ region: 'us' }), { paint: 'saffron', caliper: 'blue' });
    expect(snap.build.paint).toBe('silver');
    expect(snap.build.caliper).toBe('blue');
  });
  it('undoing Autobahn removes the wing it brought', () => {
    const b = build({ region: 'eu' });
    const r = setOption(b, 'packs', ['autobahn']);
    if (!r.ok || !r.changed) throw new Error('expected change');
    const back = undoEntry(r.build, singleEntry('packs', r.prev, r.next, r.build));
    expect(back.packs).toEqual([]);
    expect(back.spoiler).toBe('none');
  });
  it('undo after a region change never restores a locked value', () => {
    const b = build({ region: 'in' });
    const r = setOption(b, 'paint', 'monsoon');
    if (!r.ok || !r.changed) throw new Error('expected change');
    const r2 = setOption(r.build, 'paint', 'saffron');
    if (!r2.ok || !r2.changed) throw new Error('expected change');
    const moved = applyRegion(r2.build, 'us').build;
    const back = undoEntry(moved, singleEntry('paint', r2.prev, r2.next, r2.build));
    expect(back.paint).toBe('vesper');
  });
});

describe('serialisation', () => {
  it('round-trips a build through a URL-safe code', () => {
    const b = build({
      region: 'jp',
      paint: 'custom',
      custom: '#123abc',
      livery: 'seigaiha',
      packs: ['fold', 'cam'],
    });
    const code = encodeBuild(b);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBuild(code)).toEqual(b);
  });
  it('repairs malformed or illegal values instead of failing', () => {
    const bad = btoa(JSON.stringify({ region: 'eu', paint: 'saffron', size: 99, vlt: 10, wheel: 'nope' }));
    const b = decodeBuild(bad);
    expect(b?.paint).toBe('vesper');
    expect(b?.size).toBe(20);
    expect(b?.vlt).toBe(70);
    expect(b?.wheel).toBe(DEFAULT_BUILD.wheel);
    expect(decodeBuild('%%%')).toBeNull();
    expect(normalize(null)).toEqual(DEFAULT_BUILD);
  });
  it('makes a stable commission number per build', () => {
    const a = commissionNumber(DEFAULT_BUILD);
    expect(a).toMatch(/^HV-IN-\d{5}$/);
    expect(commissionNumber({ ...DEFAULT_BUILD })).toBe(a);
    expect(commissionNumber(build({ paint: 'ultra' }))).not.toBe(a);
  });
  it('applyPatch ignores malformed values', () => {
    expect(applyPatch(DEFAULT_BUILD, { size: 23 as Build['size'] }).size).toBe(20);
  });
});

describe('region guess and helpers', () => {
  it('maps time zones to regions', () => {
    expect(guessRegion('Asia/Kolkata')).toBe('in');
    expect(guessRegion('Asia/Tokyo')).toBe('jp');
    expect(guessRegion('Asia/Dubai')).toBe('me');
    expect(guessRegion('Europe/Stockholm')).toBe('nd');
    expect(guessRegion('Europe/Berlin')).toBe('eu');
    expect(guessRegion('America/New_York')).toBe('us');
    expect(guessRegion('Australia/Sydney')).toBe('in');
  });
  it('matched stitching is the seat colour at 55%', () => {
    expect(stitchHex(build({ stitch: 'match', seatCol: 'bone' }))).toBe('#767067');
    expect(stitchHex(build({ stitch: 'red' }))).toBe('#c2272d');
  });
});
