import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TrackBuilder } from './TrackBuilder.js';
import { getTheme } from './Themes.js';

const CORRIDOR_HALF_WIDTH = 40;
const CORRIDOR_EDGE_DROP = -8;
const ROAD_LIFT = 0.05;

// Guardrail collision band, measured up from the ground at the rail line. The
// bottom (CENTRE - HALF = 0.75) clears the wheel raycast origin, which sits
// around 0.55 above the road when the car is at rest.
const BARRIER_CENTRE_HEIGHT = 1.1;
const BARRIER_HALF_HEIGHT = 0.35;

// How far back down the track the car starts from the start/finish line.
const GRID_SETBACK = 8;

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class Track {
  constructor(trackData) {
    this.data = trackData;
    this.theme = getTheme(trackData.theme);
    this.mesh = new THREE.Group();
    this._centre = this._computeCentre();

    this._buildRoad();
    this._buildCorridor();
    this._buildMarkings();
    this._buildEnvironment();
    this._buildStartLine();
  }

  _buildRoad() {
    const { mesh: roadMesh, curve, points } = TrackBuilder.buildRoadMesh(
      this.data.waypoints,
      this.data.roadWidth
    );
    this.curve = curve;
    this.points = points;
    this.roadMesh = roadMesh;
    this.mesh.add(roadMesh);

    this.trackLength = TrackBuilder.getTrackLength(curve);
  }

  _buildCorridor() {
    const { geometry, colliderVertices, colliderIndices } = TrackBuilder.buildCorridor(
      this.curve,
      this.data.roadWidth
    );

    this.colliderVertices = colliderVertices;
    this.colliderIndices = colliderIndices;

    const grassTexture = this._createGrassTexture();
    grassTexture.repeat.set(1, 1);

    const verge = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        map: grassTexture,
        color: this.theme.verge,
        roughness: 0.95,
        metalness: 0.0,
      })
    );
    verge.receiveShadow = true;
    this.mesh.add(verge);
  }

  /**
   * Static collision body for the drivable corridor. The wheel raycasts hit
   * this, so it is what the car actually drives on.
   */
  createColliderBody() {
    const shape = new CANNON.Trimesh(this.colliderVertices, this.colliderIndices);
    return new CANNON.Body({ mass: 0, shape });
  }

  /**
   * Solid guardrails, as a chain of static boxes down each side.
   *
   * Two cannon-es constraints shape this. Box-vs-Trimesh narrowphase does not
   * exist, so the walls cannot be part of the corridor mesh — they have to be
   * convex bodies. And world.rayTest takes no collision filter, so the boxes
   * must sit entirely ABOVE where the wheel rays start, or the suspension would
   * read a barrier top as ground and the car would climb it.
   */
  createBarrierBodies(segmentLength = 10) {
    const offset = this.data.roadWidth / 2 + 0.8;
    const count = Math.max(4, Math.round(this.trackLength / segmentLength));
    const halfLen = (this.trackLength / count) * 0.52; // slight overlap on corners
    const shape = new CANNON.Box(new CANNON.Vec3(0.09, BARRIER_HALF_HEIGHT, halfLen));
    const bodies = [];

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const pt = this.curve.getPointAt(t);
      const tangent = TrackBuilder._getTangent(this.curve, t);
      const perp = TrackBuilder._getPerp(tangent);
      const yaw = Math.atan2(tangent.x, tangent.z);
      const y = pt.y + ROAD_LIFT + this._corridorDrop(offset) + BARRIER_CENTRE_HEIGHT;

      for (const side of [-1, 1]) {
        const body = new CANNON.Body({ mass: 0, shape });
        body.position.set(
          pt.x + perp.x * side * offset,
          y,
          pt.z + perp.z * side * offset
        );
        body.quaternion.setFromEuler(0, yaw, 0);
        // The AABB is cached on add, before the rotation above — refresh it or
        // SAPBroadphase reports stale bounds (same trap as the old ground plane).
        body.updateAABB();
        bodies.push(body);
      }
    }

    return bodies;
  }

  _buildMarkings() {
    const markings = TrackBuilder.buildMarkings(
      this.curve,
      this.points,
      this.data.roadWidth
    );
    this.mesh.add(markings);
  }

  // --- Ground sampling -----------------------------------------------------

  /** Nearest point on the road centreline: its position and lateral distance. */
  _nearestRoad(x, z) {
    let minDist2 = Infinity;
    let near = this.points[0];
    const pts = this.points;
    for (let i = 0; i < pts.length; i += 2) {
      const dx = x - pts[i].x;
      const dz = z - pts[i].z;
      const d2 = dx * dx + dz * dz;
      if (d2 < minDist2) {
        minDist2 = d2;
        near = pts[i];
      }
    }
    return { y: near.y, x: near.x, z: near.z, dist: Math.sqrt(minDist2) };
  }

  /** Centre of the circuit, used to tell inside-of-loop from outside. */
  _computeCentre() {
    let sx = 0, sz = 0;
    for (const wp of this.data.waypoints) {
      sx += wp.x;
      sz += wp.z;
    }
    return { x: sx / this.data.waypoints.length, z: sz / this.data.waypoints.length };
  }

  /** Height of the corridor cross-section at a given lateral distance. */
  _corridorDrop(dist) {
    const half = this.data.roadWidth / 2;
    if (dist <= half) return 0;
    if (dist <= 18) {
      return THREE.MathUtils.mapLinear(dist, half, 18, 0, -1.2);
    }
    if (dist <= CORRIDOR_HALF_WIDTH) {
      return THREE.MathUtils.mapLinear(dist, 18, CORRIDOR_HALF_WIDTH, -1.2, CORRIDOR_EDGE_DROP);
    }
    return CORRIDOR_EDGE_DROP;
  }

  /** Multi-scale ridges for the ground beyond the corridor. */
  _noise(x, z) {
    const [a, b, c] = this.theme.terrain.noise;
    return (
      Math.sin(x * 0.004 + 1.7) * Math.cos(z * 0.005 + 0.5) * a +
      Math.sin(x * 0.013) * Math.cos(z * 0.011) * b +
      Math.sin(x * 0.05) * Math.cos(z * 0.045) * c
    );
  }

  /** Ground height anywhere in the world, consistent for terrain and props. */
  _groundHeightAt(x, z) {
    const near = this._nearestRoad(x, z);
    const dist = near.dist;
    const base = near.y + ROAD_LIFT + this._corridorDrop(dist);

    // Sit just under the corridor mesh so the two surfaces never z-fight.
    if (dist <= CORRIDOR_HALF_WIDTH) return base - 0.6;

    const beyond = dist - CORRIDOR_HALF_WIDTH;
    const blend = Math.min(beyond / 60, 1);

    // The road is cut into a mountainside: ground on the inside of the loop
    // climbs into the massif, ground on the outside falls away to the valley.
    const c = this._centre;
    const inside =
      Math.hypot(x - c.x, z - c.z) < Math.hypot(near.x - c.x, near.z - c.z);
    const profile = inside ? this.theme.terrain.inside : this.theme.terrain.outside;
    const rise = beyond * profile.slope;
    const slope = profile.cap >= 0
      ? Math.min(rise, profile.cap)
      : -Math.min(rise, -profile.cap);

    return base - 0.6 * (1 - blend) + blend * (slope + this._noise(x, z));
  }

  /** Where a prop should stand: on the corridor if it is on it, else on terrain. */
  _propHeightAt(x, z, roadY, lateralDist) {
    return lateralDist <= CORRIDOR_HALF_WIDTH
      ? roadY + ROAD_LIFT + this._corridorDrop(lateralDist)
      : this._groundHeightAt(x, z);
  }

  // --- Environment ---------------------------------------------------------

  _buildEnvironment() {
    const bounds = this._computeBounds();

    const grassTexture = this._createGrassTexture();
    grassTexture.repeat.set(bounds.w / 25, bounds.h / 25);

    const segments = 170;
    const grassGeo = new THREE.PlaneGeometry(bounds.w, bounds.h, segments, segments);
    const posAttr = grassGeo.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      // Plane is centered at (bounds.cx, bounds.cz) and rotated flat:
      // local (x, y) maps to world (cx + x, cz - y).
      const wx = bounds.cx + posAttr.getX(i);
      const wz = bounds.cz - posAttr.getY(i);
      posAttr.setZ(i, this._groundHeightAt(wx, wz));
    }
    grassGeo.computeVertexNormals();

    const grass = new THREE.Mesh(
      grassGeo,
      new THREE.MeshStandardMaterial({
        map: grassTexture,
        color: this.theme.ground.color,
        roughness: 0.95,
        metalness: 0.0,
      })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(bounds.cx, 0, bounds.cz);
    grass.receiveShadow = true;
    this.mesh.add(grass);

    this._addSea(bounds);
    this._addTrees();
    this._addBarriers();
    this._addRocks();
    this._addBuildings();
  }

  /** Flat water plane for coastal themes, filling in below the cliff line. */
  _addSea(bounds) {
    const sea = this.theme.sea;
    if (!sea) return;

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(bounds.w * 1.6, bounds.h * 1.6),
      new THREE.MeshStandardMaterial({
        color: sea.color,
        roughness: 0.25,
        metalness: 0.35,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(bounds.cx, sea.level, bounds.cz);
    this.mesh.add(water);
  }

  _createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const { base, blade } = this.theme.ground;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);

    // Parsed by hand rather than through THREE.Color, which would convert the
    // hex out of sRGB and give us the wrong channel values for a canvas fill.
    const hex = parseInt(blade.slice(1), 16);
    const br = (hex >> 16) & 255;
    const bg = (hex >> 8) & 255;
    const bb = hex & 255;

    for (let i = 0; i < 5000; i++) {
      const shade = 0.7 + Math.random() * 0.6;
      ctx.fillStyle = `rgba(${Math.round(br * shade)}, ${Math.round(bg * shade)}, ${Math.round(bb * shade)}, 0.4)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 2 + Math.random() * 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  _computeBounds() {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const wp of this.data.waypoints) {
      if (wp.x < minX) minX = wp.x;
      if (wp.x > maxX) maxX = wp.x;
      if (wp.z < minZ) minZ = wp.z;
      if (wp.z > maxZ) maxZ = wp.z;
    }

    // Wide enough to run all the way out to the distant mountain range, so the
    // horizon is never a hard edge with sky showing underneath.
    const pad = 1100;
    return {
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
      w: maxX - minX + pad * 2,
      h: maxZ - minZ + pad * 2,
    };
  }

  /** Sample positions alongside the track, offset laterally from the centreline. */
  _scatter(count, minOffset, maxOffset) {
    const out = [];
    const pts = this.points;
    const segments = pts.length - 1;

    for (let n = 0; n < count; n++) {
      const i = Math.floor((n / count) * segments);
      const pt = pts[i];
      const tangent = TrackBuilder._getTangent(this.curve, i / segments);
      const perp = TrackBuilder._getPerp(tangent);

      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = minOffset + Math.random() * (maxOffset - minOffset);
      const x = pt.x + perp.x * side * offset;
      const z = pt.z + perp.z * side * offset;
      out.push({
        x,
        z,
        y: this._propHeightAt(x, z, pt.y, offset),
        yaw: Math.atan2(tangent.x, tangent.z),
        side,
      });
    }
    return out;
  }

  _addTrees() {
    const spec = this.theme.trees;
    if (!spec || !spec.count) return;

    const spots = this._scatter(spec.count, spec.minOffset, spec.maxOffset)
      .filter(() => Math.random() > 0.25);
    const split = Math.floor(spots.length * spec.coniferShare);
    const conifers = spots.slice(0, split);
    const broadleaf = spots.slice(split);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: false });
    const foliageTints = spec.tints;

    const add = (geo, mat, count, castShadow = true) => {
      const im = new THREE.InstancedMesh(geo, mat, count);
      im.castShadow = castShadow;
      im.receiveShadow = true;
      this.mesh.add(im);
      return im;
    };

    // --- Conifers: trunk + three stacked cones ---
    const cTrunk = add(new THREE.CylinderGeometry(0.2, 0.4, 5, 6), trunkMat, conifers.length);
    const cCone = add(new THREE.ConeGeometry(2.2, 3.5, 8), foliageMat.clone(), conifers.length * 3);

    conifers.forEach((s, i) => {
      const scale = 0.8 + Math.random() * 0.7;
      _dummy.position.set(s.x, s.y + 2.5 * scale, s.z);
      _dummy.rotation.set(0, Math.random() * Math.PI, 0);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      cTrunk.setMatrixAt(i, _dummy.matrix);

      const tint = foliageTints[Math.floor(Math.random() * foliageTints.length)];
      for (let layer = 0; layer < 3; layer++) {
        const layerScale = 1 - layer * 0.25;
        _dummy.position.set(s.x, s.y + (4 + layer * 2) * scale, s.z);
        _dummy.scale.set(scale * layerScale, scale * layerScale, scale * layerScale);
        _dummy.updateMatrix();
        cCone.setMatrixAt(i * 3 + layer, _dummy.matrix);
        cCone.setColorAt(i * 3 + layer, _color.setHex(tint));
      }
    });

    // --- Broadleaf: trunk + rounded crown ---
    const bTrunk = add(new THREE.CylinderGeometry(0.25, 0.45, 3.5, 6), trunkMat, broadleaf.length);
    const bCrown = add(new THREE.SphereGeometry(2.5, 8, 6), foliageMat.clone(), broadleaf.length);

    broadleaf.forEach((s, i) => {
      const scale = 0.8 + Math.random() * 0.6;
      _dummy.rotation.set(0, Math.random() * Math.PI, 0);
      _dummy.position.set(s.x, s.y + 1.75 * scale, s.z);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      bTrunk.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(s.x, s.y + 5 * scale, s.z);
      _dummy.scale.set(scale, scale * 0.8, scale);
      _dummy.updateMatrix();
      bCrown.setMatrixAt(i, _dummy.matrix);
      bCrown.setColorAt(i, _color.setHex(foliageTints[Math.floor(Math.random() * foliageTints.length)]));
    });

    for (const im of [cTrunk, cCone, bTrunk, bCrown]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  _addBarriers() {
    const half = this.data.roadWidth / 2;
    const offset = half + 0.8;
    const spacing = 2.0; // matches the rail segment length
    const count = Math.max(2, Math.floor(this.trackLength / spacing));
    const total = count * 2; // both sides

    const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.7 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 });

    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), postMat, total);
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.35, spacing * 1.02), railMat, total);
    posts.castShadow = true;
    rails.castShadow = true;

    let n = 0;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pt = this.curve.getPointAt(t);
      const tangent = TrackBuilder._getTangent(this.curve, t);
      const perp = TrackBuilder._getPerp(tangent);
      const yaw = Math.atan2(tangent.x, tangent.z);
      const baseY = pt.y + ROAD_LIFT + this._corridorDrop(offset);

      for (const side of [-1, 1]) {
        const bx = pt.x + perp.x * side * offset;
        const bz = pt.z + perp.z * side * offset;

        _dummy.scale.setScalar(1);
        _dummy.rotation.set(0, yaw, 0);

        _dummy.position.set(bx, baseY + 0.6, bz);
        _dummy.updateMatrix();
        posts.setMatrixAt(n, _dummy.matrix);

        _dummy.position.set(bx, baseY + BARRIER_CENTRE_HEIGHT - 0.1, bz);
        _dummy.updateMatrix();
        rails.setMatrixAt(n, _dummy.matrix);
        n++;
      }
    }

    posts.instanceMatrix.needsUpdate = true;
    rails.instanceMatrix.needsUpdate = true;
    this.mesh.add(posts, rails);
  }

  _addRocks() {
    const spec = this.theme.rocks;
    if (!spec || !spec.count) return;

    const spots = this._scatter(spec.count, spec.minOffset, spec.maxOffset)
      .filter(() => Math.random() > 0.4);
    if (!spots.length) return;
    const mat = new THREE.MeshStandardMaterial({ color: 0x6f6f68, roughness: 0.9, flatShading: true });
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat, spots.length);
    rocks.castShadow = true;
    rocks.receiveShadow = true;

    spots.forEach((s, i) => {
      const size = 0.3 + Math.random() * 1.4;
      _dummy.position.set(s.x, s.y + size * 0.4, s.z);
      _dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      _dummy.scale.set(size, size * (0.6 + Math.random() * 0.4), size);
      _dummy.updateMatrix();
      rocks.setMatrixAt(i, _dummy.matrix);
      rocks.setColorAt(i, _color.setHex(Math.random() > 0.5 ? 0x6a6a6a : 0x7a7a70));
    });

    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    this.mesh.add(rocks);
  }

  /**
   * Roadside structures: a scaled box for the walls plus a four-sided cone,
   * turned 45 degrees, for a hipped roof. Both instanced, so a street's worth
   * of buildings costs two draw calls.
   */
  _addBuildings() {
    const spec = this.theme.buildings;
    if (!spec || !spec.count) return;

    const spots = this._scatter(spec.count, spec.minOffset, spec.maxOffset);
    if (!spots.length) return;

    const walls = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0 }),
      spots.length
    );
    const roofs = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.72, 1, 4),
      new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.0 }),
      spots.length
    );
    for (const im of [walls, roofs]) {
      im.castShadow = true;
      im.receiveShadow = true;
    }

    const pick = (range) => range[0] + Math.random() * (range[1] - range[0]);
    const tint = (list) => list[Math.floor(Math.random() * list.length)];

    spots.forEach((s, i) => {
      const w = pick(spec.width);
      const d = pick(spec.depth);
      const h = pick(spec.height);
      const roofHeight = pick(spec.roofHeight);
      // Sink slightly so the base never floats over uneven ground.
      const baseY = s.y - 0.4;

      _dummy.rotation.set(0, s.yaw, 0);
      _dummy.position.set(s.x, baseY + h / 2, s.z);
      _dummy.scale.set(w, h, d);
      _dummy.updateMatrix();
      walls.setMatrixAt(i, _dummy.matrix);
      walls.setColorAt(i, _color.setHex(tint(spec.wallTints)));

      // The cone's square base sits diagonally in local space, so turn it 45
      // degrees to line the eaves up with the walls. Kept square (mean of w/d)
      // because scale is applied before that rotation and would otherwise skew.
      const span = ((w + d) / 2) * 1.05;
      _dummy.rotation.set(0, s.yaw + Math.PI / 4, 0);
      _dummy.position.set(s.x, baseY + h + roofHeight / 2, s.z);
      _dummy.scale.set(span, roofHeight, span);
      _dummy.updateMatrix();
      roofs.setMatrixAt(i, _dummy.matrix);
      roofs.setColorAt(i, _color.setHex(tint(spec.roofTints)));
    });

    for (const im of [walls, roofs]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    this.mesh.add(walls, roofs);
  }

  _buildStartLine() {
    const { group, position, direction } = TrackBuilder.buildStartLine(
      this.curve,
      this.points,
      this.data.roadWidth
    );
    this.startLineGroup = group;
    this.mesh.add(group);
    this.startLinePosition = position;
    this.startLineDirection = direction;

    // Grid slot sits back down the track from the line, so the first crossing
    // of start/finish completes a lap instead of beginning one. Sampled off the
    // curve rather than offset in a straight line, so it picks up the road's
    // elevation and heading at that point.
    const gridT = 1 - GRID_SETBACK / this.trackLength;
    const gridPoint = this.curve.getPointAt(gridT);
    const gridTangent = TrackBuilder._getTangent(this.curve, gridT);

    this.startPosition = {
      x: gridPoint.x,
      y: gridPoint.y + ROAD_LIFT + 1.0,
      z: gridPoint.z,
      angle: Math.atan2(gridTangent.x, gridTangent.z),
    };
  }

  getStartPosition() {
    return this.startPosition || { x: 0, y: 1.5, z: 0, angle: 0 };
  }

  getStartDirection() {
    return TrackBuilder._getTangent(this.curve, 0);
  }

  getForwardDirection(carPosition) {
    return TrackBuilder._getTangent(this.curve, this._findNearestT(carPosition));
  }

  _findNearestT(carPosition) {
    let minDist = Infinity;
    let bestT = 0;

    for (let i = 0; i < this.points.length; i++) {
      const pt = this.points[i];
      const dx = carPosition.x - pt.x;
      const dz = carPosition.z - pt.z;
      const dist = dx * dx + dz * dz;
      if (dist < minDist) {
        minDist = dist;
        bestT = i / Math.max(this.points.length - 1, 1);
      }
    }

    return bestT;
  }
}
