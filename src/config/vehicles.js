// См. комментарий у MODEL_BASE в config/assets.js — абсолютный путь без
// BASE_URL ломается на GitHub Pages (сайт живёт в /GTA_DUZ/, а не в корне).
export const VEHICLE_BASE = `${import.meta.env.BASE_URL}vehicles/`;

// Машины уже в реальном метровом масштабе (см. ниже), но рядом с суженным
// после CITYPACK_SCALE городом (этаж ~2.2м, тротуар/полоса по замеру) они
// визуально смотрятся крупнее, чем должны — общий понижающий множитель
// вместо правки каждой машины по отдельности (тот же приём, что и
// CITYPACK_SCALE/ROAD_SCALE в citypack.js). Подобран визуально по скриншоту
// улицы с игроком/зданием/дорогой в одном кадре.
export const VEHICLE_SCALE = 0.78;

// Модели центрированы в (0,0,0), длина вдоль Z, "перёд" (капот/фары) смотрит
// в +Z по умолчанию — проверено визуально через отдельный рендер модели.
// Car/SUV/Taxi/Police Car/Sports Car/Pickup Truck уже в метрах (bbox 1.8-2.3м
// по ширине, 3.7-5.2м по длине — совпадает с реальными пропорциями).
// Van/Bus/Motorcycle в этом бандле экспортированы в другом масштабе
// (bbox в десятки метров) — scale ниже компенсирует это до похожих
// реальных размеров. Оба множителя (свой + VEHICLE_SCALE) перемножаются в
// TrafficSystem.spawnCar.
export const VEHICLES = [
  { file: 'Car.glb', scale: 1 },
  { file: 'SUV.glb', scale: 1 },
  { file: 'Taxi.glb', scale: 1 },
  { file: 'Police Car.glb', scale: 1 },
  { file: 'Sports Car.glb', scale: 1 },
  { file: 'Pickup Truck.glb', scale: 1 },
  { file: 'Van.glb', scale: 0.0623 },
  { file: 'Bus.glb', scale: 0.0762 },
  { file: 'Motorcycle.glb', scale: 0.0157 }
];
