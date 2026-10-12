/**
 * Screen-to-route mapping and the transition-aware navigator. Page changes are covered by six
 * vertical blinds (or a soft fade to/from the region screen) while the route swaps underneath.
 */
import { STEPS } from '@/data/options';
import { encodeBuild } from '@/engine';
import { prefersReducedMotion } from '@/lib/motion';
import { useBuild } from '@/store/build';
import { useUi, type Screen } from '@/store/ui';

export function hrefFor(screen: Screen): string {
  const { build, step } = useBuild.getState();
  switch (screen) {
    case 'landing':
      return '/';
    case 'region':
      return '/region';
    case 'config':
      return `/build/${STEPS[step]?.id ?? 'paint'}?b=${encodeBuild(build)}`;
    case 'summary':
      return `/reveal?b=${encodeBuild(build)}`;
    case 'doc':
      return '/blueprint';
  }
}

export interface Curtain {
  cover: (soft: boolean) => Promise<void>;
  reveal: (soft: boolean) => Promise<void>;
}

let curtain: Curtain | null = null;
export const registerCurtain = (c: Curtain | null) => void (curtain = c);

function waitForScreen(target: Screen, timeout = 4000) {
  return new Promise<void>((resolve) => {
    if (useUi.getState().screen === target) return resolve();
    const t = setTimeout(() => {
      un();
      resolve();
    }, timeout);
    const un = useUi.subscribe((s) => {
      if (s.screen !== target) return;
      clearTimeout(t);
      un();
      resolve();
    });
  });
}

/** Navigates to a screen with the page transition. `push` is the router's push. */
export async function navigate(to: Screen, push: (href: string) => void) {
  const ui = useUi.getState();
  if (ui.transitioning) return;
  let target = to;
  if (target === 'config' && !useBuild.getState().regionChosen) target = 'region';
  const from = ui.screen;
  if (target === from) {
    if (target === 'doc') document.getElementById('doc-scroller')?.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const soft = target === 'region' || from === 'region';
  const href = hrefFor(target);
  if (!curtain || prefersReducedMotion()) {
    push(href);
    return;
  }
  useUi.setState({ transitioning: true });
  try {
    await curtain.cover(soft);
    push(href);
    await waitForScreen(target);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await curtain.reveal(soft);
  } finally {
    useUi.setState({ transitioning: false });
  }
}
