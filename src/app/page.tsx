'use client';

import { useEffect } from 'react';
import { Stage } from '@/components/stage/Stage';
import { ThemeToggle } from '@/components/chrome/ThemeToggle';
import { STEPS } from '@/data/options';
import { useBuild } from '@/store/build';
import { useUi } from '@/store/ui';

// Temporary Phase 2 harness: drives the store so every transition can be checked by hand.
export default function Home() {
  const step = useBuild((s) => s.step);
  useEffect(() => {
    useUi.setState({ screen: 'config', introStarted: true });
    (window as unknown as { __halden: unknown }).__halden = { build: useBuild, ui: useUi };
  }, []);
  return (
    <>
      <Stage />
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, display: 'flex', gap: 8 }}>
        <button onClick={() => useBuild.getState().goStep(step + 1)}>Next ({STEPS[step]?.n})</button>
        <ThemeToggle />
      </div>
    </>
  );
}
