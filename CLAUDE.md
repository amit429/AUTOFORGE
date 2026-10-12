# AutoForge — project memory for Claude Code

**AutoForge** is a design-your-own-car studio, not a brand or single-model site. Users pick a region and one of ten body styles, then customise paint, livery, graphics, wheels, bodywork, mods, lights, glass, seating layout, seats, trim, cabin details, ambient light and regional packs, seeing every change live in 3D with a local-currency price. Motion quality is a core requirement, not polish.

The docs in `docs/` and the prototype were written for an earlier single-model brief ("Halden Vesper GT"). Their behaviour, design system and architecture still apply; the branding does not. Never reintroduce brand or model names.

A complete working prototype exists: `reference/prototype.html` (single file, three.js r128 + GSAP). **It is the behavioural source of truth.** When unsure how something should look, move or behave, open it in a browser and read its code before inventing.

## Read before working
- `docs/PRD.md` — features, flows, rules, edge cases, acceptance criteria
- `docs/DESIGN_SYSTEM.md` — tokens, type, components, motion system
- `docs/3D_PIPELINE.md` — scene, model contract, materials, camera poses, explode offsets
- `docs/IMPLEMENTATION_PLAN.md` — phases and the order to build in
- `data/options.json` — every option, price, region and rule (extracted from the prototype)
- `reference/paint-shader.js` — the paint shader to port (sweep transition + 17 patterns)

## Stack (decided)
- Next.js (App Router) + TypeScript (strict), pnpm
- React Three Fiber + drei + three (current versions; use ColorManagement, not r128 encodings)
- @react-three/postprocessing for bloom / SMAA / AO
- Motion (formerly Framer Motion, import from `motion/react`) for UI: `layoutId` for shared selection markers, `AnimatePresence` for panel content, springs for pills/toggles
- GSAP + ScrollTrigger for the landing scroll story and 3D camera/part timelines
- Zustand for build state; engine logic is pure TS outside React
- Vitest for engine tests, Playwright for flow tests
- CSS: CSS variables from DESIGN_SYSTEM tokens + CSS modules (no Tailwind unless asked)

## Architecture rules
1. **The UI never decides validity.** All availability, prices, reasons and region swaps come from `src/engine/` (pure functions, unit tested). Components render engine output.
2. **One build state.** `src/store/build.ts` holds the build, history (undo stack with grouped "snapshot" entries) and current step/view. 3D reads the store; it never owns option state.
3. **3D parts map 1:1 to options.** Every customisable part is a named node (see model contract). Swapping the placeholder car for a real glTF must not change any UI code.
4. **Material changes are transitions, not swaps.** Paint/livery/seat/trim changes use the shader sweep; wheels spin-swap; roof/accents lift-swap-drop; spoiler rises. See motion table in DESIGN_SYSTEM.
5. **Camera is directed.** Each step has a camera pose; user drag always interrupts tweens immediately.
6. **Respect reduced motion** everywhere: sweeps become instant, camera cuts, scroll story becomes static.
7. Render loop pauses when the 3D stage is hidden (e.g. blueprint document route).

## Conventions
- Copy is sentence case, plain and specific. Every locked option has a one-sentence reason.
- Prices always shown in the region's currency via `Intl.NumberFormat`; "Included" for zero.
- No new colours outside tokens; the car's paint is the only saturated colour on screen.
- Keep components small; step panels live in `src/components/steps/`.

## Commands (once scaffolded)
- `pnpm dev` / `pnpm build` / `pnpm test` (Vitest) / `pnpm e2e` (Playwright) / `pnpm lint`

## Working style
- Before each phase, propose a short plan and the files you'll touch; then implement.
- After each phase: run tests and lint, run the dev server, and compare against the prototype.
- Don't delete `reference/`; it's the spec.
