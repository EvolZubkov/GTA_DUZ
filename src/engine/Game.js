import { SceneManager } from './SceneManager.js';
import { AssetManager } from './AssetManager.js';
import { CollisionManager } from './CollisionManager.js';
import { PlayerController } from './PlayerController.js';
import { CityBuilder } from '../city/CityBuilder.js';
import { MissionManager } from '../gameplay/MissionManager.js';
import { TrafficSystem } from '../gameplay/TrafficSystem.js';
import { HUD } from '../ui/HUD.js';

export class Game {
  constructor({ root }) {
    this.root = root;
    this.sceneManager = new SceneManager(root);
    this.assets = new AssetManager();
    this.collision = new CollisionManager();
    this.ui = new HUD(root);
    this.player = new PlayerController(this.sceneManager.camera, this.collision, this.ui);
    this.city = new CityBuilder(this.sceneManager.scene, this.assets, this.collision);
    this.missions = new MissionManager(this.sceneManager.scene, this.ui);
    this.traffic = new TrafficSystem(this.sceneManager.scene, this.collision, this.ui, this.player);
  }

  async start() {
    this.sceneManager.addLights();
    await this.city.buildDowntown();
    this.missions.start();
    this.traffic.create();

    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyE') this.missions.tryInteract(this.player.position);
      if (event.code === 'KeyR') this.player.reset();
    });

    this.loop();
  }

  loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.sceneManager.clock.getDelta(), 0.05);
    this.player.update(dt);
    this.missions.update(dt, this.player.position);
    this.traffic.update(dt);
    this.ui.drawMinimap(this.player, this.missions);
    this.sceneManager.render();
  };
}
