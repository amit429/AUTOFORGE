import type { BodyTypeId } from '@/data/options';
import { bodyGeometry } from '@/three/car/bodies';

/** Side-view silhouette of a body style, drawn from the same profiles as its 3D body. */
export function BodySilhouette({ body }: { body: BodyTypeId }) {
  const g = bodyGeometry(body);
  const s = g.spec;
  const x0 = s.rear - 0.12;
  const x1 = s.front + 0.12;
  const h = 1.95;
  const X = (x: number) => (x - x0) * 100;
  const Y = (y: number) => (h - y) * 100;
  const d = (pts: { x: number; y: number }[]) =>
    'M' + pts.map((p) => `${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' L') + ' Z';
  return (
    <svg viewBox={`0 0 ${(x1 - x0) * 100} ${h * 100}`} aria-hidden="true">
      <path d={d(g.cabinOutline())} fill="currentColor" opacity={0.35} />
      <path d={d(g.sideOutline())} fill="currentColor" />
      {[s.frontAxle, s.rearAxle].map((ax) => (
        <g key={ax}>
          <circle cx={X(ax)} cy={Y(s.tyreR)} r={s.tyreR * 100} fill="#17181b" />
          <circle cx={X(ax)} cy={Y(s.tyreR)} r={s.tyreR * 58} fill="currentColor" opacity={0.55} />
        </g>
      ))}
      <path d={`M0 ${Y(0)} H${(x1 - x0) * 100}`} stroke="currentColor" strokeWidth={2} opacity={0.4} />
    </svg>
  );
}
