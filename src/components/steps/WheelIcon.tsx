import type { WheelId } from '@/data/options';

const C = 60;
const R = 40;
const P = (a: number, r: number) => `${(C + Math.cos(a) * r).toFixed(1)} ${(C + Math.sin(a) * r).toFixed(1)}`;

/** Flat wheel-face drawing for the design cards. */
export function WheelIcon({ design }: { design: WheelId }) {
  const paths: React.ReactNode[] = [];
  if (design === 'five')
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      for (const o of [-0.1, 0.1])
        paths.push(
          <path key={`${i}${o}`} d={`M${P(a + o * 0.6, 9)} L${P(a + o, R - 2)}`} strokeWidth={4.5} />,
        );
    }
  else if (design === 'ten')
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      paths.push(<path key={i} d={`M${P(a, 9)} L${P(a, R - 2)}`} strokeWidth={3} />);
    }
  else if (design === 'turbine')
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      paths.push(
        <path key={i} d={`M${P(a, 9)} Q${P(a + 0.35, 24)} ${P(a + 0.5, R - 2)}`} strokeWidth={3.2} />,
      );
    }
  else if (design === 'mesh')
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      paths.push(
        <path
          key={i}
          d={`M${P(a, 9)} L${P(a + 0.45, R - 2)} M${P(a, 9)} L${P(a - 0.45, R - 2)}`}
          strokeWidth={1.8}
        />,
      );
    }
  else {
    paths.push(<circle key="d" cx={C} cy={C} r={R - 3} fill="currentColor" stroke="none" opacity={0.85} />);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      paths.push(
        <path
          key={i}
          d={`M${P(a - 0.18, R * 0.66)} L${P(a + 0.18, R * 0.66)}`}
          stroke="#17181b"
          strokeWidth={5}
        />,
      );
    }
  }
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx={C} cy={C} r={56} fill="#17181b" />
      <circle cx={C} cy={C} r={R} fill="#2a2d32" stroke="currentColor" strokeWidth={2.5} />
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        {paths}
      </g>
      <circle cx={C} cy={C} r={9} fill="currentColor" />
    </svg>
  );
}
