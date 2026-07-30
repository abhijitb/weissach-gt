# Weissach GT — Implementation Plan

A Porsche-inspired 3D racing game built with web technologies, inspired by Need for Speed: Porsche Unleashed.

**Status as of 2026-07-30: phases 1 and 2 complete.**

Legend: ✅ done · 🟡 partial · ⬜ not started

---

## Tech Stack

- **Three.js** — 3D rendering engine
- **Cannon-es** — Physics engine
- **Vite 8** — Build tool and dev server
- **Vanilla JavaScript (ES Modules)**

---

## Phase 1: Core Engine (Foundation) — ✅ complete

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Project scaffolding — Vite + Three.js + Cannon-es setup | ✅ |
| 1.2 | 3D scene setup — camera, lighting, skybox, ground plane | ✅ |
| 1.3 | Car physics model — rigid body with 4 wheels, suspension, steering, acceleration, braking | ✅ |
| 1.4 | Basic car controller — keyboard input (WASD/arrows for throttle, brake, steer) | ✅ |
| 1.5 | Camera system — chase camera with smooth follow, orbit/drift compensation | ✅ |
| 1.6 | Simple track — flat procedural road with curves and elevation | ✅ |

**Notes**

- The infinite ground plane from 1.2 was replaced in phase 2 by a per-track collision mesh. Cannon caches a `Plane`'s world AABB when the shape is added, before the body is rotated flat — the stale bounds hid the ground from the wheel raycasts past `z = 0`. Any static body rotated after construction needs an explicit `updateAABB()`.
- 1.4 also covers reverse: brake decelerates while rolling forward and selects reverse once stopped, and throttle is symmetric out of reverse.
- Camera has four modes (chase / hood / cockpit / side), cycled with `C`.

## Phase 2: Track System — ✅ complete

| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Track definition format — waypoints, road width, elevation data | ✅ |
| 2.2 | Track mesh generation — extrude road surface along waypoints | ✅ |
| 2.3 | Track environments — terrain, trees, buildings, roadside objects | ✅ |
| 2.4 | 3 distinct tracks (Alps, Coastal/Normandy, Industrial/Monte Carlo) | ✅ |
| 2.5 | Checkpoint system — lap counting, finish line detection | ✅ |
| 2.6 | Minimap — track overview on HUD | ✅ |

**Tracks** — selected with `?track=<id>`

| Id | Name | Length | Road width | Theme |
|----|------|--------|-----------|-------|
| `alpenpass` | Alpenpass | 2191 m | 14 m | alpine — 0→72 m pass, chalets, snowcaps |
| `cotedalbatre` | Côte d'Albâtre | 2579 m | 13 m | coastal — clifftop, sea, farmhouses |
| `portofino` | Portofino | 1925 m | 11 m | urban — tight streets, 120 buildings |

**Notes**

- Waypoints are 3D (`{x, y, z}`); `y` is road-surface elevation.
- `TrackBuilder` sweeps a corridor cross-section along the spline — asphalt at road height grading out to a drop-off at ±40 m. That single mesh is both the visible verge and the `CANNON.Trimesh` the wheels raycast against, so the surface drawn and the surface driven can't drift apart.
- All scenery lives in `Themes.js`. Adding a location is a data change, not a code change.
- Lap validation uses **signed progress along the spline**, not line crossings — progress decrements in reverse, so shuffling over the start line cannot bank laps.
- Guardrails are solid (static boxes down each side). They must be boxes: cannon-es has no Box-vs-Trimesh narrowphase. They sit above the wheel raycast origin because `world.rayTest` takes no collision filter — otherwise the suspension reads a barrier top as ground and the car climbs its own guardrail.
- Falling off or flipping respawns you at the line; `R` respawns manually.

## Phase 3: Car Models and Handling — ⬜ next

