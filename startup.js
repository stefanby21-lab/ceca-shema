(function () {
  'use strict';
  const status = document.getElementById('startup-status');
  const failure = document.getElementById('startup-failure');
  const detail = document.getElementById('startup-detail');
  const alternative = document.getElementById('startup-2d');
  let graphics = false;
  let appReady = false, mapReady = false, scriptsReady = false, failed = false;
  let current = 'initialization';
  const browser = typeof navigator === 'object' ? navigator.userAgent : '';
  let timer = setTimeout(function () { fail('timeout: ' + current); }, 30000);
  // Автоматичен преход към SVG плана: при провал на WebGL пътя се минава към ?view=2d
  // (с fallback=1, за да се знае, че режимът е добавен автоматично). Пазачът срещу цикъл
  // е само за този опит: време и адресът, от който се е паднало; важи 2 минути. По-късно
  // посещение на същия адрес пак може да се възстанови.
  const FALLBACK_KEY = 'ceca.fallback2d.v1';
  const GUARD_MS = 2 * 60 * 1000;
  const query = new URL(window.location.href).searchParams;
  const autoFallback = query.get('fallback') === '1' && query.get('view') === '2d';
  function canonical() {
    const url = new URL(window.location.href);
    ['view', 'fallback', 'retry'].forEach(function (name) { url.searchParams.delete(name); });
    url.hash = '';
    return url.href;
  }
  function guardActive() {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(FALLBACK_KEY) || 'null');
      if (!saved || typeof saved.t !== 'number' || typeof saved.from !== 'string') return false;
      const age = Date.now() - saved.t;
      return age >= 0 && age < GUARD_MS && saved.from === canonical();
    } catch (_) { return false; }
  }
  function clearGuard() {
    try { window.sessionStorage.removeItem(FALLBACK_KEY); } catch (_) {}
  }
  // Връща адреса към 3D: без view и fallback, но само когато режимът е добавен автоматично.
  function withoutAutoMode(href) {
    const url = new URL(href);
    if (url.searchParams.get('fallback') === '1') {
      url.searchParams.delete('view');
      url.searchParams.delete('fallback');
    }
    return url.href;
  }
  function fallbackTo2d() {
    if (!graphics) return false;
    try {
      if (guardActive()) return false;
      window.sessionStorage.setItem(FALLBACK_KEY, JSON.stringify({ t: Date.now(), from: canonical() }));
    } catch (_) { return false; }
    const url = new URL(window.location.href);
    url.searchParams.set('view', '2d');
    url.searchParams.set('fallback', '1');
    console.warn('[seatmap startup] falling back to the SVG plan');
    try { window.location.replace(url.href); return true; } catch (_) { return false; }
  }
  // Само грешка от НАШ скрипт е фатална: файлът ѝ е от същия произход. Празен файл
  // (с „Script error.") е начинът, по който WebKit подава грешки от чужди или инжектирани
  // скриптове (Brave/Chrome на iOS слагат свои), а те не са наши и не бива да спират схемата.
  // Ред 0 не прави грешката чужда: собствените асинхронни провали идват и без ред.
  const origin = (function () { try { return new URL(window.location.href).origin; } catch (_) { return ''; } })();
  function isOwnError(event) {
    if (!event || !event.filename) return false;
    let from;
    try { from = new URL(event.filename, window.location.href).origin; } catch (_) { return false; }
    return from === origin;
  }
  function isOwnRejection(event) {
    const reason = event && event.reason;
    return !!(reason && typeof reason.stack === 'string' && origin && reason.stack.indexOf(origin) >= 0);
  }
  // Причината може да не е Error (обект, число, undefined): винаги става четим текст.
  function describe(reason) {
    if (typeof reason === 'string') return reason;
    if (reason && typeof reason.message === 'string' && reason.message) return reason.message;
    try {
      const json = JSON.stringify(reason);
      if (json !== undefined) return json;
    } catch (_) { /* циклична или неизброима стойност */ }
    return String(reason);
  }
  // Моментална картинка на залата (#map-boot): 2D вариантът се слага, когато няма WebGL,
  // и тя се стопява (или веднага се маха при „намалено движение"), щом картата е готова.
  const boot = document.getElementById('map-boot');
  function removeBoot() {
    if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
  }
  function usePlanPreview() {
    if (!boot) return;
    const picture = boot.querySelector('picture');
    const source = picture && picture.querySelector('source');
    const img = boot.querySelector('img');
    if (!source || !img) return;
    function parse(url, size) {
      const m = /^(\d+)x(\d+)$/.exec(size || '');
      return url && m ? { url: url, w: m[1], h: m[2] } : null;
    }
    const mobile = parse(boot.getAttribute('data-plan-mobile'), boot.getAttribute('data-plan-mobile-size'));
    const desktop = parse(boot.getAttribute('data-plan-desktop'), boot.getAttribute('data-plan-desktop-size'));
    if (!mobile || !desktop) return;
    source.setAttribute('srcset', mobile.url);
    source.setAttribute('width', mobile.w);
    source.setAttribute('height', mobile.h);
    img.setAttribute('width', desktop.w);
    img.setAttribute('height', desktop.h);
    img.setAttribute('src', desktop.url);
  }
  function dismissBoot() {
    if (!boot || !boot.parentNode) return;
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) { removeBoot(); return; }
    boot.classList.add('is-leaving');
    boot.addEventListener('transitionend', removeBoot);
    setTimeout(removeBoot, 400);
  }
  function fail(reason) {
    if (failed || (appReady && mapReady && scriptsReady)) return;
    if (fallbackTo2d()) { failed = true; clearTimeout(timer); return; }
    failed = true;
    clearTimeout(timer);
    removeBoot();
    status.hidden = true;
    failure.hidden = false;
    failure.inert = false;
    Array.from(document.body.children).forEach(function (el) { if (el !== failure) el.inert = true; });
    failure.tabIndex = -1;
    failure.focus();
    detail.textContent = describe(reason).slice(0, 400) + (browser ? '\n' + browser : '');
    if (graphics && alternative) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', '2d');
      alternative.href = url.href;
      alternative.hidden = false;
      document.getElementById('startup-hint').textContent = 'Опитайте отново или изберете места от 2D схемата.';
    }
    console.error('[seatmap startup]', reason);
  }
  function ready() {
    if (!appReady || !mapReady || !scriptsReady || failed) return;
    clearTimeout(timer);
    status.hidden = true;
    dismissBoot();
  }
  window.SeatMapStartup = {
    appReady: function () { appReady = true; ready(); },
    mapReady: function () { mapReady = true; ready(); },
    graphicsLost: function () {
      if (failed) return;
      mapReady = false;
      status.hidden = false;
      status.textContent = 'Възстановяване на схемата…';
      clearTimeout(timer);
      timer = setTimeout(function () { fail('WebGL context lost'); }, 15000);
    },
    fail: fail
  };
  // A failed startup may leave the quantity dialog's focus trap active.
  window.addEventListener('keydown', function (event) {
    if (failed) event.stopImmediatePropagation();
  }, true);
  window.addEventListener('error', function (event) {
    if (!isOwnError(event)) {
      console.warn('[seatmap startup] ignored foreign error', event && event.message, event && event.filename, event && event.lineno);
      return;
    }
    fail(current + ': ' + event.message + ' (' + String(event.filename).split('/').pop().split('?')[0] + ':' + (event.lineno || 0) + ':' + (event.colno || 0) + ')');
  });
  window.addEventListener('unhandledrejection', function (event) {
    if (!isOwnRejection(event)) {
      console.warn('[seatmap startup] ignored foreign rejection', event && event.reason && event.reason.message || event && event.reason);
      return;
    }
    fail(current + ': ' + describe(event.reason));
  });
  document.getElementById('startup-retry').onclick = function () {
    clearGuard();
    const url = new URL(withoutAutoMode(window.location.href));
    url.searchParams.set('retry', String(Date.now()));
    window.location.href = url.href;
  };
  // Автоматично паднали на 2D: малък бутон да се опита 3D схемата пак.
  const try3d = document.getElementById('startup-try3d');
  if (try3d && autoFallback) {
    try3d.hidden = false;
    try3d.onclick = function () {
      clearGuard();
      const url = new URL(window.location.href);
      ['view', 'fallback', 'retry'].forEach(function (name) { url.searchParams.delete(name); });
      window.location.href = url.href;
    };
  }
  const fresh = new URL(window.location.href).searchParams.has('retry');
  // Feature detection, not browser/Lockdown sniffing. SVG uses the same venue
  // and selection controller, but needs neither WebGL nor downloadable fonts.
  function graphicsAvailable() {
    if (new URL(window.location.href).searchParams.get('view') === '2d') return false;
    for (const type of ['webgl2', 'webgl']) {
      try {
        const context = document.createElement('canvas').getContext(type);
        if (context) {
          const release = context.getExtension('WEBGL_lose_context');
          if (release) release.loseContext();
          return true;
        }
      } catch (_) { /* A security policy may throw instead of returning null. */ }
    }
    return false;
  }
  graphics = graphicsAvailable();
  if (!graphics) {
    // Размерите на картата са тези на SVG режима още от първото рисуване (map-svg.js добавя същия клас):
    // иначе колоната би се свила, когато скриптът стартира, и картинката би скочила.
    const pane = document.getElementById('map');
    if (pane && pane.classList) pane.classList.add('map-svg');
    usePlanPreview();
  }
  const sources = Array.from(document.querySelectorAll('script[data-src]'))
    .filter(function (el) { return graphics ? !el.dataset.svg : !el.dataset.webgl; })
    .map(function (el) { return !graphics && el.dataset.fallback || el.dataset.src; });
  function load(index, retry) {
    if (failed) return;
    if (index === sources.length) { scriptsReady = true; ready(); return; }
    const src = sources[index];
    current = src.split('?')[0];
    const script = document.createElement('script');
    script.src = src + ((fresh || retry) ? '&retry=' + Date.now() : '');
    script.onload = function () { load(index + 1, false); };
    script.onerror = function () {
      script.remove();
      if (!retry) load(index, true);
      else fail('download: ' + current);
    };
    document.head.appendChild(script);
  }
  load(0, false);
})();
