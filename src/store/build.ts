import { create } from 'zustand';
import {
  BODY_TYPES,
  COMFORTS,
  MODS,
  CABIN_STEPS,
  DEFAULT_BUILD,
  PACKS,
  REGIONS,
  SEATINGS,
  STEPS,
  type Build,
  type OptionKey,
  type ComfortId,
  type ModId,
  type PackId,
  type RegionId,
} from '@/data/options';
import {
  applyPatch,
  applyRegion,
  applySnapshot,
  cloneBuild,
  decodeBuild,
  encodeBuild,
  entryKeys,
  sameValue,
  setOption,
  singleEntry,
  snapshotEntry,
  undoEntry,
  undoMessage,
  type HistoryEntry,
  type Patch,
} from '@/engine';
import { toast, toastSequence } from './toasts';

export type View = 'studio' | 'exploded' | 'blueprint' | 'cabin';

/**
 * Describes the most recent change so the 3D stage knows which parts to transition and
 * whether to animate. `seq` increases on every change.
 */
export interface ChangeInfo {
  seq: number;
  keys: OptionKey[];
  animate: boolean;
  prev: Build;
}

interface BuildState {
  build: Build;
  history: HistoryEntry[];
  change: ChangeInfo;
  regionChosen: boolean;
  step: number;
  visited: number[];
  view: View;
  hydrated: boolean;

  /** Sets one option. Locked options toast their reason and return false. */
  set: <K extends OptionKey>(key: K, value: Build[K]) => boolean;
  /** Updates a slider value while dragging, without recording history. */
  setLive: <K extends OptionKey>(key: K, value: Build[K]) => void;
  /** Records a finished slider drag as one history entry. */
  commitLive: <K extends OptionKey>(key: K, start: Build[K]) => void;
  togglePack: (pack: PackId) => void;
  toggleMod: (mod: ModId) => void;
  toggleComfort: (c: ComfortId) => void;
  snapshot: (target: Patch, label: string | null) => void;
  undo: () => void;
  chooseRegion: (region: RegionId) => void;
  startOver: () => void;
  goStep: (i: number) => void;
  setView: (v: View) => void;
  hydrate: (b: Build, opts?: { regionChosen?: boolean; step?: number }) => void;
}

let changeSeq = 0;
const change = (keys: OptionKey[], prev: Build, animate = true): ChangeInfo => ({
  seq: ++changeSeq,
  keys,
  animate,
  prev,
});

export const isCabinStep = (i: number) => CABIN_STEPS.includes(STEPS[i]?.id ?? 'paint');