| Task | Description | Status |
|------|-------------|--------|
| 3.1 | Generic car 3D model (procedural Three.js geometry) | 🟡 placeholder |
| 3.2 | Car stats config — speed, acceleration, handling, weight per car | 🟡 written, unused |
| 3.3 | 8 Porsche-inspired cars across 3 eras | ⬜ 6 defined |
| 3.4 | Car color variants and visual customization | ⬜ |

**Notes**

- 3.1: the current car is procedural extruded geometry. It reads as a coloured box at distance and is the biggest remaining gap against the reference. Open decision: keep building procedurally or introduce a glTF loading pipeline (the project currently loads no external assets at all).
- 3.2: `CARS` and `buildCarConfig()` exist in `CarConfig.js` but nothing calls them — `Game._initCar` still hardcodes `DEFAULT_CAR_CONFIG`. Wiring this in is small and unblocks per-car handling.
- Careful with brake tuning: cannon consumes `brake` as a per-wheel **impulse** while `engineForce` is a force multiplied by the timestep. They are not the same units (`brake ≈ force / 60` at 60 Hz). `buildCarConfig` derives brake from mass for this reason.

## Phase 4: Race Modes

| Task | Description | Status |
|------|-------------|--------|
| 4.1 | Time Trial — beat target time | ⬜ |
| 4.2 | Circuit Race — 3-lap race against AI | ⬜ |
| 4.3 | Point-to-Point Sprint — A-to-B race | ⬜ |
| 4.4 | AI opponent system — path-following with variable skill | ⬜ |
| 4.5 | Race HUD — speedometer, timer, position, lap counter | 🟡 |

**Notes**

- 4.5 is mostly delivered by the phase 2 HUD: speed, current/best lap, lap counter and drive/reverse indicator all exist. Only race **position** is missing, which needs 4.4.
- 4.3 needs a `closed` flag in the track data — the spline is currently hardcoded to a closed loop.

## Phase 5: Career Mode (Evolution Mode)

| Task | Description | Status |
|------|-------------|--------|
| 5.1 | Garage screen — view owned cars, stats | ⬜ |
| 5.2 | Car purchasing system — earn credits from races | ⬜ |
| 5.3 | Era progression — Classic > Golden > Modern | ⬜ |
| 5.4 | Race calendar — series of events per era | ⬜ |
| 5.5 | Car upgrades — engine, tires, suspension, brakes | ⬜ |

## Phase 6: UI and Polish

| Task | Description | Status |
|------|-------------|--------|
| 6.1 | Main menu — Start Career, Quick Race, Garage, Settings | ⬜ |
| 6.2 | Loading screen with track preview | ⬜ |
| 6.3 | Sound effects — engine, tire screech, collision (Web Audio API) | ⬜ |
| 6.4 | Particle effects — tire smoke, sparks, dust | ⬜ |
| 6.5 | Post-race results screen | ⬜ |
| 6.6 | Settings — graphics quality, controls, audio | ⬜ |

---

## Known gaps outside the plan

- **No top-speed limit.** The car will pull past 350 km/h. `CARS[].maxSpeed` is defined but unread, and there is no drag term.
- **No engine braking.** Off throttle the wheels roll completely free, so the car coasts away on gradients. Deliberate for now.
- **No terrain collision beyond the corridor.** The ±40 m corridor is the only drivable surface; distant hillsides are scenery.
- **Scenery is unseeded.** Trees, rocks and buildings use bare `Math.random()`, so layout differs on every load. Needs a seeded RNG before lap times or screenshots need to be reproducible.
- **`window.__game` debug hook** is still assigned in `Game.init()`.
- **No HMR teardown.** `main.js` constructs a `Game` at import time; Vite re-runs the module without disposing the old one, so an edit leaves two loops stepping one physics world. Hard refresh after edits, or add `import.meta.hot.dispose()` with a `Game.destroy()`.

---

## Development Order

```
Phase 1 (Core Engine) -> Phase 2 (Tracks) -> Phase 3 (Cars) -> Phase 4 (Racing) -> Phase 5 (Career) -> Phase 6 (Polish)
      ✅                       ✅                  next
```
