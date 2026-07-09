import { isTouchDevice } from './device.js';
import { CLIP_BASE } from '../config/assets.js';
import { AVENUES } from '../config/citypack.js';

const TEXT_VALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const TEXT_HALIGN_MARGIN = { left: '0 auto 0 0', center: '0 auto', right: '0 0 0 auto' };

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
      : '<div class="controls"><b>Управление</b><br>Клик — захват мыши<br>WASD / стрелки — ходить<br>Мышь — обзор<br>E — миссия<br>Space — прыжок<br>R — старт</div>';
    root.insertAdjacentHTML('beforeend', `
      <div class="hud">
        <div class="brand"><b>DUZ City</b><span>Версия 0.1.0</span></div>
        <div class="objective"><b>Куда идти</b><p id="objectiveText">Загрузка...</p></div>
        <div class="health" id="health"></div>
        <canvas class="minimap" id="minimap" width="170" height="170"></canvas>
        ${controlsHint}
        <div class="hint" id="hint"></div>
        <div class="toast" id="toast"></div>
        <div class="modal hidden" id="modal"></div>
        <div class="blink-overlay" id="blinkOverlay"></div>
        <div class="credits hidden" id="credits"></div>
      </div>
    `);
    this.hudEl = root.querySelector('.hud');
    this.objectiveBox = root.querySelector('.objective');
    this.objective = document.querySelector('#objectiveText');
    this.health = document.querySelector('#health');
    this.hint = document.querySelector('#hint');
    this.toast = document.querySelector('#toast');
    this.modal = document.querySelector('#modal');
    this.blinkOverlay = document.querySelector('#blinkOverlay');
    this.credits = document.querySelector('#credits');
    this.map = document.querySelector('#minimap');
    this.ctx = this.map.getContext('2d');
    this.setHealth(5);
  }

  blocksInput() { return this.modalOpen; }
  setObjective(text) { this.objective.textContent = text; }
  setInteractHint(text) { this.hint.textContent = text; this.hint.classList.toggle('visible', !!text); }

  // "Побродить по городу" — миссий/задач больше нет, поэтому и рамка
  // objective ("Куда идти") больше не нужна на экране, а не просто с
  // пустым текстом внутри.
  enterFreeRoam() {
    this.objectiveBox.classList.add('hidden');
  }
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

  // Схема слайда (все поля кроме title/text опциональны):
  // { title, text, bullets:[...], video, videoPosition:'left'|'right'|'top'|'bottom',
  //   videoSize:0-100, videoSpeed:число (по умолчанию 1.5x — экраны записи
  //   обычно снимаются в реальном темпе, ускорение делает их удобнее читать
  //   на слайде), textAlign:'left'|'center'|'right', textValign:'top'|'middle'|'bottom',
  //   textWidth:0-100, animation:'slide'|'fade', animationDirection:'left'|'right'|'up'|'down' }
  openSlides(mission, onComplete) {
    this.modalOpen = true;
    let i = 0;
    const render = () => {
      const slide = mission.slides[i];
      const vertical = slide.videoPosition === 'top' || slide.videoPosition === 'bottom';
      const mediaFirst = !slide.videoPosition || slide.videoPosition === 'left' || slide.videoPosition === 'top';
      const videoSize = slide.videoSize ?? 50;
      const videoSpeed = slide.videoSpeed ?? 1.5;
      const textAlign = slide.textAlign || 'left';
      const textValign = TEXT_VALIGN[slide.textValign] || 'flex-start';
      const textMargin = TEXT_HALIGN_MARGIN[textAlign] || TEXT_HALIGN_MARGIN.left;
      const textWidth = slide.textWidth ?? 100;
      const animClass = slide.animation === 'fade'
        ? 'mission-anim-fade'
        : slide.animation === 'slide'
          ? `mission-anim-slide-${slide.animationDirection || 'up'}`
          : '';

      const mediaHtml = slide.video ? `
        <div class="mission-card-media" style="order:${mediaFirst ? 0 : 1};${
          vertical ? `width:${videoSize}%;margin:0 auto;` : `flex:0 0 ${videoSize}%;`
        }">
          <video src="${CLIP_BASE}${slide.video}" autoplay muted loop playsinline></video>
        </div>` : '';

      const bulletsHtml = Array.isArray(slide.bullets) && slide.bullets.length
        ? `<ul class="mission-bullets">${slide.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`
        : '';

      const textHtml = `
        <div class="mission-card-text ${animClass}" style="order:${mediaFirst ? 1 : 0};justify-content:${textValign};${
          slide.video && !vertical ? `flex:0 0 ${100 - videoSize}%;` : ''
        }">
          <div class="mission-card-text-inner" style="width:${textWidth}%;margin:${textMargin};text-align:${textAlign};">
            <div class="eyebrow">Миссия</div>
            <h1>${mission.title}</h1>
            <h2>${slide.title}</h2>
            ${slide.text ? `<p>${slide.text}</p>` : ''}
            ${bulletsHtml}
          </div>
        </div>`;

      this.modal.innerHTML = `
        <div class="card mission-card">
          <div class="mission-card-content${vertical ? ' vertical' : ''}">
            ${mediaHtml}
            ${textHtml}
          </div>
          <div class="row">
            ${i > 0 ? '<button id="prevSlide">Назад</button>' : ''}
            <button id="nextSlide">${i === mission.slides.length - 1 ? 'Завершить миссию' : 'Далее'}</button>
          </div>
        </div>`;
      this.modal.classList.remove('hidden');
      // autoplay-атрибут ненадёжен для <video>, вставленного через innerHTML
      // (проверено — без явного play() ролик остаётся на первом кадре) —
      // запускаем вручную, ошибку игнорируем (например, если бы video был
      // не muted, play() мог бы быть отклонён политикой браузера).
      const mediaVideo = this.modal.querySelector('.mission-card-media video');
      if (mediaVideo) {
        mediaVideo.playbackRate = videoSpeed;
        mediaVideo.play().catch(() => {});
      }
      // Клик по видео — разворот на весь экран (position:fixed, см. CSS),
      // повторный клик по нему же — сворачивание обратно.
      this.modal.querySelector('.mission-card-media')?.addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('expanded');
      });
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
  // video (опционально) — кружочек с видео вместо/поверх аватара, как
  // видеосообщение в мессенджере: запускается прямо на экране звонка сразу
  // после ответа, без отдельного открытия слайдов/модалок.
  // onAnswer — срабатывает в момент свайпа (взял трубку), onAccept — в
  // момент клика "Продолжить"/"Положить трубку" (закрыл звонок). Разные
  // моменты: например, звонок должен переставать звонить сразу по свайпу,
  // а не только когда игрок дочитает текст и нажмёт кнопку.
  openCall({ caller, text, video, continueLabel = 'Продолжить', forced, onAnswer, onAccept, onDecline }) {
    this.modalOpen = true;
    document.exitPointerLock?.();
    this.modal.classList.add('phone-modal');
    this.modal.innerHTML = `
      <div class="phone-call-layout">
        <div class="phone-shell">
          <div class="phone-notch"></div>
          <div class="phone-screen">
            <div class="phone-status">Входящий вызов</div>
            <div class="phone-avatar" id="phoneAvatar">${caller.charAt(0)}</div>
            ${video ? `
              <div class="phone-video-circle" id="phoneVideoCircle">
                <video id="phoneVideoEl" src="${CLIP_BASE}${video}" playsinline loop></video>
              </div>` : ''}
            <h1 class="phone-caller">${caller}</h1>
            <div class="phone-swipe-track" id="swipeTrack">
              <div class="phone-swipe-zone decline">✕</div>
              <div class="phone-swipe-zone accept">✓</div>
              <div class="phone-swipe-handle" id="swipeHandle"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
            </div>
            <div class="phone-hint">${forced ? 'Свайп вправо — ответить' : 'Свайп вправо — ответить, влево — отклонить'}</div>
          </div>
        </div>
        <div class="phone-bubble" id="phoneBubble">
          <div class="phone-bubble-arrow"></div>
          ${text ? `<p>${text}</p>` : ''}
          <button id="continueCall">${continueLabel}</button>
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
        onAnswer?.();
        if (video) {
          this.modal.querySelector('#phoneAvatar')?.classList.add('hidden');
          this.modal.querySelector('#phoneVideoCircle')?.classList.add('visible');
          // Ответ свайпом — уже прямой user gesture, поэтому звук пробуем
          // включить сразу; если браузер всё равно отклонит (политика
          // автовоспроизведения) — тихо доигрываем без звука, а не молчим
          // совсем (см. похожий catch у слайдов миссий).
          const v = this.modal.querySelector('#phoneVideoEl');
          if (v) this.audio?.boostVideo(v);
          v?.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
        }
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
        <div class="eyebrow">DUZ City</div>
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

  // Финальные титры — строки появляются по очереди (задержка через
  // --i, см. .credits-line в CSS), а не все разом, чтобы читалось как
  // настоящие титры, а не список.
  // onContinue — вызывается по клику "Побродить по городу": титры не
  // единственный конец экрана, можно вернуться в свободный мир.  Кнопка
  // появляется с задержкой длиннее, чем у последней строки титров (см.
  // .credits-continue в CSS), чтобы не отвлекать от самих титров, пока они
  // ещё доигрывают.
  showCredits(lines, onContinue) {
    this.modalOpen = true;
    // Прячем игровой HUD (сердца/objective/миникарта/подсказки) — иначе
    // финальные титры выглядят как наложение поверх обычного геймплейного
    // экрана, а не отдельная кинематографичная сцена.
    this.hudEl.classList.add('credits-active');
    this.credits.innerHTML = `
      <div class="credits-eyebrow">DUZ City</div>
      <div class="credits-title">Спасибо</div>
      <div class="credits-list">
        ${lines.map((line, i) => `<p class="credits-line" style="--i:${i}">${line}</p>`).join('')}
      </div>
      <button class="credits-continue" id="creditsContinue">Побродить по городу</button>`;
    this.credits.classList.remove('hidden');
    this.credits.querySelector('#creditsContinue').addEventListener('click', () => {
      this.hideCredits();
      onContinue?.();
    });
  }

  hideCredits() {
    this.credits.classList.add('hidden');
    this.credits.innerHTML = '';
    this.hudEl.classList.remove('credits-active');
    this.modalOpen = false;
  }

  // Раньше карта была голым кругом с двумя точками — без улиц и кварталов
  // её было не соотнести с тем, что видно вокруг, и непонятно, куда идти.
  // Теперь рисуем реальную схему города: прямоугольники кварталов по той же
  // формуле (i+j)%3===0, что и CityBuilder.createBlocks (застройка/парк —
  // единственный источник истины, чтобы схема совпадала с настоящим
  // городом, не выдуманная сетка), стрелку игрока вместо точки, и маршрут
  // до маркера активной миссии, идущий по проспектам (двумя отрезками через
  // ближайшие к игроку и маркеру перекрёстки), а не напролом по диагонали
  // через кварталы. Canvas круглый только за счёт border-radius в CSS.
  drawMinimap(player, missions) {
    const ctx = this.ctx;
    const w = this.map.width;
    // Раньше карта была отцентрована на мировой (0,0) и умещала весь город
    // сразу — на 170px это 36 кварталов размером в пару пикселей, толком не
    // прочитать. Теперь центр карты — всегда игрок (мир скроллится под
    // ним), а viewRadius — сколько мировых юниц видно от центра до края
    // круга: 55 юниц ≈ 2 квартала в каждую сторону, то есть примерно 4
    // квартала одновременно в кадре, а не вся сетка 6х6.
    const viewRadius = 55;
    const scale = (w / 2 - 2) / viewRadius;
    const toCanvas = (x, z) => [w / 2 + (x - player.position.x) * scale, w / 2 + (z - player.position.z) * scale];
    const nearestAvenue = (v) => AVENUES.reduce((best, a) => Math.abs(a - v) < Math.abs(best - v) ? a : best, AVENUES[0]);

    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(3,8,18,.92)';
    ctx.beginPath(); ctx.arc(w/2, w/2, w/2 - 2, 0, Math.PI*2); ctx.fill();

    const inset = 1.5;
    for (let i = 0; i < AVENUES.length - 1; i++) {
      for (let j = 0; j < AVENUES.length - 1; j++) {
        const [x0, z0] = toCanvas(AVENUES[i], AVENUES[j]);
        const [x1, z1] = toCanvas(AVENUES[i + 1], AVENUES[j + 1]);
        ctx.fillStyle = (i + j) % 3 === 0 ? 'rgba(140,150,190,.4)' : 'rgba(70,160,100,.28)';
        ctx.fillRect(x0 + inset, z0 + inset, (x1 - x0) - inset * 2, (z1 - z0) - inset * 2);
      }
    }

    const [px, pz] = toCanvas(player.position.x, player.position.z);

    const activeMarker = missions.active && missions.markers.get(missions.active.id);
    if (activeMarker) {
      const [mx, mz] = toCanvas(activeMarker.position.x, activeMarker.position.z);
      const [pnx, pnz] = toCanvas(nearestAvenue(player.position.x), nearestAvenue(player.position.z));
      const [mnx, mnz] = toCanvas(nearestAvenue(activeMarker.position.x), nearestAvenue(activeMarker.position.z));
      ctx.strokeStyle = '#ffcf57';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(pnx, pnz);
      ctx.lineTo(pnx, mnz);
      ctx.lineTo(mnx, mnz);
      ctx.lineTo(mx, mz);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff2bd6';
      ctx.beginPath(); ctx.arc(mx, mz, 4, 0, Math.PI*2); ctx.fill();
    }

    // Треугольник по курсу камеры вместо точки — формула направления та же,
    // что для THREE.Camera с дефолтным взглядом вдоль -Z, повёрнутым на
    // rotation.y.
    const heading = player.camera.rotation.y;
    const dirX = -Math.sin(heading);
    const dirZ = -Math.cos(heading);
    const perpX = -dirZ;
    const perpZ = dirX;
    const size = 7;
    ctx.fillStyle = '#24f4ff';
    ctx.beginPath();
    ctx.moveTo(px + dirX * size, pz + dirZ * size);
    ctx.lineTo(px - dirX * size * 0.6 + perpX * size * 0.6, pz - dirZ * size * 0.6 + perpZ * size * 0.6);
    ctx.lineTo(px - dirX * size * 0.6 - perpX * size * 0.6, pz - dirZ * size * 0.6 - perpZ * size * 0.6);
    ctx.closePath();
    ctx.fill();
  }
}
