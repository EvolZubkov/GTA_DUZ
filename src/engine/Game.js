import { SceneManager } from './SceneManager.js';
import { AssetManager } from './AssetManager.js';
import { CollisionManager } from './CollisionManager.js';
import { PlayerController } from './PlayerController.js';
import { GameLoop } from './GameLoop.js';

import { CityBuilder } from '../city/CityBuilder.js';
import { MissionManager } from '../gameplay/MissionManager.js';
import { TrafficSystem } from '../gameplay/TrafficSystem.js';
import { PedestrianSystem } from '../gameplay/PedestrianSystem.js';
import { DeathSequence } from '../gameplay/DeathSequence.js';
import { HUD } from '../ui/HUD.js';

// import { AssetBrowser } from './AssetBrowser.js';

export class Game {
  constructor({ root }) {
    this.root = root;

    this.sceneManager = new SceneManager(root);
    this.assets = new AssetManager();
    this.collision = new CollisionManager();
    this.ui = new HUD(root);

    this.player = new PlayerController(
      this.sceneManager.camera,
      this.collision,
      this.ui
    );

    this.city = new CityBuilder(
      this.sceneManager.scene,
      this.assets,
      this.collision
    );

    this.missions = new MissionManager(this.sceneManager.scene, this.ui);

    this.deathSequence = new DeathSequence({
      scene: this.sceneManager.scene,
      sceneManager: this.sceneManager,
      player: this.player,
      ui: this.ui,
      assets: this.assets,
      collision: this.collision
    });

    this.traffic = new TrafficSystem(
      this.sceneManager.scene,
      this.collision,
      this.ui,
      this.player,
      this.assets,
      (car) => this.deathSequence.trigger(car)
    );

    this.loop = new GameLoop({
      clock: this.sceneManager.clock,
      update: (dt) => this.update(dt),
      render: () => this.sceneManager.render(),
    });
	
    // this.assetBrowser = new AssetBrowser(
    //   this.sceneManager.scene,
    //   this.sceneManager.camera,
    //   this.assets
    // );
  }

  async start() {
    this.sceneManager.addLights();

    await this.city.buildDowntown();
    // Стартовая точка проверяется на пересечение с городом уже ПОСЛЕ его
    // постройки — до этого коллизии от зданий/пропов ещё не существует, и
    // не от чего было бы отталкиваться.
    this.player.reset();

    // city.sidewalkLoops заполняется только во время buildDowntown() —
    // PedestrianSystem поэтому создаётся тут, а не в конструкторе вместе с
    // остальными системами.
    this.pedestrians = new PedestrianSystem(this.sceneManager.scene, this.assets, this.city.sidewalkLoops);
    await this.pedestrians.create();

    this.missions.start();
    await this.traffic.create();

    this.bindGlobalControls();

    this.loop.start();
  }

  bindGlobalControls() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyE') {
        this.missions.tryInteract(this.player.position);
      }

      if (event.code === 'KeyR') {
        this.player.reset();
      }
    });
  }

  update(dt) {

    this.player.enabled = true;

    this.player.update(dt);

    this.missions.update(dt, this.player.position);

    this.traffic.update(dt);
    this.pedestrians?.update(dt);
    this.deathSequence.update(dt);

    this.ui.drawMinimap(this.player, this.missions);

  }
}