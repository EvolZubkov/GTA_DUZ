import * as THREE from 'three';

export class SceneManager {
  constructor(root) {
    this.root = root;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xaee2ff);
    this.scene.fog = new THREE.FogExp2(0xbfe6ff, 0.006);
    // Направление света "солнца" — единственный источник истины и для
    // addLights() (тени), и для createSky() (видимый диск солнца), чтобы
    // они всегда совпадали и солнце не "гуляло" отдельно от теней.
    this.sunDirection = new THREE.Vector3(-60, 80, 40).normalize();
    this.createSky();

    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.1,
      900
    );
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Не выше 1.25 — иначе FPS сильно падает
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 1.25)
    );

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Оставляем тени, но более дешёвые
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    root.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    window.addEventListener("resize", () => this.resize());
  }

  // Раньше вместо неба был просто плоский цвет фона — на открытых площадях
  // и с большой дальностью прорисовки это выглядело как пустота. Купол с
  // вертикальным градиентом (шейдер, без текстур) + солнце — диск на
  // фиксированной позиции вдоль sunDirection, той же, что и directional
  // light в addLights(), чтобы блик и тени были согласованы.
  createSky() {
    const skyGeo = new THREE.SphereGeometry(600, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x2f8fdd) },
        bottomColor: { value: new THREE.Color(0xdff3ff) },
        offset: { value: 20 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    const sunGeo = new THREE.SphereGeometry(18, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.copy(this.sunDirection).multiplyScalar(550);
    this.scene.add(sun);
  }

  addLights() {

    // Основной свет неба/земли — дневные тона вместо ночных лунных
    const ambient = new THREE.HemisphereLight(
      0xbfe0ff,
      0x6b5c46,
      1.5
    );
    this.scene.add(ambient);

    // Солнце — направление совпадает с видимым диском в createSky()
    const sun = new THREE.DirectionalLight(
      0xfff3d6,
      2.0
    );

    sun.position.copy(this.sunDirection).multiplyScalar(100);

    sun.castShadow = true;

    // Вместо 2048 используем 1024
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;

    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 250;

    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;

    sun.shadow.bias = -0.0002;

    this.scene.add(sun);
  }

  resize() {
    this.camera.aspect =
      window.innerWidth / window.innerHeight;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 1.25)
    );
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}