import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input.js';

export class Game {
  constructor() {
    this.isRunning = false;
    this.clock = new THREE.Clock();
    this.input = new Input();
    this.fixedTimeStep = 1 / 60;
    this.maxSubSteps = 3;
    this.accumulator = 0;
  }

  init() {
    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initGround();
    this._initPhysics();
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
    this.camera.position.set(0, 8, 15);
    this.camera.lookAt(0, 0, 0);
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
    this.world.defaultContactMaterial.restitution = 0.3;
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.solver.iterations = 10;
    this.world.allowSleep = true;

    const groundShape = new CANNON.Plane();
    this.groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.groundBody);
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  loop() {
    if (!this.isRunning) return;
    requestAnimationFrame(() => this.loop());

    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.accumulator += dt;

    while (this.accumulator >= this.fixedTimeStep) {
      this.world.step(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }

    this.input.update();
    this.renderer.render(this.scene, this.camera);
  }
}
