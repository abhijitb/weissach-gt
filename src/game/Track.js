import * as THREE from 'three';
import { TrackBuilder } from './TrackBuilder.js';

export class Track {
  constructor(trackData) {
    this.data = trackData;
    this.mesh = new THREE.Group();

    this._buildRoad();
    this._buildMarkings();
    this._buildEnvironment();
    this._buildStartLine();
  }

  _buildRoad() {
    const { roadMesh, curve, points } = TrackBuilder.buildRoadMesh(
      this.data.waypoints,
      this.data.roadWidth
    );
    this.curve = curve;
    this.points = points;
    this.roadMesh = roadMesh;
    this.mesh.add(roadMesh);

    this.trackLength = TrackBuilder.getTrackLength(curve);
  }

  _buildMarkings() {
    const markings = TrackBuilder.buildMarkings(
      this.curve,
      this.points,
      this.data.roadWidth
    );
    this.mesh.add(markings);
  }

  _buildEnvironment() {
    const { waypoints } = this.data;

    const bounds = this._computeBounds();

    const grassGeo = new THREE.PlaneGeometry(bounds.w, bounds.h);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x3a7d3a,
      roughness: 0.9,
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(bounds.cx, -0.02, bounds.cz);
    grass.receiveShadow = true;
    this.mesh.add(grass);

    this._addTrees(bounds);
    this._addBarriers();
  }

  _computeBounds() {
    const { waypoints } = this.data;
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const wp of waypoints) {
      if (wp.x < minX) minX = wp.x;
      if (wp.x > maxX) maxX = wp.x;
      if (wp.z < minZ) minZ = wp.z;
      if (wp.z > maxZ) maxZ = wp.z;
    }

    const pad = 60;
    return {
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
      w: maxX - minX + pad * 2,
      h: maxZ - minZ + pad * 2,
    };
  }

  _addTrees(bounds) {
    const treeGroup = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.8 });
    const foliageGeo = new THREE.ConeGeometry(2, 5, 8);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.7 });

    const roadPoints = this.points;
    const count = roadPoints.length;
    const step = Math.max(1, Math.floor(count / 120));

    for (let i = 0; i < count; i += step) {
      if (Math.random() > 0.6) continue;

      const pt = roadPoints[i];
      const tangent = TrackBuilder._getTangent(this.curve, i / count);
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const offset = (Math.random() > 0.5 ? 1 : -1) * (this.data.roadWidth / 2 + 8 + Math.random() * 25);
      const treeX = pt.x + perp.x * offset;
      const treeZ = pt.z + perp.z * offset;

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(treeX, 2, treeZ);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.set(treeX, 5, treeZ);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      treeGroup.add(foliage);
    }

    this.mesh.add(treeGroup);
  }

  _addBarriers() {
    const barrierGroup = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.4 });
    const railGeo = new THREE.BoxGeometry(1.5, 0.1, 0.1);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    const count = this.points.length;
    const step = Math.max(1, Math.floor(count / 200));

    for (let i = 0; i < count; i += step) {
      const pt = this.points[i];
      const tangent = TrackBuilder._getTangent(this.curve, i / count);
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      for (const side of [-1, 1]) {
        const offset = side * (this.data.roadWidth / 2 + 1);
        const bx = pt.x + perp.x * offset;
        const bz = pt.z + perp.z * offset;

        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(bx, 0.4, bz);
        post.castShadow = true;
        barrierGroup.add(post);

        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(bx, 0.7, bz);
        rail.rotation.y = Math.atan2(tangent.z, tangent.x);
        rail.castShadow = true;
        barrierGroup.add(rail);
      }
    }

    this.mesh.add(barrierGroup);
  }

  _buildStartLine() {
    const { group, position, direction } = TrackBuilder.buildStartLine(
      this.curve,
      this.points,
      this.data.roadWidth
    );
    this.startLineGroup = group;
    this.mesh.add(group);

    this.startPosition = {
      x: position.x,
      y: 1.5,
      z: position.z + direction.z * 5,
      angle: Math.atan2(direction.x, direction.z),
    };
  }

  getStartPosition() {
    return this.startPosition || { x: 0, y: 1.5, z: 0, angle: 0 };
  }

  getStartDirection() {
    return TrackBuilder._getTangent(this.curve, 0);
  }

  getForwardDirection(carPosition) {
    const nearestT = this._findNearestT(carPosition);
    return TrackBuilder._getTangent(this.curve, nearestT);
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
