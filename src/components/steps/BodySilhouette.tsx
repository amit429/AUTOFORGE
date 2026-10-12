import type { BodyTypeId } from '@/data/options';
import { bodyGeometry } from '@/three/car/bodies';

/**
 * Side-view silhouette of a body style, drawn from the same profiles as its 3D body and filled
 * with the build's paint. Every car is drawn at the same scale, so sizes compare honestly.
 */
export function BodySilhouette({ body, paint }: { body: BodyTypeId; paint: string }) {
  const g = bodyGeometry(body);
  const s = g.spec;
  // Shared frame: 5.5 m long, 2.1 m tall, centred on each car.
  const cx = (s.front + s.rear) / 2;
  const x0 = cx - 2.75;
  const X = (x: number) => (x - x0) * 100;
  const Y = (y: number) => (2.1 - y) * 100;
  const d = (pts: { x: number; y: number }[]) =>
    'M' + pts.map((p) => `${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' L') + ' Z';
  return (
    <svg viewBox="0 0 550 225" style={{ width: '94%' }} aria-hidden="true">
      <ellipse cx={X(cx)} cy={Y(0) + 4} rx={g.length * 52} ry={9} fill="#000" opacity={0.12} />
      <path d={d(g.cabinOutline())} fill="#20252c" opacity={0.85} />
      {!s.softTop && <path d={d(g.roofOutline())} fill={paint} />}
      <path d={d(g.sideOutline())} fill={paint} stroke="rgba(0,0,0,.18)" strokeWidth={2} />
      {[s.frontAxle, s.rearAxle].map((ax) => (
        <g key={ax}>
          <circle cx={X(ax)} cy={Y(s.tyreR)} r={s.tyreR * 100} fill="#17181b" />
          <circle cx={X(ax)} cy={Y(s.tyreR)} r={s.tyreR * 60} fill="#8a8f97" />
          <circle cx={X(ax)} cy={Y(s.tyreR)} r={s.tyreR * 16} fill="#17181b" />
        </g>
      ))}
    </svg>
  );
}
