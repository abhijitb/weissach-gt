import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DEFAULT_CAR_CONFIG } from './CarConfig.js';

// Scratch objects reused every frame by syncVisual().
const _chassisPos = new THREE.Vector3();
const _invChassisQuat = new THREE.Quaternion();

const FORWARD_LOCAL = new CANNON.Vec3(0, 0, 1);
const _forward = new CANNON.Vec3();

// Below this speed (m/s) the car counts as stopped, so brake can select reverse.
const ROLLING_EPS = 0.6;

export class Car {
  constructor(world, config = {}) {
    this.world = world;
    this.config = { ...DEFAULT_CAR_CONFIG, ...config };

    this.steerAngle = 0;
    this.engineForce = 0;
    this.brakeForce = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.isReversing = false;

    this._createChassis();
    this._createVehicle();
    this._addWheels();
    this._createVisual();
  }

  _createChassis() {
    const { mass, chassisWidth, chassisHeight, chassisLength } = this.config;

    const shape = new CANNON.Box(
      new CANNON.Vec3(chassisWidth / 2, chassisHeight / 2, chassisLength / 2)
    );

    this.chassisBody = new CANNON.Body({ mass, shape });
    this.chassisBody.position.set(0, 1.2, 0);
    this.chassisBody.linearDamping = 0.05;
    this.chassisBody.angularDamping = 0.3;
    // RaycastVehicle drives the chassis with impulses, which do not wake a
    // sleeping body — letting it sleep at a standstill would strand the car.
    this.chassisBody.allowSleep = false;

    this.world.addBody(this.chassisBody);
  }

