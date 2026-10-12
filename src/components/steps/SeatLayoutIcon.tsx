import type { SeatingId } from '@/data/options';

/** Rows of seats seen from above; each entry is a row: 'b' bucket/captain, 'n' narrow, 'B' bench. */
const ROWS: Record<SeatingId, string[]> = {
  two: ['bb'],
  twoPlusTwo: ['bb', 'nn'],
  five: ['bb', 'B3'],
  lounge: ['bb', 'b|b'],
  six: ['bb', 'bb', 'bb'],
  seven: ['bb', 'B3', 'B2'],
};

/** Top-down seating diagram for a layout card. The car's nose points right. */
export function SeatLayoutIcon({ layout }: { layout: SeatingId }) {
  const rows = ROWS[layout];
  const seat = (x: number, y: number, w: number, h: number, k: string) => (
    <rect key={k} x={x} y={y} width={w} height={h} rx={5} fill="currentColor" />
  );
  const out: React.ReactNode[] = [];
  rows.forEach((row, i) => {
    const x = 132 - i * 40;
    if (row === 'bb' || row === 'nn') {
      const w = row === 'nn' ? 22 : 28;
      out.push(seat(x, 18, w, 26, `${i}a`), seat(x, 56, w, 26, `${i}b`));
    } else if (row === 'b|b') {
      out.push(seat(x, 16, 28, 26, `${i}a`), seat(x, 58, 28, 26, `${i}b`));
      out.push(
        <rect
          key={`${i}c`}
          x={x + 6}
          y={44}
          width={16}
          height={12}
          rx={3}
          fill="currentColor"
          opacity={0.45}
        />,
      );
    } else {
      out.push(seat(x, row === 'B2' ? 24 : 16, 28, row === 'B2' ? 52 : 68, `${i}a`));
    }
  });
  return (
    <svg viewBox="0 0 190 100" aria-hidden="true">
      <rect
        x={4}
        y={6}
        width={182}
        height={88}
        rx={30}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        opacity={0.4}
      />
      <path d="M172 30 Q182 50 172 70" fill="none" stroke="currentColor" strokeWidth={2} opacity={0.4} />
      {out}
    </svg>
  );
}
