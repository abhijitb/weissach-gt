import * as THREE from 'three';

export class TrackBuilder {
  static buildRoadMesh(waypoints, width = 12, segments = 500) {
    const curve = new THREE.CatmullRomCurve3(
      waypoints.map((wp) => new THREE.Vector3(wp.x, 0, wp.z)),
      true,
      'catmullrom',
      0.5
    );

    const points = curve.getPoints(segments);
    const positions = [];
    const indices = [];
    const uvs = [];

    const halfWidth = width / 2;

    for (let i = 0; i <= segments; i++) {
      const point = points[i];
      const tangent = this._getTangent(curve, i / segments);
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const left = point.clone().add(perp.clone().multiplyScalar(halfWidth));
      const right = point.clone().add(perp.clone().multiplyScalar(-halfWidth));

      positions.push(left.x, 0.05, left.z);
      positions.push(right.x, 0.05, right.z);

      const uvU = i / segments;
      uvs.push(0, uvU);
      uvs.push(1, uvU);
    }

    for (let i = 0; i < segments; i++) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;

    return { mesh, curve, points };
  }

  static buildMarkings(curve, points, roadWidth = 12, segments = 500) {
    const group = new THREE.Group();
    const halfWidth = roadWidth / 2;

    const edgeGeo = new THREE.PlaneGeometry(0.2, 2);
    const edgeMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    for (let i = 0; i < points.length; i++) {
      const tangent = this._getTangent(curve, i / Math.max(points.length - 1, 1));
      const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const leftEdge = points[i].clone().add(perp.clone().multiplyScalar(halfWidth - 0.05));
      const rightEdge = points[i].clone().add(perp.clone().multiplyScalar(-halfWidth + 0.05));

      const leftMark = new THREE.Mesh(edgeGeo, edgeMatWhite);
      leftMark.position.copy(leftEdge);
      leftMark.position.y = 0.06;
      leftMark.rotation.x = -Math.PI / 2;
      leftMark.rotation.z = Math.atan2(tangent.z, tangent.x);
      group.add(leftMark);

      const rightMark = new THREE.Mesh(edgeGeo, edgeMatWhite);
      rightMark.position.copy(rightEdge);
      rightMark.position.y = 0.06;
      rightMark.rotation.x = -Math.PI / 2;
      rightMark.rotation.z = Math.atan2(tangent.z, tangent.x);
      group.add(rightMark);
    }

    const dashLength = 3;
    const dashGap = 5;
    const dashGeo = new THREE.PlaneGeometry(0.15, dashLength);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    const totalLength = curve.getLength();
    let dist = 0;

    while (dist < totalLength) {
      const t = dist / totalLength;
      const pt = curve.getPointAt(t);
      const tan = this._getTangent(curve, t);

      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(pt.x, 0.06, pt.z);
      dash.rotation.x = -Math.PI / 2;
      dash.rotation.z = Math.atan2(tan.z, tan.x);
      group.add(dash);

      dist += dashLength + dashGap;
    }

    return group;
  }

  static buildStartLine(curve, points, roadWidth = 12) {
    const group = new THREE.Group();
    const startT = 0.98;
    const pt = curve.getPointAt(startT);
    const tangent = this._getTangent(curve, startT);
    const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const lineGeo = new THREE.PlaneGeometry(roadWidth - 1, 0.5);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.copy(pt);
    line.position.y = 0.07;
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.atan2(tangent.z, tangent.x);
    group.add(line);

    const checkerSize = roadWidth / 12;
    for (let c = 0; c < 6; c++) {
      const offset = (c - 2.5) * checkerSize * 2;
      const checkerGeo = new THREE.PlaneGeometry(checkerSize, 0.5);
      const checkerMat = new THREE.MeshBasicMaterial({
        color: c % 2 === 0 ? 0x000000 : 0xffffff,
        side: THREE.DoubleSide,
      });
      const checker = new THREE.Mesh(checkerGeo, checkerMat);
      checker.position.copy(pt.clone().add(perp.clone().multiplyScalar(offset)));
      checker.position.y = 0.071;
      checker.rotation.x = -Math.PI / 2;
      checker.rotation.z = Math.atan2(tangent.z, tangent.x);
      group.add(checker);
    }

    return { group, position: pt, direction: tangent };
  }

  static _getTangent(curve, t) {
    const delta = 0.001;
    const t0 = Math.max(0, t - delta);
    const t1 = Math.min(1, t + delta);
    const p0 = curve.getPointAt(t0);
    const p1 = curve.getPointAt(t1);
    return new THREE.Vector3().subVectors(p1, p0).normalize();
  }

  static getStartPosition(curve, roadWidth = 12) {
    const pt = curve.getPointAt(0);
    const tangent = this._getTangent(curve, 0);
    return {
      x: pt.x,
      y: 1.5,
      z: pt.z,
      angle: Math.atan2(tangent.x, tangent.z),
    };
  }

  static getTrackLength(curve) {
    return curve.getLength();
  }
}
