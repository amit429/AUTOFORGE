import { STEPS } from '@/data/options';
import { BuildScreen } from './BuildScreen';

export const generateStaticParams = () => STEPS.map((s) => ({ step: s.id }));

export default async function BuildPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <BuildScreen stepId={step} />;
}
