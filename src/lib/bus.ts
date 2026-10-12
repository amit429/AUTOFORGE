/**
 * Imperative one-off commands for the 3D stage that are not build state: lights, camera moves
 * and previews. Build options never travel through here; the stage reads those from the store.
 */
export interface PaintPreview {
  colour: string;
  pattern: number;
  patternColour: string;
  duration?: number;
}

export interface StageEvents {
  welcome: void;
  lights: boolean;
  resetCamera: void;
  spin: number;
  /** Temporarily repaint the body without touching the build (region picker, landing). */
  previewPaint: PaintPreview;
  /** Return the body to the build's own paint. */
  restorePaint: void;
  revealLights: void;
}

type Handler<T> = (payload: T) => void;
const handlers = new Map<keyof StageEvents, Set<Handler<never>>>();

export function on<K extends keyof StageEvents>(type: K, fn: Handler<StageEvents[K]>) {
  let set = handlers.get(type);
  if (!set) handlers.set(type, (set = new Set()));
  set.add(fn as Handler<never>);
  return () => void set.delete(fn as Handler<never>);
}

export function emit<K extends keyof StageEvents>(
  type: K,
  ...payload: StageEvents[K] extends void ? [] : [StageEvents[K]]
) {
  handlers.get(type)?.forEach((fn) => (fn as Handler<StageEvents[K] | undefined>)(payload[0]));
}
