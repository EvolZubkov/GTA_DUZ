import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODEL_BASE } from '../config/assets.js';

export class AssetManager {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  async loadModel(file) {
    const url = `${MODEL_BASE}${file}`;
    if (this.cache.has(url)) return this.clone(this.cache.get(url));

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
    this.cache.set(url, scene);
    return this.clone(scene);
  }

  clone(object) {
    return object.clone(true);
  }
}
