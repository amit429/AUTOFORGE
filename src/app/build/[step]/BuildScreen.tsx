'use client';

import { useEffect } from 'react';
import { Configurator } from '@/components/config/Configurator';
import { useGo } from '@/components/shell/useGo';
import { STEPS } from '@/data/options';
import { useBuild } from '@/store/build';

export function BuildScreen({ stepId }: { stepId: string }) {
  const hydrated = useBuild((s) => s.hydrated);
  const regionChosen = useBuild((s) => s.regionChosen);
  const go = useGo();
  useEffect(() => {
    const i = STEPS.findIndex((s) => s.id === stepId);
    if (i >= 0 && i !== useBuild.getState().step) useBuild.getState().goStep(i);
  }, [stepId]);
  useEffect(() => {
    if (hydrated && !regionChosen) go('region');
  }, [hydrated, regionChosen, go]);
  return <Configurator />;
}
