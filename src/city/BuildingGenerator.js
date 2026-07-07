import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITYKIT } from '../config/assets.js';

export const MODULE = 2;       // ширина стенового модуля, метры
export const FLOOR_HEIGHT = 3; // высота этажа, метры

// Общий для всех сгенерированных зданий реестр материалов, ключ — имя
// материала из glTF (НЕ uuid: один и тот же материал парсится в отдельный
// THREE.Material на каждый файл, но это идентичные PBR-описания — держим
// один экземпляр на имя, чтобы куски с одинаковым материалом сливались
// в один draw call вне зависимости от того, из какого файла они взяты).
const materialRegistry = new Map();

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, options) {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let r = rng() * total;
  for (const [value, weight] of options) {
    if (r < weight) return value;
    r -= weight;
  }
  return options[options.length - 1][0];
}

function canonicalizeMaterial(mesh) {
  const name = mesh.material.name || mesh.material.uuid;
  if (!materialRegistry.has(name)) {
    mesh.material.vertexColors = false;
    materialRegistry.set(name, mesh.material);
  }
  mesh.material = materialRegistry.get(name);
}

// mergeGeometries требует одинаковый набор атрибутов у всех кусков —
// у деталей кита он не совпадает (где-то есть COLOR_0/COLOR_1, где-то нет),
// поэтому оставляем только то, что реально используется шейдером.
function stripAttributes(geometry) {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', geometry.attributes.position);
  if (geometry.attributes.normal) out.setAttribute('normal', geometry.attributes.normal);
  if (geometry.attributes.uv) out.setAttribute('uv', geometry.attributes.uv);
  if (geometry.index) out.setIndex(geometry.index);
  return out;
}

export class BuildingGenerator {
  constructor(assets) {
    this.assets = assets;
  }

