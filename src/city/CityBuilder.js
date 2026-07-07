import * as THREE from 'three';
import {
  CITYPACK_BASE,
  CITYPACK_SCALE,
  ROAD_SCALE,
  ROAD_STEP,
  ROAD_KIT_FILE,
  ROAD_PARTS,
  ROAD_SURFACE_Y,
  BUILDINGS,
  PROPS,
  AVENUES
} from '../config/citypack.js';

export class CityBuilder {
  constructor(scene, assets, collision) {
    this.scene = scene;
    this.assets = assets;
    this.collision = collision;
    this.objects = [];
    // Периметр тротуара (margin-кольцо) каждого застроенного квартала —
    // используется PedestrianSystem как маршрут для NPC ("только по
    // тротуарам"), поэтому собирается тут же, где известны реальные
    // границы квартала, а не пересчитывается заново в другом модуле.
    this.sidewalkLoops = [];
  }

  async buildDowntown() {
    this.createGround();
    await this.createRoadGrid();
    await this.placeTrafficLights();
    await this.createBlocks();
    this.createFallbackDecor();
  }

  createGround() {
    const geo = new THREE.PlaneGeometry(220, 220);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a6b4a, roughness: 0.9, metalness: 0.0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    // Чуть ниже нуля, иначе плоскость земли и асфальт дорожных тайлов
    // (тоже на y=0) лежат в одной плоскости и мерцают (z-fighting).
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  async placeModel(file, { x = 0, y = 0, z = 0, rotY = 0, scale = 1, scaleX = scale, collidable = false, base } = {}) {
    try {
      const obj = await this.assets.loadModel(file, base);
      // Некоторые паки хранят в самой ноде "коррекцию" Z-up -> Y-up (поворот
      // вокруг X), запечённую в исходном кватернионе. Ни obj.rotation.y = rotY
      // (перезаписывает Y-компоненту эйлеровых углов), ни obj.rotateY()
      // (крутит вокруг ЛОКАЛЬНОЙ Y, которая с учётом уже применённой
      // X-коррекции не совпадает с вертикалью) тут не годятся — объект
      // заваливается набок. rotateOnWorldAxis добавляет поворот СВЕРХУ
      // существующего, вокруг настоящей мировой вертикали.
      obj.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), rotY);
      // scaleX отдельно от scale — используется buildRow(), чтобы растянуть/
      // сжать здание вдоль его ЛОКАЛЬНОЙ ширины (X, до поворота) и уложить
      // ряд домов без остатка в отрезок улицы; высота/глубина остаются на
      // обычном CITYPACK_SCALE, чтобы этажи по-прежнему совпадали с соседями.
      obj.scale.set(scaleX, scale, scale);

      const box = new THREE.Box3().setFromObject(obj);
      const baseOffset = box.isEmpty() ? 0 : -box.min.y;
      obj.position.set(x, y + baseOffset, z);

      this.scene.add(obj);
      this.objects.push(obj);
      if (collidable) this.collision.addStaticFromObject(obj, 0.12);
      return obj;
    } catch (error) {
      console.warn('Model load failed:', file, error);
      return null;
    }
  }

  async placeRoadTile(partName, { x, z, rotY = 0 } = {}) {
    try {
      const obj = await this.assets.loadModelPart(ROAD_KIT_FILE, CITYPACK_BASE, partName);
      obj.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), rotY);
      // У тайлов дороги в самой ноде уже запечён авторский scale:[100,100,100]
      // (иначе крошечная исходная геометрия не дотягивала бы до 2м). setScalar
      // тут ПЕРЕЗАПИСЫВАЕТ этот масштаб — тайл съёживается и становится не
      // виден. multiplyScalar добавляет наш масштаб поверх авторского.
      // В самой ноде уже запечён поворот Z-up -> Y-up (см. комментарий выше),
      // поэтому ЛОКАЛЬНАЯ вертикаль (толщина тайла) — это ось Z, а не Y:
      // проверено измерением raw bbox геометрии (X/Y ~0.02, Z ~0.001). Растим
      // на ROAD_SCALE именно X и Y (мировые ширина/длина тайла), а Z (мировая
      // высота) не трогаем — иначе асфальт раздувается по вертикали вместе
      // с шириной и машины тонут в нём (см. ROAD_TILE_THICKNESS).
      obj.scale.set(obj.scale.x * ROAD_SCALE, obj.scale.y * ROAD_SCALE, obj.scale.z);
      // Нижняя грань тайла — вровень с газоном (ground.position.y = -0.05),
      // чтобы не было ни щели, ни нахлёста под асфальтом.
      obj.position.set(x, -0.05, z);
      this.scene.add(obj);
      this.objects.push(obj);
      return obj;
    } catch (error) {
      console.warn('Road tile load failed:', partName, error);
      return null;
    }
  }

  isAvenue(v) {
    return AVENUES.includes(v);
  }

  // Один светофор на угол каждого перекрёстка (не все 4 — на 49 перекрёстках
  // сетки это уже почти 200 инстансов, слишком много draw call'ов на прожекте
  // без instanced rendering).
  async placeTrafficLights() {
    const offset = ROAD_STEP / 2 + 0.4;
    const spec = PROPS.trafficLight;
    for (const x of AVENUES) {
      for (const z of AVENUES) {
        await this.placeModel(spec.file, {
          x: x + offset, z: z + offset, rotY: Math.PI, scale: spec.scale,
          base: CITYPACK_BASE, collidable: spec.collidable
        });
      }
    }
  }

  async createRoadGrid() {
    const min = AVENUES[0];
    const max = AVENUES[AVENUES.length - 1];
    const tiles = [];

    for (let x = min; x <= max; x += ROAD_STEP) {
      for (let z = min; z <= max; z += ROAD_STEP) {
        const onX = this.isAvenue(x);
        const onZ = this.isAvenue(z);
        if (onX && onZ) {
          tiles.push(this.placeRoadTile(ROAD_PARTS.junction, { x, z }));
        } else if (onX) {
          tiles.push(this.placeRoadTile(ROAD_PARTS.straight, { x, z, rotY: 0 }));
        } else if (onZ) {
          tiles.push(this.placeRoadTile(ROAD_PARTS.straight, { x, z, rotY: Math.PI / 2 }));
        }
      }
    }

    await Promise.all(tiles);
  }

  async createBlocks() {
    const blocks = [];
    for (let i = 0; i < AVENUES.length - 1; i++) {
      for (let j = 0; j < AVENUES.length - 1; j++) {
        blocks.push({
          i, j,
          x0: AVENUES[i], x1: AVENUES[i + 1],
          z0: AVENUES[j], z1: AVENUES[j + 1]
        });
      }
    }

    for (const block of blocks) {
      // Застроенный квартал через два на диагонали — шахматный узор вместо
      // сплошных полос (было бы при простом i%3 или j%3, т.к. кварталы
      // перебираются построчно). Если строить всё подряд, зданий выходит
      // за сотню и город превращается в стену без просветов.
      if ((block.i + block.j) % 3 === 0) {
        await this.buildQuarterBlock(block);
      } else {
        await this.placeParkBlock(block);
      }
    }
  }

  // Здания по периметру квартала фасадом наружу, впритык друг к другу —
  // чтобы с улицы был виден только ряд фасадов, а не голые боковые стены
  // отдельно стоящих домов. Угловое здание ставится в 4 угла — у него два
  // витринных фасада, сходящихся на одном углу самой модели (при rotY=0
  // они смотрят на локальный северо-восток, см. измерение позиции двери
  // "wood"-меша в этой сессии), поэтому на 4 углах квартала оно должно
  // стоять в 4 РАЗНЫХ поворотах, каждый следующий — на 90° от предыдущего
  // (проверено численно: rotY=0→дверь на NE, π/2→SE, π→SW, -π/2→NW).
  // Раньше SW/SE вместе стояли на rotY=π, а NE/NW — на rotY=0: только 2 угла
  // из 4 были повёрнуты верно, у двух других витрина смотрела не в ту сторону.
  //
  // Все размеры зданий (width/depth в config/citypack.js) замерены при
  // scale=1 — тут же они умножаются на CITYPACK_SCALE, поэтому и margin
  // (просвет до дороги) считается от реальной полуширины дороги ROAD_STEP/2,
  // а не от условной величины — иначе фасады снова окажутся на асфальте.
  async buildQuarterBlock({ i, j, x0, x1, z0, z1 }) {
    const sidewalk = 1.5;
    const margin = ROAD_STEP / 2 + sidewalk;

    this.createSidewalk(x0, x1, z0, z1);
    await this.placeBusStop({ x0, x1, z0, z1 }, i + j);

    // Один тип углового здания на весь квартал (Building Red Corner ИЛИ
    // Pizza Corner) — иначе на 4 углах одного квартала были бы 2 разных
    // "тематических" магазина, что выглядит нелепо. Выбор детерминирован по
    // индексу квартала, чтобы соседние кварталы отличались, а не мигали
    // случайно при перестройке.
    const cornerPool = BUILDINGS.filter((b) => b.type === 'corner');
    const corner = cornerPool[Math.abs(i * 7 + j * 13) % cornerPool.length];
    const rowSpecs = BUILDINGS.filter((b) => b.type === 'row');

    const cW = corner.width * CITYPACK_SCALE;
    const cD = corner.depth * CITYPACK_SCALE;

    const corners = [
      { x: x0 + margin + cW / 2, z: z0 + margin + cD / 2, rotY: Math.PI },       // SW — дверь на юго-запад
      { x: x1 - margin - cW / 2, z: z0 + margin + cD / 2, rotY: Math.PI / 2 },   // SE — дверь на юго-восток
      { x: x1 - margin - cW / 2, z: z1 - margin - cD / 2, rotY: 0 },             // NE — дверь на северо-восток
      { x: x0 + margin + cW / 2, z: z1 - margin - cD / 2, rotY: -Math.PI / 2 }   // NW — дверь на северо-запад
    ];
    for (const c of corners) {
      await this.placeModel(corner.file, { x: c.x, z: c.z, rotY: c.rotY, scale: CITYPACK_SCALE, base: CITYPACK_BASE, collidable: true });
    }

    // Юг/север — ряд вдоль X, между SW/SE и NW/NE углами.
    await this.buildRow(rowSpecs, {
      from: x0 + margin + cW, to: x1 - margin - cW,
      axis: 'x', line: z0 + margin, rotY: Math.PI, outward: -1
    });
    await this.buildRow(rowSpecs, {
      from: x0 + margin + cW, to: x1 - margin - cW,
      axis: 'x', line: z1 - margin, rotY: 0, outward: 1
    });
    // Запад/восток — ряд вдоль Z, после поворота на ±90° ширина здания
    // "работает" вдоль Z, а глубина — смещением от линии проспекта по X.
    await this.buildRow(rowSpecs, {
      from: z0 + margin + cD, to: z1 - margin - cD,
      axis: 'z', line: x0 + margin, rotY: -Math.PI / 2, outward: -1
    });
    await this.buildRow(rowSpecs, {
      from: z0 + margin + cD, to: z1 - margin - cD,
      axis: 'z', line: x1 - margin, rotY: Math.PI / 2, outward: 1
    });

    this.sidewalkLoops.push({ x0, x1, z0, z1 });
    await this.scatterSidewalkProps(x0, x1, z0, z1);
  }

  // Заполняет отрезок [from,to] БЕЗ ОСТАТКА — раньше здания ставились впритык
  // на родном масштабе, и как только следующее не влезало целиком, ряд
  // обрывался: при типичном пролёте квартала (~9м) это оставляло щель шириной
  // в четверть дома перед углом (пользователь: "между домами есть
  // пространство, такого не должно быть"). Вместо этого подбираем комбинацию
  // из 1-3 зданий (см. pickRowCombo — вперемешку по типам ради разнообразия,
  // включая Big Building/Brown Building, которые раньше не подмешивались в
  // ряд) и растягиваем/сжимаем ВСЮ комбинацию единым множителем так, чтобы
  // она легла в отрезок ровно. Множитель применяется только к ширине
  // (scaleX), высота/глубина остаются на CITYPACK_SCALE — этажи всё ещё
  // совпадают с соседями.
  async buildRow(specs, { from, to, axis, line, rotY, outward }) {
    const span = to - from;
    if (span <= 0.1) return;

    const combo = this.pickRowCombo(specs, span);
    if (!combo) return;

    // combo.scaleX — это ТОЛЬКО корректирующий множитель (span / номинальная
    // ширина в pickRowCombo, где номинал уже включает CITYPACK_SCALE) — сам
    // по себе это НЕ итоговый масштаб здания. Итоговая ширина на сцене должна
    // быть spec.width*CITYPACK_SCALE*combo.scaleX; забыв про CITYPACK_SCALE
    // тут, здания встают почти в CITYPACK_SCALE раз (2.5×) уже, чем нужно —
    // отсюда и был "провал" ряда почти на всю его длину.
    const finalScaleX = CITYPACK_SCALE * combo.scaleX;

    let cursor = from;
    for (const spec of combo.picks) {
      const along = spec.width * finalScaleX;
      const perp = spec.depth * CITYPACK_SCALE;
      const center = cursor + along / 2;
      // Знак "-outward" — см. подробное объяснение в старом fillEdgeRow ниже:
      // фасад должен оказаться ровно на line, а не пивот здания.
      const facePos = line - outward * (perp / 2);
      const pos = axis === 'x' ? { x: center, z: facePos } : { x: facePos, z: center };
      await this.placeModel(spec.file, {
        ...pos, rotY, scale: CITYPACK_SCALE, scaleX: finalScaleX, base: CITYPACK_BASE, collidable: true
      });
      cursor += along;
    }
  }

  // Перебирает несколько случайных комбинаций из 1-3 зданий (с повторами,
  // разные типы допускаются в одной комбинации) и выбирает ту, для которой
  // множитель растяжения/сжатия (span / суммарная номинальная ширина) ближе
  // всего к 1 — т.е. с наименьшим искажением пропорций фасада. Например, при
  // пролёте ~9.1м и ширине дома ~6.05м: 1 дом потребовал бы растяжения на
  // 50%, а 2 дома — сжатия всего на 25%, поэтому обычно выигрывает пара
  // домов (и заодно даёт разнообразие по пункту "можно комбинировать").
  pickRowCombo(specs, span) {
    let best = null;
    for (let n = 1; n <= 3; n++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const picks = Array.from({ length: n }, () => specs[Math.floor(Math.random() * specs.length)]);
        const nominal = picks.reduce((sum, s) => sum + s.width * CITYPACK_SCALE, 0);
        if (nominal <= 0) continue;
        const scaleX = span / nominal;
        const distortion = Math.abs(Math.log(scaleX));
        if (!best || distortion < best.distortion) best = { picks, scaleX, distortion };
      }
    }
    return best;
  }

  // Мелкая уличная утварь вдоль тротуарного кольца квартала — по одной точке
  // у середины каждой из 4 сторон, чуть ближе к дороге, чем к зданиям, чтобы
  // не перекрывать входы. Типы идут вразнобой (по остатку от деления индекса
  // стороны), чтобы соседние кварталы не выглядели одинаково.
  async scatterSidewalkProps(x0, x1, z0, z1) {
    const cycle = [
      PROPS.mailbox, PROPS.trashCan, PROPS.fireHydrant, PROPS.cone,
      PROPS.flowerPot, PROPS.powerBox, PROPS.atm, PROPS.stopSign
    ];
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const inset = ROAD_STEP / 2 + 0.9;
    const points = [
      { x: cx, z: z0 + inset },
      { x: cx, z: z1 - inset },
      { x: x0 + inset, z: cz },
      { x: x1 - inset, z: cz }
    ];
    let i = Math.abs(Math.round(cx + cz)) % cycle.length;
    for (const p of points) {
      const spec = cycle[i % cycle.length];
      await this.placeModel(spec.file, { ...p, scale: spec.scale, base: CITYPACK_BASE, collidable: spec.collidable });
      i += 1;
    }
  }

  // Отступ до дороги численно был верным (~1.5-1.6м), но визуально не читался
  // как тротуар — вся площадка между асфальтом и зданиями была того же
  // зелёного газона, что и весь остальной город, поэтому дома казались
  // стоящими прямо на дороге. Кладём отдельную серую плиту на весь внутренний
  // периметр квартала (между кромкой дороги и зданиями) — ниже низа зданий
  // (y=0) и дорожного полотна (ROAD_SURFACE_Y), но выше газона, чтобы не
  // z-fight'ить ни с тем, ни с другим.
  createSidewalk(x0, x1, z0, z1) {
    const inset = ROAD_STEP / 2;
    const geo = new THREE.PlaneGeometry(x1 - x0 - inset * 2, z1 - z0 - inset * 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.95 });
    const walk = new THREE.Mesh(geo, mat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set((x0 + x1) / 2, -0.02, (z0 + z1) / 2);
    walk.receiveShadow = true;
    this.scene.add(walk);
  }

  // Заполняет отрезок [from, to] вдоль оси axis рядом объектов впритык, каждый
  // ставится своим фасадом на line (наружу квартала, знак outward). Изначально
  // писалась только для зданий (жёстко зашитый CITYPACK_SCALE) — обобщена
  // явным параметром scale, чтобы тем же алгоритмом чейнить заборы вокруг
  // парковых кварталов (PROPS.fence.scale, а не CITYPACK_SCALE).
  async fillEdgeRow(specs, { from, to, axis, line, rotY, outward, scale }) {
    let cursor = from;
    let i = 0;
    while (cursor < to) {
      const spec = specs[i % specs.length];
      // После поворота ±90° "width" объекта идёт вдоль оси прохода (axis),
      // а "depth" — смещением от линии проспекта.
      const along = spec.width * scale;
      const perp = spec.depth * scale;
      if (cursor + along > to + 0.01) break;

      const center = cursor + along / 2;
      // ВАЖНО: знак тут "-outward", не "+outward". Смысл line — где должен
      // быть фасад (край квартала), а не сам пивот здания. Если пивот
      // здания в его геометрическом центре (как и есть у большинства
      // моделей пака), то чтобы фасад (сторона, обращённая наружу, знак
      // outward) оказался ровно на line, пивот нужно сдвинуть на perp/2 в
      // ПРОТИВОПОЛОЖНУЮ от outward сторону — иначе фасад окажется не на
      // line, а на line+outward*perp, то есть здания всех 4 сторон съезжают
      // на целую свою глубину друг к другу и налезают одно на другое
      // ближе к центру квартала (проверено: с "+outward" все дома квартала
      // сбивались в кучу у середины вместо того, чтобы стоять по периметру).
      // Формула согласована с угловыми зданиями чуть выше (`x0+margin+cW/2`
      // и `z1-margin-cD/2` — тот же самый сдвиг "внутрь от line на perp/2").
      const facePos = line - outward * (perp / 2);

      const pos = axis === 'x' ? { x: center, z: facePos } : { x: facePos, z: center };
      await this.placeModel(spec.file, { ...pos, rotY, scale, base: CITYPACK_BASE, collidable: true });

      cursor += along;
      i += 1;
    }
  }

  // Парковый квартал: дерево/лавочка/клумба в центре + забор по периметру
  // (тем же fillEdgeRow, что и ряды зданий, только с шириной/глубиной одного
  // сегмента забора вместо здания — margin тут меньше, чем у застроенных
  // кварталов: парку не нужен полноценный тротуар, только отступ от дороги).
  async placeParkBlock({ x0, x1, z0, z1 }) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    await this.placeModel(PROPS.tree.file, { x: cx - 3, z: cz - 3, scale: PROPS.tree.scale, base: CITYPACK_BASE, collidable: true });
    await this.placeModel(PROPS.bench.file, { x: cx + 2, z: cz, rotY: Math.PI / 2, scale: PROPS.bench.scale, base: CITYPACK_BASE, collidable: true });
    await this.placeModel(PROPS.planterBushes.file, { x: cx, z: cz + 3, scale: PROPS.planterBushes.scale, base: CITYPACK_BASE, collidable: true });

    const margin = ROAD_STEP / 2 + 0.6;
    const fence = PROPS.fence;
    const fenceSpec = [{ file: fence.file, width: 7.4, depth: 0.48 }];
    await this.fillEdgeRow(fenceSpec, {
      from: x0 + margin, to: x1 - margin,
      axis: 'x', line: z0 + margin, rotY: Math.PI, outward: -1, scale: fence.scale
    });
    await this.fillEdgeRow(fenceSpec, {
      from: x0 + margin, to: x1 - margin,
      axis: 'x', line: z1 - margin, rotY: 0, outward: 1, scale: fence.scale
    });
    await this.fillEdgeRow(fenceSpec, {
      from: z0 + margin, to: z1 - margin,
      axis: 'z', line: x0 + margin, rotY: -Math.PI / 2, outward: -1, scale: fence.scale
    });
    await this.fillEdgeRow(fenceSpec, {
      from: z0 + margin, to: z1 - margin,
      axis: 'z', line: x1 - margin, rotY: Math.PI / 2, outward: 1, scale: fence.scale
    });
  }

  createFallbackDecor() {
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x22222c, roughness: 0.4 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffe7aa, emissive: 0xffd16a, emissiveIntensity: 1.6 });
    const half = (AVENUES[1] - AVENUES[0]) / 2;
    for (const v of AVENUES) {
      for (const cross of AVENUES) {
        if (cross === AVENUES[AVENUES.length - 1]) continue;
        const mid = cross + half;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), lampMat);
        pole.position.set(v + ROAD_STEP / 2 + 0.6, 2.5, mid);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), lightMat);
        lamp.position.set(v + ROAD_STEP / 2 + 0.6, 5.1, mid);
        // Раньше добавлялись прямо в scene, без коллизии — фонарный столб,
        // единственный объект такого рода, через который можно было пройти
        // насквозь. Группируем, чтобы Box3.setFromObject() посчитал бокс по
        // обеим геометриям разом, одним вызовом на столб.
        const group = new THREE.Group();
        group.add(pole, lamp);
        this.scene.add(group);
        this.collision.addStaticFromObject(group, 0.05);
      }
    }
  }

  // Автобусная остановка на одной из сторон каждого 3-го застроенного
  // квартала — не на всех подряд, иначе тротуар превращается в склад мебели.
  async placeBusStop({ x0, x1, z0, z1 }, seed) {
    if (seed % 3 !== 0) return;
    const cx = (x0 + x1) / 2;
    const z = z0 + ROAD_STEP / 2 + 1.1;
    await this.placeModel(PROPS.busStop.file, { x: cx - 1.5, z, rotY: Math.PI, scale: PROPS.busStop.scale, base: CITYPACK_BASE, collidable: true });
    await this.placeModel(PROPS.busStopSign.file, { x: cx + 1.5, z, rotY: Math.PI, scale: PROPS.busStopSign.scale, base: CITYPACK_BASE, collidable: true });
  }
}
