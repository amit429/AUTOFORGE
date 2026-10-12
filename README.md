# AutoForge

Design the car you want, part by part. AutoForge is not a brand's configurator: you pick one of ten body styles (sedan, hatchback, coupe, convertible, compact SUV, SUV, cruiser, pickup, MPV, supercar), then shape the paint, graphics, wheels, mods, seats and light. Every change animates on a live 3D car and is priced in local currency. The finished design gets a design ID and a scroll-through reveal.

The original handoff spec lives in `docs/`, `data/options.json` and `reference/prototype.html` (see `HANDOFF.md` and `CLAUDE.md`). It was written for a single fictional model, "Halden Vesper GT"; the product has since been rebranded and generalised as AutoForge.

## Commands

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build (every route prerenders statically)
pnpm test         # Vitest: rules engine and store
pnpm e2e          # Playwright: flow + accessibility, desktop, mobile, reduced motion
pnpm lint && pnpm typecheck
```

`pnpm e2e` builds and serves on port 3100. To run it against a dev server you already have running, set `E2E_URL=http://localhost:3000`.

## Routes

| Route | Screen |
|---|---|
| `/` | Loader, hero, six-chapter scroll story that drives the 3D camera |
| `/region` | Region picker with globe, suggested from the time zone |
| `/build/[step]?b=` | Studio: 15 steps from body style to regional pack, 4 views, live price, history and undo |
| `/reveal?b=` | Scroll-through reveal of the finished design, itemised spec, design ID, copyable link |
| `/blueprint` | Design document (the 3D stage stops rendering here) |

`?b=` carries the whole build, so links are shareable and resumable. Builds also autosave to localStorage.

## Architecture

- `src/engine/`: pure TypeScript rules engine. Handles availability with reasons, pricing and per-currency rounding, region swaps, undo history (multi-key patches) and build codes. The UI never decides what is valid.
- `src/store/`: Zustand stores. `build.ts` holds the build, history, step and view; `ui.ts` holds screen-level state; `toasts.ts` holds notifications.
- `src/three/`: the 3D layer. `car/CarModel.ts` is the placeholder car, built to the node contract in `docs/3D_PIPELINE.md`. `materials/paint.ts` is the paint shader, `camera.ts` the directed camera rig, and `director.ts` turns store changes into transitions.
- `src/components/`: React UI. Step panels are in `steps/`, and the configurator shell and controls are in `config/`.

## Not done yet

- **Phase 5 (real car model):** needs a licensed glTF. Swap it in behind `CarModel`, keeping the node names in `docs/3D_PIPELINE.md`; no UI code should need to change.
