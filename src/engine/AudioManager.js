import { AUDIO_BASE } from '../config/assets.js';
import { AUDIO_FILES, MISSION_VOICE, JUMP_SEGMENTS, VOLUME } from '../config/audio.js';

// Браузеры блокируют autoplay со звуком до первого жеста пользователя —
// фон/шум города запускаются не в конструкторе напрямую, а по первому
// pointerdown где угодно на странице (тот же клик, что и запрос pointer
// lock в PlayerController, но не завязан на него — работает и на тачскрине).
export class AudioManager {
  constructor() {
    this.music = this.createLoop(AUDIO_FILES.music, VOLUME.music);
    this.cityNoise1 = this.createLoop(AUDIO_FILES.cityNoise1, VOLUME.city);
    this.cityNoise2 = this.createLoop(AUDIO_FILES.cityNoise2, VOLUME.city);
    this.ringtone = this.createLoop(AUDIO_FILES.ringtone, 1);
    this.credits = this.createLoop(AUDIO_FILES.credits, VOLUME.credits);
    this.alert = new Audio(this.url(AUDIO_FILES.alert));
    this.jump = new Audio(this.url(AUDIO_FILES.jump));
    this.jump.volume = VOLUME.sfx;
    this.running = this.createLoop(AUDIO_FILES.running, VOLUME.sfx);
    this.achievement = new Audio(this.url(AUDIO_FILES.achievement));
    this.achievement.volume = VOLUME.sfx;

    document.addEventListener('pointerdown', () => this.unlock(), { once: true });
  }

  url(file) {
    return AUDIO_BASE + encodeURIComponent(file);
  }

  createLoop(file, volume) {
    const audio = new Audio(this.url(file));
    audio.loop = true;
    audio.volume = volume;
    return audio;
  }

  unlock() {
    this.music.play().catch(() => {});
    this.cityNoise1.play().catch(() => {});
    this.cityNoise2.play().catch(() => {});
  }

  playRingtone() {
    this.ringtone.currentTime = 0;
    this.ringtone.play().catch(() => {});
  }

  stopRingtone() {
    this.ringtone.pause();
    this.ringtone.currentTime = 0;
  }

  playAlert() {
    this.alert.currentTime = 0;
    this.alert.play().catch(() => {});
  }

  // Озвучка звонка после ответа — новый Audio на каждый вызов, а не общий
  // this.voice, потому что игрок может (в теории) быстро проскочить
  // несколько звонков подряд, и старая озвучка не должна обрываться чужим
  // play() на переиспользуемом элементе.
  playMissionVoice(missionId) {
    const file = MISSION_VOICE[missionId];
    if (!file) return;
    new Audio(this.url(file)).play().catch(() => {});
  }

  // jumping-on-the-grass.mp3 — один файл из ~26 коротких звуков подряд (см.
  // JUMP_SEGMENTS) — на каждый прыжок выбираем случайный отрезок и
  // проигрываем только его, а не всю дорожку. Таймер остановки — самый
  // простой способ ограничить длительность одним <audio> без Web Audio.
  playJump() {
    const seg = JUMP_SEGMENTS[Math.floor(Math.random() * JUMP_SEGMENTS.length)];
    this.jump.currentTime = seg.start;
    this.jump.play().catch(() => {});
    clearTimeout(this.jumpStopTimer);
    this.jumpStopTimer = setTimeout(() => this.jump.pause(), seg.duration * 1000);
  }

  // Зациклённый бег — старт/стоп по факту движения (см.
  // PlayerController.update), .paused-проверка защищает от рестарта
  // (currentTime сброс) на каждый кадр, пока игрок продолжает идти.
  playRunning() {
    if (!this.running.paused) return;
    this.running.currentTime = 0;
    this.running.play().catch(() => {});
  }

  stopRunning() {
    this.running.pause();
    this.running.currentTime = 0;
  }

  playAchievement() {
    this.achievement.currentTime = 0;
    this.achievement.play().catch(() => {});
  }

  // Титры: фоновая музыка выключается, звуки города остаются, поверх —
  // отдельный трек концовки.
  playCredits() {
    this.music.pause();
    this.credits.currentTime = 0;
    this.credits.play().catch(() => {});
  }

  // "Побродить по городу" — обратный переход: трек титров выключается,
  // обычная фоновая музыка возобновляется (city-ambience и так всё это
  // время не прерывалась, её не трогаем).
  stopCredits() {
    this.credits.pause();
    this.music.play().catch(() => {});
  }

  // video.volume — нативный максимум 1.0 (100% от исходной записи), этого
  // не хватает, если сама запись тихая. Единственный способ реально
  // усилить звук выше оригинала — прогнать через Web Audio GainNode с
  // gain > 1. createMediaElementSource можно вызвать только ОДИН раз за
  // жизнь элемента — не проблема, т.к. HUD.openCall создаёт новый <video>
  // при каждом рендере звонка. После вызова звук идёт только через граф
  // Web Audio, поэтому обязательно соединяем с destination, иначе будет
  // тишина вместо усиления.
  boostVideo(videoEl, gain = 5.5) {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.audioCtx.resume?.();
      const source = this.audioCtx.createMediaElementSource(videoEl);
      const gainNode = this.audioCtx.createGain();
      gainNode.gain.value = gain;
      source.connect(gainNode).connect(this.audioCtx.destination);
    } catch (error) {
      console.warn('Video gain boost failed:', error);
    }
  }
}
