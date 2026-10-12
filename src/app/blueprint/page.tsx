import type { Metadata } from 'next';
import { BlueprintDoc } from '@/components/doc/BlueprintDoc';

export const metadata: Metadata = { title: 'The Halden Atelier blueprint' };

export default function BlueprintPage() {
  return <BlueprintDoc />;
}
