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
  // Автоматичен преход към SVG плана: при провал на WebGL пътя се минава ВЕДНЪЖ към
  // ?view=2d, вместо екран с грешка. Флагът в sessionStorage пази от цикъл (ако и 2D
  // се провали, показва се екранът с грешка). Бутонът „Заредете отново" го чисти.
  const FALLBACK_KEY = 'ceca.fallback2d.v1';
  function fallbackTo2d() {
    if (!graphics) return false;
    try {
      if (window.sessionStorage.getItem(FALLBACK_KEY)) return false;
      window.sessionStorage.setItem(FALLBACK_KEY, '1');
    } catch (_) { return false; }
    const url = new URL(window.location.href);
    url.searchParams.set('view', '2d');
    console.warn('[seatmap startup] falling back to the SVG plan');
    try { window.location.replace(url.href); return true; } catch (_) { return false; }
  }
  // Само грешка от НАШ скрипт е фатална: същият произход, истински файл и ред и
  // реално съобщение. „Script error." без файл и ред е начинът, по който WebKit
  // подава грешки от чужди или инжектирани скриптове (Brave/Chrome на iOS слагат
  // свои), а те не са наши и не бива да спират схемата.
  const origin = (function () { try { return new URL(window.location.href).origin; } catch (_) { return ''; } })();
  function isOwnError(event) {
    if (!event || !event.filename || !event.message || /^script error\.?$/i.test(String(event.message).trim())) return false;
    let from;
    try { from = new URL(event.filename, window.location.href).origin; } catch (_) { return false; }
    return from === origin && event.lineno > 0;
  }
  function isOwnRejection(event) {
    const reason = event && event.reason;
    return !!(reason && typeof reason.stack === 'string' && origin && reason.stack.indexOf(origin) >= 0);
  }
  function fail(reason) {
    if (failed || (appReady && mapReady && scriptsReady)) return;
    if (fallbackTo2d()) { failed = true; clearTimeout(timer); return; }
    failed = true;
    clearTimeout(timer);
    status.hidden = true;
    failure.hidden = false;
    failure.inert = false;
    Array.from(document.body.children).forEach(function (el) { if (el !== failure) el.inert = true; });
    failure.tabIndex = -1;
    failure.focus();
    detail.textContent = String(reason).slice(0, 400) + (browser ? '\n' + browser : '');
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
    fail(current + ': ' + event.message + ' (' + String(event.filename).split('/').pop().split('?')[0] + ':' + event.lineno + ':' + (event.colno || 0) + ')');
  });
  window.addEventListener('unhandledrejection', function (event) {
    if (!isOwnRejection(event)) {
      console.warn('[seatmap startup] ignored foreign rejection', event && event.reason && event.reason.message || event && event.reason);
      return;
    }
    fail(current + ': ' + String(event.reason.message || event.reason));
  });
  document.getElementById('startup-retry').onclick = function () {
    try { window.sessionStorage.removeItem(FALLBACK_KEY); } catch (_) {}
    const url = new URL(window.location.href);
    url.searchParams.set('retry', String(Date.now()));
    window.location.href = url.href;
  };
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
