# Product spec — Halden Atelier

## Goal
Turn curiosity into a confident, shareable, buildable specification. Every visible part inside and out is customisable, previewed live in 3D, priced in local currency, and guaranteed legal and orderable in the user's region.

## Screens and routes
| Route | Screen | Notes |
|---|---|---|
| `/` | Landing | Loader, hero, 6-chapter scroll story driving the 3D camera (see 3D_PIPELINE story keyframes) |
| `/region` | Region picker | Suggested from device time zone; dotted globe rotates to hovered region; selecting repaints car in region's signature paint |
| `/build/[step]` | Configurator | 10 steps, 4 views, live price, history tape, hotspots |
| `/reveal` | Summary | Lights fade up, car turntable, itemised spec, commission number, copy build code |
| `/blueprint` | Design document | Research, flows, system docs (content in prototype's Blueprint tab) |
Deep links: build state serialised to URL (`?b=<base64>`) so builds are shareable and resumable. Autosave to localStorage.

## Configurator layout (desktop)
Left: step spine (numbered, grouped Exterior / Interior / Regional, completed checkmarks, shared-layout active marker). Top centre: view switcher (Studio, Exploded, Blueprint, Cabin). Right: options panel (header with step N of 10, title, description; scrolling body; Back / Next footer). Bottom: tape with change history chips, undo, odometer price, "Reveal my build". Tools: inspire (shuffle), lights toggle, reset camera.
Mobile: spine becomes a horizontal strip, panel a bottom sheet (~47vh), car framed in the top half, view switcher under the spine.

## Steps (ids from options.json `steps`)
1. **Paint** — finish (gloss, metallic, satin, matte, chroma flip), 10 core paints, 2 regional exclusives, paint-to-sample colour ring, 3 moods (apply several options at once as one history entry)
2. **Livery** — pattern cards with live previews in current paint; 6 core + regional pattern; pattern colour; scale slider
3. **Wheels and brakes** — 5 designs, 19–22", finish, caliper colour; sizes can be region-locked with reason
4. **Bodywork** — roof (body, black, carbon, panoramic glass), accent parts (mirrors, splitter, diffuser, skirts), rear aero (none, ducktail, wing), grille (honeycomb, slats, sealed)
5. **Lights** — signature (blade, quad, arc), lamp tint (selective yellow only EU/JP), play welcome sequence
6. **Glass** — side tint slider (light transmission %) with legal-limit marker; values below limit blocked with shake + toast
7. **Seats** — material (nappa, alcantara, knit, regional wool), colour, quilting (plain, diamond, hex, channels, perforated), stitching (matched or contrast)
8. **Cabin trim** — carbon, walnut, aluminium, piano black + regional (rosewood, hinoki, mother of pearl)
9. **Ambient light** — colour ring + presets, mode (static, breathe, flow), brightness
10. **Regional pack** — two market packs with toggles; region facts (drive side, currency, legal tint, delivery hub and weeks); change region

Steps 7–9 automatically switch to Cabin view (roof lifts away).

## Views
- **Studio** — orbit (drag, inertia, wheel zoom, clamped), idle auto-rotate after 8 s, hotspots on the car linking to steps (hidden when facing away)
- **Exploded** — every part flies out along its offset (staggered), labels with leader lines appear after; label click → that step
- **Blueprint** — 2D side elevation + plan, generated from the same section curves as the 3D model, strokes draw in, live fills, livery overlay, dimensions in mm, spec callouts
- **Cabin** — roof lifts and fades, glass fades, camera looks down into the cabin, interior light rises

## Rules engine (src/engine)
`evaluate(build, region) → { available: Record<optionKey, {ok, reason}>, price, lineItems, swaps }`
- Regional exclusives: option has `rg`; only orderable in that region. Reason: "X is exclusive to Y."
- Lamp tint `only: [...]` regions.
- Wheel sizes: `region.noSize[size]` gives the reason.
- Glass: `vlt >= region.vlt`.
- Packs: only the region's packs; `autobahn` includes the wing (wing price becomes 0).
- Region change: re-evaluate; replace invalid choices with defaults; return a list of human-readable swaps ("Saffron Dusk replaced with Halden Silver"); toasts show each; steering animates to the new drive side.
- Price: `(BASE + Σ option USD) × rate × tax`, rounded per currency. Line items for the reveal.
- History: each change pushes `{key, prev, next}`; moods/inspire/start-over push one grouped snapshot entry. Undo restores prev with the same transitions.

## Feedback patterns
Toasts (bottom centre, max 3, progress line, warn variant). Locked options stay focusable (`aria-disabled`), shake on press and explain. Price changes announced via a polite live region (the odometer itself is aria-hidden).

## Acceptance criteria (MVP)
- All 10 steps work with every option in options.json; prices match `evaluate()` exactly
- Region change mid-build produces correct swaps and toasts; drive side animates
- Undo works for single changes and grouped snapshots
- 60 fps on a recent laptop in Studio view; ≥30 fps on a mid-range phone
- Keyboard: all options reachable; Escape leaves non-studio views; Ctrl/Cmd+Z undoes
- Reduced-motion mode verified
- Lighthouse accessibility ≥ 95 on landing and configurator
