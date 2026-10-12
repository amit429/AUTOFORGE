import type { SVGProps } from 'react';

const S = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS = {
  arr: (
    <svg viewBox="0 0 16 16">
      <path d="M2 8h11M9 4l4 4-4 4" {...S} strokeWidth={1.6} />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 16 16">
      <path d="M14 8H3M7 4L3 8l4 4" {...S} strokeWidth={1.6} />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 16 16">
      <path d="M3 8.5l3.2 3L13 4.5" {...S} strokeWidth={2} />
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 20 20">
      <path d="M7 5L3 9l4 4M3.5 9H12a5 5 0 010 10h-2" {...S} strokeWidth={1.6} />
    </svg>
  ),
  shuffle: (
    <svg viewBox="0 0 20 20">
      <path
        d="M2 5h3.5c2 0 3.2 1 4.2 2.6l1.6 2.8c1 1.6 2.2 2.6 4.2 2.6H18M15 10.5L18 13l-3 2.5M2 15h3.5c1.4 0 2.4-.5 3.2-1.3M11.8 6.3C12.6 5.5 13.6 5 15 5h3M15 2.5L18 5l-3 2.5"
        {...S}
        strokeWidth={1.5}
      />
    </svg>
  ),
  lamp: (
    <svg viewBox="0 0 20 20">
      <path
        d="M3 10c0-3.3 2.8-5 6-5h1.5v10H9c-3.2 0-6-1.7-6-5zM13 6.5h4M13 10h5M13 13.5h4"
        {...S}
        strokeWidth={1.5}
      />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="3.5" {...S} strokeWidth={1.5} />
      <path
        d="M10 1.5v2.2M10 16.3v2.2M1.5 10h2.2M16.3 10h2.2M4 4l1.5 1.5M14.5 14.5L16 16M4 16l1.5-1.5M14.5 5.5L16 4"
        {...S}
        strokeWidth={1.5}
      />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 20 20">
      <path d="M16.5 12.5A7 7 0 017.5 3.5a7 7 0 109 9z" {...S} strokeWidth={1.5} />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 20 20">
      <path d="M10 3a7 7 0 107 7M10 3v4M17 10h-4M14.5 3.8l1.7 2.9-3.3.3" {...S} strokeWidth={1.5} />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 20 20">
      <path d="M10 18s6-5.3 6-10a6 6 0 00-12 0c0 4.7 6 10 6 10z" {...S} strokeWidth={1.5} />
      <circle cx="10" cy="8" r="2" fill="currentColor" />
    </svg>
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const el = ICONS[name];
  return <svg {...el.props} aria-hidden="true" width="1em" height="1em" {...rest} />;
}
