/* Kvadrat.rs — nalog i tokovi: Uporedi (viewCompare), Sačuvano (viewSaved), Moja mesta (viewPlaces), Postavi oglas (viewPost).
   Klasičan <script>, deli globalni opseg; izvozi samo četiri view funkcije. Zavisi od core.js (el, fmt, store, …), ui.js, images.js,
   engine.js (KX) i map.js (mapView) — svaki poziv je zaštićen, pa stranica ne puca ako neki modul nedostaje. */
'use strict';
(function () {
  /* ───────────────────────── zajedničko ───────────────────────── */
  const S = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const X = () => (typeof window !== 'undefined' && window.KX) || null;
  const lhref = (l) => S(() => UI_HREF.listing(l), '#/oglas?s=' + (typeof l === 'string' ? l : l.s));
  const findL = (s) => S(() => find.listing(s), null) || S(() => D.listings.find((x) => x.s === s), null);
  /* broj i jedinica ne smeju da se prelome u dva reda („60“ / „m²“) */
  const nbsp = (t) => String(t).replace(/(\d) (?=m²|€|min\b|km\b)/g, '$1\u00a0');
  const titleOf = (l) => nbsp(S(() => X().titleOf(l), null) || l.ti || 'Oglas');
  const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const say = (msg, o) => S(() => toast(msg, o), null);
  const ic = (name, size) => S(() => icon(name, size), null);
  const eur = (n) => S(() => fmt.price(n), Math.round(n) + ' €');
  const eurMes = (n) => S(() => fmt.price(n, 'izdavanje'), Math.round(n) + ' €/mes');
  const num = (n, d) => S(() => fmt.num(n, d), String(n));
  const placeLine = (l) => [l.n, l.m && l.m !== l.c ? l.m : l.c].filter(Boolean).join(', ');
  const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const replaceUrl = (path, params) => { try { history.replaceState(history.state, '', S(() => buildHash(path, params), '#' + path)); } catch (e) { /* iframe bez history */ } };
  const plural = (n, a, b, c) => S(() => fmt.plural(n, a, b, c), c);
  const oglasa = (n) => `${num(n)} ${plural(n, 'oglas', 'oglasa', 'oglasa')}`;
  const flat = (k) => k.flat(Infinity).filter((x) => x != null && x !== false && x !== true);
  const fill = (node, ...k) => { node.replaceChildren(...flat(k)); return node; };
  const add = (node, ...k) => { node.append(...flat(k)); return node; };
  const LETTERS = ['A', 'B', 'C', 'D'];
  const MODES = [{ v: 'gradski', l: 'Prevoz' }, { v: 'auto', l: 'Auto' }, { v: 'bicikl', l: 'Bicikl' }, { v: 'pesice', l: 'Pešice' }];
  const MODE_TXT = { gradski: 'gradskim prevozom', auto: 'kolima', bicikl: 'biciklom', pesice: 'pešice' };
  const WHO = [{ v: 'ja', l: 'Ja' }, { v: 'partner', l: 'Partner' }];

  /* pretplata koja se sama gasi kad čvor napusti dokument */
  function bind(root, subscribe, fn) {
    let off = null;
    off = S(() => subscribe((...a) => {
      if (!root.isConnected) { if (root.__seen && typeof off === 'function') off(); return; }
      root.__seen = true; fn(...a);
    }), null);
    const check = () => { if (root.isConnected) root.__seen = true; else if (!root.__seen) requestAnimationFrame(check); };
    requestAnimationFrame(check);
    return off;
  }
  /* fokus preživljava ponovno iscrtavanje: zapamti kontrolu (id → radio name+value → aria-label, unutar [data-slug] ako postoji),
     a ako je nestala (obrisana stavka) — ista vrsta kontrole na istom mestu u spisku, pa fallback */
  const cssq = (v) => '"' + S(() => CSS.escape(String(v)), String(v).replace(/["\\]/g, '\\$&')) + '"';
  function focusSel(a) {
    const tag = a.tagName.toLowerCase();
    if (a.id) return '#' + S(() => CSS.escape(a.id), a.id);
    if (tag === 'input' && a.type === 'radio' && a.name) return `input[name=${cssq(a.name)}][value=${cssq(a.value)}]`;
    const al = a.getAttribute('aria-label');
    return al ? `${tag}[aria-label=${cssq(al)}]` : null;
  }
  function focusMemo(scope) {
    const a = document.activeElement;
    if (!a || a === document.body || !a.tagName || !scope || !scope.contains(a)) return () => false;
    const sel = focusSel(a);
    const host = a.closest('[data-slug]');
    const slug = host && scope.contains(host) ? host.dataset.slug : null;
    const stem = (n) => ((n.getAttribute('aria-label') || n.textContent || '').trim().split(/\s+/)[0] || '');
    const peersOf = () => [...scope.querySelectorAll(a.tagName)].filter((n) => n.className === a.className && stem(n) === stem(a));
    const idx = stem(a) ? peersOf().indexOf(a) : -1;   /* bez natpisa nema pouzdanog „istog“ elementa */
    return (fallback) => {
      const cur = document.activeElement;
      if (cur && cur !== document.body && cur !== a && cur.isConnected) return true;   /* neko drugi je već postavio fokus */
      let n = null;
      if (sel && slug) { const h = [...scope.querySelectorAll('[data-slug]')].find((x) => x.dataset.slug === slug); n = h ? S(() => h.querySelector(sel), null) : null; }
      else if (sel) n = S(() => scope.querySelector(sel), null);
      if (!n && idx >= 0) { const p = peersOf(); if (p.length) n = p[Math.min(idx, p.length - 1)]; }
      if (!n && fallback) n = S(() => scope.querySelector(fallback), null);
      if (n && n.focus) { n.focus({ preventScroll: true }); return true; }
      return false;
    };
  }
  /* izvrši kad je čvor u dokumentu i ima dimenzije (za mapu) */
  function whenMounted(node, fn, tries = 120) {
    const go = () => { if (node.isConnected && node.clientWidth > 0) fn(); else if (tries-- > 0) requestAnimationFrame(go); };
    requestAnimationFrame(go);
  }
  function onUnmount(node, fn) {
    let was = false;
    const mo = new MutationObserver(() => { if (node.isConnected) was = true; else if (was) { mo.disconnect(); fn(); } });
    S(() => mo.observe(document.body, { childList: true, subtree: true }));
  }
  function pageHead(o) {
    return el('header', { class: 'ax-head' },
      o.crumbs ? S(() => crumbs(o.crumbs), null) : null,
      o.eyebrow ? el('p', { class: 'eyebrow' }, o.eyebrow) : null,
      el('h1', { class: 't-h1' }, o.title),
      o.lede ? el('p', { class: 'lede ax-lede' }, o.lede) : null);
  }
  const emptyBox = (title, text, label, href, opts) => S(() => empty(title, text, label, href, opts), el('div', { class: 'empty' }, el('h3', {}, title), el('p', {}, text)));
  const thumb = (l, idx = 0, aspect = '1:1') => el('span', { class: 'ax-thumb' }, S(() => img.el(l, idx, { aspect, alt: '' }), null));

  /* mapa za biranje tačke: klik (bez prevlačenja) → lat/lng iz getBounds() (ekvirektangularna projekcija je linearna na ekranu) */
  function pickMap(box, opts) {
    let api = null;
    const build = () => {
      if (typeof mapView !== 'function') { box.classList.add('ax-map-off'); add(box, el('p', { class: 'meta' }, 'Mapa nije dostupna — izaberi mesto iz liste.')); return; }
      api = S(() => mapView(box, {
        listings: opts.listings || [], city: opts.city, interactive: true, drawTool: false, legend: false, showAreaButton: false,
        popover: false, labels: true, places: opts.places || [], radius: opts.radius || null,
        view: opts.view || undefined,
      }), null);
      if (!api) return;
      if (!opts.view && opts.listings && opts.listings.length) S(() => api.fit());
      let p0 = null;
      box.addEventListener('pointerdown', (e) => { p0 = (e.target.closest('.pin, button, .ctl, .legend, a')) ? null : { x: e.clientX, y: e.clientY }; }, true);
      box.addEventListener('pointerup', (e) => {
        if (!p0) return;
        const moved = Math.hypot(e.clientX - p0.x, e.clientY - p0.y); p0 = null;
        if (moved > 6) return;
        const b = S(() => api.getBounds(), null); if (!b) return;
        const r = box.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
        if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
        opts.onPick({ lat: +(b.n + (b.s - b.n) * fy).toFixed(5), lng: +(b.w + (b.e - b.w) * fx).toFixed(5) });
      }, true);
      if (opts.onReady) opts.onReady(api);
    };
    whenMounted(box, build);
    onUnmount(box, () => S(() => api && api.destroy()));
    return { get api() { return api; } };
  }

  /* ═════════════════════════ UPOREDI ═════════════════════════ */
  const RANK_COND = { lux: 6, novogradnja: 5, renovirano: 4, 'dobro-stanje': 3, 'u-izgradnji': 2, 'potrebno-renoviranje': 1 };
  const RANK_HEAT = { centralno: 3, podno: 3, 'toplotna-pumpa': 3, etazno: 2, gas: 2, kotlarnica: 2, pelet: 1.5, struja: 1, klima: 1, 'ta-pec': 1 };
  const RANK_TRUST = { zeleno: 3, zuto: 2, crveno: 1 };
  const TRUST_TXT = { zeleno: 'Zeleno', zuto: 'Žuto', crveno: 'Crveno' };

  /* o.fin: finansiranje samo za ovu stranicu (deljeni link sa fin=kes), inače profil */
  function costOf(l, o) { return S(() => (o && o.fin ? X().cost(l, { financing: o.fin }) : X().cost(l)), null); }
  function rataOf(l, o) { const c = costOf(l, o); const r = c && c.lines ? c.lines.find((x) => x.key === 'rata') : null; return r ? r.amount : null; }
  /* mesečni red: reči samo za stavke koje zaista postoje (lokal/garaža nemaju grejanje ni zgradu); sezona menja grejanje */
  const MON_WORD = { grejanje: 'grejanje', struja: 'struja', odrzavanje: 'zgrada', 'porez-imovina': 'porez' };
  function monthlyOf(c, season) {
    if (season === 'zima' && c.monthlyWinter != null) return c.monthlyWinter;
    if (season === 'leto' && c.monthlySummer != null) return c.monthlySummer;
    return c.monthly;
  }
  function monCaption(c, season) {
    const ls = (c.lines || []).filter((x) => x.when === 'mesecno' && !x.optional && x.payer !== 'prodavac' && x.payer !== 'vlasnik' && x.amount > 0 && MON_WORD[x.key]);
    const heat = ls.find((x) => x.key === 'grejanje');
    const words = ls.filter((x) => !(x === heat && season === 'leto' && heat.summer === 0)).map((x) => MON_WORD[x.key]);
    let tail = '';
    if (heat && season !== 'prosek') tail = heat.winter == null ? ' · grejanje isto cele godine' : season === 'leto' ? ' · leti bez grejanja' : ' · grejanje zimi';
    return (words.join(', ') || 'osnovni računi') + tail;
  }
  function floorScore(l) {
    if (l.fl == null) return null;
    if (l.fl <= 0) return 1;
    if (l.tf && l.fl >= l.tf) return 2;
    return 3;
  }
  const OWN_ROW_AM = ['hasElevator', 'hasParking', 'hasGarage', 'hasTerrace', 'hasBalcony', 'hasLoggia'];
  const ORIENT_RANK = { jug: 2, jugoistok: 2, jugozapad: 2, istok: 1, zapad: 1, sever: 0, severoistok: 0, severozapad: 0 };
  const ENERGY_LIST = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const hasAm = (l, k) => (l.am || []).includes(k);
  const noBuildingRow = (l) => l.pt === 'zemljiste' || l.pt === 'garaza';
  function amenDiff(cols) {
    const all = cols.map((l) => new Set((l.am || []).filter((k) => !OWN_ROW_AM.includes(k))));
    const common = [...(all[0] || [])].filter((k) => all.every((s) => s.has(k)));
    return cols.map((l, i) => [...all[i]].filter((k) => !common.includes(k)));
  }

  /* natpis ispod „Na dan kupovine / useljenja“ — samo stavke koje zaista ulaze u zbir (isti uslov kao KX.cost: nije opciono, ne plaća prodavac/vlasnik, iznos > 0) */
  const DAY_WORD = { porez: 'porez', pdv: 'PDV', provizija: 'provizija', notar: 'overa', overa: 'overa', upis: 'upis', procena: 'troškovi kredita', obrada: 'troškovi kredita', osiguranje: 'osiguranje', kirija: 'kirija', depozit: 'depozit' };
  function dayCaption(c) {
    const when = c.kind === 'prodaja' ? 'kupovina' : 'useljenje';
    const words = (c.lines || []).filter((x) => x.when === when && !x.optional && x.payer !== 'prodavac' && x.payer !== 'vlasnik' && x.amount > 0 && x.key !== 'cena')
      .map((x) => DAY_WORD[x.key] || String(x.label || '').split(/[ (—]/)[0].toLowerCase()).filter((w, i, a) => w && a.indexOf(w) === i);
    if (c.kind === 'prodaja') return words.length ? `cena + ${words.join(', ')}` : 'samo cena';
    return words.join(', ') || 'kirija';
  }

  /* definicije redova: get(l) → { v (za poređenje) | null, node, raw (tekst za „isto“) } */
  function compareRows(cols, places, opt) {
    opt = opt || {};
    const season = opt.season || 'prosek';
    const cash = opt.finNow === 'kes';
    const A = S(() => AMEN, {});
    const diffs = amenDiff(cols);
    const mixedT = new Set(cols.map((l) => l.t)).size > 1;
    const sale = (l) => l.t === 'prodaja';
    const dash = { v: null, node: '—', raw: '—' };
    const rows = [];
    const addRow = (r) => rows.push(r);

    addRow({ group: 'Cena' });
    const dEur = (x) => S(() => fmt.price(Math.abs(x)), eur(Math.abs(x)));
    const dEurMes = (x) => eurMes(Math.abs(x));
    addRow({ key: 'p', label: 'Cena', best: mixedT ? null : 'min', delta: mixedT ? null : (x) => S(() => fmt.price(Math.abs(x), cols[0].t), eur(Math.abs(x))), get: (l) => ({ v: l.p, node: el('span', { class: 'ax-price' }, S(() => fmt.price(l.p, l.t), eur(l.p))), raw: String(l.p) }),
      why: (w, s) => s != null ? `${S(() => fmt.price(s - w, cols[0].t), eur(s - w))} jeftinije od sledećeg` : 'najniža cena' });
    addRow({ key: 'ppm', label: '€/m²', best: mixedT ? null : 'min', delta: mixedT ? null : (x) => S(() => fmt.ppm(Math.abs(x)), ''), get: (l) => l.ppm && l.pt !== 'zemljiste' ? ({ v: l.ppm, node: el('span', { class: 'ax-ppm' }, S(() => fmt.ppm(l.ppm), ''), S(() => deltaChip(l), null)), raw: String(Math.round(l.ppm)) }) : dash,
      why: (w, s) => s != null ? `${S(() => fmt.ppm(s - w), '')} manje po kvadratu` : 'najniža cena po kvadratu' });
    addRow({ key: 'fair', label: 'Fer cena', best: 'min', get: (l) => {
      const f = S(() => X().fair(l), null);
      if (!f || !f.verdict) return { v: null, node: el('span', { class: 'ax-muted' }, 'premalo uporedivih'), raw: 'n' };
      const word = f.verdict === 'ispod' ? 'Ispod procene' : f.verdict === 'iznad' ? 'Iznad procene' : 'Fer cena';
      return { v: f.diffPct, raw: f.verdict + f.diffPct, node: el('span', { class: 'ax-fair ax-fair-' + f.verdict }, el('b', {}, word), ` ${S(() => fmt.pct(f.diffPct, { sign: true }), '')}`,
        el('small', {}, `procena ${eur(f.estimate.low)} – ${eur(f.estimate.high)} · n=${f.n}`)) };
    }, why: () => 'najpovoljnije u odnosu na uporedive oglase' });
    addRow({ key: 'nego', label: 'Prostor za pregovor', best: 'max', delta: dEur, get: (l) => {
      if (!sale(l)) return dash;
      const f = S(() => X().fair(l), null);
      const ng = f && f.negotiation;
      if (!ng || ng.roomEur == null || !isFinite(ng.roomEur)) return dash;
      const r = Math.round(ng.roomEur);
      if (!r) return { v: 0, raw: '0', node: el('span', { class: 'ax-muted' }, 'nema prostora') };
      return { v: r, raw: String(r), node: el('span', {}, `oko ${eur(r)}`, el('small', {}, `${S(() => fmt.pct(ng.roomPct), ng.roomPct + ' %')} od cene${ng.leverage ? ` · pozicija: ${({ slab: 'slaba', umeren: 'umerena', jak: 'jaka' })[ng.leverage] || ng.leverage}` : ''}`)) };
    }, why: () => 'najviše prostora za pregovor' });
    addRow({ key: 'hist', label: 'Istorija cene', best: 'min', get: (l) => {
      const h = S(() => X().history(l), null);
      if (!h) return dash;
      const n = h.changes ? h.changes.length : 0;
      if (!n) return { v: 0, node: 'bez promena', raw: '0' };
      const first = h.changes[0].from, last = h.changes[n - 1].to;
      const pct = (last / first - 1) * 100;
      return { v: pct, raw: n + ':' + pct.toFixed(1), node: el('span', {}, `${n}× ${pct < 0 ? 'sniženo' : 'menjano'} · `, el('b', {}, S(() => fmt.pct(pct, { sign: true }), ''))) };
    }, why: () => 'cena je već spuštena — prostor za pregovor' });
    addRow({ key: 'dom', label: 'Na oglasu', best: 'min', get: (l) => {
      const h = S(() => X().history(l), null);
      const d = h ? h.daysOnMarket : l.dz;
      if (d == null) return dash;
      return { v: d, raw: String(d), node: el('span', {}, `${num(d)} ${plural(d, 'dan', 'dana', 'dana')}`, h && h.bumped ? el('small', {}, `obnavljan — prikazuje „${num(h.shownDays)} d“`) : null) };
    }, why: () => 'najsvežiji oglas' });

    addRow({ group: 'Prostor' });
    addRow({ key: 'a', label: 'Kvadratura', best: 'max', delta: (x) => S(() => fmt.m2(Math.abs(x)), Math.abs(x) + ' m²'), get: (l) => l.a ? ({ v: l.a, node: S(() => fmt.m2(l.a), l.a + ' m²'), raw: String(l.a) }) : dash,
      why: (w, s) => s != null ? `${S(() => fmt.m2(w - s), '')} više prostora` : 'najviše prostora' });
    addRow({ key: 'ro', label: 'Sobe', best: 'max', get: (l) => l.ro != null ? ({ v: l.ro, node: S(() => fmt.roomsText(l.ro), String(l.ro)), raw: String(l.ro) }) : dash, why: () => 'najviše soba' });
    addRow({ key: 'fl', label: 'Sprat', best: 'max', get: (l) => { const v = floorScore(l); return v == null ? dash : { v, node: S(() => fmt.floor(l.fl, l.tf), String(l.fl)), raw: l.fl + '/' + l.tf }; },
      why: () => 'ni prizemlje ni poslednji sprat' });
    addRow({ key: 'or', label: 'Orijentacija', best: 'max', get: (l) => l.or ? ({ v: ORIENT_RANK[l.or] ?? null, node: S(() => ORIENT[l.or], l.or), raw: l.or }) : dash, why: (w) => (w === 2 ? 'okrenut ka jugu — najviše sunca' : 'istok ili zapad — sunce pola dana') });
    addRow({ key: 'ter', label: 'Terasa / balkon', best: 'max', get: (l) => {
      if (noBuildingRow(l)) return dash;
      const k = ['hasTerrace', 'hasLoggia', 'hasBalcony'].find((x) => hasAm(l, x));
      return { v: k ? 1 : 0, raw: k || 'ne', node: k ? S(() => AMEN[k], 'Ima') : el('span', { class: 'ax-muted' }, 'Nema') };
    }, why: () => 'ima spoljni prostor' });

    addRow({ group: 'Zgrada i stanje' });
    addRow({ key: 'y', label: 'Godina', best: 'max', get: (l) => l.y ? ({ v: l.y, node: S(() => fmt.year(l.y), String(l.y)), raw: String(l.y) }) : dash, why: (w) => `najnovija gradnja` });
    addRow({ key: 'he', label: 'Grejanje', best: 'max', get: (l) => l.he ? ({ v: RANK_HEAT[l.he] || 1, node: S(() => HEAT[l.he], l.he), raw: l.he }) : dash, why: () => 'najudobnije i najjeftinije grejanje' });
    addRow({ key: 'co', label: 'Stanje', best: 'max', get: (l) => l.co ? ({ v: RANK_COND[l.co] || 0, node: S(() => COND[l.co], l.co), raw: l.co }) : dash, why: () => 'useljivo bez ulaganja' });
    addRow({ key: 'lift', label: 'Lift', best: 'max', get: (l) => {
      if (noBuildingRow(l) || l.pt === 'kuca' || l.pt === 'vikendica') return dash;
      const on = hasAm(l, 'hasElevator');
      return { v: on ? 1 : 0, raw: String(on), node: on ? 'Ima lift' : el('span', { class: 'ax-muted' }, 'Bez lifta') };
    }, why: () => 'ima lift' });
    addRow({ key: 'park', label: 'Parking / garaža', best: 'max', get: (l) => {
      if (l.pt === 'zemljiste') return dash;
      const v = hasAm(l, 'hasGarage') ? 2 : hasAm(l, 'hasParking') ? 1 : 0;
      return { v, raw: String(v), node: v === 2 ? 'Garaža' : v === 1 ? 'Parking mesto' : el('span', { class: 'ax-muted' }, 'Nije navedeno') };
    }, why: (w) => (w === 2 ? 'ima garažu' : 'ima parking') });
    addRow({ key: 'en', label: 'Energetski razred', best: 'max', get: (l) => {
      const i = ENERGY_LIST.indexOf(l.en);
      return i < 0 ? dash : { v: ENERGY_LIST.length - i, raw: l.en, node: el('b', {}, l.en) };
    }, why: () => 'najmanji računi za grejanje' });
    addRow({ key: 'fu', label: 'Opremljenost', best: null, get: (l) => l.fu ? ({ v: null, node: S(() => FURN[l.fu], l.fu), raw: l.fu }) : dash });
    addRow({ key: 'trust', label: 'Uknjiženo · semafor', best: 'max', get: (l) => {
      const t = S(() => X().trust(l), null);
      if (!t) return l.reg != null ? { v: l.reg ? 2 : 1, node: l.reg ? 'Uknjiženo' : 'Nije navedeno', raw: String(l.reg) } : dash;
      const label = t.legalLabel || S(() => X().legalLabel[t.legal], '') || '';
      return { v: RANK_TRUST[t.color] || 0, raw: t.color + t.legal,
        node: el('span', { class: 'ax-sem' }, el('i', { class: 'ax-dot ax-dot-' + t.color, 'aria-hidden': 'true' }), el('b', {}, TRUST_TXT[t.color] || t.color), ` · ${t.title || ''}`,
          el('small', {}, l.t === 'prodaja' ? label.replace(/ \(.*\)$/, '') : (t.rental ? `rizik prevare: ${t.rental.risk}` : ''))) };
    }, why: () => 'najmanje pravnog rizika' });

    addRow({ group: 'Troškovi' });
    addRow({ key: 'rata', label: 'Rata kredita', best: 'min', delta: dEurMes, hint: cash ? 'kupovina za keš — bez kredita' : S(() => { const p = X().profile.get(); return `${Math.round((1 - p.ltv) * 100)} % učešća, ${p.years} god., kamata ${num(p.ratePct, p.ratePct % 1 ? 1 : 0)} %`; }, ''),
      get: (l) => { if (!sale(l)) return dash; const r = rataOf(l, opt); return r ? { v: r, node: eurMes(r), raw: String(r) } : dash; },
      why: (w, s) => s != null ? `${eurMes(s - w)} manja rata` : 'najmanja rata' });
    addRow({ key: 'day', label: 'Na dan kupovine / useljenja', best: mixedT ? null : 'min', delta: mixedT ? null : dEur, get: (l) => {
      const c = costOf(l, opt); if (!c) return dash;
      const v = c.kind === 'prodaja' ? c.onPurchase : c.moveIn;
      return { v, raw: String(v), node: el('span', {}, eur(v), el('small', {}, dayCaption(c))) };
    }, why: (w, s) => s != null ? `${eur(s - w)} manje novca odjednom` : 'najmanje novca odjednom' });
    /* kupovina i zakup u istom poređenju: nema pobednika (rata gradi imovinu, kirija ne) — obe ćelije pokazuju ukupan mesečni odliv */
    const SEASON_SUB = { zima: 'zimski mesec', leto: 'letnji mesec' };
    addRow({ key: 'mon', label: mixedT ? 'Mesečno (rata ili kirija + računi)' : cash || cols.every((l) => !sale(l)) ? 'Mesečno' : 'Mesečno (bez rate)', sub: SEASON_SUB[season] || null, best: mixedT ? null : 'min', delta: mixedT ? null : dEurMes, get: (l) => {
      const c = costOf(l, opt); if (!c) return dash;
      const rata = c.kind === 'prodaja' ? (rataOf(l, opt) || 0) : 0;
      const v = Math.round(monthlyOf(c, season) - (mixedT ? 0 : rata));
      const cap = c.kind !== 'prodaja' ? 'kirija + ' + monCaption(c, season).replace(/^osnovni računi/, 'računi') : mixedT ? (rata ? `rata ${eurMes(rata)} + računi` : 'računi, bez kredita') : monCaption(c, season);
      return { v, raw: String(v), node: el('span', {}, eurMes(v), el('small', {}, cap)) };
    }, why: (w, s) => s != null ? `${eurMes(s - w)} manje svakog meseca` : 'najmanji mesečni troškovi' });

    if (places.length) {
      addRow({ group: 'Udaljenosti (procena)' });
      for (const pl of places) {
        addRow({ key: 'pl-' + pl.id, label: `Do: ${pl.name}`, sub: `${pl.who === 'partner' ? 'partner' : 'ja'} · ${MODE_TXT[pl.mode] || pl.mode}`, best: 'min', delta: (x) => `${Math.abs(x)} min`, get: (l) => {
          const t = S(() => X().travel(l, pl), null);
          if (!t) return dash;
          if (t.far) return { v: null, node: el('span', { class: 'ax-muted' }, 'drugi grad'), raw: 'far' };
          return { v: t.min, raw: String(t.min), node: el('span', {}, el('b', {}, `${t.min} min`), el('small', {}, `${num(t.km, 1)} km vazdušno`)) };
        }, why: (w, s) => s != null ? `${s - w} min bliže` : 'najbliže' });
      }
      const persons = new Set(places.map((p) => p.who || 'ja'));
      if (persons.size > 1) {
        const fm = S(() => X().fairMiddle(cols, places), null);
        addRow({ key: 'both', label: 'Najgore od dvoje', sub: 'duži od dva puta do primarnih mesta', best: 'min', delta: (x) => `${Math.abs(x)} min`, get: (l) => {
          const r = fm && fm.get ? fm.get(l.s) : null;
          return r && r.max != null ? { v: r.max, raw: String(r.max), node: el('b', {}, `${r.max} min`) } : dash;
        }, why: () => 'najbolje za oboje' });
      }
    }

    addRow({ group: 'Ostalo' });
    addRow({ key: 'adv', label: 'Oglašivač', best: null, get: (l) => ({ v: null, raw: l.ags || 'vlasnik', node: el('span', { class: 'ax-ag' }, l.ag || 'Vlasnik', l.ag && l.agv ? ic('check', 14) : null) }) });
    addRow({ key: 'dup', label: 'Isti stan na više oglasa', best: null, get: (l) => {
      const g = S(() => X().dupes.groupOf(l.s), null);
      if (!g || !g.offers || g.offers.length < 2) return { v: null, raw: '1', node: el('span', { class: 'ax-muted' }, 'samo ovaj oglas') };
      const cheapest = g.master === l.s;
      return { v: null, raw: 'g' + g.offers.length, node: el('span', {}, el('b', {}, oglasa(g.offers.length)), el('small', {}, cheapest ? 'ovaj je najjeftiniji' : `najjeftiniji: ${S(() => fmt.price(g.span.min, l.t), eur(g.span.min))}`)) };
    } });
    addRow({ key: 'am', label: 'Ostale pogodnosti (razlike)', best: 'max', get: (l) => {
      const d = diffs[cols.indexOf(l)] || [];
      if (!d.length) return { v: 0, raw: '', node: el('span', { class: 'ax-muted' }, '—') };
      return { v: d.length, raw: d.join(','), node: el('span', { class: 'ax-ams' }, d.map((k) => el('span', { class: 'tag static' }, A[k] || k))) };
    }, why: () => 'ima najviše toga što drugi nemaju' });
    return rows;
  }

  function scoreRow(row, cols) {
    const cells = cols.map((l) => S(() => row.get(l), { v: null, node: '—', raw: '—' }));
    const raws = cells.map((c) => c.raw);
    const same = cols.length > 1 && raws.every((r) => r === raws[0]);
    let winners = [];
    let why = '';
    const vals = cells.map((c) => c.v).filter((v) => v != null && isFinite(v));
    if (row.best && vals.length >= 2) {
      const best = row.best === 'min' ? Math.min(...vals) : Math.max(...vals);
      winners = cells.map((c, i) => (c.v === best ? i : -1)).filter((i) => i >= 0);
      if (winners.length === vals.length) winners = [];   /* svi isti — nema pobednika */
      else {
        const others = vals.filter((v) => v !== best);
        const second = others.length ? (row.best === 'min' ? Math.min(...others) : Math.max(...others)) : null;
        why = winners.length > 1 ? 'deli prvo mesto' : S(() => row.why(best, second), '') || '';
      }
    }
    return { cells, same, winners, why };
  }

  function viewCompare(q) {
    q = q instanceof URLSearchParams ? q : new URLSearchParams(String(q || ''));
    const fromUrl = (q.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
    let ids = (fromUrl.length ? fromUrl : S(() => store.compare.slice(), [])).filter((s, i, a) => a.indexOf(s) === i);
    const missing = ids.filter((s) => !findL(s));
    ids = ids.filter((s) => findL(s)).slice(0, 4);
    let hideSame = q.get('isto') === '0' ? true : false;
    let refSlug = q.get('ref') || null;
    /* Zima / Leto za mesečni red; Keš / Kredit ide u profil (deljeni link sa fin=kes važi samo na ovoj stranici dok ga ne promeniš) */
    let season = ['zima', 'leto'].includes(q.get('sez')) ? q.get('sez') : 'prosek';
    const profFin = () => (S(() => X().profile.get().financing, 'kredit') === 'kes' ? 'kes' : 'kredit');
    let finOvr = q.get('fin') === 'kes' && profFin() !== 'kes' ? 'kes' : null;
    const finNow = () => finOvr || profFin();
    const refOf = () => (refSlug && ids.includes(refSlug) ? refSlug : ids[0] || null);
    const urlParams = () => (ids.length ? { ids, isto: hideSame ? '0' : null, ref: refOf() && refOf() !== ids[0] ? refOf() : null, sez: season !== 'prosek' ? season : null, fin: finNow() === 'kes' ? 'kes' : null } : {});
    const root = el('div', { class: 'wrap ax-page cmp-page' });
    if (missing.length) {
      const k = missing.length;
      const msg = k === 1 ? 'Jedan oglas više ne postoji — uklonjen iz poređenja'
        : `${num(k)} ${plural(k, 'oglas više ne postoji — uklonjen', 'oglasa više ne postoje — uklonjeni', 'oglasa više ne postoji — uklonjeno')} iz poređenja`;
      setTimeout(() => say(msg), 300);
    }

    const syncStore = () => {
      S(() => { store.clearCompare(); ids.forEach((s) => store.toggleCompare(s)); });
      replaceUrl('/uporedi', urlParams());
    };
    const shareUrl = () => {
      const h = S(() => buildHash('/uporedi', { ids }), '#/uporedi?ids=' + ids.join(','));
      return S(() => location.href.split('#')[0], '') + h;
    };
    const remove = (s) => { ids = ids.filter((x) => x !== s); syncStore(); draw(); say('Uklonjeno iz poređenja'); };

    function openPicker() {
      /* posle izbora draw() zameni dugme koje je otvorilo list — pri zatvaranju fokus vraćamo na isto mesto u novoj stranici */
      const from = document.activeElement;
      const fromAdd = !!(from && from.closest && from.closest('.cmp-add'));
      const backFocus = () => {
        const a = document.activeElement;
        if (a && a !== document.body && root.contains(a)) return;
        const t = (fromAdd && root.querySelector('.cmp-addbtn')) || root.querySelector('.cmp-bar .cmp-more:not([disabled])') || root.querySelector('.cmp-bar .btn-secondary:not([disabled])') || root.querySelector('.cmp-ttl') || root.querySelector('.empty .btn');
        if (t) t.focus({ preventScroll: true });
      };
      const pool = [...S(() => [...store.favs].reverse(), []), ...S(() => store.recent, [])].filter((s, i, a) => a.indexOf(s) === i && findL(s));
      const body = el('div', { class: 'cmp-pickwrap' });
      const paint = () => {
        fill(body, );
        if (!pool.length) { add(body, emptyBox('Nema sačuvanih ni gledanih oglasa', 'Sačuvaj oglas srcem ili otvori nekoliko oglasa, pa ih dodaj ovde.', 'Pretraži oglase', '#/pretraga')); return; }
        const grp = (title, list) => list.length ? el('div', { class: 'grp' }, el('p', { class: 't' }, title), el('div', { class: 'cmp-picks' }, list.map((s) => {
          const l = findL(s); const on = ids.includes(s);
          return el('button', { type: 'button', class: 'cmp-pick', 'data-slug': s, 'aria-pressed': on ? 'true' : 'false', onclick: () => {
            if (ids.includes(s)) ids = ids.filter((x) => x !== s);
            else if (ids.length >= 4) { say('Maksimum 4 — ukloni jedan'); return; } else ids.push(s);
            syncStore(); paint(); draw();
            const again = [...body.querySelectorAll('.cmp-pick')].find((b) => b.dataset.slug === s);
            if (again) again.focus({ preventScroll: true });
          } }, thumb(l), el('span', { class: 'cmp-pick-t' }, el('b', {}, titleOf(l)), el('span', { class: 'meta' }, S(() => fmt.price(l.p, l.t), ''), ' · ', placeLine(l))),
          el('span', { class: 'cmp-pick-m', 'aria-hidden': 'true' }, ic(on ? 'check' : 'plus', 16)));
        }))) : null;
        const favs = S(() => [...store.favs].reverse(), []).filter((s) => findL(s));
        const rec = S(() => store.recent, []).filter((s) => findL(s) && !favs.includes(s));
        add(body, el('p', { class: 'meta cmp-pick-n' }, `Izabrano ${ids.length} od 4`), grp('Sačuvani oglasi', favs), grp('Nedavno gledano', rec));
      };
      paint();
      let sh = null;
      sh = S(() => sheet('Dodaj u poređenje', body, { footer: [el('button', { class: 'btn btn-ink', type: 'button', onclick: () => sh && sh.close() }, 'Prikaži poređenje')], onClose: () => { backFocus(); requestAnimationFrame(backFocus); } }), null);
    }

    function shareBox() {
      const url = shareUrl();
      const inp = el('input', { class: 'input', readonly: true, value: url, 'aria-label': 'Link za poređenje', onfocus: (e) => e.target.select() });
      return el('div', { class: 'cmp-share' }, el('label', { class: 'lbl' }, 'Link ka ovom poređenju'), el('div', { class: 'cmp-share-row' }, inp, S(() => copyButton(() => shareUrl(), { outline: true, label: 'Kopiraj link' }), null)));
    }

    function profileNote() {
      const p = S(() => X().profile.get(), null);
      if (!p) return 'podrazumevani profil';
      const def = S(() => X().profile.defaults, null) || { ltv: 0.8, years: 25, ratePct: 5 };
      const own = ['ltv', 'years', 'ratePct'].some((k) => Math.abs((+p[k] || 0) - (+def[k] || 0)) > 1e-9);
      return el('span', {}, `${own ? 'tvoj profil' : 'podrazumevani profil'}: ${Math.round((1 - p.ltv) * 100)} % učešća, ${p.years} god., kamata ${num(p.ratePct, p.ratePct % 1 ? 1 : 0)} % · `,
        el('a', { class: 'link', href: '#/kalkulator' }, 'promeni'));
    }
    function draw() {
      const restore = focusMemo(root);
      drawInner();
      restore('.cmp-bar .btn-secondary:not([disabled]), .empty .btn');
    }
    function drawInner() {
      fill(root, );
      const cols = ids.map(findL).filter(Boolean);
      add(root, pageHead({
        crumbs: [{ label: 'Početna', href: '#/' }, { label: 'Sačuvano', href: '#/sacuvani' }, { label: 'Uporedi' }],
        eyebrow: cols.length ? `UPOREDI · ${oglasa(cols.length).toUpperCase()}` : 'UPOREDI',
        title: 'Ko pobeđuje u kom redu',
      }));
      if (!cols.length) {
        add(root, emptyBox('Još nema šta da se poredi', 'Dodaj do 4 oglasa — iz sačuvanih, iz nedavno gledanih ili dugmetom „Uporedi“ na oglasu. Mi ćemo reći ko je bolji u čemu i zašto.', 'Pretraži oglase', '#/pretraga',
          { primary: { label: 'Izaberi iz sačuvanih', onClick: openPicker }, icon: 'compare' }));
        return;
      }
      const places = S(() => X().profile.get().places, []) || [];
      const rows = compareRows(cols, places, { season, fin: finOvr, finNow: finNow() });
      const scored = rows.map((r) => (r.group ? r : { ...r, ...scoreRow(r, cols) }));
      const wins = cols.map(() => 0); let contested = 0;
      scored.forEach((r) => { if (!r.group && r.winners && r.winners.length) { contested++; r.winners.forEach((i) => { wins[i]++; }); } });
      const top = Math.max(...wins);
      const leaders = wins.map((w, i) => (w === top ? i : -1)).filter((i) => i >= 0);
      const sameCount = scored.filter((r) => !r.group && r.same).length;

      /* sažetak */
      let sentence;
      if (cols.length < 2) sentence = 'Dodaj još bar jedan oglas da vidiš ko pobeđuje u kom redu.';
      else if (!top) sentence = 'Oglasi su izjednačeni u svemu što možemo da izmerimo.';
      else if (leaders.length === 1) sentence = `Oglas ${LETTERS[leaders[0]]} pobeđuje u ${top} od ${contested} ${plural(contested, 'reda', 'reda', 'redova')} u kojima postoji razlika.`;
      else sentence = `Oglasi ${leaders.map((i) => LETTERS[i]).join(' i ')} dele vođstvo sa po ${top} pobeda od ${contested} ${plural(contested, 'reda', 'reda', 'redova')}.`;
      const lede = el('p', { class: 'lede ax-lede cmp-sum' }, sentence, cols.length > 1 ? el('span', { class: 'meta' }, ' Označena ćelija je najbolja u redu, uz razlog. Sitni broj ispod vrednosti je razlika u odnosu na referentni oglas.') : null);
      add(root, lede);

      /* traka sa alatima */
      const sameToggle = S(() => toggle(hideSame, (on) => { hideSame = on; wrap.classList.toggle('show-same', !on); replaceUrl('/uporedi', urlParams()); }, { label: `Sakrij isto${sameCount ? ` (${sameCount})` : ''}` }), null);
      const shareSlot = el('div', { class: 'cmp-share-slot' });
      const anySale = cols.some((l) => l.t === 'prodaja');
      const seg = (label, opts, curV, onPick) => {
        const g = S(() => segmented(opts, curV, onPick), null);
        if (!g) return null;
        g.setAttribute('aria-label', label);
        return el('div', { class: 'cmp-opt' }, el('span', { class: 'cmp-opt-l', 'aria-hidden': 'true' }, label), g);
      };
      const seasonSeg = seg('Računi', [{ v: 'prosek', l: 'Prosek' }, { v: 'zima', l: 'Zima' }, { v: 'leto', l: 'Leto' }], season, (v) => {
        if (v === season) return;
        season = v; replaceUrl('/uporedi', urlParams()); draw();
      });
      const finSeg = anySale ? seg('Kupovina', [{ v: 'kredit', l: 'Kredit' }, { v: 'kes', l: 'Keš' }], finNow(), (v) => {
        if (v === finNow()) return;
        const changed = profFin() !== v;
        finOvr = null;
        if (changed && X()) S(() => X().profile.set({ financing: v }));   /* profile.on → draw() */
        if (!changed || !X()) draw();
        replaceUrl('/uporedi', urlParams());
        say(v === 'kes' ? 'Računamo kupovinu za keš — bez rate i troškova kredita' : 'Računamo kupovinu na kredit iz tvog profila');
      }) : null;
      add(root, el('div', { class: 'cmp-bar' },
        sameToggle,
        el('div', { class: 'cmp-opts' }, seasonSeg, finSeg),
        el('span', { class: 'sp' }),
        el('button', { class: 'btn btn-secondary btn-sm cmp-more', type: 'button', disabled: ids.length >= 4, onclick: openPicker, title: ids.length >= 4 ? 'Maksimum 4 oglasa' : null }, ic('plus', 16), 'Dodaj još'),
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: async () => {
          const url = shareUrl();
          fill(shareSlot, shareBox());
          try { await navigator.clipboard.writeText(url); say('Link je kopiran'); } catch (e) { say('Kopiraj link iz polja ispod'); }
        } }, ic('link', 16), 'Kopiraj link'),
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { ids = []; syncStore(); draw(); say('Poređenje je ispražnjeno'); } }, 'Isprazni')),
      shareSlot);

      /* tabela */
      const n = cols.length;
      const refIdx = Math.max(0, ids.indexOf(refOf()));
      const head = el('tr', { class: 'cmp-hd' }, el('th', { class: 'lab', scope: 'col' }, el('span', { class: 'sr' }, 'Oglas')),
        cols.map((l, i) => el('td', { class: leaders.length === 1 && leaders[0] === i && top ? 'lead' : null },
          el('div', { class: 'cmp-ph' },
            el('a', { class: 'ph', href: lhref(l), tabindex: '-1', 'aria-hidden': 'true' }, S(() => img.el(l, 0, { aspect: '4:3', alt: '' }), null)),
            el('span', { class: 'cmp-let', 'aria-hidden': 'true' }, LETTERS[i]),
            el('button', { class: 'iconbtn cmp-x', type: 'button', 'aria-label': `Ukloni oglas ${LETTERS[i]} iz poređenja`, onclick: () => remove(l.s) }, ic('x', 18))),
          el('p', { class: 'cmp-price' }, S(() => fmt.price(l.p, l.t), eur(l.p))),
          el('a', { class: 'cmp-ttl', href: lhref(l) }, el('span', { class: 'sr' }, `Oglas ${LETTERS[i]}: `), titleOf(l)),
          el('p', { class: 'cmp-loc' }, placeLine(l)),
          n > 1 ? el('p', { class: 'cmp-wins' + (wins[i] === top && top ? ' top' : '') }, el('b', {}, String(wins[i])), ` ${plural(wins[i], 'pobeda', 'pobede', 'pobeda')}`) : null,
          n > 1 ? el('label', { class: 'check cmp-refpick' }, el('input', { type: 'radio', name: 'cmp-ref', value: l.s, checked: refIdx === i, onchange: () => { refSlug = l.s; syncStore(); draw(); } }), el('span', {}, refIdx === i ? 'Referentni oglas' : 'Uporedi sa ovim')) : null)),
        n < 4 ? el('td', { class: 'cmp-add' }, el('button', { type: 'button', class: 'cmp-addbtn', onclick: openPicker }, ic('plus', 22), el('span', {}, 'Dodaj oglas'), el('small', {}, `još ${4 - n}`))) : null);
      const body = [];
      for (const r of scored) {
        if (r.group) { body.push(el('tr', { class: 'cmp-grp' }, el('th', { scope: 'rowgroup', class: 'lab' }, r.group), el('td', { colspan: String(n) }), n < 4 ? el('td', { class: 'cmp-add' }) : null)); continue; }
        const rv = r.cells[refIdx] && r.cells[refIdx].v;
        body.push(el('tr', { class: r.same && n > 1 ? 'same' : null, 'data-row': r.key },
          el('th', { scope: 'row', class: 'lab' }, r.label, r.sub ? el('small', {}, r.sub) : null, r.hint ? el('small', {}, r.hint) : null),
          r.cells.map((c, i) => {
            const win = r.winners.includes(i);
            const dv = r.delta && n > 1 && i !== refIdx && c.v != null && rv != null && isFinite(c.v) && isFinite(rv) ? Math.round((c.v - rv) * 10) / 10 : null;
            return el('td', { class: win ? 'win' : null },
              el('div', { class: 'cmp-v' }, c.node),
              dv != null ? el('p', { class: 'cmp-d num' }, dv === 0 ? 'isto kao ' + LETTERS[refIdx] : [`${dv > 0 ? '+' : '−'}${S(() => r.delta(dv), String(Math.abs(dv)))}`, el('span', { class: 'meta' }, ` u odnosu na ${LETTERS[refIdx]}`)]) : null,
              win ? el('p', { class: 'why' }, el('i', { class: 'mk', 'aria-hidden': 'true' }), el('span', { class: 'sr' }, 'Najbolje: '), r.why) : null);
          }),
          n < 4 ? el('td', { class: 'cmp-add' }) : null));
      }
      const table = el('table', { class: 'cmp' + (n < 4 ? ' has-add' : ''), style: `--n:${n}` }, el('caption', { class: 'sr' }, 'Uporedna tabela oglasa'), el('thead', {}, head), el('tbody', {}, body));
      const wrap = el('div', { class: 'cmp-wrap' + (hideSame ? '' : ' show-same'), tabindex: '0', role: 'region', 'aria-label': 'Tabela poređenja, pomera se vodoravno' }, table);
      const fade = el('div', { class: 'cmp-scroll' }, wrap);
      const paintFade = () => { const end = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 4; fade.classList.toggle('at-end', end); fade.classList.toggle('scrolled', wrap.scrollLeft > 4); };
      wrap.addEventListener('scroll', paintFade, { passive: true });
      requestAnimationFrame(paintFade);
      add(root, fade);
      add(root, el('p', { class: 'note-rule cmp-foot' },
        'Troškovi, rata i fer cena su procene iz Kvadrat modela (', profileNote(), '). ',
        places.length ? 'Minuti do tvojih mesta su vazdušna linija × 1,3 i prosečna brzina — ne znamo linije ni gužve. ' : el('span', {}, 'Dodaj ', el('a', { class: 'link', href: '#/moja-mesta' }, 'svoja mesta'), ' (posao, fakultet, roditelji) da vidiš i minute do njih. '),
        el('a', { class: 'link', href: '#/kako-racunamo' }, 'Kako računamo')));
    }
    draw();
    bind(root, (fn) => X() && X().profile.on(fn), () => draw());
    return root;
  }

  /* ═════════════════════════ SAČUVANO ═════════════════════════ */
  const RATINGS_KEY = 'kv.ratings';
  const SEARCH_META_KEY = 'kv.searchMeta';
  const FREQ = [{ v: 'odmah', l: 'Odmah' }, { v: 'dnevno', l: 'Dnevno' }, { v: 'nedeljno', l: 'Nedeljno' }, { v: 'nikad', l: 'Bez obaveštenja' }];

  function stars(slug, onChange) {
    const get = () => (lsGet(RATINGS_KEY, {}) || {})[slug] || 0;
    const root = el('div', { class: 'sv-stars', role: 'radiogroup', 'aria-label': 'Moja ocena' });
    const paint = () => { const v = get(); [...root.children].forEach((b, i) => { b.classList.toggle('on', i < v); b.setAttribute('aria-checked', i + 1 === v ? 'true' : 'false'); b.tabIndex = (v ? i + 1 === v : i === 0) ? 0 : -1; }); };
    for (let i = 1; i <= 5; i++) {
      add(root, el('button', { type: 'button', role: 'radio', 'aria-label': `${i} od 5`, onclick: () => {
        const all = lsGet(RATINGS_KEY, {}) || {};
        if (all[slug] === i) delete all[slug]; else all[slug] = i;
        if (!lsSet(RATINGS_KEY, all)) say('Ocena nije sačuvana — pregledač ne dozvoljava čuvanje');
        paint(); if (onChange) onChange();
      }, onkeydown: (e) => {
        const K = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
        if (!(e.key in K) && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault();
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? 4 : Math.min(4, Math.max(0, i - 1 + K[e.key]));
        root.children[j].focus();
        if (get() === j + 1) return;                       /* na kraju niza: strelica ne briše ocenu */
        const all = lsGet(RATINGS_KEY, {}) || {}; all[slug] = j + 1;
        if (!lsSet(RATINGS_KEY, all)) say('Ocena nije sačuvana — pregledač ne dozvoljava čuvanje');
        paint(); if (onChange) onChange();
      } }, ic('star', 18)));
    }
    paint();
    return root;
  }

  function paramsToQS(params) { return new URLSearchParams((S(() => buildHash('/pretraga', params), '') .split('?')[1]) || ''); }
  /* filteri koje zna samo search.js (zona, semafor, sniženja…) — bez njega broj je približan */
  const EXTRA_KEYS = ['zona', 'bb', 'legal', 'drop', 'dropm', 'below', 'stale', 'tot', 'mes', 'tmax', 'aff'];
  const hasExtras = (params) => EXTRA_KEYS.some((k) => params && params[k] != null && String(params[k]) !== '');
  /* → { list, exact } — tačan broj iz search.js kad je učitan (ista logika kao stranica rezultata), inače core filteri bez sakrivenih */
  function searchResults(params) {
    const qs = paramsToQS(params);
    const viaSearch = S(() => (typeof window.searchCount === 'function' ? window.searchCount(params) : null), null);
    if (Array.isArray(viaSearch)) return { list: viaSearch, exact: true };
    const viaSrp = S(() => (window.__srp && typeof window.__srp.run === 'function' ? window.__srp.run(qs) : null), null);
    if (Array.isArray(viaSrp)) return { list: viaSrp, exact: true };
    const hidden = S(() => X().profile.get().hidden, null) || new Set();
    const showHidden = qs.get('hid') === '1';
    const list = (S(() => applyFilters(paramsToFilters(qs)), []) || []).filter((l) => showHidden || !hidden.has(l.s));
    return { list, exact: !hasExtras(params) };
  }
  function chipsFor(params) {
    const f = S(() => paramsToFilters(paramsToQS(params)), null);
    if (!f) return [];
    const out = [];
    out.push(f.t === 'izdavanje' ? 'Izdavanje' : 'Prodaja');
    (f.pt || []).forEach((v) => out.push(S(() => typeOf(v).l, v)));
    if (f.c) out.push(S(() => find.city(f.c).n, f.c));
    (f.m || []).forEach((v) => out.push(S(() => find.mun(v).n, v)));
    (f.n || []).forEach((v) => out.push(S(() => (D.listings.find((l) => l.ns === v) || {}).n, v) || v));
    if (f.pmin !== '' || f.pmax !== '') out.push(f.pmin !== '' && f.pmax !== '' ? `${num(f.pmin)}–${S(() => fmt.price(f.pmax, f.t), eur(f.pmax))}` : f.pmax !== '' ? `do ${S(() => fmt.price(f.pmax, f.t), eur(f.pmax))}` : `od ${S(() => fmt.price(f.pmin, f.t), eur(f.pmin))}`);
    if (f.amin !== '' || f.amax !== '') out.push(f.amin !== '' && f.amax !== '' ? `${f.amin}–${f.amax} m²` : f.amax !== '' ? `do ${f.amax} m²` : `od ${f.amin} m²`);
    (f.ro || []).forEach((v) => out.push(typeof v === 'string' ? `${v.replace('+', '')}+ sobe` : S(() => fmt.roomsText(v), v + ' sobe')));
    (f.co || []).forEach((v) => out.push(S(() => COND[v], v)));
    (f.he || []).forEach((v) => out.push(S(() => HEAT[v], v)));
    (f.fu || []).forEach((v) => out.push(S(() => FURN[v], v)));
    if (f.reg) out.push('Uknjiženo');
    if (f.newbuild) out.push('Novogradnja');
    if (f.notLast) out.push('Nije poslednji sprat');
    (f.am || []).forEach((v) => out.push(S(() => AMEN[v], v)));
    if (f.advertiser) out.push(f.advertiser === 'vlasnik' ? 'Vlasnici' : 'Agencije');
    if (f.q) out.push(`„${f.q}“`);
    if (params.zona) out.push('Nacrtana zona');
    else if (params.bb) out.push('Oblast na mapi');
    const flag = (k) => params[k] != null && ['1', 'true', ''].includes(String(params[k]));
    if (flag('legal')) out.push('Samo zeleni semafor');
    if (flag('drop')) out.push('Snižena cena');
    if (flag('below')) out.push('Ispod fer cene');
    if (flag('stale')) out.push('Dugo na oglasu');
    if (params.tot) out.push(`ukupno do ${eur(+params.tot)}`);
    if (params.mes) out.push(`mesečno do ${eurMes(+params.mes)}`);
    return out.filter(Boolean);
  }

  /* kartica precrtava staru cenu iz ui.saleInfo (mock), a beleška/poređenje čitaju KX.history — usaglasi karticu sa istorijom */
  function lastDrop(l) {
    const h = S(() => X().history(l), null);
    if (!h || !h.changes) return null;
    const ch = h.changes[h.changes.length - 1];
    return ch && ch.to < ch.from ? ch : null;
  }
  function syncSale(node, l) {
    if (!node || !X()) return node;
    const drop = lastDrop(l);
    const price = node.querySelector('.price');
    const strike = price && price.querySelector('s');
    if (!drop) {
      if (strike) strike.remove();
      node.querySelectorAll('.badge[data-kind="snizena"]').forEach((b) => b.remove());
    } else if (price) {
      const txt = S(() => fmt.price(drop.from, l.t), eur(drop.from));
      if (strike) strike.textContent = txt; else add(price, el('s', { 'aria-label': 'stara cena' }, txt));
    }
    return node;
  }
  const savedCard = (l, variant) => syncSale(S(() => card(l, variant), null), l);

  const MONTHS_LOC = ['januaru', 'februaru', 'martu', 'aprilu', 'maju', 'junu', 'julu', 'avgustu', 'septembru', 'oktobru', 'novembru', 'decembru'];
  function changeWhen(ch) {
    const days = ch.daysAgo != null ? ch.daysAgo : ch.d ? Math.round((Date.now() - Date.parse(ch.d)) / 864e5) : null;
    if (days != null && isFinite(days) && days >= 0) { const r = S(() => fmt.rel(days), ''); if (r) return r; }
    const [y, m] = String(ch.m || '').split('-').map(Number);
    return y && m ? `u ${MONTHS_LOC[m - 1]} ${y}.` : '';
  }
  function savedListings(state, rerender) {
    const favs = S(() => [...store.favs], []).filter((s) => findL(s));
    if (!favs.length) return emptyBox('Još nema sačuvanih oglasa', 'Klikni na srce na kartici ili na oglasu — ovde ćeš imati beleške, ocene i poređenje.', 'Pretraži oglase', '#/pretraga', { icon: 'heart' });
    const ratings = lsGet(RATINGS_KEY, {}) || {};
    const order = favs.slice().reverse();   /* poslednje sačuvano prvo */
    const list = order.map(findL);
    if (state.sort === 'rating') list.sort((a, b) => (ratings[b.s] || 0) - (ratings[a.s] || 0));
    else if (state.sort === 'p-asc') list.sort((a, b) => a.p - b.p);
    else if (state.sort === 'p-desc') list.sort((a, b) => b.p - a.p);
    const sel = state.pick;
    for (const s of [...sel]) if (!favs.includes(s)) sel.delete(s);
    const cmpBtn = el('a', { class: 'btn btn-primary btn-sm', href: '#/uporedi', onclick: (e) => {
      e.preventDefault();
      if (sel.size < 2) { say('Izaberi bar 2 oglasa za poređenje'); return; }
      const ids = [...sel].slice(0, 4);
      S(() => { store.clearCompare(); ids.forEach((s) => store.toggleCompare(s)); });
      location.hash = S(() => buildHash('/uporedi', { ids }), '#/uporedi?ids=' + ids.join(','));
    } });
    const paintBtn = () => { fill(cmpBtn, ic('compare', 16), `Uporedi izabrane (${sel.size})`); cmpBtn.setAttribute('aria-disabled', sel.size < 2 ? 'true' : 'false'); hint.textContent = sel.size < 2 ? 'Označi 2–4 oglasa za poređenje' : sel.size > 4 ? 'Upoređuju se prva 4 označena' : `${sel.size} označena`; };
    const hint = el('span', { class: 'meta' });
    const items = list.map((l) => {
      const h = S(() => X().history(l), null);
      const ch = h && h.changes && h.changes.length ? h.changes[h.changes.length - 1] : null;
      const status = el('span', { class: 'sv-saved meta', 'aria-live': 'polite' });
      const save = debounce((v) => { S(() => store.setNote(l.s, v)); status.textContent = 'Beleška sačuvana'; setTimeout(() => { status.textContent = ''; }, 1600); }, 450);
      const note = el('textarea', { class: 'input sv-note', rows: '2', maxlength: '600', placeholder: 'Beleška samo za tebe — npr. „dobar raspored, proveriti buku sa ulice“', 'aria-label': `Beleška za oglas ${titleOf(l)}`, oninput: (e) => save(e.target.value) });
      note.value = S(() => store.getNote(l.s), '') || '';
      return el('div', { class: 'sv-item', 'data-slug': l.s },
        savedCard(l, 'grid') || el('a', { href: lhref(l) }, titleOf(l)),
        el('div', { class: 'sv-tools' },
          ch ? el('p', { class: 'sv-change' }, ic(ch.to < ch.from ? 'arrow-down' : 'arrow-up', 14), `Cena ${ch.to < ch.from ? 'snižena' : 'povećana'} ${changeWhen(ch)}: `, el('s', {}, S(() => fmt.price(ch.from, l.t), eur(ch.from))), ' → ', el('b', {}, S(() => fmt.price(ch.to, l.t), eur(ch.to)))) : null,
          el('div', { class: 'sv-row' },
            S(() => check('Uporedi', sel.has(l.s), (on) => { if (on) sel.add(l.s); else sel.delete(l.s); paintBtn(); }), null),
            stars(l.s, () => { if (state.sort === 'rating') rerender(); })),
          note, status));
    });
    paintBtn();
    return el('div', { class: 'sv-panel' },
      el('div', { class: 'sv-bar' },
        el('label', { class: 'sv-sort' }, el('span', { class: 'meta' }, 'Poređaj:'), S(() => select([{ v: 'saved', l: 'Poslednje sačuvano' }, { v: 'rating', l: 'Moja ocena' }, { v: 'p-asc', l: 'Cena rastuće' }, { v: 'p-desc', l: 'Cena opadajuće' }], state.sort, (v) => { state.sort = v; rerender(); }, { inline: true, label: 'Poređaj sačuvane' }), null)),
        el('span', { class: 'sp' }), hint, cmpBtn),
      el('div', { class: 'sv-grid' }, items));
  }

  function savedSearches() {
    const list = S(() => store.searches, []) || [];
    if (!list.length) return emptyBox('Nema sačuvanih pretraga', 'U rezultatima pretrage klikni „Sačuvaj pretragu“ — ovde ćeš videti koliko je novih oglasa stiglo od poslednje posete.', 'Idi na pretragu', '#/pretraga', { icon: 'bell' });
    const meta = lsGet(SEARCH_META_KEY, {}) || {};
    const now = Date.now();
    const posted = (l) => now - (l.dz || 0) * 864e5;
    const rows = list.map((s) => {
      const { list: res, exact } = searchResults(s.params || {});
      const created = Date.parse(s.created) || now;
      const m = meta[s.id] || {};
      const seen = m.seen || created;
      const atSave = m.n != null ? m.n : res.filter((l) => posted(l) <= created).length;
      const fresh = res.filter((l) => posted(l) > seen).length;
      const age = Math.max(0, Math.floor((now - created) / 864e5));
      const openHref = S(() => buildHash('/pretraga', s.params), '#/pretraga');
      const freq = el('label', { class: 'sv-freq' }, el('span', { class: 'lbl' }, 'Obaveštenja'),
        S(() => select(FREQ, m.freq || s.freq || 'dnevno', (v) => { s.freq = v; const all = lsGet(SEARCH_META_KEY, {}) || {}; all[s.id] = { ...(all[s.id] || {}), freq: v }; lsSet(SEARCH_META_KEY, all); say(v === 'nikad' ? 'Obaveštenja isključena (demo)' : `Obaveštenja: ${FREQ.find((x) => x.v === v).l.toLowerCase()} (demo)`); }, { label: `Učestalost obaveštenja za ${s.name}` }), null),
        el('small', {}, 'obaveštenja su demo'));
      return el('li', { class: 'sv-search' },
        el('div', { class: 'sv-s-main' },
          el('div', { class: 'sv-s-hd' },
            el('h3', {}, el('a', { href: openHref }, s.name)),
            fresh ? S(() => badge('novo', `${fresh} ${plural(fresh, 'novi oglas', 'nova oglasa', 'novih oglasa')} od poslednje posete`), null) : el('span', { class: 'meta' }, 'nema novih od poslednje posete')),
          el('div', { class: 'sv-chips' }, chipsFor(s.params || {}).map((t) => S(() => chip(t), el('span', { class: 'tag static' }, t)))),
          el('p', { class: 'meta num' }, `Sačuvano ${S(() => fmt.rel(age), '')} · sada ${exact ? '' : 'približno '}${oglasa(res.length)} · pri čuvanju ${num(atSave)}`)),
        el('div', { class: 'sv-s-act' },
          freq,
          el('div', { class: 'btn-row' },
            el('a', { class: 'btn btn-secondary btn-sm', href: openHref, onclick: () => { const all = lsGet(SEARCH_META_KEY, {}) || {}; all[s.id] = { ...(all[s.id] || {}), seen: Date.now(), n: m.n != null ? m.n : atSave }; lsSet(SEARCH_META_KEY, all); } }, 'Otvori'),
            el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { S(() => store.removeSearch(s.id)); say('Pretraga je obrisana'); } }, ic('trash', 16), 'Obriši'))));
    });
    return el('div', { class: 'sv-panel' }, el('ul', { class: 'sv-searches' }, rows));
  }

  function recentPanel() {
    const list = S(() => store.recent, []).map(findL).filter(Boolean);
    if (!list.length) return emptyBox('Još nema pregledanih oglasa', 'Oglasi koje otvoriš pojaviće se ovde, da lako nađeš onaj od juče.', 'Pretraži oglase', '#/pretraga', { icon: 'eye' });
    return el('div', { class: 'sv-panel' }, el('p', { class: 'meta sv-lead' }, list.length === 1 ? 'Poslednji otvoren oglas. Čuva se samo na ovom uređaju.'
      : `${plural(list.length, 'Poslednji', 'Poslednja', 'Poslednjih')} ${num(list.length)} ${plural(list.length, 'otvoren oglas', 'otvorena oglasa', 'otvorenih oglasa')}, najnoviji prvi. Čuva se samo na ovom uređaju.`),
      el('div', { class: 'sv-compact' }, list.map((l) => savedCard(l, 'compact'))));
  }

  function hiddenPanel() {
    const hidden = [...(S(() => X().profile.get().hidden, new Set()) || [])].map(findL).filter(Boolean);
    if (!hidden.length) return emptyBox('Nema sakrivenih oglasa', 'Oglase koje sakriješ u rezultatima pretrage više ne prikazujemo — a ovde ih uvek možeš vratiti.', 'Nazad na pretragu', '#/pretraga', { icon: 'eye' });
    return el('div', { class: 'sv-panel' }, el('p', { class: 'meta sv-lead' }, `${oglasa(hidden.length)} ne prikazujemo u rezultatima.`),
      el('div', { class: 'sv-compact' }, hidden.map((l) => el('div', { class: 'sv-hidden' }, savedCard(l, 'compact'),
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => {
          const h = new Set(S(() => X().profile.get().hidden, new Set())); h.delete(l.s);
          S(() => X().profile.set({ hidden: h }));
          say('Oglas je vraćen u rezultate');
        } }, ic('refresh', 16), 'Vrati')))));
  }

  /* ── Poruke i obilasci: kv.messages / kv.viewings (upisuje stranica oglasa). Statusi su demo — izvedeni iz vremena slanja i hash(slug), bez nasumičnosti ── */
  const MSG_KEY = 'kv.messages', VIS_KEY = 'kv.viewings';
  const IB_WAIT = 15e3, IB_REPLY = 10e3;
  const IB_SLOTS = ['09:30', '11:00', '12:30', '15:00', '16:30', '18:00', '19:30'];
  const IB_WD = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
  const IB_MG = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
  const ibCap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const ibHash = (t) => S(() => hash(String(t)), [...String(t)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7));
  const ibDay = (iso) => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return isNaN(d) ? null : d; };
  const ibDate = (d) => `${IB_WD[d.getDay()]}, ${d.getDate()}. ${IB_MG[d.getMonth()]}`;
  const ibList = (k) => { const v = lsGet(k, []); return Array.isArray(v) ? v.filter((x) => x && typeof x.s === 'string' && x.at) : []; };
  const ibId = (x) => x.s + '|' + x.at;
  const ibCount = () => ibList(MSG_KEY).length + ibList(VIS_KEY).length;
  function ibSent(at, now) {
    const t = Date.parse(at);
    if (!isFinite(t)) return '';
    const d = new Date(t), mins = Math.floor((now - t) / 6e4);
    if (mins < 1) return 'upravo';
    if (mins < 60) return `pre ${mins} min`;
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const days = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    return days <= 0 ? `danas u ${hm}` : days === 1 ? `juče u ${hm}` : `${d.getDate()}. ${IB_MG[d.getMonth()]} u ${hm}`;
  }
  /* status obilaska: prvih 15 s čeka, zatim hash(slug) bira potvrdu ili predlog drugog termina (sutradan, drugi sat) */
  function visitStatus(v, now) {
    if (v.cancelled) return { k: 'off', l: 'Otkazano' };
    const day = ibDay(v.day);
    const today = new Date(now); today.setHours(12, 0, 0, 0);
    if (now - Date.parse(v.at) < IB_WAIT) return { k: 'wait', l: 'Čeka potvrdu' };
    const h = ibHash(v.s);
    if (h % 3 === 0 && !v.accepted) {
      const alt = day ? new Date(day.getTime() + 864e5) : null;
      const slot = IB_SLOTS.filter((t) => t !== v.slot)[h % (IB_SLOTS.length - 1)];
      return { k: 'alt', l: 'Predložen drugi termin', alt: alt ? { day: alt.toISOString().slice(0, 10), txt: `${ibDate(alt)} u ${slot}`, slot } : null };
    }
    if (day && day < today) return { k: 'past', l: 'Termin je prošao' };
    return { k: 'ok', l: 'Potvrđeno' };
  }
  const REPLIES = {
    prodaja: ['Hvala na poruci! Nekretnina je i dalje u prodaji. Možemo da se čujemo telefonom ili da zakažemo obilazak — javite koji dan vam odgovara.',
      'Poštovani, oglas je aktuelan. Šaljem vam detalje o dokumentaciji, a za obilazak su nam slobodni radni dani posle 16 h i subota pre podne.',
      'Hvala na interesovanju. Cena je okvirno fiksna, ali za ozbiljnog kupca ima prostora za razgovor. Kada biste mogli da pogledate?'],
    izdavanje: ['Hvala na poruci! Stan je još slobodan, useljiv odmah. Depozit je jedna kirija, a račune plaća stanar. Kada biste mogli da pogledate?',
      'Poštovani, stan je dostupan. Za obilazak su nam slobodni radni dani posle 17 h. Javite da li imate ljubimce i koliko vas bi živelo.',
      'Hvala na interesovanju. Kirija je fiksna, ugovor na godinu dana sa mogućnošću produženja. Možemo da zakažemo obilazak ove nedelje.'],
  };
  function inboxPanel(rerender) {
    const box = el('div', { class: 'sv-panel sv-ib' });
    let timer = 0;
    const update = (k, fn) => { lsSet(k, ibList(k).map(fn).filter(Boolean)); };
    const remove = (k, x, msg) => { update(k, (y) => (ibId(y) === ibId(x) ? null : y)); say(msg); rerender(); };
    const lcard = (l, x) => (l ? savedCard(l, 'compact') : null) || el('p', { class: 'meta sv-ib-gone' }, `Oglas ${x.r || ''} više nije objavljen.`);
    const status = (st) => el('span', { class: 'sv-st sv-st-' + st.k }, el('i', { 'aria-hidden': 'true' }), st.l);
    function visitRow(v, now) {
      const l = findL(v.s);
      const st = visitStatus(v, now);
      const day = ibDay(v.day);
      const when = `${day ? ibCap(ibDate(day)) : v.day} u ${v.slot} · ${v.mode === 'video' ? 'video poziv' : 'uživo'}`;
      const ag = l ? (l.ag || 'Vlasnik') : 'Oglašivač';
      const acts = [];
      if (st.k === 'alt' && st.alt) acts.push(el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => {
        update(VIS_KEY, (y) => (ibId(y) === ibId(v) ? { ...y, day: st.alt.day, slot: st.alt.slot, accepted: true } : y)); say(`Termin je prihvaćen: ${st.alt.txt}`); paint(); } }, ic('check', 16), 'Prihvati novi termin'));
      if (st.k === 'wait' || st.k === 'ok' || st.k === 'alt') acts.push(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': `Otkaži obilazak — ${when}`, onclick: () => {
        update(VIS_KEY, (y) => (ibId(y) === ibId(v) ? { ...y, cancelled: true } : y)); say('Obilazak je otkazan — oglašivaču javljamo (demo)'); paint(); } }, ic('x', 16), 'Otkaži'));
      acts.push(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': `Obriši obilazak — ${when}`, onclick: () => remove(VIS_KEY, v, 'Obilazak je obrisan sa spiska') }, ic('trash', 16), 'Obriši'));
      return el('li', { class: 'sv-ib-item' + (st.k === 'off' || st.k === 'past' ? ' is-off' : ''), 'data-slug': v.s },
        lcard(l, v),
        el('div', { class: 'sv-ib-body' },
          el('div', { class: 'sv-ib-hd' }, el('span', { class: 'sv-ib-kind' }, ic('calendar', 14), 'Obilazak'), status(st)),
          el('p', { class: 'sv-ib-when num' }, st.k === 'off' ? el('s', {}, when) : when),
          st.k === 'alt' && st.alt ? el('p', { class: 'sv-ib-alt' }, `${ag} predlaže: `, el('b', {}, `${ibCap(st.alt.txt)}`), '. Prvobitni termin je zauzet.') : null,
          st.k === 'wait' ? el('p', { class: 'meta' }, `${ag} obično potvrđuje u roku od nekoliko sati — ovde odmah vidiš odgovor.`) : null,
          el('p', { class: 'meta num' }, `Zahtev poslat ${ibSent(v.at, now)}${l ? ` · ${l.r}` : ''}`),
          el('div', { class: 'btn-row sv-ib-act' }, acts)));
    }
    function msgRow(m, now) {
      const l = findL(m.s);
      const age = now - Date.parse(m.at);
      const to = m.to || (l && l.ag) || 'Oglašivač';
      const replied = age >= IB_REPLY;
      const pool = REPLIES[l && l.t === 'izdavanje' ? 'izdavanje' : 'prodaja'];
      const reply = pool[ibHash(m.s) % pool.length];
      const replyAt = new Date(Date.parse(m.at) + IB_REPLY).toISOString();
      return el('li', { class: 'sv-ib-item', 'data-slug': m.s },
        lcard(l, m),
        el('div', { class: 'sv-ib-body' },
          el('div', { class: 'sv-ib-hd' }, el('span', { class: 'sv-ib-kind' }, ic('mail', 14), `Poruka za: ${to}`), status(replied ? { k: 'ok', l: 'Odgovoreno' } : { k: 'wait', l: 'Poslato' })),
          el('blockquote', { class: 'sv-ib-msg' }, m.text || '(prazna poruka)'),
          el('p', { class: 'meta num' }, `Poslato ${ibSent(m.at, now)}${m.r ? ` · ${m.r}` : ''}`),
          replied ? el('div', { class: 'sv-ib-reply' },
            el('p', { class: 'sv-ib-from' }, el('b', {}, to), el('span', { class: 'meta' }, ` · ${ibSent(replyAt, now)} · automatski odgovor (demo)`)),
            el('p', {}, reply))
            : el('p', { class: 'meta sv-ib-typing' }, `${to} je primio poruku. Odgovor stiže ovde.`),
          el('div', { class: 'btn-row sv-ib-act' },
            l ? el('a', { class: 'btn btn-secondary btn-sm', href: lhref(l) }, 'Otvori oglas') : null,
            el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': `Obriši poruku za ${to}`, onclick: () => remove(MSG_KEY, m, 'Poruka je obrisana') }, ic('trash', 16), 'Obriši'))));
    }
    function paint() {
      clearTimeout(timer);
      const now = Date.now();
      const by = (a, b) => Date.parse(b.at) - Date.parse(a.at);
      const vis = ibList(VIS_KEY).sort(by), msgs = ibList(MSG_KEY).sort(by);
      if (!vis.length && !msgs.length) {
        fill(box, emptyBox('Još nema poruka ni obilazaka', 'Na stranici oglasa klikni „Pošalji poruku“ ili „Zakaži obilazak“ — ovde pratiš odgovore i potvrde termina.', 'Pretraži oglase', '#/pretraga', { icon: 'mail' }));
        return;
      }
      const restore = focusMemo(box);
      const sec = (title, n, rows, none) => el('section', { class: 'sv-ib-sec' },
        el('h2', { class: 'sv-ib-h' }, title, el('span', { class: 'meta num' }, ` · ${n}`)),
        rows.length ? el('ul', { class: 'sv-ib-list' }, rows) : el('p', { class: 'meta sv-ib-none' }, none));
      fill(box,
        el('p', { class: 'meta sv-lead' }, 'Odgovori oglašivača i potvrde termina su demo: stižu automatski posle nekoliko sekundi. Sve ostaje samo na ovom uređaju.'),
        sec('Obilasci', vis.length, vis.map((v) => visitRow(v, now)), 'Nema zakazanih obilazaka — na oglasu klikni „Zakaži obilazak“.'),
        sec('Poruke', msgs.length, msgs.map((m) => msgRow(m, now)), 'Nema poslatih poruka — na oglasu klikni „Pošalji poruku“.'));
      restore();
      /* sledeća promena statusa (10 s odgovor, 15 s potvrda) — osveži samo ovaj panel dok je na strani */
      const due = [...vis.filter((v) => !v.cancelled).map((v) => Date.parse(v.at) + IB_WAIT), ...msgs.map((m) => Date.parse(m.at) + IB_REPLY)].filter((t) => t > now);
      if (due.length) timer = setTimeout(() => { if (box.isConnected) paint(); }, Math.min(...due) - now + 60);
    }
    paint();
    return box;
  }

  function viewSaved(q) {
    q = q instanceof URLSearchParams ? q : new URLSearchParams(String(q || ''));
    const TABS = ['oglasi', 'pretrage', 'poruke', 'nedavno', 'sakriveni'];
    const state = { tab: TABS.includes(q.get('tab')) ? q.get('tab') : 'oglasi', sort: 'saved', pick: new Set(S(() => store.compare.slice(), [])) };
    const root = el('div', { class: 'wrap ax-page sv-page' });
    const draw = () => {
      const nF = S(() => [...store.favs].filter((s) => findL(s)).length, 0);
      const nS = S(() => store.searches.length, 0);
      const nR = S(() => store.recent.filter((s) => findL(s)).length, 0);
      const nH = S(() => X().profile.get().hidden.size, 0);
      const nMine = mineGet().length;
      const nIb = ibCount();
      const keepScroll = window.scrollY;
      const restore = focusMemo(root);
      fill(root, 
        pageHead({ crumbs: [{ label: 'Početna', href: '#/' }, { label: 'Sačuvano' }], eyebrow: 'TVOJ SPISAK', title: 'Sačuvano',
          lede: nF ? `${oglasa(nF)} sa tvojim beleškama i ocenama${nS ? `, ${nS} ${plural(nS, 'sačuvana pretraga', 'sačuvane pretrage', 'sačuvanih pretraga')}` : ''}. Sve ostaje na ovom uređaju, bez naloga.` : 'Sve što sačuvaš ostaje na ovom uređaju, bez naloga.' }),
        nMine ? el('p', { class: 'sv-mine meta' }, ic('building', 14), 'Oglašavaš i ti? ', el('a', { class: 'link', href: '#/moji-oglasi' }, `Moji oglasi · ${nMine}`)) : null,
        S(() => tabs([
          { id: 'oglasi', label: `Sačuvani oglasi · ${nF}`, panel: savedListings(state, draw) },
          { id: 'pretrage', label: `Sačuvane pretrage · ${nS}`, panel: savedSearches() },
          { id: 'poruke', label: `Poruke i obilasci · ${nIb}`, panel: inboxPanel(draw) },
          { id: 'nedavno', label: `Nedavno gledano · ${nR}`, panel: recentPanel() },
          { id: 'sakriveni', label: `Sakriveni oglasi · ${nH}`, panel: hiddenPanel() },
        ], { active: state.tab, onChange: (id) => { state.tab = id; replaceUrl('/sacuvani', id === 'oglasi' ? {} : { tab: id }); } }), el('p', {}, 'Tabovi nisu dostupni.')));
      if (keepScroll) window.scrollTo(0, keepScroll);
      restore('[role=tab][aria-selected="true"]');
      const strip = root.querySelector('.tabs-ul');
      if (strip) {
        const paint = () => { strip.classList.toggle('ax-end', strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4); strip.classList.toggle('ax-start', strip.scrollLeft <= 4); };
        strip.addEventListener('scroll', paint, { passive: true });
        /* na telefonu traka skroluje vodoravno: izabrani tab (duboki link, posle Vrati/Obriši) mora da bude vidljiv — pomeramo samo traku, ne stranu */
        whenMounted(strip, () => {
          const act = strip.querySelector('[aria-selected="true"]');
          if (act && strip.scrollWidth > strip.clientWidth + 2) {
            const sr = strip.getBoundingClientRect(), ar = act.getBoundingClientRect();
            const left = strip.scrollLeft + (ar.left - sr.left);
            if (ar.left < sr.left || ar.right > sr.right) strip.scrollLeft = Math.max(0, left - (strip.clientWidth - act.offsetWidth) / 2);
          }
          paint();
        });
      }
    };
    draw();
    /* ponovo iscrtaj samo na promene koje menjaju spiskove (ne na beleške — da ne izgubimo fokus u polju) */
    bind(root, (fn) => store.on(fn), (what) => { if (what === 'favs' || what === 'searches' || what === 'recent') draw(); });
    bind(root, (fn) => X() && X().profile.on(fn), (p, patch) => { if (patch && 'hidden' in patch) draw(); });
    return root;
  }

  /* ═════════════════════════ MOJA MESTA ═════════════════════════ */
  function locSuggest(text) {
    const qf = S(() => fmt.fold(text), String(text || '').toLowerCase()).trim();
    if (!qf) return [];
    const cities = S(() => D.cities.filter((c) => fmt.fold(c.n).includes(qf)).slice(0, 3).map((c) => ({ name: c.n, lat: c.lat, lng: c.lng, cs: c.s, kind: 'grad' })), []);
    const rest = S(() => X().placeSuggest(text, 8), []) || [];
    const KIND = { poi: 'mesto', mun: 'opština', nbhd: 'naselje' };
    return [...cities, ...rest.map((r) => ({ ...r, kind: KIND[r.kind] || r.kind }))].slice(0, 8);
  }
  function combo(o) {
    /* o: {id, value, placeholder, onPick(item)} — dostupni autocomplete (role=combobox + listbox) */
    const lid = o.id + '-lb';
    const input = el('input', { class: 'input', id: o.id, type: 'text', autocomplete: 'off', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': lid, placeholder: o.placeholder || '' });
    input.value = o.value || '';
    const lb = el('ul', { class: 'ax-lb', id: lid, role: 'listbox', hidden: true });
    let items = [], act = -1;
    const close = () => { lb.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); act = -1; };
    const pick = (it) => { input.value = it.name; close(); o.onPick(it); };
    const paint = () => {
      fill(lb, ...items.map((it, i) => el('li', { id: `${lid}-${i}`, role: 'option', 'aria-selected': i === act ? 'true' : 'false', onpointerdown: (e) => { e.preventDefault(); pick(it); } },
        ic(it.kind === 'mesto' ? 'pin' : it.kind === 'grad' ? 'building' : 'map', 16), el('span', {}, it.name), el('small', {}, it.kind))));
      if (act >= 0) input.setAttribute('aria-activedescendant', `${lid}-${act}`); else input.removeAttribute('aria-activedescendant');
    };
    input.addEventListener('input', () => {
      items = locSuggest(input.value); act = items.length ? 0 : -1;
      if (!items.length) { close(); if (input.value.trim().length > 1) { lb.hidden = false; fill(lb, el('li', { class: 'none', role: 'option', 'aria-disabled': 'true' }, 'Nema poklapanja — klikni na mapu')); input.setAttribute('aria-expanded', 'true'); } return; }
      lb.hidden = false; input.setAttribute('aria-expanded', 'true'); paint();
    });
    input.addEventListener('keydown', (e) => {
      if (lb.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); act = (act + 1) % items.length; paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); act = (act - 1 + items.length) % items.length; paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (act >= 0) pick(items[act]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
    return { node: el('div', { class: 'ax-combo' }, input, lb), input };
  }

  function viewPlaces() {
    const root = el('div', { class: 'wrap ax-page mm-page' });
    const prof = () => S(() => X().profile.get(), { places: [] });
    const blank = () => ({ id: null, name: '', who: 'ja', mode: 'gradski', loc: null });
    let form = blank();
    let mapCity = null;
    let mapRef = null;
    const mapBox = el('div', { class: 'mm-map' });

    const setPlaces = (list) => { if (!X()) { say('Profil nije dostupan'); return; } X().profile.set({ places: list }); };
    const mapPlaces = () => {
      const list = (prof().places || []).slice();
      if (form.loc && !form.id) list.push({ id: '__new', name: form.name || 'Novo mesto', lat: form.loc.lat, lng: form.loc.lng, who: form.who, mode: form.mode });
      if (form.loc && form.id) { const i = list.findIndex((p) => p.id === form.id); if (i >= 0) list[i] = { ...list[i], lat: form.loc.lat, lng: form.loc.lng, mode: form.mode, who: form.who }; }
      return list;
    };
    const cityOf = (lat, lng) => {
      let best = null, bd = Infinity;
      S(() => D.cities.forEach((c) => { const d = (c.lat - lat) ** 2 + ((c.lng - lng) * 0.7) ** 2; if (d < bd) { bd = d; best = c.s; } }));
      return best || 'beograd';
    };
    function buildMap() {
      const pl = mapPlaces();
      const focus = form.loc || pl[0] || null;
      const cs = focus ? (focus.cs || cityOf(focus.lat, focus.lng)) : 'beograd';
      mapCity = cs;
      fill(mapBox, );
      const city = S(() => find.city(cs), null);
      const favs = S(() => [...store.favs].map(findL).filter((l) => l && l.cs === cs), []);
      mapRef = pickMap(mapBox, {
        city: cs, listings: favs, places: pl,
        view: focus ? { lat: focus.lat, lng: focus.lng, zoom: 12.5 } : city ? { lat: city.lat, lng: city.lng, zoom: 12 } : undefined,
        onPick: (ll) => { form.loc = { name: 'Tačka na mapi', lat: ll.lat, lng: ll.lng, cs: mapCity }; paintForm(); refreshMap(); },
      });
    }
    function refreshMap() {
      const api = mapRef && mapRef.api;
      const focus = form.loc;
      if (focus && focus.cs && focus.cs !== mapCity) { S(() => api && api.destroy()); buildMap(); return; }
      if (api) { S(() => api.setPlaces(mapPlaces())); if (focus) S(() => api.panTo(focus.lat, focus.lng)); }
    }

    /* forma */
    const formBox = el('div', { class: 'mm-form' });
    function paintForm() {
      const editing = !!form.id;
      const nameIn = el('input', { class: 'input', id: 'mm-name', type: 'text', maxlength: '32', placeholder: 'Posao, fakultet, roditelji…', oninput: (e) => { form.name = e.target.value; } });
      nameIn.value = form.name;
      const loc = combo({ id: 'mm-loc', value: form.loc && form.loc.name !== 'Tačka na mapi' ? form.loc.name : '', placeholder: 'npr. Slavija, Liman, Novi Beograd', onPick: (it) => { form.loc = { name: it.name, lat: it.lat, lng: it.lng, cs: it.cs }; if (!form.name) { form.name = it.name.replace(/ \(.*\)$/, ''); nameIn.value = form.name; } paintPicked(); refreshMap(); } });
      const picked = el('p', { class: 'mm-picked meta', 'aria-live': 'polite' });
      const paintPicked = () => { fill(picked, form.loc ? el('span', {}, ic('pin', 14), el('b', {}, form.loc.name), ` · ${num(form.loc.lat, 4)}, ${num(form.loc.lng, 4)}`) : el('span', {}, 'Ukucaj mesto ili klikni na mapu.')); };
      paintPicked();
      const count = (prof().places || []).length;
      const full = !editing && count >= 5;
      fill(formBox, 
        el('h2', { class: 't-h2s' }, editing ? 'Izmeni mesto' : 'Dodaj mesto'),
        full ? el('p', { class: 'note-rule' }, 'Imaš 5 mesta — to je najviše. Ukloni jedno da dodaš novo.') : null,
        el('div', { class: 'mm-grid' },
          S(() => field('Naziv', nameIn), nameIn),
          el('div', { class: 'fld' }, el('span', { class: 'lbl' }, 'Čije je mesto'), S(() => segmented(WHO, form.who, (v) => { form.who = v; refreshMap(); }), null)),
          el('div', { class: 'fld mm-wide' }, el('label', { class: 'lbl', for: 'mm-loc' }, 'Lokacija'), loc.node, picked),
          el('div', { class: 'fld mm-wide' }, el('span', { class: 'lbl' }, 'Kako putuješ'), S(() => segmented(MODES, form.mode, (v) => { form.mode = v; refreshMap(); }), null))),
        el('div', { class: 'btn-row mm-actions' },
          el('button', { class: 'btn btn-primary', type: 'button', disabled: full, onclick: () => {
            if (!form.loc) { say('Izaberi lokaciju iz liste ili klikni na mapu'); S(() => $('#mm-loc').focus()); return; }
            const name = (form.name || '').trim() || form.loc.name.replace(/ \(.*\)$/, '');
            const list = (prof().places || []).slice();
            const item = { id: form.id || 'p' + (Date.now() % 1e9).toString(36), name, lat: form.loc.lat, lng: form.loc.lng, who: form.who, mode: form.mode, cs: form.loc.cs };
            const i = list.findIndex((p) => p.id === item.id);
            if (i >= 0) list[i] = item; else list.push(item);
            form = blank();
            setPlaces(list);
            say(i >= 0 ? `Mesto „${name}“ je izmenjeno` : `Mesto „${name}“ je dodato`);
          } }, editing ? 'Sačuvaj izmene' : 'Sačuvaj mesto'),
          editing || form.loc || form.name ? el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { form = blank(); paintForm(); refreshMap(); } }, 'Otkaži') : null));
    }

    /* spisak */
    function placesList() {
      const list = prof().places || [];
      if (!list.length) return el('div', { class: 'mm-none' }, el('p', {}, el('b', {}, 'Još nema mesta.'), ' Dodaj posao, fakultet, vrtić ili roditelje — za sebe i za partnera. Najviše 5.'));
      return el('ul', { class: 'mm-list' }, list.map((p) => el('li', { class: 'mm-item' },
        el('span', { class: 'mm-who mm-who-' + (p.who || 'ja'), 'aria-hidden': 'true' }, p.who === 'partner' ? 'P' : 'J'),
        el('div', { class: 'mm-it-t' }, el('b', {}, p.name), el('span', { class: 'meta' }, `${p.who === 'partner' ? 'Partner' : 'Ja'} · ${MODE_TXT[p.mode] || p.mode}`)),
        S(() => select(MODES, p.mode, (v) => { setPlaces((prof().places || []).map((x) => (x.id === p.id ? { ...x, mode: v } : x))); }, { inline: true, label: `Način putovanja za ${p.name}` }), null),
        el('button', { class: 'iconbtn', type: 'button', 'aria-label': `Izmeni ${p.name}`, onclick: () => { form = { id: p.id, name: p.name, who: p.who || 'ja', mode: p.mode || 'gradski', loc: { name: p.name, lat: p.lat, lng: p.lng, cs: p.cs || cityOf(p.lat, p.lng) } }; paintForm(); refreshMap(); S(() => formBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); } }, ic('draw', 18)),
        el('button', { class: 'iconbtn', type: 'button', 'aria-label': `Ukloni ${p.name}`, onclick: () => { setPlaces((prof().places || []).filter((x) => x.id !== p.id)); if (form.id === p.id) form = blank(); say(`Mesto „${p.name}“ je uklonjeno`); } }, ic('trash', 18)))));
    }

    /* tabela minuta */
    function preview() {
      const pl = prof().places || [];
      let src = S(() => [...store.favs].reverse(), []).map(findL).filter(Boolean).slice(0, 6);
      let srcLabel = '6 poslednjih sačuvanih oglasa';
      if (!src.length) { src = S(() => store.recent, []).map(findL).filter(Boolean).slice(0, 6); srcLabel = 'nedavno gledani oglasi (još nemaš sačuvane)'; }
      /* search.js prihvata sort=near-<id> (jedna osoba) ili sort=pair (ja + partner) */
      const pair = pl.some((p) => (p.who || 'ja') === 'ja') && pl.some((p) => p.who === 'partner');
      const anchor = pl.find((p) => (p.who || 'ja') === 'ja') || pl[0];
      const sortHref = anchor ? S(() => buildHash('/pretraga', { c: anchor.cs || cityOf(anchor.lat, anchor.lng), sort: pair ? 'pair' : 'near-' + anchor.id }), null) : null;
      const head = el('div', { class: 'shead' }, el('div', {}, el('h2', { class: 't-h2' }, 'Koliko je daleko'), el('p', { class: 'sub' }, pl.length && src.length ? `Minuti od ${srcLabel} do tvojih mesta. Najbliže u koloni je označeno.` : 'Kad dodaš mesta i sačuvaš oglase, ovde vidiš minute za svaki.')),
        sortHref ? el('a', { class: 'btn btn-secondary', href: sortHref }, pair ? 'Pretraga: najbolje za oboje' : `Pretraži najbliže: ${anchor.name}`, ic('arrow-right', 16)) : null);
      if (!pl.length || !src.length) {
        return el('section', { class: 'section mm-prev' }, head, el('p', { class: 'mm-none' }, !pl.length ? 'Dodaj bar jedno mesto iznad.' : 'Sačuvaj nekoliko oglasa srcem, pa se vrati ovde.', ' ', !src.length ? el('a', { class: 'link', href: '#/pretraga' }, 'Pretraži oglase') : null));
      }
      const two = new Set(pl.map((p) => p.who || 'ja')).size > 1;
      const fm = two ? S(() => X().fairMiddle(src, pl), null) : null;
      const mins = src.map((l) => pl.map((p) => S(() => X().travel(l, p), null)));
      const best = pl.map((_, j) => Math.min(...mins.map((r) => (r[j] && !r[j].far ? r[j].min : Infinity))));
      const bothVals = two && fm ? src.map((l) => (fm.get(l.s) || {}).max) : [];
      const bothBest = bothVals.length ? Math.min(...bothVals.filter((v) => v != null)) : null;
      const table = el('table', { class: 'mm-table' },
        el('caption', { class: 'sr' }, 'Minuti od sačuvanih oglasa do mojih mesta'),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col', class: 'lab' }, 'Oglas'), pl.map((p) => el('th', { scope: 'col', class: 'num' }, el('span', { class: 'mm-th' }, el('i', { class: 'mm-who mm-who-' + (p.who || 'ja'), 'aria-hidden': 'true' }, p.who === 'partner' ? 'P' : 'J'), p.name), el('small', {}, MODE_TXT[p.mode] || p.mode))),
          two ? el('th', { scope: 'col', class: 'num' }, 'Najgore od dvoje', el('small', {}, 'duži od 2 puta')) : null)),
        el('tbody', {}, src.map((l, i) => el('tr', {},
          el('th', { scope: 'row', class: 'lab' }, el('a', { class: 'mm-og', href: lhref(l) }, thumb(l, 0, '4:3'), el('span', {}, el('b', {}, titleOf(l)), el('span', { class: 'meta' }, S(() => fmt.price(l.p, l.t), ''))))),
          pl.map((p, j) => { const t = mins[i][j]; if (!t) return el('td', { class: 'num' }, '—'); if (t.far) return el('td', { class: 'num ax-muted' }, 'drugi grad'); const w = t.min === best[j]; return el('td', { class: 'num' + (w ? ' win' : '') }, w ? el('i', { class: 'mk', 'aria-hidden': 'true' }) : null, el('b', {}, `${t.min} min`), el('small', {}, `${num(t.km, 1)} km`)); }),
          two ? (() => { const v = bothVals[i]; return el('td', { class: 'num' + (v != null && v === bothBest ? ' win' : '') }, v != null && v === bothBest ? el('i', { class: 'mk', 'aria-hidden': 'true' }) : null, v != null ? el('b', {}, `${v} min`) : '—'); })() : null))));
      const inner = el('div', { class: 'mm-wrap', tabindex: '0', role: 'region', 'aria-label': 'Tabela minuta, pomera se vodoravno' }, table);
      const wrap = el('div', { class: 'mm-scroll' }, inner);
      const paintFade = () => { wrap.classList.toggle('at-end', inner.scrollLeft + inner.clientWidth >= inner.scrollWidth - 4); wrap.classList.toggle('scrolled', inner.scrollLeft > 4); };
      inner.addEventListener('scroll', paintFade, { passive: true });
      requestAnimationFrame(paintFade);
      return el('section', { class: 'section mm-prev' }, head, wrap);
    }

    const howTo = el('aside', { class: 'mm-how' },
      el('p', { class: 'eyebrow' }, 'Kako procenjujemo minute'),
      el('p', {}, 'Nemamo red vožnje ni podatke o gužvi, pa minute računamo grubo, ali pošteno: vazdušna linija između stana i tvog mesta × 1,3 (ulice nisu prave), podeljeno prosečnom brzinom, plus fiksno vreme.'),
      el('ul', { class: 'mm-speeds' },
        el('li', {}, el('b', {}, 'Gradski prevoz'), ' 14 km/h + 6 min čekanja'),
        el('li', {}, el('b', {}, 'Auto'), ' 22 km/h + 4 min parkiranja'),
        el('li', {}, el('b', {}, 'Bicikl'), ' 14 km/h + 2 min'),
        el('li', {}, el('b', {}, 'Pešice'), ' 4,5 km/h')),
      el('p', { class: 'meta' }, 'Zato je ovo procena: u špicu i sa presedanjem biće duže. Za odluku između dva stana dovoljno je dobra — razlika od 15 min se vidi.'));

    const listBox = el('div', { class: 'mm-places' });
    const prevBox = el('div');
    const paintAll = () => { fill(listBox, el('h2', { class: 't-h2s' }, 'Tvoja mesta', el('span', { class: 'meta' }, ` · ${(prof().places || []).length} od 5`)), placesList()); fill(prevBox, preview()); };
    paintForm(); paintAll();
    add(root, 
      pageHead({ crumbs: [{ label: 'Početna', href: '#/' }, { label: 'Moja mesta' }], eyebrow: 'MOJA MESTA', title: 'Koliko je stan daleko od mesta gde svakodnevno ideš',
        lede: 'Dodaj posao, fakultet i roditelje — za sebe i za partnera. Svaki oglas onda kaže koliko minuta ti treba, a poređenje pokaže gde oboje stižete na vreme.' }),
      el('div', { class: 'mm-top' },
        el('div', { class: 'mm-left' }, listBox, formBox),
        el('div', { class: 'mm-right' }, mapBox, el('p', { class: 'meta mm-maphint' }, ic('locate', 14), 'Klikni na mapu da postaviš tačku. Krugovi pokazuju 10, 20 i 30 minuta — isti proračun kao tabela ispod.'), howTo)),
      prevBox);
    buildMap();
    bind(root, (fn) => X() && X().profile.on(fn), (p, patch) => {
      if (patch && !('places' in patch)) return;
      const restore = focusMemo(root);
      paintAll(); paintForm(); refreshMap();
      restore('.mm-item button[aria-label^="Ukloni"], #mm-name');
    });
    bind(root, (fn) => store.on(fn), (what) => { if (what === 'favs') fill(prevBox, preview()); });
    return root;
  }

  /* ═════════════════════════ POSTAVI OGLAS ═════════════════════════ */
  const DRAFT_KEY = 'kv.draft';
  const STEPS = ['Tip', 'Lokacija', 'Detalji', 'Opis', 'Fotografije', 'Cena', 'Pregled'];
  const LEGAL = [
    { v: 'uknjizeno', l: 'Uknjiženo' },
    { v: 'u-procesu', l: 'U procesu uknjižavanja' },
    { v: 'poseban-zakon', l: 'Upisano po posebnom zakonu (2025)' },
    { v: 'ozakonjenje', l: 'U postupku ozakonjenja' },
    { v: 'nije', l: 'Nije uknjiženo' },
  ];
  const FINANCEABLE = { uknjizeno: 'da', 'u-procesu': 'zavisi', 'poseban-zakon': 'zavisi', ozakonjenje: 'ne', nije: 'ne' };
  const DRAFT0 = { v: 1, step: 0, t: 'prodaja', pt: 'stan', adv: 'vlasnik', cs: 'beograd', ms: '', n: '', ad: '', lat: null, lng: null,
    a: '', ro: 2, fl: '', tf: '', y: '', he: '', co: '', fu: '', legal: 'uknjizeno', proof: false, am: [],
    title: '', d: '', photos: [], plan: false, video: '', p: '', dep: '', neg: true, name: '', phone: '', agree: false, published: null, saved: null, fee: '', feePayer: 'kupac', editRef: null };
  /* provizija: zakon traži da agencija jasno navede iznos i ko ga plaća (kritika #7) */
  const PAYERS = {
    prodaja: [{ v: 'kupac', l: 'Kupac' }, { v: 'prodavac', l: 'Prodavac' }, { v: 'dogovor', l: 'Po dogovoru' }],
    izdavanje: [{ v: 'zakupac', l: 'Zakupac' }, { v: 'vlasnik', l: 'Plaća vlasnik' }, { v: 'dogovor', l: 'Po dogovoru' }],
  };
  const payersOf = (t) => PAYERS[t === 'izdavanje' ? 'izdavanje' : 'prodaja'];
  const feeText = (d, short) => {
    if (d.adv !== 'agencija') return short ? 'bez provizije' : 'Bez provizije (oglašava vlasnik)';
    const f = numOr(d.fee);
    if (f == null) return '';
    const payer = (payersOf(d.t).find((x) => x.v === d.feePayer) || payersOf(d.t)[0]).l.replace('Plaća ', '').toLowerCase();
    const amt = `${S(() => fmt.num(f, f % 1 ? 1 : 0), String(f))} %${d.t === 'izdavanje' ? ' kirije' : ''}`;
    if (short) return `provizija ${amt}`;
    return `${amt} · ${d.feePayer === 'dogovor' ? 'po dogovoru' : 'plaća ' + payer}`;
  };
  const slugify = (s) => S(() => fmt.fold(s), String(s).toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  /* „315.000“ → 315000 (tačke za hiljade), „58,5“ i „58.5“ → 58.5 */
  const numOr = (v) => {
    let t = String(v == null ? '' : v).trim().replace(/\s/g, '');
    t = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(',', '.');
    const x = parseFloat(t); return isFinite(x) ? x : null;
  };
  const fmtThousands = (v) => { const x = numOr(v); return x == null ? String(v || '') : S(() => fmt.num(Math.round(x)), String(Math.round(x))); };

  function munCentroid(ms, cs) {
    const ls = S(() => D.listings.filter((l) => (ms ? l.ms === ms : l.cs === cs) && l.lat), []);
    if (!ls.length) { const c = S(() => find.city(cs), null); return c ? { lat: c.lat, lng: c.lng } : { lat: 44.8125, lng: 20.4612 }; }
    return { lat: ls.reduce((t, l) => t + l.lat, 0) / ls.length, lng: ls.reduce((t, l) => t + l.lng, 0) / ls.length };
  }
  const isUrl = (v) => { try { const u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') && /\./.test(u.hostname); } catch (e) { return false; } };
  /* šematski tlocrt nacrta: model sa stranice oglasa (viewListing._planModel) ako je učitan, inače jednostavan raspored po sobama */
  const PLAN_SHORT = { Kuhinja: 'Kuh.', 'Čajna kuhinja': 'Kuh.', Kupatilo: 'Kup.', 'Kupatilo 2': 'Kup. 2', Toalet: 'WC', Hodnik: 'Hod.', Kabinet: 'Kab.', Spavaća: 'Sp.', 'Spavaća 1': 'Sp. 1', 'Spavaća 2': 'Sp. 2', 'Spavaća 3': 'Sp. 3', Trpezarija: 'Trp.', Ostava: 'Ost.', 'Radna soba': 'Rad.', Garderober: 'Gard.', Dnevna: 'Dn.', Terasa: 'Ter.', Balkon: 'Balk.' };
  function planSvg(l) {
    const m = S(() => (typeof viewListing === 'function' && viewListing._planModel ? viewListing._planModel({ ...l, s: 'nacrt', a: l.a || 50, ro: l.ro != null ? l.ro : 2 }) : null), null);
    let rooms, W, H;
    if (m && m.rooms && m.rooms.length) ({ rooms, W, H } = m);
    else {
      const a = l.a || 50; W = Math.sqrt(a * 1.4); H = a / W;
      const n = Math.max(1, Math.floor(l.ro || 2));
      rooms = [{ n: n > 1 ? 'Dnevna' : 'Soba', x: 0, y: 0, w: W * 0.55, h: H * 0.6 }, { n: 'Kuhinja', x: 0, y: H * 0.6, w: W * 0.3, h: H * 0.4 }, { n: 'Kupatilo', x: W * 0.3, y: H * 0.6, w: W * 0.25, h: H * 0.4 }];
      for (let i = 1; i < n; i++) rooms.push({ n: n > 2 ? `Spavaća ${i}` : 'Spavaća', x: W * 0.55, y: (H / (n - 1)) * (i - 1), w: W * 0.45, h: H / (n - 1) });
    }
    const SC = 24, pad = 4;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `${-pad} ${-pad} ${W * SC + pad * 2} ${H * SC + pad * 2}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Šematski tlocrt: ${rooms.map((r) => r.n).join(', ')}`);
    svg.setAttribute('class', 'pw-plan-svg');
    for (const r of rooms) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      [['x', r.x * SC], ['y', r.y * SC], ['width', r.w * SC], ['height', r.h * SC]].forEach(([k, v]) => rect.setAttribute(k, v.toFixed(1)));
      g.appendChild(rect);
      if (r.w * SC > 34 && r.h * SC > 18) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', ((r.x + r.w / 2) * SC).toFixed(1)); t.setAttribute('y', ((r.y + r.h / 2) * SC + 4).toFixed(1));
        t.setAttribute('text-anchor', 'middle');
        t.textContent = r.w * SC > 70 ? r.n : PLAN_SHORT[r.n] || PLAN_SHORT[r.n.replace(/ \d+$/, '')] || r.n.slice(0, 3) + '.';
        g.appendChild(t);
      }
      svg.appendChild(g);
    }
    return svg;
  }
  function draftListing(d) {
    const city = S(() => find.city(d.cs), null);
    const mun = S(() => find.mun(d.ms), null);
    const nb = d.n ? S(() => D.listings.find((l) => l.ms === d.ms && fmt.fold(l.n) === fmt.fold(d.n)), null) : null;
    const ll = d.lat != null ? { lat: d.lat, lng: d.lng } : munCentroid(d.ms, d.cs);
    const a = numOr(d.a), p = numOr(d.p);
    const l = {
      s: 'nacrt', r: 'KV-nacrt', t: d.t, pt: d.pt, p: p || 0, a: a || null, la: null, ppm: p && a ? p / a : null,
      ro: ['stan', 'kuca', 'vikendica', 'soba'].includes(d.pt) ? +d.ro : null, ba: 1, fl: numOr(d.fl), tf: numOr(d.tf), y: numOr(d.y),
      co: d.co || null, he: d.he || null, fu: d.fu || null, or: null, en: null,
      c: city ? city.n : '', cs: d.cs, m: mun ? mun.n : (city ? city.n : ''), ms: d.ms || '', n: nb ? nb.n : (d.n || (mun ? mun.n : '')), ns: nb ? nb.ns : slugify(d.n || d.ms || d.cs),
      ad: d.ad || null, lat: ll.lat, lng: ll.lng, pr: 'NONE', v: 0, fv: 0, im: d.photos.length, ag: null, ags: null, agv: false,
      reg: d.legal === 'uknjizeno', dep: d.t === 'izdavanje' ? numOr(d.dep) : null, neg: !!d.neg, am: d.am.slice(), dz: 0,
    };
    l.ti = d.title.trim() || titleOf(l);
    return l;
  }
  /* jedinstven slug po stanju (stats/KX keširaju po slugu), slike ostaju vezane za stabilan „nacrt“ */
  const stateSlug = (l) => 'nacrt-' + S(() => hash(JSON.stringify([l.t, l.pt, l.p, l.a, l.ro, l.fl, l.tf, l.y, l.co, l.he, l.cs, l.ms, l.ns, l.lat, l.lng, l.am, l.reg])), 0).toString(36);

  function quality(d, fair) {
    const len = d.d.trim().length;
    const price = numOr(d.p);
    const phoneDigits = String(d.phone || '').replace(/\D/g, '').length;
    let priceOk = false, priceNote = 'unesi cenu';
    if (price) {
      if (fair && fair.verdict) {
        const pct = S(() => fmt.pct(Math.abs(fair.diffPct)), '');
        priceOk = fair.diffPct >= -15 && fair.diffPct <= 10;
        priceNote = fair.verdict === 'ispod' ? `${pct} ispod procene` : fair.verdict === 'iznad' ? `${pct} iznad procene` : 'u opsegu procene';
      }
      /* bodovi samo kad imamo sa čim da poredimo (prosek sa n ≥ 5, spec 5.7) — bez kvadrature ili uzorka nema „besplatnih“ 15 */
      else if (fair && fair.deltaObj && fair.deltaObj.n >= 5 && fair.delta != null) { priceOk = Math.abs(fair.delta) <= 25; priceNote = priceOk ? 'blizu proseka oblasti' : 'daleko od proseka oblasti'; }
      else priceNote = numOr(d.a) ? 'nema dovoljno podataka za poređenje' : 'unesi kvadraturu';
    }
    const yr = numOr(d.y);
    const yearOk = yr != null && yr >= 1800 && yr <= new Date().getFullYear() + 4;
    const items = [
      { k: 'naslov', label: 'Naslov od bar 20 znakova', pts: 10, got: d.title.trim().length >= 20 ? 10 : d.title.trim() ? 0 : 5, note: d.title.trim() ? (d.title.trim().length >= 20 ? `${d.title.trim().length} znakova` : `prekratak: ${d.title.trim().length} znakova`) : 'naš predlog · tvoj naslov donosi još 5', step: 3 },
      { k: 'opis', label: 'Opis od bar 300 znakova', pts: 15, got: Math.min(15, Math.floor(len / 300 * 15)), note: `${len} / 300`, step: 3 },
      { k: 'foto', label: 'Bar 5 fotografija', pts: 20, got: Math.min(20, d.photos.length * 4), note: `${d.photos.length} / 5`, step: 4 },
      { k: 'tlocrt', label: 'Tlocrt', pts: 5, got: d.plan ? 5 : 0, note: d.plan ? 'dodat' : 'kupci ga traže odmah posle fotografija', step: 4 },
      { k: 'godina', label: 'Godina izgradnje', pts: 5, got: yearOk ? 5 : 0, note: yearOk ? String(yr) : (yr != null ? 'proveri godinu' : 'nije uneta'), step: 2 },
      { k: 'ulica', label: 'Ulica i broj', pts: 10, got: d.ad.trim().length >= 3 ? 10 : 0, note: d.ad.trim() ? 'uneto' : 'nije uneto', step: 1 },
      { k: 'dokaz', label: 'Uknjiženo, sa dokazom', pts: 15, got: d.legal === 'uknjizeno' && d.proof ? 15 : d.legal === 'uknjizeno' ? 6 : 0, note: d.legal === 'uknjizeno' ? (d.proof ? 'list nepokretnosti' : 'bez dokaza') : 'nije uknjiženo', step: 2 },
      { k: 'cena', label: 'Realna cena', pts: 15, got: priceOk ? 15 : 0, note: priceNote, step: 5 },
      { k: 'kontakt', label: 'Kontakt: ime i telefon', pts: 5, got: (d.name.trim() ? 2 : 0) + (phoneDigits >= 8 ? 3 : 0), note: phoneDigits >= 8 && d.name.trim() ? 'uneto' : 'nedostaje', step: 6 },
    ];
    items.forEach((it) => { it.ok = it.got >= it.pts; });
    const score = items.reduce((t, it) => t + it.got, 0);
    const word = score >= 90 ? 'Odličan oglas' : score >= 70 ? 'Dobar oglas' : score >= 40 ? 'Solidan početak' : 'Tek počinje';
    return { items, score, word };
  }

  /* predpopunjavanje iz adrese (npr. „Postavi oglas sa ovom cenom” sa #/procena): t, pt, p, a, ro, c, m, n, fl, tf, y, co, he */
  function postPrefill(q) {
    const g = (k) => S(() => (q instanceof URLSearchParams ? q.get(k) : null), null);
    const out = {}; let any = false;
    const set = (k, v) => { if (v != null && v !== '') { out[k] = v; any = true; } };
    const t = g('t'); if (t === 'prodaja' || t === 'izdavanje') set('t', t);
    const pt = g('pt'); if (pt && S(() => TYPES.some((x) => x.v === pt), true)) set('pt', pt);
    ['p', 'a', 'fl', 'tf', 'y'].forEach((k) => { const v = g(k); if (v != null && v !== '' && isFinite(+v)) set(k, String(+v)); });
    const ro = g('ro'); if (ro != null && ro !== '' && isFinite(+ro)) set('ro', +ro);
    const c = g('c'); if (c && S(() => find.city(c), null)) set('cs', c);
    const m = g('m'); if (m && S(() => find.mun(m), null)) set('ms', m);
    const n = g('n'); if (n) { const hit = S(() => D.listings.find((l) => l.ns === n), null); set('n', hit ? hit.n : n); }
    ['co', 'he'].forEach((k) => set(k, g(k)));
    return any ? out : null;
  }
  function viewPost(q) {
    let d = { ...DRAFT0, ...(lsGet(DRAFT_KEY, null) || {}) };
    const pre = postPrefill(q);
    if (pre) { d = { ...d, ...pre, published: null }; S(() => history.replaceState(history.state, '', '#/postavi')); }
    d.photos = Array.isArray(d.photos) ? d.photos.filter((x) => Number.isInteger(x)) : [];
    d.am = Array.isArray(d.am) ? d.am : [];
    if (!payersOf(d.t).some((x) => x.v === d.feePayer)) d.feePayer = payersOf(d.t)[0].v;
    const restored = !!lsGet(DRAFT_KEY, null) && !d.published;
    let savedAt = null;
    const root = el('div', { class: 'wrap ax-page pw-page' });
    const saveNow = () => { d.saved = new Date().toISOString(); savedAt = Date.now(); const ok = lsSet(DRAFT_KEY, d); paintSaved(ok); };
    const autosave = debounce(saveNow, 350);
    const savedLine = el('p', { class: 'pw-saved meta', 'aria-live': 'polite' });
    const paintSaved = (ok = true) => { fill(savedLine, ok ? ic('check', 14) : ic('alert', 14), ok ? (savedAt ? 'Nacrt sačuvan na ovom uređaju' : (restored ? 'Nastavljaš sačuvani nacrt' : 'Nacrt se čuva automatski')) : 'Pregledač ne dozvoljava čuvanje — nacrt će nestati po zatvaranju'); };
    if (pre) saveNow();   /* predpopunjen nacrt se odmah čuva (adresa je već vraćena na #/postavi) */

    let cur = Math.min(STEPS.length - 1, Math.max(0, d.step | 0));
    const stepBox = el('div', { class: 'pw-step' });
    const stepperBox = el('div', { class: 'pw-stepper' });
    const navBox = el('div', { class: 'pw-nav' });
    const aside = el('aside', { class: 'pw-aside', 'aria-label': 'Pregled oglasa i kvalitet' });
    const mScore = el('button', { class: 'pw-mscore', type: 'button', 'aria-label': 'Kvalitet oglasa — prikaži spisak', onclick: () => S(() => document.getElementById('pw-quality').scrollIntoView({ behavior: 'smooth', block: 'start' })) });

    let fairCache = { k: null, v: null };
    const fairOf = (l) => {
      const ls = { ...l, s: stateSlug(l) };
      if (fairCache.k === ls.s) return fairCache.v;
      const f = l.p && l.a ? S(() => X().fair(ls), null) : null;
      const dl = l.p && l.a ? S(() => stats.delta(ls), null) : null;
      fairCache = { k: ls.s, v: f ? { ...f, delta: dl && dl.pct, deltaObj: dl } : (dl ? { verdict: null, delta: dl.pct, deltaObj: dl } : null) };
      return fairCache.v;
    };

    function previewCard(l) {
      const ls = { ...l, s: stateSlug(l) };
      const c = S(() => card(ls, 'grid'), null);
      if (!c) return el('p', { class: 'meta' }, l.ti);
      const ph = c.querySelector('.ph');
      if (ph) {
        const old = ph.querySelector('img'); const idx = d.photos.length ? d.photos[0] : 0;
        const nu = S(() => img.el({ ...l, s: 'nacrt' }, idx, { aspect: '4:3', alt: '' }), null);
        if (old && nu) old.replaceWith(nu);
        if (!d.photos.length) { const cnt = ph.querySelector('.count'); if (cnt) cnt.remove(); add(ph, el('span', { class: 'pw-nophoto' }, ic('camera', 16), 'Bez fotografija')); }
      }
      c.querySelectorAll('a').forEach((a) => { a.removeAttribute('href'); a.setAttribute('tabindex', '-1'); a.setAttribute('aria-disabled', 'true'); });
      const fav = c.querySelector('.fav'); if (fav) fav.remove();
      const walk = c.querySelector('.walk'); if (walk) walk.remove();   /* mock POI nema smisla za nacrt */
      const st = c.querySelector('.street span'); if (st) st.textContent = [d.ad.trim(), placeLine(l)].filter(Boolean).join(' · ');
      if (!l.p) { const pr = c.querySelector('.price'); if (pr) pr.textContent = 'Cena nije uneta'; const cx = c.querySelector('.ctx'); if (cx) cx.remove(); }
      const ag = c.querySelector('.foot .ag'); if (ag) ag.textContent = [d.adv === 'agencija' ? 'Agencija' : 'Vlasnik', feeText(d, true)].filter(Boolean).join(' · ');
      c.classList.add('pw-card');
      c.setAttribute('aria-label', 'Pregled kartice oglasa');
      return c;
    }

    function paintAside() {
      const l = draftListing(d);
      const fair = fairOf(l);
      const qy = quality(d, fair);
      fill(aside, 
        el('p', { class: 'eyebrow' }, 'Ovako će izgledati'),
        previewCard(l),
        el('section', { class: 'pw-q', id: 'pw-quality', 'aria-label': 'Kvalitet oglasa' },
          el('div', { class: 'pw-q-hd' }, el('p', { class: 'eyebrow' }, 'Kvalitet oglasa'), el('p', { class: 'pw-q-n num' }, el('b', {}, String(qy.score)), el('span', {}, '/100')), el('p', { class: 'pw-q-w' }, qy.word)),
          el('div', { class: 'pw-q-bar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(qy.score), 'aria-label': 'Kvalitet oglasa' }, el('i', { style: `width:${qy.score}%` })),
          el('ul', { class: 'pw-q-list' }, qy.items.map((it) => el('li', { class: it.ok ? 'ok' : '' },
            el('button', { type: 'button', onclick: () => go(it.step) },
              el('span', { class: 'pw-q-ic', 'aria-hidden': 'true' }, it.ok ? ic('check', 14) : null),
              el('span', { class: 'pw-q-t' }, it.label, el('small', {}, it.note)),
              el('span', { class: 'pw-q-p num' }, `${it.got}/${it.pts}`))))),
          el('p', { class: 'meta pw-q-foot' }, 'Kupci prvo otvaraju oglase sa fotografijama, ulicom i dokazom o uknjižbi.')));
      fill(mScore, el('span', {}, 'Kvalitet oglasa'), el('b', { class: 'num' }, `${qy.score}/100`), el('i', { style: `--w:${qy.score}%` }));
    }

    const upd = (patch, opts = {}) => { Object.assign(d, patch); autosave(); paintAside(); if (opts.step) paintStep(); };

    /* polja */
    const inp = (key, o = {}) => {
      const valid = (v) => (key === 'phone' ? String(v).replace(/\D/g, '').length >= 8 : String(v).trim() !== '');
      const i = el('input', { class: 'input' + (o.cls ? ' ' + o.cls : ''), id: 'pw-' + key, type: o.type || 'text', inputmode: o.inputmode || null, placeholder: o.placeholder || '', maxlength: o.max || null, autocomplete: o.ac || 'off',
        oninput: (e) => { if (valid(e.target.value)) e.target.removeAttribute('aria-invalid'); upd({ [key]: e.target.value }); if (o.onInput) o.onInput(e.target.value); },
        onblur: o.thousands ? (e) => { const f = fmtThousands(e.target.value); if (f !== e.target.value) { e.target.value = f; upd({ [key]: f }); } } : null });
      i.value = d[key] == null ? '' : (o.thousands && d[key] !== '' ? fmtThousands(d[key]) : d[key]);
      return i;
    };
    const fld = (label, node, hint) => {
      const ctl = node.matches && node.matches('input,select,textarea') ? node : node.querySelector && node.querySelector('input,select,textarea');
      const hid = ctl && hint ? ctl.id + '-h' : null;
      if (hid) ctl.setAttribute('aria-describedby', hid);
      return el('div', { class: 'fld' }, el('label', { class: 'lbl', for: ctl ? ctl.id : null }, label), node, hint ? el('p', { class: 'help', id: hid }, hint) : null);
    };
    const sel = (key, opts, o = {}) => { const s = S(() => select(opts, d[key], (v) => upd({ [key]: v }, { step: o.rebuild }), { label: o.label }), null); if (s) s.id = 'pw-' + key; return s; };
    const sfx = (node, suffix) => el('div', { class: 'input-wrap pw-sfx' }, node, el('span', { class: 'suffix' }, suffix));

    function stepTip() {
      const types = S(() => TYPES.map((t) => ({ v: t.v, l: t.s, icon: t.icon })), [{ v: 'stan', l: 'Stan' }]);
      return [
        el('h2', { class: 't-h2s' }, 'Šta oglašavaš?'),
        el('div', { class: 'pw-f' }, el('span', { class: 'lbl' }, 'Vrsta oglasa'), S(() => segmented([{ v: 'prodaja', l: 'Prodaja' }, { v: 'izdavanje', l: 'Izdavanje' }], d.t, (v) => {
          if (v === d.t) return;
          const had = numOr(d.p) != null || numOr(d.dep) != null || numOr(d.fee) != null;
          upd({ t: v, p: '', dep: '', fee: '', feePayer: payersOf(v)[0].v }, { step: true });
          if (had) say(v === 'izdavanje' ? 'Cena je obrisana jer se kirija unosi mesečno' : 'Kirija je obrisana — unesi prodajnu cenu');
        }), null)),
        el('div', { class: 'pw-f' }, el('span', { class: 'lbl' }, 'Tip nekretnine'), S(() => pills(types, [d.pt], (v) => upd({ pt: v }), { single: true }), null)),
        el('div', { class: 'pw-f' }, el('span', { class: 'lbl' }, 'Oglašavam kao'),
          el('div', { class: 'pw-radios' }, [['vlasnik', 'Vlasnik', d.t === 'izdavanje' ? 'Besplatno, bez provizije za stanara' : 'Besplatno, bez provizije za kupca'], ['agencija', 'Agencija', 'Upisana u registar posrednika']].map(([v, l, h]) =>
            el('label', { class: 'check pw-radio' }, el('input', { type: 'radio', id: 'pw-adv-' + v, name: 'pw-adv', value: v, checked: d.adv === v, onchange: () => upd({ adv: v }, { step: true }) }), el('span', {}, el('b', {}, l), el('small', {}, h)))))),
        d.adv === 'agencija' ? el('div', { class: 'pw-grid pw-fee' },
          fld(d.t === 'izdavanje' ? 'Provizija (% jedne kirije)' : 'Provizija (%)', sfx(inp('fee', { inputmode: 'decimal', placeholder: d.t === 'izdavanje' ? '50' : '2', max: '5' }), '%'),
            d.t === 'izdavanje' ? 'Uobičajeno 40–50 % prve kirije; u Beogradu je često plaća vlasnik.' : 'Uobičajeno 2–3 % + PDV. Zakon traži da jasno navedeš iznos i ko ga plaća.'),
          fld('Ko plaća proviziju', sel('feePayer', payersOf(d.t), { label: 'Ko plaća proviziju' }) || el('span'))) : null,
      ];
    }
    function stepLok() {
      const cities = S(() => D.cities.slice().sort((a, b) => (b.c || 0) - (a.c || 0)).map((c) => ({ v: c.s, l: c.n })), []);
      const muns = [{ v: '', l: 'Izaberi opštinu' }, ...S(() => find.munsOf(d.cs).map((m) => ({ v: m.s, l: m.n })), [])];
      const nbs = S(() => [...new Set(D.listings.filter((l) => (d.ms ? l.ms === d.ms : l.cs === d.cs)).map((l) => l.n))].sort(), []);
      const dl = el('datalist', { id: 'pw-nb-list' }, nbs.map((n) => el('option', { value: n })));
      const nIn = inp('n', { placeholder: nbs[0] ? `npr. ${nbs[0]}` : 'Naselje' }); nIn.setAttribute('list', 'pw-nb-list');
      const mapBox = el('div', { class: 'pw-map' });
      const ll = () => (d.lat != null ? { lat: d.lat, lng: d.lng } : munCentroid(d.ms, d.cs));
      const p0 = ll();
      const m = pickMap(mapBox, { city: d.cs, view: { lat: p0.lat, lng: p0.lng, zoom: d.ms ? 13.5 : 12 }, radius: { lat: p0.lat, lng: p0.lng, m: 180 },
        onPick: (pt) => { upd({ lat: pt.lat, lng: pt.lng }); S(() => m.api.setRadius({ lat: pt.lat, lng: pt.lng, m: 180 })); pinTxt.textContent = `Tačka: ${num(pt.lat, 4)}, ${num(pt.lng, 4)}`; } });
      const pinTxt = el('span', {}, d.lat != null ? `Tačka: ${num(d.lat, 4)}, ${num(d.lng, 4)}` : 'Tačka je centar opštine — klikni na mapu da je pomeriš.');
      return [
        el('h2', { class: 't-h2s' }, 'Gde se nalazi?'),
        el('div', { class: 'pw-grid' },
          fld('Grad', S(() => { const s = select(cities, d.cs, (v) => upd({ cs: v, ms: '', n: '', lat: null, lng: null }, { step: true }), { label: 'Grad' }); s.id = 'pw-cs'; return s; }, el('span'))),
          fld('Opština', S(() => { const s = select(muns, d.ms, (v) => { d.lat = null; d.lng = null; upd({ ms: v }, { step: true }); }, { label: 'Opština' }); s.id = 'pw-ms'; return s; }, el('span'))),
          fld('Naselje', el('div', {}, nIn, dl), 'Biraj iz liste ili upiši svoje'),
          fld('Ulica i broj', inp('ad', { placeholder: 'npr. Makenzijeva 41', max: '80' }), 'Oglasi sa ulicom dobijaju više poziva. Tačan broj možeš sakriti.')),
        el('div', { class: 'pw-f' }, el('span', { class: 'lbl' }, 'Tačka na mapi'), mapBox, el('p', { class: 'meta pw-maphint' }, ic('locate', 14), pinTxt)),
      ];
    }
    function stepDet() {
      const rooms = S(() => ROOMS.map(([v, l]) => ({ v, l })), []);
      const opt = (obj, empty) => [{ v: '', l: empty }, ...Object.entries(obj).map(([v, l]) => ({ v, l }))];
      const amen = S(() => Object.entries(AMEN).slice(0, 14).map(([v, l]) => ({ v, l })), []);
      const hasRooms = ['stan', 'kuca', 'vikendica', 'soba'].includes(d.pt);
      return [
        el('h2', { class: 't-h2s' }, 'Osnovni podaci'),
        el('div', { class: 'pw-grid pw-grid-3' },
          fld('Kvadratura', sfx(inp('a', { inputmode: 'decimal', placeholder: '60' }), 'm²')),
          hasRooms ? fld('Struktura', sel('ro', rooms, { label: 'Struktura' }) || el('span')) : null,
          fld('Godina izgradnje', inp('y', { inputmode: 'numeric', placeholder: '1978', max: '4' })),
          fld('Sprat', inp('fl', { inputmode: 'numeric', placeholder: '0 = prizemlje', max: '3' })),
          fld('Spratnost zgrade', inp('tf', { inputmode: 'numeric', placeholder: 'ukupno spratova', max: '3' })),
          fld('Grejanje', sel('he', opt(S(() => HEAT, {}), 'Izaberi'), { label: 'Grejanje' }) || el('span')),
          fld('Stanje', sel('co', opt(S(() => COND, {}), 'Izaberi'), { label: 'Stanje' }) || el('span')),
          fld('Opremljenost', sel('fu', opt(S(() => FURN, {}), 'Izaberi'), { label: 'Opremljenost' }) || el('span'))),
        el('div', { class: 'pw-f pw-legal' },
          fld('Pravni status (uknjiženost)', sel('legal', LEGAL, { label: 'Pravni status', rebuild: true }) || el('span'),
            d.legal === 'poseban-zakon' ? 'Upis po Zakonu iz 2025. ne garantuje bezbednost objekta; banke odlučuju pojedinačno o kreditu.' : d.legal === 'ozakonjenje' || d.legal === 'nije' ? 'Bez uknjižbe kupac po pravilu ne može da dobije stambeni kredit — navedi to iskreno.' : 'Banke finansiraju samo uknjižene nekretnine.'),
          d.legal === 'uknjizeno' ? S(() => check('Imam list nepokretnosti (dokaz o uknjižbi) i mogu da ga pokažem', d.proof, (on) => upd({ proof: on })), null) : null),
        el('div', { class: 'pw-f' }, el('span', { class: 'lbl' }, 'Dodatno'), S(() => pills(amen, d.am, (v, on, all) => upd({ am: all })), null)),
      ];
    }
    function stepOpis() {
      const l = draftListing(d);
      const sugg = titleOf({ ...l, ti: null });
      const count = el('span', { class: 'pw-count num', 'aria-live': 'polite' });
      const paintCount = () => { const n = d.d.trim().length; count.className = 'pw-count num' + (n >= 300 ? ' ok' : ''); count.textContent = n >= 300 ? `${n} znakova · odlično` : `${n} / 300 preporučeno`; };
      const ta = el('textarea', { class: 'input pw-ta', id: 'pw-d', rows: '9', maxlength: '4000', placeholder: 'Počni od onoga što fotografija ne pokazuje: raspored i svetlo, koliko je tiho, kakvi su komšije i zgrada, koliki su računi zimi, šta je renovirano i kada.', oninput: (e) => { upd({ d: e.target.value }); paintCount(); } });
      ta.value = d.d;
      paintCount();
      const tIn = inp('title', { placeholder: sugg, max: '90' });
      return [
        el('h2', { class: 't-h2s' }, 'Opis'),
        fld('Naslov', tIn, `Ako ostaviš prazno, koristimo: „${sugg}“`),
        el('div', { class: 'fld pw-f' }, el('label', { class: 'lbl', for: 'pw-d' }, 'Opis'), ta, el('div', { class: 'pw-ta-ft' }, el('p', { class: 'help' }, 'Bez velikih slova i uzvičnika. Iskren opis štedi vreme i tebi i kupcu.'), count)),
        el('div', { class: 'note-rule pw-tips' }, el('b', {}, 'Šta kupci najčešće pitaju: '), 'da li je stan uknjižen i na koga, koliki su troškovi zgrade i grejanja, da li ima lift i podrum, kada je useljiv, da li je cena fiksna.'),
      ];
    }
    function stepFoto() {
      const grid = el('ol', { class: 'pw-photos' });
      const seedL = () => ({ ...draftListing(d), s: 'nacrt' });
      let dragFrom = null;
      const move = (from, to) => { if (to < 0 || to >= d.photos.length || from === to) return; const a = d.photos.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); upd({ photos: a }); paintGrid(); };
      const addPhotos = (k) => { const next = d.photos.length ? Math.max(...d.photos) + 1 : 0; const more = Array.from({ length: k }, (_, i) => next + i); upd({ photos: d.photos.concat(more).slice(0, 30) }); paintGrid(); say(k === 1 ? 'Fotografija je dodata' : `${k} ${plural(k, 'fotografija je dodata', 'fotografije su dodate', 'fotografija je dodato')}`); };
      const paintGrid = () => {
        const l = seedL();
        fill(grid, ...d.photos.map((idx, i) => el('li', { class: 'pw-ph' + (i === 0 ? ' cover' : ''), draggable: 'true', 'data-i': String(i),
          ondragstart: (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; S(() => e.dataTransfer.setData('text/plain', String(i))); e.currentTarget.classList.add('drag'); },
          ondragend: (e) => { e.currentTarget.classList.remove('drag'); },
          ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('over'); },
          ondragleave: (e) => e.currentTarget.classList.remove('over'),
          ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); if (dragFrom != null) move(dragFrom, i); dragFrom = null; } },
          el('div', { class: 'ph' }, S(() => img.el(l, idx, { aspect: '4:3', alt: `Fotografija ${i + 1}` }), null)),
          el('span', { class: 'pw-ph-n' }, i === 0 ? 'Naslovna' : String(i + 1)),
          el('div', { class: 'pw-ph-act' },
            el('button', { class: 'iconbtn', type: 'button', 'aria-label': `Pomeri fotografiju ${i + 1} levo`, disabled: i === 0, onclick: () => move(i, i - 1) }, ic('arrow-left', 16)),
            el('button', { class: 'iconbtn', type: 'button', 'aria-label': `Pomeri fotografiju ${i + 1} desno`, disabled: i === d.photos.length - 1, onclick: () => move(i, i + 1) }, ic('arrow-right', 16)),
            el('button', { class: 'iconbtn', type: 'button', 'aria-label': `Ukloni fotografiju ${i + 1}`, onclick: () => { upd({ photos: d.photos.filter((_, j) => j !== i) }); paintGrid(); } }, ic('trash', 16))))));
        cnt.textContent = d.photos.length ? `${d.photos.length} ${plural(d.photos.length, 'fotografija', 'fotografije', 'fotografija')} · prva je naslovna, prevuci ili koristi strelice za redosled` : 'Još nema fotografija.';
      };
      const cnt = el('p', { class: 'meta pw-ph-cnt', 'aria-live': 'polite' });
      const file = el('input', { type: 'file', id: 'pw-file', accept: 'image/*', multiple: true, class: 'sr', onchange: (e) => { const k = (e.target.files || []).length; if (k) addPhotos(k); e.target.value = ''; } });
      const drop = el('label', { class: 'pw-drop', for: 'pw-file',
        ondragover: (e) => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); drop.classList.add('over'); } },
        ondragleave: () => drop.classList.remove('over'),
        ondrop: (e) => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); drop.classList.remove('over'); addPhotos(e.dataTransfer.files.length); } },
        file, ic('image', 28), el('b', {}, 'Prevuci fotografije ovde ili izaberi sa uređaja'), el('span', { class: 'meta' }, 'JPG ili PNG, do 30 fotografija. Prva je naslovna.'));
      paintGrid();
      /* tlocrt: šematski, iz kvadrature i strukture (isti model kao na stranici oglasa kad je dostupan) */
      const planBox = el('div', { class: 'pw-plan' });
      const paintPlan = () => {
        fill(planBox,
          d.plan ? el('figure', { class: 'pw-plan-fig' }, planSvg(draftListing(d)), el('figcaption', { class: 'meta' }, 'Šematski tlocrt (demo) — u pravom oglasu ovde je tvoj crtež ili sken.')) : null,
          el('div', { class: 'btn-row' }, d.plan
            ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { upd({ plan: false }); paintPlan(); say('Tlocrt je uklonjen'); } }, ic('trash', 16), 'Ukloni tlocrt')
            : el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { upd({ plan: true }); paintPlan(); say('Tlocrt je dodat'); } }, ic('plus', 16), 'Dodaj tlocrt')));
      };
      paintPlan();
      const vIn = inp('video', { type: 'url', inputmode: 'url', placeholder: 'https://youtube.com/watch?v=…', max: '300' });
      const vHelp = el('p', { class: 'help', id: 'pw-video-h' });
      const paintVideo = () => {
        const v = String(d.video || '').trim();
        const bad = v && !isUrl(v);
        if (bad) vIn.setAttribute('aria-invalid', 'true'); else vIn.removeAttribute('aria-invalid');
        vHelp.className = 'help' + (bad ? ' err' : '');
        vHelp.textContent = bad ? 'Link treba da počne sa https:// — npr. YouTube, Vimeo ili Matterport.' : 'YouTube, Vimeo ili Matterport link. Nije obavezno.';
      };
      vIn.setAttribute('aria-describedby', 'pw-video-h');
      vIn.addEventListener('input', paintVideo);
      paintVideo();
      return [
        el('h2', { class: 't-h2s' }, 'Fotografije'),
        drop,
        el('div', { class: 'btn-row pw-ph-btns' }, el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => addPhotos(1) }, ic('plus', 16), 'Dodaj generisanu fotografiju')),
        el('p', { class: 'note-rule' }, 'Ovo je demo: fotografije se ne šalju nigde. Umesto tvojih slika prikazujemo generisane ilustracije, da vidiš raspored i naslovnu.'),
        cnt, grid,
        el('div', { class: 'pw-f pw-media' }, el('span', { class: 'lbl' }, 'Tlocrt'), planBox),
        el('div', { class: 'fld pw-f pw-media' }, el('label', { class: 'lbl', for: 'pw-video' }, 'Video ili 3D obilazak (link)'), vIn, vHelp),
      ];
    }
    function stepCena() {
      const live = el('div', { class: 'pw-live', 'aria-live': 'polite' });
      const paintLive = () => {
        const l = draftListing(d);
        const f = fairOf(l);
        fill(live, );
        if (!l.p || !l.a) { add(live, el('p', { class: 'meta' }, l.a ? 'Unesi cenu da uporedimo sa sličnim oglasima.' : 'Unesi kvadraturu (korak Detalji) i cenu da uporedimo sa sličnim oglasima.')); return; }
        const ppmTxt = S(() => fmt.ppm(l.p / l.a), '');
        const rent = l.t === 'izdavanje';
        const money = (v) => S(() => fmt.price(v, l.t), rent ? eurMes(v) : eur(v));
        /* prosek prikazujemo samo kad ima uzorak (n ≥ 5, spec 5.7) — inače bi pisalo „prosek: · · n=0“ */
        const dOk = !!(f && f.deltaObj && f.deltaObj.n >= 5 && f.deltaObj.label && f.deltaObj.pct != null);
        const dChip = dOk ? S(() => deltaChip(f.deltaObj), null) : null;
        add(live, el('p', { class: 'pw-ppm' }, el('b', { class: 'num' }, ppmTxt), dChip, dOk ? el('span', { class: 'meta' }, ` prosek: ${f.deltaObj.label} · ${S(() => fmt.ppm(f.deltaObj.ppm), '')} · n=${f.deltaObj.n}`) : null));
        if (f && f.verdict && f.estimate) {
          const { low, high, mid } = f.estimate;
          const lo = Math.min(low * 0.8, l.p * 0.95), hi = Math.max(high * 1.2, l.p * 1.05);
          const at = (v) => Math.max(2, Math.min(98, ((v - lo) / (hi - lo)) * 100));
          const pos = (v) => `${at(v).toFixed(1)}%`;
          /* natpisi stoje tačno na svojoj vrednosti (ne na krajevima trake): donja granica završava se na početku opsega, gornja počinje na kraju,
             „tvoja cena“ je zastavica uz tačku — okrenuta ka sredini da ne izađe iz trake */
          const tag = (v, anchor, ...kids) => el('span', { class: `pw-m-tag at-${anchor(at(v))}`, style: `left:${at(v).toFixed(1)}%` }, ...kids);
          const toMid = (x) => (x <= 50 ? 'start' : 'end');
          const pctAbs = S(() => fmt.pct(Math.abs(f.diffPct)), '');
          const vtxt = f.verdict === 'ispod'
            ? (rent ? `Kirija je ${pctAbs} ispod procene — brzo ćeš naći stanara, ali proveri da kiriju nisi potcenio.` : `Cena je ${pctAbs} ispod procene — privući će pažnju, ali proveri da je nisi potcenio.`)
            : f.verdict === 'iznad'
              ? (rent ? `Kirija je ${pctAbs} iznad procene — očekuj pregovore ili da se stan duže izdaje.` : `Cena je ${pctAbs} iznad procene — očekuj pregovore ili sporiju prodaju.`)
              : (rent ? 'Kirija je u fer opsegu za uporedive oglase.' : 'Cena je u fer opsegu za uporedive oglase.');
          add(live, el('div', { class: 'pw-merilo', role: 'img', 'aria-label': `Procena ${money(low)} do ${money(high)}, tvoja cena ${money(l.p)}` },
            el('div', { class: 'pw-m-row pw-m-you num', 'aria-hidden': 'true' }, tag(l.p, toMid, el('b', {}, 'Tvoja cena'), ` ${money(l.p)}`)),
            el('div', { class: 'pw-m-track' }, el('span', { class: 'band', style: `left:${pos(low)};right:calc(100% - ${pos(high)})` }), el('span', { class: 'mid', style: `left:${pos(mid)}` }), el('span', { class: 'dot', style: `left:${pos(l.p)}` })),
            el('div', { class: 'pw-m-row pw-m-lbl num', 'aria-hidden': 'true' }, tag(low, (x) => (x >= 20 ? 'end' : 'start'), money(low)), tag(high, (x) => (x <= 80 ? 'start' : 'end'), money(high))),
            el('p', { class: 'pw-m-cap meta', 'aria-hidden': 'true' }, el('i', { class: 'sw' }), el('b', {}, 'Procena'), ` ${money(low)} – ${money(high)} · ${f.n} uporedivih`)),
          el('p', { class: 'pw-verdict pw-v-' + f.verdict }, vtxt));
        } else add(live, el('p', { class: 'meta' }, dOk ? `Premalo uporedivih oglasa za procenu raspona — poredimo samo sa prosekom (${f.deltaObj.label}) iznad.`
          : `U ovoj oblasti nema dovoljno sličnih oglasa (treba bar 5) ni za procenu ni za prosek, pa ${rent ? 'kiriju' : 'cenu'} ne ocenjujemo. Proveri je sa nekoliko oglasa iz kraja.`));
        /* isto pravilo kao KX.afford gate.financeable: banke finansiraju uknjiženo; zemljište i garažu ne računamo kao stambeni kredit */
        if (l.t === 'prodaja' && d.pt !== 'zemljiste' && d.pt !== 'garaza') {
          const fin = FINANCEABLE[d.legal] || 'zavisi';
          const r = fin === 'ne' ? null : S(() => mortgage(l.p * 0.8, 5, 25).monthly, null);
          if (fin === 'ne') add(live, el('p', { class: 'meta pw-rata' }, 'Kupci na kredit neće moći da kupe dok nekretnina nije uknjižena — računaj na kupce za keš.'));
          else if (r) add(live, el('p', { class: 'meta pw-rata' }, `Kupcu na kredit: rata od oko ${eurMes(r)} (20 % učešća, 25 god., kamata 5 %)${fin === 'zavisi' ? ', ako banka odobri kredit — za ovaj pravni status to zavisi od banke.' : '.'}`));
        }
      };
      paintLive();
      const pIn = inp('p', { inputmode: 'numeric', placeholder: d.t === 'izdavanje' ? '450' : '125.000', onInput: paintLive, thousands: true });
      return [
        el('h2', { class: 't-h2s' }, 'Cena'),
        el('div', { class: 'pw-grid' },
          fld(d.t === 'izdavanje' ? 'Mesečna kirija' : 'Cena', sfx(pIn, d.t === 'izdavanje' ? '€/mes' : '€'), d.t === 'izdavanje' ? null : 'Cena sa PDV-om ako prodaješ kao investitor.'),
          d.t === 'izdavanje' ? fld('Depozit', sfx(inp('dep', { inputmode: 'numeric', placeholder: 'obično jedna kirija', thousands: true }), '€')) : null),
        S(() => toggle(d.neg, (on) => upd({ neg: on }), { label: 'Cena nije fiksna — otvoren sam za pregovore' }), null),
        el('div', { class: 'pw-f' }, el('span', { class: 'lbl' }, 'Merilo — kako tvoja cena stoji'), live),
      ];
    }
    function stepPregled() {
      const l = draftListing(d);
      const row = (k, v) => el('div', { class: 'pw-sum-r' }, el('dt', {}, k), el('dd', {}, v || el('span', { class: 'ax-muted' }, 'nije uneto')));
      const grp = (title, step, rows) => el('div', { class: 'pw-sum-g' }, el('div', { class: 'pw-sum-hd' }, el('h3', {}, title), el('button', { class: 'btn btn-link', type: 'button', onclick: () => go(step) }, 'Izmeni')), el('dl', {}, rows));
      const legal = (LEGAL.find((x) => x.v === d.legal) || {}).l;
      return [
        el('h2', { class: 't-h2s' }, 'Pregled i kontakt'),
        el('div', { class: 'pw-sum' },
          grp('Tip', 0, [row('Oglas', `${d.t === 'izdavanje' ? 'Izdavanje' : 'Prodaja'} · ${S(() => typeOf(d.pt).s, d.pt)}`), row('Oglašivač', d.adv === 'agencija' ? 'Agencija' : 'Vlasnik'), row('Provizija', feeText(d))]),
          grp('Lokacija', 1, [row('Mesto', [l.n, l.m, l.c].filter((x, i, a) => x && a.indexOf(x) === i).join(', ')), row('Ulica', d.ad)]),
          grp('Detalji', 2, [row('Kvadratura', l.a ? S(() => fmt.m2(l.a), '') : ''), row('Struktura', l.ro != null ? S(() => fmt.rooms(l.ro), '') : ''), row('Sprat', l.fl != null ? S(() => fmt.floor(l.fl, l.tf), '') : ''), row('Pravni status', legal + (d.legal === 'uknjizeno' && d.proof ? ' · ima dokaz' : ''))]),
          grp('Opis i fotografije', 3, [row('Naslov', l.ti), row('Opis', d.d.trim() ? `${d.d.trim().length} znakova` : ''), row('Fotografije', d.photos.length ? String(d.photos.length) : ''), row('Tlocrt', d.plan ? 'dodat' : ''), row('Video / 3D', String(d.video || '').trim() && isUrl(String(d.video).trim()) ? 'link dodat' : '')]),
          grp('Cena', 5, [row(d.t === 'izdavanje' ? 'Kirija' : 'Cena', l.p ? S(() => fmt.price(l.p, l.t), '') : ''), row('Pregovori', d.neg ? 'cena nije fiksna' : 'fiksna cena')])),
        el('h3', { class: 'pw-h3' }, 'Kontakt'),
        el('div', { class: 'pw-grid' },
          fld('Ime i prezime', inp('name', { placeholder: 'Ana Petrović', max: '60', ac: 'name' })),
          fld('Telefon', inp('phone', { type: 'tel', inputmode: 'tel', placeholder: '064 123 4567', max: '20', ac: 'tel' }), 'Prikazujemo ga delimično dok kupac ne klikne „prikaži broj“.')),
        S(() => check('Potvrđujem da sam vlasnik ili ovlašćeni posrednik i da su podaci tačni', d.agree, (on) => upd({ agree: on })), null),
      ];
    }
    const BUILDERS = [stepTip, stepLok, stepDet, stepOpis, stepFoto, stepCena, stepPregled];
    function stepFilled() {
      return [
        d.adv !== 'agencija' || numOr(d.fee) != null,
        d.ad.trim().length >= 3,
        numOr(d.a) != null,
        d.d.trim().length >= 300,
        d.photos.length >= 5,
        numOr(d.p) != null,
        !!d.name.trim() && String(d.phone).replace(/\D/g, '').length >= 8 && !!d.agree,
      ];
    }

    function missingFor() {
      const l = draftListing(d);
      const miss = [];
      if (d.adv === 'agencija' && numOr(d.fee) == null) miss.push(['proviziju', 0, 'pw-fee']);
      if (!l.a) miss.push(['kvadraturu', 2, 'pw-a']);
      if (!l.p) miss.push([d.t === 'izdavanje' ? 'kiriju' : 'cenu', 5, 'pw-p']);
      if (!d.name.trim()) miss.push(['ime', 6, 'pw-name']);
      if (String(d.phone).replace(/\D/g, '').length < 8) miss.push(['telefon', 6, 'pw-phone']);
      if (!d.agree) miss.push(['potvrdu tačnosti', 6, null]);
      return miss;
    }
    function publish() {
      const miss = missingFor();
      if (miss.length) {
        say(`Nedostaje: ${miss.map((m) => m[0]).join(', ')}`);
        go(miss[0][1]);
        setTimeout(() => { const n = miss[0][2] && document.getElementById(miss[0][2]); if (n) { n.setAttribute('aria-invalid', 'true'); n.focus(); } }, 60);
        return;
      }
      const l = draftListing(d);
      const list = mineGet();
      const prev = d.editRef ? list.find((x) => x.ref === d.editRef) : null;
      let ref = prev ? prev.ref : null;
      if (!ref) {
        let k = 1000000 + (S(() => hash(JSON.stringify([d.t, d.pt, d.cs, d.ms, d.ad, d.a, d.p, d.name, d.phone, d.d.length])), 7) % 9000000);
        while (list.some((x) => x.ref === 'KV-' + k)) k = k >= 9999999 ? 1000000 : k + 1;
        ref = 'KV-' + k;
      }
      const now = new Date().toISOString();
      const score = quality(d, fairOf(l)).score;
      /* Moji oglasi: izmena zadržava datum objave i status, nov oglas ide na vrh */
      const entry = { ref, at: prev ? prev.at : now, updated: prev ? now : null, active: prev ? prev.active !== false : true, title: l.ti, score, draft: { ...d, published: null, editRef: null, saved: null } };
      const kept = mineSet(prev ? list.map((x) => (x.ref === ref ? entry : x)) : [entry, ...list]);
      d.published = { ref, at: entry.at, title: l.ti, score, edited: !!prev, kept };
      d.editRef = ref;   /* „Izmeni ovaj oglas“ menja isti oglas, ne pravi novi */
      saveNow();
      say(prev ? `Izmene oglasa ${ref} su poslate na proveru (demo)` : `Oglas ${ref} je poslat na proveru (demo)`, { kind: 'success' });
      paintAll();
      window.scrollTo(0, 0);
    }
    function success() {
      const p = d.published;
      return el('div', { class: 'pw-done' },
        el('span', { class: 'pw-done-ic', 'aria-hidden': 'true' }, ic('check', 28)),
        el('p', { class: 'eyebrow' }, p.edited ? 'IZMENE SU POSLATE' : 'OGLAS JE POSLAT'),
        el('h1', { class: 't-h1' }, p.edited ? 'Izmene su na proveri' : 'Hvala — oglas je na proveri'),
        el('p', { class: 'lede ax-lede' }, `„${p.title}“ ${p.edited ? 'osvežavamo' : 'objavljujemo'} kad proverimo podatke, obično istog dana. Kvalitet oglasa: ${p.score}/100.`),
        el('div', { class: 'pw-ref' }, el('span', { class: 'lbl' }, 'Broj oglasa'), el('b', { class: 'num', tabindex: '0' }, p.ref), S(() => copyButton(p.ref, { outline: true, label: 'Kopiraj broj oglasa' }), null)),
        el('p', { class: 'note-rule' }, p.kept === false ? 'Ovo je demo — oglas nije stvarno objavljen i ne šalje se nikome. Pregledač ne dozvoljava čuvanje, pa ga nećeš videti u „Moji oglasi“.'
          : 'Ovo je demo — oglas nije stvarno objavljen i ne šalje se nikome. Sačuvan je u „Moji oglasi“ na ovom uređaju: tamo vidiš preglede, obnavljaš ga ili deaktiviraš.'),
        el('div', { class: 'btn-row' },
          el('a', { class: 'btn btn-primary', href: '#/moji-oglasi' }, 'Moji oglasi', ic('arrow-right', 16)),
          el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { d = { ...DRAFT0, photos: [], am: [] }; lsSet(DRAFT_KEY, d); cur = 0; savedAt = null; paintAll(); window.scrollTo(0, 0); } }, 'Postavi novi oglas'),
          el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { d.published = null; cur = 6; saveNow(); paintAll(); } }, 'Izmeni ovaj oglas'),
          el('a', { class: 'btn btn-ghost', href: '#/' }, 'Na početnu')));
    }

    function paintNav() {
      const last = cur === STEPS.length - 1;
      fill(navBox, 
        cur > 0 ? el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => go(cur - 1) }, ic('arrow-left', 16), 'Nazad') : el('span'),
        savedLine,
        last ? el('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: publish }, d.editRef ? 'Objavi izmene' : 'Objavi oglas')
          : el('button', { class: 'btn btn-primary', type: 'button', onclick: () => go(cur + 1) }, `Dalje: ${STEPS[cur + 1]}`, ic('arrow-right', 16)));
      paintSaved();
    }
    function paintStep() {
      fill(stepperBox, S(() => stepper(STEPS, cur), el('p', {}, `Korak ${cur + 1} od ${STEPS.length}`)));
      const lis = stepperBox.querySelectorAll('.stepper li');
      /* „gotov“ samo kad su popunjena polja koja korak traži (isto što proverava kvalitet / Objavi), ne samo zato što je korak pređen */
      const filled = stepFilled();
      lis.forEach((li, i) => {
        const done = i !== cur && filled[i];
        li.classList.toggle('done', done);
        const box = li.querySelector('i');
        if (box) fill(box, done ? ic('check') : String(i + 1));
        const sr = done ? ', završen' : i === cur ? ', trenutni' : filled[i] === false && i < cur ? ', nije završen' : '';
        li.dataset.sr = sr;
      });
      lis.forEach((li, i) => { li.style.cursor = 'pointer'; li.setAttribute('role', 'button'); li.tabIndex = 0; li.setAttribute('aria-label', `Korak ${i + 1}: ${STEPS[i]}${li.dataset.sr || ''}`); li.addEventListener('click', () => go(i)); li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i); } }); });
      const restore = focusMemo(stepBox);
      fill(stepBox, ...S(() => BUILDERS[cur](), [el('p', {}, 'Korak nije dostupan.')]).filter(Boolean));
      restore();
      paintNav();
    }
    function go(i) {
      cur = Math.max(0, Math.min(STEPS.length - 1, i));
      d.step = cur; autosave();
      if (d.published) { d.published = null; }
      paintStep(); paintAside();
      const top = stepperBox.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) S(() => stepperBox.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      const h = stepBox.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    }
    function paintAll() {
      fill(root, );
      if (d.published) { add(root, success()); return; }
      const nMine = mineGet().length;
      const head = pageHead({ crumbs: [{ label: 'Početna', href: '#/' }, { label: 'Postavi oglas' }], eyebrow: d.editRef ? `IZMENA OGLASA ${d.editRef}` : 'BESPLATNO ZA VLASNIKE', title: d.editRef ? 'Izmeni oglas' : 'Postavi oglas',
        lede: d.editRef ? 'Menjaš već poslat oglas: datum objave ostaje isti, a „ažurirano“ dobija današnji datum kad objaviš izmene.' : 'Sedam kratkih koraka. Pregled oglasa i ocena kvaliteta menjaju se dok pišeš, a nacrt se čuva sam.' });
      add(head, el('p', { class: 'pw-mine' }, el('a', { class: 'link', href: '#/moji-oglasi' }, ic('building', 16), nMine ? `Moji oglasi · ${nMine}` : 'Moji oglasi')));
      add(root, 
        head,
        mScore,
        el('div', { class: 'pw-layout' },
          el('div', { class: 'pw-main' }, stepperBox, el('form', { class: 'pw-form', novalidate: true, onsubmit: (e) => { e.preventDefault(); if (cur === STEPS.length - 1) publish(); else go(cur + 1); } }, stepBox), navBox,
            el('div', { class: 'pw-reset' }, el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => {
              const was = d; d = { ...DRAFT0, photos: [], am: [] }; cur = 0; savedAt = null; lsSet(DRAFT_KEY, d); was.editRef ? paintAll() : (paintStep(), paintAside());
              say(was.editRef ? 'Izmene su odbačene — objavljeni oglas je ostao isti' : 'Nacrt je obrisan', { action: { label: 'Vrati', onClick: () => { d = was; cur = was.step || 0; lsSet(DRAFT_KEY, d); was.editRef ? paintAll() : (paintStep(), paintAside()); } } });
            } }, ic('trash', 16), d.editRef ? 'Odbaci izmene' : 'Obriši nacrt'))),
          aside));
      paintStep(); paintAside();
    }
    paintAll();
    return root;
  }

  /* ═════════════════════════ MOJI OGLASI ═════════════════════════ */
  /* kv.myListings: [{ref, at, updated|null, active, title, score, draft}] — samo na ovom uređaju; pregledi/čuvanja su demo brojevi iz hash(ref) i dana na sajtu */
  const MINE_KEY = 'kv.myListings';
  function mineGet() { const v = lsGet(MINE_KEY, []); return Array.isArray(v) ? v.filter((x) => x && typeof x.ref === 'string') : []; }
  function mineSet(list) { return lsSet(MINE_KEY, list); }
  const dateTxt = (iso) => { const t = new Date(iso); return isFinite(t) ? `${t.getDate()}. ${t.getMonth() + 1}. ${t.getFullYear()}.` : ''; };
  const daysSince = (iso) => { const t = Date.parse(iso); return isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 864e5)) : 0; };
  function mineStats(e) {
    const h = S(() => hash(e.ref), 7);
    const days = daysSince(e.at);
    const views = Math.round((days + 0.35) * (12 + (h % 19)));
    const saves = Math.floor((views * (3 + (h % 5))) / 100);
    return { views, saves, days };
  }
  function mineDraft(e) {
    const dd = { ...DRAFT0, ...(e.draft || {}) };
    dd.photos = Array.isArray(dd.photos) ? dd.photos.filter((x) => Number.isInteger(x)) : [];
    dd.am = Array.isArray(dd.am) ? dd.am : [];
    ['title', 'd', 'ad', 'name', 'phone', 'n'].forEach((k) => { if (typeof dd[k] !== 'string') dd[k] = String(dd[k] == null ? '' : dd[k]); });
    return dd;
  }

  function viewMyListings() {
    const root = el('div', { class: 'wrap ax-page mo-page' });
    const draftOpen = () => {
      const dr = lsGet(DRAFT_KEY, null);
      if (!dr || dr.published) return null;
      const started = (dr.step | 0) > 0 || String(dr.d || '').trim() || numOr(dr.p) != null || numOr(dr.a) != null || (Array.isArray(dr.photos) && dr.photos.length);
      return started ? dr : null;
    };
    const update = (ref, patch, msg) => {
      const list = mineGet().map((x) => (x.ref === ref ? { ...x, ...patch } : x));
      if (!mineSet(list)) { say('Pregledač ne dozvoljava čuvanje — promena neće ostati'); return; }
      draw(); if (msg) say(msg);
    };
    const edit = (e) => {
      const old = lsGet(DRAFT_KEY, null);
      const open = draftOpen();
      lsSet(DRAFT_KEY, { ...mineDraft(e), published: null, editRef: e.ref, step: 0 });
      location.hash = '#/postavi';
      if (open && open.editRef !== e.ref) {
        say('Tvoj nedovršeni nacrt je sklonjen da bi menjao ovaj oglas', { action: { label: 'Vrati nacrt', onClick: () => { lsSet(DRAFT_KEY, old); S(() => window.KVApp.render(null, { force: true })); } } });
      }
    };
    const row = (e) => {
      const dd = mineDraft(e);
      const l = draftListing(dd);
      const st = mineStats(e);
      const on = e.active !== false;
      const ph = S(() => img.el({ ...l, s: 'nacrt' }, dd.photos.length ? dd.photos[0] : 0, { aspect: '4:3', alt: '' }), null);
      return el('li', { class: 'mo-item' + (on ? '' : ' off'), 'data-slug': e.ref },
        el('div', { class: 'mo-ph ph' }, ph),
        el('div', { class: 'mo-main' },
          el('p', { class: 'mo-top' }, el('span', { class: 'mo-st mo-st-' + (on ? 'on' : 'off') }, el('i', { 'aria-hidden': 'true' }), on ? (st.days ? 'Aktivan' : 'Na proveri') : 'Deaktiviran'), el('span', { class: 'meta num' }, e.ref)),
          el('h2', { class: 'mo-t' }, nbsp(e.title || l.ti)),
          el('p', { class: 'meta' }, [l.p ? S(() => fmt.price(l.p, l.t), '') : 'cena nije uneta', placeLine(l), `kvalitet ${e.score != null ? e.score : '—'}/100`].filter(Boolean).join(' · ')),
          el('dl', { class: 'mo-stats num' },
            el('div', {}, el('dt', {}, 'Pregledi'), el('dd', {}, num(st.views))),
            el('div', {}, el('dt', {}, 'Sačuvali'), el('dd', {}, num(st.saves))),
            el('div', {}, el('dt', {}, 'Objavljen'), el('dd', {}, dateTxt(e.at), el('small', {}, S(() => fmt.rel(st.days), '')))),
            el('div', {}, el('dt', {}, 'Ažurirano'), el('dd', {}, e.updated ? dateTxt(e.updated) : el('span', { class: 'ax-muted' }, 'nije obnavljan'), e.updated ? el('small', {}, S(() => fmt.rel(daysSince(e.updated)), '')) : null)))),
        el('div', { class: 'mo-act' },
          el('button', { class: 'btn btn-secondary btn-sm', id: 'mo-ob-' + e.ref, type: 'button', disabled: !on, title: on ? null : 'Prvo aktiviraj oglas', 'aria-label': `Obnovi oglas ${e.ref}`, onclick: () => update(e.ref, { updated: new Date().toISOString() }, 'Oglas je obnovljen — datum objave je isti, „ažurirano“ je danas') }, ic('refresh', 16), 'Obnovi'),
          el('button', { class: 'btn btn-secondary btn-sm', id: 'mo-tg-' + e.ref, type: 'button', 'aria-label': `${on ? 'Deaktiviraj' : 'Aktiviraj'} oglas ${e.ref}`, onclick: () => update(e.ref, { active: !on }, on ? 'Oglas je deaktiviran — ne prikazuje se u pretrazi' : 'Oglas je ponovo aktivan') }, ic(on ? 'eye' : 'check', 16), on ? 'Deaktiviraj' : 'Aktiviraj'),
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': `Izmeni oglas ${e.ref}`, onclick: () => edit(e) }, ic('draw', 16), 'Izmeni'),
          el('button', { class: 'iconbtn mo-del', type: 'button', 'aria-label': `Ukloni oglas ${e.ref} sa spiska`, onclick: () => {
            const before = mineGet();
            if (!mineSet(before.filter((x) => x.ref !== e.ref))) { say('Pregledač ne dozvoljava čuvanje'); return; }
            draw();
            say(`Oglas ${e.ref} je uklonjen sa spiska`, { action: { label: 'Vrati', onClick: () => { mineSet(before); draw(); } } });
          } }, ic('trash', 18))));
    };
    function draw() {
      const restore = focusMemo(root);
      const list = mineGet();
      const nOn = list.filter((x) => x.active !== false).length;
      const open = draftOpen();
      const startNew = el('a', { class: 'btn btn-primary', href: '#/postavi', onclick: () => {
        /* poslat oglas u nacrtu → nov prazan nacrt; nedovršen nacrt ostaje (dugme tada glasi „Nastavi nacrt“) */
        if (!open) { const dr = lsGet(DRAFT_KEY, null); if (dr && dr.published) lsSet(DRAFT_KEY, { ...DRAFT0, photos: [], am: [] }); }
      } }, open ? 'Nastavi nacrt' : 'Postavi novi oglas', ic('arrow-right', 16));
      const totals = list.reduce((t, e) => { const s = mineStats(e); return { v: t.v + s.views, f: t.f + s.saves }; }, { v: 0, f: 0 });
      fill(root,
        pageHead({ crumbs: [{ label: 'Početna', href: '#/' }, { label: 'Postavi oglas', href: '#/postavi' }, { label: 'Moji oglasi' }], eyebrow: 'ZA OGLAŠIVAČE', title: 'Moji oglasi',
          lede: list.length ? `${oglasa(list.length)}, ${num(nOn)} ${plural(nOn, 'aktivan', 'aktivna', 'aktivnih')}. Ukupno ${num(totals.v)} ${plural(totals.v, 'pregled', 'pregleda', 'pregleda')} i ${num(totals.f)} ${plural(totals.f, 'čuvanje', 'čuvanja', 'čuvanja')}. Čuva se na ovom uređaju, bez naloga.`
            : 'Ovde su oglasi koje postaviš — sa pregledima, obnavljanjem i deaktivacijom. Čuvaju se na ovom uređaju, bez naloga.' }),
        el('div', { class: 'mo-bar' },
          open ? el('p', { class: 'meta' }, ic('doc', 14), `Nedovršen nacrt: korak ${Math.min(STEPS.length, (open.step | 0) + 1)} od ${STEPS.length}${open.editRef ? ` · izmena oglasa ${open.editRef}` : ''}`) : el('span'),
          startNew),
        list.length ? el('ul', { class: 'mo-list' }, list.map(row))
          : emptyBox('Još nemaš poslatih oglasa', 'Kad objaviš oglas, ovde ćeš videti koliko ga ljudi gleda i čuva, i moći ćeš da ga obnoviš ili privremeno skloniš.', 'Postavi oglas', '#/postavi', { icon: 'building' }),
        list.length ? el('p', { class: 'note-rule mo-note' }, 'Pregledi i čuvanja su demo brojevi (izvedeni iz broja oglasa i dana od objave), ne stvarna statistika. „Obnovi“ ne menja datum objave — kupci i dalje vide kada je oglas prvi put postavljen, a „ažurirano“ pokazuje da je još aktuelan. ',
          el('a', { class: 'link', href: '#/kako-racunamo' }, 'Kako računamo')) : null);
      restore('.mo-act .btn:not([disabled]), .mo-bar .btn, .empty .btn');
    }
    draw();
    bind(root, (fn) => { const h = (e) => { if (!e || e.key === MINE_KEY || e.key === DRAFT_KEY) fn(); }; window.addEventListener('storage', h); return () => window.removeEventListener('storage', h); }, () => draw());
    return root;
  }

  /* privremeno: ruta #/moji-oglasi dok je integrator ne doda u app.js (KVApp.routes je izložena tabela) */
  const ensureMineRoute = () => S(() => {
    const R = window.KVApp && window.KVApp.routes;
    if (!R || R['/moji-oglasi']) return;
    R['/moji-oglasi'] = { view: 'viewMyListings', name: 'Moji oglasi', title: () => 'Moji oglasi', nav: () => '/postavi' };
    if (/^#\/moji-oglasi(\?|$)/.test(location.hash)) window.KVApp.render(null, { force: true });
  });
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureMineRoute); else setTimeout(ensureMineRoute, 0);
  }

  Object.assign(window, { viewCompare, viewSaved, viewPlaces, viewPost, viewMyListings });
})();
