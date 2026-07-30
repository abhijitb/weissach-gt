# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Weissach GT — a Porsche-inspired 3D browser racing game (inspired by Need for Speed: Porsche Unleashed), built with Three.js + Cannon-es on Vite. Vanilla JS ES modules, no framework, no test/lint tooling configured yet.

## Commands

```
npm run dev       # start Vite dev server
npm run build      # production build
npm run preview    # preview production build
```

There is no test suite or linter configured in this repo yet.

## Architecture

The whole game lives under `src/game/`, driven by a single `Game` class (`src/game/Game.js`) that owns the Three.js scene/renderer, the Cannon-es physics world, and the fixed-timestep game loop. `src/main.js` just instantiates and inits `Game`.

Key relationships:

- **`Game`** — orchestrator. Sets up renderer/scene/camera/lights, creates the Cannon `World` (`_initPhysics`), builds the active `Track`, spawns the `Car` at the track's start position, and runs `loop()`. The loop decouples rendering from physics: it accumulates `dt` and steps physics at a fixed `1/60` timestep (with a capped sub-step count) while rendering runs at display refresh rate. Also owns the 4-mode chase/hood/cockpit/side camera (`CAMERA_MODES`), toggled via `Input`.
- **`Input`** — polls raw `KeyboardEvent.code` state behind a named-action map (`throttle`, `brake`, `steerLeft`, `steerRight`, `handbrake`, `cameraToggle`, `pause`). Use `isDown(action)` for held state and `wasPressed(action)` for single-frame edge triggers (cleared each frame via `update()`).
- **`Car`** — wraps a Cannon `RaycastVehicle` (4 raycast wheels on a box chassis) plus a procedurally-built Three.js mesh (extruded body/cabin shapes, wheels, lights — no external 3D models/assets are loaded anywhere in this project; everything is generated in code). Physics forward axis is +z; visual meshes are authored/rotated to match. `applyInput(dt, input)` reads `Input` state and drives steering/engine/brake each fixed step; `syncVisual()` copies the physics body transform onto the mesh each render frame and repositions wheel meshes from `vehicle.wheelInfos[i].worldTransform`.
- **`CarConfig`** — `DEFAULT_CAR_CONFIG` holds chassis/suspension/wheel physics tuning. `CARS` is a per-vehicle stat table (era, mass, engine force, top speed, steer angle, color) for the planned Porsche roster across classic/mid/modern eras. `buildCarConfig(carId)` merges a car's overrides onto the defaults and derives `maxBrakeForce` from `maxEngineForce`. Only `Car`'s inline default config is currently wired into `Game`; `buildCarConfig`/`CARS` are the intended path for car selection once that UI exists.
- **`Track`** — takes a track data object (waypoints, road width, laps) and builds the full scene group: road mesh + lane markings (via `TrackBuilder`), then procedural environment dressing (undulating textured terrain, trees, guardrail barriers, rocks) and a checkered start line. Track data lives per-track under `src/game/tracks/` (see `Alpenpass.js`) and is a plain object of `{x, z}` waypoints — `Game._initTrack` currently hardcodes `TRACKS.alpenpass`.
- **`TrackBuilder`** — static helpers with no per-instance state: turns a waypoint list into a closed `CatmullRomCurve3`, extrudes it into a road ribbon mesh with a canvas-generated asphalt texture, builds edge/dash/curb lane markings, and builds the checkered start line. `_getTangent` (finite-difference on the curve) is the shared primitive most other track math (perpendicular offsets for trees/barriers/curbs, start-line orientation) is built from.
- **`Environment`** — background dressing unrelated to the track itself: gradient sky dome, sun disc + glow, layered procedural mountain ranges, and drifting cloud puffs. Independent of `Track`; both are added to the same scene by `Game`.

Physics/visual convention to preserve when touching car or track code: forward is +z, up is +y, and wheel/chassis meshes are centered on the physics body origin — visual offsets should stay in that local space so `syncVisual()`'s direct position/quaternion copy remains correct.

No car selection, race modes, HUD, AI, or career/garage systems exist yet — the current state is Phase 1–2 of `docs/implementation-plan.md` (core engine + first track). Consult that file for the intended feature roadmap and build order before adding new systems.
