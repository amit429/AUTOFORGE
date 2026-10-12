'use client';

import { useMemo } from 'react';
import type { Build, OptionKey } from '@/data/options';
import { evaluate, optionLabel, priceTag } from '@/engine';
import { burst, shake } from '@/lib/feedback';
import { useBuild } from '@/store/build';
import { toast } from '@/store/toasts';

/** The engine's evaluation of the current build, recomputed only when the build changes. */
export function useEvaluation() {
  const build = useBuild((s) => s.build);
  return useMemo(() => evaluate(build), [build]);
}

/** "Halden Silver Included": the current choice and its price for a block header. */
export function useEm(key: OptionKey) {
  const build = useBuild((s) => s.build);
  const { name, usd } = optionLabel(key, build);
  return { name, price: usd == null ? null : priceTag(usd, build.region) };
}

/**
 * Handles a press on an option: locked options shake and explain themselves, available ones
 * apply and burst. Returns whether the build changed.
 */
export function choose<K extends OptionKey>(
  key: K,
  value: Build[K],
  el: HTMLElement | null,
  reason?: string,
) {
  if (reason) {
    shake(el);
    toast(reason, 'warn');
    return false;
  }
  const ok = useBuild.getState().set(key, value);
  if (ok && el) burst(el);
  return ok;
}
