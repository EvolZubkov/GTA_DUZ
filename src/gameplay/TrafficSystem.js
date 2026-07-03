import * as THREE from 'three';

export class TrafficSystem {
  constructor(scene, collision, ui, player) {
    this.scene = scene;
    this.collision = collision;
    this.ui = ui;
    this.player = player;
    this.cars = [];
  }

  create() {
    const colors = [0xffc857, 0xff2bd6, 0x12f7ff, 0x8cff5a];
    for (let i = 0; i < 8; i++) {
      const car = this.makeCar(colors[i % colors.length]);
      const horizontal = i % 2 === 0;
      car.position.set(horizontal ? -90 + i * 18 : (i % 4 === 1 ? -48 : 48), 0.45, horizontal ? (i % 4 === 0 ? 0 : -48) : -80 + i * 18);
      car.userData = { horizontal, dir: i % 3 === 0 ? -1 : 1, speed: 8 + (i % 3) * 2 };
      this.scene.add(car);
      this.cars.push(car);
    }
  }

  makeCar(color) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.3, 0.9, 5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25 })
    );
    body.position.y = 0.5;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.8, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2, metalness: 0.1 })
    );
    cabin.position.y = 1.25;
    group.add(body, cabin);
    return group;
  }

  update(dt) {
    for (const car of this.cars) {
      if (car.userData.horizontal) {
        car.position.x += car.userData.dir * car.userData.speed * dt;
        car.rotation.y = car.userData.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (Math.abs(car.position.x) > 98) car.userData.dir *= -1;
      } else {
        car.position.z += car.userData.dir * car.userData.speed * dt;
        car.rotation.y = car.userData.dir > 0 ? 0 : Math.PI;
        if (Math.abs(car.position.z) > 98) car.userData.dir *= -1;
      }

      const dist = car.position.distanceTo(this.player.position);
      if (dist < 2.5) {
        const dead = this.player.damage(1);
        this.ui.showToast(dead ? 'DEAD' : '-1 сердце');
        if (dead) setTimeout(() => this.player.reset(), 1200);
      }
    }
  }
}