export const useBuild = create<BuildState>((set, get) => ({
  build: cloneBuild(DEFAULT_BUILD),
  history: [],
  change: change([], DEFAULT_BUILD, false),
  regionChosen: false,
  step: 0,
  visited: [0],
  view: 'studio',
  hydrated: false,

  set: (key, value) => {
    const { build } = get();
    const r = setOption(build, key, value);
    if (!r.ok) {
      toast(r.reason, 'warn');
      return false;
    }
    if (!r.changed) return false;
    const entry = singleEntry(key, r.prev, r.next, r.build);
    set((s) => ({
      build: r.build,
      history: [...s.history, entry],
      change: change(Object.keys(r.next) as OptionKey[], build),
    }));
    if (key === 'body' && r.next.seating)
      toast(`Seating changed to ${SEATINGS[r.next.seating].n} to fit the ${BODY_TYPES[r.build.body].n}.`);
    if (r.next.comfort && r.prev.comfort && key !== 'comfort') {
      const gone = r.prev.comfort
        .filter((c) => !r.next.comfort!.includes(c))
        .map((c) => COMFORTS[c].n.toLowerCase());
      if (gone.length) toast(`Removed ${gone.join(', ')}: needs a different seating layout.`, 'warn');
    }
    if (key === 'roof' && r.next.headliner)
      toast('Headliner set to standard: a panoramic glass roof has no headliner.', 'warn');
    if (key === 'body' && r.next.mods && r.prev.mods) {
      const gone = r.prev.mods.filter((m) => !r.next.mods!.includes(m)).map((m) => MODS[m].n.toLowerCase());
      if (gone.length)
        toast(`Removed the ${gone.join(', ')}: not available on the ${BODY_TYPES[r.build.body].n}.`, 'warn');
    }
    return true;
  },

  setLive: (key, value) => {
    const { build } = get();
    const r = setOption(build, key, value);
    if (!r.ok || !r.changed) return;
    set({ build: r.build, change: change([key], build, false) });
  },

  commitLive: (key, start) => {
    const { build } = get();
    if (sameValue(build[key], start)) return;
    const entry = singleEntry(key, { [key]: start }, { [key]: build[key] }, build);
    set((s) => ({ history: [...s.history, entry] }));
  },

  togglePack: (pack) => {
    const { build } = get();
    const on = build.packs.includes(pack);
    const next = on ? build.packs.filter((p) => p !== pack) : [...build.packs, pack];
    if (get().set('packs', next)) toast(`${PACKS[pack].n} ${on ? 'removed' : 'added'}.`);
  },

  toggleMod: (mod) => {
    const { build } = get();
    const on = build.mods.includes(mod);
    // Lift and lowered suspension are alternatives: fitting one removes the other.
    const other: ModId | null = mod === 'lift' ? 'lowered' : mod === 'lowered' ? 'lift' : null;
    const next = on ? build.mods.filter((m) => m !== mod) : [...build.mods.filter((m) => m !== other), mod];
    if (get().set('mods', next)) toast(`${MODS[mod].n} ${on ? 'removed' : 'fitted'}.`);
  },

  toggleComfort: (c) => {
    const { build } = get();
    const on = build.comfort.includes(c);
    const next = on ? build.comfort.filter((x) => x !== c) : [...build.comfort, c];
    if (get().set('comfort', next)) toast(`${COMFORTS[c].n} ${on ? 'removed' : 'added'}.`);
  },

  snapshot: (target, label) => {
    const { build } = get();
    const r = applySnapshot(build, target);
    const keys = Object.keys(r.prev) as OptionKey[];
    if (!keys.length) return;
    set((s) => ({
      build: r.build,
      history: label ? [...s.history, snapshotEntry(label, r.prev, r.next, r.build)] : s.history,
      change: change(keys, build),
    }));
  },

  undo: () => {
    const { history, build } = get();
    const entry = history[history.length - 1];
    if (!entry) {
      toast('Nothing to undo yet.');
      return;
    }
    const next = undoEntry(build, entry);
    set({ build: next, history: history.slice(0, -1), change: change(entryKeys(entry), build) });
    toast(undoMessage(entry));
  },

  chooseRegion: (region) => {
    const { build, regionChosen } = get();
    const initial = !regionChosen;
    const r = applyRegion(build, region);
    set({
      build: r.build,
      regionChosen: true,
      change: change(['region', ...r.swappedKeys], build, true),
    });
    if (initial) return;
    const R = REGIONS[region];
    const queue: Parameters<typeof toastSequence>[0] = [
      { msg: `Now building for ${R.n}. Prices in ${R.cur}.`, at: 0 },
    ];
    if (r.driveChanged)
      queue.push({ msg: `Steering moved to ${R.drive === 'RHD' ? 'right' : 'left'}-hand drive.`, at: 0.5 });
    r.swaps.forEach((msg, i) => queue.push({ msg: `${msg}.`, kind: 'warn', at: 1 + i * 0.5 }));
    toastSequence(queue);
  },

  startOver: () => {
    const { build } = get();
    const fresh = { ...cloneBuild(DEFAULT_BUILD), region: build.region };
    const next = applyRegion(applyPatch(build, fresh), build.region).build;
    const keys = (Object.keys(next) as OptionKey[]).filter((k) => !sameValue(next[k], build[k]));
    set({ build: next, history: [], step: 0, visited: [0], view: 'studio', change: change(keys, build) });
    toast('Started a fresh build.');
  },

  goStep: (i) => {
    const step = Math.max(0, Math.min(STEPS.length - 1, i));
    const { visited, view } = get();
    const cab = isCabinStep(step);
    const nextView: View = view === 'blueprint' && !cab ? 'blueprint' : cab ? 'cabin' : 'studio';
    set({ step, visited: visited.includes(step) ? visited : [...visited, step], view: nextView });
  },

  setView: (view) => set({ view }),

  hydrate: (b, opts = {}) => {
    const { build } = get();
    const next = applyRegion(b, b.region).build;
    set({
      build: next,
      hydrated: true,
      regionChosen: opts.regionChosen ?? get().regionChosen,
      step: opts.step ?? get().step,
      change: change(Object.keys(next) as OptionKey[], build, false),
    });
  },
}));

/* ----------------------------- persistence ----------------------------- */

const STORAGE_KEY = 'autoforge-build-v1';

interface Saved {
  code: string;
  regionChosen: boolean;
  step: number;
}

export function loadSaved(): { build: Build; regionChosen: boolean; step: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    const build = decodeBuild(saved.code);
    if (!build) return null;
    return { build, regionChosen: !!saved.regionChosen, step: Number(saved.step) || 0 };
  } catch {
    return null;
  }
}

/** Autosaves the build to localStorage whenever it changes. Returns an unsubscribe. */
export function startAutosave() {
  return useBuild.subscribe((s, p) => {
    if (s.build === p.build && s.step === p.step && s.regionChosen === p.regionChosen) return;
    if (!s.hydrated) return;
    try {
      const saved: Saved = { code: encodeBuild(s.build), regionChosen: s.regionChosen, step: s.step };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Storage may be full or blocked; the URL still carries the build.
    }
  });
}
