const Missions = (() => {
  const list = [
    {
      id:'intro', title:'Вступление в ДУЗ', x:-118, z:-102, color:0x28f5ff,
      desc:'Найти Батю К, вступить в банду ДУЗ и получить рабочий телефон.',
      reward:'+ Phone Unlocked · DУЗ Crew Joined', achievement:'Welcome to ДУЗ',
      slides:[
        {kicker:'INTRO MISSION', title:'Добро пожаловать в DUZ City', text:'Чтобы получать задания квартала, сначала нужно вступить в банду ДУЗ.'},
        {kicker:'CREW CONTACT', title:'Батя К', text:'Батя К выдает рабочий телефон. Через него будут приходить звонки, миссии и странные просьбы.'},
        {kicker:'PHONE UNLOCKED', title:'DUZ Phone', text:'Теперь задания будут появляться не все сразу, а после звонков и сообщений.'}
      ]
    },
    {
      id:'mail', title:'Mass Mailing', x:-118, z:-70, color:0xff3acb,
      desc:'Запустить массовые рассылки в Почтелье.',
      reward:'+ Communication XP · Users Reach Unlocked', achievement:'Mass Communicator',
      callText:'Есть работа. Нужно быстро достучаться до пользователей. На карте появилась точка Mass Mailing.',
      slides:[
        {kicker:'MISSION BRIEF', title:'Broadcast Job', text:'Нужно быстро и красиво донести сообщения до большой аудитории.'},
        {kicker:'GAMEPLAY FEATURE', title:'Mass Mailing', text:'Добавляем механику массовых рассылок: один запуск — много пользователей.'},
        {kicker:'RESULT', title:'Communication Unlocked', text:'Команда получает новый канал коммуникации с пользователями.'}
      ]
    },
    {
      id:'b2b', title:'Corporate Dashboard', x:114, z:-72, color:0x28f5ff,
      desc:'Подготовить HTML Dashboard и Excel-отчет для нового B2B-клиента.',
      reward:'+ B2B Reputation · Enterprise Client Unlocked', achievement:'Dashboard Architect',
      callText:'Поступил корпоративный заказ. Нужен отчет, но не скучный. Точка Dashboard уже на карте.',
      slides:[
        {kicker:'INCOMING CALL', title:'New B2B Client', text:'Появился новый корпоративный заказчик со своим форматом отчетности.'},
        {kicker:'SIDE QUEST', title:'Excel + HTML', text:'Делаем не только Excel, но и простой красивый HTML Dashboard.'},
        {kicker:'RESULT', title:'Enterprise Ready', text:'Отчетность становится понятнее, презентабельнее и ближе к B2B-формату.'}
      ]
    },
    {
      id:'skillum', title:'Skillum Upgrade', x:-108, z:92, color:0xffd86b,
      desc:'Обновить создание тестов и подготовить платформу к релизу.',
      reward:'+ Product XP · Test Creator Remastered', achievement:'Skillum Reboot',
      callText:'Skillum просит апгрейд. Конструктор тестов ждет героя. Маркер уже активен.',
      slides:[
        {kicker:'UPGRADE AVAILABLE', title:'Skillum Core', text:'Обновляем ключевой сценарий: создание тестов.'},
        {kicker:'CRAFTING TABLE', title:'Test Creator', text:'Улучшаем механику сборки тестов и готовим основу для следующих релизов.'},
        {kicker:'RESULT', title:'Product Level Up', text:'Skillum становится удобнее как платформа для обучения и проверки знаний.'}
      ]
    },
    {
      id:'release', title:'Quarter Release', x:102, z:112, color:0x8eff7a,
      desc:'Финальная сборка квартального отчета.',
      reward:'+ Quarter Completion · Q3 DLC Teaser', achievement:'Quarter Completed',
      callText:'Финальная сборка квартала. Надо собрать все достижения в один отчет. Последняя точка на карте.',
      slides:[
        {kicker:'FINAL MISSION', title:'Quarter Release', text:'Собираем все достижения квартала в одну историю.'},
        {kicker:'SUMMARY', title:'3 Features Unlocked', text:'Коммуникации, B2B-отчетность и Skillum получили новые возможности.'},
        {kicker:'TO BE CONTINUED', title:'Q3 DLC', text:'Следующие миссии уже появляются на карте.'}
      ]
    }
  ];

  const done = new Set();
  const unlocked = new Set(['intro']);
  let currentNear = null;
  let active = null;
  let nextCallIndex = 1;
  let call = null;
  let callTimer = null;
  let declineCount = 0;
  let lastMessage = '';

  function visibleIds(){ return [...unlocked].filter(id => !done.has(id)); }

  function update(camera){
    currentNear = null;
    for(const m of list){
      if(done.has(m.id) || !unlocked.has(m.id)) continue;
      const dx = camera.position.x-m.x, dz = camera.position.z-m.z;
      if(Math.sqrt(dx*dx+dz*dz) < 7){ currentNear = m; break; }
    }
    return currentNear;
  }

  function start(){ if(currentNear){ active = currentNear; return active; } return null; }

  function scheduleNextCall(delay=1200){
    if(nextCallIndex >= list.length) return;
    clearTimeout(callTimer);
    callTimer = setTimeout(() => startCall(false), delay);
  }

  function startCall(forced=false){
    if(nextCallIndex >= list.length) return;
    const mission = list[nextCallIndex];
    call = {
      id: mission.id,
      caller: 'Батя К',
      missionTitle: mission.title,
      text: mission.callText,
      forced: forced || declineCount >= 5,
      state: 'ringing',
      attempt: declineCount + 1,
      angryMessage: declineCount >= 5 ? 'собираешься уволиться?' : ''
    };
  }

  function acceptCall(){
    if(!call) return null;
    call.state = 'talking';
    call.angryMessage = call.angryMessage || (call.forced ? 'собираешься уволиться?' : '');
    return call;
  }

  function declineCall(){
    if(!call || call.forced) return call;
    declineCount += 1;
    call = null;
    if(declineCount >= 5){ lastMessage = 'собираешься уволиться?'; setTimeout(() => startCall(true), 650); }
    else setTimeout(() => startCall(false), 650);
    return {declined:true, count:declineCount, message:lastMessage};
  }

  function finishCall(){
    if(!call) return null;
    const mission = list[nextCallIndex];
    unlocked.add(mission.id);
    nextCallIndex += 1;
    call = null;
    declineCount = 0;
    lastMessage = '';
    return mission;
  }

  function complete(){
    if(!active) return null;
    done.add(active.id);
    const finished = active;
    active = null;
    if(finished.id === 'intro') scheduleNextCall(1100);
    else scheduleNextCall(1500);
    return finished;
  }

  function progress(){ return {done:[...done], unlocked:[...unlocked], total:list.length}; }
  function callInfo(){ return call; }
  function hasPhone(){ return done.has('intro'); }

  return { list, update, start, complete, progress, visibleIds, callInfo, acceptCall, declineCall, finishCall, hasPhone };
})();
