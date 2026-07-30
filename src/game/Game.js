import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input.js';
import { Car } from './Car.js';
import { Track } from './Track.js';
import { Environment } from './Environment.js';
import { Race } from './Race.js';
import { Hud } from './Hud.js';
import { getTrack } from './tracks/index.js';
import { getTheme } from './Themes.js';

// Below this the car has left the corridor entirely — put it back on the line.
const FALL_LIMIT = -40;
// How long the car may sit flipped/stranded before it is put back.
const OVERTURN_RESET_SECONDS = 2.5;

const UP_LOCAL = new CANNON.Vec3(0, 1, 0);
const _worldUp = new CANNON.Vec3();

const CAMERA_MODES = {
  CHASE: 0,
  HOOD: 1,
  COCKPIT: 2,
  SIDE: 3,
};

export class Game {
  constructor({ trackId = 'alpenpass' } = {}) {
    this.trackId = trackId;
    this.isRunning = false;
    this.clock = new THREE.Clock();
    this.input = new Input();
    this.fixedTimeStep = 1 / 60;
    this.maxSubSteps = 3;
    this.accumulator = 0;
    this.cameraMode = CAMERA_MODES.CHASE;
    this.overturnedFor = 0;
  }

  init() {
    // Resolved first: the scene, fog and lighting all read from the theme.
    this.trackData = getTrack(this.trackId);
    this.theme = getTheme(this.trackData.theme);

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initPhysics();
    this._initTrack();
    this._initCar();
    this._bindEvents();

    this.isRunning = true;
    this.clock.start();
    window.__game = this; // DEBUG
    this.loop();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const app = document.getElementById('app');
    app.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(this.theme.fog.color, this.theme.fog.density);
    this.environment = new Environment(this.scene, this.theme);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.5,
      6000
    );
    this.camera.position.set(0, 6, 10);
    this.cameraTarget = new THREE.Vector3(0, 1, 0);
    this.cameraLookTarget = new THREE.Vector3(0, 1, -5);
  }

  _initLights() {
    const light = this.theme.light;

    this.ambientLight = new THREE.AmbientLight(light.ambient, light.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(light.sun, light.sunIntensity);
    // Offset from the car; the light and its target track the car each frame so
    // the shadow camera only has to cover the area we can actually see.
    this.sunOffset = new THREE.Vector3(90, 140, -170);
    this.sunLight.position.copy(this.sunOffset);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 4096;
    this.sunLight.shadow.mapSize.height = 4096;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 520;
    this.sunLight.shadow.camera.left = -110;
    this.sunLight.shadow.camera.right = 110;
    this.sunLight.shadow.camera.top = 110;
    this.sunLight.shadow.camera.bottom = -110;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(light.hemiSky, light.hemiGround, light.hemiIntensity);
    this.scene.add(this.hemiLight);

    // Warm fill light from opposite side
    const fillLight = new THREE.DirectionalLight(light.fill, light.fillIntensity);
    fillLight.position.set(-100, 50, 200);
    this.scene.add(fillLight);
  }

  _initTrack() {
    this.track = new Track(this.trackData);
    this.scene.add(this.track.mesh);

    // The corridor trimesh is the surface the wheel raycasts hit.
    this.trackBody = this.track.createColliderBody();
    this.world.addBody(this.trackBody);

    // Solid guardrails keep the car on the road, so respawning is only for
    // getting stuck or flipped.
    this.barrierBodies = this.track.createBarrierBodies();
    for (const body of this.barrierBodies) {
      this.world.addBody(body);
    }
  }

  _initCar() {
    this.car = new Car(this.world, { color: 0xc41e3a });
    this.scene.add(this.car.mesh);

    const start = this.track.getStartPosition();
    this.car.reset(start, start.angle);
    this.race = new Race(this.track);
    this.race.reset(this.car.chassisBody.position);
    this.hud = new Hud(this.track, this.race);
  }

  /**
   * Put the car back on the start line. Restarts the lap rather than the whole
   * session, so a spin does not wipe your best time.
   */
  _respawn() {
    const start = this.track.getStartPosition();
    this.car.reset(start, start.angle);
    this.overturnedFor = 0;
    if (this.race) this.race.restartLap(this.car.chassisBody.position);
  }

  /**
   * Recover from the only situations the guardrails cannot: flipped onto the
   * roof, or dropped off the track entirely.
   */
  _checkRecovery(dt) {
    const body = this.car.chassisBody;
    if (body.position.y < FALL_LIMIT) {
      this._respawn();
      return;
    }

    body.quaternion.vmult(UP_LOCAL, _worldUp);
    const stranded = _worldUp.y < 0.35 && body.velocity.length() < 1.5;
    this.overturnedFor = stranded ? this.overturnedFor + dt : 0;

    if (this.overturnedFor > OVERTURN_RESET_SECONDS) {
      this._respawn();
    }
  }

  _initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.81, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.defaultContactMaterial.restitution = 0.3;
    this.world.solver.iterations = 10;
    this.world.allowSleep = true;

    // No ground plane: the track supplies its own collision mesh in
    // _initTrack(). Anything that falls past the corridor edge respawns.
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _onRaceEvent(event) {
    if (this.hud) this.hud.onRaceEvent(event);
  }

  _updateSun() {
    const p = this.car.mesh.position;
    this.sunLight.target.position.copy(p);
    this.sunLight.position.copy(p).add(this.sunOffset);
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
    if (this.input.wasPressed('respawn')) {
      this._respawn();
    }
    this._checkRecovery(dt);

    this.accumulator += dt;

    while (this.accumulator >= this.fixedTimeStep) {
      this.car.applyInput(this.fixedTimeStep, this.input);
      this.world.step(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }

    const event = this.race.update(dt, this.car.chassisBody.position);
    if (event) this._onRaceEvent(event);

    this.car.syncVisual();
    this._updateCamera(dt);
    this._updateSun();
    this.environment.update(dt);
    this.hud.update(this.car);
    this.input.update();
    this.renderer.render(this.scene, this.camera);
  }
}
