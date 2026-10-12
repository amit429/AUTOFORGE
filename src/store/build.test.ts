import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BUILD, STEPS } from '@/data/options';
import { cloneBuild } from '@/engine';
import { useBuild } from './build';
import { useToasts } from './toasts';

const s = () => useBuild.getState();

beforeEach(() => {
  useBuild.setState({
    build: cloneBuild(DEFAULT_BUILD),
    history: [],
    regionChosen: true,
    step: 0,
    visited: [0],
  });
  useToasts.setState({ toasts: [] });
});

describe('build store', () => {
  it('records changes and undoes them in order', () => {
    expect(s().set('paint', 'ultra')).toBe(true);
    expect(s().set('caliper', 'blue')).toBe(true);
    expect(s().history.map((h) => h.label)).toEqual(['Paint: Ultramarine', 'Calipers: Lacquer blue']);
    s().undo();
    expect(s().build.caliper).toBe('red');
    s().undo();
    expect(s().build.paint).toBe('silver');
    s().undo();
    expect(useToasts.getState().toasts.at(-1)?.msg).toBe('Nothing to undo yet.');
  });

  it('toasts the reason for a locked option and changes nothing', () => {
    expect(s().set('size', 22)).toBe(false);
    expect(s().build.size).toBe(20);
    expect(useToasts.getState().toasts[0]).toMatchObject({ kind: 'warn' });
  });

  it('treats a mood as one grouped history entry', () => {
    s().snapshot({ paint: 'vesper', finish: 'gloss', wfin: 'black' }, 'Mood: Noir');
    expect(s().history).toHaveLength(1);
    s().undo();
    expect(s().build).toEqual(DEFAULT_BUILD);
  });

  it('records a slider drag as a single entry', () => {
    s().setLive('vlt', 65);
    s().setLive('vlt', 60);
    expect(s().history).toHaveLength(0);
    s().commitLive('vlt', 70);
    expect(s().history).toHaveLength(1);
    s().undo();
    expect(s().build.vlt).toBe(70);
  });

  it('swaps choices on region change and reports the change keys', () => {
    s().set('paint', 'saffron');
    s().chooseRegion('eu');
    expect(s().build.region).toBe('eu');
    expect(s().build.paint).toBe('vesper');
    expect(s().change.keys).toEqual(['region', 'paint']);
  });

  it('treats lift and lowered suspension as alternatives', () => {
    useBuild.setState({ build: { ...cloneBuild(DEFAULT_BUILD), body: 'pickup', seating: 'five' } });
    s().toggleMod('lift');
    expect(s().build.mods).toEqual(['lift']);
    s().toggleMod('lift');
    expect(s().build.mods).toEqual([]);
  });

  it('switches to the cabin view for interior steps', () => {
    const at = (id: string) => STEPS.findIndex((x) => x.id === id);
    s().goStep(at('seats'));
    expect(s().view).toBe('cabin');
    s().goStep(at('wheels'));
    expect(s().view).toBe('studio');
  });
});
