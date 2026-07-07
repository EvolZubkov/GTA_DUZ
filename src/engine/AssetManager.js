import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MODEL_BASE } from '../config/assets.js';

// Многие citykit-модели переиспользуют одни и те же текстуры (T_Concrete_*, T_MetalConcrete_* и т.д.) —
// без глобального кэша THREE каждая gltf-модель декодирует их заново.
THREE.Cache.enabled = true;

export class AssetManager {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  loadModel(file, base = MODEL_BASE) {
    const url = `${base}${file}`;

    if (!this.cache.has(url)) {
      // Кэшируем сам промис загрузки, а не только результат — иначе параллельные
      // вызовы (например, Promise.all по сетке дорог) успевают запустить
      // несколько одинаковых сетевых запросов до того, как первый завершится.
      this.cache.set(url, this.fetchModel(url));
    }

    return this.cache.get(url).then((result) => this.clone(result.scene));
  }

  // Для анимированных моделей (NPC) одного clone(scene) недостаточно — нужны
  // ещё и сами AnimationClip из gltf.animations (обычный loadModel их
  // отбрасывает, т.к. большинству статичных пропов/зданий они не нужны).
  async loadModelWithAnimations(file, base = MODEL_BASE) {
    const url = `${base}${file}`;
    if (!this.cache.has(url)) {
      this.cache.set(url, this.fetchModel(url));
    }
    const result = await this.cache.get(url);
    return { scene: this.clone(result.scene), animations: result.animations };
  }

  async fetchModel(url) {
    const gltf = await this.loader.loadAsync(url);
    const scene = gltf.scene;

    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj.material) {
          obj.material.side = THREE.FrontSide;
          obj.material.needsUpdate = true;
        }
      }
    });

    return { scene, animations: gltf.animations };
  }

  // object.clone(true) (Object3D.prototype.clone) не переустанавливает
  // Skeleton/SkinnedMesh-привязки — все клоны анимированного персонажа делили
  // бы один скелет и двигались синхронно. SkeletonUtils clone() делает полный
  // клон, включая корректную переустановку скелета; для обычных (не skinned)
  // объектов работает так же, как обычный clone(true), поэтому используется
  // универсально, а не только для NPC.
  clone(object) {
    return cloneSkeleton(object);
  }

  // Некоторые паки кладут несколько именованных объектов в один .glb
  // (например, набор дорожных тайлов "разложен" по сетке в одном файле для
  // превью в Blender). Достаём конкретный именованный узел и сбрасываем его
  // локальную позицию — иначе он тащит за собой смещение из раскладки-сетки.
  async loadModelPart(file, base, partName) {
    const url = `${base}${file}`;
    if (!this.cache.has(url)) {
      this.cache.set(url, this.fetchModel(url));
    }
    const { scene } = await this.cache.get(url);
    const part = scene.getObjectByName(partName);
    if (!part) throw new Error(`Part "${partName}" not found in ${url}`);
    const clone = part.clone(true);
    clone.position.set(0, 0, 0);
    return clone;
  }
}