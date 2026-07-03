const UI = (() => {
  const $ = id => document.getElementById(id);
  let mapVisible = true; let activeMission = null; let slideIndex = 0; const achievements = [];
  function showGame(){ ['hud','objective','help','minimap'].forEach(id=>$(id).classList.remove('hidden')); setHealth(5,5); if(!$('crosshair')) document.body.insertAdjacentHTML('beforeend','<div class="crosshair" id="crosshair"></div>'); const close=$('phoneClose'); if(close && !close.dataset.ready){ close.dataset.ready='1'; close.addEventListener('click', closePhone); } }

  function setHealth(value, max=5){
    const el = $('health'); if(!el) return;
    const full = Math.max(0, Math.min(max, value));
    el.innerHTML = Array.from({length:max}, (_,i)=>`<span class="heart ${i<full?'full':'empty'}">♥</span>`).join('');
  }
  function showDamageToast(text='-1 HEART'){
    const toast = document.createElement('div'); toast.className='damage-toast'; toast.textContent=text; document.body.appendChild(toast);
    setTimeout(()=>toast.classList.add('show'), 20); setTimeout(()=>toast.classList.remove('show'), 900); setTimeout(()=>toast.remove(), 1250);
  }
  function showRespawn(){
    const toast = document.createElement('div'); toast.className='respawn-toast'; toast.innerHTML='<b>RESPAWN</b><span>Сердечки восстановлены</span>'; document.body.appendChild(toast);
    setTimeout(()=>toast.classList.add('show'), 20); setTimeout(()=>toast.classList.remove('show'), 1800); setTimeout(()=>toast.remove(), 2300);
  }

  function showDeath(duration=7){
    let el = document.getElementById('deathOverlay');
    if(!el){
      el = document.createElement('div');
      el.id = 'deathOverlay';
      el.className = 'death-overlay hidden';
      el.innerHTML = '<div class="dead-title">DEAD</div><div class="dead-subtitle">Respawn in <span id="deathTimer">7</span>s</div>';
      document.body.appendChild(el);
    }
    el.classList.remove('hidden');
    document.body.classList.add('ui-mode');
    const timer = document.getElementById('deathTimer');
    const started = performance.now();
    const tick = () => {
      if(el.classList.contains('hidden')) return;
      const left = Math.max(0, Math.ceil(duration - (performance.now()-started)/1000));
      timer.textContent = left;
      if(left > 0) requestAnimationFrame(tick);
    };
    tick();
  }
  function hideDeath(){
    const el = document.getElementById('deathOverlay');
    if(el) el.classList.add('hidden');
    document.body.classList.remove('ui-mode');
  }

  function setPrompt(show){ $('prompt').classList.toggle('hidden',!show); }
  function setObjective(text){ $('objectiveText').textContent = text; }
  function renderMissionSlide(){
    const s = activeMission.slides[slideIndex];
    $('missionStatus').textContent = s.kicker;
    $('missionTitle').textContent = s.title;
    $('missionDesc').textContent = s.text;
    $('missionReward').textContent = slideIndex === activeMission.slides.length-1 ? activeMission.reward : `Слайд ${slideIndex+1}/${activeMission.slides.length}`;
    $('missionNext').textContent = slideIndex === activeMission.slides.length-1 ? 'ЗАВЕРШИТЬ МИССИЮ' : 'ДАЛЬШЕ';
    $('missionDots').innerHTML = activeMission.slides.map((_,i)=>`<span class="${i===slideIndex?'active':''}"></span>`).join('');
  }
  function showMission(m){ activeMission = m; slideIndex = 0; renderMissionSlide(); $('missionOverlay').classList.remove('hidden'); document.body.classList.add('ui-mode'); }
  function nextMissionSlide(){
    if(!activeMission) return {finished:false};
    if(slideIndex < activeMission.slides.length-1){ slideIndex++; renderMissionSlide(); return {finished:false}; }
    const finished = activeMission; activeMission = null; $('missionOverlay').classList.add('hidden'); document.body.classList.remove('ui-mode'); return {finished:true, mission:finished};
  }
  function closeMission(){ $('missionOverlay').classList.add('hidden'); document.body.classList.remove('ui-mode'); activeMission=null; }
  function addAchievement(m){
    achievements.push(m.achievement);
    const toast = document.createElement('div'); toast.className='achievement-toast'; toast.innerHTML=`<b>🏆 ACHIEVEMENT UNLOCKED</b><span>${m.achievement}</span>`; document.body.appendChild(toast);
    setTimeout(()=>toast.classList.add('show'), 30); setTimeout(()=>toast.classList.remove('show'), 3600); setTimeout(()=>toast.remove(), 4300);
    updateAchievements();
  }
  function updateAchievements(){
    const list = $('achievementsList'); if(!list) return;
    list.innerHTML = achievements.length ? achievements.map(a=>`<div class="achievement-item">🏆 ${a}</div>`).join('') : '<div class="achievement-empty">Ачивок пока нет</div>';
  }
  function closePhone(){ $('phone').classList.add('hidden'); document.body.classList.remove('ui-mode'); return false; }
  function phoneIsOpen(){ return !$('phone').classList.contains('hidden'); }
  function togglePhone(missions, progress){
    const phone = $('phone');
    if(!phone.classList.contains('hidden')) return closePhone();
    phone.classList.remove('hidden');
    document.body.classList.add('ui-mode');
    const list = $('phoneList'); list.innerHTML='';
    missions.forEach(m=>{
      const isDone = progress.done.includes(m.id);
      const isUnlocked = progress.unlocked?.includes(m.id);
      const div=document.createElement('div');
      div.className='phone-item';
      const icon = isDone ? '✅' : (isUnlocked ? '🎯' : '🔒');
      const text = isDone ? 'Mission passed · '+m.achievement : (isUnlocked ? m.desc : 'Ожидайте звонок от Бати К');
      div.innerHTML=`<b>${icon} ${m.title}</b><span>${text}</span>`;
      list.appendChild(div);
    });
    updateAchievements();
    return true;
  }

  let ringTimer = null;
  let audioCtx = null;
  let lastCallKey = '';
  function ensureCallOverlay(){
    let el = $('callOverlay');
    if(el) return el;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="callOverlay" class="call-overlay hidden">
        <div class="incoming-phone">
          <div class="call-screen-glow"></div>
          <div id="callBadge" class="call-badge">INCOMING CALL</div>
          <div class="caller-avatar">К</div>
          <div id="callCaller" class="call-caller">Батя К</div>
          <div id="callMessage" class="call-message">Звонок...</div>
          <div id="callMission" class="call-mission"></div>
          <div class="call-actions" id="callActions">
            <button id="callAccept" class="call-accept">ВЗЯТЬ ТРУБКУ</button>
            <button id="callDecline" class="call-decline">ОТКЛОНИТЬ</button>
          </div>
          <button id="callHangup" class="call-hangup hidden">ПОЛОЖИТЬ ТРУБКУ</button>
        </div>
      </div>`);
    return $('callOverlay');
  }
  function beep(){
    try{
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = 740;
      gain.gain.setValueAtTime(.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.05, audioCtx.currentTime+.03);
      gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime+.22);
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime+.24);
    }catch(e){}
  }
  function startRing(){ stopRing(); beep(); ringTimer = setInterval(beep, 850); }
  function stopRing(){ if(ringTimer){ clearInterval(ringTimer); ringTimer = null; } }
  function showCall(call){
    const el = ensureCallOverlay();
    if(!call){ hideCall(); return; }
    const key = `${call.id}-${call.state}-${call.attempt}-${call.forced}`;
    el.classList.remove('hidden'); document.body.classList.add('ui-mode');
    $('callCaller').textContent = call.caller || 'Батя К';
    $('callMission').textContent = call.state === 'talking' ? `Задание: ${call.missionTitle}` : `Попытка звонка: ${call.attempt}`;
    $('callBadge').textContent = call.state === 'talking' ? 'CALL CONNECTED' : (call.forced ? 'ВАЖНЫЙ ЗВОНОК' : 'INCOMING CALL');
    $('callMessage').textContent = call.state === 'talking' ? (call.text || 'Есть работа.') : (call.angryMessage || 'Входящий звонок. Надо ответить.');
    $('callActions').classList.toggle('hidden', call.state === 'talking');
    $('callDecline').classList.toggle('hidden', !!call.forced);
    $('callHangup').classList.toggle('hidden', call.state !== 'talking');
    if(call.state === 'ringing' && lastCallKey !== key) startRing();
    if(call.state === 'talking') stopRing();
    lastCallKey = key;
  }
  function hideCall(){ const el=$('callOverlay'); if(el) el.classList.add('hidden'); stopRing(); lastCallKey=''; document.body.classList.remove('ui-mode'); }
  function callIsOpen(){ const el=$('callOverlay'); return !!el && !el.classList.contains('hidden'); }

  function toggleMap(){ mapVisible = !mapVisible; $('minimap').classList.toggle('hidden',!mapVisible); }
  function drawMap(camera, missions, colliders, dynamic, progress, bounds){
    const c=$('minimap'); if(c.classList.contains('hidden')) return; const ctx=c.getContext('2d'); const W=c.width,H=c.height; ctx.clearRect(0,0,W,H);
    ctx.save(); ctx.beginPath(); ctx.arc(W/2,H/2,Math.min(W,H)/2-2,0,Math.PI*2); ctx.clip();
    ctx.fillStyle='rgba(8,12,18,.86)'; ctx.fillRect(0,0,W,H);
    const scale = W / bounds.size; const sx=x=>(x-bounds.min)*scale; const sz=z=>(z-bounds.min)*scale;
    ctx.fillStyle='rgba(255,255,255,.08)'; colliders.forEach(o=>{ if(o.label==='border') return; ctx.fillRect(sx(o.x-o.w/2),sz(o.z-o.d/2),o.w*scale,o.d*scale); });
    ctx.fillStyle='rgba(40,245,255,.45)'; dynamic.forEach(o=>{ ctx.fillRect(sx(o.x-o.w/2),sz(o.z-o.d/2),Math.max(2,o.w*scale),Math.max(2,o.d*scale)); });
    missions.forEach(m=>{ if(progress.done.includes(m.id) || !(progress.unlocked||[]).includes(m.id)) return; ctx.beginPath(); ctx.fillStyle='#ff3acb'; ctx.arc(sx(m.x),sz(m.z),4,0,Math.PI*2); ctx.fill(); });
    ctx.beginPath(); ctx.fillStyle='#28f5ff'; ctx.arc(sx(camera.position.x),sz(camera.position.z),5,0,Math.PI*2); ctx.fill();
    ctx.restore(); ctx.beginPath(); ctx.strokeStyle='rgba(255,255,255,.28)'; ctx.lineWidth=2; ctx.arc(W/2,H/2,Math.min(W,H)/2-2,0,Math.PI*2); ctx.stroke();
  }
  return { showGame, setPrompt, setObjective, setHealth, showDamageToast, showRespawn, showDeath, hideDeath, showMission, nextMissionSlide, closeMission, addAchievement, togglePhone, closePhone, phoneIsOpen, showCall, hideCall, callIsOpen, toggleMap, drawMap }; 
})();
