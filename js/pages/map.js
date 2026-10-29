/* Kvadrat.rs — stranica: mapa (viewMap(q)). Nacrt 6.4: mapa preko cele širine ispod zaglavlja, plutajuća pretraga
   (lokacija sa autocomplete-om, „Nacrtaj zonu”, pilula „Filteri N”, prekidač Oglasi · Budžet), zum kontrole, legenda,
   desna fioka (≥1100) sa .row karticama i sinhronizovanim hover-om, telefonski karusel kompaktnih kartica koji prati izabrani pin;
   režim m=budzet: traka „Imaš 100.000 €?” + grad → opštine obojene po m² koje budžet kupuje, klik na kraj → prava pretraga.
   q: URLSearchParams — standardni filteri core.js (t, pt, c, m, n, pmin, pmax, amin, amax, ro, co, he, fu, am, reg, newbuild, q…),
   plus m=budzet (režim budžeta; tada se m ne tumači kao opštine) i b=budžet u €.
   Zavisi (meko, kroz guard-ove) od core.js (el, KV/D, applyFilters, paramsToFilters, filtersToParams, countActive, setHash, toast, TYPES, COND),
   ui.js (card, sheet, pills, segmented, select, filterChip, icon, chip, empty), engine.js (KX.budgetMap) i map.js (mapView). */
'use strict';

