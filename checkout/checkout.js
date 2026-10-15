(function () {
  "use strict";

  const CART_KEY = "arena8888.checkout.cart.v1";
  const FLOW_KEY = "arena8888.checkout.flow.v2";
  // Места на маса, ако количеството липсва в количката (в нея го слага схемата от данните).
  const TABLE_SEATS_FALLBACK = 6;
  const SERVICE_FEE = 160;
  const INTEREST_RATE = 0.05;
  const GUARANTEE_RATE = 0.06;
  const INSTALLMENT_OPTIONS = [2, 3, 6];
  const STEPS = ["Контакт", "План", "Плащане", "Преглед"];
  const METHODS = {
    card: { label: "Банкова карта", short: "Карта", image: "../assets/payment/card-networks.svg", note: "Visa или Mastercard" },
    revolut: { label: "Revolut", short: "Revolut", image: "../assets/payment/revolut.png", note: "Потвърждение през Revolut" },
    easypay: { label: "EasyPay", short: "EasyPay", image: "../assets/payment/easypay.png", note: "Плащане на каса с код" },
    econt: { label: "Еконт (на офис)", short: "Еконт", image: "../assets/payment/econt.png", note: "Платете при получаване на билетите в офис на Еконт" },
  };

  const app = document.getElementById("checkout-app");
  const grid = document.getElementById("checkout-grid");
  const empty = document.getElementById("empty-cart");
  const steps = document.getElementById("checkout-steps");
  const content = document.getElementById("step-content");
  const summary = document.getElementById("order-summary");
  const sector = document.getElementById("hero-sector");
  const clock = document.getElementById("hold-clock");
  const declineDialog = document.getElementById("guarantee-decline-dialog");
  const toast = document.getElementById("checkout-toast");
  let toastTimer = 0;

  const localDemo = /^127\.0\.0\.1$|^localhost$/i.test(location.hostname);
  const home = document.querySelector("[data-arena-home]");
  if (home && localDemo) home.href = "../../prototype/";

  function demoSeat() {
    const seat = (((window.VENUE || {}).seats || {}).features || []).find((f) => f.properties.sold !== true && f.properties.offsale !== true && f.properties.eur > 0);
    return seat ? seat.properties.mk : "";
  }

  function demoCart() {
    return {
      version: 1,
      event: {
        id: "ceca-2026-11-07",
        title: "CECA",
        date: "7 ноември 2026",
        time: "20:00",
        venue: "Зала „Арена 8888 София“",
        organizer: "C'est La Vie Restaurant & Club",
      },
      // Само самоличността на мястото: цената и етикетите се смятат от залата.
      items: [{ id: demoSeat(), type: "seat", quantity: 1 }],
      currency: "EUR",
      ticketCount: 1,
      subtotal: 50,
      createdAt: new Date().toISOString(),
    };
  }

  function read(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "null");
    } catch (_) {
      return null;
    }
  }

  function write(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  let cart = read(CART_KEY);

  // Количката от схемата е само списък от самоличности и бройки. Цените, етикетите
  // и броят места се смятат ОТНОВО от данните на залата (VENUE), в цели центове:
  // така подправена количка (ниска цена, 1e308, отрицателна цена, маса с бройка 1,
  // чужд номер) не може да намали сметката или да мине като билети. Връща чиста
  // количка или null; null показва обичайното празно състояние.
  const MAX_ADMISSIONS = 10;
  function canonicalCart(raw) {
    const venue = window.VENUE;
    if (!raw || !Array.isArray(raw.items) || !raw.items.length || raw.items.length > MAX_ADMISSIONS || !venue) return null;
    const seats = new Map((((venue.seats || {}).features) || []).map((f) => [f.properties.mk, f.properties]));
    const tables = new Map((((venue.tables || {}).features) || []).map((f) => [f.properties.mk, f.properties]));
    const zones = new Map((((venue.standing || {}).features) || []).map((f) => [f.properties.mk, f.properties]));
    const sections = new Map((((venue.sections || {}).features) || []).map((f) => [String(f.properties.mk).replace(/^s:/, ""), f.properties]));
    const sectorLabel = (token) => {
      const name = String((sections.get(String(token)) || {}).name || token);
      return /^(Сектор|Блок|Ложа|Оркестрина)(\s|$)/i.test(name) ? name : "Сектор " + name;
    };
    const free = (r) => r && r.sold !== true && r.offsale !== true && Number.isFinite(r.eur) && r.eur > 0;
    const toCents = (euro) => Math.round(euro * 100);
    const seen = new Set(), items = [];
    let admissions = 0, standingRows = 0, totalCents = 0;
    for (const item of raw.items) {
      if (!item || typeof item !== "object" || typeof item.type !== "string") return null;
      const id = item.type === "standing" ? (item.mk || item.id) : item.id;
      if (typeof id !== "string") return null;
      const key = item.type + "|" + id;
      if (seen.has(key)) return null;
      seen.add(key);
      let line, count;
      if (item.type === "seat") {
        const r = seats.get(id);
        if (!free(r) || item.quantity !== 1) return null;
        count = 1;
        line = { id, type: "seat", sector: sectorLabel(r.s), sectionToken: r.s, row: String(r.r == null ? "" : r.r), seat: String(r.t == null ? "" : r.t),
          quantity: 1, cents: toCents(r.eur) };
      } else if (item.type === "table") {
        const r = tables.get(id);
        count = Number(r && r.seats) > 0 ? Number(r.seats) : TABLE_SEATS_FALLBACK;
        if (!free(r) || item.quantity !== count) return null;
        line = { id, type: "table", sector: r.name || "Маси", sectionToken: "tables", row: "", seat: "цяла маса", quantity: count, cents: toCents(r.eur) };
      } else if (item.type === "standing") {
        const r = zones.get(id);
        const capacity = Number(r && r.capacity) > 0 ? Number(r.capacity) : MAX_ADMISSIONS;
        if (!free(r) || ++standingRows > 1 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > Math.min(MAX_ADMISSIONS, capacity)) return null;
        count = item.quantity;
        line = { id, type: "standing", mk: id, name: r.name, sector: r.name, sectionToken: "standing", row: "", seat: "", quantity: count, cents: toCents(r.eur) * count };
      } else return null;
      admissions += count;
      if (admissions > MAX_ADMISSIONS) return null;
      totalCents += line.cents;
      items.push(Object.assign(line, { unitPrice: line.cents / 100 / count, lineTotal: line.cents / 100 }));
    }
    return { version: 1, items, currency: "EUR", ticketCount: admissions, subtotal: totalCents / 100, createdAt: raw.createdAt };
  }
  cart = canonicalCart(cart);
  // Демо количка (само на localhost с ?demo): записва се САМО ако минава през
  // същата проверка. Ако залата не е заредена, нищо не се записва и следващото
  // зареждане опитва пак, вместо да остане количка с празно място.
  if (!cart && localDemo && new URLSearchParams(location.search).has("demo")) {
    const demo = canonicalCart(demoCart());
    if (demo) {
      cart = demo;
      write(CART_KEY, cart);
    }
  }

  const stored = read(FLOW_KEY) || {};
  let state = {
    step: clamp(Number(stored.step) || 1, 1, 4),
    maxStep: clamp(Number(stored.maxStep) || 1, 1, 4),
    contact: {
      firstName: stored.contact?.firstName || "",
      lastName: stored.contact?.lastName || "",
      email: stored.contact?.email || "",
      phone: stored.contact?.phone || "",
    },
    plan: stored.plan === "now" || stored.plan === "installments" ? stored.plan : null,
    installmentCount: INSTALLMENT_OPTIONS.includes(Number(stored.installmentCount)) ? Number(stored.installmentCount) : null,
    paymentMethod: METHODS[stored.paymentMethod] ? stored.paymentMethod : null,
    guarantee: typeof stored.guarantee === "boolean" ? stored.guarantee : null,
    terms: Boolean(stored.terms),
    promoCode: stored.promoCode || "",
    promoMessage: stored.promoMessage || "",
    promoStatus: stored.promoStatus || "",
    complete: Boolean(stored.complete),
    orderNumber: stored.orderNumber || "",
  };

  if (state.plan !== "installments") state.installmentCount = null;
  if (state.plan === "installments" && state.paymentMethod === "econt") state.paymentMethod = null;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safe(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cents(value) {
    return Math.round((Number(value) || 0) * 100);
  }

  function money(value) {
    return (value / 100).toLocaleString("bg-BG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €";
  }

  function ticketCount() {
    return (cart?.items || []).reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
  }

  function subtotal() {
    return (cart?.items || []).reduce((total, item) => total + cents(item.lineTotal), 0);
  }

  function totals(forceGuarantee) {
    const tickets = subtotal();
    const pricingActive = (state.step >= 2 || state.complete) && Boolean(state.plan);
    const protectedOrder = forceGuarantee === true || (forceGuarantee !== false && state.guarantee === true);
    const guarantee = pricingActive && protectedOrder ? Math.round(tickets * GUARANTEE_RATE) : 0;
    const interest = pricingActive && state.plan === "installments" ? Math.round(tickets * INTEREST_RATE) : 0;
    // Таксата е за поръчката, не за плана: показва се от първата стъпка,
    // за да не расте сумата изненадващо на втората.
    const service = SERVICE_FEE;
    const total = tickets + guarantee + interest + service;
    const count = state.plan === "installments" ? state.installmentCount || 2 : 1;
    const installment = state.plan === "installments" ? Math.floor((tickets + interest) / count) : total;
    const first = state.plan === "installments" ? total - installment * (count - 1) : total;
    return { tickets, guarantee, interest, service, total, first, installment, count };
  }

  function persist() {
    write(CART_KEY, cart);
    write(FLOW_KEY, state);
  }

  function notify(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 2800);
  }

  function contactName() {
    const name = [state.contact.firstName, state.contact.lastName].filter(Boolean).join(" ");
    return name || "Не е попълнено";
  }

  // Празна форма не минава нататък: всяко поле получава своя причина под
  // себе си, първото празно взима фокуса, а тостът казва общо какво липсва.
  function validSeating(items) {
    if (!window.SeatFinder || !window.VENUE) {
      notify("Схемата не е заредена. Презаредете страницата и опитайте отново.");
      return false;
    }
    window.SeatFinder.init(window.VENUE);
    if (window.SeatFinder.leavesIsolatedSeat(items.filter(item => item.type === "seat").map(item => item.id))) {
      notify("Изборът оставя едно свободно място само. Променете местата от схемата.");
      return false;
    }
    return true;
  }

  function contactErrors() {
    const c = state.contact;
    const errors = {};
    const namePattern = /^\p{L}[\p{L}\s'’.-]*$/u;
    const firstName = String(c.firstName || "").trim();
    const lastName = String(c.lastName || "").trim();
    if (!firstName) errors.firstName = "Въведете име.";
    else if (firstName.length < 2 || !namePattern.test(firstName)) errors.firstName = "Името е само от букви.";
    if (!lastName) errors.lastName = "Въведете фамилия.";
    else if (lastName.length < 2 || !namePattern.test(lastName)) errors.lastName = "Фамилията е само от букви.";
    const email = String(c.email || "").trim();
    if (!email) errors.email = "Въведете имейл.";
    else if (!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email) || email.length > 254 || email.split("@")[0].length > 64 || email.startsWith(".") || email.includes("..") || email.includes(".@")) errors.email = "Въведете валиден имейл с латински букви, например ivan@example.com.";
    const phone = phoneDigits(c.phone);
    if (!phone) errors.phone = "Въведете телефон.";
    else if (!/^\d{7,10}$/.test(phone)) errors.phone = "Телефонът е от 7 до 10 цифри, без кода на държавата.";
    return errors;
  }

  // Телефонът се пази само като цифри, без код на държавата: „+359 888…",
  // „00359888…" и „0888…" се свеждат до „888…", а над 10 цифри не се приемат.
  const PHONE_MAX_DIGITS = 10;
  const NAME_MAX = 60;
  function phoneDigits(raw) {
    const text = String(raw == null ? "" : raw).trim();
    let digits = text.replace(/\D/g, "");
    const international = text.startsWith("+") || text.startsWith("00");
    if (international && digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("359") && (international || digits.length > 9)) digits = digits.slice(3);
    if (digits.startsWith("0") && digits.length >= 10) digits = digits.slice(1);
    return digits.slice(0, PHONE_MAX_DIGITS);
  }

  function phoneDisplay(raw) {
    const digits = phoneDigits(raw);
    return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(" ");
  }

  function emailHadCyrillic(raw) {
    return /[Ѐ-ӿ]/.test(String(raw == null ? "" : raw));
  }

  function fieldValid(key) {
    const c = state.contact;
    if (!String(c[key] || "").trim()) return false;
    return !contactErrors()[key];
  }

  function markContactErrors(errors, onlyClear) {
    let first = null;
    content.querySelectorAll("[data-contact]").forEach(function (input) {
      const field = input.closest(".field");
      if (!field) return;
      const message = errors[input.dataset.contact];
      let hint = field.querySelector(".field__error");
      if (message && !onlyClear) {
        input.setAttribute("aria-invalid", "true");
        if (!hint) {
          hint = document.createElement("p");
          hint.className = "field__error";
          hint.id = input.id + "-error";
          field.appendChild(hint);
        }
        hint.textContent = message;
        input.setAttribute("aria-describedby", hint.id);
        field.classList.add("is-invalid");
        if (!first) first = input;
      } else if (!message) {
        input.removeAttribute("aria-invalid");
        const guidance = field.querySelector(".field__hint");
        if (guidance) input.setAttribute("aria-describedby", guidance.id);
        else input.removeAttribute("aria-describedby");
        field.classList.remove("is-invalid");
        if (hint) hint.remove();
      }
    });
    return first;
  }

  function focusFirst(selector) {
    const target = content.querySelector(selector);
    if (target) target.focus({ preventScroll: false });
    return target;
  }

  function sectionLabel() {
    const labels = [...new Set((cart?.items || []).map((item) => item.sector).filter(Boolean))];
    if (!labels.length) return "Избрани места";
    if (labels.length === 1) return labels[0];
    return labels.length + " сектора";
  }

  function renderSteps() {
    // Синята линия между кръгчетата расте със стъпката: вижда се докъде е
    // стигнала поръчката без да се четат етикетите.
    const done = state.complete ? 1 : (state.step - 1) / (STEPS.length - 1);
    steps.innerHTML = '<i class="steps__fill" style="transform:scaleX(' + done.toFixed(3) + ')" aria-hidden="true"></i>' +
      '<p class="steps__status" aria-live="polite">' + (state.complete ? "Готово" : "Стъпка " + state.step + " от " + STEPS.length) + "</p>" +
      STEPS.map(function (label, index) {
      const number = index + 1;
      const current = number === state.step;
      const complete = number < state.step;
      const available = complete && !state.complete;
      return (
        '<button class="step' + (current ? " is-current" : "") + (complete ? " is-complete" : "") + '" ' +
        'data-step="' + number + '" data-step-nav' + (available ? "" : " disabled") + (current ? ' aria-current="step"' : "") + ">" +
        '<span class="step__number">' + number + "</span><span>" + label + "</span></button>"
      );
    }).join("");
  }

  function contactView() {
    return `
      <div class="step-view">
        <h2 class="step-heading">Данни за контакт</h2>
        <p class="step-intro">Въведете данни за контакт. В демо режима не се изпращат имейли или билети.</p>
        <div class="form-grid">
          <div class="field${fieldValid("firstName") ? " is-valid" : ""}">
            <label for="first-name">Име</label>
            <input id="first-name" class="input" data-contact="firstName" autocomplete="given-name" autocapitalize="words" maxlength="${NAME_MAX}" enterkeyhint="next" placeholder="Иван" value="${safe(state.contact.firstName)}" />
          </div>
          <div class="field${fieldValid("lastName") ? " is-valid" : ""}">
            <label for="last-name">Фамилия</label>
            <input id="last-name" class="input" data-contact="lastName" autocomplete="family-name" autocapitalize="words" maxlength="${NAME_MAX}" enterkeyhint="next" placeholder="Иванов" value="${safe(state.contact.lastName)}" />
          </div>
          <div class="field field--wide${fieldValid("email") ? " is-valid" : ""}">
            <label for="email">Имейл</label>
            <input id="email" aria-describedby="email-hint" class="input" data-contact="email" type="text" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="254" enterkeyhint="next" placeholder="ivan@example.com" value="${safe(state.contact.email)}" />
            <p class="field__hint" id="email-hint" hidden>Имейлът се пише на латиница. Поправете адреса, за да продължите.</p>
          </div>
          <div class="field field--wide${fieldValid("phone") ? " is-valid" : ""}">
            <label for="phone">Мобилен телефон</label>
            <div class="phone-row">
              <select class="select" aria-label="Код на държавата"><option>BG +359</option></select>
              <input id="phone" aria-describedby="phone-hint" class="input" data-contact="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="20" enterkeyhint="done" placeholder="888 123 456" value="${safe(phoneDisplay(state.contact.phone))}" />
            </div>
            <p class="field__hint" id="phone-hint">Без нулата и без кода на държавата, до ${PHONE_MAX_DIGITS} цифри.</p>
          </div>
        </div>
        <div class="step-actions">
          <a class="button button--ghost" href="../?restore=1">Назад</a>
          <button class="button button--primary" data-action="next">Продължете</button>
        </div>
      </div>`;
  }

  // Полето получава отметка, щом е попълнено правилно, и я губи щом се
  // развали. Грешката се показва чак когато човекът излезе от полето.
  function markFieldValidity(input) {
    const field = input.closest(".field");
    if (!field) return;
    field.classList.toggle("is-valid", fieldValid(input.dataset.contact));
  }

  function nextContactInput(current) {
    const inputs = [...content.querySelectorAll("[data-contact]")];
    const index = inputs.indexOf(current);
    return inputs.slice(index + 1).find((input) => !fieldValid(input.dataset.contact)) || inputs[index + 1] || null;
  }

  function installmentBox() {
    const t = totals();
    const lines = Array.from({ length: t.count }, function (_, index) {
      const amount = index === 0 ? t.first : t.installment;
      const timing = index === 0 ? "днес" : "след " + index * 30 + " дни";
      const feeNote = index === 0
        ? `<small>вкл. еднократна такса ${money(t.service)}${state.guarantee ? " и гаранцията" : ""}</small>`
        : "";
      return `<div class="installment-line"><span>Вноска ${index + 1} <em>${timing}</em>${feeNote}</span><strong>${money(amount)}</strong></div>`;
    }).join("");
    return `
      <div class="installment-box">
        <div class="installment-lines">${lines}</div>
        <div class="installment-total"><span>Общо на изплащане</span><strong>${money(t.total)}</strong></div>
        <p class="installment-note">В т.ч. такса ${money(t.service)} и 5% лихва върху билетите. Гаранцията се начислява изцяло към първата вноска.</p>
      </div>`;
  }

  function planView() {
    const t = totals();
    return `
      <div class="step-view">
        <h2 class="step-heading">План на плащане</h2>
        <div class="plan-layout">
          <button class="choice-card plan-choice${state.plan === "installments" ? " is-selected" : ""}" data-plan="installments">
            <span class="choice-icon">%</span>
            <span class="choice-copy"><strong>На изплащане</strong><small>Разделете сумата на 2, 3 или 6 месечни вноски.</small></span>
            <span class="choice-radio" aria-hidden="true"></span>
          </button>
          ${state.plan === "installments" ? `
            <section class="installment-picker">
              <p class="plan-kicker">Изберете брой вноски</p>
              <div class="installment-options">
                ${INSTALLMENT_OPTIONS.map(function (count) {
                  const selected = state.installmentCount === count;
                  const monthly = Math.floor((t.tickets + t.interest) / count);
                  return `<button class="installment-option${selected ? " is-selected" : ""}" data-installments="${count}"><span>${count} вноски</span><strong>${money(monthly)}</strong><small>на месец</small></button>`;
                }).join("")}
              </div>
              ${state.installmentCount ? installmentBox() : ""}
            </section>` : ""}
          <button class="choice-card plan-choice${state.plan === "now" ? " is-selected" : ""}" data-plan="now">
            <span class="choice-icon">1×</span>
            <span class="choice-copy"><strong>Платете сега</strong><small>Цялата сума с едно плащане</small></span>
            <span class="choice-radio" aria-hidden="true"></span>
          </button>
        </div>
        <div class="step-actions">
          <button class="button button--ghost" data-action="back">Назад</button>
          <button class="button button--primary" data-action="next">Продължете</button>
        </div>
      </div>`;
  }

  function paymentView() {
    const available = state.plan === "installments" ? ["card", "revolut", "easypay"] : ["card", "revolut", "easypay", "econt"];
    const methodCards = available.map(function (key) {
      const method = METHODS[key];
      return `
        <button class="choice-card payment-card${state.paymentMethod === key ? " is-selected" : ""}" data-payment="${key}" aria-pressed="${state.paymentMethod === key}">
          <span class="choice-radio" aria-hidden="true"></span>
          <span class="payment-brand"><img class="payment-logo payment-logo--${key}" src="${method.image}" alt="" /></span>
          <span class="choice-copy"><strong>${method.label}</strong><small>${method.note}</small></span>
          <span class="payment-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg></span>
        </button>`;
    }).join("");
    return `
      <div class="step-view">
        <h2 class="step-heading">Начин на плащане</h2>
        <p class="step-intro">${state.plan === "installments" ? "Изберете как да заплатите първата вноска." : "Изберете удобен начин за плащане."}</p>
        <div class="choice-list">${methodCards}</div>
        <div class="step-actions">
          <button class="button button--ghost" data-action="back">Назад</button>
          <button class="button button--primary" data-action="next">Продължете</button>
        </div>
      </div>`;
  }

  function reviewView() {
    const t = totals();
    const method = METHODS[state.paymentMethod];
    const primaryLabel = "Завършете поръчката";
    return `
      <div class="step-view">
        <div class="review-intro">
          <h2 class="step-heading">Преглед на поръчката</h2>
          <p class="step-intro">Проверете избора си преди да завършите демо поръчката.</p>
        </div>
        <div class="review-list">
          <section class="review-block">
            <div class="review-block__head"><h3>Контакт</h3><button class="text-button" data-step="1">Промени</button></div>
            <div class="review-data">
              <div><span>Име</span><strong>${safe(contactName())}</strong></div>
              <div><span>Имейл</span><strong>${safe(state.contact.email || "Не е попълнено")}</strong></div>
              <div><span>Телефон</span><strong>${safe(state.contact.phone ? "+359 " + phoneDisplay(state.contact.phone) : "Не е попълнено")}</strong></div>
            </div>
          </section>
          <section class="review-block">
            <div class="review-block__head"><h3>План</h3><button class="text-button" data-step="2">Промени</button></div>
            <div class="review-data">
              <div><span>Избран план</span><strong>${state.plan === "installments" ? state.installmentCount + " вноски" : "Платете сега"}</strong></div>
              <div><span>${state.plan === "installments" ? "Първа вноска" : "Сума"}</span><strong>${money(state.plan === "installments" ? t.first : t.total)}</strong></div>
            </div>
          </section>
          <section class="review-block">
            <div class="review-block__head"><h3>Плащане</h3><button class="text-button" data-step="3">Промени</button></div>
            <div class="review-data"><div><span>Метод</span><strong>${safe(method?.label || "Не е избран")}</strong></div></div>
          </section>
        </div>
        <section class="protect-section">
          <p class="protect-title">Защита на поръчката</p>
          <div class="guarantee-card${state.guarantee === true ? " is-accepted" : state.guarantee === false ? " is-declined" : ""}">
            <div class="guarantee-card__head">
              <span class="guarantee-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.8 2.8 8.3 7 10 4.2-1.7 7-5.2 7-10V6z"></path><path d="m9 12 2 2 4-5"></path></svg>
              </span>
              <div><h3>Гаранция за връщане</h3><p>За право на връщане на билет</p></div>
              <strong class="guarantee-card__price">${money(Math.round(t.tickets * GUARANTEE_RATE))}</strong>
            </div>
            <div class="guarantee-control">
              <div class="guarantee-track">
                <span class="guarantee-track__yes" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg></span>
                <span class="guarantee-knob" aria-hidden="true"><i></i></span>
                <span class="guarantee-track__no" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"></path></svg></span>
                <button class="guarantee-hit guarantee-hit--yes" data-guarantee="yes" aria-label="Искам пълна гаранция"></button>
                <button class="guarantee-hit guarantee-hit--middle" data-guarantee="unset" aria-label="Изчистете избора"></button>
                <button class="guarantee-hit guarantee-hit--no" data-guarantee="no" aria-label="Не искам гаранция"></button>
              </div>
              <div class="guarantee-labels">
                <button data-guarantee="yes">Да, искам пълна гаранция</button>
                <button data-guarantee="no">Не искам гаранция</button>
              </div>
              <p class="guarantee-prompt">${state.guarantee === null ? "Изберете наляво или надясно, за да продължите" : state.guarantee ? "Гаранцията е добавена към поръчката" : "Продължавате без гаранция"}</p>
              <div class="guarantee-benefits">
                <strong><span aria-hidden="true">✓</span> Гаранция за връщане на билет</strong>
                <ul>
                  <li>Връщане на билета без документи и без причина</li>
                  <li>Получавате 100% от стойността по първоначалния начин на плащане</li>
                  <li>Върнете по всяко време до 30 октомври 2026</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
        <label class="terms">
          <input type="checkbox" data-terms${state.terms ? " checked" : ""} />
          <span>Приемам <a href="#" data-demo-link>общите условия</a>.</span>
        </label>
        <div class="step-actions">
          <button class="button button--ghost" data-action="back">Назад</button>
          <button class="button button--primary" data-action="finish">${primaryLabel}</button>
        </div>
      </div>`;
  }

  function successView() {
    const t = totals();
    const paid = state.plan === "installments" ? t.first : t.total;
    const destination = state.contact.email || "вашия имейл";
    return `
      <div class="success-page step-view">
        <header class="success-view">
          <span class="success-icon" aria-hidden="true">✓</span>
          <p class="eyebrow">Демо поръчка</p>
          <h2>Демо поръчката е готова.</h2>
          <p>Не е извършено плащане и не са изпратени билети. Имейл за контакт: <strong>${safe(destination)}</strong>.</p>
        </header>
        <div class="success-grid">
          <section class="success-card success-order">
            <p class="success-label">Поръчка №</p>
            <strong class="success-order__number">${safe(state.orderNumber)}</strong>
            <div class="success-paid">
              <span>${state.plan === "installments" ? "Първа вноска по избрания план" : "Сума по избрания план"}</span>
              <strong>${money(paid)}</strong>
              <small>${ticketCount()} бр. · вкл. такси ${money(t.service)}${state.plan === "installments" ? " · " + state.installmentCount + " вноски" : ""}</small>
            </div>
            <a class="button button--primary success-orders" href="../?restore=1">Обратно към местата</a>
            <a class="success-home" data-arena-home href="${localDemo ? "../../prototype/" : "https://arena-8888.vercel.app/"}">Към началната</a>
          </section>
          <div class="success-side">
            <section class="success-card success-event-card">
              <img src="../assets/ceca.webp" alt="" />
              <div><h3>CECA</h3><p>▣&nbsp; 7 ноември 2026, събота</p><p>◷&nbsp; 20:00 · ${safe(sectionLabel())}</p></div>
            </section>
            <section class="success-card success-next">
              <p class="success-label">Вашият избор</p>
              <div class="success-timeline">
                <div class="is-done"><i>✓</i><strong>Начин на плащане</strong><span>${safe(METHODS[state.paymentMethod].label)}</span></div>
                <div class="is-done"><i>✓</i><strong>Билети</strong><span>${ticketCount()} ${(cart?.items || []).some((item) => item.type === "standing") ? (ticketCount() === 1 ? "билет" : "билета") : ticketCount() === 1 ? "избрано място" : "избрани места"}</span></div>
                <div><i></i><strong>Дата на концерта</strong><span>7 ноември 2026</span></div>
              </div>
            </section>
          </div>
        </div>
        <p class="success-note">Това е демонстрационна поръчка - не е извършено реално плащане.</p>
      </div>`;
  }

  // Анимацията на появяване е само за нова стъпка. Прерисуване в същата
  // стъпка (план, вноски, гаранция) става на място: без премигване, без
  // промяна на височината и със запазен фокус.
  let renderedView = "";
  function renderContent() {
    const view = state.complete ? "done" : String(state.step);
    const sameView = view === renderedView;
    const focusedId = sameView && content.contains(document.activeElement) ? document.activeElement.id : "";
    const focusedChoice = sameView && content.contains(document.activeElement)
      ? ["plan", "installments", "payment", "guarantee"].map(function (key) {
          return document.activeElement.hasAttribute("data-" + key) ? { key, value: document.activeElement.getAttribute("data-" + key) } : null;
        }).find(Boolean) : null;
    if (sameView) content.style.minHeight = content.offsetHeight + "px";
    content.innerHTML = state.complete ? successView() : [contactView, planView, paymentView, reviewView][state.step - 1]();
    content.querySelectorAll("[data-plan], [data-installments]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.classList.contains("is-selected")));
    });
    if (sameView) {
      const stepView = content.querySelector(".step-view");
      if (stepView) stepView.classList.add("step-view--settled");
      if (focusedId) {
        const again = document.getElementById(focusedId);
        if (again) again.focus({ preventScroll: true });
      } else if (focusedChoice) {
        const again = [...content.querySelectorAll("[data-" + focusedChoice.key + "]")].find(function (el) {
          return el.getAttribute("data-" + focusedChoice.key) === focusedChoice.value;
        });
        if (again) again.focus({ preventScroll: true });
      }
      requestAnimationFrame(function () { content.style.minHeight = ""; });
    }
    renderedView = view;
  }

  // Правостоящи: един ред с броя билети. Заглавието носи „× N", подзаглавието -
  // цената на билет, защото мястото не е номерирано.
  function itemTitle(item) {
    if (item.type === "standing") return (item.sector || item.name || "Правостоящи") + " × " + Math.max(1, Number(item.quantity) || 1);
    return item.sector || "Избрано място";
  }
  function itemSubtitle(item) {
    if (item.type === "standing") return "Без номерирано място · " + money(cents(item.unitPrice != null ? item.unitPrice : item.lineTotal / Math.max(1, Number(item.quantity) || 1))) + " на билет";
    if (item.type === "table") return "Цяла маса · " + Math.max(1, Number(item.quantity) || TABLE_SEATS_FALLBACK) + " места";
    const details = [];
    if (item.row) details.push("ред " + item.row);
    if (item.seat) details.push("място " + item.seat);
    return details.join(" · ") || "Избрано място";
  }

  function renderSummary() {
    const t = totals();
    const count = ticketCount();
    const items = cart.items.map(function (item) {
      return `
        <article class="summary-item">
          <strong>${safe(itemTitle(item))}</strong>
          <span>${safe(itemSubtitle(item))}</span>
          <span class="summary-item__price">${money(cents(item.lineTotal))}</span>
          <button class="summary-remove" data-remove="${safe(item.id)}" aria-label="Премахнете ${safe(itemTitle(item))} · ${safe(itemSubtitle(item))}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"></path></svg>
          </button>
        </article>`;
    }).join("");
    const detailLines = `
      ${t.interest ? `<div class="summary-line"><span>Лихва при ${t.count} вноски</span><strong>${money(t.interest)}</strong></div>` : ""}
      ${t.guarantee ? `<div class="summary-line summary-line--accent"><span>Гаранция за връщане</span><strong>${money(t.guarantee)}</strong></div>` : ""}
      <div class="summary-line"><span>Такса обслужване</span><strong>${money(t.service)}</strong></div>`;
    const installmentLine = state.plan === "installments" && state.installmentCount && (state.step >= 2 || state.complete)
      ? `<div class="summary-line summary-line--accent"><span>Дължимо днес</span><strong>${money(t.first)}</strong></div>`
      : "";
    const promo = state.step === 4 && !state.complete ? `
      <details class="promo">
        <summary>Имам промо код</summary>
        <div class="promo-row"><input class="input" data-promo placeholder="Код" value="${safe(state.promoCode)}" /><button class="button button--ghost" data-action="promo">Приложете</button></div>
        ${state.promoMessage ? `<p class="promo-message ${safe(state.promoStatus)}">${safe(state.promoMessage)}</p>` : ""}
      </details>` : "";
    summary.innerHTML = `
      <div class="summary-title"><h2>Вашите билети</h2><span class="summary-count">${count}</span></div>
      <div class="summary-items">${items}</div>
      <div class="summary-lines">
        <div class="summary-line"><span>Билети (${count})</span><strong>${money(t.tickets)}</strong></div>
        ${detailLines}${installmentLine}
        <div class="summary-total"><span>Обща сума</span><strong>${money(t.total)}</strong></div>
      </div>${promo}`;
  }

  function renderHero() {
    sector.textContent = sectionLabel();
  }

  function render() {
    document.body.classList.toggle("checkout-complete", state.complete);
    if (!cart || !Array.isArray(cart.items) || !cart.items.length) {
      grid.hidden = true;
      empty.hidden = false;
      sector.textContent = "Няма избрани места";
      return;
    }
    empty.hidden = true;
    grid.hidden = false;
    renderHero();
    renderSteps();
    renderContent();
    renderSummary();
    persist();
  }

  // Избор, след който няма друго решение на стъпката, я затваря сам след
  // кратка пауза - достатъчна да се види отметката, но без второ докосване.
  let advanceTimer = 0;
  function advanceSoon(step, message) {
    clearTimeout(advanceTimer);
    const selected = content.querySelector(".is-selected");
    if (selected) selected.classList.add("is-confirming");
    notify(message);
    advanceTimer = window.setTimeout(function () {
      if (state.complete || state.step >= step) return;
      setStep(step);
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 200 : 520);
  }

  function focusContact() {
    // Само с мишка/тракпад: на телефон фокусът отваря клавиатурата и мести
    // страницата, преди човекът да е видял формата.
    if (matchMedia("(pointer: coarse)").matches) return;
    const inputs = [...content.querySelectorAll("[data-contact]")];
    const target = inputs.find((input) => !fieldValid(input.dataset.contact)) || inputs[0];
    if (target) target.focus({ preventScroll: true });
  }

  function setStep(next) {
    clearTimeout(advanceTimer);
    next = clamp(Number(next) || 1, 1, 4);
    if (next > state.maxStep + 1) return;
    // Непопълнена стъпка не се прескача мълчаливо: връщаме на нея, казваме
    // какво липсва и слагаме фокуса върху първия избор.
    let blocked = "";
    let focus = "";
    if (next >= 2 && Object.keys(contactErrors()).length) {
      next = 1;
      blocked = "contact";
    } else if (next >= 3 && !state.plan) {
      next = 2;
      blocked = "Изберете как ще платите: сега или на вноски.";
      focus = "[data-plan]";
    } else if (next >= 3 && state.plan === "installments" && !state.installmentCount) {
      next = 2;
      blocked = "Изберете броя вноски.";
      focus = "[data-installments]";
    } else if (next === 4 && !state.paymentMethod) {
      next = 3;
      blocked = "Изберете начин на плащане.";
      focus = "[data-payment]";
    }
    state.step = next;
    state.maxStep = Math.max(state.maxStep, next);
    state.complete = false;
    if (!blocked) {
      clearTimeout(toastTimer);
      toast.hidden = true;
    }
    render();
    if (blocked === "contact") {
      const first = markContactErrors(contactErrors());
      notify("Попълнете отбелязаните полета, за да продължите.");
      if (first) first.focus();
      return;
    }
    if (blocked) {
      notify(blocked);
      focusFirst(focus);
      return;
    }
    // Скролът спира на самата стъпка: на телефон над нея стоят герой и
    // кошница, а човекът вече ги е видял.
    steps.closest(".checkout-card").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce), (pointer:coarse)").matches ? "auto" : "smooth", block: "start" });
    if (state.step === 1) focusContact();
    else {
      const heading = content.querySelector("h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }

  content.addEventListener("input", function (event) {
    const input = event.target;
    const key = input.dataset.contact;
    if (!key) return;
    let value = input.value;
    if (key === "phone") {
      // Полето показва „888 123 456", в състоянието стоят само цифрите.
      const digits = phoneDigits(value);
      const display = phoneDisplay(digits);
      if (input.value !== display) input.value = display;
      value = digits;
    } else if (key === "email") {
      const hint = content.querySelector("#email-hint");
      const cyrillic = emailHadCyrillic(value);
      // Запазваме адреса дословно: изтриването на буква може да го
      // превърне в друг валиден адрес. Проверката блокира невалидния имейл.
      if (hint) hint.hidden = !cyrillic;
    } else {
      value = value.replace(/\s{2,}/g, " ");
    }
    state.contact[key] = value;
    persist();
    // Поправеното поле се чисти веднага; нови грешки се показват чак при
    // излизане от полето, за да не се червенее, докато човекът още пише.
    if (input.getAttribute("aria-invalid") === "true") markContactErrors(contactErrors(), true);
    markFieldValidity(input);
  });

  // Излизане от попълнено, но грешно поле: причината се показва веднага,
  // не чак на „Продължете". Празно поле не се червенее само от прескачане.
  content.addEventListener("focusout", function (event) {
    const input = event.target;
    const key = input.dataset && input.dataset.contact;
    if (!key) return;
    if (key === "firstName" || key === "lastName") {
      const trimmed = String(input.value || "").trim();
      const capitalised = trimmed ? trimmed.charAt(0).toLocaleUpperCase("bg-BG") + trimmed.slice(1) : "";
      if (capitalised !== input.value) {
        input.value = capitalised;
        state.contact[key] = capitalised;
        persist();
      }
    }
    const errors = contactErrors();
    const shown = {};
    content.querySelectorAll("[data-contact]").forEach(function (other) {
      const k = other.dataset.contact;
      if (errors[k] && (String(state.contact[k] || "").trim() || other.getAttribute("aria-invalid") === "true")) shown[k] = errors[k];
    });
    markContactErrors(shown, false);
    markFieldValidity(input);
  });

  // Enter води към следващото празно поле; от последното продължава напред.
  content.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || !event.target.dataset || !event.target.dataset.contact) return;
    event.preventDefault();
    const next = nextContactInput(event.target);
    if (next && !fieldValid(next.dataset.contact)) next.focus();
    else setStep(state.step + 1);
  });

  content.addEventListener("change", function (event) {
    if (event.target.matches("[data-terms]")) {
      // Само състоянието: прерисуване тук пускаше анимацията на стъпката
      // отново и страницата премигваше и скачаше при всяко тикване.
      state.terms = event.target.checked;
      const terms = event.target.closest(".terms");
      if (terms && state.terms) terms.classList.remove("is-missing");
      if (state.terms) event.target.removeAttribute("aria-invalid");
      persist();
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.matches("[data-promo]")) {
      state.promoCode = event.target.value;
      state.promoMessage = "";
      state.promoStatus = "";
      persist();
    }
  });

  document.addEventListener("click", function (event) {
    const control = event.target.closest("button, a");
    if (!control) return;

    if (control.matches("[data-demo-link]")) {
      event.preventDefault();
      notify("Общите условия са част от демонстрационния интерфейс.");
      return;
    }

    if (control.dataset.step) {
      setStep(control.dataset.step);
      return;
    }

    if (control.dataset.plan) {
      clearTimeout(advanceTimer);
      state.plan = control.dataset.plan;
      state.installmentCount = state.plan === "installments" ? state.installmentCount || 2 : null;
      if (state.plan === "installments" && state.paymentMethod === "econt") state.paymentMethod = null;
      render();
      // „Платете сега" няма какво повече да се избира: стъпката се затваря сама.
      // Вноските остават на екрана, за да се види разбивката, преди „Продължете".
      if (state.plan === "now") advanceSoon(3, "Плащане наведнъж. Изберете как.");
      return;
    }

    if (control.dataset.installments) {
      clearTimeout(advanceTimer);
      state.plan = "installments";
      state.installmentCount = Number(control.dataset.installments);
      render();
      return;
    }

    if (control.dataset.payment) {
      state.paymentMethod = control.dataset.payment;
      content.querySelectorAll("[data-payment]").forEach(function (card) {
        const selected = card.dataset.payment === state.paymentMethod;
        card.classList.toggle("is-selected", selected);
        card.setAttribute("aria-pressed", String(selected));
      });
      const nextButton = content.querySelector('[data-action="next"]');
      if (nextButton) nextButton.disabled = false;
      persist();
      advanceSoon(4, METHODS[state.paymentMethod].short + ". Остава само прегледът.");
      return;
    }

    if (control.dataset.guarantee) {
      if (control.dataset.guarantee === "yes") {
        state.guarantee = true;
        render();
      } else if (control.dataset.guarantee === "unset") {
        state.guarantee = null;
        render();
      } else if (typeof declineDialog.showModal === "function") {
        declineDialog.showModal();
      } else {
        declineDialog.setAttribute("open", "");
      }
      return;
    }

    if (control.dataset.remove) {
      const next = cart.items.filter((item) => String(item.id) !== control.dataset.remove);
      if (!validSeating(next)) return;
      cart.items = next;
      cart.ticketCount = ticketCount();
      cart.subtotal = subtotal() / 100;
      state.guarantee = null;
      render();
      return;
    }

    const action = control.dataset.action;
    if (!action) return;
    if (action === "back") setStep(state.step - 1);
    if (action === "next") setStep(state.step + 1);
    if (action === "promo") {
      state.promoMessage = "Промо кодът не е активен за тази демо поръчка.";
      state.promoStatus = "is-bad";
      render();
    }
    if (action === "orders") notify("Поръчката е демонстрационна и не е добавена към реален профил.");
    if (action === "finish") {
      if (!validSeating(cart.items)) return;
      if (Object.keys(contactErrors()).length || !state.plan || !state.paymentMethod || (state.plan==='installments' && !state.installmentCount)) {
        setStep(4); return;
      }
      if (state.guarantee === null) {
        notify("Изберете дали искате гаранция за връщане.");
        const card = content.querySelector(".guarantee-card");
        if (card) card.classList.add("is-missing");
        focusFirst(".guarantee-hit--yes");
        return;
      }
      if (!state.terms) {
        notify("Приемете общите условия, за да завършите поръчката.");
        const terms = content.querySelector(".terms");
        if (terms) terms.classList.add("is-missing");
        const box = focusFirst("[data-terms]");
        if (box) box.setAttribute("aria-invalid", "true");
        return;
      }
      state.complete = true;
      state.orderNumber = "A8888-" + String(Date.now()).slice(-6);
      render();
    }
  });

  document.getElementById("keep-guarantee").addEventListener("click", function (event) {
    event.preventDefault();
    state.guarantee = true;
    declineDialog.close();
    render();
  });

  document.getElementById("decline-guarantee").addEventListener("click", function (event) {
    event.preventDefault();
    state.guarantee = false;
    declineDialog.close();
    render();
  });

  declineDialog.addEventListener("click", function (event) {
    if (event.target === declineDialog) declineDialog.close();
  });

  clock.textContent = 'Демо · без резервация';

  // Стар запис в sessionStorage може да носи телефон с интервали или тирета.
  state.contact.phone = phoneDigits(state.contact.phone);
  state.contact.email = String(state.contact.email || "");

  render();
  if (state.step === 1 && !state.complete && cart) focusContact();
})();
