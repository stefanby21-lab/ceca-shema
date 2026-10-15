/* Native SVG renderer for browsers where WebGL is unavailable.
   VENUE and app.js remain the authority for availability and selection rules. */
window.SeatMap = (function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const BLUE = '#153D8A', GRAY = '#C3CAD5';
  // Местата на маса идват от данните (свойството seats); 6 е само резервата.
  const TABLE_SEATS_FALLBACK = 6;
  let venue, options, host, svg, numbers, caption, tip, camera, homeCamera, active = null;
  let stateDirty = true;
  const nodes = new Map(), positions = new Map();
  let selected = new Set(), selectedTables = new Set(), suggested = new Set(), highlighted = null;
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
    svg.setAttribute('viewBox', [camera.x, camera.y, camera.w, camera.h].join(' '));
    emit('move'); schedule(false);
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
  // Правостоящите са зона, не място: името е в данните, купуването е отделна стъпка.
  function zoneLabel(p) {
    const price = fees && p.eurAll != null ? p.eurAll : p.eur;
    return p.name + (available(p) ? ' · ' + price + ' €' : ' · Не е достъпно');
  }
  function color(p) { return venue.tiers.find(t => t.tier === p.tier)?.color || BLUE; }
  function button(node, name) {
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', name);
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
          node.classList.toggle('is-selected', highlighted === key);
          node.setAttribute('aria-disabled', String(!available(p)));
          node.setAttribute('aria-label', zoneLabel(p));
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
      node.setAttribute('tabindex', visible ? '0' : '-1');
      if (!table) node.setAttribute('aria-hidden', String(!visible));
      if (visible && !table) {
        const [x, y] = positions.get(key), radius = Number(node.getAttribute('r'));
        if (radius * 2 / camera.w * host.clientWidth >= 16) {
          fragment.appendChild(element('text', { x, y, dy: '.35em', 'font-size': radius * 1.2, fill: picked ? '#FFF' : '#0B1B3A', class: 'svg-seat-number' }, p.t));
        }
      }
    }
    numbers.replaceChildren(fragment);
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
        moved = true;
        const before = Math.hypot(previous[0].x - previous[1].x, previous[0].y - previous[1].y);
        const after = Math.hypot(current[0].x - current[1].x, current[0].y - current[1].y);
        if (before && after) zoom(before / after, local((current[0].x + current[1].x) / 2, (current[0].y + current[1].y) / 2));
      } else if (drag) {
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true;
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
      pointers.delete(event.pointerId); drag = null; emit('moveend');
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
      button(node, kind === 'section' ? 'Сектор ' + sections.get(key).properties.name
        : kind === 'standing' ? zoneLabel(zones.get(key).properties)
        : label((kind === 'table' ? tables : seats).get(key).properties, kind === 'table'));
    }
    numbers = element('g', { class: 'svg-seat-numbers', 'aria-hidden': 'true' });
    svg.appendChild(numbers);
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
