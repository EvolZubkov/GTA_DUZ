import * as THREE from 'three';
import { findSafeSpawn } from './spawn.js';
import { NPC_BASE } from '../config/npcs.js';
import { VEHICLE_BASE, VEHICLE_SCALE } from '../config/vehicles.js';
import { ROAD_SURFACE_Y } from '../config/citypack.js';

const BODY_FILE = 'Man.glb';
const BODY_SCALE = 0.29;
const POLICE_FILE = 'Police Car.glb';
const CAMERA_PULLBACK_DURATION = 1.0;
const POLICE_APPROACH_SPEED = 8;
const POLICE_STOP_DISTANCE = 6;
const FAILED_SCREEN_DELAY = 2500;

// Нет физического движка в проекте — "ragdoll" тут не настоящая физика, а
// запечённый клип анимации "Death" из того же набора персонажей, что и NPC
// (см. config/npcs.js), плюс отвод камеры от первого лица в третье. Полиция —
// тоже не полноценный gameplay-механизм (арест/розыск), а визуальный штрих:
// одна машина, которая приезжает и останавливается неподалёку.
export class DeathSequence {
  constructor({ scene, sceneManager, player, ui, assets, collision }) {
    this.scene = scene;
    this.sceneManager = sceneManager;
    this.player = player;
    this.ui = ui;
    this.assets = assets;
    this.collision = collision;

    this.active = false;
    this.mixer = null;
    this.bodyMesh = null;
    this.policeCar = null;
    this.deathPos = null;
    this.cameraFrom = new THREE.Vector3();
    this.cameraTo = new THREE.Vector3();
    this.cameraLerpT = 0;
  }

  async trigger(car) {
    if (this.active) return;
    this.active = true;
    this.player.locked = true;
    if (car) car.userData.stopped = true;

    this.deathPos = this.player.position.clone();

    this.cameraFrom.copy(this.sceneManager.camera.position);
    this.cameraTo.copy(this.deathPos).add(new THREE.Vector3(3.5, 3.2, 3.5));
    this.cameraLerpT = 0;

    await this.spawnBody(this.deathPos);
    this.spawnPolice(this.deathPos);

    setTimeout(() => {
      this.ui.showMissionFailed(() => this.revive());
    }, FAILED_SCREEN_DELAY);
  }

  async spawnBody(pos) {
    let scene, animations;
    try {
      ({ scene, animations } = await this.assets.loadModelWithAnimations(BODY_FILE, NPC_BASE));
    } catch (error) {
      console.warn('Death body load failed:', error);
      return;
    }

    scene.scale.setScalar(BODY_SCALE);
    scene.position.copy(pos);
    scene.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(scene);
    this.bodyMesh = scene;

    this.mixer = new THREE.AnimationMixer(scene);
    const deathClip = animations.find((a) => /death/i.test(a.name));
    if (deathClip) {
      const action = this.mixer.clipAction(deathClip);
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
      action.play();
    }
  }

  spawnPolice(pos) {
    const angle = Math.random() * Math.PI * 2;
    const spawnPos = new THREE.Vector3(pos.x + Math.cos(angle) * 18, ROAD_SURFACE_Y, pos.z + Math.sin(angle) * 18);
    this.assets.loadModel(POLICE_FILE, VEHICLE_BASE).then((car) => {
      if (!this.active) return;
      car.scale.setScalar(VEHICLE_SCALE);
      car.position.copy(spawnPos);
      this.scene.add(car);
      this.policeCar = car;
    }).catch((error) => console.warn('Police car load failed:', error));
  }

  update(dt) {
    if (!this.active) return;

    if (this.mixer) this.mixer.update(dt);

    if (this.cameraLerpT < 1) {
      this.cameraLerpT = Math.min(this.cameraLerpT + dt / CAMERA_PULLBACK_DURATION, 1);
      this.sceneManager.camera.position.lerpVectors(this.cameraFrom, this.cameraTo, this.cameraLerpT);
      this.sceneManager.camera.lookAt(this.deathPos.x, this.deathPos.y + 1, this.deathPos.z);
    }

    if (this.policeCar) {
      const dx = this.deathPos.x - this.policeCar.position.x;
      const dz = this.deathPos.z - this.policeCar.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > POLICE_STOP_DISTANCE) {
        const step = Math.min(POLICE_APPROACH_SPEED * dt, dist - POLICE_STOP_DISTANCE);
        this.policeCar.position.x += (dx / dist) * step;
        this.policeCar.position.z += (dz / dist) * step;
        this.policeCar.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  revive() {
    this.ui.blinkTransition(() => {
      const spawn = findSafeSpawn(this.collision, { x: 0, z: 12 });
      this.player.teleport(spawn.x, spawn.z);
      this.player.health = 5;
      this.ui.setHealth(this.player.health);
      this.player.locked = false;

      if (this.bodyMesh) { this.scene.remove(this.bodyMesh); this.bodyMesh = null; }
      if (this.policeCar) { this.scene.remove(this.policeCar); this.policeCar = null; }
      this.mixer = null;
      this.active = false;
    });
  }
}
