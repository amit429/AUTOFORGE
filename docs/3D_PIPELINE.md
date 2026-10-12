# 3D pipeline — Halden Atelier

## Two-stage model strategy
1. **Phase 1–2: placeholder car** ported from the prototype (`buildCar` code in `reference/prototype.html`: extruded body/door/glasshouse shapes, parts in car coordinates). It already follows the node contract below, so all UI and motion can be built and tested.
2. **Phase 3: real glTF** (licensed marketplace model or commissioned). Replace the placeholder behind the same `<Car/>` interface. Nothing else changes.

## Coordinate system
Car faces **+X**, up is **+Y**, the car's right side is **+Z**. Ground at y=0. Length ≈ 4.78 (x −2.36…2.42), width ≈ 1.98, height ≈ 1.40, wheelbase 2.86. Front wheels x=1.41, rear x=−1.45, z=±0.84, wheel centre y=0.37, tyre radius 0.37.
LHD steering z=−0.4, RHD z=+0.4.

## Model contract (node names)
`body`, `door_l`, `door_r`, `glass`, `roof`, `grille`, `splitter`, `diffuser`, `skirt_l`, `skirt_r`, `mirror_l`, `mirror_r` (pivot at mirror base, folds about Y), `spoiler/duck`, `spoiler/wing`, `head_l`, `head_r` (with `seg_N` light segments), `tail` (16 segments), `fog_l`, `fog_r`, `hitch`, `wheel_fl|fr|rl|rr` → `spin` (tyre, barrel, face_<design>) + `caliper` + `disc` (non-spinning), cabin: `seat_fl`, `seat_fr`, `seat_rear`, `dash`, `dash_trim`, `screen`, `console`, `carpet`, `card_l`, `card_r`, `steering`, ambient strips `amb_dash`, `amb_door_l`, `amb_door_r`.
Material slots: `paint_body` (body, doors, roof-when-body, accents-when-body), `paint_roof`, `accent`, `grille`, `glass`, `rim`, `caliper`, `tyre`, `leather_seat`, `leather_dash`, `trim`, `ambient`.
Requirement for real assets: body panels should be UV'd consistently OR patterns stay world/object-space procedural (preferred — shader already does this from position).

## Materials
- Car paint: MeshPhysicalMaterial (clearcoat) + injected shader (`reference/paint-shader.js`): uniforms uColA/uColB, uPatA/uPatB, uPCA/uPCB, uProg (sweep), uScale, uEdge (seam glow), uChroma/uChromaCol (view-angle colour shift). Body, doors and body-coloured roof share one uniform set so the sweep is continuous. Production: add a flake normal map and orange-peel clearcoat normal.
- Finish presets (roughness/metalness/clearcoat) in options.json `finishes`.
- Seats/dash/trim reuse the same shader with patterns 11–17; sweep range narrowed (seats −2.1…0.9, trim −0.7…0.8).
- Glass: physical, transparent, depthWrite off, opacity = 0.3 + (1 − vlt/100)·0.66; heat-shield and gold-thermal tints.
- **Environment:** use an equirectangular studio HDRI (drei `<Environment>`). Do NOT generate the env with PMREM.fromScene from emissive panels — in the prototype that produced black lighting on some GPUs; equirect worked.
- Postprocessing: bloom on emissive lights only, SMAA, subtle SSAO (or baked AO for the real model), ACES tone mapping.

## Explode offsets (multiply by e ∈ 0…1, per part)
roof (0,.95,0) · glass (0,.55,0) · door_l/r (0,0,±.6) · grille (.55,−.05,0) · splitter (.5,−.15,0) · diffuser (−.5,−.12,0) · skirts (0,−.1,±.4) · mirrors (.1,.2,±.5) · spoiler (−.3,.7,0) · head_l/r (.45,.05,±.05) · tail (−.45,.05,0) · wheels (0,0,±.75) · seats front (0,.45,0) · rear seat (−.15,.36,0) · dash (.2,.32,0) · console (0,.26,0) · carpet (0,.1,0) · door cards (0,.1,±.45) · steering (.05,.55,0)
Cutaway (cabin view): roof +1.45 y, −0.35 x, opacity → 0; glass opacity × (1 − .88·cut).

## Camera poses (spherical around target; r is multiplied by 1.28 and by max(1, 1.05/aspect))
| Pose | theta | phi | r | target |
|---|---|---|---|---|
| paint | .85 | 1.30 | 8.6 | (0,.6,0) |
| livery | .40 | .98 | 9.2 | (0,.5,0) |
| wheels | .20 | 1.42 | 4.4 | (1.2,.42,.6) |
| body | −.85 | 1.16 | 8.4 | (0,.6,0) |
| lights | 1.22 | 1.36 | 5.8 | (1.6,.62,0) |
| glass | .30 | 1.24 | 7.2 | (−.4,.9,0) |
| seats / cabin | .55 | .62 | 5.4 | (−.45,.85,0) |
| trim | −1.30 | .74 | 3.7 | (.15,.95,0) |
| ambient | .95 | .70 | 5.0 | (−.3,.85,0) |
| exploded | .72 | 1.06 | 13.6 | (0,.85,0) |
| summary | .90 | 1.36 | 9.8 | (0,.55,0) |
Framing offsets via `camera.setViewOffset`: config desktop ox −.11 oy .03; mobile ox 0 oy .21; summary ox .15; region ox −.22. Theta tweens take the shortest path.

## Landing scroll story keyframes (progress 0…5, smoothstep plateau .16–.84 per segment)
| k | theta | phi | r | ty | ox | explode | cut |
|---|---|---|---|---|---|---|---|
| 0 hero | .95 | 1.33 | 9.4 | .55 | .17 | 0 | 0 |
| 1 paint | .05 | 1.42 | 8.3 | .55 | −.17 | 0 | 0 |
| 2 explode | −.75 | 1.08 | 12.2 | .78 | .17 | 1 | 0 |
| 3 cabin | .45 | .66 | 6.4 | .80 | −.16 | 0 | 1 |
| 4 region | −2.3 | 1.30 | 9.0 | .55 | .17 | 0 | 0 |
| 5 final | −5.33 | 1.38 | 10.6 | .85 | 0 | 0 | 0 |
Chapter 1 cycles demo paints/liveries every 2.3 s while in view. Intro blends from (theta 2.5, phi 1.12, r 19) over 2.6 s.

## Blueprint 2D
Generated from the same Shape curves (body, door, glasshouse, roof) at 100 px/unit; plan view is a rounded outline; livery overlay is a canvas rendered with the JS port of the pattern function and clipped to the silhouette.

## Performance budget
≤ 300 draw calls (merge static cabin meshes; instance spokes), ≤ 18 MB assets desktop / 8 MB mobile, KTX2 textures, Draco/meshopt geometry, DPR capped at 2 with adaptive drop, shadows 2048 desktop / 1024 mobile, pause rendering when hidden.
