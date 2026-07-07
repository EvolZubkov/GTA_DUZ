import * as THREE from 'three';
import { NPC_BASE, NPCS } from '../config/npcs.js';
import { ROAD_STEP } from '../config/citypack.js';

const UP = new THREE.Vector3(0, 1, 0);
const WALK_SPEED = 1.4;

// NPC ходят строго по кольцу тротуара своего квартала (4 угла margin-кольца,
// которое CityBuilder уже собирает в city.sidewalkLoops для каждого
// застроенного квартала) — никогда не выходят на проезжую часть, т.к. само
// кольцо целиком лежит внутри тротуарной полосы между дорогой и зданиями.
export class PedestrianSystem {
  constructor(scene, assets, sidewalkLoops) {
    this.scene = scene;
    this.assets = assets;
    this.loops = sidewalkLoops;
    this.npcs = [];
  }

  // Раньше был ровно 1 NPC на квартал (1:1 с sidewalkLoops) — при росте
  // ростера (пользователь добавляет своих коллег персонажами один за
  // другим) записи из NPCS с индексом больше числа кварталов НИКОГДА бы не
  // выпадали (i % NPCS.length просто не достигает их индекса, если кварталов
  // меньше). Теперь спавнов ровно столько, сколько нужно, чтобы каждая
  // запись реестра появилась минимум один раз, даже если персонажей больше,
  // чем застроенных кварталов — тогда несколько NPC делят один тротуар.
  async create() {
    const count = Math.max(this.loops.length, NPCS.length);
    const spawns = await Promise.all(
      Array.from({ length: count }, (_, i) => this.spawnNpc(this.loops[i % this.loops.length], i))
    );
    this.npcs = spawns.filter(Boolean);
  }

  loopWaypoints({ x0, x1, z0, z1 }) {
    // Чуть внутрь от самой кромки тротуара, чтобы NPC не тёрся о бордюр и не
    // задевал угловые здания — примерно середина полосы между дорогой и
    // линией застройки.
    const inset = ROAD_STEP / 2 + 0.8;
    return [
      { x: x0 + inset, z: z0 + inset },
      { x: x1 - inset, z: z0 + inset },
      { x: x1 - inset, z: z1 - inset },
      { x: x0 + inset, z: z1 - inset }
    ];
  }

  async spawnNpc(loop, i) {
    const spec = NPCS[i % NPCS.length];
    let scene, animations;
    try {
      ({ scene, animations } = await this.assets.loadModelWithAnimations(spec.file, NPC_BASE));
    } catch (error) {
      console.warn('NPC load failed:', spec.file, error);
      return null;
    }

    scene.scale.setScalar(spec.scale);

    const mixer = new THREE.AnimationMixer(scene);
    const walkClip = animations.find((a) => a.name === spec.walkClip) || animations[0];
    if (walkClip) mixer.clipAction(walkClip).play();

    // Стартовый угол сдвинут по индексу спавна (не всегда 0) — иначе
    // несколько NPC, делящих один тротуар (см. create()), стартовали бы из
    // одной и той же точки друг на друге.
    const waypoints = this.loopWaypoints(loop);
    const startIndex = i % waypoints.length;
    const start = waypoints[startIndex];
    scene.position.set(start.x, 0, start.z);

    scene.userData = {
      mixer, waypoints,
      target: (startIndex + 1) % waypoints.length,
      speed: WALK_SPEED * (0.85 + Math.random() * 0.3)
    };
    this.scene.add(scene);
    return scene;
  }

  update(dt) {
    for (const npc of this.npcs) {
      const state = npc.userData;
      state.mixer.update(dt);

      const target = state.waypoints[state.target];
      const dx = target.x - npc.position.x;
      const dz = target.z - npc.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.15) {
        state.target = (state.target + 1) % state.waypoints.length;
        continue;
      }

      const step = Math.min(state.speed * dt, dist);
      npc.position.x += (dx / dist) * step;
      npc.position.z += (dz / dist) * step;

      const heading = Math.atan2(dx, dz);
      const targetQuat = new THREE.Quaternion().setFromAxisAngle(UP, heading);
      npc.quaternion.slerp(targetQuat, Math.min(dt * 6, 1));
    }
  }
}
