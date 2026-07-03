export class HUD {
  constructor(root) {
    this.root = root;
    this.modalOpen = false;
    root.insertAdjacentHTML('beforeend', `
      <div class="hud">
        <div class="brand"><b>QUARTER CITY</b><span>Engine 0.1.0</span></div>
        <div class="objective"><b>CURRENT OBJECTIVE</b><p id="objectiveText">Загрузка...</p></div>
        <div class="health" id="health"></div>
        <canvas class="minimap" id="minimap" width="170" height="170"></canvas>
        <div class="controls"><b>Управление</b><br>Клик — захват мыши<br>WASD / стрелки — ходить<br>Мышь — обзор<br>E — миссия<br>P — телефон<br>Space — прыжок<br>R — старт</div>
        <div class="hint" id="hint"></div>
        <div class="toast" id="toast"></div>
        <div class="modal hidden" id="modal"></div>
      </div>
    `);
    this.objective = document.querySelector('#objectiveText');
    this.health = document.querySelector('#health');
    this.hint = document.querySelector('#hint');
    this.toast = document.querySelector('#toast');
    this.modal = document.querySelector('#modal');
    this.map = document.querySelector('#minimap');
    this.ctx = this.map.getContext('2d');
    this.setHealth(5);
  }

  blocksInput() { return this.modalOpen; }
  setObjective(text) { this.objective.textContent = text; }
  setInteractHint(text) { this.hint.textContent = text; this.hint.classList.toggle('visible', !!text); }
  setHealth(n) { this.health.innerHTML = Array.from({ length: 5 }, (_, i) => `<span>${i < n ? '♥' : '♡'}</span>`).join(''); }

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

  openCall({ caller, text, forced, onAccept, onDecline }) {
    this.modalOpen = true;
    document.exitPointerLock?.();
    this.modal.innerHTML = `
      <div class="phone-call">
        <div class="phone-top">Входящий звонок</div>
        <h1>${caller}</h1>
        <p>${text}</p>
        <button id="acceptCall">Взять трубку</button>
        ${forced ? '' : '<button class="danger" id="declineCall">Отклонить</button>'}
      </div>`;
    this.modal.classList.remove('hidden');
    this.modal.querySelector('#acceptCall').addEventListener('click', () => { this.closeModal(); onAccept(); });
    this.modal.querySelector('#declineCall')?.addEventListener('click', () => { this.closeModal(); onDecline(); });
  }

  closeModal() {
    this.modal.classList.add('hidden');
    this.modal.innerHTML = '';
    this.modalOpen = false;
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
