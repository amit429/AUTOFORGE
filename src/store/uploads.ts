import { create } from 'zustand';

/**
 * User artwork for door and rear graphics. Images stay on this device: they are downscaled and
 * kept in localStorage, never put in the build code or share links (a shared build without the
 * image simply shows no custom graphic).
 */
export type ArtPlace = 'door' | 'rear';

interface UploadState {
  door: string | null;
  rear: string | null;
  /** Bumps on every change so the 3D layer can redraw. */
  rev: number;
  set: (place: ArtPlace, dataUrl: string | null) => void;
}

const KEY = 'autoforge-artwork-v1';
const MAX = 768;

function load(): Pick<UploadState, 'door' | 'rear'> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) return JSON.parse(raw) as Pick<UploadState, 'door' | 'rear'>;
  } catch {
    // Unreadable or blocked storage: start without artwork.
  }
  return { door: null, rear: null };
}

export const useUploads = create<UploadState>((set, get) => ({
  door: null,
  rear: null,
  rev: 0,
  set: (place, dataUrl) => {
    set((s) => ({ [place]: dataUrl, rev: s.rev + 1 }) as Partial<UploadState>);
    try {
      const { door, rear } = get();
      localStorage.setItem(KEY, JSON.stringify({ door, rear }));
    } catch {
      // Storage full or blocked: the artwork still shows for this visit.
    }
  },
}));

/** Restores saved artwork after hydration (localStorage is client-only). */
export function loadUploads() {
  const saved = load();
  if (saved.door || saved.rear) useUploads.setState((s) => ({ ...saved, rev: s.rev + 1 }));
}

/** Reads an image file, downscales it to fit within 768 px and returns a PNG data URL. */
export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That file is not an image.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}

const cache = new Map<string, HTMLImageElement>();

/** Decodes a data URL into an image element (cached), resolving once it can be drawn. */
export function imageFor(dataUrl: string): Promise<HTMLImageElement> {
  const hit = cache.get(dataUrl);
  if (hit?.complete) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = hit ?? new Image();
    cache.set(dataUrl, img);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Artwork could not be decoded.'));
    if (!hit) img.src = dataUrl;
  });
}
