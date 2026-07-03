import * as THREE from 'three';

export class SceneManager {
  constructor(root) {
    this.root = root;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x150926);
    this.scene.fog = new THREE.FogExp2(0x150926, 0.012);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this.resize());
  }

  addLights() {
    const ambient = new THREE.HemisphereLight(0xaac7ff, 0x17111f, 1.2);
    this.scene.add(ambient);

    const moon = new THREE.DirectionalLight(0xffffff, 1.6);
    moon.position.set(-60, 80, 40);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    this.scene.add(moon);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
