import * as THREE from 'three';
import { CREDITS } from '../config/credits.js';

const FLYOUT_DURATION = 7;
const FLYOUT_OFFSET = new THREE.Vector3(70, 95, 70);

// Финал квартала: игрок заблокирован (как в DeathSequence), камера медленно
// отлетает по диагонали вверх над городом (ease-out, а не линейно — плавнее
// смотрится на длинной дистанции), поверх — HUD.showCredits() показывает
// список благодарностей построчно с задержкой (сама раскадровка текста —
// забота CSS, см. .credits-line в styles.css).
export class CreditsSequence {
  constructor({ sceneManager, player, ui, audio }) {
    this.sceneManager = sceneManager;
    this.player = player;
    this.ui = ui;
    this.audio = audio;

    this.active = false;
    this.origin = new THREE.Vector3();
    this.cameraFrom = new THREE.Vector3();
    this.cameraTo = new THREE.Vector3();
    this.t = 0;
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.player.locked = true;
    document.exitPointerLock?.();

    this.origin.copy(this.player.position);
    this.cameraFrom.copy(this.sceneManager.camera.position);
    this.cameraTo.copy(this.origin).add(FLYOUT_OFFSET);
    this.t = 0;

    this.ui.showCredits(CREDITS, () => this.continueRoaming());
    this.audio?.playCredits();
  }

  update(dt) {
    if (!this.active || this.t >= 1) return;
    this.t = Math.min(this.t + dt / FLYOUT_DURATION, 1);
    const eased = 1 - (1 - this.t) * (1 - this.t);
    this.sceneManager.camera.position.lerpVectors(this.cameraFrom, this.cameraTo, eased);
    this.sceneManager.camera.lookAt(this.origin.x, this.origin.y, this.origin.z);
  }

  // "Побродить по городу" — титры не единственный конец: возвращаем камеру
  // из режима отлёта в обычный вид от первого лица (teleport на ту же
  // позицию — игрок физически никуда не двигался, пока был заблокирован,
  // так что это просто самый надёжный способ сбросить камеру, не дублируя
  // её логику отдельно) и снимаем блокировку — дальше свободный геймплей.
  continueRoaming() {
    this.active = false;
    this.player.teleport(this.player.position.x, this.player.position.z);
    this.player.locked = false;
    this.audio?.stopCredits();
    // Миссий больше нет — рамка objective ("Куда идти"/"Quarter passed")
    // на экране без дела, убираем совсем, чтобы не мешала свободной
    // прогулке.
    this.ui.enterFreeRoam();
  }
}
