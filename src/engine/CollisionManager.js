import * as THREE from 'three';

export class CollisionManager {
  constructor() {
    this.staticBoxes = [];
    this.dynamicBoxes = [];
  }

  clearDynamic() {
    this.dynamicBoxes.length = 0;
  }

  addStaticFromObject(object, padding = 0.05) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return null;
    box.expandByScalar(padding);
    this.staticBoxes.push(box);
    return box;
  }

  addStaticBox(center, size) {
    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(center.x, center.y, center.z),
      new THREE.Vector3(size.x, size.y, size.z)
    );
    this.staticBoxes.push(box);
    return box;
  }

  addDynamicBox(box) {
    this.dynamicBoxes.push(box);
  }

  intersectsPlayer(position, radius = 0.75, height = 1.8) {
    const playerBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(position.x, position.y + height / 2, position.z),
      new THREE.Vector3(radius * 2, height, radius * 2)
    );
    return [...this.staticBoxes, ...this.dynamicBoxes].some((box) => box.intersectsBox(playerBox));
  }
}
