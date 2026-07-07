import * as THREE from 'three';
import { CITYKIT_MODELS } from '../config/assetCatalog.js';

export class AssetBrowser {
  constructor(scene, camera, assets) {
    this.scene = scene;
    this.camera = camera;
    this.assets = assets;
    this.index = 0;
    this.current = null;
    this.enabled = false;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position:fixed; right:20px; top:20px; z-index:1000;
      padding:14px 16px; border-radius:14px;
      background:rgba(0,0,0,.75); color:#fff;
      font:14px Arial; min-width:280px; display:none;
    `;
    document.body.appendChild(this.panel);

    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  async toggle() {
    this.enabled = !this.enabled;
    this.panel.style.display = this.enabled ? 'block' : 'none';

    if (this.enabled) {
      await this.showCurrent();
    } else {
      this.clear();
    }
  }

  async onKey(e) {
    if (e.code === 'F1') {
      e.preventDefault();
      await this.toggle();
    }

    if (!this.enabled) return;

    if (e.code === 'ArrowRight') {
      this.index = (this.index + 1) % CITYKIT_MODELS.length;
      await this.showCurrent();
    }

    if (e.code === 'ArrowLeft') {
      this.index = (this.index - 1 + CITYKIT_MODELS.length) % CITYKIT_MODELS.length;
      await this.showCurrent();
    }
  }

  clear() {
    if (this.current) {
      this.scene.remove(this.current);
      this.current = null;
    }
  }

  async showCurrent() {
    this.clear();

    const file = CITYKIT_MODELS[this.index];
    const model = await this.assets.loadModel(file);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    model.position.sub(center);
    model.position.set(0, 0, -12);

    this.scene.add(model);
    this.current = model;

    this.camera.position.set(0, 8, 14);
    this.camera.lookAt(0, 2, -12);

    this.panel.innerHTML = `
      <b>Asset Browser</b><br><br>
      Model: <b>${file}</b><br>
      ${this.index + 1} / ${CITYKIT_MODELS.length}<br><br>
      Size:<br>
      X: ${size.x.toFixed(2)}<br>
      Y: ${size.y.toFixed(2)}<br>
      Z: ${size.z.toFixed(2)}<br><br>
      ← / → листать<br>
      F1 закрыть
    `;
  }
}