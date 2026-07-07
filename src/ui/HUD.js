import { isTouchDevice } from './device.js';

export class HUD {
  constructor(root) {
    this.root = root;
    this.modalOpen = false;
    // На тачскрине физической клавиатуры/мыши нет, а джойстик с кнопками
    // (TouchControls) и так занимают весь нижний угол экрана и самоочевидны
    // по виду — текстовая подсказка тут не нужна и просто перекрывалась бы
    // джойстиком на маленьком экране (проверено скриншотом на эмуляции
    // iPhone — коробка с текстом легла прямо поверх круга джойстика).
    const controlsHint = isTouchDevice()
      ? ''
      : '<div class="controls"><b>Управление</b><br>Клик — захват мыши<br>WASD / стрелки — ходить<br>Мышь — обзор<br>E — миссия<br>P — телефон<br>Space — прыжок<br>R — старт</div>';
    root.insertAdjacentHTML('beforeend', `
      <div class="hud">
        <div class="brand"><b>QUARTER CITY</b><span>Engine 0.1.0</span></div>
        <div class="objective"><b>CURRENT OBJECTIVE</b><p id="objectiveText">Загрузка...</p></div>
        <div class="health" id="health"></div>
        <canvas class="minimap" id="minimap" width="170" height="170"></canvas>
        ${controlsHint}
        <div class="hint" id="hint"></div>
        <div class="toast" id="toast"></div>
        <div class="modal hidden" id="modal"></div>
        <div class="blink-overlay" id="blinkOverlay"></div>
      </div>
    `);
    this.hudEl = root.querySelector('.hud');
    this.objective = document.querySelector('#objectiveText');
    this.health = document.querySelector('#health');
    this.hint = document.querySelector('#hint');
    this.toast = document.querySelector('#toast');
    this.modal = document.querySelector('#modal');
    this.blinkOverlay = document.querySelector('#blinkOverlay');
    this.map = document.querySelector('#minimap');
    this.ctx = this.map.getContext('2d');
    this.setHealth(5);
  }

  blocksInput() { return this.modalOpen; }
  setObjective(text) { this.objective.textContent = text; }
  setInteractHint(text) { this.hint.textContent = text; this.hint.classList.toggle('visible', !!text); }
  setHealth(n) { this.health.innerHTML = Array.from({ length: 5 }, (_, i) => `<span>${i < n ? '♥' : '♡'}</span>`).join(''); }

  // Мерцание/затухание при потере сердца — раньше об ударе машиной сообщал
  // только текстовый toast, не сам индикатор здоровья. Убираем и тут же
  // добавляем класс — reflow между ними нужен, чтобы анимация перезапускалась
  // и при повторном ударе до истечения предыдущей (иначе CSS-анимация с уже
  // добавленным классом не triggerится заново).
  pulseHeartLoss() {
    this.health.classList.remove('hit');
    void this.health.offsetWidth;
    this.health.classList.add('hit');
  }

