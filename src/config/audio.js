export const AUDIO_FILES = {
  music: 'zakat-nad-vays-siti-37-2bb1fd.mp3',
  cityNoise1: 'city-noise.mp3',
  cityNoise2: 'ulica.mp3',
  ringtone: 'ringtone.mp3',
  alert: 'alert-sound-on-mobile-phone.mp3',
  credits: 'audio [music].mp3',
  jump: 'jumping-on-the-grass.mp3',
  running: 'running-on-concrete.mp3',
  // Файл в задаче был указан как running-on-concrete.mp3 (дубль пункта 3,
  // явная опечатка) — по факту в assets/saund при этом же заходе появился
  // отдельный short-джингл svetilo-dobyito--siyanie.mp3 ("добыто, сияние"),
  // который по названию и длительности (2с) однозначно и есть звук ачивки.
  achievement: 'svetilo-dobyito--siyanie.mp3'
};

// jumping-on-the-grass.mp3 — один трек из ~26 коротких звуков подряд, а не
// один сэмпл. Границы вычислены один раз через ffmpeg silencedetect
// (noise=-40dB, d=0.2s) с небольшим паддингом (-0.02с/+0.15с), чтобы не
// обрезать атаку/хвост — при воспроизведении случайно выбираем один
// сегмент, а не весь файл целиком.
export const JUMP_SEGMENTS = [
  { start: 0, duration: 0.314 },
  { start: 0.986, duration: 0.258 },
  { start: 2.093, duration: 0.272 },
  { start: 3.071, duration: 0.235 },
  { start: 3.995, duration: 0.25 },
  { start: 4.931, duration: 0.273 },
  { start: 5.7, duration: 0.266 },
  { start: 6.69, duration: 0.263 },
  { start: 7.414, duration: 0.282 },
  { start: 8.476, duration: 0.266 },
  { start: 9.55, duration: 0.276 },
  { start: 10.335, duration: 0.271 },
  { start: 11.404, duration: 0.361 },
  { start: 12.215, duration: 0.267 },
  { start: 13.024, duration: 0.273 },
  { start: 14.237, duration: 0.273 },
  { start: 14.908, duration: 0.249 },
  { start: 15.761, duration: 0.249 },
  { start: 16.563, duration: 0.236 },
  { start: 17.53, duration: 0.279 },
  { start: 18.381, duration: 0.262 },
  { start: 19.364, duration: 0.252 },
  { start: 20.231, duration: 0.31 },
  { start: 20.95, duration: 0.243 },
  { start: 21.801, duration: 0.258 },
  { start: 22.612, duration: 0.262 }
];

// Ключ — id миссии из missions.json, файл — озвучка звонка после ответа.
export const MISSION_VOICE = {
  mailing: 'mailing.WAV',
  'skillum-templates': 'skillum-templates.WAV',
  'skillum-scales': 'skillum-scales.WAV',
  'webtutor-cooldown': 'webtutor-cooldown.WAV',
  'b2b-reports': 'b2b-reports.WAV',
  'mailing-rescue': 'mailing-rescue.WAV'
};

export const VOLUME = {
  music: 0.02,
  city: 0.2,
  sfx: 0.35,
  // Финальный трек в титрах — отдельная громкость от фоновой музыки
  // геймплея, специально громче остального (акцент на концовке).
  credits: 0.5
};
