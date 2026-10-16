(function () {
  "use strict";
  var K = ["#1a9850", "#66bd63", "#a6d96a", "#fee08b", "#fdae61", "#f46d43", "#d73027", "#a50026"],
    j = ["#03210f", "#0d2a0c", "#243d12", "#5f4a00", "#5c2c00", "#3a0d00", "#ffffff", "#ffffff"],
    he = {
      amazing: "Топ оферта",
      great: "Страхотна цена",
      good: "Добра цена",
      okay: "Приемлива цена",
      fair: "Нормална цена",
      "so-so": "Средна цена",
      soso: "Средна цена",
      bad: "Слаба оферта",
      awful: "Висока цена",
    },
    ye =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M20.6 9.5c.9.75 1.4 1.6 1.4 2.5 0 3.04-4.48 5.5-10 5.5S2 15.04 2 12c0-.9.5-1.75 1.4-2.5"/><path d="M18.5 17.5 20 19m0 0-1.5 1.5M20 19h-3"/></svg>',
    be =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 15-4.35-4.35a1 1 0 0 0-1.42 0L7 19"/></svg>',
    Ce =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.6a7.8 7.8 0 0 0 0-3.2l2-1.5-2-3.4-2.3.9a7.8 7.8 0 0 0-2.8-1.6L14 2h-4l-.3 2.4a7.8 7.8 0 0 0-2.8 1.6l-2.3-.9-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3.2l-2 1.5 2 3.4 2.3-.9c.8.7 1.8 1.3 2.8 1.6L10 22h4l.3-2.4c1-.3 2-.9 2.8-1.6l2.3.9 2-3.4-2-1.5Z"/></svg>',
    ge = new Intl.NumberFormat("bg-BG", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  function O(e) {
    var n = Number(e);
    return isFinite(n) ? ge.format(n) : "-";
  }
  var Q = new Map(),
    W = new Map(),
    I = null,
    G = new Map(),
    P = !0,
    L = { min: 0, max: 500, minAll: 0, maxAll: 500 },
    N = null,
    H = null,
    D = null,
    z = null,
    $ = null,
    h = null,
    B = null,
    A = {},
    V = null,
    ee = "kb_viewed_v1",
    ne = 20,
    F = Oe(),
    te = function () {},
    ie = !1;
  function T(e, n, i) {
    return ((e = Number(e)), isFinite(e) || (e = n), Math.min(i, Math.max(n, e)));
  }
  function re(e) {
    var n = {};
    for (var i in e) Object.prototype.hasOwnProperty.call(e, i) && (n[i] = e[i]);
    return n;
  }
  function t(e, n, i) {
    var a = document.createElement(e);
    return (n && (a.className = n), i != null && (a.textContent = String(i)), a);
  }
  function we(e) {
    if (!e) return "";
    var n = String(e).toLowerCase().trim();
    return he[n] || String(e);
  }
  function ae(e, n, i) {
    var a = t("span", "pill" + (i ? " " + i : ""), we(e));
    return (
      typeof n != "number" && W.has(e) && (n = W.get(e)),
      typeof n == "number" && n >= 0 && n < K.length
        ? ((a.style.background = K[n]), (a.style.color = j[n]))
        : ((a.style.background = "#ececf3"), (a.style.color = "#62626e")),
      a
    );
  }
  function U(e, n) {
    n = n || {};
    var i = typeof n.onHover == "function" ? n.onHover : function () {},
      a = typeof n.onSelect == "function" ? n.onSelect : function () {},
      r = document.getElementById("listings");
    if (r) {
      var o = (e && e.sections && e.sections.features) || [];
      o.forEach(function (y) {
        var g = y && y.properties;
        g && g.name && Le2.set(String(g.token || String(g.mk).replace(/^s:/, "")), g.name);
      });
      var l = o.filter(function (y) {
          return y && y.properties && typeof y.properties.priceFrom == "number";
        }),
        u = 1 / 0,
        c = -1 / 0,
        d = 1 / 0,
        p = -1 / 0;
      (l.forEach(function (y) {
        var g = y.properties;
        typeof g.priceFrom == "number" && ((u = Math.min(u, g.priceFrom)), (c = Math.max(c, g.priceFrom)));
        var m = typeof g.priceFromAll == "number" ? g.priceFromAll : g.priceFrom;
        typeof m == "number" && ((d = Math.min(d, m)), (p = Math.max(p, m)));
      }),
        isFinite(u) && isFinite(c) && ((L.min = u), (L.max = c)),
        isFinite(d) && isFinite(p) && ((L.minAll = d), (L.maxAll = p)),
        l.sort(function (y, g) {
          var m = y.properties,
            k = g.properties,
            q = typeof m.tier == "number" ? m.tier : m.bucket,
            _ = typeof k.tier == "number" ? k.tier : k.bucket;
          return q - _ || m.priceFrom - k.priceFrom || String(m.name).localeCompare(String(k.name), "bg");
        }),
        (r.textContent = ""),
        (Q = new Map()),
        (W = new Map()));
      var v = document.createDocumentFragment(),
        s = ["ОРКЕСТРИНА", "ПАРТЕР 1", "ПАРТЕР 2", "БАЛКОН 1", "БАЛКОН 2"],
        x = function (y) {
          var g = s.indexOf(y || "");
          return g < 0 ? 99 : g;
        },
        f = l.some(function (y) {
          return y.properties && y.properties.level;
        }),
        C = I
          ? l.filter(function (y) {
              return y.properties.mk === I;
            })
          : [],
        E = l.filter(function (y) {
          return y.properties.mk !== I;
        });
      f &&
        E.sort(function (y, g) {
          var m = y.properties,
            k = g.properties;
          return (
            x(m.level) - x(k.level) ||
            m.priceFrom - k.priceFrom ||
            String(m.name).localeCompare(String(k.name), "bg", { numeric: !0 })
          );
        });
      var w = C.concat(E),
        b = null;
      (w.forEach(function (y, g) {
        var m = y.properties,
          k = typeof m.tier == "number" ? m.tier : m.bucket;
        m.bucketLabel && W.set(m.bucketLabel, k);
        var q = g < C.length,
          _ = q ? "__pinned" : f ? m.level || "Други" : null;
        if (_ !== null && _ !== b) {
          var Ke = t("div", "listing-group" + (q ? " is-pinned" : ""), q ? "Избрано" : _);
          (v.appendChild(Ke), (b = _));
        }
        var M = t("button", "listing-row");
        ((M.type = "button"), (M.dataset.mk = m.mk));
        var Y = String(m.name || ""),
          me = t("span", "lr-name", /^(Сектор|Блок|Ложа|Оркестрина)(\s|$)/i.test(Y) ? Y : "Сектор " + Y);
        (q && J && me.appendChild(t("span", "lr-seat", J)),
          M.appendChild(me),
          m.bucketLabel && M.appendChild(ae(m.bucketLabel, k, "lr-pill")));
        var je = P && typeof m.priceFromAll == "number" ? m.priceFromAll : m.priceFrom,
          Z = t("span", "lr-price");
        (Z.appendChild(t("span", "lr-from", "от ")),
          Z.appendChild(t("span", "lr-amount", O(je))),
          M.appendChild(Z),
          ue(m.mk) && (M.classList.add("has-badge"), M.appendChild(t("span", "badge-viewed", "Разгледано"))),
          M.addEventListener("mouseenter", function () {
            i(m.mk);
          }),
          M.addEventListener("mouseleave", function () {
            i(null);
          }),
          M.addEventListener("focus", function () {
            i(m.mk);
          }),
          M.addEventListener("blur", function () {
            i(null);
          }),
          M.addEventListener("click", function () {
            a(m.mk);
          }),
          Q.set(m.mk, M),
          v.appendChild(M));
      }),
        r.appendChild(v));
      var S = document.getElementById("listings-count");
      (S && (S.textContent = l.length === 1 ? "1 сектор" : l.length + " сектора"),
        I && Q.has(I) && (Q.get(I).classList.add("is-selected"), Q.get(I).setAttribute("aria-current", "true")),
        (N = e),
        (H = n));
    }
  }
  function Ee() {
    return typeof matchMedia == "function" && matchMedia("(max-width: 880px)").matches;
  }
  function le() {
    // На телефон разкриването е работа на листа: той се вдига сам. Плавен
    // scrollIntoView отгоре е второ движение по същия кадър - двете се бият
    // и точно това правеше избора на място накъсан.
    if (Ee()) return;
    var e = document.getElementById("seatview");
    if (e)
      try {
        e.scrollIntoView({ block: "start", behavior: "smooth" });
      } catch {
        e.scrollIntoView();
      }
  }
  var J = null;
  // Всеки билет е свой ред: сектор и място отляво, цена и хиксче отдясно.
  // Сумирането на еднаквите места в един ред („3 × 25 €") скриваше кое точно
  // е избрано и не даваше как да се махне само едно от тях.
  // Колко реда имаше при предишното рисуване - за да познаем кога е добавен
  // нов билет и да превъртим списъка до него.
  var pkN = 0,
    // Списъкът остава "закачен" за дъното си след нов билет, докато човекът
    // не превърти сам. Картата долу се пречертава след него (и снимката ѝ
    // идва още по-късно) и му отнема височина - еднократно превъртане не
    // стигаше, последният ред пак оставаше отрязан.
    pkPin = !1,
    pkRo =
      typeof ResizeObserver == "function"
        ? new ResizeObserver(function (z) {
            var l = z[0] && z[0].target;
            l && pkPin && l.scrollHeight > l.clientHeight && (l.scrollTop = l.scrollHeight);
          })
        : null;
  function pk(e, n) {
    var recommendation = document.querySelector('.fb-pill-rec');
    if(recommendation) recommendation.textContent=e&&e.length?'Препоръчайте ми други места':'Препоръчайте ми места';
    var i = document.getElementById("picklist");
    if (!i) return;
    // Списъкът се строи наново при всяка промяна. Ако фокусът е бил на стъпката за
    // правостоящи (- / +), същият бутон го получава обратно: с клавиатурата човек
    // натиска „+" три пъти подред, без да се връща с Tab.
    var focusAct = document.activeElement && document.activeElement.closest && document.activeElement.closest("#picklist") && document.activeElement.dataset ? document.activeElement.dataset.act : null;
    ((n = n || {}), (i.textContent = ""));
    var a = t("div", "pk-head");
    a.appendChild(t("h2", "block-title", "Избрано"));
    if (e && e.length) {
      var r = t("button", "pk-clear");
      ((r.type = "button"),
        r.appendChild(document.createTextNode("Премахнете всички избрани")),
        // Хиксчето стои НАЙ-ОТЗАД, след текста - първо се чете действието.
        (r.insertAdjacentHTML(
          "beforeend",
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        )),
        r.addEventListener("click", function () {
          typeof n.onClearAll == "function" && n.onClearAll();
        }),
        a.appendChild(r));
    }
    if ((i.appendChild(a), !e || !e.length)) {
      pkN = 0;
      return;
    }
    var o = t("ul", "pk-list");
    e.forEach(function (l) {
      var u = t("li", "pk-row"),
        c = t("div", "pk-name");
      (c.appendChild(t("span", "pk-sector", l.sector)),
        c.appendChild(t("span", "pk-seat", l.seat)),
        u.appendChild(c));
      // Правостоящи: няма място и няма изглед, затова вместо „от мястото"
      // реда носи стъпка за броя билети (- / +). Редът е на две линии - на
      // 320px името, цената и хикса не оставят място за стъпка до тях.
      if (l.kind === "standing") {
        u.classList.add("pk-row--standing");
        ((u.dataset.kind = "standing"), (u.dataset.qty = String(l.qty)));
        u.appendChild(t("span", "pk-price", O(l.eur)));
        var x = t("button", "pk-x");
        ((x.type = "button"),
          x.setAttribute("aria-label", "Премахнете " + l.sector),
          (x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'),
          x.addEventListener("click", function () {
            typeof n.onRemove == "function" && n.onRemove(l.mk);
          }),
          u.appendChild(x));
        var sp = t("div", "pk-step");
        (sp.setAttribute("role", "group"), sp.setAttribute("aria-label", "Брой билети: " + l.sector));
        var mi = t("button", "pk-step__b", "\u2212"),
          va = t("span", "pk-step__v", String(l.qty)),
          pl = t("button", "pk-step__b", "+");
        ((mi.type = "button"),
          (pl.type = "button"),
          (mi.dataset.act = "minus"),
          (pl.dataset.act = "plus"),
          mi.setAttribute("aria-label", "Един билет по-малко"),
          pl.setAttribute("aria-label", "Един билет повече"),
          va.setAttribute("aria-live", "polite"),
          // На минимума „-" е само aria-disabled (махането е хиксът), за да не губи
          // клавиатурата фокуса и повторното Enter да не превключи на „+". На
          // максимума „+" също остава натискаемо и обяснява лимита.
          mi.setAttribute("aria-disabled", String(l.qty <= 1)),
          pl.setAttribute("aria-disabled", String(l.qty >= l.max)),
          mi.addEventListener("click", function () {
            typeof n.onQuantity == "function" && n.onQuantity(l.mk, l.qty - 1);
          }),
          pl.addEventListener("click", function () {
            typeof n.onQuantity == "function" && n.onQuantity(l.mk, l.qty + 1);
          }),
          sp.appendChild(mi),
          sp.appendChild(va),
          sp.appendChild(pl),
          u.appendChild(sp),
          o.appendChild(u));
        return;
      }
      // Тънко бутонче „360° изглед" ВЛЯВО от цената: при местата остава видимо,
      // но временно е недостъпно. Където няма панорама (маси), бутонът остава
      // невидим, за да не се разместват цените и хиксовете по редовете.
      var st = t("button", "pk-360");
      ((st.type = "button"),
        (st.innerHTML = '<span aria-hidden="true">От мястото ↗</span>'),
        st.setAttribute("aria-label", (window.SeatMap?.mode === "2d" ? "Изглед от мястото: " : "3D изглед от ") + l.sector + ", " + l.seat),
        l.pano
          ? (st.addEventListener("click",function(){if(typeof n.on360 === "function")n.on360(l.pano);}),
            (st.title = window.SeatMap?.mode === "2d" ? "Вижте изгледа от това място" : "Вижте сцената от това място · 3D ориентир"))
          : (st.classList.add("is-off"), (st.tabIndex = -1), st.setAttribute("aria-hidden", "true")),
        u.appendChild(st),
        u.appendChild(t("span", "pk-price", O(l.eur))));
      var d = t("button", "pk-x");
      ((d.type = "button"),
        d.setAttribute("aria-label", "Премахнете " + l.sector + ", " + l.seat),
        (d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'),
        d.addEventListener("click", function () {
          typeof n.onRemove == "function" && n.onRemove(l.mk);
        }),
        u.appendChild(d),
        o.appendChild(u));
    });
    var v = t("div", "pk-total");
    // Масата е един ред, но с всичките си места (билети) - затова броят идва отвън, а не от
    // дължината на списъка.
    var br = typeof n.count == "number" ? n.count : e.length;
    v.appendChild(t("span", "pk-total-k", br + (br === 1 ? " билет" : " билета")));
    v.appendChild(t("span", "pk-total-v", O(n.total)));
    // Списъкът и общата сума са едно тяло, за да не се разпада картата на две.
    // „Купи билети" стои под общата сума: купува се цялата поръчка, а не
    // мястото, което е пипнато последно.
    var kb = t("button", "btn-buy", "Купете билети");
    ((kb.type = "button"),
      kb.addEventListener("click", function () {
        typeof n.onBuy == "function"
          ? n.onBuy()
          : typeof window.__onBuy == "function" && window.__onBuy();
      }));
    var ft = t("div", "pk-foot");
    ft.appendChild(kb);
    var b = t("div", "pk-card");
    (b.appendChild(o), b.appendChild(v), b.appendChild(ft), i.appendChild(b));
    // На широк екран редовете се търкалят вътре в количката. Новият билет
    // влиза най-отдолу, затова списъкът се превърта до него - иначе кликът
    // изглежда сякаш не е свършил нищо.
    if (e.length > pkN) {
      ((pkPin = !0),
        ["wheel", "pointerdown", "touchstart", "keydown"].forEach(function (z) {
          o.addEventListener(
            z,
            function () {
              pkPin = !1;
            },
            { passive: !0 },
          );
        }),
        o.scrollHeight > o.clientHeight && (o.scrollTop = o.scrollHeight),
        pkRo && (pkRo.disconnect(), pkRo.observe(o)));
    } else pkRo && pkRo.disconnect();
    pkN = e.length;
    if (focusAct) {
      var fb = i.querySelector('[data-act="' + focusAct + '"]');
      fb || (fb = i.querySelector('[data-act="plus"]'));
      fb && fb.focus({ preventScroll: true });
    }
  }
  function xe(e, n) {
    ((I = e || null), (J = n || null), N && U(N, H), I && le());
  }
  function de(e) {
    var n = document.getElementById("seatview");
    if (!n) return;
    // Без аргумент панелът се връща в начално състояние, вместо да показва
    // празна карта със "Сектор -".
    if (e === null) {
      ((D = null), le());
      n.innerHTML =
        '<div class="sv-empty"><div class="sv-empty-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/>' +
        '<path d="M4 11a2 2 0 0 1 2 2v1h12v-1a2 2 0 0 1 4 0v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z"/>' +
        '<path d="M6 19v2M18 19v2"/></svg></div>' +
        '<p class="sv-empty-title">Изберете места</p>' +
        '<p class="sv-empty-text">Натиснете място върху схемата, за да видите изгледа от него и цената.</p></div>';
      return;
    }
    var i = e === D;
    ((e = e || {}), (D = e), !i && le());
    var a = e.seatLabel != null && e.seatLabel !== "",
      St = e.name != null ? String(e.name) : "-",
      Tt = /^(Сектор|Блок|Ложа|Оркестрина)(\s|$)/i.test(St) ? St : "Сектор " + St,
      Pt = e.title ? String(e.title) : a ? "Място " + e.seatLabel : Tt,
      r = e.title ? String(e.title) : a ? "място " + e.seatLabel : Tt.toLowerCase();
    // На телефон черната кутия "няма снимка" изяждаше четвърт екран и
    // изтласкваше офертите под ръба - маркираме случая, за да се скрие.
    // Първото показване влиза със стъпало, смяната на място - не: панелът
    // вече е там и стъпалото само го бави при бързо избиране.
    (n.classList.toggle("is-swap", !!n.querySelector(".sv-body")),
      n.classList.toggle("is-nophoto", !e.photo),
      (n.textContent = ""));
    var o = t("div", "sv-media");
    function l() {
      o.textContent = "";
      var b = t("div", "sv-nophoto");
      ((b.innerHTML = be), b.appendChild(t("span", null, "Няма снимка от " + r)), o.appendChild(b));
    }
    if (e.photo) {
      var u = document.createElement("img");
      ((u.className = "sv-photo"),
        (u.alt = "Изглед от " + r),
        u.addEventListener("error", l),
        (u.src = e.photo),
        o.appendChild(u),
        e.pano && o.appendChild(t("span", "sv-badge", "360°")));
    } else l();
    n.appendChild(o);
    var c = t("div", "sv-body"),
      d = t("div", "sv-top"),
      p = t("div", "sv-names");
    (p.appendChild(t("span", "sv-kicker", window.SeatMap?.mode === "2d" ? "На схемата" : "Изглед от")),
      p.appendChild(t("h3", "sv-name", Pt)),
      e.subtitle && p.appendChild(t("p", "sv-sub", String(e.subtitle))),
      d.appendChild(p));
    var v = !1,
      s;
    a
      ? P && typeof e.eurAll == "number"
        ? ((s = e.eurAll), (v = !0))
        : (s = e.eur)
      : P && typeof e.priceFromAll == "number"
        ? ((s = e.priceFromAll), (v = !0))
        : typeof e.priceFrom == "number"
          ? (s = e.priceFrom)
          : (s = e.eur);
    var x = !a && (typeof e.priceFrom == "number" || (P && typeof e.priceFromAll == "number")),
      f = t("div", "sv-price");
    if (
      (typeof s == "number" &&
        (x && f.appendChild(t("span", "sv-from", "от ")), f.appendChild(t("span", "sv-amount", O(s)))),
      d.appendChild(f),
      c.appendChild(d),
      // бележката за таксите не се показва - демото е без такси
      e.bucketLabel)
    ) {
      var C = t("div", "sv-meta");
      (C.appendChild(ae(e.bucketLabel, e.tier, "sv-pill")),
        C.appendChild(t("span", "sv-meta-note", e.priceNote || "цена за 1 билет")),
        c.appendChild(C));
    }
    if (e.note) {
      var xt = t("div", "sv-note");
      (xt.appendChild(t("span", "sv-note-icon", "!")),
        xt.appendChild(t("span", null, String(e.note))),
        c.appendChild(xt));
    }
    var Bq = t("button", "btn-buy", "Купете билети");
    ((Bq.type = "button"),
      Bq.addEventListener("click", function () {
        typeof window.__onBuy == "function" && window.__onBuy();
      }));
    var E = t("button", "btn-360");
    if (((E.type = "button"), (E.innerHTML = ye), E.appendChild(document.createTextNode("Гледка от мястото")), e.pano)) {
      var w = e.pano;
      E.addEventListener("click", function () {
        typeof window.__on360 == "function" && window.__on360(w);
      });
    } else ((E.disabled = !0), (E.title = "360° изглед не е наличен за " + r));
    (c.appendChild(E), c.appendChild(Bq), n.appendChild(c));
  }
  function Le(e, n) {
    n = n || {};
    // active: категориите, които вече са в сила. Отварящата стъпка ги задава и
    // без тях лентата се прерисуваше на „Всички", докато филтърът работеше.
    var i = typeof n.onChange == "function" ? n.onChange : function () {},
      Ct = Array.isArray(n.active) ? n.active.map(Number) : [],
      a = document.getElementById("filters");
    if (!a) return;
    var r = (e && e.tiers) || [];
    ((G = new Map()),
      r.forEach(function (v) {
        G.set(v.tier, v);
      }),
      (a.textContent = ""));
    var o = t("div", "filters-head");
    (o.appendChild(t("h2", null, "Ценова категория")), a.appendChild(o));
    var l = t("div", "chip-row");
    (l.setAttribute("role", "group"), l.setAttribute("aria-label", "Филтър по ценова категория"));
    var u = t("button", "chip chip-all", "Всички");
    ((u.type = "button"), u.classList.toggle("is-active", !Ct.length), l.appendChild(u));
    var c = [];
    r.forEach(function (v) {
      var s = t("button", "chip", v.label);
      ((s.type = "button"),
        (s.style.background = v.color),
        (s.style.color = j[v.tier] || "#1a1a22"),
        // Активният чип свети в пълния си цвят - там бялото не се чете
        // (40 € даваше 1.29:1). Мастилото пътува като променлива, за да го
        // вземе стилът само в активно състояние.
        s.style.setProperty("--chip-ink", j[v.tier] || "#1a1a22"),
        (s.dataset.tier = String(v.tier)),
        Ct.indexOf(Number(v.tier)) !== -1 && s.classList.add("is-active"),
        c.push(s),
        l.appendChild(s));
    });
    function d() {
      var v = c.some(function (s) {
        return s.classList.contains("is-active");
      });
      u.classList.toggle("is-active", !v);
    }
    function p() {
      var v = c
        .filter(function (s) {
          return s.classList.contains("is-active");
        })
        .map(function (s) {
          return Number(s.dataset.tier);
        });
      i(v.length ? v : null);
    }
    (u.addEventListener("click", function () {
      (c.forEach(function (v) {
        v.classList.remove("is-active");
      }),
        u.classList.add("is-active"),
        p());
    }),
      c.forEach(function (v) {
        v.addEventListener("click", function () {
          (v.classList.toggle("is-active"), d(), p());
        });
      }),
      a.appendChild(l));
  }
  function Se(e) {
    e = e || {};
    var n = typeof e.onFind == "function" ? e.onFind : function () {},
      i = document.getElementById("party");
    if (!i) return;
    i.textContent = "";
    function a(s) {
      return ((s = Math.round(Number(s))), isFinite(s) || (s = 1), Math.min(10, Math.max(1, s)));
    }
    var r = t("div", "party-control"),
      o = "party-input",
      l = t("label", "party-label", "Брой места");
    (l.setAttribute("for", o), r.appendChild(l));
    var u = t("div", "party-row"),
      c = t("button", "party-step party-step-minus", "−");
    ((c.type = "button"), c.setAttribute("aria-label", "Намали броя места"));
    var d = document.createElement("input");
    ((d.type = "number"),
      (d.id = o),
      (d.className = "party-input"),
      (d.min = "1"),
      (d.max = "10"),
      (d.step = "1"),
      (d.value = "2"),
      (d.inputMode = "numeric"));
    var p = t("button", "party-step party-step-plus", "+");
    ((p.type = "button"),
      p.setAttribute("aria-label", "Увеличи броя места"),
      c.addEventListener("click", function () {
        d.value = String(a(Number(d.value) - 1));
      }),
      p.addEventListener("click", function () {
        d.value = String(a(Number(d.value) + 1));
      }),
      d.addEventListener("change", function () {
        d.value = String(a(d.value));
      }),
      u.appendChild(c),
      u.appendChild(d),
      u.appendChild(p),
      r.appendChild(u));
    var v = t("button", "party-find-btn", "Намерете места");
    ((v.type = "button"),
      v.addEventListener("click", function () {
        n(a(d.value));
      }),
      r.appendChild(v),
      i.appendChild(r));
  }
  function Me(e) {
    var n = G.get(e);
    return n ? n.color : K[e] || "#ececf3";
  }
  function ke(e) {
    return j[e] || "#1a1a22";
  }
  function Ae(e) {
    var n = G.get(e);
    return n ? n.label : "Категория " + e;
  }
  function oe(e) {
    var n = t("span", "pill rec-pill", Ae(e));
    return ((n.style.background = Me(e)), (n.style.color = ke(e)), n);
  }
  function Fe(e) {
    var n = [];
    ((e.seats || []).forEach(function (o) {
      typeof o.tier == "number" && n.indexOf(o.tier) === -1 && n.push(o.tier);
    }),
      n.length ||
        (typeof e.minTier == "number" && n.push(e.minTier),
        typeof e.maxTier == "number" && e.maxTier !== e.minTier && n.push(e.maxTier)),
      n.sort(function (o, l) {
        return o - l;
      }));
    var i = t("span", "rec-tier-pills");
    if (!n.length) return i;
    var a = n[0],
      r = n[n.length - 1];
    return (
      i.appendChild(oe(a)),
      r !== a && (i.appendChild(t("span", "rec-tier-sep", "-")), i.appendChild(oe(r))),
      i.appendChild(t("span", "rec-tier-per", "/ място")),
      i
    );
  }
  function Ie(e) {
    if (typeof e != "number" || !isFinite(e)) return "-";
    var n = Math.round(Math.max(0, Math.min(1, e)) * 100);
    return "★ " + n + "%";
  }
  // token на сектора -> човешко име ("blok-8" -> "Блок 8")
  var Le2 = new Map();
  function Ct(e) {
    var n = Le2.get(String(e));
    if (!n) return "Сектор " + e;
    return /^(Сектор|Блок|Ложа|Оркестрина)(\s|$)/i.test(n) ? n : "Сектор " + n;
  }
  // Номерата в реда невинаги растат, затова се сортират; ако не са
  // последователни, се изброяват, за да не изглежда като повече места.
  function Et(e) {
    var n = (e || [])
      .map(function (i) {
        return i && i.t;
      })
      .filter(function (i) {
        return i != null;
      })
      .sort(function (i, a) {
        return i - a;
      });
    return n.length
      ? n.length === 1
        ? "място " + n[0]
        : n[n.length - 1] - n[0] === n.length - 1
          ? "места " + n[0] + "-" + n[n.length - 1]
          : "места " + n.join(", ")
      : "";
  }
  function Be(e, n, i, a, xt) {
    var r = t("button", "rec-card" + (xt ? " " + xt.cls : ""));
    ((r.type = "button"), (r.dataset.idx = String(n)));
    var o = e.seats || [],
      l =
        e.mks ||
        o.map(function (f) {
          return f.mk;
        });
    l.some(function (f) {
      return ue(f);
    }) && (r.classList.add("has-badge"), r.appendChild(t("span", "badge-viewed", "Разгледано")));
    if (xt) {
      var Ft = t("span", "rec-deal " + xt.cls);
      (Ft.appendChild(t("span", "rec-deal-icon", xt.icon)),
        Ft.appendChild(t("span", null, xt.label)),
        r.appendChild(Ft));
    }
    var u = t("div", "rec-card-top");
    u.appendChild(t("span", "rec-card-title", Ct(e.section) + ", ред " + e.row));
    r.appendChild(u);
    var d = t("div", "rec-card-mid"),
      p = o.length,
      v = p === 1 ? "1 място" : p + " места";
    if (p >= 1) {
      var s = Et(o);
      s && (v += " · " + s);
    }
    (d.appendChild(t("span", "rec-card-seats", v)), d.appendChild(Fe(e)), r.appendChild(d));
    var x = t("div", "rec-card-bottom");
    return (
      x.appendChild(
        (function () {
          var q = t("span", "rec-card-sum");
          (q.appendChild(t("span", "rec-card-avg", "общо")), q.appendChild(t("span", "rec-card-total", O(e.totalEur))));
          return q;
        })(),
      ),
      r.appendChild(x),
      r.addEventListener("mouseenter", function () {
        i(l);
      }),
      r.addEventListener("mouseleave", function () {
        i(null);
      }),
      r.addEventListener("focus", function () {
        i(l);
      }),
      r.addEventListener("blur", function () {
        i(null);
      }),
      r.addEventListener("click", function () {
        a(e);
      }),
      r
    );
  }
  // Кой вариант с какво се откроява. Всяка значка се дава само веднъж и само
  // ако наистина води в своята категория, иначе престава да значи нещо.
  function vt(e) {
    var n = {};
    if (!e.length) return n;
    var i = 0,
      a = 0,
      r = 0;
    (e.forEach(function (u, c) {
      (e[i].score < u.score && (i = c),
        (u.totalEur < e[a].totalEur || (u.totalEur === e[a].totalEur && u.view > e[a].view)) && (a = c),
        u.view > e[r].view && (r = c));
    }),
      (n[i] = { label: "Топ избор", cls: "is-top", icon: "🔥" }));
    var o = e[a].totalEur,
      l = e.some(function (u) {
        return u.totalEur > o;
      });
    n[a] || !l || (n[a] = { label: "Най-евтино", cls: "is-cheap", icon: "💰" });
    var s = e[r].view,
      d = e.some(function (u) {
        return u.view < s;
      });
    return (n[r] || !d || (n[r] = { label: "Най-добър изглед", cls: "is-view", icon: "👁" }), n);
  }
  var wt = !0;
  function pe(e, n) {
    n = n || {};
    var i = typeof n.onHover == "function" ? n.onHover : function () {},
      a = typeof n.onSelect == "function" ? n.onSelect : function () {},
      r = document.getElementById("recs");
    if (r) {
      ((e = Array.isArray(e) ? e : []), (z = e), ($ = n), (r.textContent = ""));
      var o = t("button", "recs-toggle" + (wt ? " is-open" : ""));
      ((o.type = "button"), o.setAttribute("aria-expanded", wt ? "true" : "false"));
      var f = t("span", "recs-toggle-label", "Препоръчани места");
      (o.appendChild(f),
        o.appendChild(t("span", "recs-count", e.length ? String(e.length) + " варианта" : "няма")),
        o.appendChild(t("span", "sectors-toggle-chevron")),
        r.appendChild(o));
      var c = t("div", "recs-list");
      if (
        (o.addEventListener("click", function () {
          ((wt = !wt),
            o.classList.toggle("is-open", wt),
            o.setAttribute("aria-expanded", wt ? "true" : "false"),
            (c.hidden = !wt));
        }),
        (c.hidden = !wt),
        !e.length)
      ) {
        var u = t("div", "recs-empty");
        (u.appendChild(t("p", "recs-empty-text", "Няма свободни съседни места. Разширете цената или намалете броя.")),
          c.appendChild(u),
          r.appendChild(c));
        return;
      }
      var p = vt(e);
      (e.forEach(function (d, v) {
        c.appendChild(Be(d, v, i, a, p[v]));
      }),
        r.appendChild(c));
    }
  }
  function Ne(e) {
    ((P = !!e), N && U(N, H), D && de(D));
  }
  function Oe() {
    try {
      var e = window.localStorage.getItem(ee);
      if (!e) return [];
      var n = JSON.parse(e);
      return Array.isArray(n)
        ? n.filter(function (i) {
            return i && i.mk != null;
          })
        : [];
    } catch {
      return [];
    }
  }
  function Pe() {
    try {
      window.localStorage.setItem(ee, JSON.stringify(F));
    } catch {}
  }
  function ue(e) {
    if (e == null) return !1;
    for (var n = 0; n < F.length; n++) if (F[n].mk === e) return !0;
    return !1;
  }
  function Ve(e) {
    !e ||
      e.mk == null ||
      ((F = F.filter(function (n) {
        return n.mk !== e.mk;
      })),
      F.unshift({
        mk: e.mk,
        label: e.label != null ? String(e.label) : String(e.mk),
        priceText: e.priceText != null ? String(e.priceText) : "",
        ts: Date.now(),
      }),
      F.length > ne && (F.length = ne),
      Pe(),
      ie && ce(),
      N && U(N, H),
      z && pe(z, $));
  }
  function ce() {
    var e = document.getElementById("viewedlist");
    if (e) {
      e.textContent = "";
      var n = t("div", "viewedlist-head");
      if ((n.appendChild(t("h2", null, "Наскоро разгледани")), e.appendChild(n), !F.length)) {
        e.appendChild(t("p", "viewedlist-empty", "Все още нищо разгледано."));
        return;
      }
      var i = t("div", "viewedlist-items");
      (F.forEach(function (a) {
        var r = t("button", "viewedlist-row");
        ((r.type = "button"),
          r.appendChild(t("span", "vl-label", a.label)),
          a.priceText && r.appendChild(t("span", "vl-price", a.priceText)),
          r.addEventListener("click", function () {
            te(a.mk);
          }),
          i.appendChild(r));
      }),
        e.appendChild(i));
    }
  }
  function Te(e) {
    ((te = typeof e == "function" ? e : function () {}), (ie = !0), ce());
  }
  function Re(e) {
    var n = document.getElementById("viewedlist");
    n && n.classList.toggle("is-open", !!e);
  }
  function qe() {
    if (V) {
      var e = V;
      ((V = null), e());
    }
  }
  function ve(e, n) {
    qe();
    var i = t("div", "popover-backdrop"),
      a = t("div", "popover");
    (document.body.appendChild(i), document.body.appendChild(a));
    var closing = !1;
    function r() {
      if (closing) return;
      ((closing = !0),
        document.removeEventListener("keydown", o, !0),
        i.parentNode && i.parentNode.removeChild(i),
        V === r && (V = null));
      // Списъкът си отива с движение, но вече не приема натискане: иначе
      // изчезващият слой хваща клика, предназначен за това под него.
      ((a.style.pointerEvents = "none"), a.removeAttribute("data-open"));
      setTimeout(function () {
        a.parentNode && a.parentNode.removeChild(a);
      }, 130);
    }
    function o(v) {
      v.key === "Escape" && r();
    }
    (i.addEventListener("click", r), document.addEventListener("keydown", o, !0), n(a, r));
    var l = e.getBoundingClientRect(),
      c = l.left,
      d = a.offsetWidth || 280,
      w = a.offsetHeight || 220,
      p = window.innerWidth || document.documentElement.clientWidth,
      g = window.innerHeight || document.documentElement.clientHeight;
    c + d > p - 12 && (c = Math.max(12, p - d - 12));
    // На телефон хапчетата стоят най-долу: списък, отворен надолу, излиза извън
    // екрана. Щом отдолу няма място, той се обръща НАД бутона.
    var below = l.bottom + 8,
      up = below + w > g - 12 && l.top - 8 - w >= 12,
      u = up ? l.top - 8 - w : Math.min(below, Math.max(12, g - 12 - w));
    ((a.style.top = u + "px"), (a.style.left = c + "px"));
    // Списъкът пораства ОТ хапчето: точката на разрастване ляга по центъра на
    // бутона и на ръба, който е долепен до него.
    a.style.transformOrigin =
      Math.round(Math.min(Math.max(l.left + l.width / 2 - c, 12), d - 12)) + "px " + (up ? "100%" : "0");
    return (
      requestAnimationFrame(function () {
        a.setAttribute("data-open", "");
      }),
      (V = r),
      r
    );
  }
  function se(e) {
    e = e || {};
    var n = e.dismissible !== !1,
      i = t("div", "modal-overlay" + (e.overlayClass ? " " + e.overlayClass : "")),
      a = t("div", "modal-card" + (e.cardClass ? " " + e.cardClass : ""));
    var previousFocus = document.activeElement;
    var background = Array.from(document.body.children).map(function (el) {
      return { el: el, inert: el.inert };
    });
    a.setAttribute("role", "dialog");
    a.setAttribute("aria-modal", "true");
    a.tabIndex = -1;
    (i.appendChild(a), document.body.appendChild(i));
    background.forEach(function (item) { item.el.inert = true; });
    var closed = false;
    function r() {
      if (closed) return;
      closed = true;
      (document.removeEventListener("keydown", o, !0), i.parentNode && i.parentNode.removeChild(i));
      background.forEach(function (item) { item.el.inert = item.inert; });
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    }
    // Затваряне встрани (сивото или Escape) не е „Напред": прозорецът си
    // отива, но който го е отворил, трябва да разбере, за да не остане без
    // отговор - например портата губеше избрания брой места.
    function zatvoreno() {
      (r(), typeof e.onDismiss == "function" && e.onDismiss());
    }
    function o(l) {
      if (n && l.key === "Escape") { l.preventDefault(); zatvoreno(); return; }
      if (l.key !== "Tab") return;
      var controls = Array.from(a.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')).filter(function (el) { return el.getClientRects().length; });
      var first = controls[0], last = controls[controls.length - 1];
      if (!first) { l.preventDefault(); a.focus(); }
      else if (l.shiftKey && (document.activeElement === first || document.activeElement === a)) { l.preventDefault(); last.focus(); }
      else if (!l.shiftKey && (document.activeElement === last || !a.contains(document.activeElement))) { l.preventDefault(); first.focus(); }
    }
    return (
      n &&
        i.addEventListener("click", function (l) {
          l.target === i && zatvoreno();
        }),
      document.addEventListener("keydown", o, !0),
      e.build(a, r),
      a.setAttribute("aria-label", (a.querySelector("h2") || a).textContent.trim().slice(0, 100)),
      a.focus({ preventScroll: true }),
      r
    );
  }
  function X(e, n) {
    var i = t("label", "toggle-row");
    i.appendChild(t("span", "toggle-label", e));
    var a = t("span", "toggle-switch"),
      r = document.createElement("input");
    ((r.type = "checkbox"),
      (r.checked = !!n),
      a.appendChild(r),
      a.appendChild(t("span", "toggle-slider")),
      i.appendChild(a));
    var o = [];
    return (
      r.addEventListener("change", function () {
        o.forEach(function (l) {
          l(r.checked);
        });
      }),
      {
        el: i,
        get: function () {
          return r.checked;
        },
        onChange: function (l) {
          o.push(l);
        },
      }
    );
  }
  function _e(e) {
    var n = e.min,
      i = e.max;
    i <= n && (i = n + 1);
    var a = e.step || 1,
      r = T(e.valMin, n, i),
      o = T(e.valMax, n, i);
    if (r > o) {
      var l = r;
      ((r = o), (o = l));
    }
    var u = t("div", "range-slider");
    u.appendChild(t("div", "range-track"));
    var c = t("div", "range-highlight");
    u.appendChild(c);
    var d = document.createElement("input");
    ((d.type = "range"), (d.className = "range-input range-input-min"));
    d.setAttribute("aria-label", "Минимална цена в евро");
    var p = document.createElement("input");
    p.setAttribute("aria-label", "Максимална цена в евро");
    ((p.type = "range"),
      (p.className = "range-input range-input-max"),
      [d, p].forEach(function (f) {
        ((f.min = String(n)), (f.max = String(i)), (f.step = String(a)));
      }),
      (d.value = String(r)),
      (p.value = String(o)),
      u.appendChild(d),
      u.appendChild(p));
    function v() {
      var f = Number(d.value),
        C = Number(p.value),
        E = i - n || 1,
        w = ((f - n) / E) * 100,
        b = ((C - n) / E) * 100;
      ((c.style.left = w + "%"), (c.style.right = 100 - b + "%"));
    }
    function s() {
      var f = Number(d.value),
        C = Number(p.value);
      (f > C && ((d.value = String(C)), (f = C)), v(), e.onInput && e.onInput(f, C));
    }
    function x() {
      var f = Number(d.value),
        C = Number(p.value);
      (C < f && ((p.value = String(f)), (C = f)), v(), e.onInput && e.onInput(f, C));
    }
    return (
      d.addEventListener("input", s),
      p.addEventListener("input", x),
      v(),
      {
        el: u,
        getValues: function () {
          return [Number(d.value), Number(p.value)];
        },
        setValues: function (f, C) {
          ((d.value = String(T(f, n, i))), (p.value = String(T(C, n, i))), v());
        },
        setBounds: function (f, C) {
          ((n = f), (i = C), i <= n && (i = n + 1), (d.min = p.min = String(n)), (d.max = p.max = String(i)), v());
        },
      }
    );
  }
  function fe(e, n, i, Ue) {
    var a = t("div", "price-section"),
      r = !!i,
      Ve = typeof Ue == "function" ? Ue : function () {};
    function o(w) {
      return w ? [L.minAll, L.maxAll] : [L.min, L.max];
    }
    var l = o(r),
      u = T(e ?? l[0], l[0], l[1]),
      c = T(n ?? l[1], l[0], l[1]),
      d = _e({
        min: l[0],
        max: l[1],
        valMin: u,
        valMax: c,
        step: 1,
        onInput: function (w, b) {
          ((s.value = String(w)), (f.value = String(b)), Ve(w, b, r));
        },
      });
    a.appendChild(d.el);
    var p = t("div", "price-inputs"),
      v = t("div", "price-input-wrap");
    v.appendChild(t("span", "price-input-label", "Минимум"));
    var s = document.createElement("input");
    s.setAttribute("aria-label", "Минимална цена в евро");
    ((s.type = "number"), (s.className = "price-input"), (s.value = String(u)), v.appendChild(s));
    var x = t("div", "price-input-wrap");
    x.appendChild(t("span", "price-input-label", "Максимум"));
    var f = document.createElement("input");
    f.setAttribute("aria-label", "Максимална цена в евро");
    ((f.type = "number"),
      (f.className = "price-input"),
      (f.value = String(c)),
      x.appendChild(f),
      p.appendChild(v),
      p.appendChild(x),
      a.appendChild(p));
    function C() {
      var w = d.getValues(),
        b = Number(s.value),
        S = Number(f.value);
      if ((isFinite(b) || (b = w[0]), isFinite(S) || (S = w[1]), b > S)) {
        var y = b;
        ((b = S), (S = y));
      }
      d.setValues(b, S);
      var bounded = d.getValues();
      (s.value = String(bounded[0]), f.value = String(bounded[1]), Ve(bounded[0], bounded[1], r));
    }
    (s.addEventListener("change", C), f.addEventListener("change", C));
    // Превключвателят за таксите е скрит от демото - цените са без такса,
    // за да са кръгли. Обектът остава, за да не се пипа логиката под него.
    var E = X("Цени с включени такси", r);
    return (
      E.onChange(function (w) {
        r = w;
        var b = o(r);
        (d.setBounds(b[0], b[1]),
          d.setValues(b[0], b[1]),
          (s.value = String(b[0])),
          (f.value = String(b[1])),
          Ve(b[0], b[1], r));
      }),
      {
        el: a,
        getValues: function () {
          var w = d.getValues();
          return { min: w[0], max: w[1], feesIncluded: r };
        },
        setRange: function (w, b) {
          (d.setValues(w, b), (s.value = String(w)), (f.value = String(b)));
        },
      }
    );
  }
  function R() {
    // Всяко хапче се проверява поотделно: „Билети" вече не се създава, а по
    // общата проверка отпадаха и „Цена", и „Разгледани".
    if (!h) return;
    (A.viewed && (A.viewed.classList.toggle("is-active", !!h.viewedOn), Re(!!h.viewedOn)));
    if (A.quantity) {
      var qn = h.quantity;
      ((A.quantity.textContent = qn ? "Брой · " + qn : "Брой"),
        A.quantity.classList.toggle("is-active", !!qn));
    }
    if (A.price) {
      var n = h.priceMin,
        i = h.priceMax,
        a = n != null && i != null && !(n <= L.min && i >= L.max) && !(n <= L.minAll && i >= L.maxAll);
      if (((A.price.textContent = a ? "Цена · " + (n === i ? Math.round(n) : Math.round(n) + "-" + Math.round(i)) + " €" : "Цена"), A.price.classList.toggle("is-active", a), A.tiers)) {
        var r = h.tiers && h.tiers.length ? h.tiers.length : 0,
          o = r > 0 && r < Ze.length;
        ((A.tiers.textContent = o ? (r === 1 ? "1 категория" : r + " категории") : "Категории"),
          A.tiers.classList.toggle("is-active", o));
      }
    }
  }
  function wt(e) {
    ve(e, function (n, i) {
      (n.classList.add("popover-tiers"), n.appendChild(t("div", "popover-title", "Ценова категория")));
      var a = Array.isArray(h && h.tiers) ? h.tiers.slice() : [],
        r = t("div", "gate-chips"),
        o = t("button", "gate-chip gate-chip-all", "Всички");
      ((o.type = "button"), r.appendChild(o));
      var l = [];
      (Ze.forEach(function (c) {
        var d = dt(c, a.indexOf(c.tier) !== -1);
        (l.push(d), r.appendChild(d));
      }),
        n.appendChild(r));
      function u() {
        (l.forEach(function (c) {
          var d = a.indexOf(Number(c.dataset.tier)) !== -1;
          (c.classList.toggle("is-active", d), c.setAttribute("aria-pressed", d ? "true" : "false"));
        }),
          o.classList.toggle("is-active", a.length === 0),
          h && (h.tiers = a.length ? a.slice() : null),
          R(),
          B.onTiersChange(a.length ? a.slice() : null));
      }
      (o.addEventListener("click", function () {
        ((a = []), u());
      }),
        l.forEach(function (c) {
          c.addEventListener("click", function () {
            var d = Number(c.dataset.tier),
              p = a.indexOf(d);
            (p === -1 ? a.push(d) : a.splice(p, 1),
              a.sort(function (v, s) {
                return v - s;
              }),
              u());
          });
        }));
    });
  }
  function Qe(e) {
    ve(e, function (n, i) {
      (n.classList.add("popover-qty"), n.appendChild(t("div", "popover-title", "Колко места търсите")));
      var a = t("div", "qty-grid"),
        r = h ? h.quantity : null;
      for (var v = 1; v <= 10; v++)
        (function (s) {
          var x = t("button", "qty-num", String(s));
          ((x.type = "button"),
            s === r && x.classList.add("is-active"),
            x.addEventListener("click", function () {
              (h && (h.quantity = s), R(), B.onQuantityPick(s), i());
            }),
            a.appendChild(x));
        })(v);
      n.appendChild(a);
      var o = t("button", "qty-option", "Без значение");
      ((o.type = "button"),
        r == null && o.classList.add("is-active"),
        o.addEventListener("click", function () {
          (h && (h.quantity = null), R(), B.onQuantityPick(null), i());
        }),
        n.appendChild(o));
    });
  }
  function We(e) {
    ve(e, function (n, i) {
      (n.classList.add("popover-price"), n.appendChild(t("div", "popover-title", "Цена на билет")));
      var a = h ? h.feesIncluded !== !1 : P,
        r = a ? [L.minAll, L.maxAll] : [L.min, L.max],
        o = h && h.priceMin != null ? h.priceMin : r[0],
        l = h && h.priceMax != null ? h.priceMax : r[1],
        u = fe(o, l, a);
      n.appendChild(u.el);
      var c = t("div", "popover-footer"),
        d = t("button", "btn-secondary", "Изчистете");
      d.type = "button";
      var p = t("button", "btn-primary", "Приложете");
      ((p.type = "button"),
        d.addEventListener("click", function () {
          (h && ((h.priceMin = null), (h.priceMax = null)),
            R(),
            B.onPriceApply({ min: null, max: null, feesIncluded: a }),
            i());
        }),
        p.addEventListener("click", function () {
          var v = u.getValues();
          (h && ((h.priceMin = v.min), (h.priceMax = v.max), (h.feesIncluded = v.feesIncluded)),
            R(),
            B.onPriceApply(v),
            i());
        }),
        c.appendChild(d),
        c.appendChild(p),
        n.appendChild(c));
    });
  }
  // Ценовият плъзгач, изнесен от балончето: панелът с категориите го носи най-
  // отгоре, за да е ЕДИН филтърът за цена, вместо два бутона за едно и също.
  // Прилагането остава тук, при B и h, вместо да се вади навън. Изчаква се
  // 180ms след последното движение - иначе схемата се прерисува на всеки
  // пиксел от дръжката.
  function mountPrice(host, onChange) {
    if (!host) return null;
    host.textContent = "";
    var fees = h ? h.feesIncluded !== !1 : P,
      bd = fees ? [L.minAll, L.maxAll] : [L.min, L.max],
      mn = h && h.priceMin != null ? h.priceMin : bd[0],
      mx = h && h.priceMax != null ? h.priceMax : bd[1],
      chas = null,
      w = fe(mn, mx, fees, function (lo, hi, f2) {
        (clearTimeout(chas),
          (chas = setTimeout(function () {
            var v = { min: lo, max: hi, feesIncluded: f2 };
            (h && ((h.priceMin = lo), (h.priceMax = hi), (h.feesIncluded = f2)),
              R(),
              B.onPriceApply(v),
              typeof onChange == "function" && onChange(v));
          }, 180)));
      });
    return (
      host.appendChild(w.el),
      {
        el: w.el,
        getValues: w.getValues,
        // Задава диапазона И го прилага наведнъж. Ползва се, когато не дръжката,
        // а ръчно избраните категории са казали какъв да бъде.
        setAndApply: function (lo, hi) {
          var v = w.getValues();
          (w.setRange(lo, hi),
            h && ((h.priceMin = lo), (h.priceMax = hi)),
            R(),
            B.onPriceApply({ min: lo, max: hi, feesIncluded: v.feesIncluded }));
        },
      }
    );
  }
  // Ценовият диапазон, който покриват дадени категории. Празен списък значи
  // „всички" и връща целите граници.
  function tierRange(tiers, fees) {
    var lo = 1 / 0,
      hi = -1 / 0,
      want = Array.isArray(tiers) && tiers.length ? new Set(tiers.map(Number)) : null;
    return (
      Ze.forEach(function (r) {
        if (want && !want.has(Number(r.tier))) return;
        var a = fees ? r.minAll : r.min,
          b = fees ? r.maxAll : r.max;
        (typeof a == "number" && isFinite(a) && (lo = Math.min(lo, a)),
          typeof b == "number" && isFinite(b) && (hi = Math.max(hi, b)));
      }),
      isFinite(lo) && isFinite(hi) ? { min: Math.round(lo), max: Math.round(hi) } : null
    );
  }
  // Кои категории се застъпват с даден ценови диапазон. Панелът пита това, за
  // да пали и гаси чиповете сам, докато дръжката се движи.
  function tiersInRange(mn, mx, fees) {
    var out = [];
    return (
      Ze.forEach(function (r) {
        var lo = fees ? r.minAll : r.min,
          hi = fees ? r.maxAll : r.max;
        (typeof lo == "number" &&
          typeof hi == "number" &&
          isFinite(lo) &&
          isFinite(hi) &&
          hi >= mn &&
          lo <= mx) &&
          out.push(Number(r.tier));
      }),
      out
    );
  }
  function Ge(e, n) {
    ((n = n || {}),
      (B = {
        onOpenAll: typeof n.onOpenAll == "function" ? n.onOpenAll : function () {},
        onViewedToggle: typeof n.onViewedToggle == "function" ? n.onViewedToggle : function () {},
        onOpenQuantity: typeof n.onOpenQuantity == "function" ? n.onOpenQuantity : function () {},
        onOpenPrice: typeof n.onOpenPrice == "function" ? n.onOpenPrice : function () {},
        onQuantityPick: typeof n.onQuantityPick == "function" ? n.onQuantityPick : function () {},
        onPriceApply: typeof n.onPriceApply == "function" ? n.onPriceApply : function () {},
        onTiersChange: typeof n.onTiersChange == "function" ? n.onTiersChange : function () {},
        onRecommend: typeof n.onRecommend == "function" ? n.onRecommend : function () {},
      }),
      (h = re(e || {})));
    var i = document.getElementById("filterbar");
    if (i) {
      ((i.textContent = ""), (A = {}));
      var a = t("button", "fb-pill fb-pill-icon");
      ((a.type = "button"),
        a.setAttribute("aria-label", "Всички филтри"),
        (a.innerHTML = Ce),
        a.addEventListener("click", function () {
          B.onOpenAll();
        }),
        i.appendChild(a),
        (A.gear = a));
      // „Брой" задава само ЦЕЛ - колко места търси човекът. Схемата не избира
      // нищо сама: числото се ползва за брояча „3 от 4" в панела.
      var q = t("button", "fb-pill fb-pill-qty", "Брой");
      ((q.type = "button"),
        q.addEventListener("click", function () {
          (B.onOpenQuantity(), Qe(q));
        }),
        i.appendChild(q),
        (A.quantity = q));
      var l = t("button", "fb-pill fb-pill-price");
      ((l.type = "button"),
        l.addEventListener("click", function () {
          (B.onOpenPrice(), We(l));
        }),
        i.appendChild(l),
        (A.price = l));
      // Ценовите категории стоят постоянно в сайдбара, не в изскачащо меню -
      // така се сортира с един клик, без да се търси бутон.
      var r = t("button", "fb-pill fb-pill-viewed", "Разгледани");
      ((r.type = "button"),
        r.addEventListener("click", function () {
          ((h.viewedOn = !h.viewedOn), R(), B.onViewedToggle(!!h.viewedOn));
        }),
        i.appendChild(r),
        (A.viewed = r));
      // Препоръката е по ЗАЯВКА, с бутон. Намерените места влизат направо в
      // избора, за да може да се махне всяко едно - не са отделен вид „оферта".
      var g = t("button", "fb-pill fb-pill-rec", document.querySelector(".pk-row") ? "Препоръчайте ми други места" : "Препоръчайте ми места");
      ((g.type = "button"),
        g.addEventListener("click", function () {
          B.onRecommend();
        }),
        i.appendChild(g),
        (A.rec = g),
        R());
    }
  }
  function He(e) {
    ((h = re(e || {})), R());
  }
  // ---- Двустъпков диалог при вход: 1) брой билети  2) ценови категории ----
  var Ze = [],
    ct = { min: 0, max: 500, minAll: 0, maxAll: 500 };
  function lt(e) {
    ((Ze = Array.isArray(e && e.tierList) ? e.tierList : []),
      e && e.bounds && (ct = e.bounds),
      e &&
        e.bounds &&
        ((L.min = e.bounds.min), (L.max = e.bounds.max), (L.minAll = e.bounds.minAll), (L.maxAll = e.bounds.maxAll)));
  }
  function ut(e, n) {
    var i = [],
      a = [];
    return (
      Ze.forEach(function (r) {
        var o = n ? r.minAll : r.min,
          l = n ? r.maxAll : r.max;
        (e.indexOf(r.tier) !== -1 || !e.length) && (i.push(o), a.push(l));
      }),
      i.length ? [Math.min.apply(null, i), Math.max.apply(null, a)] : null
    );
  }
  // Чипът е активен, когато лентата му е изцяло в обхвата на слайдера.
  function ft(e, n, i) {
    var a = [];
    return (
      Ze.forEach(function (r) {
        var o = i ? r.minAll : r.min,
          l = i ? r.maxAll : r.max;
        o >= e && l <= n && a.push(r.tier);
      }),
      a
    );
  }
  function dt(e, n) {
    var i = t("button", "gate-chip", e.label);
    return (
      (i.type = "button"),
      (i.dataset.tier = String(e.tier)),
      i.style.setProperty("--chip-color", e.color),
      i.setAttribute("aria-pressed", n ? "true" : "false"),
      n && i.classList.add("is-active"),
      i
    );
  }
  function pt(e) {
    e = e || {};
    var n = typeof e.onApply == "function" ? e.onApply : function () {},
      i = typeof e.onSkip == "function" ? e.onSkip : function () {},
      a = typeof e.count == "function" ? e.count : null,
      r = typeof e.quantity == "number" ? e.quantity : 2,
      o = e.feesIncluded !== !1,
      l = Array.isArray(e.tiers) ? e.tiers.slice() : [],
      u = o ? ct.minAll : ct.min,
      c = o ? ct.maxAll : ct.max,
      d = typeof e.priceMin == "number" ? e.priceMin : u,
      p = typeof e.priceMax == "number" ? e.priceMax : c,
      v = 1;
    se({
      dismissible: !0,
      overlayClass: "gate-overlay",
      cardClass: "gate-card",
      // Броят от първата стъпка важи и когато човек затвори портата встрани.
      onDismiss: function () {
        i(r);
      },
      build: function (s, x) {
        function f() {
          ((s.textContent = ""), v === 1 ? C() : E());
          s.setAttribute("aria-label", s.querySelector("h2").textContent);
          s.focus({ preventScroll: true });
        }
        function C() {
          (s.appendChild(t("p", "gate-step", "Стъпка 1 от 2")),
            s.appendChild(t("h2", "gate-title", "Колко билета търсите?")),
            s.appendChild(t("p", "gate-sub", "Изберете брой и цена. Ще намерим най-добрите свободни места заедно.")));
          for (var w = t("div", "gate-grid"), b = [], S = 1; S <= 10; S++)
            (function (m) {
              var k = t("button", "gate-num", String(m));
              ((k.type = "button"),
                k.setAttribute("aria-pressed", String(m === r)),
                m === r && k.classList.add("is-active"),
                k.addEventListener("click", function () {
                  ((r = m),
                    window.PartyMemory && window.PartyMemory.write(m),
                    b.forEach(function (q) {
                      q.classList.remove("is-active");
                      q.setAttribute("aria-pressed", "false");
                    }),
                    k.classList.add("is-active"), k.setAttribute("aria-pressed", "true"));
                }),
                b.push(k),
                w.appendChild(k));
            })(S);
          s.appendChild(w);
          var y = t("button", "gate-continue", "Напред");
          ((y.type = "button"),
            y.addEventListener("click", function () {
              ((v = 2), f());
            }),
            s.appendChild(y));
          var g = t("button", "gate-skip", "Избирам сам от схемата");
          ((g.type = "button"),
            g.addEventListener("click", function () {
              (x(), i(r));
            }),
            s.appendChild(g));
        }
        function E() {
          var w = t("button", "gate-back", "Назад");
          ((w.type = "button"),
            w.addEventListener("click", function () {
              ((v = 1), f());
            }),
            s.appendChild(w),
            s.appendChild(t("p", "gate-step", "Стъпка 2 от 2")),
            s.appendChild(t("h2", "gate-title", "Каква цена търсите?")),
            s.appendChild(
              t("p", "gate-sub", "Изберете една или няколко категории, или задайте точен диапазон със слайдера."),
            ));
          var b = t("div", "gate-chips"),
            S = t("button", "gate-chip gate-chip-all", "Всички цени");
          ((S.type = "button"), b.appendChild(S));
          var y = [];
          (Ze.forEach(function (M) {
            var Fe = dt(M, l.indexOf(M.tier) !== -1);
            (y.push(Fe), b.appendChild(Fe));
          }),
            s.appendChild(b));
          var g = fe(d, p, o, function (M, Fe, Xe) {
            ((d = M), (p = Fe), Xe !== void 0 && (o = Xe), (l = ft(M, Fe, o)), k(), q());
          });
          (s.appendChild(g.el), (d = g.getValues().min), (p = g.getValues().max));
          var m = t("div", "gate-warn");
          ((m.hidden = !0), s.appendChild(m));
          var k = function () {
              (y.forEach(function (M) {
                var Fe = l.indexOf(Number(M.dataset.tier)) !== -1;
                (M.classList.toggle("is-active", Fe), M.setAttribute("aria-pressed", Fe ? "true" : "false"));
              }),
                S.classList.toggle(
                  "is-active",
                  (l.length === 0 || l.length === Ze.length) &&
                    d <= (o ? ct.minAll : ct.min) &&
                    p >= (o ? ct.maxAll : ct.max),
                ));
            },
            q = function () {
              if (!a) return;
              var M = a({
                quantity: r,
                tiers: l.length ? l : null,
                priceMin: d,
                priceMax: p,
                feesIncluded: o,
              });
              ((_.disabled = M === 0),
                (_.textContent = M === 0 ? "Няма подходящи места" : "Изберете най-добрите " + r + " места"),
                (m.hidden = M !== 0),
                M === 0 &&
                  ((m.textContent = ""),
                  m.appendChild(t("span", "gate-warn-icon", "!")),
                  m.appendChild(
                    t(
                      "span",
                      null,
                      "Няма " +
                        r +
                        (r === 1 ? " свободно място" : " свободни съседни места") +
                        " при тези цени. Разширете диапазона или изберете още категории.",
                    ),
                  )));
            };
          var _ = t("button", "gate-continue", "Намерете ми места");
          ((_.type = "button"),
            S.addEventListener("click", function () {
              ((l = []),
                g.setRange(o ? ct.minAll : ct.min, o ? ct.maxAll : ct.max),
                (d = g.getValues().min),
                (p = g.getValues().max),
                k(),
                q());
            }),
            y.forEach(function (M) {
              M.addEventListener("click", function () {
                var Fe = Number(M.dataset.tier),
                  Xe = l.indexOf(Fe);
                (Xe === -1 ? l.push(Fe) : l.splice(Xe, 1),
                  l.sort(function (Ye, Je) {
                    return Ye - Je;
                  }));
                var Qe = ut(l, o);
                (Qe && (g.setRange(Qe[0], Qe[1]), (d = Qe[0]), (p = Qe[1])), k(), q());
              });
            }),
            _.addEventListener("click", function () {
              (x(),
                n({
                  quantity: r,
                  tiers: l.length && l.length < Ze.length ? l : null,
                  priceMin: d,
                  priceMax: p,
                  feesIncluded: o,
                }));
            }),
            s.appendChild(_),
            k(),
            q());
        }
        f();
      },
    });
  }
  function Ue(e, n) {
    n = n || {};
    var i = typeof n.onApply == "function" ? n.onApply : function () {},
      a = typeof n.onClear == "function" ? n.onClear : function () {};
    ((e = e || {}),
      se({
        dismissible: !0,
        overlayClass: "af-overlay",
        cardClass: "af-card",
        build: function (r, o) {
          var l = t("div", "af-head");
          l.appendChild(t("h2", null, "Още настройки"));
          var u = t("button", "af-close", "×");
          ((u.type = "button"),
            u.setAttribute("aria-label", "Затворете"),
            u.addEventListener("click", o),
            l.appendChild(u),
            r.appendChild(l));
          // Брой, цена и категории вече имат свои бутони в лентата - тук
          // остават само допълнителните настройки, за да няма два начина за
          // едно и също нещо.
          var c = t("div", "af-body");
          c.appendChild(t("p", "af-hint", "Брой билети, цена и категории се задават от бутоните в лентата."));
          var f = t("div", "af-options"),
            C = X("Показвай наскоро разгледани", !!e.viewedOn),
            E = X("Скрий местата с ограничена видимост", !!e.excludeObstructed),
            x = X("Цени с включени такси", e.feesIncluded !== !1);
          (f.appendChild(E.el), f.appendChild(C.el), c.appendChild(f), r.appendChild(c));
          var w = t("div", "af-footer"),
            b = t("button", "btn-secondary", "Изчисти филтрите");
          b.type = "button";
          var S = t("button", "btn-primary", "Готово");
          ((S.type = "button"),
            b.addEventListener("click", function () {
              (a(), o());
            }),
            S.addEventListener("click", function () {
              (i({ feesIncluded: x.get(), viewedOn: C.get(), excludeObstructed: E.get() }), o());
            }),
            w.appendChild(b),
            w.appendChild(S),
            r.appendChild(w));
        },
      }));
  }
  // ---- Сгъваем списък с всички сектори ----
  function gt() {
    var e = document.getElementById("sectors-toggle"),
      n = document.getElementById("listings");
    !e ||
      !n ||
      e.addEventListener("click", function () {
        var i = e.getAttribute("aria-expanded") === "true";
        (e.setAttribute("aria-expanded", i ? "false" : "true"), (n.hidden = i), e.classList.toggle("is-open", !i));
      });
  }
  function ht() {
    var e = document.getElementById("sectors-toggle"),
      n = document.getElementById("listings");
    !e || !n || n.hidden || ((n.hidden = !1), e.setAttribute("aria-expanded", "true"), e.classList.add("is-open"));
  }
  // ---- Плаващо съобщение над картата ----
  var yt = null,
    bt = null;
  function mt(e) {
    e = e || {};
    // Съобщението влиза в общия стълб под картата, за да застане под бутона
    // за връщане, а не върху него.
    var n = document.getElementById("mapstack") || document.querySelector(".map-pane") || document.body;
    (yt && yt.parentNode && yt.parentNode.removeChild(yt), bt && clearTimeout(bt));
    var i = t("div", "toast" + (e.kind ? " toast-" + e.kind : ""));
    i.setAttribute("role", "status");
    // „Тихият" тост само потвърждава (избрано място): без икона, без
    // кръстче, гасне сам след секунда и половина, не пречи на следващия тап.
    if (e.kind === "quiet") {
      (i.appendChild(t("span", "toast-text", e.text || "")), n.appendChild(i), (yt = i));
      bt = setTimeout(function () { i.parentNode && i.parentNode.removeChild(i); yt === i && (yt = null); }, 1800);
      return;
    }
    (i.appendChild(t("span", "toast-icon", e.kind === "warn" ? "!" : "i")),
      i.appendChild(t("span", "toast-text", e.text || "")));
    var a = t("button", "toast-close", "×");
    ((a.type = "button"), a.setAttribute("aria-label", "Затворете"));
    // Изходите от съобщението. Едно предупреждение може да носи два: първият е
    // препоръката, вторият е другият честен избор. Старият вид
    // (actionLabel + onAction) се чете като списък от един, за да не се пипа
    // всяко досегашно извикване.
    var ac = (
      Array.isArray(e.actions)
        ? e.actions
        : e.actionLabel && typeof e.onAction == "function"
          ? [{ label: e.actionLabel, onAction: e.onAction }]
          : []
    )
      .filter(function (x) {
        return x && x.label && typeof x.onAction == "function";
      })
      .slice(0, 2);
    ac.forEach(function (x, k) {
        var r = t("button", "toast-action" + (k ? " toast-action--vtori" : ""), x.label);
        ((r.type = "button"),
          r.addEventListener("click", function () {
            (x.onAction(), o());
          }),
          i.appendChild(r));
      });
    function o() {
      (bt && clearTimeout(bt), i.parentNode && i.parentNode.removeChild(i), yt === i && (yt = null));
    }
    (a.addEventListener("click", o),
      i.appendChild(a),
      n.appendChild(i),
      (yt = i),
      (bt = setTimeout(o, e.sticky ? 12e3 : 6e3)));
  }
  window.UI = {
    renderSidebar: U,
    setSelected: xe,
    showPicks: pk,
    showSeatView: de,
    renderFilters: Le,
    renderPartyControl: Se,
    renderRecommendations: pe,
    renderFilterBar: Ge,
    updateFilterBar: He,
    openGate: pt,
    setTierMeta: lt,
    initSectors: gt,
    openAllFilters: Ue,
    markViewed: Ve,
    renderViewed: Te,
    setFeesMode: Ne,
    notify: mt,
    mountPrice: mountPrice,
    tiersInRange: tiersInRange,
    tierRange: tierRange,
  };
})();
