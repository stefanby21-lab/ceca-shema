/* Interactive seat-specific Arena view. Coordinates, stage and tables share
   VENUE with the ticket picker. Estimated elevations are disclosed in the UI. */
window.ArenaSeatView = (function () {
  "use strict";
  let active = null,
    threePromise = null;
  function close() {
    if (active) active.dispose();
    active = null;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    e.className = cls || "";
    if (text) e.textContent = text;
    return e;
  }
  async function open(options) {
    close();
    const previous = document.activeElement,
      overlay = el("section", "arena-view"),
      header = el("header", "arena-view__head");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", options.title);
    // Заглавието на мястото стои ДОЛУ, в самия избор на място - там, където и
    // се сменя. Горе беше същият низ втори път: „Сектор E.0.1 · ред 13 ·
    // място 12" се четеше и в шапката, и в падащото меню.
    const heading = el("div", "arena-view__glass");
    heading.append(el("span", "arena-view__eyebrow", "АРЕНА 8888 · ОТ ВАШЕТО МЯСТО"));
    const exit = el("button", "arena-view__close arena-view__glass");
    exit.type = "button";
    exit.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    exit.setAttribute("aria-label", "Затворете изгледа");
    exit.title = "Затворете";
    header.append(heading, exit);
    const stage = el("div", "arena-view__stage"),
      status = el("p", "arena-view__status", "Подготвяме гледката…");
    stage.append(status);
    const footer = el("footer", "arena-view__foot arena-view__glass");
    const controls = el("div", "arena-view__controls");
    const reset = el("button", "arena-view__to-stage", "Към сцената"),
      zoom = el("div", "arena-view__zoom"),
      minus = el("button", "", "−"),
      plus = el("button", "", "+");
    minus.setAttribute("aria-label", "По-широк изглед");
    plus.setAttribute("aria-label", "Приближете сцената");
    for (const b of [reset, minus, plus]) b.type = "button";
    zoom.append(minus, plus);
    controls.append(reset, zoom);
    // Уговорката остава - височините са изчислени, не измерени - но като две
    // думи, а не като изречение, което обяснява очевидното.
    footer.append(controls, el("p", "arena-view__note", "Ориентировъчен изглед"));
    overlay.append(header, stage, footer);
    document.body.append(overlay);
    exit.focus();
    const listeners = [],
      resources = new Set();
    let renderer,
      scene,
      raf = 0,
      disposed = false;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const inertElements = Array.from(document.body.children).filter(
      (e) => e !== overlay && !e.inert,
    );
    inertElements.forEach((e) => (e.inert = true));
    function on(target, event, fn, opts) {
      target.addEventListener(event, fn, opts);
      listeners.push(() => target.removeEventListener(event, fn, opts));
    }
    const session = {
      dispose() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(raf);
        listeners.forEach((f) => f());
        observer?.disconnect();
        scene?.traverse((o) => {
          if (o.geometry) resources.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m) resources.add(m);
        });
        resources.forEach((r) => r.dispose());
        renderer?.dispose();
        renderer?.forceContextLoss();
        overlay.remove();
        inertElements.forEach((e) => (e.inert = false));
        document.body.style.overflow = bodyOverflow;
        previous?.focus({ preventScroll: true });
      },
    };
    let observer;
    active = session;
    on(exit, "click", close);
    on(overlay, "keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab") {
        const items = Array.from(overlay.querySelectorAll("button:not([hidden]), select, canvas")).filter(e => !e.disabled);
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
          e.preventDefault();
          items[0].focus();
        }
      }
    });
    try {
      threePromise ||= import(
        new URL("vendor/three.module.js?v=0.160.0", document.baseURI).href
      ).catch((e) => {
        threePromise = null;
        throw e;
      });
      const T = await threePromise;
      if (disposed) return;
      const G = window.ArenaGeometry,
        v = G.forView(options.venue),
        scale = G.SCALE,
        focus = v.focus,
        own = v.seats.features.find((f) => f.properties.mk === options.mk) || v.tables.features.find((f) => f.properties.mk === options.mk);
      if (!own) throw Error("Seat missing");
      renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      renderer.setClearColor(0xe8edf5);
      renderer.outputColorSpace = T.SRGBColorSpace;
      stage.append(renderer.domElement);
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute(
        "aria-label",
        "Гледка от мястото. Плъзнете за оглед или използвайте стрелките.",
      );
      scene = new T.Scene();
      scene.background = new T.Color(0xe8edf5);
      scene.fog = new T.Fog(0xe8edf5, 160, 280);
      scene.add(new T.HemisphereLight(0xffffff, 0x728196, 2.2));
      const sun = new T.DirectionalLight(0xfff6e9, 2.1);
      sun.position.set(-20, 35, 10);
      scene.add(sun);
      const concrete = new T.MeshStandardMaterial({
          color: 0xc5cbd4,
          roughness: 0.85,
        }),
        floorMat = new T.MeshStandardMaterial({
          color: 0xdde2e9,
          roughness: 0.9,
        }),
        red = new T.MeshStandardMaterial({ color: 0xa7253b, roughness: 0.52 }),
        metal = new T.MeshStandardMaterial({
          color: 0x8493a8,
          metalness: 0.65,
          roughness: 0.4,
        });
      resources.add(concrete);
      resources.add(red);
      resources.add(metal);
      resources.add(floorMat);
      function box(w, h, d, x, y, z, mat) {
        const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        scene.add(m);
        return m;
      }
      function extrude(ring, height, base, mat) {
        const shape = new T.Shape(
          ring.map((p) => new T.Vector2(p[0] * scale, -p[1] * scale)),
        );
        const geo = new T.ExtrudeGeometry(shape, {
          depth: height * scale,
          bevelEnabled: false,
        });
        geo.rotateX(Math.PI / 2);
        geo.translate(0, (base + height) * scale, 0);
        const mesh = new T.Mesh(geo, mat);
        scene.add(mesh);
        return mesh;
      }
      box(144, 0.3, 144, 0, -0.18, 0, floorMat);
      // Continue the concrete treads through the aisles between neighboring sectors.
      for (const {ring, height} of G.terraces(v)) extrude(ring,height,0,concrete);
      for (const run of v.adjacency.runs) {
        const seats=run.map(i=>v.seats.features[i]);
        if(seats.length<2 || !seats[0].properties.el)continue;
        const ring=G.band(seats.map(f=>f.geometry.coordinates));
        if(ring)extrude(ring,seats[0].properties.el,0,concrete);
      }
      // Circulation follows the front edges and row ends in the SVG.
      // Gaps wider than an entrance stay open; heights remain an estimate.
      const railSegments = [], sectorRows = new Map();
      for(const run of v.adjacency.runs) {
        const features=run.map(i=>v.seats.features[i]);
        if(features.length<2 || features[0].properties.el<=0) continue;
        const token=features[0].properties.s;
        if(!sectorRows.has(token))sectorRows.set(token,[]);
        sectorRows.get(token).push(features);
      }
      const fronts = new Map();
      function railing(a,b,height) {
        const length=Math.hypot(b[0]-a[0],b[1]-a[1])*scale;
        for(const y of [.52,1.04])railSegments.push([[a[0]*scale,height+y,-a[1]*scale],[b[0]*scale,height+y,-b[1]*scale]]);
        const posts=Math.max(1,Math.ceil(length/1.5));
        for(let i=0;i<=posts;i++){const t=i/posts,x=(a[0]+(b[0]-a[0])*t)*scale,z=-(a[1]+(b[1]-a[1])*t)*scale;railSegments.push([[x,height,z],[x,height+1.04,z]]);}
      }
      for(const rows of sectorRows.values()) {
        rows.sort((a,b)=>a[0].properties.el-b[0].properties.el);
        const base=rows[0][0].properties.el;
        if(!fronts.has(base))fronts.set(base,[]);
        for(const row of rows.filter(r=>Math.abs(r[0].properties.el-base)<.001)) fronts.get(base).push(...row.map(f=>f.geometry.coordinates));
        // Stair strips at both ends of each run connect successive terraces.
        for(const row of rows)for(const endpoint of [0,row.length-1]){
          const f=row[endpoint],p=f.geometry.coordinates,q=row[endpoint===0?1:row.length-2].geometry.coordinates;
          const len=Math.hypot(p[0]-q[0],p[1]-q[1])||1,tx=(p[0]-q[0])/len,ty=(p[1]-q[1])/len;
          const nx=Math.sin(f.properties.seatYaw),ny=-Math.cos(f.properties.seatYaw);
          const c=[p[0]+tx*.23,p[1]+ty*.23],h=f.properties.el;
          for(let step=0;step<2;step++){
            const d=(step-.5)*.105,cc=[c[0]+nx*d,c[1]+ny*d];
            const ring=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[cc[0]+tx*a*.135+nx*b*.053,cc[1]+ty*a*.135+ny*b*.053]);
            extrude(ring,.045,Math.max(0,h+(step?0:-G.RISE/2)-.045),concrete);
          }
        }
      }
      for(const [height,points] of fronts){
        points.sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));
        for(let i=0;i<points.length;i++){
          const a=points[i],b=points[(i+1)%points.length],distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
          if(distance<.02||distance>3.2)continue;
          const offset=(p,d)=>{const r=Math.hypot(...p);return[p[0]*(r-d)/r,p[1]*(r-d)/r];};
          const outerA=offset(a,.14),outerB=offset(b,.14),innerA=offset(a,.54),innerB=offset(b,.54);
          extrude([outerA,outerB,innerB,innerA],.07,Math.max(0,height-.07),concrete);
          // Leave openings at larger gaps between sector entrances.
          if(distance<.65)railing(innerA,innerB,height*scale);
        }
      }
      if(railSegments.length){
        const rail=new T.InstancedMesh(new T.CylinderGeometry(.025,.025,1,6),metal,railSegments.length),object=new T.Object3D(),up=new T.Vector3(0,1,0);
        railSegments.forEach(([a,b],i)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),direction=end.clone().sub(start);object.position.copy(start.add(end).multiplyScalar(.5));object.quaternion.setFromUnitVectors(up,direction.clone().normalize());object.scale.set(1,direction.length(),1);object.updateMatrix();rail.setMatrixAt(i,object.matrix);});scene.add(rail);
      }
      const count = v.seats.features.length,
        matrix = new T.Object3D();
      function roundedBox(width, height, depth, radius) {
        const shape = new T.Shape();
        const x = -width / 2,
          y = -height / 2,
          r = radius;
        shape.moveTo(x + r, y);
        shape.lineTo(x + width - r, y);
        shape.quadraticCurveTo(x + width, y, x + width, y + r);
        shape.lineTo(x + width, y + height - r);
        shape.quadraticCurveTo(
          x + width,
          y + height,
          x + width - r,
          y + height,
        );
        shape.lineTo(x + r, y + height);
        shape.quadraticCurveTo(x, y + height, x, y + height - r);
        shape.lineTo(x, y + r);
        shape.quadraticCurveTo(x, y, x + r, y);
        const geo = new T.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelThickness: 0.014,
          bevelSize: 0.015,
          bevelSegments: 2,
          steps: 1,
          curveSegments: 4,
        });
        geo.translate(0, 0, -depth / 2);
        return geo;
      }
      const cushion = roundedBox(0.41, 0.38, 0.07, 0.05);
      cushion.rotateX(-Math.PI / 2);
      const bottoms = new T.InstancedMesh(cushion, red, count),
        backs = new T.InstancedMesh(
          roundedBox(0.41, 0.45, 0.065, 0.075),
          red,
          count,
        );
      const ownPoint = own.geometry.coordinates;
      v.seats.features.forEach((f, i) => {
        const p = f.geometry.coordinates,
          y = f.properties.el * scale,
          angle = f.properties.seatYaw || 0;
        if (f.properties.el === 0) {
          matrix.scale.set(0, 0, 0); matrix.updateMatrix();
          bottoms.setMatrixAt(i, matrix.matrix); backs.setMatrixAt(i, matrix.matrix);
          matrix.scale.set(1, 1, 1); return;
        }
        matrix.rotation.set(0, angle, 0);
        matrix.position.set(p[0] * scale, y + 0.45, -p[1] * scale);
        matrix.updateMatrix();
        bottoms.setMatrixAt(i, matrix.matrix);
        matrix.position.x += Math.sin(angle) * 0.18;
        matrix.position.z += Math.cos(angle) * 0.18;
        matrix.position.y = y + 0.69;
        matrix.updateMatrix();
        backs.setMatrixAt(i, matrix.matrix);
      });
      scene.add(bottoms, backs);
      // Actual concert stage outline (including runway), not a generic rectangle.
      const stageMat = new T.MeshStandardMaterial({
        color: 0x18223c,
        roughness: 0.75,
      });
      extrude(v.stage.geometry.coordinates[0], 0.4, 0, stageMat);
      const stagePoints = v.stage.geometry.coordinates[0],
        minX = Math.min(...stagePoints.map((p) => p[0])),
        maxX = Math.max(...stagePoints.map((p) => p[0])),
        backY = Math.max(...stagePoints.map((p) => p[1]));
      const stageWidth = (maxX - minX) * scale,
        stageCenter = (minX + maxX) * scale / 2,
        stageBack = -backY * scale,
        screenHeight = 10.8,
        screenBase = 1.35,
        rigTop = 13.2;
      const screenHousing = new T.MeshStandardMaterial({color:0x101319, roughness:.85});
      box(stageWidth + .7, screenHeight + .6, .5, stageCenter,
        screenBase + screenHeight / 2, stageBack, screenHousing);
      const banner = el("canvas");
      banner.width = 2048; banner.height = 720;
      const ctx = banner.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, banner.width, banner.height);
      gradient.addColorStop(0, '#0c121d'); gradient.addColorStop(.55, '#263238'); gradient.addColorStop(1, '#080c12');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, banner.width, banner.height);
      const poster = new Image(); poster.src = 'assets/ceca.webp';
      try { await poster.decode(); } catch (_) {}
      if (disposed) return;
      if (poster.naturalWidth) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 650, 720); ctx.clip();
        const ratio = 650 / poster.naturalWidth, shown = poster.naturalHeight * ratio;
        // Афишът е квадрат: стои по средата на височината, не залепен отгоре.
        ctx.drawImage(poster, 0, Math.max(0, (720 - shown) / 2), 650, shown); ctx.restore();
        const fade = ctx.createLinearGradient(450, 0, 690, 0);
        fade.addColorStop(0, '#151e2600'); fade.addColorStop(1, '#151e26');
        ctx.fillStyle = fade; ctx.fillRect(450, 0, 240, 720);
      }
      ctx.strokeStyle = '#b9a675'; ctx.lineWidth = 2;
      ctx.strokeRect(715, 85, 1245, 550);
      const textCenter = 1338;
      ctx.textAlign = 'center'; ctx.fillStyle = '#d3c49b';
      ctx.font = '500 28px sans-serif'; ctx.fillText('К О Н Ц Е Р Т', textCenter, 235);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 210px sans-serif';
      ctx.fillText('CECA', textCenter, 410, 1160);
      ctx.fillStyle = '#d3c49b'; ctx.font = '28px sans-serif';
      ctx.fillText('7 НОЕМВРИ 2026 · АРЕНА 8888', textCenter, 510);
      const texture = new T.CanvasTexture(banner);
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      resources.add(texture);
      const screen = new T.Mesh(
        new T.PlaneGeometry(stageWidth, screenHeight),
        new T.MeshBasicMaterial({ map: texture }),
      );
      screen.position.set(stageCenter, screenBase + screenHeight / 2, stageBack + .27);
      scene.add(screen);

      // Concert rig: two box trusses, cross braces and freestanding towers.
      function tube(a, b, radius=.065) {
        const start=new T.Vector3(...a), end=new T.Vector3(...b), delta=end.clone().sub(start);
        const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,delta.length(),6),metal);
        mesh.position.copy(start.add(end).multiplyScalar(.5));
        mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
        scene.add(mesh);
      }
      const left = minX * scale - 1, right = maxX * scale + 1,
        frontRig = stageBack + 6.8, rearRig = stageBack - .5;
      for (const z of [rearRig, frontRig]) {
        for (const y of [rigTop-.7,rigTop]) for(const dz of [-.35,.35])
          tube([left,y,z+dz],[right,y,z+dz]);
        const bays=Math.ceil((right-left)/1.5), pitch=(right-left)/bays;
        for(let i=0;i<bays;i++) for(const dz of [-.35,.35]) {
          const x=left+i*pitch;
          tube([x,rigTop-.7,z+dz],[x+pitch,rigTop,z+dz],.038);
          tube([x,rigTop,z+dz],[x+pitch,rigTop-.7,z+dz],.038);
        }
      }
      for(const x of [left,right]) {
        for(const dz of [-.3,.3]) for(const dx of [-.3,.3])
          tube([x+dx,.1,rearRig+dz],[x+dx,rigTop,rearRig+dz]);
        for(let y=.2;y<rigTop-1;y+=1) for(const dz of [-.3,.3])
          tube([x-.3,y,rearRig+dz],[x+.3,y+1,rearRig+dz],.04);
        tube([x,rigTop,rearRig],[x,rigTop,frontRig]);
        box(1.6,.14,1.6,x,.07,rearRig,screenHousing);
      }
      const lampBody=new T.MeshStandardMaterial({color:0x16191e,roughness:.55,metalness:.35});
      const lens=new T.MeshBasicMaterial({color:0xfff2ce,toneMapped:false});
      const lampFaces=[];
      for(let i=0;i<12;i++) {
        const x=left+1.4+(right-left-2.8)*i/11;
        box(.32,.3,.35,x,rigTop-.85,frontRig,lampBody);
        const head=new T.Mesh(new T.CylinderGeometry(.24,.31,.64,12),lampBody);
        head.position.set(x,rigTop-1.3,frontRig);
        const aim=new T.Vector3(stageCenter+(x-stageCenter)*.6,1.23,stageBack+3.8);
        const direction=aim.clone().sub(head.position).normalize();
        head.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);scene.add(head);
        const lightFace=new T.Mesh(new T.CircleGeometry(.235,12),lens);
        lightFace.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction);
        lightFace.position.copy(head.position).addScaledVector(direction,.325);scene.add(lightFace);
        lampFaces.push({origin:lightFace.position.clone(),target:aim});
      }
      // Static light beams and four stage washes, without shadows or animation.
      const beamMaterials=[0xffddb0,0xbfdcff].map(color=>new T.MeshBasicMaterial({
        color,transparent:true,opacity:.085,depthWrite:false,blending:T.AdditiveBlending,
        side:T.DoubleSide,toneMapped:false
      }));
      for(let i=0;i<6;i++) {
        const {origin,target}=lampFaces[[0,2,4,7,9,11][i]];
        const axis=origin.clone().sub(target), length=axis.length();
        const beam=new T.Mesh(new T.ConeGeometry(1.35,length,20,1,true),beamMaterials[i%2]);
        beam.position.copy(origin.clone().add(target).multiplyScalar(.5));
        beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize());
        scene.add(beam);
      }
      for(let i=0;i<4;i++) {
        const light=new T.SpotLight(i%2?0xc6ddff:0xffe6bf,420,40,.38,.7,1.4);
        light.position.set(stageCenter+(i-1.5)*6,rigTop-1.3,frontRig);
        light.target.position.set(stageCenter+(i-1.5)*4,1.22,stageBack+3.8);
        scene.add(light,light.target);
      }
      // Pleated side drapes hide backstage from seats on either side of the arena.
      const drape=new T.MeshStandardMaterial({color:0x202126,roughness:1,side:T.DoubleSide});
      function curtain(width,height,x,z,rotation=0) {
        const geometry=new T.PlaneGeometry(width,height,Math.ceil(width*12),20);
        const points=geometry.attributes.position;
        for(let i=0;i<points.count;i++) {
          const px=points.getX(i), py=points.getY(i), drop=(height/2-py)/height;
          const fold=Math.sin(px*Math.PI*1.7)+.22*Math.sin(px*Math.PI*3.4+.6);
          points.setZ(i,fold*(.28+.14*drop)+Math.sin(drop*Math.PI)*.18);
          points.setY(i,py + drop*drop*(.14+.10*Math.cos(px*Math.PI*1.7)));
        }
        geometry.computeVertexNormals();
        const mesh=new T.Mesh(geometry,drape);mesh.rotation.y=rotation;
        mesh.position.set(x,height/2,z);scene.add(mesh);
      }
      const curtainDepth=13, curtainFront=frontRig-2.2;
      for(const x of [left-2.8,right+2.8]) {
        curtain(curtainDepth,12.1,x,curtainFront-curtainDepth/2,Math.PI/2);
        curtain(2.6,12.1,x+(x<stageCenter?1.3:-1.3),curtainFront, x<stageCenter?-.18:.18);
      }
      // Full rear masking hides the closed seating behind the stage.
      // It sits behind the performance area, clear of the side audience sightlines.
      const rearMaskWidth=49, rearMaskHeight=16;
      curtain(rearMaskWidth,rearMaskHeight,stageCenter,curtainFront-curtainDepth);
      tube([stageCenter-rearMaskWidth/2,rearMaskHeight+.15,curtainFront-curtainDepth],
        [stageCenter+rearMaskWidth/2,rearMaskHeight+.15,curtainFront-curtainDepth],.085);
      const tables = v.tables.features;
      const black = new T.MeshStandardMaterial({color:0x171b20, roughness:.4, metalness:.55});
      function merged(parts) {
        const result=new T.BufferGeometry(), geometries=parts.map(([geo,x=0,y=0,z=0,rx=0,ry=0,rz=0])=>{
          geo.rotateX(rx);geo.rotateY(ry);geo.rotateZ(rz);geo.translate(x,y,z);
          const flat=geo.index?geo.toNonIndexed():geo; if(flat!==geo)geo.dispose();return flat;
        });
        for(const name of ['position','normal','uv','color']){
          // uv и color се копират само ако ги има във всички части.
          if(!geometries.every(g=>g.attributes[name]))continue;
          const size=geometries[0].attributes[name].itemSize;
          const data=new Float32Array(geometries.reduce((n,g)=>n+g.attributes[name].array.length,0));let offset=0;
          for(const g of geometries){data.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}
          result.setAttribute(name,new T.BufferAttribute(data,size));
        }
        geometries.forEach(g=>g.dispose());return result;
      }
      function instances(geometry, material, positions) {
        const mesh=new T.InstancedMesh(geometry,material,positions.length);
        positions.forEach((p,i)=>{matrix.position.set(p.x,p.y||0,p.z);matrix.rotation.set(0,p.angle||0,0);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);});
        scene.add(mesh);return mesh;
      }
      // Коктейлни маси за 6 души: висока черна метална маса БЕЗ покривка, цветя и
      // вази, и два квадратни бар стола без възглавница откъм зрителите.
      // Сцената е към -z, затова столовете са на +z и гостите гледат към нея.
      // Местата на масата са билети, не столове.
      // Столовете са „щъркели": седалката е на 0.78 м срещу плот на 1.07 м, а
      // очите на седналия са ~0.75 м над седалката.
      const TOP_R=.35, TOP_Y=1.07, SEAT_Y=.78, EYE_Y=SEAT_Y+.75, STOOLS=[[-.38,.82],[.38,.82]];
      // Мат метал за столовете и колоната; плотът е гланциран лак по снимката
      // на истинските ВИП маси.
      const tableMetal = new T.MeshStandardMaterial({color:0x1b1e23, roughness:.52, metalness:.5});
      const topGloss = new T.MeshStandardMaterial({color:0x0b0c0f, roughness:.16, metalness:.4});
      resources.add(tableMetal);resources.add(topGloss);
      const tablePositions=tables.map(f=>({x:f.geometry.coordinates[0]*scale,z:-f.geometry.coordinates[1]*scale}));
      const floorChairs=v.seats.features.filter(f=>f.properties.el===0).map(f=>({x:f.geometry.coordinates[0]*scale,z:-f.geometry.coordinates[1]*scale,angle:0}));
      const stoolSpots=[];
      tables.forEach(f=>{const [x,y]=f.geometry.coordinates;
        for(const [dx,dz] of STOOLS)stoolSpots.push({x:x*scale+dx,z:-y*scale+dz,angle:0});
      });
      const floorParts=[[new T.BoxGeometry(.46,.045,.42),0,.445],[roundedBox(.44,.25,.035,.065),0,.72,.185]];
      for(const x of [-.19,.19]){floorParts.push([new T.CylinderGeometry(.013,.013,.78,6),x,.39,.18],[new T.CylinderGeometry(.013,.013,.43,6),x,.215,-.18]);}
      instances(merged(floorParts),black,floorChairs);
      // Маса: гланциран плот, една права колона и кръгла основа - едно слято
      // тяло за всичките 180 маси (instancing), без отделни мрежи.
      const tableTops=instances(merged([[new T.CylinderGeometry(TOP_R,TOP_R,.035,32),0,TOP_Y-.0175]]),topGloss,tablePositions);
      instances(merged([
        [new T.CylinderGeometry(.045,.045,.04,12),0,TOP_Y-.055],
        [new T.CylinderGeometry(.026,.026,TOP_Y-.1,10),0,(TOP_Y-.1)/2+.04],
        [new T.CylinderGeometry(.2,.22,.04,24),0,.02]
      ]),tableMetal,tablePositions);
      // Бар стол: квадратна метална седалка без възглавница на четири прави
      // крака от тънка квадратна тръба и квадратна рамка за краката на 0.30 м.
      const stoolParts=[[new T.BoxGeometry(.34,.03,.34),0,SEAT_Y-.015]];
      for(const sx of [-1,1])for(const sz of [-1,1])stoolParts.push([new T.BoxGeometry(.02,SEAT_Y-.03,.02),sx*.15,(SEAT_Y-.03)/2,sz*.15]);
      for(const sz of [-1,1])stoolParts.push([new T.BoxGeometry(.28,.014,.014),0,.3,sz*.15]);
      for(const sx of [-1,1])stoolParts.push([new T.BoxGeometry(.014,.014,.28),sx*.15,.3,0]);
      instances(merged(stoolParts),tableMetal,stoolSpots);

      // ---- Консумацията към масата (meta.vipTableIncludes) ----
      // Една бутилка премиум алкохол 700 мл, 5 бутилки минерална вода 330 мл и
      // 5 кена Vidas 250 мл - точно колкото са в офертата и нищо друго. Само тук:
      // на картата масите остават голи. Профилите са въртене на гладка крива
      // (LatheGeometry), не купчина цилиндри. Две нива на детайл: масата, от
      // която гледаш, е с 24 сегмента, останалите 179 - с 10, като instancing.
      // Среда за отраженията има само за напитките и плота: общата светлина на
      // залата остава същата.
      const envScene=new T.Scene();
      envScene.add(new T.Mesh(new T.BoxGeometry(30,16,30),new T.MeshBasicMaterial({color:0x5b6573,side:T.BackSide})));
      const envPanel=(w,h,x,y,z,k,ry=0,rx=0)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color().setScalar(k),side:T.DoubleSide}));m.position.set(x,y,z);m.rotation.set(rx,ry,0);envScene.add(m);};
      envPanel(10,10,0,7.5,0,9,0,Math.PI/2);          // ключов панел отгоре
      envPanel(3,8,-12,3,0,5,Math.PI/2);               // мека странична лента
      envPanel(4,6,10,2,5,1.6,-Math.PI/2);             // слаб пълнеж
      envPanel(30,30,0,-7.9,0,.08,0,Math.PI/2);        // тъмен под
      const pmrem=new T.PMREMGenerator(renderer),envTarget=pmrem.fromScene(envScene,.04);
      pmrem.dispose();resources.add(envTarget);envScene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
      topGloss.envMap=envTarget.texture;topGloss.envMapIntensity=.7;
      const lathe=(pts,seg,hex)=>{const g=new T.LatheGeometry(pts.map(([r,y])=>new T.Vector2(r,y)),seg);
        if(hex!=null){const c=new T.Color(hex),n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(a,3));}
        return g;};
      // Крива рамо: квадрант (кръгло рамо) или S-плавен преход (дълъг конус).
      const curve=(r0,r1,y0,y1,n,round)=>Array.from({length:n},(_,k)=>{const t=(k+1)/n;
        return round?[r1+(r0-r1)*Math.cos(t*Math.PI/2),y0+(y1-y0)*Math.sin(t*Math.PI/2)]
                    :[r1+(r0-r1)*(1-t*t*(3-2*t)),y0+(y1-y0)*t];});
      const bandTexture=(draw)=>{const c=document.createElement('canvas');c.width=128;c.height=64;draw(c.getContext('2d'),128,64);
        const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;resources.add(t);return t;};
      const spiritLabel=bandTexture((g,w,h)=>{g.fillStyle='#efe6d2';g.fillRect(0,0,w,h);g.fillStyle='#b8923f';g.fillRect(0,4,w,3);g.fillRect(0,h-7,w,3);
        g.fillStyle='#7d6a43';g.fillRect(w*.3,h*.42,w*.4,4);g.fillRect(w*.38,h*.56,w*.24,3);});
      const waterLabel=bandTexture((g,w,h)=>{g.fillStyle='#f6fafc';g.fillRect(0,0,w,h);g.fillStyle='#1d5fae';g.fillRect(0,h*.42,w,h*.2);g.fillStyle='#8fbfe0';g.fillRect(0,h*.36,w,3);g.fillRect(0,h*.66,w,3);});
      const canTexture=bandTexture((g,w,h)=>{g.fillStyle='#17996f';g.fillRect(0,0,w,h);const sw=g.createLinearGradient(0,h,w,0);
        sw.addColorStop(0,'rgba(255,255,255,0)');sw.addColorStop(.45,'rgba(255,255,255,.34)');sw.addColorStop(.62,'rgba(255,255,255,0)');
        g.fillStyle=sw;g.fillRect(0,0,w,h);g.fillStyle='rgba(8,70,50,.5)';g.fillRect(0,0,w,5);g.fillRect(0,h-5,w,5);});
      const mat=o=>{const m=new T.MeshStandardMaterial(Object.assign({envMap:envTarget.texture},o));resources.add(m);return m;};
      const spiritGlass=mat({color:0x3a2a18,roughness:.08,metalness:0,transparent:true,opacity:.9,envMapIntensity:1.4});
      const waterGlass=mat({color:0xd6ecf5,roughness:.05,metalness:0,transparent:true,opacity:.45,envMapIntensity:1.4,depthWrite:false});
      const capMetal=mat({vertexColors:true,metalness:.75,roughness:.32,envMapIntensity:1.2});
      const spiritLabelMat=mat({map:spiritLabel,roughness:.7,side:T.DoubleSide});
      const waterLabelMat=mat({map:waterLabel,roughness:.6,side:T.DoubleSide});
      const canBodyMat=mat({map:canTexture,roughness:.38,metalness:.35,envMapIntensity:.8});
      // Бутилка 700 мл (кехлибар): тяло 0.042, кръгло рамо, гърло, пръстен, капачка.
      const spiritProfile=[[0,0],[.036,0],[.042,.004],[.042,.17],...curve(.042,.0125,.17,.215,6,true),[.0125,.255],[.015,.256],[.015,.262],[0,.262]];
      // Вода 330 мл: дълъг плавен конус до гърлото 0.0115, капачка 0.0135.
      const waterProfile=[[0,0],[.027,0],[.031,.003],[.031,.12],...curve(.031,.0115,.12,.175,6,false),[.0115,.19],[0,.19]];
      // Кен Vidas 250 мл: купол на дъното, права стена, стесняване и ръб.
      const canProfile=[[0,.004],[.0185,.0015],[.022,0],[.0265,.008],[.0265,.122],[.0225,.132],[.023,.135],[.0195,.135],[0,.133]];
      const labelBand=(r,y0,y1,seg,full)=>{const g=new T.CylinderGeometry(r,r,y1-y0,seg,1,true,full?0:Math.PI-1.22,full?Math.PI*2:2.44);g.translate(0,(y0+y1)/2,0);return g;};
      // Подредба, събрана в средата на плота (радиус 0.35, нищо по-близо от 0.08 м до ръба):
      // бутилката в средата, водите дъга зад нея към сцената, кеновете дъга пред нея.
      // Цялата подредба е ЕДНА мрежа на тип материал (11 предмета са запечени в
      // геометрията, с малък завой на всеки), а маса = една инстанция със свой
      // завой: така напитките са общо 6 извиквания за рисуване на ниво.
      const SWEEP=[-.9,-.45,0,.45,.9];
      const WATERS=SWEEP.map(a=>[Math.sin(a)*.17,-Math.cos(a)*.17]);
      const CANS=SWEEP.map(a=>[Math.sin(a)*.2,Math.cos(a)*.2]);
      // Завоят на предмета (запечен) и на цялата подредба (от номера на масата).
      const itemYaw=j=>(((j*7)%5)-2)*.2,tableYaw=t=>(((t*37)%11)-5)*.05;
      const bottle={
        glass:seg=>lathe(spiritProfile,seg),
        label:seg=>labelBand(.0425,.06,.13,seg,false),
        metal:seg=>[lathe([[0,.262],[.016,.262],[.016,.298],[.0145,.3],[0,.3]],seg,0x15161a),lathe([[.0165,.266],[.0165,.2695],[.0155,.2695],[.0155,.266]],seg,0xc9a24a)]};
      const water={
        glass:seg=>lathe(waterProfile,seg),
        label:seg=>labelBand(.0315,.05,.095,seg,true),
        metal:seg=>[lathe([[0,.19],[.0135,.19],[.0135,.2],[.0125,.205],[0,.205]],seg,0x1d5fae)]};
      const can={body:seg=>labelBand(.0268,.012,.118,seg,true),metal:seg=>[lathe(canProfile,seg,0xc9ccd1)]};
      const cluster=(seg,pick)=>{const parts=[];
        const put=(make,at,k)=>at.forEach(([dx,dz],j)=>{const g=make(seg);(Array.isArray(g)?g:[g]).forEach(geo=>parts.push([geo,dx,0,dz,0,itemYaw(j+k),0]));});
        pick(put);return merged(parts);};
      function drinkSet(seg,tableIdx){
        const spots=tableIdx.map(t=>({x:tablePositions[t].x,z:tablePositions[t].z,y:TOP_Y,angle:tableYaw(t)}));
        return [
          instances(cluster(seg,put=>put(bottle.glass,[[0,0]],0)),spiritGlass,spots),
          instances(cluster(seg,put=>put(bottle.label,[[0,0]],0)),spiritLabelMat,spots),
          instances(cluster(seg,put=>put(water.glass,WATERS,1)),waterGlass,spots),
          instances(cluster(seg,put=>put(water.label,WATERS,1)),waterLabelMat,spots),
          instances(cluster(seg,put=>put(can.body,CANS,7)),canBodyMat,spots),
          // Метал: капачките на бутилките и целите кенове - една мрежа.
          instances(cluster(seg,put=>{put(bottle.metal,[[0,0]],0);put(water.metal,WATERS,1);put(can.metal,CANS,7);}),capMetal,spots)];
      }
      const allIdx=tables.map((_,i)=>i);
      const lowSet=drinkSet(10,allIdx);
      const highSet=drinkSet(24,[0]);
      // Масата, от която гледаш, получава детайлния набор (24 сегмента);
      // обикновената ѝ копия (10) се скрива с нулев мащаб. Работи се само при
      // смяна на гледната точка, не на кадър.
      let drinkOwn=-2;
      const hideMatrix=new T.Object3D();hideMatrix.scale.set(0,0,0);hideMatrix.updateMatrix();
      function lowAt(t,hide){
        matrix.position.set(tablePositions[t].x,TOP_Y,tablePositions[t].z);matrix.rotation.set(0,tableYaw(t),0);matrix.updateMatrix();
        for(const mesh of lowSet){mesh.setMatrixAt(t,hide?hideMatrix.matrix:matrix.matrix);mesh.instanceMatrix.needsUpdate=true;}
      }
      function setDrinkOwn(t){
        if(t===drinkOwn)return;
        if(drinkOwn>=0)lowAt(drinkOwn,false);
        drinkOwn=t;
        matrix.position.set(t>=0?tablePositions[t].x:0,TOP_Y,t>=0?tablePositions[t].z:0);matrix.rotation.set(0,t>=0?tableYaw(t):0,0);matrix.updateMatrix();
        for(const mesh of highSet){mesh.visible=t>=0;if(t>=0){mesh.setMatrixAt(0,matrix.matrix);mesh.instanceMatrix.needsUpdate=true;}}
        if(t>=0)lowAt(t,true);
      }
      setDrinkOwn(-1);
      // FOH occupies the intentional gap behind the middle floor block.
      box(8.8,.16,4.0,0,.08,24.2,black);
      box(5,.75,.8,0,.52,23.5,black);
      for(const x of [-1.7,0,1.7]){box(.65,.38,.06,x,1.1,23.42,black);box(.5,.02,.035,x,1.13,23.375,metal);}
      for(const x of [-3.3,3.3]){box(.06,1.5,.06,x,.83,24.8,black);box(.32,.22,.45,x,1.68,24.75,black);}
      // The building envelope follows the arena bowl; roof trusses are an architectural guide.
      for (const x of [-66, 66]) box(0.5, 24, 132, x, 12, 0, concrete);
      for (const z of [-66, 66]) box(132, 24, 0.5, 0, 12, z, concrete);
      for (let z = -63; z <= 63; z += 8) {
        box(133, 0.18, 0.18, 0, 27, z, metal);
        for (const x of [-44, -22, 0, 22, 44])
          box(0.12, 2, 0.12, x, 26, z, metal);
        box(133, 0.12, 0.12, 0, 25, z, metal);
      }
      // Batch static architectural surfaces to keep the detailed model inexpensive.
      for(const material of [concrete,metal]) {
        const meshes=scene.children.filter(o=>o.isMesh&&!o.isInstancedMesh&&o.material===material);
        const parts=meshes.map(mesh=>{mesh.updateMatrix();const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);return geo;});
        if(parts.length){const merged=new T.BufferGeometry();for(const name of ['position','normal']){const length=parts.reduce((n,g)=>n+g.attributes[name].array.length,0),array=new Float32Array(length);let at=0;for(const g of parts){array.set(g.attributes[name].array,at);at+=g.attributes[name].array.length;}merged.setAttribute(name,new T.BufferAttribute(array,3));}scene.add(new T.Mesh(merged,material));}
        parts.forEach(g=>g.dispose());meshes.forEach(m=>{scene.remove(m);m.geometry.dispose();});
      }
      const camera = new T.PerspectiveCamera(70, 1, 0.05, 300);
      camera.position.set(
        ownPoint[0] * scale,
        (own.properties.el || 0) * scale + 1.15,
        -ownPoint[1] * scale,
      );
      const look = new T.Vector3(focus[0] * scale, 2.25, -focus[1] * scale),
        dir = look.clone().sub(camera.position);
      let homeYaw = Math.atan2(dir.x, -dir.z),
        homePitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
      const viewpoint = el('select', 'arena-view__viewpoint');
      viewpoint.setAttribute('aria-label', 'Изберете място за оглед');
      const originalOption = el('option', '', options.title); originalOption.value = ''; viewpoint.append(originalOption);
      for(const seat of options.selected || []) {const option=el('option','',seat.title);option.value=seat.mk;viewpoint.append(option);}
      for(const table of tables) {const option=el('option','',table.properties.name);option.value=table.properties.mk;viewpoint.append(option);}
      controls.prepend(viewpoint);
      const tableChair = el('button', 'arena-view__chair', 'Следващ стол ↻'); tableChair.type='button';tableChair.hidden=true;controls.insertBefore(tableChair,reset);
      let currentTable = null, currentSeat = own, chairPosition = 0;
      function positionView() {
        const point=currentTable?currentTable.geometry.coordinates:currentSeat.geometry.coordinates;
        camera.position.set(point[0]*scale, currentTable?EYE_Y:(currentSeat.properties.el||0)*scale+1.15,-point[1]*scale);
        // Гледната точка на масата е от един от двата бар стола.
        if(currentTable){const [dx,dz]=STOOLS[chairPosition%STOOLS.length];camera.position.x+=dx;camera.position.z+=dz;}
        const direction=look.clone().sub(camera.position);homeYaw=Math.atan2(direction.x,-direction.z);homePitch=Math.atan2(direction.y,Math.hypot(direction.x,direction.z));
        setDrinkOwn(currentTable?tables.indexOf(currentTable):-1);
        yaw=homeYaw;pitch=homePitch;fov=70;tableChair.hidden=!currentTable;
        const име=currentTable?currentTable.properties.name+' · стол '+(chairPosition+1):viewpoint.selectedOptions[0].textContent;
        overlay.setAttribute('aria-label',име);schedule();
      }
      on(viewpoint,'change',()=>{currentTable=tables.find(t=>t.properties.mk===viewpoint.value)||null;currentSeat=v.seats.features.find(s=>s.properties.mk===viewpoint.value)||own;chairPosition=0;positionView();});
      on(tableChair,'click',()=>{chairPosition=(chairPosition+1)%STOOLS.length;positionView();});
      let yaw = homeYaw,
        pitch = homePitch,
        fov = 70;
      function draw() {
        raf = 0;
        if (disposed || document.hidden) return;
        camera.fov = fov;
        camera.updateProjectionMatrix();
        camera.lookAt(
          camera.position.x + Math.sin(yaw) * Math.cos(pitch),
          camera.position.y + Math.sin(pitch),
          camera.position.z - Math.cos(yaw) * Math.cos(pitch),
        );
        renderer.render(scene, camera);
      }
      function schedule() {
        if (!raf && !disposed) raf = requestAnimationFrame(draw);
      }
      function size() {
        if (disposed) return;
        const w = stage.clientWidth,
          h = stage.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        schedule();
      }
      observer = new ResizeObserver(size);
      observer.observe(stage);
      size();
      status.remove();
      if(String(options.mk).startsWith('t:')) {currentTable=own;viewpoint.value=options.mk;positionView();}
      let drag = null;
      const canvas = renderer.domElement;
      // Пръстите се броят: с един се оглеждаш, с два приближаваш. Досега
      // всяко следващо докосване просто подменяше предишното, затова с два
      // пръста гледката подскачаше настрани, вместо да се приближи, и
      // единственият начин да приближиш беше плюсът.
      const prasti = new Map();
      let pinch = null;
      function razstoyanie() {
        const t = Array.from(prasti.values());
        return Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y);
      }
      on(canvas, "pointerdown", (e) => {
        prasti.set(e.pointerId, { x: e.clientX, y: e.clientY });
        canvas.setPointerCapture(e.pointerId);
        canvas.focus();
        if (prasti.size >= 2) {
          ((drag = null), (pinch = { d: razstoyanie(), fov: fov }));
        } else drag = { x: e.clientX, y: e.clientY, yaw, pitch };
      });
      on(canvas, "pointermove", (e) => {
        if (!prasti.has(e.pointerId)) return;
        prasti.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && prasti.size >= 2) {
          const d = razstoyanie();
          // Разтваряне = по-тесен ъгъл на обектива, тоест приближаване.
          if (d > 8) {
            ((fov = Math.max(40, Math.min(90, (pinch.fov * pinch.d) / d))),
              schedule());
          }
          return;
        }
        if (!drag) return;
        yaw = drag.yaw - (e.clientX - drag.x) * 0.0035;
        pitch = Math.max(
          -1.1,
          Math.min(1.1, drag.pitch + (e.clientY - drag.y) * 0.0035),
        );
        schedule();
      });
      function pusni(e) {
        prasti.delete(e.pointerId);
        if (prasti.size < 2) pinch = null;
        // Вдигне ли се само единият пръст, оставащият продължава да се оглежда
        // от текущото си място - иначе изгледът замръзва до вдигането и на
        // втория, а после скача.
        if (prasti.size === 1) {
          const t = prasti.values().next().value;
          drag = { x: t.x, y: t.y, yaw, pitch };
        } else drag = null;
      }
      for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
        on(canvas, ev, pusni);
      on(
        canvas,
        "wheel",
        (e) => {
          e.preventDefault();
          fov = Math.max(40, Math.min(90, fov + e.deltaY * 0.03));
          schedule();
        },
        { passive: false },
      );
      on(canvas, "keydown", (e) => {
        const delta = {
          ArrowLeft: [-0.07, 0],
          ArrowRight: [0.07, 0],
          ArrowUp: [0, 0.07],
          ArrowDown: [0, -0.07],
        }[e.key];
        if (delta) {
          e.preventDefault();
          yaw += delta[0];
          pitch = Math.max(-1.1, Math.min(1.1, pitch + delta[1]));
          schedule();
        }
      });
      on(reset, "click", () => {
        yaw = homeYaw;
        pitch = homePitch;
        fov = 70;
        schedule();
      });
      on(minus, "click", () => {
        fov = Math.min(90, fov + 8);
        schedule();
      });
      on(plus, "click", () => {
        fov = Math.max(40, fov - 8);
        schedule();
      });
      on(document, "visibilitychange", schedule);
      on(canvas, "webglcontextlost", (e) => {
        e.preventDefault();
        stage.append(
          el(
            "p",
            "arena-view__status",
            "Графичният изглед беше прекъснат. Затворете и го отворете отново.",
          ),
        );
      });
      if (location.hash === "#dev")
        window.arenaViewDebug = { camera, scene, own, renderer };
    } catch (error) {
      if (!disposed)
        status.textContent =
          "Изгледът не можа да се зареди. Затворете и опитайте отново.";
      console.error("[arena-view]", error);
    }
  }
  return { open, close };
})();