  showToast(text) {
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('visible'), 1800);
  }

  openSlides(mission, onComplete) {
    this.modalOpen = true;
    let i = 0;
    const render = () => {
      const slide = mission.slides[i];
      this.modal.innerHTML = `
        <div class="card mission-card">
          <div class="eyebrow">MISSION</div>
          <h1>${mission.title}</h1>
          <h2>${slide.title}</h2>
          <p>${slide.text}</p>
          <div class="row">
            ${i > 0 ? '<button id="prevSlide">Назад</button>' : ''}
            <button id="nextSlide">${i === mission.slides.length - 1 ? 'Завершить миссию' : 'Далее'}</button>
          </div>
        </div>`;
      this.modal.classList.remove('hidden');
      this.modal.querySelector('#prevSlide')?.addEventListener('click', () => { i -= 1; render(); });
      this.modal.querySelector('#nextSlide').addEventListener('click', () => {
        if (i < mission.slides.length - 1) { i += 1; render(); return; }
        this.closeModal();
        onComplete();
      });
    };
    render();
  }

  // Раньше звонок выглядел как обычная карточка-модалка — той же формы, что
  // слайды миссий, ничем не намекая, что это именно телефон, и текст задания
  // был виден ДО ответа (в жизни ты не знаешь, о чём звонок, пока не взял
  // трубку). Теперь: (1) вместо кнопок-кружков — трек со свайпом (ручка
  // посередине, зона "принять" справа, "отклонить" слева, тянуть мышью),
  // (2) текст появляется только ПОСЛЕ ответа — отдельным "облачком" сбоку от
  // телефона, а не на самом экране звонка.
  openCall({ caller, text, forced, onAccept, onDecline }) {
    this.modalOpen = true;
    document.exitPointerLock?.();
    this.modal.classList.add('phone-modal');
    this.modal.innerHTML = `
      <div class="phone-call-layout">
        <div class="phone-shell">
          <div class="phone-notch"></div>
          <div class="phone-screen">
            <div class="phone-status">Входящий вызов</div>
            <div class="phone-avatar">${caller.charAt(0)}</div>
            <h1 class="phone-caller">${caller}</h1>
            <div class="phone-swipe-track" id="swipeTrack">
              <div class="phone-swipe-zone decline">✕</div>
              <div class="phone-swipe-zone accept">✓</div>
              <div class="phone-swipe-handle" id="swipeHandle">☏</div>
            </div>
            <div class="phone-hint">${forced ? 'Свайп вправо — ответить' : 'Свайп вправо — ответить, влево — отклонить'}</div>
          </div>
        </div>
        <div class="phone-bubble" id="phoneBubble">
          <div class="phone-bubble-arrow"></div>
          <p>${text}</p>
          <button id="continueCall">Продолжить</button>
        </div>
      </div>`;
    this.modal.classList.remove('hidden');

    const track = this.modal.querySelector('#swipeTrack');
    const handle = this.modal.querySelector('#swipeHandle');
    const bubble = this.modal.querySelector('#phoneBubble');

    this.setupPhoneSwipe(track, handle, {
      allowDecline: !forced,
      onAccept: () => {
        track.classList.add('answered');
        bubble.classList.add('visible');
      },
      onDecline: () => {
        track.classList.add('declined');
        setTimeout(() => { this.closeModal(); onDecline(); }, 220);
      }
    });

    this.modal.querySelector('#continueCall').addEventListener('click', () => {
      this.closeModal();
      onAccept();
    });
  }

  // Трек с ручкой посередине вместо клика по кнопке — тянешь мышью к одному
  // из краёв; не дотянул до 60% хода — ручка возвращается в центр (звонок
  // продолжает "звонить"), дотянул — принято/отклонено. pointerdown/move/up
  // вместо mouse-специфичных событий, чтобы то же самое работало и с
  // тачскрином без отдельной ветки логики.
  setupPhoneSwipe(track, handle, { allowDecline, onAccept, onDecline }) {
    const maxOffset = Math.max((track.clientWidth - handle.clientWidth) / 2 - 6, 10);
    const threshold = maxOffset * 0.6;
    let dragging = false;
    let settled = false;
    let startX = 0;
    let offset = 0;

    const setOffset = (v) => {
      offset = v;
      handle.style.transform = `translateX(calc(-50% + ${v}px))`;
    };

    handle.addEventListener('pointerdown', (e) => {
      if (settled) return;
      dragging = true;
      startX = e.clientX;
      handle.classList.add('dragging');
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      let next = e.clientX - startX;
      if (!allowDecline) next = Math.max(0, next);
      next = Math.max(-maxOffset, Math.min(maxOffset, next));
      setOffset(next);
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      if (offset > threshold) {
        settled = true;
        setOffset(maxOffset);
        onAccept();
      } else if (allowDecline && offset < -threshold) {
        settled = true;
        setOffset(-maxOffset);
        onDecline();
      } else {
        setOffset(0);
      }
    };
    handle.addEventListener('pointerup', release);
    handle.addEventListener('pointercancel', release);
  }

  closeModal() {
    this.modal.classList.add('hidden');
    this.modal.innerHTML = '';
    this.modal.classList.remove('failed', 'phone-modal');
    this.modalOpen = false;
  }

  // Экран смерти — визуальный, без отката прогресса миссий (в MissionManager
  // нет и не появляется понятия "провален" — это просто GTA-style "тебя
  // подобрали/откачали", а не полноценный fail-стейт).
  showMissionFailed(onContinue) {
    this.modalOpen = true;
    this.modal.classList.add('failed');
    this.modal.innerHTML = `
      <div class="card mission-failed">
        <div class="eyebrow">QUARTER CITY</div>
        <h1>MISSION FAILED</h1>
        <p>Тебя подобрали на районе. Батя К такое не одобряет.</p>
        <button id="reviveBtn">Продолжить</button>
      </div>`;
    this.modal.classList.remove('hidden');
    this.modal.querySelector('#reviveBtn').addEventListener('click', () => {
      this.closeModal();
      onContinue();
    });
  }

  // "Моргание" — быстрое затемнение в чёрное и обратно, callback выполняется
  // ровно в момент максимальной черноты (телепорт игрока в этот момент
  // невидим для игрока, а не резкий скачок картинки).
  blinkTransition(callback) {
    this.blinkOverlay.classList.add('closed');
    setTimeout(() => {
      callback();
      setTimeout(() => this.blinkOverlay.classList.remove('closed'), 40);
    }, 140);
  }

  showAchievement(text) {
    this.showToast(`🏆 ${text}`);
  }

  drawMinimap(player, missions) {
    const ctx = this.ctx;
    const w = this.map.width;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(3,8,18,.92)';
    ctx.beginPath(); ctx.arc(w/2, w/2, w/2 - 2, 0, Math.PI*2); ctx.fill();
    const scale = 0.78;
    const px = w/2 + player.position.x * scale;
    const pz = w/2 + player.position.z * scale;
    ctx.fillStyle = '#24f4ff'; ctx.beginPath(); ctx.arc(px, pz, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff2bd6';
    for (const marker of missions.markers.values()) {
      ctx.beginPath(); ctx.arc(w/2 + marker.position.x * scale, w/2 + marker.position.z * scale, 4, 0, Math.PI*2); ctx.fill();
    }
  }
}
