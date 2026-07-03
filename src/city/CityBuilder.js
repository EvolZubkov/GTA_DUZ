import * as THREE from 'three';
import { CITYKIT } from '../config/assets.js';

const neonColors = [0x12f7ff, 0xff2bd6, 0x8cff5a, 0xffc857];

export class CityBuilder {
  constructor(scene, assets, collision) {
    this.scene = scene;
    this.assets = assets;
    this.collision = collision;
    this.objects = [];
  }

  async buildDowntown() {
    this.createGround();
    await this.createRoadGrid();
    await this.createBlocks();
    this.createFallbackDecor();
  }

  createGround() {
    const geo = new THREE.PlaneGeometry(220, 220);
    const mat = new THREE.MeshStandardMaterial({ color: 0x102f34, roughness: 0.86, metalness: 0.02 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  async placeModel(file, { x = 0, y = 0, z = 0, rotY = 0, scale = 1, collidable = false } = {}) {
    try {
      const obj = await this.assets.loadModel(file);
      obj.position.set(x, y, z);
      obj.rotation.y = rotY;
      obj.scale.setScalar(scale);
      this.scene.add(obj);
      this.objects.push(obj);
      if (collidable) this.collision.addStaticFromObject(obj, 0.12);
      return obj;
    } catch (error) {
      console.warn('Model load failed:', file, error);
      return null;
    }
  }

  async createRoadGrid() {
    const roads = [];
    for (let x = -72; x <= 72; x += 24) {
      roads.push(this.placeModel(CITYKIT.roads.road4, { x, z: 0, rotY: Math.PI / 2, scale: 1 }));
      roads.push(this.placeModel(CITYKIT.roads.road2, { x, z: -48, rotY: Math.PI / 2, scale: 1 }));
      roads.push(this.placeModel(CITYKIT.roads.road2, { x, z: 48, rotY: Math.PI / 2, scale: 1 }));
    }
    for (let z = -72; z <= 72; z += 24) {
      roads.push(this.placeModel(CITYKIT.roads.road4, { x: 0, z, rotY: 0, scale: 1 }));
      roads.push(this.placeModel(CITYKIT.roads.road2, { x: -48, z, rotY: 0, scale: 1 }));
      roads.push(this.placeModel(CITYKIT.roads.road2, { x: 48, z, rotY: 0, scale: 1 }));
    }
    for (const x of [-48, 0, 48]) {
      for (const z of [-48, 0, 48]) roads.push(this.placeModel(CITYKIT.roads.cross, { x, z, scale: 1 }));
    }
    await Promise.all(roads);
  }

  async createBlocks() {
    const placements = [
      [-68, -30, 0, 0], [-34, -30, 1, 0], [26, -30, 2, 0.02], [68, -30, 0, 0],
      [-68, 26, 2, 0], [-28, 30, 0, 0], [28, 28, 1, 0], [68, 28, 2, 0],
      [-70, 70, 1, 0], [-25, 72, 2, 0], [28, 72, 0, 0], [72, 72, 1, 0],
      [-70, -72, 0, 0], [-24, -72, 1, 0], [32, -72, 2, 0], [72, -72, 0, 0]
    ];

    for (const [x, z, type, rot] of placements) {
      const file = CITYKIT.buildings[type % CITYKIT.buildings.length];
      const obj = await this.placeModel(file, { x, z, rotY: rot, scale: 1, collidable: true });
      if (obj) this.addNeonSign(x, z, type);
    }

    for (const x of [-82, -58, -12, 12, 58, 82]) {
      await this.placeModel(CITYKIT.props.planter, { x, z: 12, scale: 1.1, collidable: true });
      await this.placeModel(CITYKIT.props.planter, { x, z: -12, scale: 1.1, collidable: true });
    }
  }

  addNeonSign(x, z, i) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(7, 2, 0.25),
      new THREE.MeshStandardMaterial({
        color: neonColors[i % neonColors.length],
        emissive: neonColors[i % neonColors.length],
        emissiveIntensity: 1.8,
        roughness: 0.2
      })
    );
    sign.position.set(x, 5.2, z + 4.2);
    this.scene.add(sign);
  }

  createFallbackDecor() {
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x22222c, roughness: 0.4 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffe7aa, emissive: 0xffd16a, emissiveIntensity: 1.6 });
    for (let i = -84; i <= 84; i += 14) {
      for (const z of [-8, 8, -56, 56]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), lampMat);
        pole.position.set(i, 2, z);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), lightMat);
        lamp.position.set(i, 4.1, z);
        this.scene.add(pole, lamp);
      }
    }
  }
}