  _createVehicle() {
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });
  }

  _addWheels() {
    const {
      wheelRadius,
      suspensionStiffness,
      suspensionDamping,
      suspensionRestLength,
      maxSuspensionTravel,
      frictionSlip,
      rollInfluence,
    } = this.config;

    const positions = this.config.wheelPositions;
    // All four wheels share one axle direction. With indexUpAxis = 1 and
    // indexForwardAxis = 2, cannon derives forward as up x axle, so the axle has
    // to point along -x for forward to come out as +z. Mirroring it per side
    // would make the wheels on one side spin backwards visually.
    const wheels = [
      { pos: positions.frontLeft, isFront: true },
      { pos: positions.frontRight, isFront: true },
      { pos: positions.rearLeft, isFront: false },
      { pos: positions.rearRight, isFront: false },
    ];

    for (const wheel of wheels) {
      this.vehicle.addWheel({
        radius: wheelRadius,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness,
        suspensionDamping,
        suspensionRestLength,
        maxSuspensionTravel,
        frictionSlip,
        rollInfluence,
        axleLocal: new CANNON.Vec3(-1, 0, 0),
        chassisConnectionPointLocal: new CANNON.Vec3(wheel.pos.x, wheel.pos.y, wheel.pos.z),
        isFrontWheel: wheel.isFront,
      });
    }

    this.vehicle.addToWorld(this.world);
  }

  _createVisual() {
    const { chassisWidth, chassisHeight, chassisLength, wheelRadius } = this.config;

    this.mesh = new THREE.Group();
    const W = chassisWidth;
    const H = chassisHeight;
    const L = chassisLength;

    const paintColor = this.config.color || 0xc41e3a;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: paintColor,
      roughness: 0.15,
      metalness: 0.85,
      envMapIntensity: 1.2,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.05,
      metalness: 0.3,
      transparent: true,
      opacity: 0.65,
    });

    // Body is built centered on the physics chassis (y=0 = chassis center).
    // The side profile lives in the X-Y plane (x = length, y = height) and is
    // extruded along z (width), then rotated so the car's length runs along
    // world +z (front at +z, matching the physics forward axis).

    // --- Lower body ---
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-L * 0.5, -H * 0.5);
    bodyShape.lineTo(-L * 0.5, H * 0.1);
    bodyShape.quadraticCurveTo(-L * 0.46, H * 0.4, -L * 0.3, H * 0.42);
    bodyShape.lineTo(L * 0.22, H * 0.42);
    bodyShape.quadraticCurveTo(L * 0.42, H * 0.38, L * 0.5, H * 0.05);
    bodyShape.lineTo(L * 0.5, -H * 0.5);
    bodyShape.lineTo(-L * 0.5, -H * 0.5);

    // Narrower than the physics chassis, so the wheels sit proud of the
    // bodywork instead of being swallowed by it.
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: W * 0.88,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 4,
    });
    bodyGeo.center();
    bodyGeo.computeBoundingBox();
    // Measured off the built geometry (extrude depth becomes world x after the
    // rotation below, and the profile's height becomes world y).
    const bodyHalfWidth = bodyGeo.boundingBox.max.z;
    const bodyTopY = bodyGeo.boundingBox.max.y;

    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.rotation.y = -Math.PI / 2; // shape +x (front) -> world +z
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.mesh.add(bodyMesh);

    // --- Cabin / greenhouse ---
    const cabinShape = new THREE.Shape();
    cabinShape.moveTo(-L * 0.2, 0);
    cabinShape.lineTo(-L * 0.16, H * 0.5);
    cabinShape.quadraticCurveTo(-L * 0.06, H * 0.62, L * 0.06, H * 0.52);
    cabinShape.quadraticCurveTo(L * 0.18, H * 0.4, L * 0.2, 0);
    cabinShape.lineTo(-L * 0.2, 0);

    const cabinDepth = W * 0.7;
    const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
      depth: cabinDepth,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3,
    });
    // Centre across the width only. center() would also zero the profile's
    // vertical origin, sinking the greenhouse down into the body.
    cabinGeo.translate(0, 0, -cabinDepth / 2);

    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.rotation.y = -Math.PI / 2;
    cabinMesh.position.y = bodyTopY - 0.03; // sit on the body's shoulder line
    cabinMesh.position.z = -L * 0.03;
    cabinMesh.castShadow = true;
    this.mesh.add(cabinMesh);

    // --- Headlights (front at +z) ---
    const headlightGeo = new THREE.SphereGeometry(0.13, 12, 8);
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffcc,
      emissiveIntensity: 0.5,
      roughness: 0.1,
      metalness: 0.3,
    });
    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(headlightGeo, headlightMat);
      hl.position.set(side * W * 0.32, H * 0.15, L * 0.48);
      hl.scale.set(1, 0.7, 0.5);
      this.mesh.add(hl);
    }

    // --- Taillights (rear at -z) ---
    const taillightGeo = new THREE.BoxGeometry(0.22, 0.09, 0.05);
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xcc0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    for (const side of [-1, 1]) {
      const tl = new THREE.Mesh(taillightGeo, taillightMat);
      tl.position.set(side * W * 0.3, H * 0.15, -L * 0.49);
      this.mesh.add(tl);
    }

    // --- Bumpers ---
    const bumperGeo = new THREE.BoxGeometry(W * 0.88, H * 0.28, 0.1);
    const frontBumper = new THREE.Mesh(bumperGeo, darkMat);
    frontBumper.position.set(0, -H * 0.32, L * 0.48);
    this.mesh.add(frontBumper);
    const rearBumper = new THREE.Mesh(bumperGeo, darkMat);
    rearBumper.position.set(0, -H * 0.32, -L * 0.48);
    this.mesh.add(rearBumper);

    // --- Side skirts ---
    const skirtGeo = new THREE.BoxGeometry(0.07, H * 0.22, L * 0.68);
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 });
    for (const side of [-1, 1]) {
      const skirt = new THREE.Mesh(skirtGeo, skirtMat);
      skirt.position.set(side * bodyHalfWidth, -H * 0.4, 0);
      this.mesh.add(skirt);
    }

    // --- Wheel arches ---
    // Flares bridging the narrowed body out over each wheel.
    const { frontLeft, rearLeft } = this.config.wheelPositions;
    const archGeo = new THREE.BoxGeometry(0.3, H * 0.34, wheelRadius * 3);
    for (const side of [-1, 1]) {
      for (const wz of [frontLeft.z, rearLeft.z]) {
        const arch = new THREE.Mesh(archGeo, bodyMat);
        arch.position.set(side * (bodyHalfWidth + 0.06), -H * 0.22, wz);
        arch.castShadow = true;
        this.mesh.add(arch);
      }
    }

    // --- Side mirrors ---
    const mirrorGeo = new THREE.BoxGeometry(0.09, 0.07, 0.13);
    for (const side of [-1, 1]) {
      const mirror = new THREE.Mesh(mirrorGeo, bodyMat);
      mirror.position.set(side * (bodyHalfWidth + 0.08), bodyTopY - 0.06, L * 0.14);
      this.mesh.add(mirror);
    }

    // --- Rear spoiler ---
    const spoilerGeo = new THREE.BoxGeometry(W * 0.78, 0.04, 0.2);
    const spoilerMesh = new THREE.Mesh(spoilerGeo, bodyMat);
    spoilerMesh.position.set(0, bodyTopY, -L * 0.42);
    spoilerMesh.castShadow = true;
    this.mesh.add(spoilerMesh);

    // --- Wheels with rims ---
    this.wheelMeshes = [];
    const tireWidth = 0.26;
    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, tireWidth, 24);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85, metalness: 0.1 });
    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.62, wheelRadius * 0.62, tireWidth + 0.01, 12);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.9 });

    for (let i = 0; i < 4; i++) {
      const wheelGroup = new THREE.Group();

      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      // Spoke detail
      const spokeGeo = new THREE.BoxGeometry(tireWidth + 0.02, wheelRadius * 0.55, 0.035);
      for (let s = 0; s < 5; s++) {
        const angle = (s / 5) * Math.PI * 2;
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.position.y = Math.sin(angle) * wheelRadius * 0.28;
        spoke.position.z = Math.cos(angle) * wheelRadius * 0.28;
        spoke.rotation.x = angle;
        wheelGroup.add(spoke);
      }

      this.wheelMeshes.push(wheelGroup);
      this.mesh.add(wheelGroup);
    }
  }

  applyInput(dt, input) {
    const { maxEngineForce, maxBrakeForce, maxSteerAngle, steerSpeed } = this.config;

    let targetSteer = 0;
    if (input.isDown('steerLeft')) targetSteer = maxSteerAngle;
    if (input.isDown('steerRight')) targetSteer = -maxSteerAngle;

    const steerDelta = steerSpeed * dt;
    if (targetSteer > this.steerAngle) {
      this.steerAngle = Math.min(this.steerAngle + steerDelta, targetSteer);
    } else if (targetSteer < this.steerAngle) {
      this.steerAngle = Math.max(this.steerAngle - steerDelta, targetSteer);
    } else {
      this.steerAngle = this.steerAngle > 0
        ? Math.max(0, this.steerAngle - steerDelta)
        : Math.min(0, this.steerAngle + steerDelta);
    }

    // Speed along the car's own forward axis. Negative means rolling backwards,
    // which is what lets one key both brake and then select reverse.
    this.chassisBody.quaternion.vmult(FORWARD_LOCAL, _forward);
    const forwardSpeed = this.chassisBody.velocity.dot(_forward);
    this.forwardSpeed = forwardSpeed;

    const wantsForward = input.isDown('throttle');
    const wantsReverse = input.isDown('brake');

    this.engineForce = 0;
    this.brakeForce = 0;
    this.isReversing = false;

    if (wantsForward) {
      // Rolling backwards: throttle brakes to a stop before pulling away.
      if (forwardSpeed < -ROLLING_EPS) {
        this.brakeForce = maxBrakeForce;
      } else {
        this.engineForce = -maxEngineForce;
      }
    } else if (wantsReverse) {
      // Still moving forward: this is the brake. Once stopped, it is reverse.
      if (forwardSpeed > ROLLING_EPS) {
        this.brakeForce = maxBrakeForce;
      } else {
        this.isReversing = true;
        if (-forwardSpeed < this.config.maxReverseSpeed) {
          this.engineForce = this.config.maxReverseForce;
        }
      }
    }

    if (input.isDown('handbrake')) {
      this.brakeForce = maxBrakeForce * 2;
      this.engineForce = 0;
      this.isReversing = false;
    }

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.setBrake(this.brakeForce, i);
    }

    this.vehicle.applyEngineForce(this.engineForce, 2);
    this.vehicle.applyEngineForce(this.engineForce, 3);

    this.vehicle.setSteeringValue(this.steerAngle, 0);
    this.vehicle.setSteeringValue(this.steerAngle, 1);

    this.speed = Math.abs(forwardSpeed);
  }

  syncVisual() {
    const pos = this.chassisBody.position;
    const quat = this.chassisBody.quaternion;
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(quat.x, quat.y, quat.z, quat.w);

    // Wheel transforms come back in world space, but the wheel meshes hang off
    // this.mesh, which already carries the chassis rotation — so both the offset
    // and the orientation have to be brought back into chassis space first.
    _chassisPos.set(pos.x, pos.y, pos.z);
    _invChassisQuat.copy(this.mesh.quaternion).invert();

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const t = this.vehicle.wheelInfos[i].worldTransform;
      const wheelMesh = this.wheelMeshes[i];

      wheelMesh.position
        .set(t.position.x, t.position.y, t.position.z)
        .sub(_chassisPos)
        .applyQuaternion(_invChassisQuat);

      // Leaves steering + roll rotation relative to the chassis.
      wheelMesh.quaternion
        .set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w)
        .premultiply(_invChassisQuat);
    }
  }

  reset(position = { x: 0, y: 1.2, z: 0 }, angle = 0) {
    this.chassisBody.position.set(position.x, position.y, position.z);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.setFromEuler(0, angle, 0);
    this.chassisBody.wakeUp();
    this.steerAngle = 0;
    this.engineForce = 0;
    this.brakeForce = 0;

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.applyEngineForce(0, i);
      this.vehicle.setBrake(0, i);
      this.vehicle.setSteeringValue(0, i);
    }
  }
}
