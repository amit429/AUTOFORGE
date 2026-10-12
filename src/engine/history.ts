import type { Build, OptionKey } from '@/data/options';
import { applyPatch, type Patch } from './build';
import { KEY_NAMES, optionLabel } from './labels';
import { applyRegion } from './regions';

/**
 * One undoable step. A single change touches one key (plus anything it brought along, like
 * the Autobahn wing); a grouped snapshot (moods, inspire, start over) touches many.
 */
export interface HistoryEntry {
  id: number;
  key: OptionKey | '*';
  label: string;
  prev: Patch;
  next: Patch;
}

let seq = 0;

export function singleEntry(key: OptionKey, prev: Patch, next: Patch, after: Build): HistoryEntry {
  return { id: ++seq, key, label: `${KEY_NAMES[key]}: ${optionLabel(key, after).name}`, prev, next };
}

export function snapshotEntry(label: string, prev: Patch, next: Patch): HistoryEntry {
  return { id: ++seq, key: '*', label, prev, next };
}

/** What the "Undid …" toast says. */
export const undoMessage = (e: HistoryEntry) =>
  `Undid ${e.key === '*' ? e.label.toLowerCase() : KEY_NAMES[e.key].toLowerCase()}.`;

/**
 * Restores the values an entry replaced. The region may have changed since, so the result is
 * re-checked and anything no longer orderable falls back to a default.
 */
export function undoEntry(b: Build, e: HistoryEntry): Build {
  return applyRegion(applyPatch(b, e.prev), b.region).build;
}

/** Keys an entry touched, so the 3D layer can play the right transitions on undo. */
export const entryKeys = (e: HistoryEntry) => Object.keys(e.prev) as OptionKey[];
