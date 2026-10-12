'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Header } from '@/components/chrome/Header';
import { Stage } from '@/components/stage/Stage';
import { STEPS } from '@/data/options';
import { decodeBuild } from '@/engine';
import { hrefFor } from '@/lib/navigation';
import { loadSaved, startAutosave, useBuild } from '@/store/build';
import { screenForPath, useUi } from '@/store/ui';
import { Cursor } from './Cursor';
import { Curtain } from './Curtain';
import { Toasts } from './Toasts';

/** Restores the build from `?b=` or localStorage once, then autosaves. */
function useHydrateBuild() {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = decodeBuild(params.get('b'));
    const saved = loadSaved();
    const stepFromPath = STEPS.findIndex((s) => location.pathname === `/build/${s.id}`);
    const { hydrate, build } = useBuild.getState();
    if (fromUrl)
      hydrate(fromUrl, { regionChosen: true, step: stepFromPath >= 0 ? stepFromPath : (saved?.step ?? 0) });
    else if (saved)
      hydrate(saved.build, {
        regionChosen: saved.regionChosen,
        step: stepFromPath >= 0 ? stepFromPath : saved.step,
      });
    else hydrate(build, { regionChosen: false, step: Math.max(0, stepFromPath) });
    return startAutosave();
  }, []);
}

/** Mirrors the route into the UI store, and the build/step back into the URL on build screens. */
function useRouteSync() {
  const pathname = usePathname();
  useEffect(() => {
    useUi.setState({ screen: screenForPath(pathname) });
  }, [pathname]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const un = useBuild.subscribe((s, p) => {
      if (s.build === p.build && s.step === p.step) return;
      const { screen, transitioning } = useUi.getState();
      if (transitioning || (screen !== 'config' && screen !== 'summary') || !s.hydrated) return;
      clearTimeout(t);
      t = setTimeout(() => {
        const href = hrefFor(useUi.getState().screen);
        if (href !== location.pathname + location.search) history.replaceState(history.state, '', href);
      }, 250);
    });
    return () => {
      un();
      clearTimeout(t);
    };
  }, []);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useHydrateBuild();
  useRouteSync();
  return (
    <>
      <Stage />
      <Header />
      <main id="screen">{children}</main>
      <Toasts />
      <Curtain />
      <Cursor />
    </>
  );
}
