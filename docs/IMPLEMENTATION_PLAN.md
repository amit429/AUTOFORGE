# Implementation plan

Work phase by phase. At the start of each phase, plan in Plan Mode and confirm; at the end, run tests, lint and the dev server, and compare against `reference/prototype.html`.

## Phase 0 — Scaffold (½ day)
Next.js + TS strict + pnpm, ESLint/Prettier, Vitest, Playwright. Install three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, motion, gsap, zustand. Fonts via next/font (Michroma, Instrument Sans). `src/styles/tokens.css` from DESIGN_SYSTEM. Copy `data/options.json` to `src/data/`; generate TS types for it.
**Done when:** `pnpm dev` shows a themed blank page with working day/night toggle.

## Phase 1 — Engine (1 day)
`src/engine/`: `availability.ts`, `pricing.ts`, `regions.ts` (guess from time zone, apply region → swaps), `history.ts`, `serialize.ts` (URL + localStorage). Zustand store wraps the engine.
**Done when:** Vitest covers every rule in PRD (exclusives, tint, sizes, glass limit, autobahn wing, region swaps, rounding per currency, undo incl. grouped snapshots).

## Phase 2 — 3D stage with placeholder car (2 days)
`<Stage>` (Canvas, HDRI environment, lights, shadows, turntable ring, contact shadow), `<Car>` ported from prototype following the node contract, paint material factory porting `paint-shader.js`, `<CameraRig>` (poses, setViewOffset framing, drag/inertia/zoom, idle spin, shortest-path theta), explode + cutaway driven by store, light segments with sprite glow, ambient modes.
**Done when:** changing store values updates the car with the right transition for every option.

## Phase 3 — Configurator UI (2–3 days)
Layout (spine, panel, tape, view switcher, tools), all component primitives, 10 step panels, Motion `layoutId` markers, panel content transitions, odometer, history chips + undo, toasts, hotspots, exploded labels, blueprint SVG view, keyboard shortcuts, mobile bottom-sheet layout.
**Done when:** full build possible on desktop and mobile; Playwright flow test passes.

## Phase 4 — Landing, region, reveal (2 days)
Loader, hero, GSAP ScrollTrigger story (keyframes in 3D_PIPELINE), story cards, region picker with globe, region demo chips, page transitions (blinds + soft fade), reveal screen, copy build code, deep links.

## Phase 5 — Real car model (time depends on asset)
Source a licensed glTF; rename nodes to the contract; split option parts; author explode offsets; set up material slots; Draco/meshopt + KTX2 via gltf-transform; add flake normal map; bake AO. Swap behind `<Car>`.

## Phase 6 — Quality pass
Postprocessing, adaptive DPR, reduced-motion audit, accessibility audit (Lighthouse ≥ 95), performance budget check on a mid-range phone, Blueprint document page.
