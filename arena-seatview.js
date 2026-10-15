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
        // Правостоящите са гледна точка без място: по средата, 3 м зад предната ограда
        // (там искат да стоят хората), очи на 1.65 м, с лице към сцената; квадратът от
        // надписи на пода остава зад гърба.
        standingFeature = ((options.venue.standing || {}).features || [])[0],
        standingOwn = standingFeature ? (() => {
          const ring = standingFeature.geometry.coordinates[0].map((p) => G.viewPoint(p));
          return { geometry: { coordinates: [(Math.min(...ring.map((p) => p[0])) + Math.max(...ring.map((p) => p[0]))) / 2, Math.max(...ring.map((p) => p[1])) - 3 / scale] },
            properties: { mk: standingFeature.properties.mk, name: standingFeature.properties.name, el: 0 }, standing: true };
        })() : null,
        own = v.seats.features.find((f) => f.properties.mk === options.mk) || v.tables.features.find((f) => f.properties.mk === options.mk)
          || (standingOwn && options.mk === standingOwn.properties.mk ? standingOwn : null);
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
      // ---- Афишът на екрана ----
      // Платното има точно съотношението на равнината (иначе буквите се
      // разтягат) и всичко се смята от размера му. Шрифтът е този на страницата,
      // ако е зареден за малко; иначе удебелен sans-serif.
      const posterFont = '"Sofia Sans", system-ui, "Helvetica Neue", Arial, sans-serif';
      try {
        await Promise.race([
          Promise.all(["900 100px", "800 100px"].map((w) => document.fonts.load(w + ' "Sofia Sans"', "CECAКонцертНОЕМВРИ"))),
          new Promise((done) => setTimeout(done, 1500)),
        ]);
      } catch (_) {}
      if (disposed) return;
      const poster = new Image(); poster.src = 'assets/ceca.webp';
      try { await poster.decode(); } catch (_) {}
      if (disposed) return;
      const maxTex = Math.min(renderer.capabilities.maxTextureSize, 4096);
      // Текст, смален да се събере в зададена ширина (ширината е в пиксели).
      function fitText(c, text, size, weight, width, spacing = 0) {
        let px = size;
        c.font = weight + " " + px + "px " + posterFont;
        if ("letterSpacing" in c) c.letterSpacing = spacing * px + "px";
        while (px > 8 && c.measureText(text).width > width) {
          px *= .96; c.font = weight + " " + px + "px " + posterFont;
          if ("letterSpacing" in c) c.letterSpacing = spacing * px + "px";
        }
        return px;
      }
      // Афишът е квадрат: рисува се като квадрат, без изкривяване.
      function drawPoster(c, x, y, size) {
        if (!poster.naturalWidth) return;
        c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
        c.drawImage(poster, x, y, size, size); c.restore();
      }
      function makeTexture(canvas) {
        const t = new T.CanvasTexture(canvas);
        t.colorSpace = T.SRGBColorSpace;
        t.generateMipmaps = true;
        t.minFilter = T.LinearMipmapLinearFilter;
        t.magFilter = T.LinearFilter;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        resources.add(t);
        return t;
      }
      // Главният екран: платното следва равнината stageWidth x screenHeight.
      // Платното пази съотношението на равнината и при ограничение от видеокартата
      // (G.fitCanvas свива ширината и височината заедно).
      const { w: bannerW, h: bannerH } = G.fitCanvas(stageWidth, screenHeight, 1024, maxTex);
      const banner = el("canvas");
      banner.width = bannerW; banner.height = bannerH;
      const ctx = banner.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, bannerW, bannerH);
      gradient.addColorStop(0, '#0c121d'); gradient.addColorStop(.55, '#263238'); gradient.addColorStop(1, '#080c12');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, bannerW, bannerH);
      const margin = Math.round(bannerH * .04), side = bannerH - margin * 2;
      drawPoster(ctx, margin, margin, side);
      // Мек преход от афиша към тъмния фон.
      const fadeFrom = margin + side * .8, fadeTo = margin + side + bannerH * .07;
      const fade = ctx.createLinearGradient(fadeFrom, 0, fadeTo, 0);
      fade.addColorStop(0, 'rgba(21,30,38,0)'); fade.addColorStop(1, 'rgba(21,30,38,1)');
      ctx.fillStyle = fade; ctx.fillRect(fadeFrom, 0, fadeTo - fadeFrom, bannerH);
      // Текстовият блок е вдясно от афиша; всичко е в дялове от височината.
      const boxX = margin + side + bannerH * .07, boxR = bannerW - margin, boxW = boxR - boxX, centerX = (boxX + boxR) / 2;
      ctx.strokeStyle = '#d9c58f'; ctx.lineWidth = Math.max(2, bannerH * .005);
      ctx.strokeRect(boxX, bannerH * .1, boxW, bannerH * .8);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f0d9a0';
      fitText(ctx, 'КОНЦЕРТ', bannerH * .07, 800, boxW * .8, .14); ctx.fillText('КОНЦЕРТ', centerX, bannerH * .3);
      ctx.fillStyle = '#ffffff';
      fitText(ctx, 'CECA', bannerH * .34, 900, boxW * .86, .01); ctx.fillText('CECA', centerX, bannerH * .64);
      ctx.fillStyle = '#f0d9a0';
      fitText(ctx, '7 НОЕМВРИ 2026 · АРЕНА 8888', bannerH * .08, 800, boxW * .88, .01); ctx.fillText('7 НОЕМВРИ 2026 · АРЕНА 8888', centerX, bannerH * .8);
      const texture = makeTexture(banner);
      const screen = new T.Mesh(
        new T.PlaneGeometry(stageWidth, screenHeight),
        new T.MeshBasicMaterial({ map: texture }),
      );
      screen.position.set(stageCenter, screenBase + screenHeight / 2, stageBack + .27);
      scene.add(screen);

      // Два странични IMAG екрана, както на истински концерти: квадратният афиш
      // и „CECA · 7.11.2026" под него, на един общ текстурен кадър. Стоят отвън на
      // завесите, пред кулите, завъртени към страничните трибуни - не закриват
      // главния екран нито от пода, нито от трибуните.
      const imagH = 4.6, imagW = imagH * .8, imagBase = 3.4;
      const { w: sideW, h: sideH } = G.fitCanvas(imagW, imagH, 1280, maxTex), sideCanvas = el("canvas");
      sideCanvas.width = sideW; sideCanvas.height = sideH;
      const sc = sideCanvas.getContext("2d");
      const sg = sc.createLinearGradient(0, 0, sideW, sideH);
      sg.addColorStop(0, '#0c121d'); sg.addColorStop(.55, '#263238'); sg.addColorStop(1, '#080c12');
      sc.fillStyle = sg; sc.fillRect(0, 0, sideW, sideH);
      const sm = Math.round(sideW * .045), ss = sideW - sm * 2;
      drawPoster(sc, sm, sm, ss);
      sc.textAlign = 'center'; sc.textBaseline = 'alphabetic'; sc.fillStyle = '#ffffff';
      const rest = sideH - sm * 2 - ss;
      fitText(sc, 'CECA · 7.11.2026', rest * .6, 900, ss * .96, .02);
      sc.fillText('CECA · 7.11.2026', sideW / 2, sm * 2 + ss + rest * .62);
      const sideTexture = makeTexture(sideCanvas);
      const imagGeo = new T.PlaneGeometry(imagW, imagH), imagMat = new T.MeshBasicMaterial({ map: sideTexture });
      const imagTowerMat = new T.MeshStandardMaterial({ color: 0x101319, roughness: .85 });
      for (const dir of [-1, 1]) {
        // Пред страничната стена (тя е вровнена с предния ръб на сцената): екраните не се губят зад завесата.
        const x = (dir < 0 ? minX * scale - 1 : maxX * scale + 1) + dir * 5.6, z = -Math.min(...stagePoints.map((p) => p[1])) * scale + 1.8, yaw = dir * 0.56;
        const group = new T.Group(); group.position.set(x, 0, z); group.rotation.y = yaw;
        const face = new T.Mesh(imagGeo, imagMat); face.position.set(0, imagBase + imagH / 2, .16);
        const housing = new T.Mesh(new T.BoxGeometry(imagW + .3, imagH + .3, .3), imagTowerMat); housing.position.set(0, imagBase + imagH / 2, 0);
        const tower = new T.Mesh(new T.BoxGeometry(.32, imagBase, .32), imagTowerMat); tower.position.set(0, imagBase / 2, -.1);
        group.add(housing, face, tower); scene.add(group);
      }

      // ---- ПРАВОСТОЯЩИ, боядисано на пода на зоната ----
      // По една дума край всяка от четирите страни, с основата към ръба, така че
      // да се чете право от човек, застанал отвън и гледащ навътре (като
      // маркировките по подовете на залите). Една текстура на една равнина:
      // платното е картата на пода отгоре (горе = към сцената), а думите са
      // завъртяни върху него. Четирите думи образуват квадрат в средата на зоната.
      let zoneBox = null;
      const standingZone = ((options.venue.standing || {}).features || [])[0];
      if (standingZone) {
        const ring = standingZone.geometry.coordinates[0].map((p) => G.viewPoint(p));
        const zx = ring.map((p) => p[0] * scale), zz = ring.map((p) => -p[1] * scale);
        const x0 = Math.min(...zx), x1 = Math.max(...zx), z0 = Math.min(...zz), z1 = Math.max(...zz);
        const zoneW = x1 - x0, zoneD = z1 - z0;
        const { w: fw, h: fh } = G.fitCanvas(zoneW, zoneD, 1536, maxTex);
        const floorCanvas = el("canvas");
        floorCanvas.width = fw; floorCanvas.height = fh;
        const fx = floorCanvas.getContext("2d");
        const ppm = fw / zoneW; // пиксела на метър
        // Боядисана синя основа на цялата зона (отличава я от сивия под и дава контраст
        // на светлите букви): картата няма прозрачни
        // пиксели, затова мипмапите не получават тъмен кант около буквите.
        fx.fillStyle = "rgba(78,112,170,0.30)"; fx.fillRect(0, 0, fw, fh);
        const inset = 0.1 * ppm;
        fx.lineJoin = "round";
        fx.strokeStyle = "rgba(38,62,104,0.85)"; fx.lineWidth = 0.22 * ppm; fx.strokeRect(inset, inset, fw - 2 * inset, fh - 2 * inset);
        fx.strokeStyle = "#f4f7fb"; fx.lineWidth = 0.1 * ppm; fx.strokeRect(inset, inset, fw - 2 * inset, fh - 2 * inset);
        // Четирите думи са четирите страни на ЕДИН КВАДРАТ в средата на зоната.
        // Всяка дума стои с основата навън, за да се чете право от човек отвън,
        // гледащ навътре. Страната на квадрата S = L + 2c + малка пролука (L е
        // ширината на думата при височина на главните букви c, разстояние между
        // буквите 0.06 em); S е ~70% от късата страна на зоната.
        const WORD = "ПРАВОСТОЯЩИ", TRACK = 0.06, GAP_K = 0.3, SQUARE_K = 0.7;
        fx.textAlign = "left"; fx.textBaseline = "alphabetic";
        fx.font = "900 100px " + posterFont;
        const letters = Array.from(WORD), widths100 = letters.map((ch) => fx.measureText(ch).width);
        const capRatio = (fx.measureText("П").actualBoundingBoxAscent || 72) / 100;
        const wordPer100 = widths100.reduce((a, b) => a + b, 0) + TRACK * 100 * (letters.length - 1); // ширина на думата при шрифт 100
        const wordPerCap = wordPer100 / (capRatio * 100); // L / c
        const S = SQUARE_K * zoneD;
        const capM = S / (wordPerCap + 2 + GAP_K), W = wordPerCap * capM;
        const fontPx = (W * ppm / wordPer100) * 100;
        fx.font = "900 " + fontPx + "px " + posterFont;
        fx.fillStyle = "#f8fafc"; fx.strokeStyle = "rgba(30,52,92,0.97)"; fx.lineWidth = 0.2 * ppm;
        const widths = letters.map((ch) => fx.measureText(ch).width), gapPx = TRACK * fontPx, capPx = capM * ppm;
        const naturalPx = widths.reduce((a, b) => a + b, 0) + gapPx * (letters.length - 1);
        function paintWord(rotation, cx, cy) {
          let x = -naturalPx / 2;
          fx.save(); fx.translate(cx, cy); fx.rotate(rotation);
          letters.forEach((ch, k) => { fx.strokeText(ch, x, capPx / 2); fx.fillText(ch, x, capPx / 2); x += widths[k] + gapPx; });
          fx.restore();
        }
        // Центърът на квадрата е средата на зоната (FOH и баровете са зад нея, извън зоната).
        const centerX = (x0 + x1) / 2, centerZ = (z0 + z1) / 2;
        const px = (centerX - x0) * ppm, pz = (centerZ - z0) * ppm, d = (S / 2 - capM / 2) * ppm;
        paintWord(Math.PI, px, pz - d);      // към сцената: чете се от масите
        paintWord(0, px, pz + d);            // към FOH и задната част
        paintWord(Math.PI / 2, px - d, pz);  // ляв край
        paintWord(-Math.PI / 2, px + d, pz); // десен край
        zoneBox = { x0, x1, z0, z1 };
        const floorTexture = makeTexture(floorCanvas);
        const floorMark = new T.Mesh(new T.PlaneGeometry(zoneW, zoneD), new T.MeshBasicMaterial({
          map: floorTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        floorMark.rotation.x = -Math.PI / 2;
        floorMark.position.set((x0 + x1) / 2, 0.005, (z0 + z1) / 2);
        floorMark.renderOrder = 1;
        scene.add(floorMark);
      }

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
      // ---- Завеси ----
      // Оформлението се смята в ArenaGeometry.curtainPanels (чиста геометрия, с тест за
      // линиите на зрение): една права задна завеса през цялата зала от пода до покривните
      // ферми и по един черен „похлупак" върху всеки затворен блок до сцената. Вертикална
      // стена пред затворените блокове закриваше сцената и екрана от продаваемите места
      // (блоковете са точно на пътя на лъча), затова блоковете се покриват отгоре и отстрани.
      const drape=new T.MeshStandardMaterial({color:0x1b1c20,roughness:1,side:T.DoubleSide});
      resources.add(drape);
      const panels = G.curtainPanels(v, { scale });
      {
        const rear = panels.rear, width = rear.x1 - rear.x0;
        // Плисета само по ширина (вертикални гънки), 5 сегмента на метър; основата потъва под пода.
        const geometry=new T.PlaneGeometry(width,rear.height,Math.ceil(width*2),1);
        const pts=geometry.attributes.position;
        for(let i=0;i<pts.count;i++){const px=pts.getX(i);pts.setZ(i,(Math.sin(px*Math.PI*1.7)+.22*Math.sin(px*Math.PI*3.4+.6))*.12);}
        geometry.computeVertexNormals();
        const mesh=new T.Mesh(geometry,drape);mesh.position.set((rear.x0+rear.x1)/2,rear.height/2-.6,rear.z);scene.add(mesh);
        resources.add(geometry);
        tube([rear.x0,rear.height-.95,rear.z],[rear.x1,rear.height-.95,rear.z],.09);
        // Похлупаците: всички триъгълници в една мрежа.
        const verts=[];for(const h of panels.hoods)for(const t of h.tris)for(const q of t)verts.push(q[0],q[1],q[2]);
        if(verts.length){
          const hg=new T.BufferGeometry();hg.setAttribute('position',new T.Float32BufferAttribute(verts,3));hg.computeVertexNormals();
          const hoodMat=new T.MeshStandardMaterial({color:0x17181c,roughness:1,side:T.DoubleSide});
          resources.add(hg);resources.add(hoodMat);scene.add(new T.Mesh(hg,hoodMat));
        }
      }
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
      const makeStool=()=>{
        const parts=[[new T.BoxGeometry(.34,.03,.34),0,SEAT_Y-.015]];
        for(const sx of [-1,1])for(const sz of [-1,1])parts.push([new T.BoxGeometry(.02,SEAT_Y-.03,.02),sx*.15,(SEAT_Y-.03)/2,sz*.15]);
        for(const sz of [-1,1])parts.push([new T.BoxGeometry(.28,.014,.014),0,.3,sz*.15]);
        for(const sx of [-1,1])parts.push([new T.BoxGeometry(.014,.014,.28),sx*.15,.3,0]);
        return merged(parts);
      };
      instances(makeStool(),tableMetal,stoolSpots);

      // ---- Консумацията към масата (meta.vipTableIncludes) ----
      // Една бутилка премиум алкохол 700 мл, 5 бутилки минерална вода 330 мл и
      // 5 кена Vidas 250 мл - точно колкото са в офертата и нищо друго. Само тук:
      // на картата масите остават голи. Профилите са въртене на гладка крива
      // (LatheGeometry), не купчина цилиндри. Две нива на детайл: масата, от
      // която гледаш, е с 24 сегмента, останалите 179 - с 6 сегмента, като instancing.
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
      // завой: така близкото ниво са 6 извиквания за рисуване, далечното - 1.
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
      // Далечният набор (останалите 179 маси): 6 сегмента, 3-5 точки на профил,
      // без етикети - цветът на корпуса стига от разстояние - и ЕДНА мрежа с цветове
      // по върховете. Така напитките на всички далечни маси са едно извикване
      // за рисуване и около 360 триъгълника на маса.
      const farMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.1});resources.add(farMat);
      const farCluster=()=>{const parts=[],add=(geo,dx,dz,j)=>parts.push([geo,dx,0,dz,0,itemYaw(j),0]);
        add(lathe([[.042,0],[.042,.17],[.0125,.22],[.0125,.262]],6,0x4a3620),0,0,0);
        add(lathe([[.016,.262],[.016,.3],[0,.3]],6,0x15161a),0,0,0);
        WATERS.forEach(([dx,dz],j)=>add(lathe([[.031,0],[.031,.12],[.0115,.18],[.0115,.205]],6,0xb4d6e8),dx,dz,j+1));
        CANS.forEach(([dx,dz],j)=>add(lathe([[.0265,0],[.0265,.135],[0,.135]],6,0x17996f),dx,dz,j+7));
        return merged(parts);};
      function drinkSet(seg,tableIdx,far){
        const spots=tableIdx.map(t=>({x:tablePositions[t].x,z:tablePositions[t].z,y:TOP_Y,angle:tableYaw(t)}));
        if(far)return [instances(farCluster(),farMat,spots)];
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
      const lowSet=drinkSet(6,allIdx,true);
      const highSet=drinkSet(24,[0]);
      // Масата, от която гледаш, получава детайлния набор (24 сегмента, пълни
      // профили, етикети); далечната ѝ копия (6 сегмента) се скрива с нулев мащаб. Работи се само при
      // смяна на гледната точка, не на кадър.
      let drinkOwn=-2;
      const hideMatrix=new T.Object3D();hideMatrix.scale.set(0,0,0);hideMatrix.updateMatrix();
      function lowAt(t,hide){
        matrix.position.set(tablePositions[t].x,TOP_Y,tablePositions[t].z);matrix.rotation.set(0,tableYaw(t),0);matrix.updateMatrix();
        // Границите се смятат наново: иначе след смяна на масата мрежата би се отсякла по старите.
        for(const mesh of lowSet){mesh.setMatrixAt(t,hide?hideMatrix.matrix:matrix.matrix);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
      }
      function setDrinkOwn(t){
        if(t===drinkOwn)return;
        if(drinkOwn>=0)lowAt(drinkOwn,false);
        drinkOwn=t;
        matrix.position.set(t>=0?tablePositions[t].x:0,TOP_Y,t>=0?tablePositions[t].z:0);matrix.rotation.set(0,t>=0?tableYaw(t):0,0);matrix.updateMatrix();
        for(const mesh of highSet){mesh.visible=t>=0;if(t>=0){mesh.setMatrixAt(0,matrix.matrix);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}}
        if(t>=0)lowAt(t,true);
      }
      setDrinkOwn(-1);

      // ---- Парапети около зоната за правостоящи ----
      // Поцинковани преносими заграждения (панели от около 2.2 м, на кръста - 1.0 м):
      // горна и долна греда, девет тънки пръта, два крайни стълба и два плоски
      // крака напряко. Всички панели са ЕДНА слята геометрия върху InstancedMesh
      // (едно извикване за рисуване). Оставени са входове от по 3 м: два при
      // задните ъгли (към FOH и централния вход) и по един в средата на лявата и
      // дясната страна. Оградата е 0.5 м навътре, така че краката не опират в
      // парапетите на трибуните, и остава далеч от плочата на FOH.
      const BACK_Z_IN = 2.1;
      if (zoneBox) {
        const PANEL = 2.2, PITCH = 2.25, ENTRY = 3, FENCE_IN = 0.5, H = 1.0;
        // Задната страна е 2.1 м навътре (само в изгледа): така баровете зад нея получават
        // истинска дълбочина вместо тясна ивица между оградата и първия ред на сектора.
        const BACK_IN = BACK_Z_IN;
        const parts = [], box = (w, h, d, x, y, z) => parts.push([new T.BoxGeometry(w, h, d), x, y, z]);
        box(PANEL, .035, .035, 0, H - .03, 0);   // горна греда
        box(PANEL, .035, .035, 0, .14, 0);       // долна греда
        for (let k = 0; k < 9; k++) box(.02, H - .2, .02, -PANEL / 2 + .18 + k * (PANEL - .36) / 8, (H - .2) / 2 + .1, 0); // пръти
        for (const sx of [-1, 1]) {
          box(.045, H, .045, sx * (PANEL / 2 - .03), H / 2, 0);   // краен стълб
          box(.045, .03, .6, sx * (PANEL / 2 - .03), .015, 0);     // плосък крак напряко
        }
        const barrierMat = new T.MeshStandardMaterial({ color: 0xaeb5bd, metalness: .6, roughness: .4, envMap: envTarget.texture, envMapIntensity: .9 });
        resources.add(barrierMat);
        const fx0 = zoneBox.x0 + FENCE_IN, fx1 = zoneBox.x1 - FENCE_IN, fz0 = zoneBox.z0 + FENCE_IN, fz1 = zoneBox.z1 - BACK_IN;
        const midZ = (fz0 + fz1) / 2, spots = [];
        // Една страна: отсечките между входовете се запълват с панели без застъпване.
        function side(from, to, gaps, place) {
          const cuts = [from, ...gaps.flatMap((g) => [g - ENTRY / 2, g + ENTRY / 2]), to];
          for (let k = 0; k < cuts.length; k += 2) {
            const a = cuts[k], b = cuts[k + 1], n = Math.max(0, Math.floor((b - a) / PITCH));
            for (let i = 0; i < n; i++) place(a + (b - a) / n * (i + .5));
          }
        }
        side(fx0, fx1, [], (x) => spots.push({ x, z: fz0, angle: 0 }));                                  // към сцената: без вход
        // Задният вход е точно пред всеки бар (от данните), за да се стига пеша от зоната до тях.
        const barXs = ((options.venue.objectLabels || {}).features || []).filter((f) => f.properties.label === "BAR").map((f) => G.viewPoint(f.geometry.coordinates)[0] * scale);
        side(fx0, fx1, barXs.length ? barXs : [fx0 + 6, fx1 - 6], (x) => spots.push({ x, z: fz1, angle: 0 }));  // назад: входове пред баровете
        side(fz0, fz1, [midZ], (z) => spots.push({ x: fx0, z, angle: Math.PI / 2 }));                    // ляво: вход в средата
        side(fz0, fz1, [midZ], (z) => spots.push({ x: fx1, z, angle: Math.PI / 2 }));                    // дясно: вход в средата
        instances(merged(parts), barrierMat, spots);
      }

      // ======== БАРОВЕ И FOH (един малък блок: изтрива се наведнъж) ========
      // Позициите и ширините са от данните (VENUE.objectLabels: центърът и size на
      // правоъгълниците от плана), през същата трансформация като всичко останало.
      // Зад оградата (2.1 м навътре от ръба на зоната) има ~3.8 м до първия ред на
      // задния сектор: гостите (столове) 1.0 м, тезгях 0.6, проход 0.9, задна
      // поличка 0.55. Нищо не е светлинен източник: сиянието е самосветещ материал.
      {
        // Разположението е в ArenaGeometry.floorProps (чисто, с тест за линиите на зрение).
        const props = G.floorProps(options.venue, { scale, backIn: BACK_Z_IN });
        const GOLD = 0xe8b04b;
        const dark = new T.MeshStandardMaterial({ color: 0x15171c, roughness: .6, metalness: .3 });
        const gloss = new T.MeshStandardMaterial({ color: 0x0a0b0e, roughness: .12, metalness: .5, envMap: envTarget.texture, envMapIntensity: 1.1 });
        const chrome = new T.MeshStandardMaterial({ color: 0xb9c0c8, roughness: .3, metalness: .85, envMap: envTarget.texture, envMapIntensity: 1 });
        const riser = new T.MeshStandardMaterial({ color: 0x2a2e36, roughness: .7, metalness: .2 });
        const goldGlow = new T.MeshBasicMaterial({ color: GOLD });
        const ledWhite = new T.MeshBasicMaterial({ color: 0xfff1d2 });
        const backGlow = new T.MeshBasicMaterial({ color: 0xd99a35 });
        const screenGlow = new T.MeshBasicMaterial({ color: 0xa8d4ff });
        const fader = new T.MeshBasicMaterial({ color: 0xffe3a3 });
        const mats = { dark, gloss, chrome, riser, goldGlow, ledWhite, backGlow, screenGlow, fader, signbox: dark };
        for (const m of new Set(Object.values(mats))) { resources.add(m); m.userData.bar = true; }
        const P = {}; for (const k of Object.keys(mats)) P[k] = [];
        for (const b of props.boxes) if (P[b.k]) P[b.k].push([new T.BoxGeometry(b.w, b.h, b.d), b.x, b.y, b.z]);
        // Бутилки на рафтовете: ЕДНА InstancedMesh с цвят на инстанция и евтина геометрия.
        const bottleGeo = lathe([[0, 0], [.03, 0], [.03, .15], [.013, .2], [.013, .26], [0, .26]], 6, 0xffffff);
        const bottleSpots = props.bottles, bottleColors = [0x5a3a18, 0x2f6b3a, 0xdfe7ec, 0x8a2323, 0x3a2a18, 0xc8b45a, 0x1d5fae];
        const stoolSpots2 = props.stools.map((q) => ({ x: q.x, z: q.z, angle: 0 })), signSpots = props.barSigns;
        // Табелата: четири лица, една текстура; златен кант, бяло „BAR" на тъмно.
        const mkSign = (word, SW, SH, size) => {
          const { w: tw, h: th } = G.fitCanvas(SW, SH, size, maxTex);
          const c2 = el("canvas"); c2.width = tw; c2.height = th;
          const g2 = c2.getContext("2d");
          g2.fillStyle = "#101216"; g2.fillRect(0, 0, tw, th);
          g2.strokeStyle = "#e8b04b"; g2.lineWidth = th * .06; g2.strokeRect(th * .05, th * .05, tw - th * .1, th - th * .1);
          g2.fillStyle = "#ffffff"; g2.textAlign = "center"; g2.textBaseline = "alphabetic";
          const px = fitText(g2, word, th * .7, 800, tw * .8, .05);
          g2.fillText(word, tw / 2, th / 2 + px * .36);
          const m = new T.MeshBasicMaterial({ map: makeTexture(c2) }); resources.add(m); return m;
        };
        for (const [k, mat] of Object.entries(mats)) {
          if (k === "signbox" || !P[k].length) continue;
          const list = k === "dark" ? P.dark.concat(P.signbox) : P[k];
          const mesh = new T.Mesh(merged(list), mat); scene.add(mesh); resources.add(mesh.geometry);
        }
        if (stoolSpots2.length) { const sm = instances(makeStool(), tableMetal, stoolSpots2); resources.add(sm.geometry); }
        if (bottleSpots.length) {
          const bm = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .3, metalness: .1, vertexColors: true, envMap: envTarget.texture, envMapIntensity: .8 });
          bm.userData.bar = true; resources.add(bm);
          const bottles = new T.InstancedMesh(bottleGeo, bm, bottleSpots.length);
          const col = new T.Color();
          bottleSpots.forEach((p, i) => { matrix.position.set(p.x, p.y, p.z); matrix.rotation.set(0, 0, 0); matrix.scale.set(1, .85 + ((i * 7) % 5) * .08, 1); matrix.updateMatrix(); bottles.setMatrixAt(i, matrix.matrix); bottles.setColorAt(i, col.setHex(bottleColors[(i * 5 + (i >> 3)) % bottleColors.length])); });
          matrix.scale.set(1, 1, 1);
          bottles.instanceMatrix.needsUpdate = true; bottles.instanceColor.needsUpdate = true;
          scene.add(bottles);
        }
        // Лайтбокс „BAR" (четири лица) под гредата: чете се от трибуните, пода и зоната.
        if (signSpots.length) {
          const SW = signSpots[0].w, SH = signSpots[0].h, face = mkSign("BAR", SW, SH, 512), edge = new T.MeshBasicMaterial({ color: GOLD });
          resources.add(edge);
          const signGeo = new T.BoxGeometry(SW, SH, SW); resources.add(signGeo);
          for (const q of signSpots) {
            const sign = new T.Mesh(signGeo, [face, face, edge, edge, face, face]); sign.position.set(q.x, q.y + SH / 2, q.z); scene.add(sign);
          }
        }
        // „FOH": малка осветена табела на ниската ограда, отпред и отзад (до 1.3 м от пода).
        if (props.fohSigns.length) {
          const q0 = props.fohSigns[0], fm = mkSign("FOH", q0.w, q0.h, 256), pg = new T.PlaneGeometry(q0.w, q0.h); resources.add(pg);
          for (const q of props.fohSigns) { const m = new T.Mesh(pg, fm); m.position.set(q.x, q.y, q.z); if (q.toward < 0) m.rotation.y = Math.PI; scene.add(m); }
        }
      }
      // ======== край на блока БАРОВЕ И FOH ========

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
        own.standing ? 1.65 : (own.properties.el || 0) * scale + 1.15,
        -ownPoint[1] * scale,
      );
      const look = new T.Vector3(focus[0] * scale, 2.25, -focus[1] * scale),
        dir = look.clone().sub(camera.position);
      let homeYaw = Math.atan2(dir.x, -dir.z),
        homePitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
      const viewpoint = el('select', 'arena-view__viewpoint');
      viewpoint.setAttribute('aria-label', 'Изберете място за оглед');
      const originalOption = el('option', '', options.title); originalOption.value = own.properties.mk; viewpoint.append(originalOption);
      for(const seat of options.selected || []) {const option=el('option','',seat.title);option.value=seat.mk;viewpoint.append(option);}
      for(const table of tables) {const option=el('option','',table.properties.name);option.value=table.properties.mk;viewpoint.append(option);}
      controls.prepend(viewpoint);
      const tableChair = el('button', 'arena-view__chair', 'Следващ стол ↻'); tableChair.type='button';tableChair.hidden=true;controls.insertBefore(tableChair,reset);
      if (standingOwn && !own.standing) { const o = el('option', '', standingOwn.properties.name); o.value = standingOwn.properties.mk; viewpoint.append(o); }
      let currentTable = null, currentSeat = own, chairPosition = 0;
      function positionView() {
        const point=currentTable?currentTable.geometry.coordinates:currentSeat.geometry.coordinates;
        camera.position.set(point[0]*scale, currentTable?EYE_Y:currentSeat.standing?1.65:(currentSeat.properties.el||0)*scale+1.15,-point[1]*scale);
        // Гледната точка на масата е от един от двата бар стола.
        if(currentTable){const [dx,dz]=STOOLS[chairPosition%STOOLS.length];camera.position.x+=dx;camera.position.z+=dz;}
        const direction=look.clone().sub(camera.position);homeYaw=Math.atan2(direction.x,-direction.z);homePitch=Math.atan2(direction.y,Math.hypot(direction.x,direction.z));
        setDrinkOwn(currentTable?tables.indexOf(currentTable):-1);
        yaw=homeYaw;pitch=homePitch;fov=70;tableChair.hidden=!currentTable;
        const име=currentTable?currentTable.properties.name+' · стол '+(chairPosition+1):viewpoint.selectedOptions[0].textContent;
        overlay.setAttribute('aria-label',име);schedule();
      }
      on(viewpoint,'change',()=>{currentTable=tables.find(t=>t.properties.mk===viewpoint.value)||null;currentSeat=v.seats.features.find(s=>s.properties.mk===viewpoint.value)||(standingOwn&&viewpoint.value===standingOwn.properties.mk?standingOwn:own);chairPosition=0;positionView();});
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
