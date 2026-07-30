import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this._buildSky();
    this._buildSun();
    this._buildMountains();
    this._buildClouds();
  }

  _buildSky() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1a3a6b');
    gradient.addColorStop(0.2, '#3a6bb5');
    gradient.addColorStop(0.4, '#6ba3d6');
    gradient.addColorStop(0.6, '#a3cbe8');
    gradient.addColorStop(0.8, '#d4e8f5');
    gradient.addColorStop(1.0, '#e8f0f5');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;

    const skyGeo = new THREE.SphereGeometry(3200, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      fog: false,
    });

    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
  }

  _buildSun() {
    const sunGeo = new THREE.SphereGeometry(60, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfffde0,
      fog: false,
    });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.sun.position.set(900, 1400, -1900);
    this.scene.add(this.sun);

    const glowGeo = new THREE.SphereGeometry(100, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xfff8c0,
      transparent: true,
      opacity: 0.3,
      fog: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(this.sun.position);
    this.scene.add(glow);
  }

  _buildMountains() {
    const mountainGroup = new THREE.Group();

    const ranges = [
      { distance: 950, height: 320, color: 0x4a6741, count: 18, scale: 1.6 },
      { distance: 1250, height: 480, color: 0x5a7a5a, count: 15, scale: 2.1 },
      { distance: 1600, height: 700, color: 0x7a8a9a, count: 12, scale: 2.6 },
    ];

    for (const range of ranges) {
      for (let i = 0; i < range.count; i++) {
        const angle = (i / range.count) * Math.PI * 2 + Math.random() * 0.3;
        const dist = range.distance + Math.random() * 250;

        const baseWidth = 120 + Math.random() * 100;
        const height = range.height * (0.7 + Math.random() * 0.6);

        const geo = new THREE.ConeGeometry(baseWidth * range.scale, height, 6 + Math.floor(Math.random() * 3));
        const mat = new THREE.MeshStandardMaterial({
          color: range.color,
          roughness: 0.9,
          metalness: 0.0,
          flatShading: true,
        });

        const mountain = new THREE.Mesh(geo, mat);
        mountain.position.set(
          Math.cos(angle) * dist,
          height * 0.3,
          Math.sin(angle) * dist
        );
        mountain.rotation.y = Math.random() * Math.PI;

        // Snow caps on distant mountains
        if (range.distance >= 1250 && height > 400) {
          const snowGeo = new THREE.ConeGeometry(baseWidth * range.scale * 0.3, height * 0.25, 6);
          const snowMat = new THREE.MeshStandardMaterial({
            color: 0xf0f5ff,
            roughness: 0.6,
            flatShading: true,
          });
          const snow = new THREE.Mesh(snowGeo, snowMat);
          snow.position.y = height * 0.38;
          mountain.add(snow);
        }

        mountainGroup.add(mountain);
      }
    }

    this.scene.add(mountainGroup);
  }

  _buildClouds() {
    const cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      fog: false,
    });

    for (let i = 0; i < 32; i++) {
      const cloud = new THREE.Group();
      const puffCount = 3 + Math.floor(Math.random() * 4);

      for (let p = 0; p < puffCount; p++) {
        const size = 40 + Math.random() * 60;
        const puffGeo = new THREE.SphereGeometry(size, 8, 6);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 180,
          (Math.random() - 0.5) * 30,
          (Math.random() - 0.5) * 60
        );
        puff.scale.y = 0.4;
        cloud.add(puff);
      }

      const angle = Math.random() * Math.PI * 2;
      const dist = 900 + Math.random() * 1600;
      cloud.position.set(
        Math.cos(angle) * dist,
        620 + Math.random() * 500,
        Math.sin(angle) * dist
      );

      cloudGroup.add(cloud);
    }

    this.clouds = cloudGroup;
    this.scene.add(cloudGroup);
  }

  update(dt) {
    if (this.clouds) {
      this.clouds.rotation.y += dt * 0.002;
    }
  }
}
