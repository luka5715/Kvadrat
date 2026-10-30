/* Kvadrat.rs — ui: dizajn-sistem kao DOM-graditelji. Ikone, logo, zaglavlje/podnožje/donja navigacija, kartice (grid/list/compact),
   oznake, Δ čip, Merilo, blok cene, ključni podaci, Komšiluk, tabovi, harmonika, modal/donji list, tooltip, skeleton, učitavač,
   prazno stanje, paginacija, mrvice, pločice, sparkline/bars/histogram, pinovi, galerija/lightbox, agencija, kontakt, poređenje,
   koraci, tabela, kontrole (segment, pilule, tagovi, polja, checkbox, prekidač, opseg, select).
   Zavisi od core.js (D, el, $, hash, rng, fmt, stats, mock, store, toast, mortgage, TYPES/COND/HEAT/FURN/ORIENT/AMEN) i images.js (img).
   Sve se izvozi preko window.* na kraju fajla; nijedan drugi globalni identifikator se ne deklariše. */
'use strict';

(function () {
  /* ───────── pomoćno ───────── */
  const S = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const plu = (n, a, b, c) => S(() => fmt.plural(n, a, b, c), (n % 10 === 1 && n % 100 !== 11) ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? b : c);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const nf0 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 1 });
  const isPhone = () => window.matchMedia('(max-width:860px)').matches;
  const ari = (m2) => nf1.format(m2 / 100) + ' ari';
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
  const monthLabel = (ym) => { const [y, m] = String(ym).split('-'); return `${MONTHS[(+m - 1) || 0]} ’${String(y).slice(2)}`; };
  const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'K';
  const sr = (text) => el('span', { class: 'sr' }, text);
  const toastSafe = (msg) => S(() => toast(msg));

  /* kanonske adrese iz tabele ruta (app.js preusmerava i stare oblike #/oglas/<slug>, #/agencije/<slug>, #/prodaja/…) */
  const PT_PLURAL = { stanovi: 'stan', kuce: 'kuca', 'poslovni-prostori': 'poslovni-prostor', zemljista: 'zemljiste', garaze: 'garaza', sobe: 'soba', vikendice: 'vikendica' };
  const enc = (v) => encodeURIComponent(v);
  const href = {
    listing: (l) => '#/oglas?s=' + enc(typeof l === 'string' ? l : l.s),
    agency: (a) => '#/agencija?s=' + enc(typeof a === 'string' ? a : a.s),
    agencies: '#/agencije',
    /* search('prodaja', 'stan' | 'stanovi', 'beograd') → '#/pretraga?t=prodaja&pt=stan&c=beograd' */
    search: (t = 'prodaja', pt = 'stan', c = '') => '#/pretraga?' + ['t=' + enc(t), pt ? 'pt=' + enc(PT_PLURAL[pt] || pt) : '', c ? 'c=' + enc(c) : ''].filter(Boolean).join('&'),
    map: '#/mapa',
    saved: '#/sacuvani',
    compare: '#/uporedi',
    calc: (l) => '#/kalkulator' + (l && l.s ? '?s=' + enc(l.s) : l && l.p ? '?p=' + l.p : ''),
    post: '#/postavi',
    profile: '#/moja-mesta',
    home: '#/',
  };
  const NAV = [
    ['#/pretraga?t=prodaja', 'Prodaja', '/prodaja'],
    ['#/pretraga?t=izdavanje', 'Izdavanje', '/izdavanje'],
    ['#/novogradnja', 'Novogradnja', '/novogradnja'],
    ['#/mapa', 'Mapa', '/mapa'],
    ['#/agencije', 'Agencije', '/agencije'],
    ['#/saveti', 'Saveti', '/saveti'],
  ];
  const isActive = (path, base) => !!path && (path === base || path.startsWith(base + '/') || path.startsWith(base + '?'));

  /* ───────── ikone (24×24, linija 1.75) ───────── */
  const ICON = {
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    walk: '<circle cx="13" cy="4" r="1.5"/><path d="M12 7l-2.5 5 3 2.5V21M9.5 12 6.5 19M12 8l3 3.5 2.5-1"/>',
    heart: '<path d="M19.5 12.6 12 20l-7.5-7.4a4.6 4.6 0 0 1 6.5-6.5l1 1 1-1a4.6 4.6 0 0 1 6.5 6.5z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    'chev-d': '<path d="m6 9 6 6 6-6"/>', 'chev-u': '<path d="m6 15 6-6 6 6"/>', 'chev-r': '<path d="m9 6 6 6-6 6"/>', 'chev-l': '<path d="m15 6-6 6 6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    'zoom-in': '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M11 8v6M8 11h6"/>',
    'zoom-out': '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8 11h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/>',
    share: '<path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/>',
    compare: '<path d="M4 5h6v14H4zM14 5h6v14h-6z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    filter: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    map: '<path d="m9 4 6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    home: '<path d="M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5M10 21v-6h4v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>', 'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>', 'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    building: '<path d="M4 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15M12 21V11h6a1 1 0 0 1 1 1v9M7 9h2M7 13h2M7 17h2M15 15h1M15 18h1"/>',
    house: '<path d="M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5M10 21v-6h4v6"/>',
    office: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h2M13 10h2M9 14h2M13 14h2M9 18h6"/>',
    land: '<path d="M3 19h18M4 19l3-8 4 4 3-6 6 10"/>',
    garage: '<path d="M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 16h10"/>',
    bed: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 14h18M6 10V7h5v3"/>',
    bath: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0"/>',
    area: '<path d="M4 4h16v16H4zM9 4v16M4 9h16"/>',
    parking: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9 17V8h4a2.5 2.5 0 0 1 0 5H9"/>',
    elevator: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M7.5 10l1.5-2 1.5 2M13.5 14l1.5 2 1.5-2"/>',
    balcony: '<path d="M4 11h16v9H4zM8 11v9M12 11v9M16 11v9M6 11V5h12v6"/>',
    sofa: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v5H3z"/>',
    flag: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M19 14v6H5V6h6"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
    draw: '<path d="m4 20 4-1 11-11-3-3L5 16z"/><path d="m13 8 3 3"/>',
    locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    download: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    alert: '<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
    sort: '<path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/>',
    doc: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
    school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v5"/>',
    market: '<path d="M3 10h18l-2 10H5zM8 10l4-6 4 6M3 14h18"/>',
    park: '<path d="M12 3 6 12h3l-3 5h12l-3-5h3zM12 17v4"/>',
    bus: '<rect x="4" y="4" width="16" height="14" rx="2"/><path d="M4 11h16M8 18v2M16 18v2M8 14.5h.01M16 14.5h.01"/>',
    tram: '<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M5 12h14M9 18l-1.5 3M15 18l1.5 3M9 3l3 3 3-3M9 15h.01M15 15h.01"/>',
    shop: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M10 20v-6h4v6"/>',
    blocks: '<rect x="4" y="12" width="7" height="8"/><rect x="13" y="12" width="7" height="8"/><rect x="8.5" y="4" width="7" height="8"/>',
    euro: '<path d="M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10"/>',
    ruler: '<path d="M3 17 17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2"/>',
    stairs: '<path d="M4 20h4v-4h4v-4h4V8h4"/>',
    fire: '<path d="M12 3s5 4 5 10a5 5 0 0 1-10 0c0-2 1-3 1-3s0 3 2 3c1 0 2-1 2-3s-2-4 0-7z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-4 2 2-5z"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="m11 11 9-9M17 5l2 2M14 8l2 2"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    print: '<path d="M7 8V3h10v5M5 8h14a2 2 0 0 1 2 2v6h-4v4H7v-4H3v-6a2 2 0 0 1 2-2zM7 14h10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    'empty-search': '<rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="11" cy="11" r="3.5"/><path d="m13.5 13.5 3.5 3.5"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="1"/>',
  };
  const iconStr = (name, size = 18, cls = '') =>
    `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"${size !== 18 ? ` style="--ico:${size}px"` : ''}>${ICON[name] || ICON.square}</svg>`;
  function icon(name, size = 18, cls = '') {
    const t = document.createElement('template');
    t.innerHTML = iconStr(name, size, cls);
    return t.content.firstChild;
  }
  icon.str = iconStr;
  icon.names = () => Object.keys(ICON);

  /* ───────── tooltip (§5.19) ───────── */
  let tipNode = null, tipTimer = 0;
  function showTip(target, text) {
    hideTip();
    tipNode = el('div', { class: 'tip', role: 'tooltip' }, text);
    document.body.appendChild(tipNode);
    const r = target.getBoundingClientRect();
    let x = r.left + r.width / 2, y = r.top;
    const w = tipNode.offsetWidth;
    x = clamp(x, w / 2 + 8, window.innerWidth - w / 2 - 8);
    if (r.top < 48) { tipNode.classList.add('below'); y = r.bottom; }
    tipNode.style.left = x + 'px'; tipNode.style.top = y + 'px';
  }
  function hideTip() { clearTimeout(tipTimer); if (tipNode) { tipNode.remove(); tipNode = null; } }
  let tipSeq = 0;
  function tip(node, text) {
    if (!node || !text) return node;
    /* čvor bez sopstvenog teksta (ili role=img) dobija aria-label; čvor sa vidljivim tekstom dobija opis (ime ostaje netaknuto) */
    /* postojeći aria-label (npr. „Objašnjenje” na dugmetu sa ikonom) ostaje ime; tekst saveta ide u opis */
    if (node.getAttribute('role') === 'img' || (!node.textContent.trim() && !node.hasAttribute('aria-label'))) node.setAttribute('aria-label', text);
    else { const d = el('span', { class: 'sr', id: 'tip-' + (++tipSeq), 'aria-hidden': 'true' }, text); node.appendChild(d); node.setAttribute('aria-describedby', d.id); }
    node.addEventListener('mouseenter', () => { clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(node, text), 300); });
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('focus', () => showTip(node, text));
    node.addEventListener('blur', hideTip);
    node.addEventListener('click', (e) => { if (tipNode) hideTip(); else showTip(node, text); e.stopPropagation(); });
    return node;
  }
  document.addEventListener('click', () => { if (tipNode) hideTip(); });
  document.addEventListener('scroll', () => { if (tipNode) hideTip(); }, { passive: true });

  /* ───────── logo (§5.30) ───────── */
  function logo(opts = {}) {
    return el('a', { class: 'logo', href: href.home, 'aria-label': 'Kvadrat.rs — početna' },
      el('span', { class: 'mark', 'aria-hidden': 'true' }), 'Kvadrat', el('small', {}, '.rs'));
  }

  /* ───────── tema ───────── */
  const THEME_KEY = 'kv.theme';
  function currentTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  }
  function setTheme(next) {
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* privatni režim */ }
    document.querySelectorAll('.theme-toggle').forEach(paintToggle);
  }
  function paintToggle(b) {
    const dark = currentTheme() === 'dark';
    b.innerHTML = '';
    b.appendChild(icon(dark ? 'sun' : 'moon'));
    b.setAttribute('aria-label', dark ? 'Uključi svetlu temu' : 'Uključi tamnu temu');
    b.setAttribute('title', dark ? 'Svetla tema' : 'Tamna tema');
  }
  function themeToggle() {
    const b = el('button', { class: 'iconbtn theme-toggle', type: 'button', onclick: () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark') });
    paintToggle(b);
    return b;
  }
  (function applyStoredTheme() {
    try { const t = localStorage.getItem(THEME_KEY); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* ignore */ }
  })();

  /* ───────── zaglavlje, donja navigacija, podnožje (§4) ───────── */
  function favCount() { return S(() => store.favs.size, 0); }
  function savedButton() {
    const b = el('a', { class: 'iconbtn', href: href.saved, 'aria-label': 'Sačuvani oglasi' }, icon('heart'));
    const paint = () => { const n = favCount(); const old = b.querySelector('.cnt'); if (old) old.remove(); if (n) b.appendChild(el('span', { class: 'cnt', 'aria-hidden': 'true' }, String(n))); b.setAttribute('aria-label', n ? `Sačuvani oglasi (${n})` : 'Sačuvani oglasi'); };
    paint();
    S(() => { const off = store.on(() => { if (!b.isConnected) { if (typeof off === 'function') off(); return; } paint(); }); });
    return b;
  }
  function openMenu(path) {
    const list = el('nav', { class: 'menu-list', 'aria-label': 'Meni' },
      NAV.map(([h, label, base]) => el('a', { href: h, 'aria-current': isActive(path, base) ? 'page' : null, onclick: () => menu.close() }, label, icon('chev-r'))),
      el('a', { href: href.saved, onclick: () => menu.close() }, 'Sačuvano', icon('chev-r')),
      el('a', { href: href.compare, onclick: () => menu.close() }, 'Uporedi', icon('chev-r')),
      el('a', { href: '#/kalkulator', onclick: () => menu.close() }, 'Kalkulator kredita', icon('chev-r')));
    const menu = sheet('Meni', list, { footer: [el('a', { class: 'btn btn-ink', href: href.post, onclick: () => menu.close() }, 'Postavi oglas')] });
    return menu;
  }
  function bottomNav(path) {
    const items = [
      ['#/pretraga?t=prodaja', 'Pretraga', 'search', ['/prodaja', '/izdavanje', '/novogradnja', '/pretraga']],
      [href.map, 'Mapa', 'map', ['/mapa']],
      [href.post, 'Postavi', 'plus', ['/postavi']],
      [href.saved, 'Sačuvano', 'heart', ['/sacuvano']],
      [href.profile, 'Profil', 'user', ['/profil']],
    ];
    return el('nav', { class: 'bnav', 'aria-label': 'Donja navigacija' },
      items.map(([h, label, ic, bases]) => el('a', { href: h, 'aria-current': bases.some((b) => isActive(path, b)) ? 'page' : null },
        ic === 'plus' ? el('span', { class: 'post' }, icon('plus')) : icon(ic), el('span', {}, label))));
  }
  /* brza pretraga (⌘K / Ctrl+K): otvara paletu ljuske (global.js) kad postoji, inače vodi na pretragu */
  function quickSearchButton() {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    return el('button', { class: 'iconbtn kv-search', type: 'button', 'aria-label': 'Brza pretraga', 'aria-keyshortcuts': mac ? 'Meta+K' : 'Control+K', title: 'Brza pretraga (' + (mac ? '⌘K' : 'Ctrl+K') + ')',
      onclick: () => { const pal = S(() => window.KVG.palette, null); if (pal && pal.open) pal.open(); else location.hash = '#/pretraga?t=prodaja'; } },
    icon('search'), el('span', { class: 'kv-search-l' }, 'Pretraga'), el('kbd', { class: 'kv-search-k' }, mac ? '⌘K' : 'Ctrl K'));
  }
  function header(path = '/') {
    /* stalni skip link u <body> (index.html) ima prednost; zaglavlje dodaje svoj samo kad ga nema (galerija komponenti) */
    const permanentSkip = !!document.querySelector('body > .kv-skip');
    const hdr = el('header', { class: 'hdr' },
      permanentSkip ? null : el('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); const m = document.getElementById('main') || document.querySelector('main'); if (m) { m.tabIndex = -1; m.focus(); m.scrollIntoView(); } } }, 'Preskoči na sadržaj'),
      el('div', { class: 'wrap' },
        logo(),
        el('nav', { class: 'nav', 'aria-label': 'Glavna navigacija' },
          NAV.map(([h, label, base]) => el('a', { href: h, 'aria-current': isActive(path, base) ? 'page' : null }, label))),
        el('div', { class: 'hdr-r' },
          quickSearchButton(),
          themeToggle(),
          savedButton(),
          el('a', { class: 'btn btn-ink btn-sm', href: href.post }, 'Postavi oglas'),
          el('button', { class: 'iconbtn burger', type: 'button', 'aria-label': 'Otvori meni', onclick: () => openMenu(path) }, icon('menu')))),
      bottomNav(path));
    document.body.classList.add('has-bnav');
    return hdr;
  }
  function footer() {
    const cities = S(() => D.cities.filter((c) => c.maj).slice(0, 6), []);
    const col = (title, links) => el('div', { class: 'ftr-col' }, el('h4', {}, title), links.map(([h, l]) => el('a', { href: h }, l)));
    return el('footer', { class: 'ftr' },
      el('div', { class: 'wrap' },
        el('div', { class: 'ftr-top' },
          el('div', { class: 'ftr-brand' },
            el('a', { class: 'wordmark', href: href.home }, el('span', { class: 'mark', 'aria-hidden': 'true' }), 'Kvadrat.rs'),
            el('p', { class: 'tagline' }, 'Nekretnine u Srbiji, kvadrat po kvadrat. Cena po m² i poređenje sa prosekom uz svaki oglas.')),
          col('Nekretnine', [[href.search('prodaja', 'stan'), 'Prodaja stanova'], [href.search('prodaja', 'kuca'), 'Prodaja kuća'], [href.search('izdavanje', 'stan'), 'Izdavanje stanova'], ['#/novogradnja', 'Novogradnja'], [href.search('prodaja', 'poslovni-prostor'), 'Poslovni prostori'], [href.search('prodaja', 'zemljiste'), 'Zemljišta']]),
          col('Gradovi', cities.map((c) => [href.search('prodaja', 'stan', c.s), c.n])),
          col('Kvadrat', [['#/trziste', 'Tržište'], ['#/kalkulator', 'Kalkulator kredita'], ['#/procena', 'Procena vrednosti'], ['#/agencije', 'Agencije'], ['#/saveti', 'Saveti'], ['#/postavi', 'Postavi oglas']]),
          col('Pomoć', [['#/pomoc', 'Česta pitanja'], ['#/kontakt', 'Kontakt'], ['#/uslovi', 'Uslovi korišćenja'], ['#/privatnost', 'Privatnost'], ['#/prijava', 'Prijavi oglas']])),
        el('div', { class: 'ftr-bot' },
          el('span', {}, '© 2026 Kvadrat.rs · Podaci su generisani za potrebe prikaza.'),
          el('nav', { 'aria-label': 'Jezik' }, el('span', {}, 'Srpski (latinica)'), el('a', { href: '#/uslovi' }, 'Uslovi'), el('a', { href: '#/privatnost' }, 'Privatnost')))));
  }

  /* ───────── oznake (§5.6) ───────── */
  const BADGES = {
    novogradnja: ['badge-new', 'Novogradnja'], uknjizeno: ['badge-reg', 'Uknjiženo'], snizena: ['badge-sale', 'Snižena cena'],
    hitno: ['badge-urgent', 'Hitno'], premium: ['badge-top', 'Premium'], top: ['badge-top', 'Top'], novo: ['badge-fresh', 'Novo'],
    verifikovan: ['badge-verified', 'Verifikovana agencija'], vlasnik: ['', 'Vlasnik'],
  };
  function badge(kind, label) {
    const [cls, text] = BADGES[kind] || ['', kind];
    return el('span', { class: 'badge' + (cls ? ' ' + cls : ''), 'data-kind': kind }, kind === 'verifikovan' ? icon('check') : null, label || text);
  }
  /* snižena cena — jedini izvor je KX.history (isto što prikazuju oglas, poređenje i filter „Snižena cena”);
     bez engine-a (galerija komponenti) ostaje deterministički mock (≈11 % oglasa, stara cena ≈ +4–8 %) */
  const hasKX = () => typeof KX !== 'undefined' && KX && typeof KX.history === 'function';
  function saleInfo(l) {
    if (hasKX()) {
      const h = S(() => KX.history(l), null);
      const c = h && h.changes && h.changes.length ? h.changes[h.changes.length - 1] : null;
      if (!c || !(c.from > c.to)) return null;
      return { old: c.from, pct: Math.round((1 - c.to / c.from) * 1000) / 10, m: c.m, d: c.d || null };
    }
    const h = hash(l.s + '#sale');
    if (h % 9 !== 0) return null;
    const pct = 1.04 + (h % 5) / 100;
    const step = l.p >= 10000 ? 500 : l.p >= 1000 ? 10 : 5;
    return { old: Math.round(l.p * pct / step) * step, pct: Math.round((pct - 1) * 1000) / 10 };
  }
  function badgeKinds(l) {
    const k = [];
    if (l.pr === 'TOP') k.push('top'); else if (l.pr === 'PREMIUM') k.push('premium');
    if (l.co === 'novogradnja' || l.co === 'u-izgradnji') k.push('novogradnja');
    if (saleInfo(l)) k.push('snizena');
    /* „Uknjiženo” samo kad je pravni status zaista uknjiženo (semafor poverenja), ne samo po polju reg */
    const legal = hasKX() && l.t === 'prodaja' ? S(() => KX.trust(l).legal, null) : null;
    if (legal ? legal === 'uknjizeno' : l.reg) k.push('uknjizeno');
    if (l.dz <= 1) k.push('novo');
    return k;
  }
  function badgesFor(l, max = 2) { return badgeKinds(l).slice(0, max).map((k) => badge(k)); }

  /* ───────── Δ čip (§5.7) ───────── */
  function deltaChip(x, opts = {}) {
    const d = x && typeof x === 'object' && 's' in x ? S(() => stats.delta(x), null) : x;
    if (!d || d.pct == null || !isFinite(d.pct) || (d.n != null && d.n < 5)) return null;
    const pct = d.pct;
    const cls = Math.abs(pct) <= 1.5 ? 'flat' : pct > 0 ? 'up' : 'down';
    const txt = cls === 'flat' ? '±' + fmt.pct(Math.abs(pct)) : fmt.pct(pct, { sign: true });
    const ic = cls === 'up' ? 'arrow-up' : cls === 'down' ? 'arrow-down' : 'minus';
    /* nije Tab-stanica (10+ čipova po strani, 20px visine): objašnjenje čita čitač ekrana iz aria-label (role=img), a tooltip se otvara na prelaz i dodir */
    const n = el('span', { class: 'delta ' + cls, role: 'img' }, icon(ic), txt);
    /* bez padeža: „12,3 % ispod proseka · Čukarica (2.555 €/m²)” */
    const text = opts.title || (d.label ? `${fmt.pct(Math.abs(pct))} ${pct >= 0 ? 'iznad' : 'ispod'} proseka · ${d.label}${d.ppm ? ` (${fmt.ppm(d.ppm)})` : ''}` : (pct >= 0 ? 'Iznad proseka' : 'Ispod proseka'));
    tip(n, text);
    return n;
  }

  /* ───────── fotografija, ulica, hod, podaci ───────── */
  function photo(l, idx = 0, o = {}) {
    const node = S(() => img.el(l, idx, o), null);
    return node || el('div', { class: 'ph-fallback', style: 'width:100%;height:100%;background:var(--surface-2)' });
  }
  /* „Naselje, Opština” bez ponavljanja: kad je naselje = opština (Hadžet, Hadžet) ili = grad, ime se piše jednom */
  const same = (a, b) => !!a && !!b && S(() => fmt.fold(a), String(a).toLowerCase()) === S(() => fmt.fold(b), String(b).toLowerCase());
  function placeLine(l) {
    const parts = [];
    const add = (x) => { if (x && !parts.some((p) => same(p, x))) parts.push(x); };
    add(l.n); add(l.m && !same(l.m, l.c) ? l.m : l.c);
    return parts.join(', ');
  }
  /* streetLine(l, {exactOnly:true}) — bez izmišljene ulice: kad oglas nema adresu, samo „naselje, opština · približna lokacija” */
  function streetLine(l, o = {}) {
    const st = o.exactOnly ? (l.ad ? S(() => mock.street(l), l.ad) : null) : S(() => mock.street(l), l.ad || null);
    const place = placeLine(l);
    const text = st ? `${st} · ${place}` : o.exactOnly ? `${place} · približna lokacija` : place;
    return el('p', { class: 'street', title: text }, icon('pin'), el('span', {}, text));
  }
  function walkLine(l) {
    const w = S(() => mock.walk(l), null);
    if (!w || !w.min || !w.to) return null;
    const text = `${w.min} min hoda do ${w.to}`;
    return el('p', { class: 'walk', title: text }, icon('walk'), el('span', {}, text));
  }
  function roomsText(ro) {
    if (ro == null) return null;
    if (ro === 0.5) return 'garsonjera';
    /* isto pravilo kao fmt.roomsText: 1 soba, 2–4 sobe, decimalno → genitiv jednine („1,5 sobe”), 5+ soba */
    return fmt.roomsText(ro);
  }
  function factList(l) {
    const f = [];
    if (l.pt === 'zemljiste') { if (l.la || l.a) f.push(ari(l.la || l.a)); f.push('građevinsko'); return f; }
    if (l.a) f.push(fmt.m2(l.a));
    if (l.pt === 'garaza') { f.push(l.am && l.am.includes('hasGarage') ? 'zatvorena' : 'parking mesto'); return f; }
    if (l.pt === 'kuca' || l.pt === 'vikendica') { if (l.la) f.push(ari(l.la)); if (l.ro != null) f.push(roomsText(l.ro)); return f; }
    if (l.pt === 'poslovni-prostor') { if (l.fl != null) f.push(fmt.floor(l.fl, l.tf)); if (l.ro != null && l.ro >= 1) f.push(`${fmt.roomsN(l.ro)} prost.`); return f; }
    if (l.ro != null) f.push(roomsText(l.ro));
    if (l.fl != null) f.push(fmt.floor(l.fl, l.tf));
    return f;
  }
  function factsStrip(l) {
    return el('div', { class: 'facts' }, factList(l).filter(Boolean).map((t) => el('span', { class: 'fact' }, t)));
  }
  function priceEl(l, cls = 'price') {
    const sale = saleInfo(l);
    return el('span', { class: cls }, fmt.price(l.p, l.t), sale ? el('s', { 'aria-label': 'stara cena' }, fmt.price(sale.old, l.t)) : null);
  }
  function ctxEl(l) {
    if (!l.ppm || l.pt === 'zemljiste') return null;
    const chip = deltaChip(l);
    const ppm = el('span', { class: 'ppm' }, fmt.ppm(l.ppm));
    /* bez dovoljnog uzorka (n < 5) nema Δ čipa; €/m² stoji sam, uz prigušeno objašnjenje na prelazu */
    if (!chip && S(() => stats.delta(l).reason === 'malo', false)) { ppm.classList.add('nodelta'); ppm.title = 'Malo podataka: manje od 5 sličnih oglasa u okolini, pa nema poređenja sa prosekom'; }
    return el('span', { class: 'ctx' }, ppm, chip);
  }
  function favButton(l, extra = {}) {
    const on = () => S(() => store.isFav(l.s), false);
    const b = el('button', { class: 'fav', type: 'button', 'aria-pressed': on() ? 'true' : 'false', 'aria-label': on() ? 'Ukloni iz sačuvanih' : 'Sačuvaj oglas', ...extra }, icon('heart'));
    b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      S(() => store.toggleFav(l.s));
      const now = on();
      b.setAttribute('aria-pressed', now ? 'true' : 'false');
      b.setAttribute('aria-label', now ? 'Ukloni iz sačuvanih' : 'Sačuvaj oglas');
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      toastSafe(now ? 'Sačuvano · pogledaj u Sačuvano' : 'Uklonjeno iz sačuvanih');
    });
    S(() => { const off = store.on(() => { if (!b.isConnected) { if (typeof off === 'function') off(); return; } b.setAttribute('aria-pressed', on() ? 'true' : 'false'); }); });
    return b;
  }
  function footEl(l) {
    return el('div', { class: 'foot' },
      el('span', { class: 'ag' }, l.ag || 'Vlasnik', l.ag && l.agv ? icon('check') : null),
      el('time', { datetime: new Date(Date.now() - (l.dz || 0) * 864e5).toISOString().slice(0, 10) }, fmt.rel(l.dz || 0)));
  }
  function countEl(l) { return l.im ? el('span', { class: 'count' }, icon('camera'), String(l.im)) : null; }
  function titleEl(l, tag = 'h3') { return el(tag, {}, el('a', { href: href.listing(l) }, l.ti)); }

  /* ───────── kartice (§5.3–5.5) ───────── */
  /* card(l, variant, {price, extras}) — price: čvor ili tekst umesto cene (npr. „ukupno sa troškovima”), extras: čvorovi na kraju tela kartice */
  function card(l, variant = 'grid', opts) {
    const node = cardBase(l, variant);
    if (opts && typeof opts === 'object') {
      if (opts.price != null) { const pr = node.querySelector('.pricerow .price'); if (pr) pr.replaceWith(opts.price instanceof Node ? opts.price : el('span', { class: 'price' }, String(opts.price))); }
      if (opts.extras) { const body = node.querySelector('.body'); if (body) [].concat(opts.extras).filter(Boolean).forEach((x) => body.appendChild(x)); }
    }
    return node;
  }
  function cardBase(l, variant) {
    if (variant === 'list') return rowCard(l);
    if (variant === 'compact') return compactCard(l);
    const ph = el('a', { class: 'ph', href: href.listing(l), 'aria-label': l.ti, tabindex: '-1' }, photo(l, 0, { aspect: '4:3' }), el('div', { class: 'badges' }, badgesFor(l, 2)), countEl(l));
    return el('article', { class: 'card', 'data-slug': l.s },
      ph, favButton(l),
      el('div', { class: 'body' },
        el('div', { class: 'mid' },
          streetLine(l),
          el('div', { class: 'pricerow' }, priceEl(l), ctxEl(l)),
          titleEl(l),
          factsStrip(l),
          walkLine(l)),
        footEl(l)));
  }
  function rowCard(l) {
    const ph = el('a', { class: 'ph', href: href.listing(l), 'aria-label': l.ti, tabindex: '-1' }, photo(l, 0, { aspect: '4:3' }), el('div', { class: 'badges' }, badgesFor(l, 2)), countEl(l));
    return el('article', { class: 'row', 'data-slug': l.s },
      ph,
      el('div', { class: 'body' },
        streetLine(l),
        el('div', { class: 'pricerow' }, priceEl(l), ctxEl(l)),
        titleEl(l),
        factsStrip(l),
        walkLine(l),
        footEl(l)),
      el('div', { class: 'side' }, favButton(l), el('a', { class: 'btn btn-secondary btn-sm', href: href.listing(l) }, 'Detalji')));
  }
  function compactCard(l) {
    const ph = el('a', { class: 'ph', href: href.listing(l), 'aria-label': l.ti, tabindex: '-1' }, photo(l, 0, { aspect: '4:3' }), el('div', { class: 'badges' }, badgesFor(l, 1)), countEl(l));
    const facts = factList(l).filter(Boolean);
    return el('article', { class: 'row-c', 'data-slug': l.s },
      ph,
      el('div', { class: 'body' },
        el('div', { class: 'pricerow' }, priceEl(l), ctxEl(l)),
        titleEl(l),
        streetLine(l),
        el('div', { class: 'facts', title: facts.join(' · ') }, facts.map((t) => el('span', { class: 'fact' }, t)))),
      favButton(l));
  }
  function skeletonCard() {
    return el('article', { class: 'card skel', 'aria-hidden': 'true' },
      el('div', { class: 'ph' }),
      el('div', { class: 'body' }, el('div', { class: 'ln w40' }), el('div', { class: 'ln tall w72' }), el('div', { class: 'ln w55' }), el('div', { class: 'ln w40' }),
        el('div', { class: 'foot' }, el('div', { class: 'ln w40' }))));
  }
  function loader() { return el('span', { class: 'loader', role: 'status', 'aria-label': 'Učitavanje' }, el('i'), el('i'), el('i'), el('i')); }

  /* ───────── Merilo (§5.8) i blok cene (§5.9) ───────── */
  function merilo(l) {
    const ref = S(() => stats.refPpm(l), null);
    if (!ref || !ref.ppm || (ref.n != null && ref.n < 5) || !l.ppm) return null;
    const left = clamp(50 + (l.ppm / ref.ppm - 1) * 100, 4, 96);
    const pct = (l.ppm / ref.ppm - 1) * 100;
    const sentence = `${fmt.ppm(l.ppm)} je ${fmt.pct(Math.abs(pct))} ${pct >= 0 ? 'iznad' : 'ispod'} proseka · ${ref.label} (${fmt.ppm(ref.ppm)}, n=${ref.n})`;
    return el('div', { class: 'merilo', role: 'img', 'aria-label': sentence },
      el('div', { class: 'track' }, el('span', { class: 'med' }), el('span', { class: 'dot', style: `left:${left.toFixed(1)}%` })),
      el('div', { class: 'lbl' },
        el('span', {}, deltaChip({ pct, ppm: ref.ppm, label: ref.label, n: ref.n }), 'od proseka'),
        el('span', {}, el('b', {}, ref.label), ' · ', fmt.ppm(ref.ppm), ' · n=', String(ref.n))));
  }
  function mortgageLine(l) {
    if (l.t !== 'prodaja' || !l.p || l.p < 10000) return null;
    const principal = l.p * 0.8;
    const m = S(() => mortgage(principal, 5.2, 30), null) || (() => { const r = 0.052 / 12, n = 360; return { monthly: principal * r / (1 - Math.pow(1 + r, -n)) }; })();
    return el('p', { class: 'sub' }, 'kredit od ', el('b', {}, fmt.price(m.monthly, 'izdavanje')), el('span', { class: 'dot' }), '20 % učešće, 30 god., 5,2 %', el('span', { class: 'dot' }), el('a', { href: href.calc(l) }, 'Otvori kalkulator'));
  }
  function priceBlock(l) {
    const sale = saleInfo(l);
    const left = el('div', { class: 'left' },
      el('p', { class: 'big' }, fmt.price(l.p, l.t), sale ? el('s', {}, fmt.price(sale.old, l.t)) : null),
      l.ppm && l.pt !== 'zemljiste'
        ? el('p', { class: 'sub' }, el('b', {}, fmt.ppm(l.ppm)), deltaChip(l), el('span', { class: 'dot' }), l.neg ? 'cena nije fiksna' : 'fiksna cena')
        : el('p', { class: 'sub' }, l.neg ? 'cena nije fiksna' : 'fiksna cena'),
      l.t === 'izdavanje'
        ? el('p', { class: 'sub' }, 'depozit ', el('b', {}, l.dep ? (l.dep <= l.p * 1.05 ? '1 mesec' : fmt.price(l.dep, 'prodaja')) : '1 mesec'), el('span', { class: 'dot' }), 'režije nisu uključene')
        : mortgageLine(l),
      merilo(l));
    const hist = S(() => mock.history(l), []);
    const vals = hist.map((h) => h.p);
    const ref = S(() => stats.refPpm(l), null);
    /* €/m² kroz 12 meseci; za male vrednosti (kirija) čuvamo jednu decimalu da linija ne bude ravna */
    const perM2 = (p) => { if (!l.a) return p; const v = p / l.a; return v < 100 ? Math.round(v * 10) / 10 : Math.round(v); };
    const spark = sparkline(vals.length ? vals.map(perM2) : [], {
      title: el('span', {}, 'Cena po m² ', ref ? `— ${ref.label}` : '', ' · ', el('b', {}, '12 meseci')),
      months: hist.map((h) => h.m),
      delta: vals.length > 1 ? deltaChip({ pct: (vals[vals.length - 1] / vals[0] - 1) * 100, label: '12 meseci' }, { title: `Promena za 12 meseci: ${fmt.pct((vals[vals.length - 1] / vals[0] - 1) * 100, { sign: true })}` }) : null,
      format: (v) => fmt.ppm(v),
    });
    return el('section', { class: 'priceblock', 'aria-label': 'Cena' }, left, spark);
  }

  /* ───────── ključni podaci (§5.10) ───────── */
  function keyFacts(l) {
    const C = S(() => COND, {}), H = S(() => HEAT, {}), O = S(() => ORIENT, {});
    const yes = (k) => (l.am || []).includes(k);
    const rows = [
      ['Kvadratura', l.a ? fmt.m2(l.a) : null],
      ['Struktura', l.ro != null ? fmt.rooms(l.ro) : null],
      ['Sobe', l.ro != null ? fmt.roomsN(l.ro) : null],
      ['Sprat', l.fl != null ? fmt.floor(l.fl, l.tf) : null],
      ['Godina', l.y ? l.y + '.' : null],
      ['Grejanje', l.he ? (H[l.he] || l.he).replace(' grejanje', '') : null],
      ['Orijentacija', l.or ? (O[l.or] || l.or) : null],
      ['Stanje', l.co ? (C[l.co] || l.co) : null],
      ['Energetski razred', l.en || null],
      ['Kupatila', l.ba ? String(l.ba) : null],
      ['Parking', yes('hasGarage') ? 'Garaža' : yes('hasParking') ? 'Da' : 'Ne'],
      ['Lift', yes('hasElevator') ? 'Da' : 'Ne'],
      ['Zemljište', l.la ? ari(l.la) : null],
    ].filter(([, v]) => v != null && v !== '');
    return el('dl', { class: 'keyfacts' }, rows.map(([k, v]) => el('div', { class: 'kf' }, el('dt', {}, k), el('dd', {}, v))));
  }

  /* ───────── Komšiluk (§5.29) ───────── */
  function hood(l) {
    const h = S(() => mock.hood(l), null);
    if (!h) return null;
    const w = S(() => mock.walk(l), { min: 6 });
    const r = rng(hash((l.ps || l.s) + '#hood'));
    const norm = (x, fb) => (x == null ? null : typeof x === 'object' ? { name: x.name || x.n || x.label, min: x.min || fb } : { name: String(x), min: fb });
    const rows = [];
    const push = (ic, label, min) => rows.push(el('li', {}, el('span', { class: 'l' }, icon(ic), el('span', {}, label)), el('span', { class: 'r' }, `${min} min hoda`)));
    const pij = norm(h.pijaca, w.min || 6); if (pij) push('market', pij.name, pij.min);
    const sk = norm(h.skola, 4 + Math.floor(r() * 9)); if (sk) push('school', sk.name, sk.min);
    const vr = norm(h.vrtic, 3 + Math.floor(r() * 8)); if (vr) push('blocks', vr.name, vr.min);
    (h.transport || []).slice(0, 2).forEach((t) => push(/tram|voz|metro/i.test(String(t.type || t.line)) ? 'tram' : 'bus', `${t.type ? t.type : 'Linija'} ${t.line} · ${t.stop}`, t.min || 3 + Math.floor(r() * 6)));
    const pk = norm(h.park, 5 + Math.floor(r() * 10)); if (pk) push('park', pk.name, pk.min);
    const sh = norm(h.prodavnica, 2 + Math.floor(r() * 5)); if (sh) push('shop', sh.name, sh.min);
    return el('section', { class: 'hood' },
      el('h2', {}, 'Komšiluk'),
      el('ul', {}, rows.slice(0, 6)),
      h.note ? el('div', { class: 'kraj' }, el('p', { class: 'eyebrow' }, 'Kakav je kraj'), el('p', {}, h.note)) : null);
  }

  /* ───────── zaglavlje sekcije, prazno, paginacija, mrvice, pločice (§5.16–5.20) ───────── */
  function sectionHead(title, sub, link, linkLabel) {
    return el('div', { class: 'shead' },
      el('div', {}, el('h2', { class: 't-h2' }, title), sub ? el('p', { class: 'sub' }, sub) : null),
      link ? el('a', { class: 'btn btn-link', href: link }, linkLabel || 'Prikaži sve') : null);
  }
  function empty(title, text, actionLabel, link, opts = {}) {
    const actions = [];
    if (actionLabel) actions.push(link ? el('a', { class: 'btn btn-secondary', href: link }, actionLabel) : el('button', { class: 'btn btn-secondary', type: 'button', onclick: opts.onClick }, actionLabel));
    if (opts.primary) actions.push(opts.primary.href ? el('a', { class: 'btn btn-primary', href: opts.primary.href }, opts.primary.label) : el('button', { class: 'btn btn-primary', type: 'button', onclick: opts.primary.onClick }, opts.primary.label));
    return el('div', { class: 'empty', role: 'status' }, icon(opts.icon || 'empty-search', 48), el('h3', {}, title), text ? el('p', {}, text) : null, actions.length ? el('div', { class: 'btn-row' }, actions) : null);
  }
  function pager(page, pages, onPick, opts = {}) {
    if (!pages || pages < 1) return el('nav', { class: 'pager' });
    const items = [];
    const add = (p) => items.push(p);
    if (pages <= 7) for (let i = 1; i <= pages; i++) add(i);
    else {
      add(1);
      const a = Math.max(2, page - 1), b = Math.min(pages - 1, page + 1);
      if (a > 2) add('…');
      for (let i = a; i <= b; i++) add(i);
      if (b < pages - 1) add('…');
      add(pages);
    }
    const nav = el('nav', { class: 'pager', 'aria-label': 'Paginacija' },
      el('button', { type: 'button', 'aria-label': 'Prethodna strana', disabled: page <= 1, onclick: () => onPick && onPick(page - 1) }, icon('chev-l')),
      items.map((p) => p === '…' ? el('span', { class: 'dots', 'aria-hidden': 'true' }, '…')
        : el('button', { type: 'button', class: 'pg', 'aria-current': p === page ? 'page' : null, 'aria-label': `Strana ${p}`, onclick: () => onPick && onPick(p) }, String(p))),
      el('span', { class: 'cur', 'aria-hidden': 'true' }, `/ ${pages}`),
      el('button', { type: 'button', 'aria-label': 'Sledeća strana', disabled: page >= pages, onclick: () => onPick && onPick(page + 1) }, icon('chev-r')));
    if (opts.per) nav.appendChild(el('label', { class: 'per' }, el('span', {}, 'Po strani'), select(opts.perOptions || [20, 40, 60], opts.per, (v) => opts.onPer && opts.onPer(+v), { inline: true })));
    return nav;
  }
  function crumbs(items) {
    const list = items.filter(Boolean);
    const parent = list.length > 1 ? list[list.length - 2] : null;
    const nodes = [];
    list.forEach((it, i) => {
      const last = i === list.length - 1;
      if (i) nodes.push(el('span', { class: 'sep d', 'aria-hidden': 'true' }, '/'));
      nodes.push(last ? el('span', { class: 'cur d', 'aria-current': 'page' }, it.label) : el('a', { class: 'd', href: it.href }, it.label));
    });
    return el('nav', { class: 'crumbs', 'aria-label': 'Putanja' }, nodes, parent ? el('a', { class: 'back', href: parent.href }, icon('chev-l'), parent.label) : null);
  }
  function tiles(items) {
    return el('div', { class: 'tiles' }, items.map((t) => el('div', { class: 'tile' }, el('b', { class: t.xl ? 'xl' : null }, t.v, t.delta || null), el('span', {}, t.l))));
  }

  /* ───────── tabovi (§5.11) ───────── */
  function tabs(items, opts = {}) {
    let cur = opts.active || (items[0] && items[0].id);
    const btns = items.map((it) => el('button', { type: 'button', role: 'tab', id: 'tab-' + it.id, 'aria-controls': 'panel-' + it.id, 'aria-selected': it.id === cur ? 'true' : 'false', tabindex: it.id === cur ? '0' : '-1', onclick: () => root.select(it.id) }, it.label));
    const panels = items.map((it) => el('div', { class: 'tabs-p', role: 'tabpanel', id: 'panel-' + it.id, 'aria-labelledby': 'tab-' + it.id, hidden: it.id !== cur }, it.panel));
    const strip = el('div', { class: 'tabs-ul', role: 'tablist' }, btns);
    /* maska-fade samo na stranama gde ima još tabova (is-start / is-end) */
    const edges = () => { const max = strip.scrollWidth - strip.clientWidth; strip.classList.toggle('is-start', strip.scrollLeft <= 2); strip.classList.toggle('is-end', max <= 2 || strip.scrollLeft >= max - 2); };
    strip.addEventListener('scroll', edges, { passive: true });
    requestAnimationFrame(edges);
    strip.addEventListener('keydown', (e) => {
      const i = items.findIndex((x) => x.id === cur);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const j = (i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length; root.select(items[j].id); btns[j].focus(); }
    });
    const root = el('div', { class: 'tabs' }, strip, panels);
    root.select = (id) => {
      cur = id;
      items.forEach((it, i) => { const on = it.id === id; btns[i].setAttribute('aria-selected', on ? 'true' : 'false'); btns[i].tabIndex = on ? 0 : -1; panels[i].hidden = !on; });
      btns[items.findIndex((x) => x.id === id)].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (opts.onChange) opts.onChange(id);
    };
    return root;
  }
  function accordion(title, body, open = false) {
    return el('details', { class: 'acc', open }, el('summary', {}, el('span', {}, title), icon('chev-d')), el('div', { class: 'body' }, body));
  }

  /* ───────── modal i donji list (§5.13) ───────── */
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function overlay(kind, title, body, opts = {}) {
    const opener = document.activeElement;
    const asSheet = kind === 'sheet' || isPhone();
    const back = el('div', { class: 'backdrop' });
    const closeBtn = asSheet
      ? el('button', { type: 'button', onclick: () => api.close() }, 'Zatvori')
      : el('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Zatvori', onclick: () => api.close() }, icon('x'));
    const hd = el('div', { class: 'hd' }, el('h2', { id: 'dlg-t-' + Date.now() }, title), closeBtn);
    const ft = opts.footer ? el('div', { class: 'ft' }, opts.footer) : null;
    let root;
    if (asSheet) {
      root = el('div', { class: 'sheet' + (kind === 'modal' || !isPhone() ? ' desk' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': hd.firstChild.id },
        el('div', { class: 'handle', 'aria-hidden': 'true' }), hd, el('div', { class: 'bd' }, body), ft);
    } else {
      root = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': hd.firstChild.id },
        el('div', { class: 'panel' }, hd, el('div', { class: 'bd' }, body), ft));
    }
    const onKey = (e) => {
      if (e.defaultPrevented) return;   /* npr. paleta iznad ovog lista je već obradila Esc */
      const open = [...document.querySelectorAll('.modal.in, .sheet.in')];
      if (open.length && open[open.length - 1] !== root) return;   /* reaguje samo najgornji dijalog */
      if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }
      if (e.key !== 'Tab') return;
      const f = [...root.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    back.addEventListener('click', () => api.close());
    if (!asSheet) root.addEventListener('click', (e) => { if (e.target === root) api.close(); });
    document.body.append(back, root);
    document.body.classList.add(asSheet ? 'sheet-open' : 'modal-open');
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => requestAnimationFrame(() => { back.classList.add('in'); root.classList.add('in'); const f = root.querySelector('.bd ' + FOCUSABLE) || closeBtn; f.focus({ preventScroll: true }); }));
    /* prevlačenje za zatvaranje (ručka) */
    if (asSheet) {
      const handle = root.querySelector('.handle'); let y0 = null;
      const move = (e) => { if (y0 == null) return; const dy = Math.max(0, e.clientY - y0); root.style.transform = `translateY(${dy}px)`; root.style.transition = 'none'; };
      const up = (e) => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; root.style.transition = ''; if (dy > 80) api.close(); else root.style.transform = ''; };
      [handle, hd].forEach((h) => h.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; h.setPointerCapture(e.pointerId); }));
      [handle, hd].forEach((h) => { h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up); });
    }
    let closed = false;
    const api = {
      el: root, body: root.querySelector('.bd'),
      close() {
        if (closed) return; closed = true;
        document.removeEventListener('keydown', onKey);
        back.classList.remove('in'); root.classList.remove('in'); root.classList.add('out');
        document.body.classList.remove(asSheet ? 'sheet-open' : 'modal-open');
        setTimeout(() => { back.remove(); root.remove(); }, 260);
        if (opener && opener.focus) opener.focus({ preventScroll: true });
        if (opts.onClose) opts.onClose();
      },
    };
    return api;
  }
  const sheet = (title, body, opts) => overlay('sheet', title, body, opts);
  const modal = (title, body, opts) => overlay('modal', title, body, opts);

  /* ───────── sparkline, bars, histogram (§5.21) ───────── */
  function sparkline(values, opts = {}) {
    const w = opts.w || 420, h = opts.h || 110;
    const format = opts.format || ((v) => S(() => fmt.ppm(v), String(v)));
    const wrap = el('div', { class: 'spark' });
    if (opts.title || opts.delta) wrap.appendChild(el('div', { class: 't' }, el('span', {}, opts.title || ''), opts.delta || null));
    const vals = (values || []).filter((v) => v != null && isFinite(v));
    if (vals.length < 5) { wrap.appendChild(el('div', { class: 'nodata' }, 'Nedovoljno podataka')); return wrap; }
    const n = vals.length, padT = 10, padB = 6, padX = 2;
    const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
    const X = (i) => padX + i * ((w - padX * 2) / (n - 1));
    const Y = (v) => padT + (1 - (v - min) / span) * (h - padT - padB);
    const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    const grid = [0, 0.5, 1].map((t) => { const y = (padT + t * (h - padT - padB)).toFixed(1); return `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="var(--chart-grid)" stroke-width="1"/>`; }).join('');
    const svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${grid}
      <path d="M${pts[0]} L${pts.slice(1).join(' L')} L${X(n - 1).toFixed(1)},${h} L${X(0).toFixed(1)},${h} Z" fill="var(--chart-fill)"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="var(--chart-line)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <g class="hov"><line class="hl" x1="0" x2="0" y1="${padT}" y2="${h}" stroke="var(--chart-ref)" stroke-width="1" vector-effect="non-scaling-stroke"/><circle class="hd" r="4.5" fill="var(--bg)" stroke="var(--chart-line)" stroke-width="2" vector-effect="non-scaling-stroke"/></g>
      <circle cx="${X(n - 1).toFixed(1)}" cy="${Y(vals[n - 1]).toFixed(1)}" r="4.5" fill="var(--chart-line)" stroke="var(--bg)" stroke-width="2" vector-effect="non-scaling-stroke"/>
    </svg>`;
    const svgWrap = el('div', { class: 'svgw', html: svg, tabindex: '0', role: 'img', 'aria-label': opts.aria || `Kretanje: od ${format(vals[0])} do ${format(vals[n - 1])}` });
    const stip = el('div', { class: 'stip', 'aria-hidden': 'true' });
    wrap.append(svgWrap, stip);
    const months = opts.months || [];
    const lab = (i) => (opts.labels && opts.labels[i]) || (months[i] ? monthLabel(months[i]) : `#${i + 1}`);
    wrap.appendChild(el('div', { class: 'ax' }, el('span', {}, `${lab(0)} · ${format(vals[0])}`), el('span', {}, `${lab(n - 1)} · `, el('b', {}, format(vals[n - 1])))));
    if (opts.source) wrap.appendChild(el('p', { class: 'src' }, opts.source));
    const svgEl = svgWrap.firstElementChild, line = svgEl.querySelector('.hl'), dot = svgEl.querySelector('.hd');
    let cur = -1;
    const show = (i) => {
      cur = clamp(i, 0, n - 1);
      line.setAttribute('x1', X(cur)); line.setAttribute('x2', X(cur)); dot.setAttribute('cx', X(cur)); dot.setAttribute('cy', Y(vals[cur]));
      wrap.classList.add('on');
      const r = svgEl.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      stip.textContent = `${lab(cur)} · ${format(vals[cur])}`;
      stip.style.left = (r.left - wr.left + (X(cur) / w) * r.width) + 'px';
      stip.style.top = (r.top - wr.top + (Y(vals[cur]) / h) * r.height) + 'px';
    };
    const hide = () => { wrap.classList.remove('on'); };
    svgWrap.addEventListener('pointermove', (e) => { const r = svgEl.getBoundingClientRect(); show(Math.round(((e.clientX - r.left) / r.width) * (n - 1))); });
    svgWrap.addEventListener('pointerleave', hide);
    svgWrap.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); show(cur < 0 ? n - 1 : cur + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur < 0 ? n - 1 : cur - 1); } if (e.key === 'Escape') hide(); });
    svgWrap.addEventListener('blur', hide);
    return wrap;
  }
  function bars(rows, opts = {}) {
    const format = opts.format || ((v) => S(() => fmt.ppm(v), String(v)));
    const max = opts.max || Math.max(...rows.map((r) => r.value || 0), opts.ref ? opts.ref.value : 0) || 1;
    const pct = (v) => clamp((v / max) * 100, 0, 100);
    const root = el('div', { class: 'bars', role: 'table' });
    rows.forEach((r) => {
      root.append(
        el('span', { class: 'lab', title: r.label }, r.me ? el('b', {}, r.label) : r.label),
        el('span', { class: 'bar' + (r.me ? ' me' : ''), 'aria-hidden': 'true' }, el('i', { style: `width:${pct(r.value).toFixed(1)}%` }), opts.ref ? el('span', { class: 'ref', style: `left:${pct(opts.ref.value).toFixed(1)}%` }) : null),
        el('span', { class: 'v' }, el('b', {}, format(r.value)), r.n != null ? el('span', { class: 'n' }, `n=${r.n}`) : null));
    });
    if (opts.ref) {
      const p = pct(opts.ref.value);
      root.appendChild(el('span', { class: 'refcap' }, el('span', { class: p < 15 ? 'l' : p > 85 ? 'r' : '', style: `left:${p.toFixed(1)}%` }, `${opts.ref.label || 'prosek'} ${format(opts.ref.value)}`)));
    }
    return root;
  }
  function histogram(bins, opts = {}) {
    const max = Math.max(...bins.map((b) => b.n), 1);
    const root = el('div', { class: 'histo', 'aria-hidden': 'true' }, bins.map((b) => el('i', { style: `height:${Math.max(3, (b.n / max) * 100).toFixed(0)}%` })));
    root.update = (from, to) => {
      [...root.children].forEach((i, k) => { const b = bins[k]; const on = (from == null || b.to > from) && (to == null || b.from < to); i.classList.toggle('on', on); });
    };
    root.update(opts.from, opts.to);
    return root;
  }

  /* ───────── pinovi (§5.22) ───────── */
  function pin(l, state = 'default', opts = {}) {
    const cls = ['pin'];
    if (state === 'selected') cls.push('on'); if (state === 'visited') cls.push('seen'); if (state === 'hover') cls.push('hov');
    if (l.co === 'novogradnja' || l.co === 'u-izgradnji') cls.push('new');
    if (opts.static) cls.push('static');
    const b = el('button', { class: cls.join(' '), type: 'button', 'data-slug': l.s, 'aria-label': `${l.ti}, ${fmt.price(l.p, l.t)}`, 'aria-pressed': state === 'selected' ? 'true' : 'false', onclick: opts.onClick },
      el('span', { class: 'p' }, fmt.price(l.p, l.t)), el('span', { class: 's', 'aria-hidden': 'true' }));
    if (opts.left != null) { b.style.left = opts.left; b.style.top = opts.top; }
    b.setState = (s) => { b.classList.toggle('on', s === 'selected'); b.classList.toggle('seen', s === 'visited'); b.classList.toggle('hov', s === 'hover'); b.setAttribute('aria-pressed', s === 'selected' ? 'true' : 'false'); };
    return b;
  }
  function cluster(n, opts = {}) {
    return el('button', { class: 'pin cl' + (n >= 50 ? ' lg' : '') + (opts.static ? ' static' : ''), type: 'button', 'aria-label': `${n} oglasa, približi`, onclick: opts.onClick, style: opts.left != null ? `left:${opts.left};top:${opts.top}` : null }, el('span', { class: 'p' }, String(n)), el('span', { class: 's' }));
  }
  function mapLegend() {
    return el('div', { class: 'legend', 'aria-label': 'Legenda' },
      el('span', {}, el('i'), 'Cena oglasa'), el('span', {}, el('i', { class: 'on' }), 'Izabran'), el('span', {}, el('i', { class: 'seen' }), 'Već pogledan'), el('span', {}, el('i', { class: 'new' }), 'Novogradnja'));
  }
  function pinPopover(l) {
    return el('div', { class: 'pin-pop', role: 'dialog', 'aria-label': l.ti },
      el('a', { class: 'ph', href: href.listing(l), tabindex: '-1' }, photo(l, 0, { aspect: '4:3' })),
      el('div', { class: 'pricerow' }, priceEl(l), ctxEl(l)),
      el('h4', {}, l.ti),
      el('a', { class: 'btn btn-secondary btn-sm', href: href.listing(l) }, 'Detalji'));
  }

  /* ───────── galerija i lightbox (§5.23) ───────── */
  function gallery(l, opts = {}) {
    const n = Math.max(1, l.im || 1);
    const tiles_ = [];
    for (let i = 0; i < n; i++) {
      tiles_.push(el('button', { class: 'g' + (i === 0 ? ' main' : ''), type: 'button', 'aria-label': `Fotografija ${i + 1} od ${n}`, onclick: () => lightbox(l, i) },
        photo(l, i, { aspect: i === 0 ? '16:10' : '4:3' }),
        i === 4 && n > 5 ? el('span', { class: 'more', 'aria-hidden': 'true' }, `+${n - 5}`) : null));
    }
    const grid = el('div', { class: 'gallery' }, tiles_);
    const pg = el('span', { class: 'gpager', 'aria-live': 'polite' }, `1 / ${n}`);
    grid.addEventListener('scroll', () => { const i = Math.round(grid.scrollLeft / Math.max(1, grid.clientWidth)); pg.textContent = `${clamp(i, 0, n - 1) + 1} / ${n}`; }, { passive: true });
    return el('div', { class: 'gallery-wrap' }, grid,
      el('div', { class: 'gbadges' }, badgesFor(l, 3)),
      pg,
      el('button', { class: 'all', type: 'button', onclick: () => lightbox(l, 0) }, icon('image'), `Sve fotografije (${n})`));
  }
  function lightbox(l, start = 0) {
    const n = Math.max(1, l.im || 1); let i = clamp(start, 0, n - 1);
    const opener = document.activeElement;
    const counter = el('span', { class: 'num' });
    const stage = el('div', { class: 'stage' });
    const thumbs = el('div', { class: 'thumbs' });
    const paint = () => {
      counter.textContent = `${i + 1} / ${n}`;
      stage.innerHTML = '';
      stage.append(photo(l, i, { aspect: '16:10', alt: `${l.ti} — fotografija ${i + 1}` }),
        el('button', { class: 'arr l', type: 'button', 'aria-label': 'Prethodna', onclick: () => go(-1) }, icon('chev-l')),
        el('button', { class: 'arr r', type: 'button', 'aria-label': 'Sledeća', onclick: () => go(1) }, icon('chev-r')));
      [...thumbs.children].forEach((b, k) => { b.setAttribute('aria-current', k === i ? 'true' : 'false'); if (k === i) b.scrollIntoView({ block: 'nearest', inline: 'center' }); });
    };
    const go = (d) => { i = (i + d + n) % n; paint(); };
    for (let k = 0; k < n; k++) thumbs.appendChild(el('button', { type: 'button', 'aria-label': `Fotografija ${k + 1}`, onclick: () => { i = k; paint(); } }, photo(l, k, { aspect: '1:1' })));
    const root = el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Galerija fotografija' },
      el('div', { class: 'top' }, counter, el('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Zatvori', onclick: () => close() }, icon('x'))),
      stage, thumbs);
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1);
      /* fokus ostaje u galeriji (Tab / Shift+Tab kruže) */
      if (e.key === 'Tab') {
        const f = [...root.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    let x0 = null;
    stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    stage.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 40) go(e.clientX < x0 ? 1 : -1); x0 = null; });
    const close = () => { document.removeEventListener('keydown', onKey); root.remove(); document.body.classList.remove('modal-open'); if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    document.body.appendChild(root);
    paint();
    root.querySelector('.top .iconbtn').focus();
    return { close, el: root };
  }

  /* ───────── agencija (§5.24) i kontakt (§5.25) ───────── */
  function agencyOf(l) { return l && l.ags ? S(() => D.agencies.find((a) => a.s === l.ags), null) : null; }
  function agencyMark(a, cls = 'lg') {
    const src = S(() => img.mark(a), null);
    return el('span', { class: cls, 'aria-hidden': 'true' }, src ? el('img', { src, alt: '', width: 56, height: 56, loading: 'lazy', decoding: 'async' }) : initials(a.n));
  }
  function agencyCard(a) {
    return el('article', { class: 'agency' },
      el('div', { class: 'top' }, agencyMark(a),
        el('div', { style: 'min-width:0' },
          el('p', { class: 'nm' }, el('span', {}, a.n), a.v ? icon('check') : null),
          el('p', { class: 'sub' }, `${a.v ? 'Verifikovana agencija' : 'Agencija'} · od ${a.y}. · ${a.c}`))),
      el('div', { class: 'kpi' },
        a.r ? el('span', {}, el('b', {}, nf1.format(a.r)), ` ocena (${a.rc || 0})`) : null,
        el('span', {}, el('b', {}, nf0.format(a.lc || 0)), ' ', plu(a.lc || 0, 'oglas', 'oglasa', 'oglasa')),
        el('span', {}, el('b', {}, nf0.format(a.ac || 1)), ' ', plu(a.ac || 1, 'agent', 'agenta', 'agenata'))),
      el('a', { class: 'btn btn-secondary btn-sm', href: href.agency(a) }, 'Pogledaj oglase'));
  }
  const AGENT_NAMES = ['Nikola Perić', 'Jelena Marković', 'Marko Ilić', 'Ana Stanković', 'Stefan Jovanović', 'Milica Petrović', 'Nemanja Đorđević', 'Tamara Lukić', 'Ivana Radovanović', 'Vladimir Kostić'];
  function maskPhone(ph) { const s = String(ph || '').replace(/\s+/g, ' ').trim(); return s.length > 4 ? s.slice(0, -2) + '··' : s; }
  function mockPhone(l) { const h = hash(l.s + '#ph'); return `06${(h % 6) + 1} ${String(100 + (h >>> 3) % 900)} ${String(1000 + (h >>> 13) % 9000)}`; }
  function contactCard(l) {
    const a = agencyOf(l);
    const phoneNum = a ? a.ph : mockPhone(l);
    const team = S(() => (typeof window.agencyAgentFor === 'function' ? window.agencyAgentFor(l) : null), null);   /* isti agent kao na profilu agencije */
    const agent = (team && (team.n || team.name)) || AGENT_NAMES[hash(l.s + '#ag') % AGENT_NAMES.length];
    const hrs = 1 + (hash(l.s + '#h') % 4);
    let revealed = false;
    const phoneBtn = el('button', { class: 'btn btn-primary btn-lg', type: 'button' });
    const paintPhone = () => { phoneBtn.innerHTML = ''; phoneBtn.append(icon('phone'), el('span', { class: 'mask' }, revealed ? phoneNum : maskPhone(phoneNum)), revealed ? null : el('span', { class: 'rev' }, 'prikaži broj')); phoneBtn.setAttribute('aria-label', revealed ? `Pozovi ${phoneNum}` : 'Prikaži broj telefona'); };
    paintPhone();
    phoneBtn.addEventListener('click', async () => {
      if (!revealed) { revealed = true; paintPhone(); toastSafe('Broj je prikazan — pomenite Kvadrat.rs'); return; }
      try { await navigator.clipboard.writeText(phoneNum); toastSafe('Broj je kopiran'); } catch (e) { toastSafe('Broj: ' + phoneNum); }
    });
    const msg = () => {
      const ta = el('textarea', { class: 'input', rows: '4', placeholder: 'Poruka oglašivaču…' }, `Poštovani, zanima me oglas ${l.r} (${l.ti}). Da li je još uvek aktuelan?`);
      const m = modal('Pošalji poruku', el('div', { class: 'stack' }, field('Vaše ime', el('input', { class: 'input', type: 'text', placeholder: 'Ime i prezime' })), field('E-pošta', el('input', { class: 'input', type: 'email', placeholder: 'vi@primer.rs' })), field('Poruka', ta)),
        { footer: [el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, 'Odustani'), el('button', { class: 'btn btn-primary', type: 'button', onclick: () => { m.close(); toastSafe('Poruka je poslata'); } }, 'Pošalji')] });
    };
    const visit = () => {
      const days = [1, 2, 3, 4, 5].map((d) => { const dt = new Date(Date.now() + d * 864e5); return { v: dt.toISOString().slice(0, 10), l: `${['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub'][dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.` }; });
      let pick = days[0].v, time = '17:00';
      const m = sheet('Zakaži obilazak', el('div', {},
        el('div', { class: 'grp' }, el('p', { class: 't' }, 'Dan'), pills(days, [pick], (v) => { pick = v; })),
        el('div', { class: 'grp' }, el('p', { class: 't' }, 'Vreme'), pills(['10:00', '12:00', '15:00', '17:00', '19:00'], [time], (v) => { time = v; }))),
        { footer: [el('button', { class: 'btn btn-ink', type: 'button', onclick: () => { m.close(); toastSafe(`Zahtev za obilazak ${pick} u ${time} je poslat`); } }, 'Pošalji zahtev')] });
    };
    return el('aside', { class: 'contact', 'aria-label': 'Kontakt' },
      el('div', { class: 'who' },
        a ? agencyMark(a, 'ava') : el('span', { class: 'ava', 'aria-hidden': 'true' }, 'V'),
        el('div', { style: 'min-width:0' },
          el('b', {}, el('span', {}, a ? a.n : 'Vlasnik'), a && a.v ? icon('check') : null),
          el('small', {}, a ? `${a.v ? 'Verifikovana agencija' : 'Agencija'} · od ${a.y}.` : 'Privatni oglašivač · bez provizije'))),
      el('div', { class: 'rating' },
        a && a.r ? el('span', {}, el('b', {}, nf1.format(a.r)), ` ocena (${a.rc || 0})`) : el('span', {}, el('b', {}, fmt.num(l.v || 0)), ' pregleda'),
        a ? el('span', {}, el('b', {}, nf0.format(a.lc || 0)), ' oglasa') : el('span', {}, el('b', {}, fmt.num(l.fv || 0)), ' sačuvano'),
        a ? el('span', {}, el('b', {}, nf0.format(a.ac || 1)), ' ', plu(a.ac || 1, 'agent', 'agenta', 'agenata')) : null),
      phoneBtn,
      el('button', { class: 'btn btn-secondary', type: 'button', onclick: msg }, 'Pošalji poruku'),
      el('button', { class: 'btn btn-secondary', type: 'button', onclick: visit }, 'Zakaži obilazak'),
      el('p', { class: 'agent' }, el('i', { 'aria-hidden': 'true' }, initials(a ? agent : 'Vlasnik')), el('span', {}, a ? 'Agent: ' : '', el('b', {}, a ? agent : 'Vlasnik'), ` · odgovara u proseku za ${hrs} ${hrs === 1 ? 'sat' : hrs < 5 ? 'sata' : 'sati'}`)),
      el('p', { class: 'note' }, 'Nikada ne uplaćujte kaparu pre obilaska nekretnine i provere dokumentacije. Prijavite sumnjiv oglas.'),
      el('a', { class: 'report', href: '#/prijava?oglas=' + l.r }, 'Prijavi oglas'));
  }

  /* ───────── poređenje (§5.26) ───────── */
  function compareTable(list, opts = {}) {
    const C = S(() => COND, {}), H = S(() => HEAT, {});
    const yes = (l, k) => (l.am || []).includes(k);
    const cellYN = (v) => el('span', { class: v ? 'yes' : 'no' }, v ? 'Da' : 'Ne');
    const rows = [
      ['€/m²', (l) => l.ppm, (l) => fmt.ppm(l.ppm), 'min'],
      ['Δ opština', (l) => S(() => stats.delta(l).pct, null), (l) => deltaChip(l) || '—', 'min'],
      ['Kvadratura', (l) => l.a, (l) => fmt.m2(l.a), 'max'],
      ['Sobe', (l) => l.ro, (l) => l.ro != null ? fmt.roomsN(l.ro) : '—', 'max'],
      ['Sprat', (l) => l.fl, (l) => l.fl != null ? fmt.floor(l.fl, l.tf) : '—', null],
      ['Godina', (l) => l.y, (l) => l.y ? l.y + '.' : '—', 'max'],
      ['Grejanje', (l) => l.he, (l) => (H[l.he] || l.he || '—'), null],
      ['Stanje', (l) => l.co, (l) => (C[l.co] || l.co || '—'), null],
      ['Uknjiženo', (l) => !!l.reg, (l) => cellYN(l.reg), 'true'],
      ['Parking', (l) => yes(l, 'hasParking') || yes(l, 'hasGarage'), (l) => cellYN(yes(l, 'hasParking') || yes(l, 'hasGarage')), 'true'],
      ['Lift', (l) => yes(l, 'hasElevator'), (l) => cellYN(yes(l, 'hasElevator')), 'true'],
      ['Agencija', (l) => l.ag || 'Vlasnik', (l) => el('span', { class: 'ag' }, l.ag || 'Vlasnik', l.agv ? icon('check') : null), null],
      ['Hod do centra', (l) => S(() => mock.walk(l).min, null), (l) => { const w = S(() => mock.walk(l), null); return w ? `${w.min} min` : '—'; }, 'min'],
    ];
    const head = el('tr', {}, el('th', { scope: 'col' }, 'Oglas'), list.map((l) => el('td', {},
      el('a', { class: 'ph', href: href.listing(l) }, photo(l, 0, { aspect: '4:3' })),
      el('div', { class: 'pricerow' }, priceEl(l), ctxEl(l)),
      el('p', { class: 'ttl' }, l.ti),
      opts.onRemove ? el('button', { class: 'rm', type: 'button', onclick: () => opts.onRemove(l) }, 'Ukloni') : null)));
    const body = rows.map(([label, val, render, best]) => {
      const vals = list.map(val);
      const same = vals.every((v) => v === vals[0]);
      let bestVals = new Set();
      const nums = vals.filter((v) => typeof v === 'number' && isFinite(v));
      if (best === 'min' && nums.length) bestVals.add(Math.min(...nums));
      if (best === 'max' && nums.length) bestVals.add(Math.max(...nums));
      if (best === 'true') bestVals.add(true);
      return el('tr', { class: same ? 'same' : null }, el('th', { scope: 'row' }, label), list.map((l, k) => el('td', { class: !same && bestVals.has(vals[k]) ? 'best' : null }, render(l))));
    });
    const wrap = el('div', { class: 'compare-wrap' + (opts.showSame ? ' show-same' : '') }, el('table', { class: 'compare' }, el('thead', {}, head), el('tbody', {}, body)));
    wrap.toggleSame = (show) => wrap.classList.toggle('show-same', show);
    return wrap;
  }

  /* ───────── koraci (§5.27) ───────── */
  function stepper(steps, cur = 0) {
    const n = steps.length;
    return el('div', { class: 'stepper-wrap' },
      el('ol', { class: 'stepper', 'aria-label': 'Koraci' }, steps.map((s, i) => el('li', { class: i < cur ? 'done' : i === cur ? 'cur' : '', 'aria-current': i === cur ? 'step' : null }, el('i', {}, i < cur ? icon('check') : String(i + 1)), el('span', {}, s)))),
      el('div', { class: 'stepper-m' }, el('span', {}, `Korak ${cur + 1} od ${n} · `, el('b', {}, steps[cur])), el('div', { class: 'bar' }, el('i', { style: `width:${((cur + 1) / n * 100).toFixed(0)}%` }))));
  }

  /* ───────── tabela (§5.28) ───────── */
  function listTable(list, opts = {}) {
    const cols = [['Oglas', null, ''], ['m²', 'a-desc', 'num'], ['Sobe', null, 'num'], ['Sprat', null, 'num'], ['€/m²', 'ppm-asc', 'num'], ['Δ opština', 'delta', ''], ['Cena', 'p-asc', 'num'], ['Oglašivač', null, ''], ['', null, ''], ['', null, '']];
    const th = cols.map(([label, sortKey, cls]) => {
      const sorted = !!(sortKey && opts.sort && opts.sort.split('-')[0] === sortKey.split('-')[0]);
      return el('th', { scope: 'col', class: cls || null, 'aria-sort': sortKey ? (sorted ? (opts.sort.endsWith('desc') ? 'descending' : 'ascending') : 'none') : null },
        sortKey && opts.onSort ? el('button', { type: 'button', onclick: () => opts.onSort(sortKey) }, label, sorted ? icon(opts.sort.endsWith('desc') ? 'arrow-down' : 'arrow-up') : null) : label);
    });
    const tr = (l) => el('tr', { 'data-slug': l.s },
      el('td', {}, el('div', { class: 'og' }, el('a', { class: 'thumb', href: href.listing(l), tabindex: '-1' }, photo(l, 0, { aspect: '4:3' })), el('div', { style: 'min-width:0' }, el('a', { class: 'ttl', href: href.listing(l) }, l.ti), el('p', { class: 'sub' }, S(() => mock.street(l), l.ad) || placeLine(l))))),
      el('td', { class: 'num' }, l.a ? fmt.m2(l.a) : '—'),
      el('td', { class: 'num' }, l.ro != null ? fmt.roomsN(l.ro) : '—'),
      el('td', { class: 'num' }, l.fl != null ? fmt.floor(l.fl, l.tf) : '—'),
      el('td', { class: 'num' }, l.ppm ? fmt.ppm(l.ppm) : '—'),
      el('td', {}, deltaChip(l) || '—'),
      el('td', { class: 'num' }, priceEl(l)),
      el('td', {}, el('span', { class: 'ag' }, l.ag || 'Vlasnik', l.agv ? icon('check') : null)),
      el('td', {}, favButton(l)),
      el('td', {}, el('a', { class: 'btn btn-secondary btn-sm', href: href.listing(l) }, 'Detalji')));
    return el('div', { class: 'table-wrap' }, el('table', { class: 'table' }, el('thead', {}, el('tr', {}, th)), el('tbody', {}, list.map(tr))));
  }

  /* ───────── kontrole (§5.2) ───────── */
  const norm = (o) => (typeof o === 'object' && o !== null ? o : { v: o, l: String(o) });
  function segmented(opts, cur, onPick) {
    const items = opts.map(norm);
    const root = el('div', { class: 'seg', role: 'group' });
    items.forEach((it) => root.appendChild(el('button', { type: 'button', 'aria-pressed': it.v === cur ? 'true' : 'false', onclick: () => { root.set(it.v); if (onPick) onPick(it.v); } }, it.l)));
    root.set = (v) => { cur = v; [...root.children].forEach((b, i) => b.setAttribute('aria-pressed', items[i].v === v ? 'true' : 'false')); };
    return root;
  }
  function pills(opts, cur = [], onToggle, o = {}) {
    const items = opts.map(norm);
    let sel = new Set(cur);
    const root = el('div', { class: 'pr', role: 'group' });
    items.forEach((it) => root.appendChild(el('button', { class: 'chip' + (sel.has(it.v) ? ' on' : ''), type: 'button', 'aria-pressed': sel.has(it.v) ? 'true' : 'false', onclick: () => {
      if (o.single) { sel = new Set([it.v]); } else if (sel.has(it.v)) sel.delete(it.v); else sel.add(it.v);
      root.set([...sel]);
      if (onToggle) onToggle(it.v, sel.has(it.v), [...sel]);
    } }, it.icon ? icon(it.icon) : null, it.l, it.n != null ? el('span', { class: 'n' }, String(it.n)) : null)));
    root.set = (arr) => { sel = new Set(arr); [...root.children].forEach((b, i) => { const on = sel.has(items[i].v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); };
    return root;
  }
  function chip(label, onRemove) {
    return el('span', { class: 'tag' + (onRemove ? '' : ' static') }, label, onRemove ? el('button', { type: 'button', 'aria-label': `Ukloni filter ${label}`, onclick: onRemove }, icon('x')) : null);
  }
  function filterChip(label, o = {}) {
    return el('button', { class: 'chip' + (o.on ? ' on' : '') + (o.filters ? ' chip-filters' : ''), type: 'button', 'aria-pressed': o.on ? 'true' : 'false', 'aria-expanded': o.expands ? 'false' : null, onclick: o.onClick },
      o.icon ? icon(o.icon) : null, label, o.n != null ? el('span', { class: 'n' }, String(o.n)) : null, o.chevron !== false && !o.filters ? icon('chev-d') : null);
  }
  function activeFilters(tags, onClear) {
    if (!tags.length) return null;
    return el('div', { class: 'active-filters' }, el('span', {}, 'Aktivno:'), tags.map((t) => chip(t.label, t.onRemove)), onClear ? el('button', { class: 'clear', type: 'button', onclick: onClear }, 'Obriši sve') : null);
  }
  let fieldSeq = 0;
  function field(label, input, hint, o = {}) {
    const id = input.id || (input.id = 'f' + (++fieldSeq));
    if (o.search) {
      const isSel = input.tagName === 'SELECT';
      return el('div', { class: 'field' }, el('label', { for: id }, label), isSel ? el('div', { class: 'sel' }, input, icon('chev-d')) : input);
    }
    const help = hint ? el('p', { class: 'help' + (o.error ? ' err' : ''), id: id + '-h' }, hint) : null;
    if (help) input.setAttribute('aria-describedby', help.id);
    if (o.error) input.setAttribute('aria-invalid', 'true');
    return el('div', { class: 'fld' }, el('label', { class: 'lbl', for: id }, label), input, help);
  }
  function select(opts, cur, onChange, o = {}) {
    const items = opts.map(norm);
    const s = el('select', { class: 'input select' + (o.inline ? ' select-inline' : ''), 'aria-label': o.label || null, onchange: (e) => onChange && onChange(e.target.value) }, items.map((it) => el('option', { value: it.v, selected: String(it.v) === String(cur) }, it.l)));
    return s;
  }
  function check(label, checked, onChange, o = {}) {
    const input = el('input', { type: o.type || 'checkbox', name: o.name || null, value: o.value || null, checked: !!checked, onchange: (e) => onChange && onChange(e.target.checked, e.target.value) });
    return el('label', { class: 'check' }, input, el('span', {}, label), o.count != null ? el('span', { class: 'cnt' }, nf0.format(o.count)) : null);
  }
  function toggle(checked, onChange, o = {}) {
    const b = el('button', { class: 'toggle', type: 'button', role: 'switch', 'aria-checked': checked ? 'true' : 'false', 'aria-label': o.label || null, onclick: () => { const now = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', now ? 'true' : 'false'); if (onChange) onChange(now); } });
    if (!o.label) return b;
    /* ceo red je meta klika (oznaka uključuje prekidač) */
    return el('div', { class: 'toggle-row' }, el('span', { style: 'cursor:pointer', onclick: () => b.click() }, o.label), b);
  }
  function range(o = {}) {
    const min = o.min ?? 0, max = o.max ?? 100, step = o.step || 1;
    let from = o.from ?? min, to = o.to ?? max;
    const format = o.format || ((v) => nf0.format(v));
    const fl = el('span', { class: 'fl' });
    const kA = el('button', { class: 'kn', type: 'button', role: 'slider', 'aria-label': (o.label || 'Opseg') + ' — od', 'aria-valuemin': min, 'aria-valuemax': max });
    const kB = el('button', { class: 'kn', type: 'button', role: 'slider', 'aria-label': (o.label || 'Opseg') + ' — do', 'aria-valuemin': min, 'aria-valuemax': max });
    const lb = el('div', { class: 'lb' }, el('span'), el('span'));
    const root = el('div', { class: 'range-wrap' }, el('div', { class: 'range' }, el('span', { class: 'tr' }), fl, kA, kB), lb);
    const track = root.firstChild;
    const pct = (v) => ((v - min) / (max - min)) * 100;
    const paint = () => {
      kA.style.left = pct(from) + '%'; kB.style.left = pct(to) + '%';
      fl.style.left = pct(from) + '%'; fl.style.width = (pct(to) - pct(from)) + '%';
      kA.setAttribute('aria-valuenow', from); kA.setAttribute('aria-valuetext', format(from)); kB.setAttribute('aria-valuenow', to); kB.setAttribute('aria-valuetext', format(to));
      lb.children[0].textContent = format(from); lb.children[1].textContent = format(to);
    };
    const snap = (v) => clamp(Math.round(v / step) * step, min, max);
    const set = (which, v, fire) => { if (which === 'a') from = Math.min(snap(v), to); else to = Math.max(snap(v), from); paint(); if (fire && o.onInput) o.onInput(from, to); };
    const drag = (k, which) => {
      k.addEventListener('pointerdown', (e) => { k.setPointerCapture(e.pointerId); e.preventDefault(); });
      k.addEventListener('pointermove', (e) => { if (!k.hasPointerCapture(e.pointerId)) return; const r = track.getBoundingClientRect(); set(which, min + ((e.clientX - r.left) / r.width) * (max - min), true); });
      k.addEventListener('pointerup', () => { if (o.onChange) o.onChange(from, to); });
      k.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0; if (!d) return; e.preventDefault(); set(which, (which === 'a' ? from : to) + d, true); if (o.onChange) o.onChange(from, to); });
    };
    drag(kA, 'a'); drag(kB, 'b');
    track.addEventListener('pointerdown', (e) => { if (e.target.closest('.kn')) return; const r = track.getBoundingClientRect(); const v = min + ((e.clientX - r.left) / r.width) * (max - min); set(Math.abs(v - from) < Math.abs(v - to) ? 'a' : 'b', v, true); if (o.onChange) o.onChange(from, to); });
    root.set = (f, t) => { from = snap(f ?? min); to = snap(t ?? max); paint(); };
    root.get = () => ({ from, to });
    paint();
    return root;
  }
  function views(opts, cur, onPick) {
    const ICONS = { grid: 'grid', list: 'list', map: 'map', mreza: 'grid', lista: 'list', mapa: 'map' };
    const items = opts.map(norm);
    const root = el('div', { class: 'views', role: 'group', 'aria-label': 'Prikaz' });
    items.forEach((it) => root.appendChild(el('button', { type: 'button', 'aria-pressed': it.v === cur ? 'true' : 'false', 'aria-label': it.l, onclick: () => { [...root.children].forEach((b, i) => b.setAttribute('aria-pressed', items[i].v === it.v ? 'true' : 'false')); if (onPick) onPick(it.v); } }, icon(it.icon || ICONS[it.v] || 'grid'), el('span', {}, it.l))));
    return root;
  }
  function copyButton(text, o = {}) {
    return el('button', { class: 'iconbtn' + (o.outline ? ' iconbtn-outline' : ''), type: 'button', 'aria-label': o.label || 'Kopiraj', title: o.label || 'Kopiraj', onclick: async () => {
      try { await navigator.clipboard.writeText(typeof text === 'function' ? text() : text); toastSafe('Kopirano'); } catch (e) { toastSafe('Kopiranje nije uspelo'); }
    } }, icon('copy'));
  }
  function amenityTags(l) {
    const A = S(() => AMEN, {});
    return el('div', { class: 'tags' }, (l.am || []).map((k) => chip(A[k] || k)));
  }
  function photoCap(o = {}) {
    return el('div', { class: 'cap' },
      o.eyebrow ? el('p', { class: 'eyebrow' }, o.eyebrow) : null,
      el('div', { class: 'cap-row' }, el('div', {}, o.title ? el('b', {}, o.title) : null, o.facts ? el('p', { class: 'num' }, o.facts) : null), o.link ? el('a', { href: o.link.href }, o.link.label) : null));
  }
  function ctaBar(l, o = {}) {
    return el('div', { class: 'cta-bar' },
      el('a', { class: 'btn btn-primary', href: 'tel:' + String(o.phone || '').replace(/\s+/g, ''), onclick: o.onCall }, icon('phone'), 'Pozovi'),
      el('button', { class: 'btn btn-secondary', type: 'button', onclick: o.onMessage }, 'Poruka'));
  }

  /* ───────── izvoz ───────── */
  Object.assign(window, {
    icon, logo, header, footer, bottomNav, card, badge, badgesFor, badgeKinds, saleInfo, deltaChip, merilo, priceBlock, sectionHead, empty, pager, skeletonCard, loader,
    sheet, modal, tabs, accordion, sparkline, bars, histogram, pin, cluster, mapLegend, pinPopover, gallery, lightbox, agencyCard, contactCard, walkLine, streetLine,
    factsStrip, keyFacts, hood, copyButton, themeToggle, setTheme, currentTheme, segmented, pills, chip, filterChip, activeFilters, field, select, check, toggle, range,
    views, crumbs, tiles, stepper, compareTable, listTable, amenityTags, photoCap, ctaBar, tip, favButton,
  });
  window.UI_NAV = NAV;
  window.UI_HREF = href;
})();
