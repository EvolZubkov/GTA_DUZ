import { CITYPACK_BASE } from './citypack.js';

export const NPC_BASE = CITYPACK_BASE;

// Масштаб подобран не под реальный рост человека (1.7-1.75м), а под уже
// уменьшенный "игрушечный" масштаб города (EYE_HEIGHT игрока — 1.3125м,
// см. PlayerController) — иначе NPC будут выглядеть непропорционально
// крупными рядом с игроком и зданиями, уже уменьшенными CITYPACK_SCALE.
// Имена клипов анимации взяты из самого GLB (animations[].name), проверено
// прямым разбором JSON-чанка файла — единственные подходящие для ходьбы/покоя.
export const NPCS = [
  { file: 'Man.glb', scale: 0.29, walkClip: 'HumanArmature|Man_Walk', idleClip: 'HumanArmature|Man_Idle' },
  { file: 'Animated Woman.glb', scale: 0.265, walkClip: 'Armature|Walking', idleClip: 'Armature|Idle' },
  // Пользовательские персонажи (коллеги, сделанные им самим) — на том же
  // риге "HumanArmature", что и Man.glb (та же длина костей — проверено
  // через Box3.setFromObject: "рост" в исходных единицах у Vitalik.glb и
  // Man.glb совпадает с точностью до 0.4%), поэтому масштаб взят тот же,
  // не пересчитан заново. Каждый новый персонаж в этом же паттерне
  // добавляется сюда же — PedestrianSystem гарантирует, что каждая запись
  // из NPCS хотя бы раз появится в городе (см. комментарий в create()).
  { file: 'Vitalik.glb', scale: 0.29, walkClip: 'HumanArmature|Man_Walk', idleClip: 'HumanArmature|Man_Idle' }
];
