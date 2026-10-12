import type { ComponentType } from 'react';
import type { StepId } from '@/data/options';
import { AmbientStep } from './AmbientStep';
import { BodyStep } from './BodyStep';
import { GlassStep } from './GlassStep';
import { LightsStep } from './LightsStep';
import { LiveryStep } from './LiveryStep';
import { PaintStep } from './PaintStep';
import { RegionStep } from './RegionStep';
import { SeatsStep } from './SeatsStep';
import { TrimStep } from './TrimStep';
import { WheelsStep } from './WheelsStep';

export const STEP_PANELS: Record<StepId, ComponentType> = {
  paint: PaintStep,
  livery: LiveryStep,
  wheels: WheelsStep,
  body: BodyStep,
  lights: LightsStep,
  glass: GlassStep,
  seats: SeatsStep,
  trim: TrimStep,
  ambient: AmbientStep,
  region: RegionStep,
};
