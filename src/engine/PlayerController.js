import * as THREE from 'three';
import { findSafeSpawn } from '../gameplay/spawn.js';

// Рост игрока (высота глаз камеры). Раньше был 1.75 — с новым масштабом
// зданий (CITYPACK_SCALE) этаж стал ~2.2м, но 1.75 всё равно казалось
// высоковато, снизили ещё на 25%.
const EYE_HEIGHT = 1.3125;

export class PlayerController {
  constructor(camera, collision, ui) {
    this.camera = camera;
    this.collision = collision;
    this.ui = ui;
    this.position = new THREE.Vector3(0, 0, 12);
    this.velocityY = 0;
    this.speed = 10.5;
    this.jumpPower = 8.5;
    this.gravity = 22;
    this.grounded = true;
    this.locked = false;
    this.keys = new Set();
    this.health = 5;
    this.invulnerableUntil = 0;

    this.camera.position.copy(this.position).add(new THREE.Vector3(0, EYE_HEIGHT, 0));
    this.camera.rotation.y = Math.PI;

    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.onKeyUp(event));
    window.addEventListener('mousemove', (event) => this.onMouseMove(event));
    window.addEventListener('click', () => {
      if (!this.ui.blocksInput()) document.body.requestPointerLock();
    });
  }

  onKeyDown(event) {
    this.keys.add(event.code);
    if (event.code === 'Space' && this.grounded && !this.ui.blocksInput() && !this.locked) {
      this.velocityY = this.jumpPower;
      this.grounded = false;
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  onMouseMove(event) {
    if (document.pointerLockElement !== document.body || this.ui.blocksInput()) return;
    this.camera.rotation.y -= event.movementX * 0.0022;
    this.camera.rotation.x -= event.movementY * 0.0022;
    this.camera.rotation.x = Math.max(-1.15, Math.min(1.05, this.camera.rotation.x));
  }

  update(dt) {
    // this.locked — отдельно от ui.blocksInput(): последнее блокирует ввод
    // при открытых модалках (звонок/слайды), а locked — во время сцены
    // смерти (см. DeathSequence), которая ещё до появления экрана "mission
    // failed" уже не должна давать двигаться/прыгать.
    if (this.ui.blocksInput() || this.locked) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    const movement = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) movement.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) movement.addScaledVector(forward, -1);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) movement.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) movement.addScaledVector(right, -1);

    if (movement.lengthSq() > 0) {
      movement.normalize().multiplyScalar(this.speed * dt);
      this.tryMove(movement);
    }

    this.velocityY -= this.gravity * dt;
    this.position.y += this.velocityY * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocityY = 0;
      this.grounded = true;
    }

    this.camera.position.copy(this.position).add(new THREE.Vector3(0, EYE_HEIGHT, 0));
  }

  tryMove(delta) {
    const nextX = this.position.clone();
    nextX.x += delta.x;
    if (!this.collision.intersectsPlayer(nextX)) this.position.x = nextX.x;

    const nextZ = this.position.clone();
    nextZ.z += delta.z;
    if (!this.collision.intersectsPlayer(nextZ)) this.position.z = nextZ.z;
  }

  // Раньше спавн был захардкожен в (0,0,12) — стоило появиться там зданию
  // или пропу (а после расстановки пропов/светофоров/заборов в городе их
  // уже сотни), игрок оказывался внутри коллизии с первого кадра. Ищем
  // ближайшую свободную точку вокруг привычного места спавна.
  teleport(x, z) {
    this.position.set(x, 0, z);
    this.velocityY = 0;
    this.grounded = true;
    this.camera.position.copy(this.position).add(new THREE.Vector3(0, EYE_HEIGHT, 0));
    // Сцена смерти (DeathSequence) двигает камеру в третье лицо через
    // camera.lookAt() — сбрасываем на чистый Euler вид от первого лица,
    // иначе следующий поворот мышью подхватит несогласованную ориентацию.
    this.camera.rotation.set(0, Math.PI, 0);
  }

  reset() {
    const spawn = findSafeSpawn(this.collision, { x: 0, z: 12 });
    this.teleport(spawn.x, spawn.z);
    this.health = 5;
    this.ui.setHealth(this.health);
  }

  damage(amount = 1) {
    const now = performance.now();
    if (now < this.invulnerableUntil) return false;
    this.invulnerableUntil = now + 900;
    this.health = Math.max(0, this.health - amount);
    this.ui.setHealth(this.health);
    return this.health <= 0;
  }

  // Отбрасывание игрока от точки удара (позиция машины) — горизонтальный
  // толчок через уже существующий tryMove (учитывает коллизию, чтобы не
  // прошибить игрока сквозь стену) плюс лёгкий подскок по Y для "веса" удара.
  knockback(fromPos, force = 3.5) {
    const dx = this.position.x - fromPos.x;
    const dz = this.position.z - fromPos.z;
    const dist = Math.hypot(dx, dz) || 1;
    this.tryMove(new THREE.Vector3((dx / dist) * force, 0, (dz / dist) * force));
    this.velocityY = this.jumpPower * 0.5;
    this.grounded = false;
  }
}
