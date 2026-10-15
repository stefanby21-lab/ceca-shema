/* Native SVG renderer for browsers where WebGL is unavailable.
   VENUE and app.js remain the authority for availability and selection rules. */
window.SeatMap = (function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const BLUE = '#153D8A', GRAY = '#C3CAD5';
  // Местата на маса идват от данните (свойството seats); 6 е само резервата.
  const TABLE_SEATS_FALLBACK = 6;
  let venue, options, host, svg, numbers, caption, tip, camera, homeCamera, active = null, standingPin = null, standingBox = null, standingOpening = 0;
  let stateDirty = true;
  const nodes = new Map(), positions = new Map();
  let selected = new Set(), selectedTables = new Set(), suggested = new Set(), highlighted = null, selectedStanding = false;
  let tiers = null, minimum = null, maximum = null, fees = false, obstructed = false, party = 0;
  let queued = false, fullBounds, drag = null, moved = false;
  const sections = new Map(), seats = new Map(), tables = new Map(), zones = new Map(), bySection = new Map();
  const listeners = new Map(), pointers = new Map();
  const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
  const point = feature => positions.get(feature.properties.mk);
  function element(tag, attrs, text) {
    const el = document.createElementNS(NS, tag);
    for (const key in attrs) el.setAttribute(key, attrs[key]);
    if (text != null) el.textContent = text;
    return el;
  }
  function emit(name) { (listeners.get(name) || []).forEach(fn => fn()); }
  function bounds(points, padding = 0) {
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const left = Math.min(...xs) - padding, top = Math.min(...ys) - padding;
    return { x: left, y: top, w: Math.max(...xs) + padding - left, h: Math.max(...ys) + padding - top };
  }
  function fit(box) {
    const ratio = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
    const w = Math.max(box.w, box.h * ratio), h = w / ratio;
    return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
  }
  function fitHome() {
    if (innerWidth <= 880) return fit(fullBounds);
    const actions = document.querySelector('.map-actions')?.getBoundingClientRect();
    if (!actions?.height) return fit(fullBounds);
    const available = Math.max(1, actions.top - host.getBoundingClientRect().top - 16);
    const scale = Math.max(fullBounds.w / host.clientWidth, fullBounds.h / available);
    return { x: fullBounds.x + (fullBounds.w - scale * host.clientWidth) / 2,
      y: fullBounds.y + (fullBounds.h - scale * available) / 2,
      w: scale * host.clientWidth, h: scale * host.clientHeight };
  }
  function getZoom() { return 4 + Math.log2(homeCamera.w / camera.w); }
  function schedule(dirty = true) {
    if (dirty) stateDirty = true;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  }
  function setCamera(next) {
    camera = next;
    // Bounds keep an accidental pan from losing the entire hall.
    camera.x = Math.max(fullBounds.x - camera.w * .5, Math.min(fullBounds.x + fullBounds.w - camera.w * .5, camera.x));
    camera.y = Math.max(fullBounds.y - camera.h * .5, Math.min(fullBounds.y + fullBounds.h - camera.h * .5, camera.y));
    // Докато пръстът е върху картата, чертежът не се прерисува: viewBox стои замразен, а
    // кадърът се получава с CSS преобразуване на целия SVG (композитор, без растеризиране
    // на 16 хиляди възела). Точният кадър се записва веднъж, при пускане (endLive).
    if (live) paintLive();
    else {
      svg.setAttribute('viewBox', [camera.x, camera.y, camera.w, camera.h].join(' '));
    }
    emit('move'); if (!live) schedule(false);
  }
  let live = null;
  function beginLive() {
    if (live) return;
    live = { base: { x: camera.x, y: camera.y, w: camera.w, h: camera.h } };
    svg.style.transformOrigin = '0 0';
    svg.style.willChange = 'transform';
    // Номерата са за точния кадър: при движение се скриват и се връщат при пускане.
    numbers.style.display = 'none';
  }
  function paintLive() {
    const k = live.base.w / camera.w, w = host.clientWidth, h = host.clientHeight;
    const tx = (live.base.x - camera.x) / camera.w * w, ty = (live.base.y - camera.y) / camera.h * h;
    svg.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ')';
  }
  function endLive() {
    if (!live) return;
    live = null;
    svg.style.transform = '';
    svg.style.willChange = '';
    svg.style.transformOrigin = '';
    numbers.style.display = '';
    svg.setAttribute('viewBox', [camera.x, camera.y, camera.w, camera.h].join(' '));
    schedule(false);
  }
  // Точка на екрана -> координати на чертежа за ТЕКУЩИЯ кадър; не ползва getScreenCTM,
  // защото при живо преобразуване той описва замразения viewBox.
  function worldAt(clientX, clientY) {
    const box = host.getBoundingClientRect();
    return { x: camera.x + (clientX - box.left) / box.width * camera.w, y: camera.y + (clientY - box.top) / box.height * camera.h };
  }
  function frame(features, padding = 55) {
    if (!features.length) return;
    setCamera(fit(bounds(features.map(point), padding)));
    emit('moveend');
  }
  function reset() {
    active = null; highlighted = null;
    homeCamera = fitHome();
    setCamera({ ...homeCamera }); emit('moveend');
  }
  function sectionKey(key) { return String(key).startsWith('s:') ? key : 's:' + key; }
  function rotateToSection(key) {
    key = sectionKey(key);
    if (!sections.has(key)) return;
    active = key;
    frame(bySection.get(key) || [], 32);
    if (host.clientWidth < 500) {
      // Keep individual chairs legible on a phone; the SVG can still be panned.
      const first = (bySection.get(key) || [])[0];
      const radius = Number(nodes.get(first?.properties.mk)?.getAttribute('r')) || 4.3;
      zoom(Math.min(1, radius * 2 * host.clientWidth / (20 * camera.w)));
      emit('moveend');
    }
  }
  function frameSeats(keys) {
    const features = list(keys).map(key => seats.get(key)).filter(Boolean);
    if (!features.length) return;
    active = sectionKey(features[0].properties.s);
    frame(features, 65);
  }
  function frameTables(level) {
    active = 'tables';
    frame(Array.from(tables.values()).filter(f => level == null || f.properties.tableLevel === level), 60);
  }
  function frameTable(key) {
    const feature = tables.get(key);
    if (feature) { active = 'tables'; frame([feature], 105); }
  }
  function available(p) { return !p.sold && !p.offsale && Number.isFinite(p.eur); }
  function matches(p, table = false) {
    if (!available(p)) return false;
    if (table) return true; // Table categories have their own existing filter controls.
    const price = fees && p.eurAll != null ? p.eurAll : p.eur;
    return (!tiers || !tiers.length || tiers.includes(p.tier)) &&
      (minimum == null || price >= minimum) && (maximum == null || price <= maximum) &&
      (!obstructed || !p.obstructed) && (!party || p.run >= party);
  }
  function label(p, table = false) {
    const name = table ? p.name + ' · ' + (Number(p.seats) || TABLE_SEATS_FALLBACK) + ' места' : 'Сектор ' + p.s + ', ред ' + p.r + ', място ' + p.t;
    const price = fees && p.eurAll != null ? p.eurAll : p.eur;
    return name + (available(p) ? ' · ' + price + ' €' : ' · Не е достъпно');
  }
  // Правостоящите са зона, не място: името е в данните, купува се по брой билети.
  function zonePrice(p) { return Math.round(fees && p.eurAll != null ? p.eurAll : p.eur); }
  function zoneLabel(p) {
    return p.name + (available(p) ? ', ' + zonePrice(p) + ' € на билет' : ', не са достъпни');
  }
  function color(p) { return venue.tiers.find(t => t.tier === p.tier)?.color || BLUE; }
  function button(node, name) {
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', name);
  }
  // Балонът с цената на зоната: същият вид като на WebGL картата (бяла плоча,
  // синя рамка, името дребно, цената едра) и със стабилен размер на екрана -
  // групата се разтегля обратно на мащаба на камерата.
  function buildPin(p) {
    const pin = element('g', { class: 'svg-standing-pin', 'data-key': p.mk, 'data-kind': 'standing', 'aria-hidden': 'true' });
    pin.append(
      element('rect', { class: 'pin-plate', x: -50, y: -21, width: 100, height: 42, rx: 11 }),
      element('text', { class: 'pin-name', x: 0, y: -4 }, p.name),
      element('text', { class: 'pin-price', x: 0, y: 12 }, ''));
    return pin;
  }
  function updatePin(p) {
    if (!standingPin) return;
    standingPin.querySelector('.pin-price').textContent = zonePrice(p) + ' €';
    standingPin.classList.toggle('is-selected', selectedStanding);
    standingPin.classList.toggle('is-off', !available(p));
    standingPin.setAttribute('aria-label', zoneLabel(p));
  }
  let pinCompact = false;
  function setPinCompact(on) {
    if (on === pinCompact || !standingPin) return;
    pinCompact = on;
    standingPin.classList.toggle('is-compact', on);
    const plate = standingPin.querySelector('.pin-plate'), price = standingPin.querySelector('.pin-price');
    const name = standingPin.querySelector('.pin-name');
    if (on) { plate.setAttribute('x', -36); plate.setAttribute('y', -18); plate.setAttribute('width', 72); plate.setAttribute('height', 36); price.setAttribute('y', 10); name.setAttribute('y', -5); }
    else { plate.setAttribute('x', -50); plate.setAttribute('y', -21); plate.setAttribute('width', 100); plate.setAttribute('height', 42); price.setAttribute('y', 12); name.setAttribute('y', -4); }
  }
  function placePin() {
    if (!standingPin || !host.clientWidth) return;
    const [x, y] = positions.get(standingPin.dataset.key), upp = camera.w / host.clientWidth;
    // На телефон балонът е по-малък: зоната там е към 150 px широка.
    const base = host.clientWidth < 500 ? .82 : 1, openPx = standingOpening / upp;
    // Балонът стои в отвора на квадрата от думи. Когато отворът (в px) е по-малък от
    // целия балон, остава само малка плочка с цената, смалена така, че да не докосва
    // думите (общият изглед на 320 px); приближи ли се, балонът става пълен.
    let k = base;
    if (openPx && openPx < 100 * base + 16) { setPinCompact(true); k = Math.max(.4, Math.min(1, (openPx - 22) / 72)); }
    else setPinCompact(false);
    standingPin.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + upp * k + ')');
  }
  function within([x, y]) { return x >= camera.x && x <= camera.x + camera.w && y >= camera.y && y <= camera.y + camera.h; }
  function render() {
    const detail = getZoom() > 5;
    svg.classList.toggle('z-near', detail);
    const fragment = document.createDocumentFragment();
    for (const [key, node] of nodes) {
      const kind = node.dataset.kind;
      if (kind === 'section') {
        node.setAttribute('tabindex', detail ? '-1' : '0');
        node.classList.toggle('is-focused', key === active || key === highlighted);
        continue;
      }
      if (kind === 'standing') {
        const p = zones.get(key).properties;
        if (stateDirty) {
          node.classList.toggle('is-selected', selectedStanding);
          node.classList.toggle('is-off', !available(p));
          node.setAttribute('aria-pressed', String(selectedStanding));
          node.setAttribute('aria-disabled', String(!available(p)));
          node.setAttribute('aria-label', zoneLabel(p));
          updatePin(p);
        }
        continue;
      }
      const table = kind === 'table', feature = table ? tables.get(key) : seats.get(key);
      if (!feature) continue;
      const p = feature.properties, picked = (table ? selectedTables : selected).has(key);
      if (stateDirty) {
        const matching = matches(p, table);
        const shapes = table ? node.querySelectorAll('.table') : [node];
        for (const shape of shapes) {
          shape.style.fill = picked ? BLUE : matching ? table ? p.color : color(p) : GRAY;
          shape.style.stroke = picked || suggested.has(key) ? BLUE : '#FFFFFF';
          shape.style.strokeWidth = picked || suggested.has(key) ? '2px' : '.5px';
          shape.setAttribute('vector-effect', 'non-scaling-stroke');
        }
        node.classList.toggle('is-selected', picked);
        node.setAttribute('aria-pressed', String(picked));
        node.setAttribute('aria-disabled', String(!matching && !picked));
        node.setAttribute('aria-label', label(p, table));
      }
      const visible = detail && within(positions.get(key));
      // Атрибутите се пишат само при промяна: 12 хиляди места по два записа на кадър бяха
      // главната цена на всяко движение.
      if (node.__visible !== visible) {
        node.__visible = visible;
        node.setAttribute('tabindex', visible ? '0' : '-1');
        if (!table) node.setAttribute('aria-hidden', String(!visible));
      }
      if (visible && !table) {
        const [x, y] = positions.get(key), radius = Number(node.getAttribute('r'));
        if (radius * 2 / camera.w * host.clientWidth >= 16) {
          fragment.appendChild(element('text', { x, y, dy: '.35em', 'font-size': radius * 1.2, fill: picked ? '#FFF' : '#0B1B3A', class: 'svg-seat-number' }, p.t));
        }
      }
    }
    numbers.replaceChildren(fragment);
    placePin();
    stateDirty = false;
    caption.textContent = detail ? (active === 'tables' ? 'Маси · Изберете маса' : active && sections.has(active) ? 'Сектор ' + sections.get(active).properties.name + ' · Изберете места' : 'Изберете места') : 'Изберете сектор';
  }
  function activate(node) {
    if (!node) return;
    const { key, kind } = node.dataset;
    if (kind === 'section') options.onSectionClick?.(key);
    if (kind === 'seat') {
      if (getZoom() <= 5) { options.onSectionClick?.(sectionKey(seats.get(key).properties.s)); return; }
      const p = seats.get(key).properties;
      if (matches(p) || selected.has(key) || !available(p)) options.onSeatClick?.(key);
      else window.UI?.notify({ text: 'Това място е извън избраните филтри.' });
    }
    if (kind === 'table') {
      if (getZoom() <= 5) { frameTables(); options.onTablesZone?.(); }
      else options.onTableClick?.(key);
    }
    // Зоната за правостоящи е голяма и се хваща и отдалече. Какво става после
    // решава приложението (options.onStandingClick); без него кликът е без ефект.
    if (kind === 'standing') options.onStandingClick?.(key);
  }
  function local(clientX, clientY) {
    const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  function zoom(factor, anchor) {
    const width = Math.max(55, Math.min(homeCamera.w, camera.w * factor));
    const change = width / camera.w;
    const center = anchor || { x: camera.x + camera.w / 2, y: camera.y + camera.h / 2 };
    setCamera({ x: center.x - (center.x - camera.x) * change, y: center.y - (center.y - camera.y) * change, w: width, h: camera.h * change });
    if (width === homeCamera.w) reset();
  }
  function gestures() {
    svg.addEventListener('click', event => { if (!moved || event.detail === 0) activate(event.target.closest('[data-key]')); });
    svg.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.target.closest('[data-key]')) { event.preventDefault(); activate(event.target.closest('[data-key]')); }
      } else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(.65); emit('moveend'); }
      else if (event.key === '-') { event.preventDefault(); zoom(1.5); emit('moveend'); }
      else if (event.key === 'Escape') { reset(); }
    });
    svg.addEventListener('pointerover', event => {
      const target = event.target.closest('[data-key]');
      if (target) { tip.textContent = target.getAttribute('aria-label'); tip.hidden = false; }
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; });
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      moved = pointers.size > 1; drag = { x: event.clientX, y: event.clientY };
      // Capture on the SVG root, which survives viewport updates.
      svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId)) return;
      const previous = Array.from(pointers.values());
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const current = Array.from(pointers.values());
      if (current.length === 2) {
        moved = true; beginLive();
        const before = Math.hypot(previous[0].x - previous[1].x, previous[0].y - previous[1].y);
        const after = Math.hypot(current[0].x - current[1].x, current[0].y - current[1].y);
        if (before && after) zoom(before / after, worldAt((current[0].x + current[1].x) / 2, (current[0].y + current[1].y) / 2));
      } else if (drag) {
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true; beginLive();
        setCamera({ ...camera, x: camera.x - dx * camera.w / host.clientWidth, y: camera.y - dy * camera.h / host.clientHeight });
      }
      drag = { x: event.clientX, y: event.clientY };
    });
    function end(event) {
      // Pointer capture retargets click to the SVG: resolve a tap at its position.
      if (!moved && event.type === 'pointerup') {
        svg.releasePointerCapture(event.pointerId);
        activate(document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-key]'));
        moved = true; // suppress the browser's following click
      }
      pointers.delete(event.pointerId); drag = null; endLive(); emit('moveend');
    }
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', event => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1);
      zoom(Math.exp(Math.max(-100, Math.min(100, delta)) * .005), local(event.clientX, event.clientY));
      emit('moveend');
    }, { passive: false });
  }
  function init(config) {
    options = config; venue = config.venue;
    host = typeof config.container === 'string' ? document.getElementById(config.container) : config.container;
    host.classList.add('map-svg');
    for (const f of venue.sections.features) sections.set(f.properties.mk, f);
    for (const f of venue.seats.features) {
      const key = sectionKey(f.properties.s);
      seats.set(f.properties.mk, f);
      if (!bySection.has(key)) bySection.set(key, []);
      bySection.get(key).push(f);
    }
    for (const f of venue.tables?.features || []) tables.set(f.properties.mk, f);
    for (const f of venue.standing?.features || []) zones.set(f.properties.mk, f);
    // This is the admin's own plan (ceca-plan-svg.js), not hulls derived from seat coordinates.
    const parsed = new DOMParser().parseFromString(window.CecaPlanSVG, 'image/svg+xml');
    svg = document.importNode(parsed.documentElement, true);
    svg.classList.add('svg-hall');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', 'Схема на залата. Изберете сектор, после място.');
    svg.setAttribute('tabindex', '0');
    host.appendChild(svg);
    for (const node of svg.querySelectorAll('[data-key]')) {
      const key = node.dataset.key, kind = node.dataset.kind;
      if (kind === 'section' && !sections.has(key)) continue;
      if (kind === 'table' && !tables.has(key)) continue;
      if (kind === 'standing' && !zones.has(key)) continue;
      nodes.set(key, node);
      const box = node.getBBox();
      const position = svg.createSVGPoint();
      position.x = box.x + box.width / 2; position.y = box.y + box.height / 2;
      const transformed = position.matrixTransform(svg.getScreenCTM().inverse().multiply(node.getScreenCTM()));
      positions.set(key, [transformed.x, transformed.y]);
      if (kind === 'standing') {
        // Зоната се хваща с клавиатурата и се обявява като бутон; границите ѝ
        // служат за кадриране от легендата.
        node.setAttribute('tabindex', '0');
        const m = svg.getScreenCTM().inverse().multiply(node.getScreenCTM());
        const corners = [[box.x, box.y], [box.x + box.width, box.y + box.height]].map(([cx, cy]) => {
          position.x = cx; position.y = cy; const t = position.matrixTransform(m); return [t.x, t.y];
        });
        standingBox = { x: Math.min(corners[0][0], corners[1][0]), y: Math.min(corners[0][1], corners[1][1]),
          w: Math.abs(corners[1][0] - corners[0][0]), h: Math.abs(corners[1][1] - corners[0][1]) };
      }
      button(node, kind === 'section' ? 'Сектор ' + sections.get(key).properties.name
        : kind === 'standing' ? zoneLabel(zones.get(key).properties)
        : label((kind === 'table' ? tables : seats).get(key).properties, kind === 'table'));
    }
    numbers = element('g', { class: 'svg-seat-numbers', 'aria-hidden': 'true' });
    svg.appendChild(numbers);
    // Щриховката на зоната е в същото синьо като на WebGL картата; по един
    // шаблон за покой, посочване и избор (шаблонът не сменя цвят с CSS).
    const defs = element('defs', {});
    for (const [id, bg] of [['standing-hatch', '#DCE8F8'], ['standing-hatch-hover', '#C9DBF4'], ['standing-hatch-selected', '#A9C4EC'], ['standing-hatch-off', '#E3E7EE']]) {
      const pattern = element('pattern', { id, width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'scale(1.6)' });
      pattern.append(element('rect', { width: 14, height: 14, fill: bg }));
      if (id !== 'standing-hatch-off') for (const o of [-14, 0, 14]) pattern.append(element('path', { d: 'M' + o + ' 14L' + (o + 14) + ' 0', stroke: 'rgba(21,61,138,.30)', 'stroke-width': 1.4 }));
      defs.append(pattern);
    }
    svg.insertBefore(defs, svg.firstChild);
    const zone = Array.from(zones.values())[0];
    // ПРАВОСТОЯЩИ по пода на зоната: четирите думи са страните на ЕДИН КВАДРАТ в
    // средата (север 180, юг 0, запад 90, изток 270), всяка с основата навън, за да
    // се чете право отвън, гледайки навътре. Страна S = L + 2c + пролука, ~74% от
    // късата страна. Естествено разстояние между буквите; само украса (aria-hidden),
    // зад балона. Балонът с цената стои в отвора на квадрата.
    if (zone && standingBox && nodes.has(zone.properties.mk)) {
      const WORD = 'ПРАВОСТОЯЩИ', TRACK = .06, CAP = .72, SQUARE = .74, GAP = .3;
      const floor = element('g', { class: 'svg-standing-floor', 'aria-hidden': 'true' });
      const zoneNode = nodes.get(zone.properties.mk);
      zoneNode.parentNode.insertBefore(floor, zoneNode.nextSibling);
      // Ширината на думата се мери с истинския шрифт при размер 100.
      const probe = element('text', { class: 'floor-word', 'font-size': 100, 'letter-spacing': TRACK * 100, x: 0, y: 0 }, WORD);
      floor.append(probe);
      let wordEm = 8.3;
      try { wordEm = probe.getComputedTextLength() / 100 || wordEm; } catch (_) {}
      probe.remove();
      const b = standingBox, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const S = SQUARE * Math.min(b.w, b.h), c = S / (wordEm / CAP + 2 + GAP), em = c / CAP, d = S / 2 - c / 2;
      standingOpening = S - 2 * c; // свободният отвор за балона, в единици на чертежа
      const put = (x, y, rot) => floor.append(element('text', { class: 'floor-word', transform: 'translate(' + x + ' ' + y + ') rotate(' + rot + ')',
        x: 0, y: c / 2, 'text-anchor': 'middle', 'font-size': em, 'letter-spacing': TRACK * em }, WORD));
      put(cx, cy - d, 180); put(cx, cy + d, 0); put(cx - d, cy, 90); put(cx + d, cy, -90);
      // Парапет вместо пунктира: плътна тънка линия по контура със засечки на всеки
      // панел и входове от 3 м (два при задния ръб, по един в средата на лявата и
      // дясната страна). Мащабът е от картата: 1 единица на картата = 3 м.
      const unit = b.h / 8.3 / 3, panel = 2.25 * unit, entry = 3 * unit; // единици на чертежа на метър
      const fence = element('g', { class: 'svg-standing-fence', 'aria-hidden': 'true' });
      let path = '';
      const run = (from, to, gaps, horizontal, fixed) => {
        const cuts = [from, ...gaps.flatMap((g) => [g - entry / 2, g + entry / 2]), to];
        for (let k = 0; k < cuts.length; k += 2) {
          const lo = cuts[k], hi = cuts[k + 1], n = Math.max(0, Math.floor((hi - lo) / panel));
          if (!n) continue;
          path += horizontal ? 'M' + lo + ' ' + fixed + 'H' + hi : 'M' + fixed + ' ' + lo + 'V' + hi;
          for (let q = 0; q <= n; q++) {
            const t = lo + (hi - lo) / n * q;
            path += horizontal ? 'M' + t + ' ' + (fixed - 7) + 'v14' : 'M' + (fixed - 7) + ' ' + t + 'h14';
          }
        }
      };
      run(b.x, b.x + b.w, [], true, b.y);
      run(b.x, b.x + b.w, [b.x + 6 * unit, b.x + b.w - 6 * unit], true, b.y + b.h);
      run(b.y, b.y + b.h, [cy], false, b.x);
      run(b.y, b.y + b.h, [cy], false, b.x + b.w);
      fence.append(element('path', { d: path }));
      floor.after(fence);
    }
    if (zone && nodes.has(zone.properties.mk)) {
      standingPin = buildPin(zone.properties);
      svg.appendChild(standingPin);
      updatePin(zone.properties);
    }
    fullBounds = { x: 0, y: 0, w: 2500, h: 2500 };
    homeCamera = fitHome(); camera = { ...homeCamera };
    const toolbar = document.createElement('div'); toolbar.className = 'svg-map-toolbar';
    caption = document.createElement('span'); caption.className = 'svg-map-caption'; toolbar.appendChild(caption);
    for (const [name, text, action] of [['Приближете', '+', () => zoom(.6)], ['Отдалечете', '−', () => zoom(1.65)]]) {
      const control = document.createElement('button'); control.type = 'button'; control.textContent = text;
      control.setAttribute('aria-label', name);
      control.addEventListener('click', () => { action(); emit('moveend'); }); toolbar.appendChild(control);
    }
    host.appendChild(toolbar);
    tip = document.createElement('div'); tip.className = 'svg-map-tip'; tip.hidden = true; host.appendChild(tip);
    gestures(); setCamera(camera); render();
    new ResizeObserver(() => facade.resize()).observe(host);
    window.SeatMapStartup?.mapReady();
    return facade;
  }
  // Only the camera events used by app.js/sheet.js are exposed. Native SVG
  // handles its own gestures; no MapLibre layer or canvas emulation is needed.
  const facade = {
    on(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); return this; },
    getZoom, getMinZoom: () => 4, getPitch: () => 0, getBearing: () => 0,
    resize() {
      if (!camera) return;
      const home = getZoom() < 4.01;
      homeCamera = fitHome();
      const centerY = camera.y + camera.h / 2;
      const height = camera.w * host.clientHeight / Math.max(host.clientWidth, 1);
      if (home) setCamera({ ...homeCamera });
      else if (selected.size) frameSeats(Array.from(selected));
      else if (selectedTables.size) frameTable(Array.from(selectedTables)[0]);
      else setCamera({ ...camera, y: centerY - height / 2, h: height });
      emit('moveend');
    }
  };
  return {
    mode: '2d', init, rotateToSection, reset, frameSeats, frameTable, frameTables,
    zoomToSeats: key => frameSeats([key]), frameTableLevel: frameTables,
    tablesOfLevel: level => Array.from(tables.values()).filter(f => !f.properties.sold && f.properties.tableLevel === level).map(f => f.properties),
    selectSeat(keys) { selected = new Set(list(keys)); schedule(); },
    selectSeats(keys) { selected = new Set(list(keys)); schedule(); },
    clearSeatSelection() { selected.clear(); schedule(); },
    selectTables(keys) { selectedTables = new Set(list(keys)); schedule(); },
    clearTableSelection() { selectedTables.clear(); schedule(); },
    selectStanding(on) { selectedStanding = !!on; schedule(); },
    frameStanding() {
      if (!standingBox) return;
      active = 'standing';
      const pad = standingBox.w * .12;
      setCamera(fit({ x: standingBox.x - pad, y: standingBox.y - pad, w: standingBox.w + pad * 2, h: standingBox.h + pad * 2 }));
      emit('moveend');
    },
    highlightSeats(keys) { suggested = new Set(list(keys)); schedule(); },
    clearSeatHighlights() { suggested.clear(); schedule(); },
    highlight(key) { highlighted = key; schedule(); },
    clearHighlight() { highlighted = null; schedule(); },
    revealSection(key) { active = key == null ? null : sectionKey(key); schedule(); },
    clearRevealed() { active = null; schedule(); },
    setTierFilter(value) { tiers = value; schedule(); },
    setPartyFilter(value) { party = value > 1 ? value : 0; schedule(); },
    setPriceRange(min, max) { minimum = min; maximum = max; schedule(); },
    setObstructedHidden(value) { obstructed = !!value; schedule(); },
    setFeesMode(value) { fees = !!value; schedule(); },
    home: () => ({ center: [homeCamera.x + homeCamera.w / 2, -homeCamera.y - homeCamera.h / 2], zoom: 4 }),
    _map: () => facade, _data: () => venue
  };
})();
