/* Изглед от мястото като готова картинка за схемата без WebGL (SVG планът). Малък диалог:
   картинка с „скелет", докато се тегли, подпис с мястото и затваряне. Картинките са от
   assets/seatviews (виж seatviews.js) и се теглят едва при отваряне.

   SeatViewImage.open({ venue, mk, place }) - place е подписът ("Сектор C.2.5 · ред 14",
   "Маса 101", "Правостоящи"). Esc и фонът затварят; фокусът влиза и се връща. */
window.SeatViewImage = (function () {
  'use strict';
  var active = null;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    node.className = cls || '';
    if (text) node.textContent = text;
    return node;
  }

  function close() {
    if (active) active.dispose();
    active = null;
  }

  function open(options) {
    close();
    var venue = options.venue, mk = options.mk, place = String(options.place || '');
    var previous = document.activeElement;
    var closed = false;
    if (typeof performance === 'object' && performance.mark) performance.mark('seatview-image-open');

    var root = el('div', 'svi');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Изглед от мястото: ' + place);
    var veil = el('div', 'svi__veil');
    var card = el('div', 'svi__card');
    var frame = el('div', 'svi__frame');
    var img = el('img', 'svi__img');
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    var msg = el('p', 'svi__msg');
    msg.hidden = true;
    msg.setAttribute('role', 'status');
    var text = el('span');
    var retry = el('button', 'svi__retry', 'Опитайте пак');
    retry.type = 'button';
    msg.append(text, retry);
    frame.append(img, msg);
    var cap = el('p', 'svi__cap');
    cap.append(el('span', 'svi__hint', 'Ориентировъчен изглед'), el('span', 'svi__place', place));
    var exit = el('button', 'svi__close');
    exit.type = 'button';
    exit.setAttribute('aria-label', 'Затворете изгледа');
    exit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    card.append(frame, cap, exit);
    root.append(veil, card);

    var bodyOverflow = document.body.style.overflow;
    var inert = Array.prototype.filter.call(document.body.children, function (node) { return !node.inert; });
    document.body.append(root);
    document.body.style.overflow = 'hidden';
    inert.forEach(function (node) { node.inert = true; });
    exit.focus({ preventScroll: true });

    function fail(message, canRetry) {
      if (closed) return;
      frame.classList.remove('is-loaded');
      frame.classList.add('is-failed');
      text.textContent = message;
      retry.hidden = !canRetry;
      msg.hidden = false;
    }
    function load() {
      frame.classList.remove('is-failed');
      msg.hidden = true;
      var seatViews = window.SeatViews;
      if (!seatViews) { fail('Изгледът не е наличен.', false); return; }
      seatViews.load().then(function (manifest) {
        if (closed) return;
        var view = seatViews.nearest(venue, mk, manifest);
        if (!view) { fail('За това място няма изглед.', false); return; }
        img.onload = function () {
          if (closed) return;
          frame.classList.add('is-loaded');
          if (typeof performance === 'object' && performance.mark) performance.mark('seatview-image-shown');
        };
        img.onerror = function () { fail('Изгледът не се зареди.', true); };
        img.src = new URL(seatViews.url(view), document.baseURI).href;
      }, function () { fail('Изгледът не се зареди.', true); });
    }

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === 'Tab') {
        var items = [exit, retry].filter(function (b) { return b === exit || (!msg.hidden && !retry.hidden); });
        var first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        else if (items.indexOf(document.activeElement) < 0) { event.preventDefault(); first.focus(); }
      }
    }
    // На документа, а не на диалога: останалото е inert и фокусът може да е паднал на тялото.
    document.addEventListener('keydown', onKey, true);
    exit.addEventListener('click', close);
    veil.addEventListener('click', close);
    retry.addEventListener('click', load);

    active = {
      dispose: function () {
        if (closed) return;
        closed = true;
        img.onload = img.onerror = null;
        document.removeEventListener('keydown', onKey, true);
        root.remove();
        inert.forEach(function (node) { node.inert = false; });
        document.body.style.overflow = bodyOverflow;
        if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
      }
    };
    load();
  }

  return { open: open, close: close };
})();
