import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input.js';
import { Car } from './Car.js';

const CAMERA_MODES = {
  CHASE: 0,
  HOOD: 1,
  COCKPIT: 2,
  SIDE: 3,
};

export class Game {
  constructor() {
    this.isRunning = false;
    this.clock = new THREE.Clock();
    this.input = new Input();
    this.fixedTimeStep = 1 / 60;
    this.maxSubSteps = 3;
    this.accumulator = 0;
    this.cameraMode = CAMERA_MODES.CHASE;
  }

  init() {
    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initGround();
    this._initPhysics();
    this._initCar();
    this._bindEvents();

    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    const app = document.getElementById('app');
    app.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 200, 800);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.5,
      1000
    );
    this.camera.position.set(0, 6, 10);
    this.cameraTarget = new THREE.Vector3(0, 1, 0);
    this.cameraLookTarget = new THREE.Vector3(0, 1, -5);
  }

  _initLights() {
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(100, 150, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4);
    this.scene.add(this.hemiLight);
  }

  _initGround() {
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3a7d3a,
      roughness: 0.9,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  _initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.81, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial = new CANNON.ContactMaterial(
      this.world.defaultContactMaterial,
      this.world.defaultContactMaterial,
      { friction: 0.5, restitution: 0.3 }
    );
    this.world.solver.iterations = 10;
    this.world.allowSleep = true;

    const groundShape = new CANNON.Plane();
    this.groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.groundBody);
  }

  _initCar() {
    this.car = new Car(this.world, { color: 0xc41e3a });
    this.scene.add(this.car.mesh);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _toggleCamera() {
    this.cameraMode = (this.cameraMode + 1) % 4;
  }

  _updateCamera(dt) {
    if (!this.car) return;

    const carPos = this.car.chassisBody.position;
    const carQuat = this.car.chassisBody.quaternion;
    const carQ = new THREE.Quaternion(carQuat.x, carQuat.y, carQuat.z, carQuat.w);

    const targetPos = new THREE.Vector3(carPos.x, carPos.y, carPos.z);
    this.cameraTarget.lerp(targetPos, 8 * dt);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(carQ);

    let desiredPos;
    let lookAtTarget;

    switch (this.cameraMode) {
      case CAMERA_MODES.CHASE:
        desiredPos = this.cameraTarget.clone()
          .add(new THREE.Vector3(0, 4, 0))
          .add(forward.clone().multiplyScalar(-10));
        lookAtTarget = this.cameraTarget.clone().add(forward.clone().multiplyScalar(8));
        break;

      case CAMERA_MODES.HOOD:
        desiredPos = targetPos.clone()
          .add(new THREE.Vector3(0, 1.0, 0))
          .add(forward.clone().multiplyScalar(1.5));
        lookAtTarget = targetPos.clone().add(forward.clone().multiplyScalar(20));
        break;

      case CAMERA_MODES.COCKPIT:
        desiredPos = targetPos.clone()
          .add(new THREE.Vector3(0, 0.9, 0))
          .add(forward.clone().multiplyScalar(0.5));
        lookAtTarget = targetPos.clone().add(forward.clone().multiplyScalar(20));
        break;

      case CAMERA_MODES.SIDE: {
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(carQ);
        desiredPos = targetPos.clone()
          .add(right.clone().multiplyScalar(8))
          .add(new THREE.Vector3(0, 2, 0));
        lookAtTarget = targetPos;
        break;
      }
    }

    this.camera.position.lerp(desiredPos, 5 * dt);
    this.cameraLookTarget.lerp(lookAtTarget, 8 * dt);
    this.camera.lookAt(this.cameraLookTarget);
  }

  loop() {
    if (!this.isRunning) return;
    requestAnimationFrame(() => this.loop());

    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.input.wasPressed('cameraToggle')) {
      this._toggleCamera();
    }

    this.accumulator += dt;

    while (this.accumulator >= this.fixedTimeStep) {
      this.car.applyInput(this.fixedTimeStep, this.input);
      this.world.step(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }

    this.car.syncVisual();
    this._updateCamera(dt);
    this.input.update();
    this.renderer.render(this.scene, this.camera);
  }
}
