(() => {
  const canvas = document.createElement('canvas'); canvas.className='webgl'; document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true}); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); renderer.setSize(window.innerWidth,window.innerHeight); renderer.shadowMap.enabled=true; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, .1, 900);
  World.create(scene, Missions.list); Player.setup(camera);
  if(location.protocol === 'file:'){ document.getElementById('fileWarning')?.classList.remove('hidden'); }
  // В v8 на карте изначально видна только вводная миссия. Остальные появляются после звонков.
  World.missionObjects.forEach(g => g.visible = Missions.visibleIds().includes(g.userData.id));

  const clock = new THREE.Clock(); let started = false;
  let health = 5; const maxHealth = 5; let damageCooldown = 0;
  let deathState = null;
  let lastCallRef = null;

  document.getElementById('startBtn').addEventListener('click',()=>{
    document.getElementById('startScreen').classList.add('hidden');
    UI.showGame(); started=true; document.body.requestPointerLock?.();
  });

  const bindLater = () => {
    const accept = document.getElementById('callAccept');
    const decline = document.getElementById('callDecline');
    const hang = document.getElementById('callHangup');
    if(accept && !accept.dataset.ready){
      accept.dataset.ready = '1';
      accept.addEventListener('click', () => { Missions.acceptCall(); UI.showCall(Missions.callInfo()); });
    }
    if(decline && !decline.dataset.ready){
      decline.dataset.ready = '1';
      decline.addEventListener('click', () => { Missions.declineCall(); UI.hideCall(); Player.clearMovement(); });
    }
    if(hang && !hang.dataset.ready){
      hang.dataset.ready = '1';
      hang.addEventListener('click', () => {
        const mission = Missions.finishCall();
        if(mission){
          World.setMissionMarkerActive(mission.id, true);
          UI.setObjective(`Новое задание на карте: ${mission.title}`);
          UI.showDamageToast('NEW MISSION');
        }
        UI.hideCall();
      });
    }
  };

  function overlayHidden(){ return document.getElementById('missionOverlay').classList.contains('hidden'); }
  function phoneHidden(){ return document.getElementById('phone').classList.contains('hidden'); }
  function callHidden(){ return !UI.callIsOpen(); }
  function gameIsInteractive(){ return started && !deathState && overlayHidden() && phoneHidden() && callHidden(); }

  document.body.addEventListener('click',()=>{ if(gameIsInteractive()) document.body.requestPointerLock?.(); });

  document.getElementById('missionNext').addEventListener('click',()=>{
    const res = UI.nextMissionSlide();
    if(res.finished){
      const done = Missions.complete();
      if(done){
        World.removeMissionMarker(done.id);
        UI.addAchievement(done);
        if(done.id === 'intro') UI.setObjective('Телефон получен. Ждите звонок от Бати К.');
      }
    }
  });

  function startDeathSequence(){
    const deathPos = camera.position.clone();
    const yaw = Player.getYaw();
    deathState = {
      t: 0,
      duration: 7,
      body: World.spawnDeathBody(scene, deathPos, yaw),
      bodyPos: new THREE.Vector3(deathPos.x, .55, deathPos.z),
      startPos: new THREE.Vector3(deathPos.x, 2.2, deathPos.z),
      endPos: new THREE.Vector3(deathPos.x + Math.sin(yaw) * 15, 9.5, deathPos.z + Math.cos(yaw) * 15)
    };
    Player.clearMovement();
    document.exitPointerLock?.();
    UI.setPrompt(false);
    UI.showDeath(7);
  }

  function updateDeathCamera(dt){
    if(!deathState) return;
    deathState.t += dt;
    const p = Math.min(1, deathState.t / deathState.duration);
    const eased = 1 - Math.pow(1 - p, 3);
    camera.position.lerpVectors(deathState.startPos, deathState.endPos, eased);
    camera.lookAt(deathState.bodyPos);
    if(deathState.t >= deathState.duration){
      World.clearDeathBody(scene);
      UI.hideDeath();
      health = maxHealth;
      UI.setHealth(health, maxHealth);
      Player.respawn(camera);
      UI.showRespawn();
      deathState = null;
    }
  }

  window.addEventListener('resize',()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight); });

  function processGlobalKeys(){
    if(!started || deathState) return;
    if(overlayHidden() && callHidden() && Player.isKeyPressed('phone')){
      Player.clearKey('phone');
      const opened = UI.togglePhone(Missions.list, Missions.progress());
      if(opened){ Player.clearMovement(); document.exitPointerLock?.(); }
    }
    if(overlayHidden() && callHidden() && Player.isKeyPressed('map')){
      Player.clearKey('map'); UI.toggleMap();
    }
    if(overlayHidden() && callHidden() && Player.isKeyPressed('reset')){
      Player.clearKey('reset'); Player.respawn(camera); UI.showDamageToast('RESPAWN');
    }
  }

  function loop(){ requestAnimationFrame(loop); const dt = Math.min(clock.getDelta(), .05);
    if(started){
      World.update(dt);

      const call = Missions.callInfo();
      if(call !== lastCallRef){ UI.showCall(call); bindLater(); if(call) { Player.clearMovement(); document.exitPointerLock?.(); } lastCallRef = call; }

      if(deathState){ updateDeathCamera(dt); renderer.render(scene,camera); return; }

      processGlobalKeys();
      damageCooldown = Math.max(0, damageCooldown - dt);
      if(gameIsInteractive()){
        const allColliders = [...World.colliders, ...World.dynamicColliders()];
        Player.update(camera, dt, allColliders, true);
        const hitCar = Player.overlapsAny(camera, World.movingCarColliders());
        if(hitCar && damageCooldown <= 0){
          health -= 1; damageCooldown = 1.2;
          UI.setHealth(health, maxHealth); UI.showDamageToast('−1 ♥');
          Player.knockBackFrom(camera, hitCar);
          if(health <= 0){ health = 0; UI.setHealth(health, maxHealth); startDeathSequence(); }
        }
        const near = Missions.update(camera);
        UI.setPrompt(!!near);
        if(near) UI.setObjective(`Принять миссию: ${near.title}`);
        else if(Missions.hasPhone()) UI.setObjective('Ждите звонок или бегите к активному маркеру “!”');
        else UI.setObjective('Пройдите вводное задание и получите телефон');

        if(Player.isKeyPressed('action')){
          Player.clearKey('action');
          const m = Missions.start();
          if(m){ Player.clearMovement(); document.exitPointerLock?.(); UI.showMission(m); }
        }
        UI.drawMap(camera,Missions.list,World.colliders,World.dynamicColliders(),Missions.progress(),World.bounds);
      } else {
        UI.drawMap(camera,Missions.list,World.colliders,World.dynamicColliders(),Missions.progress(),World.bounds);
      }
    }
    const t=performance.now()*.001;
    World.missionObjects.forEach((g,i)=>{ if(!g.visible) return; g.rotation.y = t*.75+i; g.position.y = Math.sin(t*2+i)*.18; if(g.userData.mark){ g.userData.mark.rotation.y = -t*1.8; } });
    renderer.render(scene,camera);
  }
  loop();
})();
