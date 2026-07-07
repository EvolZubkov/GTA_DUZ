// Раньше игрок всегда спавнился в захардкоженной точке (0,0,12) — если рядом
// когда-нибудь окажется здание/проп (а после Phase B их в городе уже сотни),
// игрок будет застревать внутри коллизии с первого кадра. Ищем свободную
// точку рядом с желаемой: сперва саму точку, потом расширяющимися кольцами
// вокруг неё (8 направлений на кольцо), пока не найдётся точка, для которой
// collision.intersectsPlayer() возвращает false.
export function findSafeSpawn(collision, near = { x: 0, z: 12 }) {
  const candidate = { x: near.x, y: 0, z: near.z };
  if (!collision.intersectsPlayer(candidate)) return candidate;

  const directions = 8;
  for (let radius = 2; radius <= 40; radius += 2) {
    for (let k = 0; k < directions; k++) {
      const angle = (k / directions) * Math.PI * 2;
      const point = {
        x: near.x + Math.cos(angle) * radius,
        y: 0,
        z: near.z + Math.sin(angle) * radius
      };
      if (!collision.intersectsPlayer(point)) return point;
    }
  }

  // Не должно происходить в реальной сетке города, но чтобы игра не зависла
  // молча, возвращаем исходную точку — лучше видимый баг, чем немой сбой.
  return candidate;
}
