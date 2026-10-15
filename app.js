(function () {
  "use strict";
  if (/^(127\.0\.0\.1|localhost)$/i.test(location.hostname)) {
    document.querySelectorAll("[data-local-href]").forEach((link) => {
      link.href = link.getAttribute("data-local-href");
    });
  }
  function H() {
    const o = window.VENUE;
    if (!o) {
      console.error("[app] VENUE missing");
      return;
    }
    if (!window.SeatMap || !window.UI) {
      console.error("[app] SeatMap/UI missing");
      return;
    }
    const R = document.getElementById("map"),
      a = (e, t) => e && typeof e[t] == "function",
      v = new Map(o.sections.features.map((e) => [e.properties.mk, e.properties])),
      M = new Map(o.sections.features.map((e) => [e.properties.mk.replace(/^s:/, ""), e.properties])),
      h = new Map(((o.seats && o.seats.features) || []).map((e) => [e.properties.mk, e.properties])),
      Q = new Map(((o.seats && o.seats.features) || []).map((e) => [e.properties.mk, e.geometry.coordinates])),
      L = new Map();
    ((o.adjacency && o.adjacency.runs) || []).forEach((e) => {
      const t = e
        .map((n) => (o.seats.features[n] || {}).properties && o.seats.features[n].properties.mk)
        .filter(Boolean);
      t.forEach((n) => L.set(n, t));
    });
    const V = new Map(
        o.sections.features.map((e) => [
          e.properties.token || e.properties.mk.replace(/^s:/, ""),
          e.properties.level || "",
        ]),
      ),
      E = o.tiers || [],
      m = (e) => (E[e] && E[e].label) || "";
    let S = 1 / 0,
      g = -1 / 0;
    (o.sections.features.forEach((e) => {
      [e.properties.priceFrom, e.properties.priceFromAll].forEach((t) => {
        typeof t == "number" && (t < S && (S = t), t > g && (g = t));
      });
    }),
      isFinite(S) || ((S = 0), (g = 1e3)));
    const i = {
      quantity: null,
      priceMin: null,
      priceMax: null,
      // Демото показва кръгли цени: таксата се начислява чак на плащането,
      // затова превключвателят е скрит и режимът е винаги „без такси".
      feesIncluded: !1,
      excludeObstructed: !1,
      viewedOn: !1,
      tiers: null,
    };
    let r = null,
      X = [],
      // Зададеният брой избира група около натиснатото място.
      // Отделните билети могат да се премахват и след групов избор.
      sel = [],
      // Масите са свой списък: масата не е място от схемата, а цяла покупка
      // за 8 души. Влиза в същия списък „Избрано" като един ред.
      selT = [],
      P = { min: S, max: g };
    const MAX_SELECTED_SEATS = 10;
    const selectionDraftKey = 'arena8888.selection.draft.v1';
    let selectionDraft = null;
    try { selectionDraft = JSON.parse(sessionStorage.getItem(selectionDraftKey) || 'null'); } catch (_) {}
    // Ценови граници по категория - хранят чиповете и слайдера в диалога.
    const ie = (function () {
      const e = new Map();
      (((o.seats && o.seats.features) || []).forEach((n) => {
        const s = n.properties,
          d = s.tier;
        if (typeof d != "number") return;
        let c = e.get(d);
        (c ||
          e.set(
            d,
            (c = {
              tier: d,
              min: 1 / 0,
              max: -1 / 0,
              minAll: 1 / 0,
              maxAll: -1 / 0,
            }),
          ),
          typeof s.eur == "number" && ((c.min = Math.min(c.min, s.eur)), (c.max = Math.max(c.max, s.eur))));
        const p = typeof s.eurAll == "number" ? s.eurAll : s.eur;
        typeof p == "number" && ((c.minAll = Math.min(c.minAll, p)), (c.maxAll = Math.max(c.maxAll, p)));
      }),
        (E || []).length || e.clear());
      return (E || [])
        .filter((n) => e.has(n.tier))
        .map((n) => Object.assign({ label: n.label, color: n.color }, e.get(n.tier)));
    })();
    const ee = ie.length
      ? {
          min: Math.min.apply(
            null,
            ie.map((e) => e.min),
          ),
          max: Math.max.apply(
            null,
            ie.map((e) => e.max),
          ),
          minAll: Math.min.apply(
            null,
            ie.map((e) => e.minAll),
          ),
          maxAll: Math.max.apply(
            null,
            ie.map((e) => e.maxAll),
          ),
        }
      : { min: S, max: g, minAll: S, maxAll: g };
    P = { min: ee.min, max: ee.maxAll };
    if (window.SeatFinder && o.adjacency)
      try {
        window.SeatFinder.init(o);
      } catch (e) {
        console.error("[app] finder init", e);
      }
    // Заглавието следва заредената зала, за да не пише НДК върху Арена 8888.
    (function () {
      const sub = document.querySelector(".event-sub"),
        ttl = document.querySelector(".event-title");
      (sub && o.meta && o.meta.venue && (sub.textContent = o.meta.venue + (o.meta.city ? ", " + o.meta.city : "")),
        ttl &&
          o.meta &&
          o.meta.event &&
          ((ttl.textContent = o.meta.event), (document.title = o.meta.event + " - " + o.meta.venue)));
    })();
    ((window.__map = window.SeatMap.init({
      container: R,
      venue: o,
      onSectionHover: F,
      onSectionClick: b,
      onSeatHover: function () {},
      onSeatClick: J,
      onTableClick: Ie2,
      onTablesZone: Ze2,
      onBackgroundClick: C,
    })),
      a(window.SeatMap, "setFeesMode") && window.SeatMap.setFeesMode(i.feesIncluded),
      a(window.UI, "setTierMeta") && window.UI.setTierMeta({ tierList: ie, bounds: ee }),
      window.UI.renderSidebar(o, { onHover: F, onSelect: b }),
      a(window.UI, "setFeesMode") && window.UI.setFeesMode(i.feesIncluded),
      a(window.UI, "initSectors") && window.UI.initSectors(),
      a(window.UI, "renderFilters") && window.UI.renderFilters(o, { onChange: N }),
      y(),
      // Схемата пита първо: колко места търси човекът и на каква цена. Отговорът
      // прилага филтрите и избира най-добрата свободна група заедно.
      new URLSearchParams(window.location.search).get("restore") !== "1" && !selectionDraft?.items?.length && a(window.UI, "openGate") &&
        window.UI.openGate({
          quantity: 2,
          feesIncluded: i.feesIncluded,
          tiers: null,
          count: redove,
          onApply: te,
          // „Избирам сам" или затворена встрани порта: броят от първата стъпка
          // остава. Иначе схемата падаше на единични места, а хапчето „Брой"
          // стоеше празно - човек избираше по едно място, без да иска.
          onSkip: function (q) {
            ((i.quantity = q || 2), partySync(), y());
          },
        }));
    // Избрана маса значи 8 души на едно място. „Друга" тогава трябва да върне
    // ДРУГА МАСА на сходна цена, а не осем единични места отзад.
    const tableSeen = new Set();
    function tablePrice(t) { return i.feesIncluded ? (t.eurAll != null ? t.eurAll : t.eur) : t.eur; }
    function otherTable() {
      const now = selT.map((mk) => tb2.get(mk)).filter(Boolean);
      if (!now.length) return false;
      const want = tablePrice(now[0]),
        taken = new Set(selT),
        pool = ((o.tables && o.tables.features) || [])
          .map((f) => f.properties)
          .filter((t) => t.sold !== !0 && !taken.has(t.mk) && tablePrice(t) != null);
      if (!pool.length) {
        warn("Няма друга свободна маса на тази цена.", "Купете тази", kupi);
        return !0;
      }
      // Сходна цена: подрежда се по разликата, не по разстояние - „същите пари,
      // друго място" е това, което човек иска, щом му е скъпо или далече.
      pool.sort((x, y) => Math.abs(tablePrice(x) - want) - Math.abs(tablePrice(y) - want));
      // Тази, на която човек е застанал сам, също е "видяна" - иначе вторият
      // натиск го връщаше на нея и се въртеше между две маси.
      selT.forEach((mk) => tableSeen.add(mk));
      let next = pool.find((t) => !tableSeen.has(t.mk));
      if (!next) {
        tableSeen.clear();
        next = pool[0];
      }
      (tableSeen.add(next.mk), selT.slice().forEach(Ie2), Ie2(next.mk));
      return !0;
    }
    // Един вход за „препоръчай пак": сам решава маса ли е избрано, или места.
    ((window.__recommendAgain = function () {
      if (selT.length && otherTable()) return;
      // Листът минава през самото хапче: така се пази и подредбата, и
      // предупрежденията, които двигателят показва при липса на алтернатива.
      const rec = document.querySelector(".fb-pill-rec");
      rec ? rec.click() : recommend(!0);
    }),
      (window.__tablesSelected = function () {
        return selT.length;
      }));
    // Портата питаше само за места, а масите са отделен продукт: 8 души,
    // купува се цяла. Който търси маса, нямаше откъде да разбере, че има.
    gateTables();
    // Цветното поле в легендата вече е бутон: води до свободните маси от своята
    // ценова категория и веднага предлага да се избере една.
    window.__tableLevelGo = function (lvl) {
      const free = ((o.tables && o.tables.features) || [])
        .map((f) => f.properties)
        .filter((t) => t.sold !== !0 && t.tableLevel === lvl);
      if (!free.length) {
        warn("Няма свободна маса в тази категория.", "Вижте всички маси", function () {
          a(window.SeatMap, "frameTables") && window.SeatMap.frameTables();
        });
        return;
      }
      a(window.SeatMap, "frameTableLevel") && window.SeatMap.frameTableLevel(lvl);
      const cena = Math.round(i.feesIncluded ? (free[0].eurAll != null ? free[0].eurAll : free[0].eur) : free[0].eur);
      // Колко са останали е бизнес информация - не се изписва. Стои цената,
      // с която работи целият екран.
      a(window.UI, "notify") &&
        window.UI.notify({
          text: "Маси по " + cena + " € за цялата маса, 8 души.",
          actionLabel: "Изберете маса",
          onAction: function () {
            Ie2(free[0].mk);
          },
        });
    };
    // „От мястото ↗" не се четеше като преглед. Текстът и окото се слагат
    // оттук, защото бутонът се ражда в общия двигател (ui.js) и промяна там
    // изчезва при следващото сливане с него.
    (function pregled() {
      const OKO =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.7-6.4 10-6.4 10 6.4 10 6.4-3.7 6.4-10 6.4S2 12 2 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
      function patch(root) {
        if (!root || !root.querySelectorAll) return;
        Array.prototype.forEach.call(root.querySelectorAll(".pk-360"), function (b) {
          if (b.dataset.pregled === "1") return;
          ((b.dataset.pregled = "1"), (b.innerHTML = OKO + '<span aria-hidden="true">' + (window.SeatMap.mode === '2d' ? 'На схемата ↗' : 'Преглед ↗') + '</span>'));
        });
      }
      const list = document.getElementById("picklist");
      if (!list) return;
      (new MutationObserver(function () {
        patch(list);
      }).observe(list, { childList: !0, subtree: !0 }),
        patch(list));
    })();
    // Предупреждение без изход е задънена улица: човек трябва сам да рови из
    // филтрите и да гадае. Затова всяко предупреждение носи бутон, който прави
    // поправката вместо него и го връща към купуването.
    function warn(text, label, act) {
      a(window.UI, "notify") &&
        window.UI.notify({ kind: "warn", text: text, actionLabel: label, onAction: act, sticky: !0 });
    }
    // Има ли изобщо стеснение, което да се разхлаби? Ако няма, „изчисти
    // филтрите" е бутон, който не прави нищо.
    function stesneno() {
      return !!(i.tiers && i.tiers.length) || i.priceMin != null || i.priceMax != null || i.excludeObstructed === !0;
    }
    function imaGrupa(k) {
      try {
        return (
          (window.SeatFinder.find({
            partySize: k,
            tiers: i.tiers || void 0,
            price: { key: i.feesIncluded ? "eurAll" : "eur", min: i.priceMin, max: i.priceMax },
            sortBy: "view",
            topK: 1,
            excludeObstructed: i.excludeObstructed,
          }) || []).length > 0
        );
      } catch (e) {
        return !1;
      }
    }
    // Няма толкова места заедно: вместо „сменете броя" бутонът сам сваля
    // бройката до най-голямата, която залата предлага, и я показва избрана.
    function pomalko(n) {
      for (let k = n - 1; k >= 1; k--)
        if (imaGrupa(k)) {
          ((i.quantity = k), partySync(), y(), recommend(!1));
          return;
        }
      a(window.UI, "notify") &&
        window.UI.notify({ kind: "warn", text: "В момента няма свободни места по тези филтри." });
    }
    // Бързото решение при „няма толкова заедно": първо разхлабва филтрите (ако
    // има какво), иначе намалява броя. И в двата случая веднага показва избор.
    function izhod(n) {
      return stesneno()
        ? { label: "Търсете без филтри", act: j }
        : { label: "По-малко места", act: function () { pomalko(n); } };
    }
    function kupi() {
      typeof window.__onBuy == "function" && window.__onBuy();
    }
    // Свободните места около едно място. Без филтри е физическият ред, тоест
    // това, което важи за правилото „не оставяй едно място само"; с филтри е
    // онова, което човекът вижда на схемата.
    function otsechka(mk, opt) {
      const sf = window.SeatFinder;
      return (a(sf, "segmentAround") && sf.segmentAround(mk, opt)) || [];
    }
    // Най-близката валидна група от N в същия свободен ред. Питаме самия
    // двигател през съседните места: така групата минава през същите филтри и
    // същото правило за самотния стол, вместо да ги пресмятаме втори път.
    function blizkaGrupa(mk, n, opt) {
      const fiz = otsechka(mk),
        at = fiz.indexOf(mk);
      if (at < 0) return null;
      for (let d = 1; d < fiz.length; d++)
        for (const k of [at - d, at + d]) {
          if (k < 0 || k >= fiz.length) continue;
          const g = window.SeatFinder.findAround(fiz[k], opt) || [];
          if (g.length) return g;
        }
      return null;
    }
    // „Тук няма N свободни места заедно" беше вярно само понякога. По-често
    // местата ги ИМА, но точно около пипнатото всяко разположение на N оставя
    // един свободен стол между заети, а такъв стол после не се продава. Тогава
    // банерът не бива да лъже - показва честните изходи и ги върши сам.
    function tqsnoMqsto(mk, n, opt) {
      const vidimi = otsechka(mk, opt),
        fiz = otsechka(mk);
      if (vidimi.length >= n && fiz.length > n) {
        const blizo = blizkaGrupa(mk, n, opt),
          izhodi = [];
        let text = "";
        if (blizo) {
          ((text = "Точно тук едно място остава само. Съседните " + n + " стават."),
            izhodi.push({
              label: "Вземете съседните " + n,
              onAction: function () {
                if (selectedTicketCount() - sel.length + blizo.length > MAX_SELECTED_SEATS) {
                  selectionLimitReached();
                  return;
                }
                ((sel = blizo.slice()), ne(blizo[0]));
              },
            }));
        } else {
          text = "Свободни са " + fiz.length + " места заедно. Вземете ли " + n + ", едно остава само.";
          selectedTicketCount() - sel.length + fiz.length <= MAX_SELECTED_SEATS &&
            izhodi.push({
              label: "Вземете " + fiz.length + " места",
              onAction: function () {
                ((i.quantity = fiz.length), partySync(), y(), (sel = fiz.slice()), ne(mk));
              },
            });
        }
        (izhodi.push({
          label: "Намерете други " + n,
          onAction: function () {
            recommend(!1);
          },
        }),
          a(window.UI, "notify") &&
            window.UI.notify({ kind: "warn", sticky: !0, text: text, actions: izhodi }));
        return;
      }
      // Местата ги има, но филтрите ги крият - друг проблем, друг изход.
      if (fiz.length >= n && vidimi.length < n) {
        warn("Местата тук са извън избраните филтри.", "Търсете без филтри", j);
        return;
      }
      const iz = izhod(n);
      warn("Тук няма " + n + " свободни места заедно.", iz.label, iz.act);
    }
    let gateQty = 0;
    function gateTables() {
      const free = ((o.tables && o.tables.features) || []).filter((f) => f.properties.sold !== !0);
      if (!free.length) return;
      const levels = (o.meta && o.meta.tableLevels) || [],
        price = (f) => (i.feesIncluded ? f.properties.eurAll : f.properties.eur),
        min = Math.min.apply(null, free.map(price).filter((v) => v != null)),
        perSeat = Math.min.apply(null, free.map((f) => f.properties.eurPerSeat).filter((v) => v != null));
      new MutationObserver(inject).observe(document.body, { childList: true, subtree: true });
      inject();
      function inject() {
        const card = document.querySelector(".gate-card");
        // Само на втората стъпка: тя пита за цена, там му е мястото.
        if (!card || !card.querySelector(".price-section") || card.querySelector(".gate-tables")) return;
        // Три реда обяснение на 320px изяждаха бутона под ръба. Изборът се
        // вижда, не се обяснява.
        const sub = card.querySelector(".gate-sub");
        if (sub) sub.textContent = "Изберете категория или диапазон.";
        // „Изберете най-добрите 8 места" звучи като заповед към човека, а
        // действието е обратното: схемата предлага. Двигателят пренаписва
        // надписа при всяка промяна на броя, затова се следи.
        const cta = card.querySelector(".gate-continue");
        if (cta) {
          const rename = () => {
            const m = cta.textContent.match(/^(?:Изберете най-добрите|Препоръчайте ми) (\d+) места$/);
            if (!m) return;
            gateQty = +m[1];
            // Само при РАЗЛИКА: иначе наблюдателят вижда собствения си запис и
            // се върти в кръг, а портата замръзва.
            const nov = "Препоръчайте ми " + m[1] + " места";
            if (cta.textContent !== nov) cta.textContent = nov;
          };
          new MutationObserver(rename).observe(cta, { childList: !0, characterData: !0, subtree: !0 });
          rename();
        }
        const box = document.createElement("div");
        box.className = "gate-tables";
        box.innerHTML =
          '<button type="button" class="gate-tables__btn">' +
          '<span class="gate-tables__ramp" aria-hidden="true">' +
          levels.map((l) => '<i style="background:' + l.color + '"></i>').join("") +
          '</span><span class="gate-tables__txt"><b>Или цяла маса за 8 души</b>' +
          "<i>от " + Math.round(min) + " € за маса, " + Math.round(perSeat) + " € на място</i></span>" +
          '<span class="gate-tables__go" aria-hidden="true">→</span></button>';
        card.insertBefore(box, card.querySelector(".gate-continue"));
        // На тесен екран картата пак може да не се събере. Тогава долният ръб
        // избледнява, за да се види, че под него има още - иначе картата
        // изглежда цяла, а бутонът остава невидим.
        const more = () => card.classList.toggle("has-more", card.scrollHeight - card.clientHeight - card.scrollTop > 6);
        card.addEventListener("scroll", more, { passive: true });
        new ResizeObserver(more).observe(card);
        more();
        box.querySelector("button").addEventListener("click", function () {
          // Излизането през масите пропускаше избрания брой и „препоръчай"
          // после връщаше ЕДНО място. Броят се пренася, а масата е за 8 души.
          ((i.quantity = gateQty || i.quantity || 8), partySync(), chipSync());
          const veil = card.closest(".modal-overlay");
          veil && veil.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          Ze2();
          a(window.SeatMap, "frameTables") && window.SeatMap.frameTables();
        });
      }
    }
    // Брой редове, в които групата може да седне заедно при дадените филтри.
    function redove(e) {
      if (!window.SeatFinder) return 0;
      e = e || {};
      try {
        const t = window.SeatFinder.find({
            partySize: Math.max(1, e.quantity || 1),
            tiers: e.tiers || void 0,
            price: {
              key: e.feesIncluded ? "eurAll" : "eur",
              min: e.priceMin,
              max: e.priceMax,
            },
            topK: 1e4,
          }),
          n = new Set();
        return (t.forEach((s) => n.add(String(s.section) + "|" + String(s.row))), n.size);
      } catch (t) {
        return (console.error("[app] count", t), 0);
      }
    }
    function te(e) {
      ((e = e || {}),
        "feesIncluded" in e && B(e.feesIncluded, !0),
        (i.tiers = e.tiers && e.tiers.length ? e.tiers : null),
        (i.priceMin = typeof e.priceMin == "number" ? e.priceMin : null),
        (i.priceMax = typeof e.priceMax == "number" ? e.priceMax : null),
        (i.quantity = e.quantity || null),
        a(window.SeatMap, "setTierFilter") && window.SeatMap.setTierFilter(i.tiers),
        a(window.SeatMap, "setPriceRange") && window.SeatMap.setPriceRange(i.priceMin, i.priceMax),
        window.UI.renderSidebar(o, { onHover: F, onSelect: b }),
        chipSync(),
        partySync(),
        y());
      recommend();
    }
    // „Брой места" не е само брояч: схемата свети само там, където толкова
    // души сядат заедно. Иначе човек избира 2 места, а картата продължава да
    // предлага единични - точно това не се връзваше.
    function partySync() {
      a(window.SeatMap, "setPartyFilter") && window.SeatMap.setPartyFilter(i.quantity || 0);
    }
    // Лентата с ценови категории се прерисува от състоянието: отварящата стъпка
    // и „Изчисти" сменят филтъра, без човек да е пипал самите чипове - иначе тя
    // показваше „Всички", докато схемата вече беше стеснена.
    function chipSync() {
      a(window.UI, "renderFilters") && window.UI.renderFilters(o, { onChange: N, active: i.tiers || [] });
    }
    function D() {
      return {
        quantity: i.quantity,
        viewedOn: i.viewedOn,
        priceMin: i.priceMin,
        priceMax: i.priceMax,
        feesIncluded: i.feesIncluded,
        extent: P,
      };
    }
    let recommendationKey = '', recommendationSeen = new Set();
    function recommend(other = false) {
            if (!window.SeatFinder) return;
            const n = Math.max(1, i.quantity || 1);
            let t = [];
            try {
              t =
                window.SeatFinder.find({
                  partySize: n,
                  tiers: i.tiers || void 0,
                  price: { key: i.feesIncluded ? "eurAll" : "eur", min: i.priceMin, max: i.priceMax },
                  sortBy: "view",
                  topK: 10000,
                  excludeObstructed: i.excludeObstructed,
                }) || [];
            } catch (d) {
              console.error("[app] recommend", d);
            }
            i.excludeObstructed && (t = t.filter((d) => d.seats.every((p) => !(h.get(p.mk) || {}).obstructed)));
            if (!t.length) {
              const iz = izhod(n);
              warn(
                "Няма " + n + (n === 1 ? " свободно място" : " свободни места заедно") + " по тези филтри.",
                iz.label,
                iz.act,
              );
              return;
            }
            const filterKey=JSON.stringify([n,i.tiers,i.priceMin,i.priceMax,i.feesIncluded,i.excludeObstructed]);
            if(filterKey!==recommendationKey || !other){recommendationSeen.clear();recommendationKey=filterKey;}
            const current=new Set(other?sel:[]);
            let alternatives=t.filter(group=>group.mks.every(mk=>!current.has(mk)));
            // „Други места" след ръчно избрана категория значи други в СЪЩАТА
            // категория, не в цялата зала: без ценови филтър групите от нейния
            // ред минават отпред, останалите остават като резерва.
            if(other && !i.tiers && sel.length){
              const tier=(h.get(sel[0])||{}).tier;
              if(tier!=null){const same=alternatives.filter(g=>g.seats.every(s=>(h.get(s.mk)||{}).tier===tier));
                alternatives=same.concat(alternatives.filter(g=>same.indexOf(g)<0));}
            }
            if(!alternatives.length){warn('Няма друга група от '+n+' места заедно. Текущият избор е запазен.','Купете тези',kupi);return;}
            let candidate=alternatives.find(group=>!recommendationSeen.has(group.mks.join('|')));
            if(!candidate){recommendationSeen.clear();candidate=alternatives[0];}
            recommendationSeen.add(candidate.mks.join('|'));
            ((selT = []),
              (sel = candidate.mks.slice(0, MAX_SELECTED_SEATS)),
              ne(sel[sel.length - 1]),
              a(window.SeatMap, "frameSeats") && window.SeatMap.frameSeats(sel.slice(), {}));

    }
    function y() {
      a(window.UI, "renderFilterBar") &&
        window.UI.renderFilterBar(D(), {
          onOpenAll: G,
          onViewedToggle: function (e) {
            ((i.viewedOn = !!e), a(window.UI, "renderViewed") && window.UI.renderViewed(z), y());
          },
          onOpenQuantity: function () {},
          onQuantityPick: function (e) {
            // При зададена цена броят обновява най-добрата група заедно.
            ((i.quantity = e || null), partySync(), y());
            if(i.quantity && (i.tiers || i.priceMax != null || i.priceMin != null)) recommend();
          },
          onOpenPrice: function () {},
          // „Препоръчай ми": търсачката попълва ИЗБОРА, не рисува отделни
          // предложения. Каквото намери, човекът вижда като свой избор и може
          // да махне всяко място поотделно.
          // И на десктоп: избрана маса значи „дай друга МАСА", не осем места отзад.
          onRecommend: function () {
            if (selT.length && otherTable()) return;
            recommend(!0);
          },
          onPriceApply: q,
          onTiersChange: N,
        });
    }
    function G() {
      a(window.UI, "openAllFilters") &&
        window.UI.openAllFilters(
          {
            quantity: i.quantity,
            priceMin: i.priceMin,
            priceMax: i.priceMax,
            feesIncluded: i.feesIncluded,
            viewedOn: i.viewedOn,
            excludeObstructed: i.excludeObstructed,
            extent: P,
          },
          {
            onApply: function (e) {
              _(e);
            },
            onClear: j,
          },
        );
    }
    function _(e) {
      ((e = e || {}),
        "feesIncluded" in e && B(e.feesIncluded),
        "excludeObstructed" in e &&
          ((i.excludeObstructed = !!e.excludeObstructed),
          a(window.SeatMap, "setObstructedHidden") && window.SeatMap.setObstructedHidden(i.excludeObstructed)),
        "viewedOn" in e && ((i.viewedOn = !!e.viewedOn), a(window.UI, "renderViewed") && window.UI.renderViewed(z)),
        ("priceMin" in e || "priceMax" in e) &&
          q({ min: e.priceMin, max: e.priceMax, feesIncluded: i.feesIncluded }, !0),
        "quantity" in e && e.quantity && ((i.quantity = e.quantity), partySync()),
        I());
    }
    function j() {
      ((i.priceMin = i.priceMax = null),
        (i.excludeObstructed = !1),
        (i.tiers = null),
        a(window.SeatMap, "setPriceRange") && window.SeatMap.setPriceRange(null, null),
        a(window.SeatMap, "setObstructedHidden") && window.SeatMap.setObstructedHidden(!1),
        a(window.SeatMap, "setTierFilter") && window.SeatMap.setTierFilter(null),
        chipSync(),
        I());
    }
    function q(e, t) {
      ((e = e || {}),
        (i.priceMin = typeof e.min == "number" ? e.min : null),
        (i.priceMax = typeof e.max == "number" ? e.max : null),
        "feesIncluded" in e && B(e.feesIncluded, !0),
        a(window.SeatMap, "setPriceRange") && window.SeatMap.setPriceRange(i.priceMin, i.priceMax),
        t || I());
      if(!t && i.quantity)recommend();
    }
    function B(e, t) {
      ((i.feesIncluded = !!e),
        a(window.SeatMap, "setFeesMode") && window.SeatMap.setFeesMode(i.feesIncluded),
        a(window.UI, "setFeesMode") && window.UI.setFeesMode(i.feesIncluded),
        t || window.UI.renderSidebar(o, { onHover: F, onSelect: b }));
    }
    function N(e) {
      ((i.tiers = e && e.length ? e : null),
        a(window.SeatMap, "setTierFilter") && window.SeatMap.setTierFilter(i.tiers),
        I());
      if(i.quantity)recommend();
    }
    function I() {
      y();
    }
    function F(e) {
      e ? window.SeatMap.highlight(e) : r ? window.SeatMap.highlight(r) : window.SeatMap.clearHighlight();
    }
    // Кои сектори изобщо имат какво да продадат. Едно минаване през местата,
    // запомнено - иначе всеки клик щеше да ги брои наново.
    let prd = null;
    function pr2(e) {
      if (!prd) {
        prd = new Set();
        h.forEach(function (q) {
          q && q.s != null && q.sold !== !0 && q.offsale !== !0 && prd.add("s:" + q.s);
        });
      }
      return prd.has(e);
    }
    function b(e) {
      const t = v.get(e);
      if (!t) return;
      // Празният сектор не заслужава пътуване на камерата: човек влизаше в
      // изцяло сиво поле и трябваше сам да се сети да се върне.
      if (t.offsale === !0 || !pr2(e)) {
        (a(window.UI, "notify") &&
          window.UI.notify({ text: "Сектор " + (t.name || String(e).replace(/^s:/, "")) + " не се продава за това събитие." }),
          // Маркировката се връща на сектора, който човекът разглежда - иначе
          // едно натискане встрани я гасеше и той губеше къде е бил.
          r ? window.SeatMap.highlight(r) : window.SeatMap.clearHighlight());
        return;
      }
      ((r = e),
        window.SeatMap.rotateToSection(e),
        window.SeatMap.highlight(e),
        a(window.SeatMap, "revealSection") && window.SeatMap.revealSection(t.mk),
        a(window.SeatMap, "clearSeatSelection") && window.SeatMap.clearSeatSelection(),
        window.UI.setSelected(e));
      // Секторът без панорама показва триизмерния изглед от централното си
      // място.
      const n = t.pano ? null : K(t.mk.replace(/^s:/, "")),
        // Картата на сектора е само за широк екран. На телефон тя вдигаше долния
        // лист точно когато човек се цели в място и покриваше половината схема -
        // там листът се разтяга чак когато място влезе в количката.
        shiroko = window.matchMedia("(min-width: 881px)").matches;
      (window.UI.showSeatView(shiroko ? (n ? Object.assign({}, t, { pano: "3d:" + n }) : t) : null),
        k(t.mk, "Сектор " + t.name, O(t)));
      window.dispatchEvent(new CustomEvent("arena:seat-picked", { detail: { count: sel.length } }));
    }
    function z(e) {
      b(e);
    }
    // Масата е една покупка за 8 души - показва се като цяла оферта.
    const tb2 = new Map(((o.tables && o.tables.features) || []).map((f) => [f.properties.mk, f.properties]));
    function selectedTicketCount() {
      return (
        sel.length +
        selT.reduce(function (count, mk) {
          return count + Number((tb2.get(mk) || {}).seats || 8);
        }, 0)
      );
    }
    function selectionLimitReached() {
      warn("Можете да изберете най-много 10 билета в една поръчка. Една маса е за 8 души.", "Продължете", kupi);
    }
    // Най-близкото свободно място в същата отсечка, което не оставя друго само.
    function drugoNablizo(mk) {
      const seg = otsechka(mk),
        at = seg.indexOf(mk);
      if (at < 0) return null;
      let nay = null,
        razst = 1 / 0;
      for (let k = 0; k < seg.length; k++) {
        if (seg[k] === mk || sel.indexOf(seg[k]) >= 0) continue;
        if (window.SeatFinder.leavesIsolatedSeat(sel.concat(seg[k]))) continue;
        const d = Math.abs(k - at);
        d < razst && ((razst = d), (nay = seg[k]));
      }
      return nay;
    }
    // Един свободен стол между заети места не се продава, затова изборът, който
    // го създава, се спира. Спирането обаче не бива да е задънена улица: има ли
    // наблизо място, което не осиротява никого, то се предлага направо.
    function validSeatSelection(next, mk) {
      if (!window.SeatFinder.leavesIsolatedSeat(next)) return true;
      const sasedno = mk ? drugoNablizo(mk) : null,
        izhodi = [];
      sasedno &&
        izhodi.push({
          label: "Вземете съседното",
          onAction: function () {
            if (selectedTicketCount() >= MAX_SELECTED_SEATS) {
              selectionLimitReached();
              return;
            }
            (sel.push(sasedno), ne(sasedno));
          },
        });
      (izhodi.push({
        label: sasedno ? "Намерете други" : "Намерете ми места",
        onAction: function () {
          recommend(!1);
        },
      }),
        a(window.UI, "notify") &&
          window.UI.notify({
            kind: "warn",
            sticky: !0,
            text: sasedno
              ? "Това място оставя съседното свободно само."
              : "Изборът оставя едно свободно място само.",
            actions: izhodi,
          }));
      return false;
    }
    // Първи клик върху масите показва целия блок като един сектор, вторият
    // избира конкретна маса.
    function Ze2() {
      const free = ((o.tables && o.tables.features) || []).filter((f) => f.properties.sold !== !0);
      if (!free.length) return;
      // Цената е тази, с която работи целият екран. „2041 €" идваше от
      // eurAll - такса, каквато истинският сайт не показва.
      const pr = free.map((f) => (i.feesIncluded ? f.properties.eurAll : f.properties.eur)).filter((v) => v != null),
        mn = Math.min.apply(null, pr);
      ((r = null), (X = []));
      (a(window.SeatMap, "clearSeatHighlights") && window.SeatMap.clearSeatHighlights(),
        a(window.SeatMap, "clearSeatSelection") && window.SeatMap.clearSeatSelection(),
        window.UI.setSelected(null, "Маси"),
        window.UI.showSeatView({
          name: "Маси",
          title: "Маси пред сцената",
          // Колко маси са свободни е бизнес информация - на схемата стои само
          // какво се предлага, не колко е останало.
          priceFrom: mn,
          priceFromAll: mn,
          tier: null,
          bucketLabel: null,
        }),
        a(window.UI, "notify") &&
          window.UI.notify({ text: "Изберете маса от блока - всяка маса се купува цяла, за 8 души." }),
        // Отворена карта в панела: долният лист трябва да разбере, за да се
        // вдигне и да скрие ценовите категории. Иначе те оставаха смачкани
        // между лентата отгоре и картата отдолу, видими наполовина.
        window.dispatchEvent(new CustomEvent("arena:seat-picked", { detail: { count: 0 } })));
    }
    function Ie2(e) {
      const t = tb2.get(e);
      if (!t) return;
      // Същото важи и за масите - продадената се обажда, вместо да мълчи.
      if (t.sold === !0) {
        a(window.UI, "notify") &&
          window.UI.notify({ text: (t.name || "Масата") + " вече е продадена." });
        return;
      }
      const at = selT.indexOf(e),
        beshe = at >= 0;
      if (!beshe && selectedTicketCount() + Number(t.seats || 8) > MAX_SELECTED_SEATS) {
        selectionLimitReached();
        return;
      }
      (beshe ? selT.splice(at, 1) : selT.push(e), (r = null), (X = []));
      (ne(beshe ? null : e),
        !beshe &&
          a(window.UI, "notify") &&
          window.UI.notify({
            // Цената в известието е същата като в картата: с такси само ако
            // човекът ги е включил. Иначе излизаше измислено число.
            text:
              t.name +
              ": " +
              (t.seats || 8) +
              " билета за " +
              Math.round(i.feesIncluded ? t.eurAll || t.eur : t.eur) +
              " €. Масата се купува цяла.",
          }),
        // Камерата отива при масата само при ПЪРВАТА избрана - иначе всеки
        // следващ избор разиграва изгледа.
        !beshe &&
          selT.length === 1 &&
          !sel.length &&
          a(window.SeatMap, "frameTable") &&
          window.SeatMap.frameTable(e));
    }
    const Z = () => typeof matchMedia == "function" && matchMedia("(max-width: 880px)").matches;
    // "blok-8" -> "Блок 8"; ако името вече започва с Блок/Ложа/Сектор, не се дублира
    const ke2 = (tok) => {
      const nm = (M.get(tok) || {}).name || tok;
      return /^(Сектор|Блок|Ложа|Оркестрина)(\s|$)/i.test(String(nm)) ? String(nm) : "Сектор " + nm;
    };
    // "места 12-14" ако номерата вървят последователно, иначе "места 12, 14".
    function re(e) {
      const t = e.map((s) => (h.get(s) || {}).t).filter((s) => s != null);
      if (!t.length) return "";
      if (t.length === 1) return "място " + t[0];
      const n = t.slice().sort((s, d) => s - d);
      return n[n.length - 1] - n[0] === n.length - 1
        ? "места " + n[0] + "-" + n[n.length - 1]
        : "места " + n.join(", ");
    }
    function ae(e, t, n, s) {
      const d = n.name || e.s,
        p = /^(Сектор|Блок|Ложа|Оркестрина)(\s|$)/i.test(String(d)) ? String(d) : "Сектор " + d;
      (a(window.SeatMap, "clearSeatSelection") && window.SeatMap.clearSeatSelection(),
        a(window.SeatMap, "clearSeatHighlights") && window.SeatMap.clearSeatHighlights(),
        window.UI.setSelected("s:" + e.s, "ред " + e.r + " · " + t),
        window.UI.showSeatView({
          name: d,
          title: p + ", ред " + e.r,
          note: t,
          photo: n.photo,
          pano: n.pano || "3d:" + e.mk,
          bucketLabel: m(e.tier),
          seatLabel: "ред " + e.r,
          eur: i.feesIncluded ? e.eurAll : e.eur,
          tier: e.tier,
        }),
        a(window.UI, "notify") && window.UI.notify(s));
    }
    function J(e) {
      const t = h.get(e);
      if (!t) return;
      // Продаденото място мълчеше напълно: човек го натиска, нищо не помръдва
      // и той пробва пак, вместо да разбере, че мястото е заето.
      if (t.sold === !0 || t.offsale === !0) {
        a(window.UI, "notify") &&
          window.UI.notify({ text: "Ред " + t.r + ", място " + t.t + " не е достъпно за избор." });
        return;
      }
      const at = sel.indexOf(e);
      // Без отворен сектор местата са точки: докосването по тях е докосване
      // по сектора и трябва да го отвори, не да търси група около случайно
      // улучена точка и да обяснява за „място, което остава само".
      if (at < 0 && !r && window.__map && window.__map.getZoom() < 6 && v.get("s:" + t.s)) {
        b("s:" + t.s);
        return;
      }
      // Второ докосване по избрано място при група: маха цялата група. Да
      // остане едно място от двойка не е избор, който някой прави нарочно.
      if (at >= 0 && i.quantity > 1 && sel.length > 1) {
        ((sel = []), ne(null));
        a(window.UI, "notify") && window.UI.notify({ kind: "quiet", text: "Изборът е махнат" });
        return;
      }
      if (at < 0 && i.quantity > 1) {
        const opt = {
          partySize: i.quantity,
          tiers: i.tiers,
          price: { key: i.feesIncluded ? "eurAll" : "eur", min: i.priceMin, max: i.priceMax },
          excludeObstructed: i.excludeObstructed,
        };
        const group = window.SeatFinder?.findAround(e, opt) || [];
        // Докосване до самата група я премества, вместо да я хвърля другаде
        // по реда: от прозорците с N места, които съдържат пипнатото, се
        // взима най-близкият до сегашния избор (общи места или най-малка
        // празнина). Улучено едно място встрани значи „тези до нас".
        if (group.length && sel.length) {
          const seg = otsechka(e, opt), at2 = seg.indexOf(e), n = i.quantity,
            izbrani = sel.map((mk) => seg.indexOf(mk)).filter((k) => k >= 0);
          let nay = null, razst = 1 / 0;
          if (izbrani.length)
            for (let s = Math.max(0, at2 - n + 1); s <= at2 && s + n <= seg.length; s++) {
              const w = seg.slice(s, s + n);
              let d = 1 / 0;
              for (let k = s; k < s + n; k++) for (const j of izbrani) d = Math.min(d, Math.abs(k - j));
              if (d < razst && !window.SeatFinder.leavesIsolatedSeat(w)) ((razst = d), (nay = w));
            }
          if (nay && razst <= 1) group.splice(0, group.length, ...nay);
        }
        if (!group.length) {
          // Празният отговор има три различни причини и трите казват различно
          // нещо на човека - затова тук не стои един общ надпис.
          tqsnoMqsto(e, i.quantity, opt);
          return;
        }
        if (selectedTicketCount() - sel.length + group.length > MAX_SELECTED_SEATS) {
          selectionLimitReached();
          return;
        }
        if (!validSeatSelection(group)) return;
        sel = group;
        ne(e);
        return;
      }
      if (at < 0 && selectedTicketCount() >= MAX_SELECTED_SEATS) {
        selectionLimitReached();
        return;
      }
      if (at < 0 && !validSeatSelection(sel.concat(e), e)) return;
      (at >= 0 ? sel.splice(at, 1) : sel.push(e), ne(e));
    }
    // Прерисува избора. last = мястото, което току-що е пипнато; заради него
    // панелът показва изгледа точно от него, а не от първото в списъка.
    function ne(last) {
      if (!sel.length && !selT.length) {
        (a(window.SeatMap, "clearSeatSelection") && window.SeatMap.clearSeatSelection(),
          a(window.SeatMap, "clearTableSelection") && window.SeatMap.clearTableSelection(),
          window.UI.setSelected(null),
          a(window.UI, "showPicks") && window.UI.showPicks([], {}),
          window.UI.showSeatView(null),
          // Празната количка също е новина: долният лист се прибира сам.
          window.dispatchEvent(new CustomEvent("arena:seat-picked", { detail: { count: 0 } })));
        return;
      }
      const cena = function (q) {
          return (i.feesIncluded ? q.eurAll : q.eur) || 0;
        },
        tot =
          sel.reduce(function (sum, mk) {
            return sum + cena(h.get(mk) || {});
          }, 0) +
          selT.reduce(function (sum, mk) {
            return sum + cena(tb2.get(mk) || {});
          }, 0),
        // Масата е един ред в списъка, но 8 билета в сметката.
        broi =
          sel.length +
          selT.reduce(function (n2, mk) {
            return n2 + ((tb2.get(mk) || {}).seats || 8);
          }, 0),
        redove = sel
          .map(function (mk) {
            const q = h.get(mk) || {},
              sc = M.get(q.s) || {};
            return {
              mk: mk,
              sector: ke2(q.s) || sc.name || String(q.s || ""),
              seat: "ред " + q.r + ", място " + q.t,
              eur: cena(q),
              // Всеки ред си носи своя изглед - панорамата на сектора, а ако
              // няма такава, триизмерния изглед от самото място.
              pano: sc.pano || "3d:" + mk,
            };
          })
          .concat(
            selT.map(function (mk) {
              const q = tb2.get(mk) || {};
              return {
                mk: mk,
                sector: q.name || mk,
                pano: "3d:" + mk,
                seat: "цяла маса · " + (q.seats || 8) + " места",
                eur: cena(q),
              };
            }),
          );
      // Списъкът с билетите: по един ред на място и по един на маса.
      a(window.UI, "showPicks") &&
        window.UI.showPicks(redove, {
          total: tot,
          count: broi,
          onRemove: function (mk) {
            String(mk).indexOf("t:") === 0 ? Ie2(mk) : J(mk);
          },
          onClearAll: function () {
            typeof window.__clearSelection == "function" && window.__clearSelection();
          },
          on360: function (pn) {
            typeof window.__on360 == "function" && window.__on360(pn);
          },
          onBuy: function () {
            typeof window.__onBuy == "function" && window.__onBuy();
          },
        });
      (a(window.SeatMap, "selectSeats") && window.SeatMap.selectSeats(sel.slice()),
        a(window.SeatMap, "selectTables") && window.SeatMap.selectTables(selT.slice()));
      // Тихо потвърждение: човек вижда, че тапът е хванат и колко места държи.
      if (sel.length && a(window.UI, "notify")) {
        const q = h.get(last) || h.get(sel[sel.length - 1]) || {},
          edin = sel.every(function (mk) { return (h.get(mk) || {}).s === q.s && (h.get(mk) || {}).r === q.r; });
        window.UI.notify({
          kind: "quiet",
          text:
            sel.length === 1
              ? "Избрано: ред " + q.r + ", място " + q.t
              : sel.length + " места избрани" + (edin ? ": ред " + q.r + ", " + re(sel) : ""),
        });
      }
      // Картата долу описва последното пипнато - място или маса.
      const tMk = String(last || "").indexOf("t:") === 0 ? last : !sel.length && selT.length ? selT[selT.length - 1] : null;
      if (tMk) {
        const q = tb2.get(tMk) || {};
        ((r = null),
          a(window.SeatMap, "clearSeatHighlights") && window.SeatMap.clearSeatHighlights(),
          window.UI.setSelected(null, q.name || tMk),
          window.UI.showSeatView({
            name: q.name || tMk,
            title: q.name || tMk,
            subtitle: (q.seats || 8) + " места на масата · цялата маса се купува наведнъж",
            seatLabel: (q.seats || 8) + " места",
            eur: q.eur,
            eurAll: q.eurAll,
            tier: null,
            bucketLabel: null,
          }));
      } else {
        const t = h.get(last || sel[sel.length - 1]) || h.get(sel[0]),
          n = M.get(t.s) || {},
          // Местата от един и същи сектор се изброяват заедно; от различни -
          // само на брой, иначе редът става по-дълъг от панела.
          one = sel.every(function (mk) {
            return (h.get(mk) || {}).s === t.s;
          }),
          etiket = one
            ? sel.length === 1
              ? "ред " + t.r + ", място " + t.t
              : "ред " + t.r + ", " + re(sel)
            : sel.length + " места в " + new Set(sel.map((mk) => (h.get(mk) || {}).s)).size + " сектора";
        ((r = "s:" + t.s),
          a(window.SeatMap, "highlight") && window.SeatMap.highlight(r),
          a(window.SeatMap, "clearSeatHighlights") && window.SeatMap.clearSeatHighlights(),
          window.UI.setSelected(r, etiket),
          window.UI.showSeatView({
            name: n.name || t.s,
            photo: n.photo,
            pano: n.pano || "3d:" + (last || sel[sel.length - 1]),
            // Картата описва ЕДНО място - последното пипнато: оттам е изгледът и
            // 360°. Броят и сметката са в списъка отгоре, тук биха се повтаряли.
            bucketLabel: m(t.tier),
            priceNote: "цена за 1 билет",
            // Заглавието казва сектора, редът под него - мястото. „Място ред 15,
            // място 3" повтаряше думата и криеше кой сектор се гледа.
            title: ke2(t.s) || n.name || String(t.s),
            subtitle: "ред " + t.r + ", място " + t.t,
            seatLabel: "ред " + t.r + ", място " + t.t,
            eur: i.feesIncluded ? t.eurAll : t.eur,
            tier: t.tier,
          }),
          // Камерата НЕ се мести при избиране на място. Мястото вече е пред
          // очите на човека - той тъкмо го е натиснал. При грешен клик изгледът
          // отскачаше и трябваше да се търси наново откъде е тръгнал.
          // (Само „Препоръчай ми" мести камерата - там местата са другаде.)
          void 0);
      }
      window.dispatchEvent(new CustomEvent("arena:seat-picked", { detail: { count: broi } }));
    }
    function K(e) {
      const t = M.get(e);
      if (!t || !t.centroid) return null;
      let n = null,
        s = 1 / 0;
      for (const d of (o.seats && o.seats.features) || []) {
        if (d.properties.s !== e) continue;
        const p = d.geometry.coordinates,
          c = Math.hypot(p[0] - t.centroid[0], p[1] - t.centroid[1]);
        c < s && ((s = c), (n = d.properties.mk));
      }
      return n;
    }
    // Бутонът върху схемата: показва се, щом изгледът се отдалечи от началния
    // или има избрано, и връща всичко в начално положение.
    (function () {
      const btn = document.getElementById("mapreset"),
        preview = document.getElementById("mappreview"),
        desktop = window.matchMedia("(min-width: 881px)");
      if (!btn) return;
      // Reuse the seat-view controller, including its native SVG fallback.
      preview?.addEventListener("click", function () {
        const mk = sel[0] || selT[0];
        if (mk) W(mk);
      });
      // Отдалечен ли е изгледът от началния. Мерим спрямо НАЧАЛНИЯ кадър, а не
      // спрямо минималния мащаб: той е по-нисък, защото дава запас за ръчно
      // отдалечаване.
      const otdalechen = function (mp) {
        const hm = a(window.SeatMap, "home") ? window.SeatMap.home() : null,
          base = hm ? hm.zoom : mp.getMinZoom();
        return mp.getZoom() > base + 0.35 || mp.getPitch() > 4 || Math.abs(mp.getBearing()) > 4;
      };
      // Само навигация. Изборът се маха от количката, не оттук: иначе човек
      // не може да разгледа втори сектор, без да загуби вече взетите билети.
      // Листът се прибира ПРЕДИ камерата: иначе човек иска цялата зала, а
      // долният ред сектори остава под количката.
      const cqlataZala = function () {
        ((window.dispatchEvent(new CustomEvent("arena:whole-hall")),
          (r = null),
          a(window.SeatMap, "clearHighlight") && window.SeatMap.clearHighlight(),
          a(window.SeatMap, "clearRevealed") && window.SeatMap.clearRevealed(),
          a(window.SeatMap, "reset") && window.SeatMap.reset(),
          window.UI.setSelected(null),
          // Празна количка - пада и картичката на сектора. С избрани места тя
          // описва последното пипнато и си остава вярна.
          sel.length || selT.length || window.UI.showSeatView(null),
          sync()));
      };
      btn.addEventListener("click", cqlataZala);
      // Влизала ли е изобщо камерата в сектора. Отварянето пуска полет и по
      // пътя гръмва moveend, докато залата още се вижда цяла - без този флаг
      // картичката угасваше в мига, в който се появи.
      var vlqzal = !1;
      var sync = function () {
        const mp = window.__map;
        if (!mp) return;
        // На десктоп избраните места държат навигацията като постоянна двойка.
        // „Цялата зала“ променя само камерата и никога не изтрива билети.
        const hasSelection = !!(sel.length || selT.length), away = otdalechen(mp);
        btn.hidden = !away && !(desktop.matches && hasSelection);
        if (preview) preview.hidden = !hasSelection;
        if (away) vlqzal = !0;
      };
      // Отдалечи ли се човек сам - с колелцето или с два пръста - схемата вече
      // показва цялата зала, а картичката отстрани продължаваше да пише
      // „Изглед от Сектор X". Бутонът „Цялата зала" я чисти, само че точно
      // тогава той е скрит и няма кой да го натисне. Затова се чисти сама.
      // На moveend, не на move: иначе гасне още докато влачиш.
      const zabravi = function () {
        const mp = window.__map;
        // Пълна количка: картичката описва последното пипнато място и си остава
        // вярна - същото правило като при бутона.
        // otdalechen() значи „камерата е ДАЛЕЧ от началния кадър", тоест вътре
        // в сектор. Чисти се, когато вече НЕ е далеч - върнала се е при цялата
        // зала.
        if (!mp || !r || !vlqzal || otdalechen(mp) || sel.length || selT.length)
          return;
        ((vlqzal = !1), window.UI.showSeatView(null));
      };
      // Хората не натискат „Цялата зала" - разтварят с два пръста, по 4-5 пъти,
      // и не стигат доникъде: мащабът опира в началния, но наклонът и
      // завъртането от сектора остават и залата продължава да изглежда чужда.
      // Затова жестът им довършва работата сам.
      const jest = function (mp) {
        const plat = mp.getCanvas();
        let ot = null, // мащабът в НАЧАЛОТО на жеста
          fokus = null, // точката между двата пръста: тя стои закована
          zaet = !1, // тече ли вече наше кадриране
          chas = null;
        // Началото се хваща от самия допир, а не от „zoomstart": докато той се
        // обади, мащабът вече е избягал и „бяхме ли си вкъщи" излиза грешно.
        const zapochni = function () {
          if (zaet || ot != null) return;
          ot = mp.getZoom();
        };
        (plat.addEventListener(
          "touchstart",
          function (ev) {
            ev.touches && ev.touches.length === 2 && zapochni();
          },
          { passive: !0 },
        ),
          plat.addEventListener("wheel", zapochni, { passive: !0 }),
          plat.addEventListener(
            "touchmove",
            function (ev) {
              if (!ev.touches || ev.touches.length !== 2) return;
              const rc = plat.getBoundingClientRect();
              fokus = [
                (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - rc.left,
                (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - rc.top,
              ];
            },
            { passive: !0 },
          ));
        // Кой сектор е под пръстите. Средата на екрана не върши работа: в общия
        // план там е подът на залата. Пробваме и няколко точки наоколо, защото
        // точно между пръстите може да е пътека между два сектора.
        const sektorPodPrastite = function () {
          if (!mp.getLayer("sections-fill")) return null;
          const c = fokus || [plat.clientWidth / 2, plat.clientHeight * 0.45];
          for (const [dx, dy] of [[0, 0], [0, -26], [0, 26], [-26, 0], [26, 0]]) {
            const f = mp.queryRenderedFeatures([c[0] + dx, c[1] + dy], { layers: ["sections-fill"] }) || [];
            if (f.length) return f[0].properties.mk;
          }
          return null;
        };
        const reshi = function (be) {
          const z = mp.getZoom(),
            hm = a(window.SeatMap, "home") ? window.SeatMap.home() : null,
            base = hm ? hm.zoom : mp.getMinZoom();
          // Свиване навътре: изгледът се връща цял - център, наклон и
          // завъртане, както прави бутонът. Два повода за това. Или мащабът
          // вече е слязъл до общия план и остава само камерата да се изправи.
          // Или жестът сам по себе си е бил решителен: пръстите са се събрали
          // до една трета от разстоянието си. От най-близкия мащаб до залата
          // има цели пет нива и с малки крачки се стигаше за няколко жеста -
          // а едно такова събиране на пръстите значи само едно нещо.
          if (z < be - 0.05) {
            if (!otdalechen(mp)) return;
            if (z > base + 0.25 && be - z < 1.6) return;
            ((zaet = !0), cqlataZala(), setTimeout(function () { zaet = !1; }, 1400));
            return;
          }
          // Едно разтваряне = един сектор. Прагът беше цял мащаб и половина,
          // тоест почти целият екран с два пръста: хората разтваряха по няколко
          // пъти, спираха някъде по средата и оттам жестът вече не отваряше
          // нищо, защото не тръгваше „от вкъщи". Сега стига едно решително
          // разтваряне, стига да няма отворен сектор. Има ли отворен, пръстите
          // приближават свободно към местата - това е второто движение, с
          // което се избира стол.
          // Разтваряне над ДРУГ сектор, докато един е отворен, води натам:
          // човек не бива да се връща до общия план, за да смени сектора.
          if (z > be + 0.45) {
            const mk = sektorPodPrastite(),
              tuk = r || (sel.length ? "s:" + (h.get(sel[0]) || {}).s : null);
            if (!mk || mk === tuk) return;
            ((zaet = !0), b(mk), setTimeout(function () { zaet = !1; }, 1400));
          }
        };
        // Един жест вдига няколко „zoomend" - решава се веднъж, след последния.
        mp.on("zoomend", function () {
          clearTimeout(chas);
          chas = setTimeout(function () {
            if (ot == null) return;
            const be = ot;
            ((ot = null), zaet || reshi(be));
          }, 240);
        });
      };
      const bind = function () {
        const mp = window.__map;
        if (!mp) {
          setTimeout(bind, 200);
          return;
        }
        // Само move/moveend не стигаше: изборът се сменя без картата да мръдне
        // и бутонът оставаше с надпис „Цялата зала", докато вече триеше избора.
        (mp.on("move", sync),
          mp.on("moveend", sync),
          mp.on("moveend", zabravi),
          window.addEventListener("arena:seat-picked", sync),
          window.addEventListener("resize", sync),
          window.SeatMap.mode !== "2d" && jest(mp),
          sync());
      };
      bind();
    })();
    const checkoutCartKey = "arena8888.checkout.cart.v1",
      checkoutFlowKey = "arena8888.checkout.flow.v2";
    function checkoutPrice(q) {
      return Number((i.feesIncluded ? q.eurAll : q.eur) || 0);
    }
    function checkoutCart() {
      const seatItems = sel.map(function (mk) {
          const q = h.get(mk) || {},
            price = checkoutPrice(q);
          return {
            id: mk,
            type: "seat",
            sector: ke2(q.s),
            sectionToken: q.s,
            row: String(q.r == null ? "" : q.r),
            seat: String(q.t == null ? "" : q.t),
            quantity: 1,
            unitPrice: price,
            lineTotal: price,
          };
        }),
        tableItems = selT.map(function (mk) {
          const q = tb2.get(mk) || {},
            quantity = Number(q.seats || 8),
            price = checkoutPrice(q);
          return {
            id: mk,
            type: "table",
            sector: q.name || "Маси",
            sectionToken: "tables",
            row: "",
            seat: "цяла маса",
            quantity: quantity,
            unitPrice: Number(q.eurPerSeat || price / quantity || 0),
            lineTotal: price,
          };
        }),
        items = seatItems.concat(tableItems),
        ticketCount = items.reduce(function (sum, item) {
          return sum + item.quantity;
        }, 0),
        subtotal = items.reduce(function (sum, item) {
          return sum + item.lineTotal;
        }, 0);
      return {
        version: 1,
        event: {
          id: "100090",
          slug: "toni-storaro-yubileen-kontsert",
          title: "ТОНИ СТОРАРО - ЮБИЛЕЕН КОНЦЕРТ",
          date: "13 ноември 2026",
          time: "20:00",
          venue: "Зала „Арена 8888 София“",
          poster: "../assets/toni-storaro.webp",
        },
        items: items,
        currency: "EUR",
        ticketCount: ticketCount,
        subtotal: Math.round(subtotal * 100) / 100,
        createdAt: new Date().toISOString(),
      };
    }
    window.__onBuy = function () {
      if (!validSeatSelection(sel)) return;
      if (!sel.length && !selT.length) {
        a(window.UI, "notify") && window.UI.notify({ text: "Първо изберете поне едно място." });
        return;
      }
      const invalid = sel.some(mk=>{const q=h.get(mk);return !q || q.sold || q.offsale || !Number.isFinite(q.eur) || q.eur<=0;}) || selT.some(mk=>{const q=tb2.get(mk);return !q || q.sold || q.offsale || !Number.isFinite(q.eur) || q.eur<=0;});
      if(invalid){warn('Някое от избраните места вече не е достъпно.','Изберете други',function(){recommend(!1);});return;}
      try {
        sessionStorage.setItem(checkoutCartKey, JSON.stringify(checkoutCart()));
        sessionStorage.removeItem(checkoutFlowKey);
        window.location.href = "./checkout/";
      } catch (err) {
        a(window.UI, "notify") && window.UI.notify({ text: "Изборът не можа да бъде прехвърлен. Опитайте отново." });
      }
    };
    // Връщането от checkout възстановява само избора. Не променя схемата,
    // камерата или начина, по който човек избира места.
    if (new URLSearchParams(window.location.search).get("restore") === "1" || selectionDraft?.items?.length) {
      try {
        const saved = new URLSearchParams(window.location.search).get("restore") === "1"
            ? JSON.parse(sessionStorage.getItem(checkoutCartKey) || "null") : selectionDraft,
          savedItems = saved && Array.isArray(saved.items) ? saved.items : [];
        sel = []; selT = [];
        let restoredCount = 0;
        for (const item of savedItems) {
          const isTable = item.type === "table", isSeat = item.type === "seat";
          const record = isTable ? tb2.get(item.id) : isSeat ? h.get(item.id) : null;
          const count = isTable ? 8 : 1;
          const target = isTable ? selT : sel;
          if (!record || record.sold || record.offsale || !(record.eur > 0) ||
              target.includes(item.id) || restoredCount + count > MAX_SELECTED_SEATS) continue;
          target.push(item.id); restoredCount += count;
        }
        if (sel.length || selT.length) {
          i.quantity = sel.length || 8;
          y();
          ne(selT.length ? selT[selT.length - 1] : sel[sel.length - 1]);
        }
        history.replaceState(null, "", window.location.pathname + window.location.hash);
      } catch (err) {}
    }
    window.addEventListener('pagehide', () => {
      try { sessionStorage.setItem(selectionDraftKey, JSON.stringify(checkoutCart())); } catch (_) {}
    });
    window.__clearSelection = function () {
      // ne() с празен избор изчиства и картата на мястото, и списъка - иначе
      // „Премахни всички" махаше местата, а редовете оставаха на екрана.
      const sekt = r,
        imashe = sel.length || selT.length;
      (C(), ne());
      // Една стъпка назад, не чак до началото: щом е имало избрани места,
      // изгледът остава при сектора, който човекът разглежда. Празен ли е вече
      // изборът, следващият натиск прибира схемата в цялата зала.
      imashe && sekt && v.get(sekt)
        ? b(sekt)
        : a(window.SeatMap, "reset") && window.SeatMap.reset();
    };
    function C() {
      ((sel = []),
        (selT = []),
        (r = null),
        a(window.SeatMap, "clearTableSelection") && window.SeatMap.clearTableSelection(),
        a(window.SeatMap, "reset") && window.SeatMap.reset(),
        a(window.SeatMap, "clearHighlight") && window.SeatMap.clearHighlight(),
        a(window.SeatMap, "clearRevealed") && window.SeatMap.clearRevealed(),
        a(window.SeatMap, "clearSeatHighlights") && window.SeatMap.clearSeatHighlights(),
        a(window.SeatMap, "clearSeatSelection") && window.SeatMap.clearSeatSelection());
    }
    function O(e) {
      const t = i.feesIncluded ? e.priceFromAll : e.priceFrom;
      return typeof t == "number" ? "от €" + t : "";
    }
    function k(e, t, n) {
      a(window.UI, "markViewed") && window.UI.markViewed({ mk: e, label: t, priceText: n });
    }
    function W(e) {
      if (window.SeatMap.mode === '2d') {
        window.dispatchEvent(new CustomEvent('arena:map-focus'));
        if (tb2.has(e)) window.SeatMap.frameTable(e);
        else window.SeatMap.frameSeats([e]);
        return;
      }
      if (window.ArenaSeatView && o.meta?.venue === 'Арена 8888') {
        const seat=h.get(e), table=tb2.get(e);if(!seat&&!table)return;
        window.ArenaSeatView.open({venue:o,mk:e,title:table?table.name:'Сектор '+seat.s+' · ред '+seat.r+' · място '+seat.t,
          selected:sel.filter(mk=>mk!==e).map(mk=>{const s=h.get(mk);return {mk,title:'Сектор '+s.s+' · ред '+s.r+' · място '+s.t};})});
        return;
      }
      if (!window.SeatView3D) return;
      const t = Q.get(e),
        n = h.get(e);
      if (!t || !n) return;
      let s = { minLng: -8, maxLng: 8, minLat: 14, maxLat: 18 };
      try {
        const c = o.court.floor.geometry.coordinates[0];
        let l = 1 / 0,
          x = -1 / 0,
          f = 1 / 0,
          u = -1 / 0;
        for (const w of c)
          ((l = Math.min(l, w[0])), (x = Math.max(x, w[0])), (f = Math.min(f, w[1])), (u = Math.max(u, w[1])));
        s = { minLng: l, maxLng: x, minLat: f, maxLat: u };
      } catch {}
      const d = ((o.seats && o.seats.features) || []).map((c) => ({
          x: c.geometry.coordinates[0],
          y: c.geometry.coordinates[1],
          s: c.properties.s,
          r: c.properties.r,
          level: V.get(c.properties.s) || "",
        })),
        p = M.get(n.s) || {};
      window.SeatView3D.open({
        title: "Изглед от: " + (p.name || n.s) + ", ред " + n.r + ", място " + n.t,
        focus: o.focus || [0, 0],
        stage: s,
        seats: d,
        stage3d: o.stage3d || null,
        curtain: o.curtain || null,
        own: { x: t[0], y: t[1], s: n.s, r: n.r, level: V.get(n.s) || "" },
      });
    }
    ((window.__on360 = function (e) {
      if (!e) return;
      if (String(e).indexOf("3d:") === 0) {
        W(String(e).slice(3));
        return;
      }
      if (!window.Panorama) return;
      let t = "Изглед 360°";
      (r && v.get(r) && (t = "Сектор " + v.get(r).name + " · 360°"), window.Panorama.open(e, { title: t }));
    }),
      console.log("[app] ready"));
    window.SeatMapStartup && window.SeatMapStartup.appReady();
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", H) : H();
})();
