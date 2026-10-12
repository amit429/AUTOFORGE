# Design system — Halden Atelier

Concept: where cars are actually designed — primer-grey paint booths, hand-carved clay models, tape drawings on white boards. The UI stays neutral so the car's paint is the only saturated colour. Two studio moods share one token set.

## Colour tokens
| Token | Day (light) | Night (dark) | Use |
|---|---|---|---|
| --bg | #D8DBDE | #161A20 | page / studio background |
| --bg-2 | #F0F1F2 | #232933 | studio floor glow |
| --ink | #14171C | #E5E7EA | text, primary buttons |
| --ink-2 | #535A64 | #A3AAB4 | secondary text |
| --ink-3 | #7C838D | #6D7581 | tertiary, numbers |
| --line / --line-2 | rgba(20,23,28,.13 / .26) | rgba(229,231,234,.11 / .24) | borders |
| --panel | rgba(240,241,242,.78) | rgba(25,29,36,.76) | translucent panels (blur 22px) |
| --clay | #9E7038 | #D3AB70 | selection, progress, brand accent |
| --datum | #2C4BDB | #8399FF | focus rings, dimensions, technical lines |
| --warn | #B4441C | #F07A4E | legal limits, locked reasons |
| --ok | #2E7D5B | #5BC197 | confirmations |
Theme: follows `prefers-color-scheme`, overridable via `data-theme` on `<html>`; toggle uses the View Transitions API when available.

## Type
- Display: **Michroma** (Google Fonts) — names, headings, numbers only. Letter-spacing −0.02 to −0.035em at large sizes.
- Body: **Instrument Sans** 400/500/600.
- Scale: major third from 16 → 12.8, 16, 20, 25, 31, 39, 49, 61; hero clamp(38px, 6.2vw, 92px).
- Sentence case everywhere. No all-caps eyebrows.

## Shape and space
4px grid; working steps 8, 12, 16, 24, 32. Radius by size: 4 tags, 10 cards, 22 panels, pill for controls.

## Components (see prototype for exact look)
Segmented control with sliding pill · Paint swatch (46px sphere-shaded disc, name, region dot, selection ring) · Pattern card (canvas preview using the same pattern math as the shader) · Wheel design card (SVG) · Colour ring (hue ring + lightness slider + preview core) · Range slider with fill and optional legal-limit marker · Toggle switch (spring) · Pack row · Odometer price (each digit rolls) · History chip · Toast · Step spine item · Hotspot (pulsing ring) · Exploded label (card + leader line) · Magnetic primary button (clay fill wipes up on hover) · Custom cursor (dot + ring that grows into a label: "Drag", "Start", "Reveal").

## Motion tokens
| Token | Value | Use |
|---|---|---|
| ease.arrive | expo.out / cubic-bezier(.22,1,.36,1) | elements entering, 420–800 ms |
| ease.camera | power3.inOut | camera moves, 900–1700 ms |
| ease.spring | Motion spring {stiffness 260, damping 30} (GSAP: elastic.out(1,.75)) | pills, rings, toggles |
| ease.leave | power2.in, 240 ms | exits (≈60% of entry) |
| sweep | power2.inOut, 1600 ms | paint/livery transition |
| stagger | 35–50 ms, cap total at 500 ms | lists, cards |

## Motion choreography (signature moments)
| Moment | Motion |
|---|---|
| Loader | Logo strokes draw, counter 0→100, screen splits top/bottom, hero words rise from masks, camera dollies in, welcome light sequence |
| Paint / livery / seat / trim change | Lit seam sweeps across the part, new state behind, old ahead (shader `uProg`) |
| Wheel design or size | Wheels spin up, shrink slightly, swap at full speed, spring back |
| Roof / accents | Part lifts, changes in the air, drops back (bounce / back.out) |
| Spoiler | Old one sinks into the body; new one rises with back.out |
| Exploded view | Parts fly out (staggered, random order), labels + leader lines after 1.1 s |
| Cabin view | Roof lifts and fades, glass fades, camera flies to a top-down cabin pose |
| Step change | Panel content blurs out (exit), new content staggers in with blur clear; title chars roll; camera flies to step pose |
| Selection | Shared-layout ring/pill moves between options; ripple + 10 particle burst in the swatch colour |
| Locked option | Shake + warn toast with reason |
| Drive side change | Steering wheel slides across the dash |
| Price | Odometer digits roll independently |
| Page transitions | Six vertical blinds wipe (cover → swap → reveal); region screen uses a soft fade |
| Reveal | Studio lights fade up from near-black, turntable spin, commission number decodes, welcome lights |

## Accessibility
Real buttons with names and prices in labels; radiogroups for option groups; `aria-disabled` + reason for locked items; polite live region for price; visible focus in --datum; reduced-motion handling for every signature motion.
