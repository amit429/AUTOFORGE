'use client';

import { useEffect } from 'react';
import { useGo } from '@/components/shell/useGo';
import { Button } from '@/components/ui/Button';
import { useUi } from '@/store/ui';

// Placeholder hero; the loader and scroll story arrive in Phase 4.
export default function Home() {
  const go = useGo();
  useEffect(() => useUi.setState({ introStarted: true }), []);
  return (
    <section style={{ position: 'fixed', left: '7vw', top: '30vh', maxWidth: 640 }}>
      <h1
        className="d"
        style={{ fontSize: 'clamp(38px,6.2vw,92px)', lineHeight: 1.02, letterSpacing: '-0.035em' }}
      >
        Built panel by panel, by&nbsp;you.
      </h1>
      <div style={{ marginTop: 40 }}>
        <Button magnetic arrow cursor="Start" onClick={() => go('region')}>
          Start your build
        </Button>
      </div>
    </section>
  );
}
