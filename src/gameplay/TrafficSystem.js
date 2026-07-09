import * as THREE from 'three';
import { VEHICLE_BASE, VEHICLES, VEHICLE_SCALE } from '../config/vehicles.js';
import { ROAD_SURFACE_Y } from '../config/citypack.js';
import { RoadGraph } from './RoadGraph.js';

const UP = new THREE.Vector3(0, 1, 0);
// Время "доворота" на новый курс при въезде на очередной сегмент — раньше
// rotation.y менялся мгновенно (щелчком), из-за чего повороты выглядели
// неестественно даже когда сама траектория уже была правильной.
const TURN_DURATION = 0.4;

export class TrafficSystem {
  constructor(scene, collision, ui, player, assets, onFatalHit) {
    this.scene = scene;
    this.collision = collision;
    this.ui = ui;
    this.player = player;
    this.assets = assets;
    this.onFatalHit = onFatalHit;
    this.cars = [];
    this.graph = new RoadGraph();
  }

  async create() {
    const spawns = await Promise.all(
      Array.from({ length: 8 }, (_, i) => this.spawnCar(i))
    );

    this.cars = spawns.filter(Boolean);
  }

  headingQuaternion(dx, dz) {
    // Модели "смотрят" вдоль +Z по умолчанию (см. vehicles.js) — угол до
    // направления (dx,dz) от +Z считается через atan2(dx,dz), это же
    // выражение при dx=0/dz=0 частных случаях даёт те же углы, что раньше
    // были захардкожены отдельно для горизонтального/вертикального движения
    // (0, π, ±π/2), но работает для любого направления на решётке.
    const angle = Math.atan2(dx, dz);
    return new THREE.Quaternion().setFromAxisAngle(UP, angle);
  }

  async spawnCar(i) {
    const spec = VEHICLES[i % VEHICLES.length];

    let car;
    try {
      car = await this.assets.loadModel(spec.file, VEHICLE_BASE);
    } catch (error) {
      console.warn('Vehicle load failed:', spec.file, error);
      return null;
    }

    car.scale.setScalar(spec.scale * VEHICLE_SCALE);

    const currentNode = this.graph.randomNode();
    const targetNode = this.graph.randomNextNode(currentNode, null);
    const heading = this.headingQuaternion(targetNode.x - currentNode.x, targetNode.z - currentNode.z);

    car.position.set(currentNode.x, ROAD_SURFACE_Y, currentNode.z);
    car.quaternion.copy(heading);

    car.userData = {
      speed: 10 + (i % 3) * 3,
      fromNode: null,
      currentNode,
      targetNode,
      progress: 0,
      fromQuat: heading.clone(),
      toQuat: heading.clone(),
      turnT: 1,
      stopped: false
    };
    this.scene.add(car);
    return car;
  }

  // Двигает машину от currentNode к targetNode с постоянной скоростью; по
  // прибытии выбирает следующий узел маршрута через RoadGraph (случайное
  // блуждание по решётке проспектов, без разворотов на 180° посреди прямой,
  // как было раньше) и мягко доворачивает курс за TURN_DURATION секунд.
  advanceCar(car, dt) {
    const state = car.userData;
    if (state.stopped) return;

    const segX = state.targetNode.x - state.currentNode.x;
    const segZ = state.targetNode.z - state.currentNode.z;
    const segLength = Math.hypot(segX, segZ) || 1;

    state.progress += (state.speed * dt) / segLength;

    if (state.progress >= 1) {
      const arrivedNode = state.targetNode;
      const nextNode = this.graph.randomNextNode(arrivedNode, state.currentNode);
      state.fromNode = state.currentNode;
      state.currentNode = arrivedNode;
      state.targetNode = nextNode;
      state.progress = 0;

      state.fromQuat = car.quaternion.clone();
      state.toQuat = this.headingQuaternion(nextNode.x - arrivedNode.x, nextNode.z - arrivedNode.z);
      state.turnT = 0;
    }

    const t = Math.min(state.progress, 1);
    car.position.set(
      state.currentNode.x + (state.targetNode.x - state.currentNode.x) * t,
      ROAD_SURFACE_Y,
      state.currentNode.z + (state.targetNode.z - state.currentNode.z) * t
    );

    if (state.turnT < 1) {
      state.turnT = Math.min(state.turnT + dt / TURN_DURATION, 1);
      car.quaternion.slerpQuaternions(state.fromQuat, state.toQuat, state.turnT);
    }
  }

  update(dt) {
    for (const car of this.cars) {
      this.advanceCar(car, dt);

      // Пока игрок уже мёртв (0 сердец) и сцена смерти идёт своим чередом
      // (DeathSequence), не проверяем новые столкновения — иначе другие
      // машины рядом с застывшим телом продолжали бы триггерить
      // knockback/мерцание сердца поверх уже идущей анимации смерти.
      // ui.blocksInput() — открыт слайд миссии/звонок/mission failed:
      // игрок не видит мир и не может увернуться, машина не должна тихо
      // отжирать сердца и в итоге подменить читаемый слайд экраном
      // "MISSION FAILED" (проверено — так и происходило: за 12 секунд с
      // открытой карточкой миссии здоровье падало с 5 до 2).
      if (this.player.health <= 0 || this.ui.blocksInput()) continue;

      const dist = car.position.distanceTo(this.player.position);
      if (dist < 2.5) {
        const dead = this.player.damage(1);
        // Каждый удар — отбрасывание игрока и мерцание сердца, независимо от
        // того, добит игрок или нет (раньше был только текстовый toast).
        this.player.knockback(car.position);
        this.ui.pulseHeartLoss();
        if (dead) {
          // Смертельный удар — дальше сценой смерти (камера/ragdoll-вид/
          // полиция/экран failure) занимается DeathSequence, а не сам
          // TrafficSystem; машина, сбившая игрока, останавливается там же
          // (car.userData.stopped помечается внутри DeathSequence.trigger).
          this.onFatalHit?.(car);
        } else {
          this.ui.showToast('-1 сердце');
        }
      }
    }
  }
}
