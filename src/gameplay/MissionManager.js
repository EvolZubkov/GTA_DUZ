import * as THREE from 'three';
import { MISSION_CHAIN } from '../config/missions.js';

export class MissionManager {
  constructor(scene, ui) {
    this.scene = scene;
    this.ui = ui;
    this.chain = MISSION_CHAIN;
    this.index = 0;
    this.active = null;
    this.markers = new Map();
    this.declineCount = 0;
  }

  start() {
    this.activateMission(this.chain[0]);
  }

  activateMission(mission) {
    this.active = mission;
    this.ui.setObjective(mission.objective);
    this.createMarker(mission);
  }

  createMarker(mission) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 2.2 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.4, 0.55), mat);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 24), mat);
    bar.position.y = 3.5;
    dot.position.y = 1.8;
    group.add(bar, dot);
    group.position.set(mission.marker.x, 0, mission.marker.z);
    group.userData.spin = true;
    this.scene.add(group);
    this.markers.set(mission.id, group);
  }

  update(dt, playerPosition) {
    for (const marker of this.markers.values()) marker.rotation.y += dt * 2.8;
    if (!this.active) return;
    const marker = this.markers.get(this.active.id);
    if (!marker) return;
    const dx = playerPosition.x - marker.position.x;
    const dz = playerPosition.z - marker.position.z;
    this.ui.setInteractHint(Math.hypot(dx, dz) < 4 ? 'Нажми E, чтобы начать миссию' : '');
  }

  tryInteract(playerPosition) {
    if (!this.active) return;
    const marker = this.markers.get(this.active.id);
    if (!marker) return;
    if (playerPosition.distanceTo(marker.position) < 4.5) this.openMission(this.active);
  }

  openMission(mission) {
    document.exitPointerLock?.();
    this.ui.openSlides(mission, () => this.completeMission(mission));
  }

  completeMission(mission) {
    const marker = this.markers.get(mission.id);
    if (marker) this.scene.remove(marker);
    this.markers.delete(mission.id);
    this.ui.showAchievement(mission.reward);
    this.index += 1;

    const next = this.chain[this.index];
    if (!next) {
      this.active = null;
      this.ui.setObjective('Все миссии квартала завершены. Quarter passed.');
      return;
    }

    this.active = null;
    this.ui.setObjective('Ждите звонок от Бати К');
    setTimeout(() => this.incomingCall(next), 1000);
  }

  incomingCall(mission) {
    this.ui.openCall({
      caller: mission.caller || 'Батя К',
      text: mission.phoneText || 'Есть новая работа.',
      forced: this.declineCount >= 5,
      onAccept: () => {
        this.declineCount = 0;
        this.activateMission(mission);
      },
      onDecline: () => {
        this.declineCount += 1;
        if (this.declineCount === 5) this.ui.showToast('Батя К: собираешься уволиться?');
        setTimeout(() => this.incomingCall(mission), 900);
      }
    });
  }
}
