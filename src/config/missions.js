export const MISSION_CHAIN = [
  {
    id: 'intro',
    type: 'intro',
    title: 'Вступление в ДУЗ',
    marker: { x: -18, z: -8 },
    objective: 'Ждите звонок или бегите к активному маркеру “!”',
    slides: [
      { title: 'Добро пожаловать в Quarter City', text: 'Это город квартальных релизов, срочных задач и странных звонков.' },
      { title: 'Вы вступаете в банду ДУЗ', text: 'Теперь у вас есть телефон, миссии и ответственность за квартальный отчет.' },
      { title: 'Телефон получен', text: 'После этой миссии Батя К начнет выдавать задания.' }
    ],
    reward: 'Новичок ДУЗ'
  },
  {
    id: 'mailing',
    type: 'phone',
    caller: 'Батя К',
    title: 'Массовые рассылки',
    marker: { x: 26, z: -16 },
    objective: 'Доберитесь до района Mail District',
    phoneText: 'Есть дело. Нужно, чтобы весь город получил сообщение одновременно. Берешь работу?',
    slides: [
      { title: 'Mass Mailing', text: 'Добавили массовые рассылки в Почтелье.' },
      { title: 'Что изменилось', text: 'Теперь коммуникации можно запускать массово и быстрее.' },
      { title: 'Mission Passed', text: 'Communication reputation +10' }
    ],
    reward: 'Mass Communicator'
  },
  {
    id: 'dashboard',
    type: 'phone',
    caller: 'Батя К',
    title: 'B2B Dashboard',
    marker: { x: 46, z: 34 },
    objective: 'Доберитесь до Business Center',
    phoneText: 'Новый B2B-заказчик хочет красивый отчет. Excel есть, но нужен dashboard. Делаем?',
    slides: [
      { title: 'Новый B2B-клиент', text: 'Под клиента подготовили отчет в Excel и HTML Dashboard.' },
      { title: 'HTML Dashboard', text: 'Простой просмотр через браузер, презентабельный формат для заказчика.' },
      { title: 'Mission Passed', text: 'B2B reputation +15' }
    ],
    reward: 'Dashboard Architect'
  },
  {
    id: 'skillum',
    type: 'sms',
    caller: 'Skillum Bot',
    title: 'Skillum Upgrade',
    marker: { x: -42, z: 42 },
    objective: 'Доберитесь до Skillum Hills',
    phoneText: 'Обновление конструктора тестов готово к демонстрации.',
    slides: [
      { title: 'Skillum обновляется', text: 'Развитие создания тестов и подготовка новой версии.' },
      { title: 'Next Release', text: 'Новая база для следующих продуктовых улучшений.' },
      { title: 'Mission Passed', text: 'Product XP +1500' }
    ],
    reward: 'Skillum Level Up'
  }
];
