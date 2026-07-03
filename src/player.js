const Player = (() => {
  const keys = {};
  let yaw = 0, pitch = 0;
  const radius = 1.0;
  const height = 2.0;
  const speed = 16;
  let verticalVelocity = 0;
  let jumpOffset = 0;
  const gravity = 24;
  const jumpPower = 8.5;

  function keyName(e) {
    // e.code не зависит от раскладки: KeyW будет KeyW и на RU, и на EN.
    const byCode = {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      KeyE: 'action', KeyP: 'phone', KeyM: 'map', KeyR: 'reset',
      Space: 'jump'
    };
    if (byCode[e.code]) return byCode[e.code];

    // fallback для браузеров/ситуаций, где code может быть нестабилен
    const k = (e.key || '').toLowerCase();
    const byKey = {
      w: 'forward', ц: 'forward',
      s: 'back', ы: 'back',
      a: 'left', ф: 'left',
      d: 'right', в: 'right',
      e: 'action', у: 'action',
      p: 'phone', з: 'phone',
      m: 'map', ь: 'map', r: 'reset', к: 'reset',
      ' ': 'jump', spacebar: 'jump'
    };
    return byKey[k] || k;
  }

  function setup(camera) {
    camera.rotation.order = 'YXZ';
    // Стартовая точка вынесена на перекресток, чтобы игрок не появлялся внутри здания.
    camera.position.set(0, height, 24);
    yaw = 0;
    pitch = -0.18;
    camera.rotation.set(pitch, yaw, 0);

    window.addEventListener('keydown', e => {
      const name = keyName(e);
      keys[name] = true;
      if (['forward', 'back', 'left', 'right', 'jump'].includes(name)) e.preventDefault();
    }, { passive: false });

    window.addEventListener('keyup', e => {
      keys[keyName(e)] = false;
    });

    window.addEventListener('blur', () => {
      Object.keys(keys).forEach(k => keys[k] = false);
    });

    window.addEventListener('mousemove', e => {
      if (document.pointerLockElement === document.body) {
        yaw -= e.movementX * 0.0022;
        pitch -= e.movementY * 0.0022;
        pitch = Math.max(-1.15, Math.min(1.05, pitch));
        camera.rotation.set(pitch, yaw, 0);
      }
    });
  }

  function rectsOverlap(a, b) {
    return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
  }

  function blocked(x, z, colliders) {
    const p = { x, z, w: radius * 2, d: radius * 2 };
    return colliders.some(c => rectsOverlap(p, c));
  }

  function update(camera, dt, colliders, canControl = true) {
    if (!canControl) return;

    // Направление движения берется только из yaw, поэтому W всегда идет туда,
    // куда игрок смотрит по горизонтали, без влияния наклона камеры вверх/вниз.
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    const move = new THREE.Vector3();

    if (keys.forward) move.add(forward);
    if (keys.back) move.addScaledVector(forward, -1);
    if (keys.right) move.add(right);
    if (keys.left) move.addScaledVector(right, -1);

    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);

    const nx = camera.position.x + move.x;
    const nz = camera.position.z + move.z;
    if (!blocked(nx, camera.position.z, colliders)) camera.position.x = nx;
    if (!blocked(camera.position.x, nz, colliders)) camera.position.z = nz;

    if (keys.jump && jumpOffset <= 0.001) {
      verticalVelocity = jumpPower;
      keys.jump = false;
    }

    jumpOffset += verticalVelocity * dt;
    verticalVelocity -= gravity * dt;
    if (jumpOffset < 0) {
      jumpOffset = 0;
      verticalVelocity = 0;
    }
    camera.position.y = height + jumpOffset;
  }

  function isKeyPressed(action) { return !!keys[action]; }
  function clearKey(action) { keys[action] = false; }
  function clearMovement() { ['forward','back','left','right','jump'].forEach(k => keys[k] = false); }

  function bodyRect(camera) {
    return { x: camera.position.x, z: camera.position.z, w: radius * 2, d: radius * 2 };
  }

  function overlapsAny(camera, colliders) {
    const p = bodyRect(camera);
    return colliders.find(c => rectsOverlap(p, c));
  }

  function knockBackFrom(camera, collider) {
    if (!collider) return;
    const dx = camera.position.x - collider.x;
    const dz = camera.position.z - collider.z;
    const len = Math.hypot(dx, dz) || 1;
    camera.position.x += (dx / len) * 3.2;
    camera.position.z += (dz / len) * 3.2;
  }

  function respawn(camera) {
    camera.position.set(0, height, 24);
    yaw = 0;
    pitch = -0.18;
    camera.rotation.set(pitch, yaw, 0);
    jumpOffset = 0;
    verticalVelocity = 0;
    pitch = -0.18;
    camera.rotation.set(pitch, yaw, 0);
    clearMovement();
  }

  function getYaw(){ return yaw; }
  function setLook(camera, nextYaw, nextPitch=0){
    yaw = nextYaw;
    pitch = Math.max(-1.15, Math.min(1.05, nextPitch));
    camera.rotation.set(pitch, yaw, 0);
  }

  return { setup, update, isKeyPressed, clearKey, clearMovement, overlapsAny, knockBackFrom, respawn, getYaw, setLook }; 
})();
