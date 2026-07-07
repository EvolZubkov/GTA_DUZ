// Виртуальный джойстик (движение) + перетаскивание пальцем по правой части
// экрана (обзор) + кнопки прыжка/взаимодействия — замена WASD+мышь+E+Space
// на тачскрине, где ни pointer lock, ни физическая клавиатура недоступны.
// Строится через PlayerController.setMoveAxis()/applyLook()/requestJump() —
// те же точки входа, что уже используют клавиатура и мышь, чтобы не вести
// вторую копию логики движения/поворота камеры.
const JOYSTICK_RADIUS = 52; // px, максимальный ход ручки от центра
const LOOK_SENSITIVITY = 0.006; // выше, чем у мыши (0.0022) — экран мал, палец не может "прокрутить" далеко

export class TouchControls {
  constructor(hudEl, player, missions) {
    this.player = player;
    this.missions = missions;
    this.moveTouchId = null;
    this.lookTouchId = null;
    this.lookLast = { x: 0, y: 0 };

    // afterbegin — рендерится ПЕРВЫМ ребёнком .hud, поэтому более поздние по
    // разметке элементы (модалки звонка/миссий, blink-overlay) по обычному
    // стекингу оказываются НАД контролами: открытый звонок не даёт джойстику
    // "просвечивать" рядом с картой звонка.
    hudEl.insertAdjacentHTML('afterbegin', `
      <div class="touch-controls" id="touchControls">
        <div class="touch-look-zone" id="touchLookZone"></div>
        <div class="touch-joystick" id="touchJoystick">
          <div class="touch-joystick-knob" id="touchJoystickKnob"></div>
        </div>
        <div class="touch-buttons">
          <button class="touch-btn" id="touchInteract" title="Взаимодействие">E</button>
          <button class="touch-btn touch-btn-jump" id="touchJump" title="Прыжок">⤴</button>
        </div>
      </div>
    `);

    this.root = hudEl.querySelector('#touchControls');
    this.joystick = hudEl.querySelector('#touchJoystick');
    this.knob = hudEl.querySelector('#touchJoystickKnob');
    this.lookZone = hudEl.querySelector('#touchLookZone');
    this.interactBtn = hudEl.querySelector('#touchInteract');
    this.jumpBtn = hudEl.querySelector('#touchJump');

    this.setupJoystick();
    this.setupLook();
    this.setupButtons();
  }

  blocked() {
    return this.player.ui.blocksInput();
  }

  setupJoystick() {
    let originX = 0;
    let originY = 0;

    this.joystick.addEventListener('pointerdown', (e) => {
      if (this.blocked() || this.moveTouchId !== null) return;
      this.moveTouchId = e.pointerId;
      const rect = this.joystick.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
      this.joystick.setPointerCapture(e.pointerId);
    });

    this.joystick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.moveTouchId) return;
      let dx = e.clientX - originX;
      let dy = e.clientY - originY;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS;
        dy = (dy / dist) * JOYSTICK_RADIUS;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // Экранное "вверх" (dy < 0) — движение вперёд, поэтому знак у dy инвертирован.
      this.player.setMoveAxis(dx / JOYSTICK_RADIUS, -dy / JOYSTICK_RADIUS);
    });

    const release = (e) => {
      if (e.pointerId !== this.moveTouchId) return;
      this.moveTouchId = null;
      this.knob.style.transform = 'translate(0px, 0px)';
      this.player.setMoveAxis(0, 0);
    };
    this.joystick.addEventListener('pointerup', release);
    this.joystick.addEventListener('pointercancel', release);
  }

  setupLook() {
    this.lookZone.addEventListener('pointerdown', (e) => {
      if (this.blocked() || this.lookTouchId !== null) return;
      this.lookTouchId = e.pointerId;
      this.lookLast.x = e.clientX;
      this.lookLast.y = e.clientY;
      this.lookZone.setPointerCapture(e.pointerId);
    });

    this.lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookTouchId) return;
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast.x = e.clientX;
      this.lookLast.y = e.clientY;
      this.player.applyLook(dx, dy, LOOK_SENSITIVITY);
    });

    const release = (e) => {
      if (e.pointerId !== this.lookTouchId) return;
      this.lookTouchId = null;
    };
    this.lookZone.addEventListener('pointerup', release);
    this.lookZone.addEventListener('pointercancel', release);
  }

  setupButtons() {
    this.jumpBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.blocked()) return;
      this.player.requestJump();
    });
    this.interactBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.blocked()) return;
      this.missions.tryInteract(this.player.position);
    });
  }
}
