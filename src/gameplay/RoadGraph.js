import { AVENUES } from '../config/citypack.js';

// Раньше машины просто ехали по прямой и разворачивались на 180° у границы
// карты — ни одного поворота. Город — регулярная решётка проспектов, так что
// граф перекрёстков тривиален: узел на каждой паре координат из AVENUES,
// рёбра — к соседям по индексу (до 4 на узел, меньше по краям сетки).
// Полноценный pathfinding тут не нужен — просто случайное блуждание по рёбрам.
export class RoadGraph {
  constructor() {
    this.size = AVENUES.length;
    this.nodes = [];
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        this.nodes.push({ i, j, x: AVENUES[i], z: AVENUES[j] });
      }
    }
  }

  nodeAt(i, j) {
    if (i < 0 || i >= this.size || j < 0 || j >= this.size) return null;
    return this.nodes[i * this.size + j];
  }

  neighbors(node) {
    return [
      this.nodeAt(node.i + 1, node.j),
      this.nodeAt(node.i - 1, node.j),
      this.nodeAt(node.i, node.j + 1),
      this.nodeAt(node.i, node.j - 1)
    ].filter(Boolean);
  }

  randomNode() {
    return this.nodes[Math.floor(Math.random() * this.nodes.length)];
  }

  // Следующий узел маршрута — случайный сосед, кроме того, откуда машина
  // только что приехала (иначе она бы просто дёргалась туда-сюда между
  // двумя соседними перекрёстками вместо связного маршрута с поворотами).
  // Если это единственный сосед (тупик по краю сетки), разворот всё же
  // допускается — иначе машина застрянет на месте.
  randomNextNode(current, from) {
    const options = this.neighbors(current);
    const withoutBacktrack = from ? options.filter((n) => n.i !== from.i || n.j !== from.j) : options;
    const pool = withoutBacktrack.length > 0 ? withoutBacktrack : options;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
