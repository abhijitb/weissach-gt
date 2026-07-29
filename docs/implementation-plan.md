# Weissach GT — Implementation Plan

A Porsche-inspired 3D racing game built with web technologies, inspired by Need for Speed: Porsche Unleashed.

---

## Tech Stack

- **Three.js** — 3D rendering engine
- **Cannon-es** — Physics engine
- **Vite** — Build tool and dev server
- **Vanilla JavaScript (ES Modules)**

---

## Phase 1: Core Engine (Foundation)

| Task | Description |
|------|-------------|
| 1.1 | Project scaffolding — Vite + Three.js + Cannon-es setup |
| 1.2 | 3D scene setup — camera, lighting, skybox, ground plane |
| 1.3 | Car physics model — rigid body with 4 wheels, suspension, steering, acceleration, braking |
| 1.4 | Basic car controller — keyboard input (WASD/arrows for throttle, brake, steer) |
| 1.5 | Camera system — chase camera with smooth follow, orbit/drift compensation |
| 1.6 | Simple track — flat procedural road with curves and elevation |

## Phase 2: Track System

| Task | Description |
|------|-------------|
| 2.1 | Track definition format — waypoints, road width, elevation data |
| 2.2 | Track mesh generation — extrude road surface along waypoints |
| 2.3 | Track environments — terrain, trees, buildings, roadside objects |
| 2.4 | 3 distinct tracks (Alps, Coastal/Normandy, Industrial/Monte Carlo) |
| 2.5 | Checkpoint system — lap counting, finish line detection |
| 2.6 | Minimap — track overview on HUD |

## Phase 3: Car Models and Handling

| Task | Description |
|------|-------------|
| 3.1 | Generic car 3D model (procedural Three.js geometry) |
| 3.2 | Car stats config — speed, acceleration, handling, weight per car |
| 3.3 | 8 Porsche-inspired cars across 3 eras |
| 3.4 | Car color variants and visual customization |

## Phase 4: Race Modes

| Task | Description |
|------|-------------|
| 4.1 | Time Trial — beat target time |
| 4.2 | Circuit Race — 3-lap race against AI |
| 4.3 | Point-to-Point Sprint — A-to-B race |
| 4.4 | AI opponent system — path-following with variable skill |
| 4.5 | Race HUD — speedometer, timer, position, lap counter |

## Phase 5: Career Mode (Evolution Mode)

| Task | Description |
|------|-------------|
| 5.1 | Garage screen — view owned cars, stats |
| 5.2 | Car purchasing system — earn credits from races |
| 5.3 | Era progression — Classic > Golden > Modern |
| 5.4 | Race calendar — series of events per era |
| 5.5 | Car upgrades — engine, tires, suspension, brakes |

## Phase 6: UI and Polish

| Task | Description |
|------|-------------|
| 6.1 | Main menu — Start Career, Quick Race, Garage, Settings |
| 6.2 | Loading screen with track preview |
| 6.3 | Sound effects — engine, tire screech, collision (Web Audio API) |
| 6.4 | Particle effects — tire smoke, sparks, dust |
| 6.5 | Post-race results screen |
| 6.6 | Settings — graphics quality, controls, audio |

---

## Development Order

```
Phase 1 (Core Engine) -> Phase 2 (Tracks) -> Phase 3 (Cars) -> Phase 4 (Racing) -> Phase 5 (Career) -> Phase 6 (Polish)
```