function viewMap(q) {
  const S = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  if (q == null || typeof q === 'string') q = new URLSearchParams(q ? 'c=' + q : '');
  else if (!(q instanceof URLSearchParams)) q = new URLSearchParams(q);
  const KV = window.KV || window.D || { listings: [], cities: [], muns: [] };
  const UI = window.ui || window;
  const nf0 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });
  const E = typeof el === 'function' ? el : (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k === 'html') n.innerHTML = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : String(v)); }
    for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; n.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid); }
    return n;
  };
  const icon = (name, size) => S(() => UI.icon(name, size), null) || E('span', { 'aria-hidden': 'true' });
  const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b; return c; };
  const oglasa = (n) => `${nf0.format(n)} ${plural(n, 'oglas', 'oglasa', 'oglasa')}`;
  const fold = (s) => String(s || '').toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const toastSafe = (m) => S(() => toast(m));
  const reduced = () => S(() => window.matchMedia('(prefers-reduced-motion:reduce)').matches, false);
  const TYPES_ = S(() => TYPES, null) || [{ v: 'stan', l: 'Stanovi' }, { v: 'kuca', l: 'Kuće' }, { v: 'poslovni-prostor', l: 'Poslovni prostori' }, { v: 'zemljiste', l: 'Zemljišta' }, { v: 'garaza', l: 'Garaže' }, { v: 'soba', l: 'Sobe' }, { v: 'vikendica', l: 'Vikendice' }];
  const COND_ = S(() => COND, null) || { novogradnja: 'Novogradnja', lux: 'Lux', renovirano: 'Renovirano', 'dobro-stanje': 'Dobro stanje', 'potrebno-renoviranje': 'Potrebno renoviranje', 'u-izgradnji': 'U izgradnji' };

  /* ───────── filteri (core.js ugovor: FILTER_DEFAULTS — t, pt[], c, m[], n[], pmin…, ro[], co[], he[], fu[], am[], reg, newbuild, sort) ───────── */
  const DEF = { t: 'prodaja', pt: [], c: '', m: [], n: [], pmin: '', pmax: '', amin: '', amax: '', ro: [], flmin: '', flmax: '', notLast: false, ymin: '', ymax: '', co: [], he: [], fu: [], reg: false, newbuild: false, am: [], agency: '', advertiser: '', q: '', deltaMax: '', sort: 'rel', view: 'grid', page: 1 };
  const isBudgetParam = q.get('m') === 'budzet';
  const qf = new URLSearchParams(q); if (isBudgetParam) qf.delete('m'); qf.delete('b');
  const readFilters = (qs) => {
    const f = S(() => paramsToFilters(qs), null); if (f) return f;
    const list = (k) => (qs.get(k) || '').split(',').filter(Boolean);
    return { ...DEF, t: qs.get('t') === 'izdavanje' ? 'izdavanje' : 'prodaja', pt: list('pt'), c: qs.get('c') || '', m: list('m'), n: list('n'), pmin: qs.get('pmin') || '', pmax: qs.get('pmax') || '', amin: qs.get('amin') || '', amax: qs.get('amax') || '', ro: list('ro').map((v) => (v.endsWith('+') ? v : +v)), co: list('co'), he: list('he'), fu: list('fu'), am: list('am'), reg: qs.has('reg') };
  };
  const localFilter = (f) => {
    const pt = new Set(f.pt || []), m = new Set(f.m || []), n = new Set(f.n || []), co = new Set(f.co || []);
    const roEx = new Set(), roMin = []; (f.ro || []).forEach((r) => { if (typeof r === 'string' && r.endsWith('+')) roMin.push(parseFloat(r)); else roEx.add(+r); });
    return (KV.listings || []).filter((l) => l.t === f.t && (!pt.size || pt.has(l.pt)) && (!f.c || l.cs === f.c) && (!m.size || m.has(l.ms)) && (!n.size || n.has(l.ns))
      && (!f.pmin || l.p >= +f.pmin) && (!f.pmax || l.p <= +f.pmax) && (!f.amin || l.a >= +f.amin) && (!f.amax || l.a <= +f.amax)
      && (!(roEx.size || roMin.length) || roEx.has(l.ro) || roMin.some((x) => l.ro >= x)) && (!co.size || co.has(l.co)) && (!f.reg || l.reg) && (!(f.am || []).length || f.am.every((k) => (l.am || []).includes(k))));
  };
  const runFilters = (f) => S(() => applyFilters({ ...f, page: 1 }), null) || localFilter(f);
  const toParams = (f) => { const p = S(() => filtersToParams(f), null) || { t: f.t !== 'prodaja' ? f.t : '', pt: f.pt, c: f.c, m: f.m, n: f.n, pmin: f.pmin, pmax: f.pmax, amin: f.amin, amax: f.amax, ro: f.ro, co: f.co, am: f.am, reg: f.reg }; delete p.page; delete p.view; return p; };
  const activeCount = (f) => { const n = S(() => countActive(f), null); return (n != null ? n : ((f.pt || []).length ? 1 : 0) + ((f.m || []).length ? 1 : 0) + ((f.n || []).length ? 1 : 0) + (f.pmin ? 1 : 0) + (f.pmax ? 1 : 0) + (f.amin ? 1 : 0) + (f.amax ? 1 : 0) + ((f.ro || []).length ? 1 : 0) + ((f.co || []).length ? 1 : 0) + (f.reg ? 1 : 0) + (f.am || []).length + (f.c ? 1 : 0)) - (f.c ? 1 : 0); };
  const goHash = (path, params) => { const ok = S(() => { setHash(path, params); return true; }, false); if (!ok) { const u = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) return; u.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v)); }); const s = u.toString(); location.hash = '#' + path + (s ? '?' + s : ''); } };

  /* ───────── stanje stranice ───────── */
  const st = { f: readFilters(qf), mode: isBudgetParam ? 'budget' : 'pins', b: +q.get('b') || 0 };
  const cityOf = (s) => (KV.cities || []).find((c) => c.s === s) || null;
  const munOf = (s) => (KV.muns || []).find((m) => m.s === s) || null;
  if (!st.f.c && st.f.m.length) { const mun = munOf(st.f.m[0]); if (mun) st.f.c = mun.cs; }
  if (!st.f.c) { /* grad sa najviše oglasa za zadate filtere */
    const cnt = new Map(); runFilters({ ...st.f, c: '', m: [], n: [] }).forEach((l) => cnt.set(l.cs, (cnt.get(l.cs) || 0) + 1)); let best = 'beograd', mx = -1; cnt.forEach((n, cs) => { if (n > mx) { mx = n; best = cs; } }); st.f.c = best;
  }
  const listings = () => runFilters(st.f);
  const writeHash = () => {
    const p = { ...toParams(st.f) };
    if (st.mode === 'budget') { delete p.m; p.m = 'budzet'; if (st.b) p.b = st.b; }
    const u = new URLSearchParams(); Object.entries(p).forEach(([k, v]) => { if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) return; u.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v)); });
    const s = u.toString().replace(/%2C/g, ','); S(() => history.replaceState(null, '', '#/mapa' + (s ? '?' + s : '')));
  };

  /* ───────── DOM kostur ───────── */
  const root = E('section', { class: 'mp', 'data-mode': st.mode, 'aria-label': 'Mapa oglasa' });
  const mapWrap = E('div', { class: 'mp-map' });
  const mapBox = E('div', { class: 'map' });
  mapWrap.appendChild(mapBox);
  const drawer = E('aside', { class: 'mp-drawer', 'aria-label': 'Oglasi u prikazu' });
  const drawerHd = E('div', { class: 'hd' }); const drawerBd = E('div', { class: 'bd' });
  drawer.append(drawerHd, drawerBd);
  const carousel = E('div', { class: 'mp-carousel', 'aria-label': 'Oglasi u prikazu', role: 'list' });
  const top = E('div', { class: 'mp-top' });
  root.append(mapWrap, top, drawer, carousel);

  /* ───────── lokacija: autocomplete nad gradovima → opštinama → naseljima ───────── */
  const AC = (() => {
    const out = [];
    (KV.cities || []).forEach((c) => out.push({ kind: 'Grad', label: c.n, cs: c.s, n: c.c || 0, ico: 'building' }));
    (KV.muns || []).forEach((m) => { const c = cityOf(m.cs); out.push({ kind: 'Opština · ' + (c ? c.n : m.cs), label: m.n, cs: m.cs, ms: m.s, n: m.c || 0, ico: 'pin' }); });
    const nb = new Map(); (KV.listings || []).forEach((l) => { if (!l.ns || !l.n) return; const k = l.cs + '/' + l.ns; const e = nb.get(k) || { kind: 'Naselje · ' + (l.m || l.c), label: l.n, cs: l.cs, ms: l.ms, ns: l.ns, n: 0, ico: 'home' }; e.n++; nb.set(k, e); });
    nb.forEach((e) => out.push(e));
    out.forEach((it) => { it.key = fold(it.label); });
    return out;
  })();
  const locLabel = () => { if (st.f.n.length) { const it = AC.find((a) => a.ns === st.f.n[0] && a.cs === st.f.c); return it ? it.label : st.f.n[0]; } if (st.f.m.length) { const m = munOf(st.f.m[0]); return m ? m.n : st.f.m[0]; } const c = cityOf(st.f.c); return c ? c.n : ''; };
  const locInput = E('input', { class: 'input', type: 'text', role: 'combobox', 'aria-label': 'Lokacija', placeholder: 'Grad, opština ili naselje', autocomplete: 'off', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'mp-ac', 'aria-haspopup': 'listbox', value: locLabel() });
  const acList = E('div', { class: 'mp-ac', id: 'mp-ac', role: 'listbox', hidden: true });
  const clrBtn = E('button', { class: 'iconbtn clr', type: 'button', 'aria-label': 'Obriši lokaciju', onclick: () => { locInput.value = ''; locInput.focus(); openAc(''); } }, icon('x', 16));
  const locBox = E('div', { class: 'mp-loc' }, E('div', { class: 'input-wrap' }, icon('search', 16), locInput), clrBtn, acList);
  let acItems = [], acIdx = -1;
  function openAc(text) {
    const key = fold(text.trim()); acItems = []; acList.innerHTML = ''; acIdx = -1;
    const pool = key ? AC.filter((a) => a.key.includes(key)) : AC.filter((a) => a.kind === 'Grad' && a.n >= 8);
    pool.sort((a, b) => (key ? (b.key.startsWith(key) - a.key.startsWith(key)) : 0) || b.n - a.n);
    acItems = pool.slice(0, 12);
    if (!acItems.length) acList.appendChild(E('div', { class: 'none' }, 'Nema takve lokacije. Probaj „Vračar”, „Novi Sad” ili „Liman”.'));
    acItems.forEach((it, i) => acList.appendChild(E('button', { type: 'button', role: 'option', id: 'mp-ac-' + i, 'aria-selected': 'false', onclick: () => pickLoc(it) }, icon(it.ico, 15), E('span', {}, it.label), E('span', { class: 'k' }, `${it.kind} · ${oglasa(it.n)}`))));
    acList.hidden = false; locInput.setAttribute('aria-expanded', 'true');
  }
  function closeAc() { acList.hidden = true; locInput.setAttribute('aria-expanded', 'false'); locInput.removeAttribute('aria-activedescendant'); acIdx = -1; }
  function moveAc(d) { if (acList.hidden) { openAc(locInput.value); return; } const n = acItems.length; if (!n) return; acIdx = (acIdx + d + n) % n; [...acList.querySelectorAll('[role=option]')].forEach((b, i) => b.setAttribute('aria-selected', i === acIdx ? 'true' : 'false')); locInput.setAttribute('aria-activedescendant', 'mp-ac-' + acIdx); }
  function pickLoc(it) {
    st.f.c = it.cs; st.f.m = it.ms ? [it.ms] : []; st.f.n = it.ns ? [it.ns] : [];
    locInput.value = it.label; closeAc(); refresh(true);
  }
  locInput.addEventListener('input', () => openAc(locInput.value));
  locInput.addEventListener('focus', () => { locInput.select(); openAc(locInput.value); });
  locInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveAc(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); moveAc(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = acItems[acIdx >= 0 ? acIdx : 0]; if (it) pickLoc(it); }
    else if (e.key === 'Escape') { closeAc(); locInput.value = locLabel(); }
  });
  locInput.addEventListener('blur', () => setTimeout(() => { if (!locBox.contains(document.activeElement)) { closeAc(); if (!locInput.value.trim()) locInput.value = locLabel(); } }, 120));

  /* ───────── gornja traka: Nacrtaj zonu · Filteri N · Oglasi/Budžet ───────── */
  const drawBtn = E('button', { class: 'btn btn-secondary', type: 'button', 'aria-pressed': 'false', onclick: () => { if (!map) return; if (map.isDrawing()) map.cancelDraw(); else if (map.getPolygon()) map.clearZone(); else map.startDraw(); } }, icon('draw', 16), E('span', {}, 'Nacrtaj zonu'));
  const filtBtn = S(() => UI.filterChip('Filteri', { n: activeCount(st.f), filters: true, icon: 'filter', onClick: openFilters }), null) || E('button', { class: 'chip chip-filters', type: 'button', onclick: openFilters }, 'Filteri');
  const modeSeg = S(() => UI.segmented([{ v: 'pins', l: 'Oglasi' }, { v: 'budget', l: 'Budžet' }], st.mode, (v) => switchMode(v)), null);
  const chips = E('div', { class: 'mp-chips' });
  top.append(locBox, drawBtn, filtBtn, modeSeg, chips);
  function switchMode(v) { if (v === st.mode) return; st.mode = v; root.dataset.mode = v; writeHash(); if (v === 'budget') enterBudget(); else leaveBudget(); }
  function paintFilterBtn() { const n = activeCount(st.f); const nEl = filtBtn.querySelector('.n'); if (nEl) nEl.textContent = String(n); else if (n) filtBtn.appendChild(E('span', { class: 'n' }, String(n))); if (nEl && !n) nEl.remove(); }
  function paintChips() {
    chips.innerHTML = '';
    const add = (label, onRemove) => chips.appendChild(S(() => UI.chip(label, onRemove), null) || E('span', { class: 'tag' }, label, E('button', { type: 'button', 'aria-label': 'Ukloni ' + label, onclick: onRemove }, icon('x', 14))));
    if (st.f.n.length) add(locLabel(), () => { st.f.n = []; locInput.value = locLabel(); refresh(true); });
    else if (st.f.m.length) add(locLabel(), () => { st.f.m = []; locInput.value = locLabel(); refresh(true); });
    if (st.f.pt.length) add(st.f.pt.map((v) => (TYPES_.find((x) => x.v === v) || { l: v }).l).join(', '), () => { st.f.pt = []; refresh(true); });
    if (st.f.pmax) add('do ' + nf0.format(+st.f.pmax) + ' €', () => { st.f.pmax = ''; refresh(true); });
    if (st.f.pmin) add('od ' + nf0.format(+st.f.pmin) + ' €', () => { st.f.pmin = ''; refresh(true); });
    if (st.f.ro.length) add('sobe: ' + st.f.ro.map((r) => String(r).replace('.', ',')).join(', '), () => { st.f.ro = []; refresh(true); });
    if (st.f.co.length) add(st.f.co.map((v) => COND_[v] || v).join(', '), () => { st.f.co = []; refresh(true); });
    if (st.f.reg) add('uknjiženo', () => { st.f.reg = false; refresh(true); });
  }

  /* ───────── filteri: donji list sa kompaktnom formom ───────── */
  function openFilters() {
    const d = { ...st.f, pt: [...st.f.pt], ro: [...st.f.ro], co: [...st.f.co], am: [...st.f.am], m: [...st.f.m], n: [...st.f.n] };
    const grp = (t, ...kids) => E('div', { class: 'grp' }, E('div', { class: 't' }, t), ...kids);
    const num = (key, ph, suffix) => { const i = E('input', { class: 'input', type: 'text', inputmode: 'numeric', placeholder: ph, value: d[key] || '', 'aria-label': ph + ' ' + suffix, oninput: () => { d[key] = i.value.replace(/[^\d]/g, ''); live(); } }); return E('div', { class: 'input-wrap' }, i, E('span', { class: 'suffix' }, suffix)); };
    const liveBtn = E('button', { class: 'btn btn-ink', type: 'button', onclick: () => apply() });
    const count = () => runFilters(d).length;
    let t; const live = () => { clearTimeout(t); t = setTimeout(() => { const n = count(); liveBtn.textContent = n ? `Prikaži ${oglasa(n)}` : 'Nema oglasa'; liveBtn.disabled = !n; }, 120); };
    const roomsOpts = [{ v: 0.5, l: 'Garsonjera' }, { v: 1, l: '1' }, { v: 1.5, l: '1,5' }, { v: 2, l: '2' }, { v: 2.5, l: '2,5' }, { v: 3, l: '3' }, { v: '4+', l: '4+' }];
    const roomsSel = d.ro.map((r) => (typeof r === 'string' ? r : +r));
    const setRooms = (arr) => { d.ro = arr.map((v) => (v === '4+' ? '4+' : +v)); live(); };
    const body = E('div', {},
      grp('Vrsta', S(() => UI.segmented([{ v: 'prodaja', l: 'Prodaja' }, { v: 'izdavanje', l: 'Izdavanje' }], d.t, (v) => { d.t = v; live(); }), null)),
      grp('Tip', S(() => UI.pills([{ v: '', l: 'Sve' }, ...TYPES_.map((x) => ({ v: x.v, l: x.l }))], d.pt.length ? d.pt : [''], (v) => { d.pt = v ? [v] : []; live(); }, { single: true }), null)),
      grp('Cena', E('div', { class: 'range-inputs' }, num('pmin', 'Od', '€'), num('pmax', 'Do', '€'))),
      grp('Kvadratura', E('div', { class: 'range-inputs' }, num('amin', 'Od', 'm²'), num('amax', 'Do', 'm²'))),
      grp('Sobe', S(() => UI.pills(roomsOpts, roomsSel, (v, on, all) => setRooms(all)), null)),
      grp('Stanje', S(() => UI.pills(Object.entries(COND_).map(([v, l]) => ({ v, l })), d.co, (v, on, all) => { d.co = all; live(); }), null)),
      grp('Dodatno',
        S(() => UI.check('Samo uknjiženo', d.reg, (on) => { d.reg = on; live(); }), null),
        S(() => UI.check('Lift', d.am.includes('hasElevator'), (on) => { d.am = d.am.filter((k) => k !== 'hasElevator'); if (on) d.am.push('hasElevator'); live(); }), null),
        S(() => UI.check('Parking ili garaža', d.am.includes('hasParking'), (on) => { d.am = d.am.filter((k) => k !== 'hasParking'); if (on) d.am.push('hasParking'); live(); }), null),
        S(() => UI.check('Terasa ili balkon', d.am.includes('hasBalcony'), (on) => { d.am = d.am.filter((k) => k !== 'hasBalcony'); if (on) d.am.push('hasBalcony'); live(); }), null)));
    const clearBtn = E('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.f = { ...DEF, t: d.t, c: st.f.c, pt: [], m: [], n: [], ro: [], co: [], he: [], fu: [], am: [] }; sheet.close(); locInput.value = locLabel(); refresh(true); } }, 'Obriši sve');
    live();
    const sheet = S(() => UI.sheet('Filteri', body, { footer: [clearBtn, liveBtn] }), null);
    if (!sheet) return;
    function apply() { st.f = d; sheet.close(); refresh(true); }
  }

  /* ───────── mapa ───────── */
  let map = null, list = [], visible = [], selected = null, hoverRow = null, areaCommitted = null;
  const rows = new Map(), slides = new Map();
  function makeMap() {
    list = listings();
    map = mapView(mapBox, {
      listings: list, city: st.f.c, mode: st.mode, drawTool: true, drawButton: false, legend: true, showAreaButton: true,
      onSelect: (slug) => { selected = slug; if (st.mode === 'pins' && slug && !isDesk() && !slides.has(slug)) updateLists(); paintSelected(); if (st.mode === 'budget') paintBudgetList(); },
      onHover: (slug) => syncHover(slug),
      onBoundsChange: (b) => { areaCommitted = b; if (b.polygon) toastSafe(`Nacrtana zona · ${oglasa(b.count)}`); else toastSafe(`U ovom području: ${oglasa(map.getVisible().length)}`); updateLists(); },
      onViewChange: () => { clearTimeout(viewT); viewT = setTimeout(updateLists, 80); },
      onDraw: (s) => { drawBtn.setAttribute('aria-pressed', s === 'drawing' ? 'true' : 'false'); drawBtn.lastChild.textContent = s === 'drawing' ? 'Crtam…' : s === 'zone' ? 'Obriši zonu' : 'Nacrtaj zonu'; },
      onArea: (row) => { budgetSel = row.key; paintBudgetList(); },
    });
    mapBox.addEventListener('pointerdown', () => closeAc());
    if (st.mode === 'budget') enterBudget();
    updateLists();
  }
  let viewT = 0;
  function refresh(hash) {
    list = listings(); selected = null; areaCommitted = null;
    paintFilterBtn(); paintChips(); if (hash) writeHash();
    root.dataset.empty = list.length ? '0' : '1';
    if (map) { map.setListings(list); map.fit(); if (st.mode === 'budget') enterBudget(); }
    updateLists();
  }
  const isDesk = () => window.matchMedia('(min-width:1101px)').matches;
  function updateLists() {
    if (!map) return;
    if (st.mode === 'budget') { paintBudgetList(); return; }
    visible = map.getVisible();
    const total = map.getFiltered().length;
    const note = root.querySelector('.mp-note'); if (note) note.remove();
    if (!list.length) {
      root.appendChild(E('div', { class: 'mp-note', role: 'status' }, E('h3', {}, 'Nema oglasa za ove filtere'), E('p', {}, 'Probaj širu lokaciju ili skini neki filter.'),
        E('button', { class: 'btn btn-ink', type: 'button', onclick: () => { st.f = { ...DEF, t: st.f.t, c: st.f.c, pt: [], m: [], n: [], ro: [], co: [], he: [], fu: [], am: [] }; locInput.value = locLabel(); refresh(true); } }, 'Poništi filtere')));
    }
    /* fioka */
    drawerHd.innerHTML = ''; drawerBd.innerHTML = ''; rows.clear();
    const polyN = map.getPolygon() ? ` · zona` : '';
    drawerHd.append(E('div', {}, E('h2', {}, visible.length ? `${oglasa(visible.length)} u prikazu` : 'Ništa u prikazu'), E('p', {}, `${oglasa(total)} za filtere${polyN} · pomeri mapu za druge`)));
    if (isDesk()) {
      const frag = document.createDocumentFragment();
      visible.slice(0, 60).forEach((l) => {
        const r = S(() => UI.card(l, 'list'), null) || E('article', { class: 'row', 'data-slug': l.s }, E('div', { class: 'body' }, E('h3', {}, E('a', { href: '#/oglas?s=' + l.s }, l.ti))));
        r.addEventListener('mouseenter', () => map.highlight(l.s)); r.addEventListener('mouseleave', () => map.highlight(null));
        r.addEventListener('click', (e) => { if (e.target.closest('a,button')) return; map.setSelected(l.s); selected = l.s; paintSelected(); });
        rows.set(l.s, r); frag.appendChild(r);
      });
      if (visible.length > 60) frag.appendChild(E('p', { class: 'more' }, `Prikazano prvih 60 od ${visible.length}. Približi mapu da vidiš ostale.`));
      if (!visible.length && list.length) frag.appendChild(S(() => UI.empty('Pomeri mapu', 'Nijedan oglas nije u ovom delu mape.', 'Prikaži sve', null, { onClick: () => map.fit() }), null) || E('p', { class: 'more' }, 'Nijedan oglas nije u ovom delu mape.'));
      drawerBd.appendChild(frag);
    }
    /* karusel */
    carousel.innerHTML = ''; slides.clear();
    if (!isDesk()) {
      const sorted = [...visible].sort((a, b) => a.lng - b.lng); const si = selected ? sorted.findIndex((l) => l.s === selected) : -1;
      const from = si < 0 ? 0 : Math.max(0, Math.min(si - 20, sorted.length - 40)); const items = sorted.slice(from, from + 40);
      items.forEach((l) => {
        const c = S(() => UI.card(l, 'compact'), null) || E('article', { class: 'row-c' }, E('h3', {}, l.ti));
        const s = E('div', { class: 'mp-slide', role: 'listitem', 'data-slug': l.s }, c);
        s.addEventListener('click', (e) => { if (e.target.closest('a,button')) return; map.setSelected(l.s); selected = l.s; paintSelected(); });
        slides.set(l.s, s); carousel.appendChild(s);
      });
    }
    root.dataset.empty = visible.length ? '0' : '1';
    measureCar(); paintSelected(false);
  }
  function measureCar() { requestAnimationFrame(() => { const h = carousel.offsetHeight; if (h > 40) root.style.setProperty('--mp-car', h + 'px'); }); }
  function paintSelected(scroll = true) {
    rows.forEach((r, s) => r.classList.toggle('on', s === selected));
    slides.forEach((r, s) => r.classList.toggle('on', s === selected));
    if (!selected || !scroll) return;
    const r = rows.get(selected); if (r) r.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    const sl = slides.get(selected); if (sl) { carScrolling = true; carousel.scrollTo({ left: sl.offsetLeft - (carousel.clientWidth - sl.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth' }); clearTimeout(carT); carT = setTimeout(() => { carScrolling = false; }, 500); }
  }
  function syncHover(slug) {
    if (hoverRow) hoverRow.classList.remove('hl'); hoverRow = null;
    if (!slug) return; const r = rows.get(slug); if (!r) return;
    r.classList.add('hl'); hoverRow = r; r.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }
  let carScrolling = false, carT = 0, carEnd = 0;
  carousel.addEventListener('scroll', () => {
    if (carScrolling) return; clearTimeout(carEnd);
    carEnd = setTimeout(() => {
      const mid = carousel.scrollLeft + carousel.clientWidth / 2; let best = null, bd = Infinity;
      slides.forEach((s, slug) => { const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = slug; } });
      if (best && best !== selected) { selected = best; if (map) map.setSelected(best); paintSelected(false); }
    }, 140);
  }, { passive: true });

  /* ───────── režim budžeta ───────── */
  let budgetBar = null, budgetRows = [], budgetSel = null, netInfo = null;
  const isRent = () => st.f.t === 'izdavanje';
  const budgetDefault = () => (isRent() ? 500 : 100000);
  const budgetRange = () => (isRent() ? [150, 2000, 50] : [30000, 500000, 5000]);
  const budgetPt = () => (st.f.pt[0] || 'stan');
  const netOf = (B) => { if (isRent()) return { net: B, costs: 0 }; const kx = S(() => (window.KX && KX.netForBudget ? KX.netForBudget(B, { t: st.f.t, pt: budgetPt() }) : null), null); const net = typeof kx === 'number' ? kx : (kx && typeof kx.net === 'number' ? kx.net : Math.max(0, (B - 45) / 1.054)); return { net: Math.round(net), costs: Math.round(B - net) }; };
  const median = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function computeBudget() {
    const B = st.b || budgetDefault(); const { net, costs } = netOf(B); netInfo = { B, net, costs };
    let rows = S(() => (window.KX && KX.budgetMap ? KX.budgetMap(B, { t: st.f.t, pt: budgetPt(), cs: st.f.c }) : null), null);
    if (rows && rows.length) {
      if (typeof rows.net === 'number' && !isRent()) netInfo = { B, net: Math.round(rows.net), costs: Math.round(B - rows.net) };
      rows = rows.filter((r) => r.cs === st.f.c);
      /* KX: n = ukupno oglasa u kraju, count = u budžetu */
      if (rows.length) return rows.map((r) => ({ ...r, label: r.label || r.key, total: r.n, n: r.count != null ? r.count : r.n, m2: r.m2 || 0, ppm: r.ppm || 0 }));
    }
    const pool = (KV.listings || []).filter((l) => l.cs === st.f.c && l.t === st.f.t && l.pt === budgetPt() && l.ppm > 0 && typeof l.lat === 'number');
    const byMs = new Map(); pool.forEach((l) => { const k = l.ms || l.ns || st.f.c; const e = byMs.get(k) || { key: k, label: l.m || l.n || l.c, cs: l.cs, lat: 0, lng: 0, n0: 0, ppms: [], ps: [] }; e.lat += l.lat; e.lng += l.lng; e.n0++; e.ppms.push(l.ppm); e.ps.push(l.p); byMs.set(k, e); });
    const out = [];
    byMs.forEach((e) => { const ok = e.n0 >= 3; const ppm = ok ? median(e.ppms) : 0; out.push({ key: e.key, label: e.label, cs: e.cs, lat: e.lat / e.n0, lng: e.lng / e.n0, m2: ok && ppm ? Math.round(net / ppm) : 0, n: e.ps.filter((p) => p <= net).length, total: e.n0, ppm: Math.round(ppm), scope: 'mun' }); });
    if (out.length === 1 || (out.length && out.every((r) => !r.m2))) { /* mali grad: jedan krug za ceo grad */
      const city = cityOf(st.f.c); const ppm = median(pool.map((l) => l.ppm)); if (city && pool.length >= 3) return [{ key: st.f.c, label: city.n, cs: st.f.c, lat: city.lat, lng: city.lng, m2: ppm ? Math.round(net / ppm) : 0, n: pool.filter((l) => l.p <= net).length, total: pool.length, ppm: Math.round(ppm), scope: 'city' }];
    }
    return out.sort((a, b) => b.m2 - a.m2);
  }
  function enterBudget() {
    if (!map) return;
    if (!st.b) st.b = budgetDefault();
    budgetRows = computeBudget(); budgetSel = null;
    map.setMode('budget'); map.setBudget(budgetRows);
    if (!budgetBar) { budgetBar = buildBudgetBar(); root.appendChild(budgetBar); }
    top.hidden = true; paintBudgetBar(); paintBudgetList();
  }
  function leaveBudget() { if (!map) return; if (budgetBar) { budgetBar.remove(); budgetBar = null; } top.hidden = false; map.setMode('pins'); map.fit(); updateLists(); }
  let bInput = null, bRange = null, bNet = null, bCity = null;
  function buildBudgetBar() {
    const [mn, mx, step] = budgetRange();
    bInput = E('input', { class: 'input', type: 'text', inputmode: 'numeric', 'aria-label': 'Budžet u evrima', value: nf0.format(st.b) });
    bInput.addEventListener('change', () => { const v = +String(bInput.value).replace(/[^\d]/g, ''); if (v > 0) { st.b = Math.min(mx * 4, Math.max(mn / 3, v)); } bInput.value = nf0.format(st.b); onBudget(); });
    bRange = E('input', { type: 'range', min: mn, max: mx, step, value: Math.min(mx, Math.max(mn, st.b)), 'aria-label': 'Budžet (klizač)' });
    let rt; bRange.addEventListener('input', () => { st.b = +bRange.value; bInput.value = nf0.format(st.b); clearTimeout(rt); rt = setTimeout(onBudget, 60); });
    const cityOpts = (KV.cities || []).filter((c) => (KV.listings || []).filter((l) => l.cs === c.s && l.t === st.f.t && l.pt === budgetPt()).length >= 3).map((c) => ({ v: c.s, l: c.n }));
    if (!cityOpts.some((o) => o.v === st.f.c)) cityOpts.unshift({ v: st.f.c, l: (cityOf(st.f.c) || { n: st.f.c }).n });
    const pickCity = (v) => { st.f.c = v; st.f.m = []; st.f.n = []; locInput.value = locLabel(); refresh(true); };
    bCity = S(() => UI.select(cityOpts, st.f.c, pickCity, { label: 'Grad' }), null) || E('select', { class: 'input select', onchange: (e) => pickCity(e.target.value) }, cityOpts.map((o) => E('option', { value: o.v, selected: o.v === st.f.c }, o.l)));
    bNet = E('p', { class: 'net' });
    const seg = S(() => UI.segmented([{ v: 'prodaja', l: 'Kupujem' }, { v: 'izdavanje', l: 'Iznajmljujem' }], st.f.t, (v) => { st.f.t = v; st.b = budgetDefault(); const [a, b, s] = budgetRange(); bRange.min = a; bRange.max = b; bRange.step = s; bRange.value = st.b; bInput.value = nf0.format(st.b); refresh(true); }), null);
    return E('div', { class: 'mp-budget', role: 'region', 'aria-label': 'Budžet' },
      E('h1', {}, 'Imaš ', E('em', {}, nf0.format(st.b) + ' €'), '? Vidi šta kupuje.'),
      E('div', { class: 'row2' }, E('div', { class: 'input-wrap' }, bInput, E('span', { class: 'suffix' }, isRent() ? '€/mes' : '€')), bCity),
      bRange, bNet,
      E('p', { class: 'note' }, 'Krug = opština, broj = m² koje tvoj budžet kupuje po medijani €/m² u toj opštini. Procena iz oglasa na Kvadratu, ne iz katastra.'),
      E('div', { class: 'foot' }, seg, E('button', { class: 'back', type: 'button', onclick: () => { modeSeg && modeSeg.set && modeSeg.set('pins'); switchMode('pins'); } }, icon('arrow-left', 14), 'Nazad na oglase')));
  }
  function onBudget() { writeHash(); budgetRows = computeBudget(); map.setBudget(budgetRows); paintBudgetBar(); paintBudgetList(); }
  function paintBudgetBar() {
    if (!budgetBar || !netInfo) return;
    budgetBar.querySelector('h1 em').textContent = nf0.format(netInfo.B) + (isRent() ? ' €/mes' : ' €');
    bNet.innerHTML = '';
    if (isRent()) bNet.append(E('b', {}, nf0.format(netInfo.B) + ' €/mes'), ' kirije · za useljenje ti treba još oko ', E('b', {}, nf0.format(Math.round(netInfo.B * 1.5)) + ' €'), ' (depozit i pola provizije).');
    else bNet.append(E('b', {}, nf0.format(netInfo.B) + ' €'), ' = ', E('b', {}, '~' + nf0.format(netInfo.net) + ' €'), ' za stan ', E('span', {}, `(oko ${nf0.format(netInfo.costs)} € ode na porez 2,5 %, proviziju i overu)`));
  }
  function paintBudgetList() {
    if (st.mode !== 'budget' || !netInfo) return;
    const rowsB = [...budgetRows].sort((a, b) => b.m2 - a.m2); const max = Math.max(1, ...rowsB.map((r) => r.m2 || 0));
    drawerHd.innerHTML = ''; drawerBd.innerHTML = ''; carousel.innerHTML = ''; rows.clear(); slides.clear();
    const city = cityOf(st.f.c); const withData = rowsB.filter((r) => r.m2 > 0);
    drawerHd.append(E('div', {}, E('h2', {}, `${city ? city.n : ''} · ${nf0.format(netInfo.B)} €`), E('p', {}, withData.length > 1 ? `${withData.length} opština sa dovoljno oglasa · sortirano po m²` : rowsB.length ? `Za ${city ? city.loc || city.n : 'ovaj grad'} imamo malo oglasa — prikazujemo prosek grada.` : 'Nema dovoljno oglasa za ovaj grad.')));
    const searchBtn = (r) => E('button', { class: 'btn btn-ink btn-sm', type: 'button', onclick: () => goHash('/pretraga', r.scope === 'city' ? { t: st.f.t, pt: [budgetPt()], c: r.cs || st.f.c, pmax: netInfo.net, sort: 'p-asc' } : { t: st.f.t, pt: [budgetPt()], c: st.f.c, m: [r.key], pmax: netInfo.net, sort: 'p-asc' }) }, icon('search', 16), `Pretraži u ${r.scope === 'city' ? 'gradu' : 'kraju'} · ${oglasa(r.n)}`);
    const meta = (r) => (r.m2 > 0 ? `${oglasa(r.n)} u budžetu · medijan ${nf0.format(r.ppm)} €/m²` : `samo ${oglasa(r.total || 0)} — malo podataka`);
    if (isDesk()) {
      rowsB.forEach((r) => {
        const b = E('button', { class: 'mp-brow' + (budgetSel === r.key ? ' on' : ''), type: 'button', 'aria-pressed': budgetSel === r.key ? 'true' : 'false', onclick: () => { budgetSel = r.key; map.setSelected(r.key); paintBudgetList(); } },
          E('b', {}, r.label), E('span', { class: 'm2' + (r.m2 > 0 ? '' : ' none') }, r.m2 > 0 ? `${nf0.format(r.m2)} m²` : '—'), E('p', {}, meta(r)), E('span', { class: 'bar' }, E('i', { style: `width:${Math.round((r.m2 / max) * 100)}%` })));
        b.addEventListener('mouseenter', () => map.highlight(r.key)); b.addEventListener('mouseleave', () => map.highlight(null));
        rows.set(r.key, b); drawerBd.appendChild(b);
        if (budgetSel === r.key) drawerBd.appendChild(E('div', { class: 'barea' }, searchBtn(r)));
      });
    } else {
      rowsB.forEach((r) => {
        const s = E('div', { class: 'mp-slide' + (budgetSel === r.key ? ' on' : ''), role: 'listitem', 'data-slug': r.key },
          E('div', { class: 'area' }, E('b', {}, r.label), E('span', { class: 'm2' }, r.m2 > 0 ? `${nf0.format(r.m2)} m²` : '—'), E('p', {}, meta(r)), searchBtn(r)));
        s.addEventListener('click', (e) => { if (e.target.closest('a,button')) return; budgetSel = r.key; map.setSelected(r.key); paintBudgetList(); });
        slides.set(r.key, s); carousel.appendChild(s);
      });
      const sl = slides.get(budgetSel); if (sl) { carScrolling = true; carousel.scrollTo({ left: sl.offsetLeft - (carousel.clientWidth - sl.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth' }); clearTimeout(carT); carT = setTimeout(() => { carScrolling = false; }, 500); }
    }
    root.dataset.empty = rowsB.length ? '0' : '1';
    measureCar();
  }
  carousel.addEventListener('scroll', () => {
    if (st.mode !== 'budget' || carScrolling) return; clearTimeout(carEnd);
    carEnd = setTimeout(() => { const mid = carousel.scrollLeft + carousel.clientWidth / 2; let best = null, bd = Infinity; slides.forEach((s, k) => { const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = k; } }); if (best && best !== budgetSel) { budgetSel = best; map.setSelected(best); slides.forEach((s, k) => s.classList.toggle('on', k === best)); } }, 140);
  }, { passive: true });

  /* ───────── start: mapa se pravi kad je element u dokumentu i ima dimenzije ───────── */
  paintFilterBtn(); paintChips();
  const boot = () => { if (map) return; if (!root.isConnected || !mapBox.clientWidth) { setTimeout(boot, 40); return; } makeMap(); };
  setTimeout(boot, 0);
  let lastDesk = null; const mq = window.matchMedia('(min-width:1101px)');
  const onMq = () => { const d = mq.matches; if (lastDesk !== null && d !== lastDesk) updateLists(); lastDesk = d; };
  mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq); onMq();
  const mo = new MutationObserver(() => { if (!root.isConnected) { mo.disconnect(); mq.removeEventListener ? mq.removeEventListener('change', onMq) : mq.removeListener(onMq); if (map) map.destroy(); map = null; } });
  setTimeout(() => { if (root.isConnected) mo.observe(document.body, { childList: true, subtree: true }); }, 0);
  return root;
}
window.viewMap = viewMap;
