// См. комментарий у MODEL_BASE в config/assets.js — абсолютный путь без
// BASE_URL ломается на GitHub Pages (сайт живёт в /GTA_DUZ/, а не в корне).
export const CITYPACK_BASE = `${import.meta.env.BASE_URL}citypack/`;

// Здания в этом паке замерены как ~2.3-4.7м в ширину и ~3.5м в высоту на
// 4 этажа (~0.87м/этаж) — заметно ниже человеческого роста на этаж, что
// делает игрока выше первого этажа и дороги (2м) уже машины (1.8-2.4м).
// Единый множитель приводит здания/дороги к нормальному соотношению с
// игроком (эталон роста — глаза камеры на 1.75м, см. PlayerController) и
// с машинами (vehicles.js оставлены как есть — они уже в реальном масштабе).
export const CITYPACK_SCALE = 2.5;

// Единая сетка проспектов — источник истины и для CityBuilder (расстановка
// дорог/кварталов), и для TrafficSystem (полосы движения машин). Раньше
// TrafficSystem держал свои собственные захардкоженные координаты полос,
// они разъехались с сеткой города при первом же изменении масштаба —
// машины поехали сквозь кварталы.
export const AVENUES = [-75, -50, -25, 0, 25, 50, 75];

// Дорога дополнительно на 25% шире, чем остальной CITYPACK_SCALE (после
// первой правки ширины дороги пользователь попросил ещё шире) — отдельный
// множитель, а не общий CITYPACK_SCALE, чтобы здания не поехали следом.
// 25 (шаг AVENUES) кратно ROAD_TILE*ROAD_SCALE=6.25, сетка остаётся ровной.
export const ROAD_SCALE = CITYPACK_SCALE * 1.25;

// Толщина дорожного тайла запечена в исходном узле (scale:[100,100,100] на
// геометрию ~0.001м) и НЕ должна расти вместе с ROAD_SCALE — иначе асфальт
// раздувается по вертикали вместе с шириной (при текущем ROAD_SCALE выходило
// 0.3125м, машины на y=0 утопали в нём почти на треть метра). CityBuilder
// масштабирует X/Z тайла на ROAD_SCALE, а Y оставляет как есть (~0.1м).
export const ROAD_TILE_THICKNESS = 0.1;

// Верх асфальта в мировых координатах: тайл кладётся нижней гранью на уровень
// земли (ground.position.y = -0.05 в CityBuilder.createGround, чтобы не
// z-fight'ить с газоном), значит верх — на -0.05 + толщина. Единая точка
// отсчёта для CityBuilder (расстановка дороги) и TrafficSystem (высота
// машин) — раньше машины стояли на y=0 без привязки к реальной высоте
// асфальта и "тонули".
export const ROAD_SURFACE_Y = -0.05 + ROAD_TILE_THICKNESS;

// "Road Bits.glb" — один файл с несколькими именованными тайлами дороги,
// разложенными по сетке для превью. Каждый тайл — 2x2м на исходном
// масштабе (без ROAD_SCALE) — используйте ROAD_TILE * ROAD_SCALE как
// реальный шаг сетки при расстановке. Достаются через
// AssetManager.loadModelPart().
export const ROAD_TILE = 2;
// Реальный шаг сетки дороги — используется и CityBuilder (расстановка
// дорог/кварталов/margin), и PedestrianSystem (петля тротуара для NPC).
export const ROAD_STEP = ROAD_TILE * ROAD_SCALE;
export const ROAD_KIT_FILE = 'Road Bits.glb';
export const ROAD_PARTS = {
  straight: 'road_straight',
  corner: 'road_corner',
  cornerCurved: 'road_corner_curved',
  junction: 'road_junction',
  crossing: 'road_straight_crossing',
  tsplit: 'road_tsplit'
};

// Готовые цельные здания (не модульные — вся вариативность фасада уже
// запечена в текстуре). Размеры (Ш×В×Г) замерены отдельно по bbox с учётом
// трансформаций узлов. type:'corner' — угловые здания с двумя витринными
// фасадами, сходящимися на одном углу (см. правило поворота в
// CityBuilder.buildQuarterBlock); type:'row' — обычные дома в ряд.
export const BUILDINGS = [
  { file: 'Building Red.glb', width: 2.42, depth: 1.34, type: 'row' },
  { file: 'Building Green.glb', width: 2.42, depth: 1.34, type: 'row' },
  { file: 'Gb Blank.glb', width: 2.42, depth: 1.33, type: 'row' },
  { file: 'RB Blank.glb', width: 2.42, depth: 1.33, type: 'row' },
  { file: 'Brown Building.glb', width: 2.28, depth: 2.20, type: 'row' },
  { file: 'Big Building.glb', width: 4.71, depth: 4.39, type: 'row' },
  { file: 'Building Red Corner.glb', width: 1.33, depth: 1.34, type: 'corner' },
  { file: 'Pizza Corner.glb', width: 1.328, depth: 1.34, type: 'corner' }
];

// Мелкие props для тротуаров/улиц. Масштаб подобран по замеру реального
// bbox каждой модели (см. измерение этой сессии) — часть ассетов в этом
// бандле выгружена в "битом" масштабе на два порядка (Fire Hydrant,
// Billboard, Stop sign, Air conditioner — bbox в сотнях единиц вместо
// метров, как раньше было с Tree/Van/Bus/Motorcycle), остальные просто
// авторски крупнее/мельче реального объекта (Trash Can, Flower Pot, ATM).
// `collidable` — должен ли объект блокировать игрока: не ставим его на
// плоские "декали" вроде люка (Manhole Cover, толщина 0.018м, по нему
// просто идут).
export const PROPS = {
  fence: { file: 'Fence.glb', scale: 0.2, collidable: true },
  fenceEnd: { file: 'Fence End.glb', scale: 1.3, collidable: true },
  fencePiece: { file: 'Fence Piece.glb', scale: 1.3, collidable: true },
  bench: { file: 'Bench.glb', scale: 0.75, collidable: true },
  trafficLight: { file: 'Traffic Light.glb', scale: 1, collidable: true },
  mailbox: { file: 'Mailbox.glb', scale: 1, collidable: true },
  trashCan: { file: 'Trash Can.glb', scale: 0.25, collidable: true },
  fireHydrant: { file: 'Fire hydrant.glb', scale: 0.0032, collidable: true },
  manholeCover: { file: 'Manhole Cover.glb', scale: 1, collidable: false },
  flowerPot: { file: 'Flower Pot.glb', scale: 0.28, collidable: true },
  planterBushes: { file: 'Planter & Bushes.glb', scale: 1, collidable: true },
  tree: { file: 'Tree.glb', scale: 0.009, collidable: true },
  billboard: { file: 'Billboard.glb', scale: 0.009, collidable: true },
  stopSign: { file: 'Stop sign.glb', scale: 0.009, collidable: true },
  dumpster: { file: 'Dumpster.glb', scale: 0.7, collidable: true },
  busStop: { file: 'Bus Stop.glb', scale: 0.13, collidable: true },
  busStopSign: { file: 'Bus stop sign.glb', scale: 0.13, collidable: true },
  atm: { file: 'ATM.glb', scale: 2.3, collidable: true },
  airConditioner: { file: 'Air conditioner.glb', scale: 0.003, collidable: false },
  powerBox: { file: 'Power Box.glb', scale: 1, collidable: true },
  cone: { file: 'Cone.glb', scale: 1, collidable: false }
};
