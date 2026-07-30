import * as THREE from 'three';

// Road surface sits this far above the spline so decals can stack on top of it
// without z-fighting.
const ROAD_LIFT = 0.05;

// Half-width of the drivable/collidable corridor. The asphalt occupies the
// middle; beyond that it grades down into grass and then falls away.
const CORRIDOR_HALF_WIDTH = 40;

export class TrackBuilder {
  static buildCurve(waypoints) {
    return new THREE.CatmullRomCurve3(
      waypoints.map((wp) => new THREE.Vector3(wp.x, wp.y || 0, wp.z)),
      true,
      'catmullrom',
      0.5
    );
  }

  static buildRoadMesh(waypoints, width = 12, segments = 700) {
    const curve = this.buildCurve(waypoints);

    // Spaced (arc-length) points, so points[i] lines up with _getTangent at
    // i / segments. getPoints() would sample uniformly in the curve parameter
    // instead, putting every derived offset on the wrong part of the track.
    const points = curve.getSpacedPoints(segments);
    const positions = [];
    const indices = [];
    const uvs = [];

    const halfWidth = width / 2;

    for (let i = 0; i <= segments; i++) {
      const point = points[i];
      const perp = this._getPerp(this._getTangent(curve, i / segments));

      const left = point.clone().add(perp.clone().multiplyScalar(halfWidth));
      const right = point.clone().add(perp.clone().multiplyScalar(-halfWidth));

      positions.push(left.x, left.y + ROAD_LIFT, left.z);
      positions.push(right.x, right.y + ROAD_LIFT, right.z);

      const uvU = i / segments;
      uvs.push(0, uvU * 60);
      uvs.push(1, uvU * 60);
    }

    for (let i = 0; i < segments; i++) {
      const base = i * 2;
      // Wound so the face normals point up.
      indices.push(base, base + 2, base + 1);
      indices.push(base + 1, base + 2, base + 3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // Procedural asphalt texture
    const roadTexture = this._createAsphaltTexture();
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;

    const mat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;

    return { mesh, curve, points };
  }

  /**
   * The ground the car actually drives on: asphalt width at road height, then a
   * graded grass shoulder, then a drop-off. Returns geometry for the visible
   * verge (the asphalt span is left out, the road mesh covers it) plus the full
   * cross-section as raw arrays for a CANNON.Trimesh collider.
   */
  static buildCorridor(curve, roadWidth = 14, segments = 700) {
    const half = roadWidth / 2;
    // [lateral offset from the centreline, height relative to the road surface]
    const profile = [
      [-CORRIDOR_HALF_WIDTH, -8],
      [-18, -1.2],
      [-half, 0],
      [half, 0],
      [18, -1.2],
      [CORRIDOR_HALF_WIDTH, -8],
    ];
    const cols = profile.length;
    const asphaltColumn = 2; // the span between profile[2] and profile[3]

    const positions = [];
    const uvs = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = curve.getPointAt(t);
      const perp = this._getPerp(this._getTangent(curve, t));

      for (const [offset, drop] of profile) {
        positions.push(
          point.x + perp.x * offset,
          point.y + ROAD_LIFT + drop,
          point.z + perp.z * offset
        );
        uvs.push(offset / 14, t * segments * 0.05);
      }
    }

    // Wound so the face normals point up.
    const addQuad = (i, c, out) => {
      const a = i * cols + c;
      const b = a + cols;
      out.push(a, a + 1, b);
      out.push(a + 1, b + 1, b);
    };

    const colliderIndices = [];
    const vergeIndices = [];

    for (let i = 0; i < segments; i++) {
      for (let c = 0; c < cols - 1; c++) {
        addQuad(i, c, colliderIndices);
        if (c !== asphaltColumn) addQuad(i, c, vergeIndices);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(vergeIndices);
    geometry.computeVertexNormals();

    return { geometry, colliderVertices: positions, colliderIndices };
  }

  static _createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(0, 0, 256, 256);

    // Add noise/grain for asphalt feel
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const brightness = 70 + Math.random() * 60;
      ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.35)`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    // Subtle tire wear lines
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.25)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(80, 0);
    ctx.lineTo(80, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(176, 0);
    ctx.lineTo(176, 256);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  }

  static buildMarkings(curve, points, roadWidth = 12) {
    const group = new THREE.Group();
    const halfWidth = roadWidth / 2;
    const segments = points.length - 1;

    // Edge lines using a continuous strip (much more performant)
    const edgePositions = [];
    const edgeIndices = [];
    const edgeWidth = 0.18;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const perp = this._getPerp(this._getTangent(curve, i / segments));
      const y = pt.y + ROAD_LIFT + 0.01;

      // Left edge line
      const lBase = pt.clone().add(perp.clone().multiplyScalar(halfWidth - 0.3));
      edgePositions.push(
        lBase.x + perp.x * edgeWidth, y, lBase.z + perp.z * edgeWidth,
        lBase.x - perp.x * edgeWidth, y, lBase.z - perp.z * edgeWidth
      );

      // Right edge line
      const rBase = pt.clone().add(perp.clone().multiplyScalar(-halfWidth + 0.3));
      edgePositions.push(
        rBase.x + perp.x * edgeWidth, y, rBase.z + perp.z * edgeWidth,
        rBase.x - perp.x * edgeWidth, y, rBase.z - perp.z * edgeWidth
      );

      if (i < points.length - 1) {
        const base = i * 4;
        // Left strip
        edgeIndices.push(base, base + 1, base + 4);
        edgeIndices.push(base + 1, base + 5, base + 4);
        // Right strip
        edgeIndices.push(base + 2, base + 3, base + 6);
        edgeIndices.push(base + 3, base + 7, base + 6);
      }
    }

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    edgeGeo.setIndex(edgeIndices);
    edgeGeo.computeVertexNormals();

    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    group.add(edgeMesh);

    // Center dashes
    const dashLength = 3;
    const dashGap = 6;
    const dashGeo = new THREE.PlaneGeometry(0.12, dashLength);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xdddddd, side: THREE.DoubleSide });

    const totalLength = curve.getLength();
    let dist = 0;

    while (dist < totalLength) {
      const t = dist / totalLength;
      const pt = curve.getPointAt(t);
      const tangent = this._getTangent(curve, t);

      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(pt.x, pt.y + ROAD_LIFT + 0.01, pt.z);
      this._orient(dash, tangent);
      group.add(dash);

      dist += dashLength + dashGap;
    }

    // Red/white curb strips on tight corners
    this._buildCurbs(curve, roadWidth, group);

    return group;
  }

  static _buildCurbs(curve, roadWidth, group) {
    const halfWidth = roadWidth / 2;
    const curbWidth = 0.6;
    const segmentLength = 1.5;

    const redMat = new THREE.MeshBasicMaterial({ color: 0xcc2222, side: THREE.DoubleSide });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const curbGeo = new THREE.PlaneGeometry(curbWidth, segmentLength);

    const totalLength = curve.getLength();
    let dist = 0;
    let colorIndex = 0;

    while (dist < totalLength) {
      const t = dist / totalLength;
      const tNext = Math.min((dist + segmentLength) / totalLength, 1);

      // Check curvature at this point
      const tan1 = this._getTangent(curve, t);
      const tan2 = this._getTangent(curve, tNext);
      const curvature = tan1.angleTo(tan2);

      if (curvature > 0.012) {
        const pt = curve.getPointAt(t);
        const perp = this._getPerp(tan1);
        const mat = colorIndex % 2 === 0 ? redMat : whiteMat;

        for (const side of [-1, 1]) {
          const offset = side * (halfWidth + curbWidth * 0.3);
          const curb = new THREE.Mesh(curbGeo, mat);
          curb.position.set(
            pt.x + perp.x * offset,
            pt.y + ROAD_LIFT + 0.005,
            pt.z + perp.z * offset
          );
          this._orient(curb, tan1);
          group.add(curb);
        }
        colorIndex++;
      }

      dist += segmentLength;
    }
  }

  static buildStartLine(curve, points, roadWidth = 12) {
    const group = new THREE.Group();
    const startT = 0;
    const pt = curve.getPointAt(startT);
    const tangent = this._getTangent(curve, startT);
    const perp = this._getPerp(tangent);
    const y = pt.y + ROAD_LIFT + 0.02;

    const lineGeo = new THREE.PlaneGeometry(roadWidth - 1, 0.5);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(pt.x, y, pt.z);
    this._orient(line, tangent);
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
      checker.position.set(
        pt.x + perp.x * offset,
        y + 0.001,
        pt.z + perp.z * offset
      );
      this._orient(checker, tangent);
      group.add(checker);
    }

    return { group, position: pt, direction: tangent };
  }

  /**
   * Lay a plane (built in XY, normal +z) flat on the road surface, with its
   * local +y running along the track and its local +x across it.
   */
  static _orient(mesh, tangent) {
    const perp = this._getPerp(tangent);
    const normal = new THREE.Vector3().crossVectors(perp, tangent).normalize();
    mesh.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(perp, tangent.clone().normalize(), normal)
    );
  }

  /** Horizontal vector pointing across the track. */
  static _getPerp(tangent) {
    return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  }

  // Arc-length parameterised, matching getSpacedPoints/getPointAt.
  static _getTangent(curve, t) {
    return curve.getTangentAt(Math.min(Math.max(t, 0), 1));
  }

  static getTrackLength(curve) {
    return curve.getLength();
  }
}
