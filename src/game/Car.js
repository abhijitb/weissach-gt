import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DEFAULT_CAR_CONFIG } from './CarConfig.js';

export class Car {
  constructor(world, config = {}) {
    this.world = world;
    this.config = { ...DEFAULT_CAR_CONFIG, ...config };

    this.steerAngle = 0;
    this.engineForce = 0;
    this.brakeForce = 0;
    this.speed = 0;

    this._createChassis();
    this._createVehicle();
    this._addWheels();
    this._createVisual();
  }

  _createChassis() {
    const { mass, chassisWidth, chassisHeight, chassisLength, centerOfMassOffset } = this.config;

    const shape = new CANNON.Box(
      new CANNON.Vec3(chassisWidth / 2, chassisHeight / 2, chassisLength / 2)
    );

    this.chassisBody = new CANNON.Body({ mass, shape });
    this.chassisBody.position.set(0, 2, 0);
    this.chassisBody.linearDamping = 0.1;
    this.chassisBody.angularDamping = 0.6;
    this.chassisBody.sleepSpeedLimit = 0.1;
    this.chassisBody.sleepTimeLimit = 1;

    const com = centerOfMassOffset;
    this.chassisBody.shapeOffsets[0].set(com.x, com.y, com.z);
    this.chassisBody.updateMassProperties();
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

    const options = {
      radius: wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness,
      suspensionDamping,
      suspensionRestLength,
      maxSuspensionTravel,
      frictionSlip,
      rollInfluence,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      isFrontWheel: true,
    };

    const positions = this.config.wheelPositions;
    const wheels = [
      { pos: positions.frontLeft, name: 'FL', isFront: true, axleX: -1 },
      { pos: positions.frontRight, name: 'FR', isFront: true, axleX: 1 },
      { pos: positions.rearLeft, name: 'RL', isFront: false, axleX: -1 },
      { pos: positions.rearRight, name: 'RR', isFront: false, axleX: 1 },
    ];

    this.wheelBodies = [];

    for (const wheel of wheels) {
      const opts = { ...options };
      opts.chassisConnectionPointLocal.set(wheel.pos.x, wheel.pos.y, wheel.pos.z);
      opts.isFrontWheel = wheel.isFront;
      opts.axleLocal = new CANNON.Vec3(wheel.axleX, 0, 0);

      this.vehicle.addWheel(opts);
    }

    this.vehicle.addToWorld(this.world);

    const wheelMat = new CANNON.Material('wheel');
    this.wheelBodies = this.vehicle.wheelInfos.map((info, i) => {
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(new CANNON.Cylinder(wheelRadius, wheelRadius, 0.2, 8), new CANNON.Vec3(0, 0, 0));
      body.material = wheelMat;
      return body;
    });

    const groundMat = this.world.defaultContactMaterial;
    const wheelGroundContact = new CANNON.ContactMaterial(wheelMat, groundMat, {
      friction: 0.9,
      restitution: 0.1,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
    });
    this.world.addContactMaterial(wheelGroundContact);
  }

  _createVisual() {
    const { chassisWidth, chassisHeight, chassisLength, wheelRadius } = this.config;

    this.mesh = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(chassisWidth, chassisHeight, chassisLength);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.config.color || 0xc41e3a,
      roughness: 0.3,
      metalness: 0.6,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = chassisHeight / 2 + wheelRadius;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.mesh.add(bodyMesh);

    const cabinGeo = new THREE.BoxGeometry(chassisWidth * 0.85, chassisHeight * 0.5, chassisLength * 0.4);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.7,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.y = chassisHeight + wheelRadius + chassisHeight * 0.25;
    cabinMesh.position.z = -chassisLength * 0.05;
    cabinMesh.castShadow = true;
    this.mesh.add(cabinMesh);

    this.wheelMeshes = [];
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.2, 16);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.7,
      metalness: 0.3,
    });

    for (let i = 0; i < 4; i++) {
      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wheelMesh.castShadow = true;
      wheelMesh.receiveShadow = true;
      this.wheelMeshes.push(wheelMesh);
      this.mesh.add(wheelMesh);
    }
  }

  update(dt, input) {
    const { maxEngineForce, maxBrakeForce, maxSteerAngle, steerSpeed } = this.config;

    let targetSteer = 0;
    if (input.isDown('steerLeft')) targetSteer = maxSteerAngle;
    if (input.isDown('steerRight')) targetSteer = -maxSteerAngle;

    const steerDelta = steerSpeed * dt;
    if (targetSteer > this.steerAngle) {
      this.steerAngle = Math.min(this.steerAngle + steerDelta, targetSteer);
    } else if (targetSteer < this.steerAngle) {
      this.steerAngle = Math.max(this.steerAngle - steerDelta, targetSteer);
    } else if (Math.abs(this.steerAngle) < steerDelta) {
      this.steerAngle = 0;
    } else {
      this.steerAngle -= Math.sign(this.steerAngle) * steerDelta;
    }

    this.engineForce = 0;
    this.brakeForce = 0;

    if (input.isDown('throttle')) {
      this.engineForce = -maxEngineForce;
    }
    if (input.isDown('brake')) {
      this.brakeForce = maxBrakeForce;
    }

    if (input.isDown('handbrake')) {
      this.brakeForce = maxBrakeForce * 2;
    }

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.setBrake(this.brakeForce, i);
    }

    this.vehicle.applyEngineForce(this.engineForce, 2);
    this.vehicle.applyEngineForce(this.engineForce, 3);

    this.vehicle.setSteeringValue(this.steerAngle, 0);
    this.vehicle.setSteeringValue(this.steerAngle, 1);

    const velocity = this.chassisBody.velocity;
    this.speed = velocity.length();

    this._syncVisual();
  }

  _syncVisual() {
    const pos = this.chassisBody.position;
    const quat = this.chassisBody.quaternion;
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(quat.x, quat.y, quat.z, quat.w);

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      const info = this.vehicle.wheelInfos[i];
      this.vehicle.updateWheelTransform(i);
      const t = info.worldTransform;
      const wheelMesh = this.wheelMeshes[i];
      wheelMesh.position.set(t.position.x, t.position.y, t.position.z);
      wheelMesh.quaternion.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w);
    }
  }

  reset(position = { x: 0, y: 2, z: 0 }) {
    this.chassisBody.position.set(position.x, position.y, position.z);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.set(0, 0, 0, 1);
    this.steerAngle = 0;
    this.engineForce = 0;
    this.brakeForce = 0;
  }
}
