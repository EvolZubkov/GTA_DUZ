const World = (() => {
  const colliders = [];
  const missionObjects = [];
  const npcs = [];
  const movingCars = [];
  let deathBody = null;
  const bounds = {min:-360,max:360,size:720};

  const Kit = (() => {
    const cache = new Map();
    let loader = null;
    const base = 'assets/citykit/';
    const isFileProtocol = location.protocol === 'file:';
    function getLoader(){
      if(isFileProtocol) return null;
      if(!window.THREE || !THREE.GLTFLoader) return null;
      if(!loader) loader = new THREE.GLTFLoader();
      return loader;
    }
    function load(name, onReady){
      const l = getLoader();
      if(!l) return false;
      if(cache.has(name)){
        const cached = cache.get(name);
        if(cached) onReady(cached.clone(true));
        else setTimeout(()=>load(name,onReady),80);
        return true;
      }
      cache.set(name, null);
      l.load(base + name + '.gltf', (gltf)=>{
        const root = gltf.scene;
        root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material){ o.material.side = THREE.DoubleSide; o.material.needsUpdate = true; } } });
        cache.set(name, root);
        onReady(root.clone(true));
      }, undefined, (err)=>{ console.warn('Asset load failed:', name, err); cache.delete(name); });
      return true;
    }
    function fitAndPlace(model, x,z,targetW,targetD,targetH=0, rot=0){
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3(); box.getSize(size);
      const sx = targetW / Math.max(.001, size.x);
      const sz = targetD / Math.max(.001, size.z);
      const sy = targetH ? targetH / Math.max(.001, size.y) : Math.min(sx,sz);
      const scale = Math.min(sx, sz, sy) * .96;
      model.scale.setScalar(scale);
      model.rotation.y = rot;
      model.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(model); const center = new THREE.Vector3(); const s2 = new THREE.Vector3();
      b2.getCenter(center); b2.getSize(s2);
      model.position.set(x - center.x, -b2.min.y, z - center.z);
      return model;
    }
    return {load, fitAndPlace};
  })();

  function box(scene, opts){
    const {x=0,y=0,z=0,w=1,h=1,d=1,color=0xffffff,emissive=0x000000,name='',opacity=1} = opts;
    const geo = new THREE.BoxGeometry(w,h,d);
    const mat = new THREE.MeshStandardMaterial({color, emissive, roughness:.55, metalness:.08, transparent: opacity<1, opacity});
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = name; scene.add(mesh); return mesh;
  }
  function cylinder(scene, opts){
    const {x=0,y=0,z=0,r=1,h=1,color=0xffffff,segments=24,emissive=0x000000} = opts;
    const geo = new THREE.CylinderGeometry(r,r,h,segments);
    const mat = new THREE.MeshStandardMaterial({color, emissive, roughness:.7});
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh); return mesh;
  }
  function addCollider(x,z,w,d,label='obstacle') { colliders.push({x,z,w,d,label}); }

  function addModel(scene, name, x,z,w,d,h=0,rot=0, fallbackColor=0x2c344d){
    const fallback = box(scene,{x,y:(h||8)/2,z,w,h:(h||8),d,color:fallbackColor,emissive:0x071228,name:'fallback-'+name,opacity: location.protocol === 'file:' ? 1 : .58});
    // v10: placeholder stays visible until the real model loads, so the city never becomes an empty black screen.
    fallback.visible = true;
    if((h||8) > 5){
      const rows = Math.max(2, Math.floor((h||8)/7));
      for(let r=0;r<rows;r++){
        const wy = 3 + r*5.2;
        const ww = Math.max(1.2, Math.min(3, w/6));
        const count = Math.max(2, Math.floor(w/7));
        for(let i=0;i<count;i++){
          const wx = x - w*.35 + i*(w*.7/(count-1||1));
          box(scene,{x:wx,y:wy,z:z-d/2-.07,w:ww,h:.9,d:.08,color:0x102030,emissive:0x28f5ff,opacity:.75});
        }
      }
    }
    Kit.load(name, (model)=>{
      Kit.fitAndPlace(model,x,z,w,d,h,rot);
      scene.add(model);
      fallback.visible = false;
    });
    return fallback;
  }
  function addBuilding(scene, x,z,w,d,h,color,label, model='Building_Medium_2_001', rot=0){
    addModel(scene, model, x,z,w,d,h,rot,color);
    // neon sign / name plate makes quarterly content readable even with imported models
    const sign = box(scene,{x,y:Math.max(3,h*.55),z:z-d/2-.08,w:Math.min(w*.72,16),h:1.2,d:.12,color:0x070816,emissive:0x120028,opacity:.92,name:label});
    // v12: без индивидуальных PointLight у каждого здания — иначе WebGL превышает лимит uniforms. Неон остается через emissive-материалы.
    addCollider(x,z,w+1.2,d+1.2,label);
  }
  function addRoad(scene, x,z,w,d, type='Street_4Lane', rot=0){
    box(scene,{x,y:.006,z,w,h:.012,d,color:0x111722});
    if(Math.max(w,d) <= 70){ addModel(scene, type, x,z,w,d,.1,rot,0x111722); }
  }
  function addStreetTile(scene, name, x,z,w=30,d=30,rot=0){ addModel(scene,name,x,z,w,d,.1,rot,0x111722); }
  function addBillboard(scene,x,z,rot=0,title='Q-REPORT'){
    const g = new THREE.Group(); g.position.set(x,0,z); g.rotation.y=rot; scene.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,4.5,12), new THREE.MeshStandardMaterial({color:0x333a48, metalness:.4, roughness:.35})); pole.position.y=2.25; pole.castShadow=true; g.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(6,2.4,.18), new THREE.MeshStandardMaterial({color:0x101522, emissive:0x25003e, roughness:.35})); panel.position.y=5; panel.castShadow=true; g.add(panel);
    // v12: glow заменен emissive-панелью без реального источника света
    addCollider(x,z,7,1.2,'billboard');
  }
  function addStreetLight(scene,x,z){
    const g=new THREE.Group(); g.position.set(x,0,z); scene.add(g);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,5,10), new THREE.MeshStandardMaterial({color:0x2a3240, metalness:.45, roughness:.32})); pole.position.y=2.5; pole.castShadow=true; g.add(pole);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8), new THREE.MeshStandardMaterial({color:0xfff1b6, emissive:0xffc15a, emissiveIntensity:.7})); lamp.position.set(.55,5,.0); g.add(lamp);
    
  }
  function addMissionMarker(scene, mission){
    const group = new THREE.Group(); group.position.set(mission.x, 0, mission.z); group.userData = mission;
    const glowMat = new THREE.MeshStandardMaterial({color: mission.color, emissive: mission.color, emissiveIntensity: 1.6, transparent: true, opacity: .72, roughness: .25});
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, .08, 14, 64), glowMat); ring.rotation.x = Math.PI / 2; ring.position.y = .05; group.add(ring);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, .035, 48), glowMat.clone()); halo.material.opacity = .22; halo.position.y = .035; group.add(halo);
    const mark = new THREE.Group(); mark.position.y = 4.4;
    const whiteMat = new THREE.MeshStandardMaterial({color: 0xffffff, emissive: mission.color, emissiveIntensity: .95, roughness: .18, metalness: .08});
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.6, 2.4, .38), whiteMat); bar.castShadow = true; mark.add(bar);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.4, 24, 16), whiteMat); dot.position.y = -1.7; dot.castShadow = true; mark.add(dot);
    const backPlate = new THREE.Mesh(new THREE.BoxGeometry(1.35, 3.5, .12), new THREE.MeshStandardMaterial({color: mission.color, emissive: mission.color, emissiveIntensity: .55, transparent:true, opacity:.38})); backPlate.position.z = -.11; mark.add(backPlate);
    group.add(mark); group.userData.mark = mark; scene.add(group); missionObjects.push(group); return group;
  }
  function removeMissionMarker(id){ setMissionMarkerActive(id, false); }
  function setMissionMarkerActive(id, active){ const obj = missionObjects.find(g => g.userData.id === id); if(obj) obj.visible = !!active; }
  function palm(scene,x,z){
    cylinder(scene,{x,y:2,z,r:.18,h:4,color:0x8a5631,segments:10}); addCollider(x,z,1.1,1.1,'palm');
    for(let i=0;i<6;i++){ const leaf = box(scene,{x,y:4.25,z,w:2.5,h:.12,d:.45,color:0x2dce75}); leaf.rotation.y = i*Math.PI*2/6; leaf.rotation.z = .25; leaf.castShadow=true; }
  }
  function carStatic(scene,x,z,rot=0,color=0xff5ba7){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.8,.72,1.35), new THREE.MeshStandardMaterial({color, emissive:0x160010, roughness:.5})); body.position.y=.45; body.castShadow=true; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.35,.55,1.0), new THREE.MeshStandardMaterial({color:0x1b2735, emissive:0x08162a, roughness:.35})); top.position.set(.15,.95,0); top.castShadow=true; g.add(top);
    
    g.position.set(x,0,z); g.rotation.y = rot; scene.add(g);
    addCollider(x,z,Math.abs(Math.cos(rot))*3.0+Math.abs(Math.sin(rot))*1.6,Math.abs(Math.sin(rot))*3.0+Math.abs(Math.cos(rot))*1.6,'car');
  }
  function addMovingCar(scene, path, color=0xff5ba7, speed=12){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2,.75,1.45), new THREE.MeshStandardMaterial({color, emissive:0x180010, roughness:.45})); body.position.y=.48; body.castShadow=true; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5,.55,1.05), new THREE.MeshStandardMaterial({color:0x101927, emissive:0x06131f, roughness:.32})); top.position.set(.1,1,0); top.castShadow=true; g.add(top);
    
    scene.add(g);
    const car = {mesh:g, path, i:0, t:0, speed, collider:{x:path[0].x,z:path[0].z,w:3.5,d:1.8,label:'moving-car'}};
    movingCars.push(car);
  }
  function makeNPC(scene,x,z,color=0xffd86b){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.45,1.05,6,12), new THREE.MeshStandardMaterial({color, emissive:0x140008, roughness:.45})); body.position.y=1.15; body.castShadow=true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.32,16,12), new THREE.MeshStandardMaterial({color:0xffd2b8, roughness:.55})); head.position.y=2.05; head.castShadow=true; g.add(head);
    g.position.set(x,0,z); scene.add(g);
    npcs.push({mesh:g, dir:Math.random()*Math.PI*2, timer:0, speed:3+Math.random()*2, collider:{x,z,w:1.4,d:1.4,label:'npc'}});
  }
  function obstacleAt(x,z,extra=[]){
    const p={x,z,w:1.4,d:1.4};
    return [...colliders,...extra].some(c => Math.abs(p.x-c.x)<(p.w+c.w)/2 && Math.abs(p.z-c.z)<(p.d+c.d)/2);
  }
  function dynamicColliders(){ return [...npcs.map(n=>n.collider), ...movingCars.map(c=>c.collider)]; }
  function movingCarColliders(){ return movingCars.map(c=>c.collider); }
  function update(dt){
    const extrasWithoutNPC = movingCars.map(c=>c.collider);
    npcs.forEach((n,idx)=>{
      n.timer -= dt;
      if(n.timer<=0){ n.dir += (Math.random()-.5)*1.8; n.timer = 1+Math.random()*2.5; }
      const nx = n.mesh.position.x + Math.cos(n.dir)*n.speed*dt;
      const nz = n.mesh.position.z + Math.sin(n.dir)*n.speed*dt;
      if(nx<bounds.min+8 || nx>bounds.max-8 || nz<bounds.min+8 || nz>bounds.max-8 || obstacleAt(nx,nz,extrasWithoutNPC)) n.dir += Math.PI/2 + Math.random();
      else { n.mesh.position.x=nx; n.mesh.position.z=nz; }
      n.mesh.rotation.y = -n.dir + Math.PI/2;
      n.collider.x = n.mesh.position.x; n.collider.z = n.mesh.position.z;
      n.mesh.position.y = Math.sin(performance.now()*.006+idx)*.06;
    });
    movingCars.forEach(car=>{
      const a=car.path[car.i], b=car.path[(car.i+1)%car.path.length];
      const dx=b.x-a.x, dz=b.z-a.z; const len=Math.hypot(dx,dz)||1;
      car.t += (car.speed*dt)/len;
      if(car.t>=1){ car.t=0; car.i=(car.i+1)%car.path.length; }
      const aa=car.path[car.i], bb=car.path[(car.i+1)%car.path.length];
      car.mesh.position.set(aa.x+(bb.x-aa.x)*car.t,0,aa.z+(bb.z-aa.z)*car.t);
      car.mesh.rotation.y = Math.atan2(bb.x-aa.x, bb.z-aa.z);
      car.collider.x=car.mesh.position.x; car.collider.z=car.mesh.position.z;
      const horizontal = Math.abs(bb.x-aa.x) > Math.abs(bb.z-aa.z);
      car.collider.w = horizontal?3.8:1.8; car.collider.d = horizontal?1.8:3.8;
    });
  }

  function clearDeathBody(scene){ if(!deathBody) return; scene.remove(deathBody); deathBody.traverse?.(o=>{ if(o.geometry) o.geometry.dispose?.(); }); deathBody = null; }
  function spawnDeathBody(scene, position, yaw=0){
    clearDeathBody(scene);
    const g = new THREE.Group();
    const suitMat = new THREE.MeshStandardMaterial({color:0xff3acb, emissive:0x240018, roughness:.45});
    const skinMat = new THREE.MeshStandardMaterial({color:0xffd2b8, roughness:.55});
    const darkMat = new THREE.MeshStandardMaterial({color:0x151923, emissive:0x04070c, roughness:.5});
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.46,1.15,6,14), suitMat); torso.rotation.z = Math.PI/2; torso.position.set(0,.42,0); torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.34,18,14), skinMat); head.position.set(.96,.42,0); head.castShadow = true; g.add(head);
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(.95,.18,.22), darkMat); leg1.position.set(-.92,.26,.25); leg1.rotation.z = .1; leg1.castShadow = true; g.add(leg1);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(.95,.18,.22), darkMat); leg2.position.set(-.92,.26,-.25); leg2.rotation.z = -.08; leg2.castShadow = true; g.add(leg2);
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(.75,.15,.18), skinMat); arm1.position.set(.15,.42,.57); arm1.rotation.y = .35; arm1.castShadow = true; g.add(arm1);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(.75,.15,.18), skinMat); arm2.position.set(.15,.42,-.57); arm2.rotation.y = -.35; arm2.castShadow = true; g.add(arm2);
    g.position.set(position.x, .03, position.z); g.rotation.y = yaw; scene.add(g); deathBody = g; return g;
  }

  function createRoadNetwork(scene){
    const roads=[-300,-180,-60,60,180,300];
    roads.forEach(z=> addRoad(scene,0,z,bounds.size,13,'Street_4Lane',0));
    roads.forEach(x=> addRoad(scene,x,0,13,bounds.size,'Street_4Lane',Math.PI/2));
    for(const x of roads) for(const z of roads) addStreetTile(scene,'Street_4WayIntersection',x,z,18,18,0);
    // road decals / markings
    for(let base of roads) for(let i=-340;i<=340;i+=24){
      box(scene,{x:i,y:.035,z:base,w:7,h:.02,d:.18,color:0xd7d7d7});
      box(scene,{x:base,y:.035,z:i,w:.18,h:.02,d:7,color:0xd7d7d7});
    }
    for(const x of [-180,60,300]) for(const z of [-300,-60,180]) addStreetTile(scene,'Decal_Crosswalk',x,z+10,13,5,0);
  }
  function createDistricts(scene){
    const spots=[];
    const roads=[-300,-180,-60,60,180,300];
    for(let xi=-300; xi<=300; xi+=120){
      for(let zi=-300; zi<=300; zi+=120){
        if(Math.abs(xi)<25 && Math.abs(zi)<25) continue;
        spots.push([xi+42,zi+42]); spots.push([xi-42,zi+42]); spots.push([xi+42,zi-42]); spots.push([xi-42,zi-42]);
      }
    }
    const models=['Building_Large_2','Building_Medium_2_001','Building_Small_1'];
    const colors=[0x1f7c91,0x6037a6,0x714d25,0x2c344d,0x0c8f74,0x364258];
    spots.slice(0,56).forEach((p,i)=>{
      const m=models[i%models.length];
      const big = m==='Building_Large_2'; const small=m==='Building_Small_1';
      const w= big?38:(small?24:31); const d=big?34:(small?23:28); const h=big?34:(small?18:26);
      addBuilding(scene,p[0],p[1],w,d,h,colors[i%colors.length],`City Asset ${i+1}`,m,(i%4)*Math.PI/2);
      if(i%5===0) addBillboard(scene,p[0]+w*.55,p[1]-d*.65,Math.PI/2, 'Q');
      if(i%4===0) addModel(scene,'Prop_ACUnit',p[0]-w*.35,p[1]+d*.35,3,3,2,0,0x777777);
    });
    // special named locations for quarter report
    addBuilding(scene,-248,-246,42,36,34,0x28f5ff,'MAIL DISTRICT','Building_Large_2',0);
    addBuilding(scene,238,-246,44,38,36,0xff3acb,'B2B TOWER','Building_Large_2',Math.PI/2);
    addBuilding(scene,-248,238,36,32,28,0x8eff7a,'SKILLUM HILLS','Building_Medium_2_001',0);
    addBuilding(scene,238,238,40,34,30,0xffca4f,'ROADMAP PIER','Building_Medium_2_001',Math.PI/2);
  }
  function createDecor(scene){
    // coastline / beach strip
    box(scene,{x:352,y:.02,z:0,w:18,h:.04,d:bounds.size,color:0x052f51,emissive:0x00152d}); addCollider(352,0,18,bounds.size,'water');
    box(scene,{x:334,y:.04,z:0,w:8,h:.05,d:bounds.size,color:0xd1a456});
    for(let z=-340; z<=340; z+=22) palm(scene,326,z);
    // lights and planters
    for(let i=-330;i<=330;i+=60){
      [-306,-174,-54,66,186,306].forEach(z=>{ addStreetLight(scene,i,z+12); addStreetLight(scene,i,z-12); });
      [-306,-174,-54,66,186,306].forEach(x=>{ addStreetLight(x,i+12); });
    }
    function addStreetLight(x,z){
      const g=new THREE.Group(); g.position.set(x,0,z); scene.add(g);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,5,10), new THREE.MeshStandardMaterial({color:0x2a3240, metalness:.45, roughness:.32})); pole.position.y=2.5; pole.castShadow=true; g.add(pole);
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8), new THREE.MeshStandardMaterial({color:0xfff1b6, emissive:0xffc15a, emissiveIntensity:.7})); lamp.position.set(.55,5,.0); g.add(lamp);
      
    }
    for(let x=-330;x<=300;x+=55){ for(let z=-330;z<=300;z+=95){ if(Math.random()>.35) addModel(scene,'Prop_Planter_Single',x,z,3,3,2,0,0x2dce75); } }
    [-250,-120,120,250].forEach(x=>[-250,-120,120,250].forEach(z=>{ if(Math.random()>.45) addBillboard(scene,x+18,z-18,Math.PI/4); }));
  }
  function createTraffic(scene){
    [[-250,-292,0.05,0xffca4f],[15,-292,0,0xff5ba7],[-118,-180,Math.PI/2,0x28f5ff],[118,-12,Math.PI/2,0x8eff7a],[70,62,0,0xff884f],[-70,118,0,0x8f7aff],[235,185,0,0xff5ba7],[-315,65,Math.PI/2,0x28f5ff]].forEach(c=>carStatic(scene,...c));
    addMovingCar(scene,[{x:-340,z:-60},{x:330,z:-60}],0xff5ba7,26);
    addMovingCar(scene,[{x:60,z:-340},{x:60,z:330}],0x28f5ff,21);
    addMovingCar(scene,[{x:-180,z:330},{x:-180,z:-330}],0xffca4f,19);
    addMovingCar(scene,[{x:-330,z:180},{x:330,z:180}],0x8eff7a,23);
  }
  function create(scene, missions){
    colliders.length=0; missionObjects.length=0; npcs.length=0; movingCars.length=0;
    scene.background = new THREE.Color(0x1a1030); scene.fog = new THREE.FogExp2(0x1a1030, 0.0012);
    const hemi = new THREE.HemisphereLight(0xffe2c4,0x152949,1.55); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff,1.05); sun.position.set(90,120,60); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); scene.add(sun);
    const magenta = new THREE.PointLight(0xff3acb,2.2,130); magenta.position.set(-110,25,80); scene.add(magenta);
    const cyan = new THREE.PointLight(0x28f5ff,2.0,130); cyan.position.set(125,28,-90); scene.add(cyan);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(bounds.size,bounds.size), new THREE.MeshStandardMaterial({color:0x294a55,roughness:.72})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
    createRoadNetwork(scene);
    // Safe стартовая площадь: хорошо видна сразу после старта и не имеет коллизий.
    box(scene,{x:0,y:.045,z:0,w:46,h:.06,d:46,color:0x2d4350,emissive:0x061722});
    box(scene,{x:0,y:.09,z:-20,w:18,h:.08,d:2,color:0x28f5ff,emissive:0x0a4a66});
    box(scene,{x:0,y:.09,z:20,w:18,h:.08,d:2,color:0xff3acb,emissive:0x4a063c});
    // V11: яркий ориентир прямо перед стартом, чтобы экран не казался пустым.
    box(scene,{x:-9,y:4,z:-18,w:2,h:8,d:2,color:0x28f5ff,emissive:0x0b5266});
    box(scene,{x:9,y:4,z:-18,w:2,h:8,d:2,color:0xff3acb,emissive:0x661047});
    box(scene,{x:0,y:8.4,z:-18,w:20,h:1.4,d:2,color:0xffca4f,emissive:0x5a3708});
    addStreetLight(scene,-8,-8); addStreetLight(scene,8,-8);
    createDistricts(scene);
    createDecor(scene);
    createTraffic(scene);
    for(let i=0;i<28;i++){
      let x=0, z=0, tries=0;
      do { x = -330 + Math.random()*660; z = -330 + Math.random()*660; tries++; } while(obstacleAt(x,z) && tries < 100);
      makeNPC(scene, x, z, [0xffd86b,0xff5ba7,0x28f5ff,0x8eff7a][i%4]);
    }
    addCollider(0,bounds.min-2,bounds.size,4,'border'); addCollider(0,bounds.max+2,bounds.size,4,'border'); addCollider(bounds.min-2,0,4,bounds.size,'border'); addCollider(bounds.max+2,0,4,bounds.size,'border');
    missions.forEach(m => addMissionMarker(scene,m));
  }
  return { create, update, colliders, dynamicColliders, movingCarColliders, missionObjects, removeMissionMarker, setMissionMarkerActive, spawnDeathBody, clearDeathBody, bounds }; 
})();