  /**
   * Собирает уникальное здание из модульных деталей citykit и схлопывает
   * результат в несколько mesh (по одному на материал), чтобы не плодить
   * сотни draw call на здание.
   */
  async generate({
    x, z, rotY = 0,
    widthModules, depthModules, floors,
    style = 'brick',
    entranceSide = 'south',
    seed
  }) {
    if (widthModules < 2 || depthModules < 2 || floors < 1) return null;

    const rng = mulberry32(seed ?? ((Math.round(x) * 73856093) ^ (Math.round(z) * 19349663)) >>> 0);

    const wallSet = CITYKIT.parts.wall[style] || CITYKIT.parts.wall.brick;
    const cornerFile = style === 'metal' ? CITYKIT.parts.corner.trim : CITYKIT.parts.corner.brick;
    const corniceSet = CITYKIT.parts.cornice[style] || CITYKIT.parts.cornice.brick;

    const halfW = (widthModules * MODULE) / 2;
    const halfD = (depthModules * MODULE) / 2;

    // Позиции прямых сегментов вдоль стороны (в метрах), угловые модули
    // на обоих концах зарезервированы под угловые детали.
    const wSlots = Array.from({ length: widthModules - 2 }, (_, i) => -halfW + MODULE * 1.5 + i * MODULE);
    const dSlots = Array.from({ length: depthModules - 2 }, (_, i) => -halfD + MODULE * 1.5 + i * MODULE);

    const wallChoices = (floor) => {
      const opts = [
        [wallSet.plain, 55],
        [wallSet.windowSquare || wallSet.window, 35]
      ];
      if (floor === 0 && wallSet.plainGround) opts.push([wallSet.plainGround, 10]);
      return opts.filter(([file]) => Boolean(file));
    };

    const entranceX = (entranceSide === 'south' || entranceSide === 'north') && wSlots.length
      ? wSlots[Math.floor((wSlots.length - 1) / 2)]
      : null;
    const entranceZ = (entranceSide === 'east' || entranceSide === 'west') && dSlots.length
      ? dSlots[Math.floor((dSlots.length - 1) / 2)]
      : null;

    const placements = [];

    for (let f = 0; f < floors; f++) {
      const y = f * FLOOR_HEIGHT;

      // Brick_Corner_Plain / Trim_Corner — L-образная деталь: кирпич идёт
      // вдоль local x=-1 и local z=-2 (полная толщина), "внешняя вершина"
      // L в local (-1,-2), а local (1,0) — пустой внутренний угол.
      // Проверено напрямую отдельным рендером детали (bbox + скриншот сверху).
      // При повороте на θ эта вершина уходит в направление (offset ниже,
      // выведено из матрицы поворота вокруг Y). Раньше SE/NW углы были
      // повёрнуты в противоположную сторону — L смотрела пустым углом
      // НАРУЖУ здания вместо кирпичной стороны, отсюда были дыры до фона.
      // θ=0   -> вершина уходит в (-1,-2)
      // θ=90  -> вершина уходит в (-2,1)
      // θ=180 -> вершина уходит в (1,2)
      // θ=270 -> вершина уходит в (2,-1)
      placements.push({ file: cornerFile, x: -halfW + 1, z: -halfD + 2, y, rotY: 0, overlap: true });
      placements.push({ file: cornerFile, x: halfW - 2, z: -halfD + 1, y, rotY: -Math.PI / 2, overlap: true });
      placements.push({ file: cornerFile, x: halfW - 1, z: halfD - 2, y, rotY: Math.PI, overlap: true });
      placements.push({ file: cornerFile, x: -halfW + 2, z: halfD - 1, y, rotY: Math.PI / 2, overlap: true });

      for (const sx of wSlots) {
        if (f === 0 && entranceSide === 'south' && sx === entranceX) {
          placements.push({ file: CITYKIT.parts.door.frameWooden, x: sx, z: -halfD, y, rotY: 0 });
          placements.push({ file: CITYKIT.parts.entrance.concrete2x2, x: sx, z: -halfD - MODULE / 2, y: 0, rotY: 0 });
        } else {
          placements.push({ file: pickWeighted(rng, wallChoices(f)), x: sx, z: -halfD, y, rotY: 0, overlap: true });
        }
      }
      for (const sx of wSlots) {
        if (f === 0 && entranceSide === 'north' && sx === entranceX) {
          placements.push({ file: CITYKIT.parts.door.frameWooden, x: sx, z: halfD, y, rotY: Math.PI });
          placements.push({ file: CITYKIT.parts.entrance.concrete2x2, x: sx, z: halfD + MODULE / 2, y: 0, rotY: Math.PI });
        } else {
          placements.push({ file: pickWeighted(rng, wallChoices(f)), x: sx, z: halfD, y, rotY: Math.PI, overlap: true });
        }
      }
      for (const sz of dSlots) {
        if (f === 0 && entranceSide === 'west' && sz === entranceZ) {
          placements.push({ file: CITYKIT.parts.door.frameWooden, x: -halfW, z: sz, y, rotY: -Math.PI / 2 });
          placements.push({ file: CITYKIT.parts.entrance.concrete2x2, x: -halfW - MODULE / 2, z: sz, y: 0, rotY: -Math.PI / 2 });
        } else {
          placements.push({ file: pickWeighted(rng, wallChoices(f)), x: -halfW, z: sz, y, rotY: -Math.PI / 2, overlap: true });
        }
      }
      for (const sz of dSlots) {
        if (f === 0 && entranceSide === 'east' && sz === entranceZ) {
          placements.push({ file: CITYKIT.parts.door.frameWooden, x: halfW, z: sz, y, rotY: Math.PI / 2 });
          placements.push({ file: CITYKIT.parts.entrance.concrete2x2, x: halfW + MODULE / 2, z: sz, y: 0, rotY: Math.PI / 2 });
        } else {
          placements.push({ file: pickWeighted(rng, wallChoices(f)), x: halfW, z: sz, y, rotY: Math.PI / 2, overlap: true });
        }
      }
    }

    // Карниз по периметру верхнего этажа + плоская крыша поверх.
    // Угловые детали карниза — та же асимметричная L-геометрия, что и
    // Brick_Corner_Plain (внешняя вершина в local(-1,-cornerDepth)), только
    // тоньше. Глубина замерена отдельно по каждому стилю.
    const roofY = floors * FLOOR_HEIGHT;
    const cornerDepth = style === 'metal' ? 0.7 : 0.9;
    placements.push({ file: corniceSet.angleL || corniceSet.center, x: -halfW + 1, z: -halfD + cornerDepth, y: roofY, rotY: 0, overlap: true });
    placements.push({ file: corniceSet.angleR || corniceSet.center, x: halfW - cornerDepth, z: -halfD + 1, y: roofY, rotY: -Math.PI / 2, overlap: true });
    placements.push({ file: corniceSet.angleL || corniceSet.center, x: halfW - 1, z: halfD - cornerDepth, y: roofY, rotY: Math.PI, overlap: true });
    placements.push({ file: corniceSet.angleR || corniceSet.center, x: -halfW + cornerDepth, z: halfD - 1, y: roofY, rotY: Math.PI / 2, overlap: true });
    for (const sx of wSlots) {
      placements.push({ file: corniceSet.center, x: sx, z: -halfD, y: roofY, rotY: 0, overlap: true });
      placements.push({ file: corniceSet.center, x: sx, z: halfD, y: roofY, rotY: Math.PI, overlap: true });
    }
    for (const sz of dSlots) {
      placements.push({ file: corniceSet.center, x: -halfW, z: sz, y: roofY, rotY: -Math.PI / 2, overlap: true });
      placements.push({ file: corniceSet.center, x: halfW, z: sz, y: roofY, rotY: Math.PI / 2, overlap: true });
    }

    for (let i = 0; i < widthModules; i++) {
      const tx = -halfW + MODULE / 2 + i * MODULE;
      for (let j = 0; j < depthModules; j++) {
        const tz = -halfD + MODULE / 2 + j * MODULE;
        placements.push({ file: CITYKIT.parts.roof.flat.small, x: tx, z: tz, y: roofY + 1, rotY: 0 });
      }
    }

    return this.assemble(placements, x, z, rotY);
  }

  async assemble(placements, x, z, rotY) {
    const instances = await Promise.all(
      placements
        .filter((p) => Boolean(p.file))
        .map(async (p) => {
          const obj = await this.assets.loadModel(p.file);
          obj.position.set(p.x, p.y, p.z);
          obj.rotation.y = p.rotY;
          // Соседние куски кита стыкуются впритык, а не внахлёст — на некоторых
          // швах (особенно угол↔стена) это даёт тонкую щель с фоном сквозь неё.
          // Лёгкий overscale прячет её нахлёстом, визуально незаметно.
          if (p.overlap) obj.scale.setScalar(1.04);
          obj.updateMatrixWorld(true);
          return obj;
        })
    );

    const byMaterial = new Map();
    for (const instance of instances) {
      instance.traverse((mesh) => {
        if (!mesh.isMesh) return;
        canonicalizeMaterial(mesh);
        mesh.updateWorldMatrix(true, false);
        const geometry = stripAttributes(mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
        if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
        byMaterial.get(mesh.material).push(geometry);
      });
    }

    const group = new THREE.Group();
    for (const [material, geometries] of byMaterial) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    return group;
  }
}
