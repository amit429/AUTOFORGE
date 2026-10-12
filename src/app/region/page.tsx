'use client';

import { REGIONS, REGION_IDS } from '@/data/options';
import { useGo } from '@/components/shell/useGo';
import { Button } from '@/components/ui/Button';
import { useBuild } from '@/store/build';

// Minimal region picker; the globe and full choreography arrive in Phase 4.
export default function RegionPage() {
  const go = useGo();
  return (
    <section style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <h2 className="d" style={{ fontSize: 36 }}>
          Where will you drive it?
        </h2>
        {REGION_IDS.map((r) => (
          <Button
            key={r}
            variant="ghost"
            onClick={() => {
              useBuild.getState().chooseRegion(r);
              go('config');
            }}
          >
            {REGIONS[r].n}, prices in {REGIONS[r].cur}
          </Button>
        ))}
      </div>
    </section>
  );
}
