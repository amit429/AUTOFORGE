import { create } from 'zustand';
import type { RegionId } from '@/data/options';

export type Screen = 'landing' | 'region' | 'config' | 'summary' | 'doc';

interface UiState {
  screen: Screen;
  /** Landing scroll progress, 0..5 across the six chapters. */
  storyT: number;
  /** Reveal scroll progress, 0..5 across its six chapters. */
  revealT: number;
  /** Set when the loader hands over to the hero, which starts the camera intro. */
  introStarted: boolean;
  lightsOn: boolean;
  /** Region highlighted on the region screen before it is confirmed. */
  pendingRegion: RegionId | null;
  /** Region whose lon the globe is turning towards (hover follows the pointer). */
  globeRegion: RegionId | null;
  /** True while a page transition is covering the screen. */
  transitioning: boolean;
}

export const useUi = create<UiState>(() => ({
  screen: 'landing',
  storyT: 0,
  revealT: 0,
  introStarted: false,
  lightsOn: false,
  pendingRegion: null,
  globeRegion: null,
  transitioning: false,
}));

export const screenForPath = (path: string): Screen => {
  if (path.startsWith('/region')) return 'region';
  if (path.startsWith('/build')) return 'config';
  if (path.startsWith('/reveal')) return 'summary';
  if (path.startsWith('/blueprint')) return 'doc';
  return 'landing';
};
