/* Kvadrat.rs — stranica: mapa (viewMap(q)). Nacrt 6.4: mapa preko cele širine ispod zaglavlja, plutajuća pretraga
   (lokacija sa autocomplete-om, „Nacrtaj zonu”, pilula „Filteri N”, prekidač Oglasi · Budžet), zum kontrole, legenda,
   desna fioka (≥1100) sa .row karticama i sinhronizovanim hover-om, telefonski karusel kompaktnih kartica koji prati izabrani pin;
   režim m=budzet: traka „Imaš X €?” (podrazumevano ~40. percentil cena grada) + grad → opštine obojene po m² koje budžet kupuje, klik na kraj → prava pretraga.
   q: URLSearchParams — standardni filteri core.js (t, pt, c, m, n, pmin, pmax, amin, amax, ro, co, he, fu, am, reg, newbuild, q…),
   plus m=budzet (režim budžeta; tada se m ne tumači kao opštine) i b=budžet u €.
   Zavisi (meko, kroz guard-ove) od core.js (el, KV/D, applyFilters, paramsToFilters, filtersToParams, countActive, setHash, toast, TYPES, COND),
   ui.js (card, sheet, pills, segmented, select, filterChip, icon, chip, empty), engine.js (KX.budgetMap) i map.js (mapView). */
'use strict';

function viewMap(q) {
  const S = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  if (q == null || typeof q === 'string') { const c = q; q = new URLSearchParams(S(() => location.hash.split('?')[1], '') || ''); if (c && !q.get('c')) q.set('c', c); }
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
  const NB = '\u00a0'; /* broj i jedinica se ne razdvajaju u prelomu */
  const u = (n, unit) => nf0.format(n) + NB + unit;
  const HEAT_ = S(() => HEAT, null) || {}, FURN_ = S(() => FURN, null) || {};
  const AMEN_ = { ...(S(() => AMEN, null) || {}), hasElevator: 'Lift', hasParking: 'Parking ili garaža', hasBalcony: 'Terasa ili balkon' };
  const COND_ = S(() => COND, null) || { novogradnja: 'Novogradnja', lux: 'Lux', renovirano: 'Renovirano', 'dobro-stanje': 'Dobro stanje', 'potrebno-renoviranje': 'Potrebno renoviranje', 'u-izgradnji': 'U izgradnji' };

  /* ───────── filteri (core.js ugovor: FILTER_DEFAULTS — t, pt[], c, m[], n[], pmin…, ro[], co[], he[], fu[], am[], reg, newbuild, sort) ───────── */
  const DEF = { t: 'prodaja', pt: [], c: '', m: [], n: [], pmin: '', pmax: '', amin: '', amax: '', ro: [], flmin: '', flmax: '', notLast: false, ymin: '', ymax: '', co: [], he: [], fu: [], reg: false, newbuild: false, am: [], agency: '', advertiser: '', q: '', deltaMax: '', sort: 'rel', view: 'grid', page: 1 };
  const isBudgetParam = q.get('m') === 'budzet';
  const qf = new URLSearchParams(q); if (isBudgetParam) qf.delete('m'); qf.delete('b'); qf.delete('o'); qf.delete('k');
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
  const st = { f: readFilters(qf), mode: isBudgetParam ? 'budget' : 'pins', b: +q.get('b') || 0, bUser: +q.get('b') > 0, owner: q.get('o') === '1', credit: q.get('k') === '1' };
  const cityOf = (s) => (KV.cities || []).find((c) => c.s === s) || null;
  const munOf = (s) => (KV.muns || []).find((m) => m.s === s) || null;
  if (!st.f.c && st.f.m.length) { const mun = munOf(st.f.m[0]); if (mun) st.f.c = mun.cs; }
  if (!st.f.c) { /* grad sa najviše oglasa za zadate filtere */
    const cnt = new Map(); runFilters({ ...st.f, c: '', m: [], n: [] }).forEach((l) => cnt.set(l.cs, (cnt.get(l.cs) || 0) + 1)); let best = 'beograd', mx = -1; cnt.forEach((n, cs) => { if (n > mx) { mx = n; best = cs; } }); st.f.c = best;
  }
  const listings = () => runFilters(st.f);
  const writeHash = () => {
    const p = { ...toParams(st.f) };
    if (st.mode === 'budget') { delete p.m; p.m = 'budzet'; if (st.b && st.bUser) p.b = st.b; if (!isRent()) { if (st.owner) p.o = 1; if (st.credit) p.k = 1; } }
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
  const drawBtn = E('button', { class: 'btn btn-secondary mp-drawbtn', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Nacrtaj zonu', title: 'Nacrtaj zonu', onclick: () => { if (!map) return; if (map.isDrawing()) map.cancelDraw(); else if (map.getPolygon()) map.clearZone(); else map.startDraw(); } }, icon('draw', 16), E('span', {}, 'Nacrtaj zonu'));
  const filtBtn = S(() => UI.filterChip('Filteri', { n: activeCount(st.f), filters: true, icon: 'filter', onClick: openFilters }), null) || E('button', { class: 'chip chip-filters', type: 'button', onclick: openFilters }, 'Filteri');
  const modeSeg = S(() => UI.segmented([{ v: 'pins', l: 'Oglasi' }, { v: 'budget', l: 'Budžet' }], st.mode, (v) => switchMode(v)), null);
  const chips = E('div', { class: 'mp-chips' });
  top.append(locBox, drawBtn, filtBtn, modeSeg, chips);
  function switchMode(v) { if (v === st.mode) return; st.mode = v; root.dataset.mode = v; writeHash(); if (v === 'budget') enterBudget(); else leaveBudget(); }
  function paintFilterBtn() { const n = activeCount(st.f); const nEl = filtBtn.querySelector('.n'); if (nEl) nEl.textContent = String(n); else if (n) filtBtn.appendChild(E('span', { class: 'n' }, String(n))); if (nEl && !n) nEl.remove(); }
  function paintChips() {
    chips.innerHTML = '';
    const add = (label, onRemove) => chips.appendChild(S(() => UI.chip(label, onRemove), null) || E('span', { class: 'tag' }, label, E('button', { type: 'button', 'aria-label': 'Ukloni ' + label, onclick: onRemove }, icon('x', 14))));
    const clr = (patch) => () => { Object.assign(st.f, patch); refresh(true); };
    const has = (v) => v !== '' && v != null && !(typeof v === 'number' && isNaN(v));
    const f = st.f;
    if (f.n.length) add(locLabel(), () => { st.f.n = []; locInput.value = locLabel(); refresh(true); });
    else if (f.m.length) add(locLabel(), () => { st.f.m = []; locInput.value = locLabel(); refresh(true); });
    if (f.pt.length) add(f.pt.map((v) => (TYPES_.find((x) => x.v === v) || { l: v }).l).join(', '), clr({ pt: [] }));
    if (f.pmin) add('od ' + u(+f.pmin, '€'), clr({ pmin: '' }));
    if (f.pmax) add('do ' + u(+f.pmax, '€'), clr({ pmax: '' }));
    if (has(f.amin)) add('od ' + u(+f.amin, 'm²'), clr({ amin: '' }));
    if (has(f.amax)) add('do ' + u(+f.amax, 'm²'), clr({ amax: '' }));
    if (f.ro.length) add('sobe: ' + f.ro.map((r) => String(r).replace('.', ',')).join(', '), clr({ ro: [] }));
    if (has(f.flmin) || has(f.flmax)) add(`Sprat ${has(f.flmin) ? f.flmin : '…'}–${has(f.flmax) ? f.flmax : '…'}`, clr({ flmin: '', flmax: '' }));
    if (f.notLast) add('Nije poslednji sprat', clr({ notLast: false }));
    if (has(f.ymin) || has(f.ymax)) add(`Godina ${has(f.ymin) ? f.ymin : '…'}–${has(f.ymax) ? f.ymax : '…'}`, clr({ ymin: '', ymax: '' }));
    if (f.co.length) add(f.co.map((v) => COND_[v] || v).join(', '), clr({ co: [] }));
    (f.he || []).forEach((v) => add(HEAT_[v] || v, () => { st.f.he = st.f.he.filter((x) => x !== v); refresh(true); }));
    (f.fu || []).forEach((v) => add(FURN_[v] || v, () => { st.f.fu = st.f.fu.filter((x) => x !== v); refresh(true); }));
    if (f.reg) add('Uknjiženo', clr({ reg: false }));
    if (f.newbuild) add('Novogradnja', clr({ newbuild: false }));
    if (f.promo) add('Izdvojeni oglasi', clr({ promo: false }));
    (f.am || []).forEach((v) => add(AMEN_[v] || v, () => { st.f.am = st.f.am.filter((x) => x !== v); refresh(true); }));
    if (f.advertiser) add(f.advertiser === 'vlasnik' ? 'Od vlasnika' : 'Agencije', clr({ advertiser: '' }));
    if (f.agency) { const a = (KV.agencies || []).find((x) => x.s === f.agency); add(a ? a.n : f.agency, clr({ agency: '' })); }
    if (f.q) add(`„${f.q}”`, clr({ q: '' }));
    if (has(f.deltaMax)) add(`Δ do ${f.deltaMax} %`.replace(' %', NB + '%'), clr({ deltaMax: '' }));
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
        S(() => UI.check('Samo novogradnja', d.newbuild, (on) => { d.newbuild = on; live(); }), null),
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
  const isDesk = () => window.matchMedia('(min-width:1101px)').matches;
  const isPhone = () => window.matchMedia('(max-width:860px)').matches;
  /* plutajući chrome stranice → insets za mapView.fit (podaci se uklapaju u slobodan deo mape) */
  function chromeInsets() {
    const mb = mapBox.getBoundingClientRect(); if (!mb.width || !mb.height) return null;
    const W = mb.width, H = mb.height, desk = isDesk();
    const ins = { top: 0, right: 56, bottom: 0, left: 0 };
    let pr = null;
    if (st.mode === 'budget' && budgetBar) {
      const r = budgetBar.getBoundingClientRect(); const r2 = budgetBar.querySelector('.row2');
      /* na telefonu se računa sklopljena traka (proširenje „Podesi” privremeno prekriva mapu) */
      pr = { right: r.right, bottom: isPhone() && r2 ? r2.getBoundingClientRect().bottom + 12 : r.bottom };
    } else if (!top.hidden) {
      const kids = [...top.children].filter((n) => n.offsetHeight && !n.hidden);
      if (kids.length) { const rs = kids.map((n) => n.getBoundingClientRect()); pr = { right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) }; }
    }
    const lg = mapBox.querySelector('.mv-legend .legend'); const lgH = lg ? lg.getBoundingClientRect().height : 0;
    const expectCar = st.mode === 'budget' ? budgetRows.length > 0 : list.length > 0;
    const car = desk ? 0 : (carousel.childElementCount && carousel.offsetHeight > 40 ? carousel.offsetHeight : expectCar ? 170 : 0);
    ins.bottom = car + (lgH ? lgH + 16 : 8);
    if (pr) { /* panel odseca odozgo ili sleva — bira se strana koja ostavlja veći slobodan pravougaonik */
      const topCut = pr.bottom - mb.top + 8, leftCut = pr.right - mb.left + 8, hFree = H - ins.bottom;
      if (leftCut < W * 0.5 && (W - leftCut - ins.right) * hFree > (W - ins.right) * (hFree - topCut)) ins.left = leftCut; else ins.top = topCut;
    }
    return ins;
  }
  /* profil (Keš ili kredit, Moja mesta): kad postoje plata ili keš, pinovi van budžeta su na 55 %; mesta crtaju krugove 10/20/30 min */
  const prof = () => S(() => KX.profile.get(), null) || {};
  const hasMoney = (p) => (+p.income || 0) > 0 || (+p.partnerIncome || 0) > 0 || (+p.cash || 0) > 0;
  const vanClass = (l) => (l.t === 'prodaja' && S(() => KX.afford(l).state, '') === 'van-budzeta' ? 'mv-van' : '');
  function paintAfford() {
    if (!map || !map.setPinClass) return;
    const on = st.f.t === 'prodaja' && hasMoney(prof()) && !!S(() => KX.afford, null);
    map.setPinClass(on ? vanClass : null, on ? 'Van tvog budžeta' : '');
  }
  const offProfile = S(() => KX.profile.on(() => { if (!map) return; S(() => map.setPlaces(prof().places || [])); paintAfford(); }), null);
  function makeMap() {
    list = listings();
    if (typeof mapView !== 'function') { /* map.js nije učitan — stranica ne sme da pukne */
      root.dataset.empty = '1';
      root.appendChild(E('div', { class: 'mp-note', role: 'status' }, E('h3', {}, 'Mapa trenutno nije dostupna'), E('p', {}, 'Oglase i dalje možeš da pretražuješ kao listu.'), E('a', { class: 'btn btn-ink', href: '#/pretraga' }, 'Otvori pretragu')));
      return;
    }
    map = mapView(mapBox, {
      listings: list, city: st.f.c, mode: st.mode, drawTool: true, drawButton: false, legend: true, showAreaButton: true, insets: chromeInsets,
      places: S(() => KX.profile.get().places, []) || [],
      onSelect: (slug) => { selected = slug; if (st.mode === 'pins' && slug && !isDesk() && !slides.has(slug)) updateCarousel(true); paintSelected(); if (st.mode === 'budget') paintBudgetList(); },
      onHover: (slug) => syncHover(slug),
      onBoundsChange: (b) => { areaCommitted = b; if (b.polygon) toastSafe(`Nacrtana zona · ${oglasa(b.count)}`); else toastSafe(`U ovom području: ${oglasa(map.getVisible().length)}`); updateLists(true); },
      onViewChange: () => { clearTimeout(viewT); viewT = setTimeout(onSettle, 80); },
      onDraw: (s) => { const t = s === 'drawing' ? 'Crtam…' : s === 'zone' ? 'Obriši zonu' : 'Nacrtaj zonu'; drawBtn.setAttribute('aria-pressed', s === 'drawing' || s === 'zone' ? 'true' : 'false'); drawBtn.lastChild.textContent = t; drawBtn.setAttribute('aria-label', t); drawBtn.title = t; },
      onArea: (row) => { budgetSel = row.key; paintBudgetList(); },
    });
    mapBox.addEventListener('pointerdown', () => closeAc());
    paintAfford(); paintNote();
    if (st.mode === 'budget') enterBudget();
    else { updateLists(true); requestAnimationFrame(() => { if (map && st.mode === 'pins') { map.fit(); updateLists(true); } }); } /* drugi fit kad je karusel izmeren */
  }
  let viewT = 0;
  function refresh(hash) {
    list = listings(); selected = null; areaCommitted = null;
    paintFilterBtn(); paintChips(); if (hash) writeHash();
    root.dataset.empty = list.length ? '0' : '1';
    if (map) { map.setListings(list); paintAfford(); if (st.mode === 'budget') enterBudget(); else map.fit(); }
    paintNote(); updateLists(true);
  }
  function paintNote() {
    const note = root.querySelector('.mp-note'); if (note) note.remove();
    if (!map || list.length || st.mode === 'budget') return;
    root.appendChild(E('div', { class: 'mp-note', role: 'status' }, E('h3', {}, 'Nema oglasa za ove filtere'), E('p', {}, 'Probaj širu lokaciju ili skini neki filter.'),
      E('button', { class: 'btn btn-ink', type: 'button', onclick: () => { st.f = { ...DEF, t: st.f.t, c: st.f.c, pt: [], m: [], n: [], ro: [], co: [], he: [], fu: [], am: [] }; locInput.value = locLabel(); refresh(true); } }, 'Poništi filtere')));
  }
  /* posle smirivanja pogleda: fioka (desktop) se osvežava; karusel (telefon) samo kad je zastareo —
     nijedna kartica nije u kadru ili je izabrani oglas izašao iz kadra. Nikad dok korisnik vuče karusel. */
  function onSettle() {
    if (!map || st.mode !== 'pins') return;
    if (isDesk()) { updateDrawer(); return; }
    const vis = new Set(map.getVisible().map((l) => l.s));
    const stale = !slides.size ? vis.size > 0 : (![...slides.keys()].some((s) => vis.has(s)) || (selected && slides.has(selected) && !vis.has(selected)));
    if (stale) updateCarousel(false);
  }
  function updateLists(force) {
    if (!map) return;
    if (st.mode === 'budget') { paintBudgetList(); return; }
    updateDrawer(); updateCarousel(force);
  }
  function updateDrawer() {
    drawerHd.innerHTML = ''; drawerBd.innerHTML = ''; rows.clear(); hoverRow = null;
    if (!isDesk()) return;
    visible = map.getVisible();
    const total = map.getFiltered().length;
    const polyN = map.getPolygon() ? ` · zona` : '';
    drawerHd.append(E('div', {}, E('h2', {}, visible.length ? `${oglasa(visible.length)} u prikazu` : 'Ništa u prikazu'), E('p', {}, `${oglasa(total)} za filtere${polyN} · pomeri mapu za druge`)));
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
    root.dataset.empty = visible.length ? '0' : '1';
    paintSelected(false);
  }
  /* karusel: do 40 oglasa u kadru najbližih izabranom (ili centru), poređanih po geografskoj dužini (stabilno za isti skup);
     posle ponovne izgradnje izabrana kartica ostaje centrirana bez animacije */
  let carKey = '', carTouch = false, carPending = false;
  function updateCarousel(force) {
    if (st.mode !== 'pins' || !map) return;
    if (isDesk()) { if (slides.size || carousel.childElementCount) { carousel.innerHTML = ''; slides.clear(); carKey = ''; } return; }
    if (!force && (carScrolling || carTouch)) { carPending = true; return; }
    carPending = false;
    const vis = map.getVisible(); const filtered = map.getFiltered();
    const selL = selected ? filtered.find((l) => l.s === selected) : null;
    const ref = selL && vis.includes(selL) ? selL : map.getView();
    const cosl = Math.cos((ref.lat * Math.PI) / 180); const dd = (l) => (l.lat - ref.lat) ** 2 + ((l.lng - ref.lng) * cosl) ** 2;
    const pick = vis.length > 40 ? [...vis].sort((a, b) => dd(a) - dd(b)).slice(0, 40) : [...vis];
    if (selL && !pick.includes(selL) && force) pick.push(selL);
    pick.sort((a, b) => a.lng - b.lng || (a.s < b.s ? -1 : 1));
    const key = pick.map((l) => l.s).join('|');
    root.dataset.empty = pick.length ? '0' : '1';
    if (key === carKey) { paintSelected(false); return; }
    carKey = key; carousel.innerHTML = ''; slides.clear();
    pick.forEach((l) => {
      const c = S(() => UI.card(l, 'compact'), null) || E('article', { class: 'row-c' }, E('h3', {}, l.ti));
      const sl = E('div', { class: 'mp-slide', role: 'listitem', 'data-slug': l.s }, c);
      sl.addEventListener('click', (e) => { if (e.target.closest('a,button')) return; map.setSelected(l.s); selected = l.s; paintSelected(); });
      slides.set(l.s, sl); carousel.appendChild(sl);
    });
    measureCar(); paintSelected(false);
    const sl = selected && slides.get(selected);
    carScrolling = true; carousel.scrollTo({ left: sl ? sl.offsetLeft - (carousel.clientWidth - sl.offsetWidth) / 2 : 0, behavior: 'auto' });
    clearTimeout(carT); carT = setTimeout(() => { carScrolling = false; }, 200);
  }
  const touchOn = () => { carTouch = true; };
  const touchOff = () => { carTouch = false; if (carPending) setTimeout(() => { if (!carTouch && !carScrolling && carPending) onSettle(); }, 400); };
  carousel.addEventListener('touchstart', touchOn, { passive: true }); carousel.addEventListener('touchend', touchOff, { passive: true }); carousel.addEventListener('touchcancel', touchOff, { passive: true });
  carousel.addEventListener('pointerdown', touchOn); carousel.addEventListener('pointerup', touchOff); carousel.addEventListener('pointercancel', touchOff);
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
    if (st.mode !== 'pins' || carScrolling) return; clearTimeout(carEnd);
    carEnd = setTimeout(() => {
      const mid = carousel.scrollLeft + carousel.clientWidth / 2; let best = null, bd = Infinity;
      slides.forEach((s, slug) => { const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = slug; } });
      if (best && best !== selected) { selected = best; if (map) map.setSelected(best); paintSelected(false); }
    }, 140);
  }, { passive: true });

  /* ───────── režim budžeta ───────── */
  let budgetBar = null, budgetRows = [], budgetSel = null, netInfo = null;
  const isRent = () => st.f.t === 'izdavanje';
  const budgetRange = () => (isRent() ? [150, 2000, 50] : [30000, 500000, 5000]);
  const budgetPt = () => (st.f.pt[0] || 'stan');
  /* podrazumevani budžet po gradu: ~40. percentil cena (t, pt) u gradu, sa troškovima kupovine, zaokružen na 5.000 € (kirija na 50 €),
     tako da prvi prikaz ima krajeve sa oglasima u budžetu */
  const budgetDefault = () => {
    const ps = (KV.listings || []).filter((l) => l.cs === st.f.c && l.t === st.f.t && l.pt === budgetPt() && l.p > 0).map((l) => l.p).sort((a, b) => a - b);
    const [mn, mx] = budgetRange();
    if (ps.length < 3) return isRent() ? 500 : 100000;
    const p40 = ps[Math.floor(ps.length * 0.4)];
    return isRent() ? Math.min(mx, Math.max(mn, Math.ceil(p40 / 50) * 50)) : Math.min(mx, Math.max(mn, Math.ceil((p40 * 1.06) / 5000) * 5000));
  };
  const costOpts = () => ({ owner: !isRent() && st.owner, credit: !isRent() && st.credit });
  const netOf = (B) => { if (isRent()) return { net: B, costs: 0 }; const kx = S(() => (window.KX && KX.netForBudget ? KX.netForBudget(B, { t: st.f.t, pt: budgetPt(), ...costOpts() }) : null), null); const net = typeof kx === 'number' ? kx : (kx && typeof kx.net === 'number' ? kx.net : Math.max(0, (B - 45) / (st.owner ? 1.025 : 1.049))); return { net: Math.round(net), costs: Math.round(B - net) }; };
  /* struktura (ro) sužava medijane; kraj sa < 3 takva oglasa koristi sve strukture (i to piše) */
  const roOn = () => st.f.ro.length > 0;
  const roMatch = (l) => st.f.ro.some((r) => (typeof r === 'string' && r.endsWith('+') ? l.ro >= parseFloat(r) : l.ro === +r));
  const median = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function computeBudget() {
    const B = st.b || budgetDefault(); const { net, costs } = netOf(B); netInfo = { B, net, costs };
    /* engine (KX.budgetMap, prag ≥ 5 oglasa po opštini) ima prednost po ključu; lokalni redovi (prag 3, šuplji ispod) popunjavaju ostale opštine grada */
    let kx = roOn() ? null : S(() => (window.KX && KX.budgetMap ? KX.budgetMap(B, { t: st.f.t, pt: budgetPt(), cs: st.f.c, ...costOpts() }) : null), null);
    const kxRows = new Map();
    if (kx && kx.length) {
      if (typeof kx.net === 'number' && !isRent()) netInfo = { B, net: Math.round(kx.net), costs: Math.round(B - kx.net) };
      /* KX: n = ukupno oglasa u kraju, count = u budžetu */
      kx.filter((r) => r.cs === st.f.c).forEach((r) => kxRows.set(r.key, { ...r, label: r.label || r.key, total: r.n, n: r.count != null ? r.count : r.n, m2: r.m2 || 0, ppm: r.ppm || 0 }));
    }
    const pool = (KV.listings || []).filter((l) => l.cs === st.f.c && l.t === st.f.t && l.pt === budgetPt() && l.ppm > 0 && typeof l.lat === 'number' && !l.syn);
    /* najjeftiniji oglas po kraju (za CTA kad je 0 u budžetu) */
    const minBy = new Map(); (roOn() ? pool.filter(roMatch) : pool).forEach((l) => { [l.ms, l.ns, st.f.c].forEach((k) => { if (k && (!minBy.has(k) || l.p < minBy.get(k))) minBy.set(k, l.p); }); });
    const withMin = (r) => ({ ...r, minP: minBy.get(r.key) || (roOn() ? 0 : S(() => (KV.listings.find((l) => l.s === r.cheapest) || {}).p, 0)) || 0 });
    const merge = (local) => { const out = local.filter((r) => !kxRows.has(r.key) && !(r.scope === 'city' && kxRows.size)); kxRows.forEach((r) => out.push(r)); return out.map(withMin).sort((a, b) => b.m2 - a.m2); };
    const typicalOf = (arr, m2) => { const fit = arr.filter((l) => l.p <= net); return fit.length && m2 ? fit.sort((a, b) => Math.abs(a.a - m2) - Math.abs(b.a - m2) || a.p - b.p)[0].s : null; };
    const rowOf = (key, label, cs, lat, lng, arr, scope) => {
      const sub = roOn() ? arr.filter(roMatch) : arr; const mixed = roOn() && sub.length < 3; const use = mixed ? arr : sub;
      const ok = use.length >= 3; const ppm = ok ? median(use.map((l) => l.ppm)) : 0; const m2 = ok && ppm ? Math.round(net / ppm) : 0;
      return { key, label, cs, lat, lng, m2, n: sub.filter((l) => l.p <= net).length, total: use.length, ppm: Math.round(ppm), scope, mixed: mixed && ok, typical: typicalOf(sub, m2) };
    };
    const byMs = new Map(); pool.forEach((l) => { const k = l.ms || l.ns || st.f.c; const e = byMs.get(k) || { key: k, label: l.m || l.n || l.c, cs: l.cs, lat: 0, lng: 0, ls: [] }; e.lat += l.lat; e.lng += l.lng; e.ls.push(l); byMs.set(k, e); });
    const out = [];
    byMs.forEach((e) => out.push(rowOf(e.key, e.label, e.cs, e.lat / e.ls.length, e.lng / e.ls.length, e.ls, 'mun')));
    if (out.length === 1 || (out.length && out.every((r) => !r.m2))) { /* mali grad: jedan krug za ceo grad */
      const city = cityOf(st.f.c); if (city && pool.length >= 3) return merge([rowOf(st.f.c, city.n, st.f.c, city.lat, city.lng, pool, 'city')]);
    }
    return merge(out);
  }
  function enterBudget() {
    if (!map) return;
    if (!st.bUser || !st.b) st.b = budgetDefault();
    budgetRows = computeBudget(); budgetSel = null;
    selected = null; carKey = ''; map.setMode('budget');
    if (!budgetBar) { budgetBar = buildBudgetBar(); root.appendChild(budgetBar); }
    top.hidden = true; paintBudgetBar(); paintBudgetList();
    /* fit tek kad su traka i karusel u DOM-u: krugovi se uklapaju u slobodan deo mape */
    map.setBudget(budgetRows, { insets: chromeInsets(), fit: true });
  }
  function leaveBudget() {
    if (!map) return;
    if (budgetBar) { budgetBar.remove(); budgetBar = null; }
    top.hidden = false; budgetSel = null; selected = null; carousel.innerHTML = ''; slides.clear(); carKey = '';
    map.setMode('pins'); map.fit(); updateLists(true);
  }
  let bInput = null, bRange = null, bNet = null, bCity = null, bSuffix = null, bSub = null, bNote = null, bCost = null, bRo = null;
  function syncBudgetInputs() {
    if (!budgetBar) return;
    const [a, b, s] = budgetRange(); bRange.min = a; bRange.max = b; bRange.step = s; bRange.value = Math.min(b, Math.max(a, st.b));
    if (document.activeElement !== bInput) bInput.value = nf0.format(st.b);
    bSuffix.textContent = isRent() ? '€/mes' : '€';
    bInput.setAttribute('aria-label', isRent() ? 'Budžet za kiriju u evrima mesečno' : 'Budžet u evrima');
    bSub.textContent = isRent() ? ' Vidi koliko kvadrata dobijaš.' : ' Vidi šta kupuje.';
    bNote.textContent = isRent() ? 'Krug = opština, broj = m² koje dobijaš za tu kiriju po medijani €/m² u toj opštini. Procena iz oglasa na Kvadratu.' : 'Krug = opština, broj = m² koje tvoj budžet kupuje po medijani €/m² u toj opštini. Procena iz oglasa na Kvadratu, ne iz katastra.';
    bCost.hidden = isRent();
    if (bCost.set) bCost.set([st.owner ? 'o' : null, st.credit ? 'k' : null].filter(Boolean));
    const rv = st.f.ro.length === 1 ? String(st.f.ro[0]) : st.f.ro.length ? 'vise' : ''; if (bRo && bRo.value !== rv) bRo.value = rv;
  }
  function buildBudgetBar() {
    const [mn, mx, step] = budgetRange();
    bInput = E('input', { class: 'input', type: 'text', inputmode: 'numeric', 'aria-label': isRent() ? 'Budžet za kiriju u evrima mesečno' : 'Budžet u evrima', value: nf0.format(st.b) });
    bInput.addEventListener('change', () => { const [a, b] = budgetRange(); const v = +String(bInput.value).replace(/[^\d]/g, ''); if (v > 0) { st.b = Math.min(b * 4, Math.max(a / 3, v)); st.bUser = true; } bInput.value = nf0.format(st.b); onBudget(); });
    bRange = E('input', { type: 'range', min: mn, max: mx, step, value: Math.min(mx, Math.max(mn, st.b)), 'aria-label': 'Budžet (klizač)' });
    let rt; bRange.addEventListener('input', () => { st.b = +bRange.value; st.bUser = true; bInput.value = nf0.format(st.b); clearTimeout(rt); rt = setTimeout(onBudget, 60); });
    const cityOpts = (KV.cities || []).filter((c) => (KV.listings || []).filter((l) => l.cs === c.s && l.t === st.f.t && l.pt === budgetPt()).length >= 3).map((c) => ({ v: c.s, l: c.n }));
    if (!cityOpts.some((o) => o.v === st.f.c)) cityOpts.unshift({ v: st.f.c, l: (cityOf(st.f.c) || { n: st.f.c }).n });
    const pickCity = (v) => { st.f.c = v; st.f.m = []; st.f.n = []; locInput.value = locLabel(); refresh(true); syncBudgetInputs(); };
    bCity = S(() => UI.select(cityOpts, st.f.c, pickCity, { label: 'Grad' }), null) || E('select', { class: 'input select', 'aria-label': 'Grad', onchange: (e) => pickCity(e.target.value) }, cityOpts.map((o) => E('option', { value: o.v, selected: o.v === st.f.c }, o.l)));
    bNet = E('p', { class: 'net' });
    bSuffix = E('span', { class: 'suffix' }, isRent() ? '€/mes' : '€');
    const seg = S(() => UI.segmented([{ v: 'prodaja', l: 'Kupujem' }, { v: 'izdavanje', l: 'Iznajmljujem' }], st.f.t, (v) => { st.f.t = v; st.bUser = false; st.b = 0; refresh(true); syncBudgetInputs(); }), null);
    const back = () => { modeSeg && modeSeg.set && modeSeg.set('pins'); switchMode('pins'); };
    /* troškovi: Od vlasnika (bez provizije) · Kredit (procena, obrada, osiguranje) — samo kupovina */
    bCost = S(() => UI.pills([{ v: 'o', l: 'Od vlasnika' }, { v: 'k', l: 'Kredit' }], [st.owner ? 'o' : null, st.credit ? 'k' : null].filter(Boolean), (v, on, all) => { st.owner = all.includes('o'); st.credit = all.includes('k'); onBudget(); }), null) || E('div', {});
    bCost.classList.add('mp-bcost'); bCost.setAttribute('role', 'group'); bCost.setAttribute('aria-label', 'Troškovi kupovine');
    const roOpts = [{ v: '', l: 'Sve strukture' }, { v: '0.5', l: 'Garsonjera' }, { v: '1', l: 'Jednosoban' }, { v: '1.5', l: 'Jednoiposoban' }, { v: '2', l: 'Dvosoban' }, { v: '2.5', l: 'Dvoiposoban' }, { v: '3+', l: 'Trosoban i veći' }];
    if (st.f.ro.length > 1) roOpts.push({ v: 'vise', l: 'Više struktura (iz filtera)' });
    const pickRo = (v) => { if (v === 'vise') return; st.f.ro = v ? [v === '3+' ? '3+' : +v] : []; paintFilterBtn(); paintChips(); onBudget(true); };
    const roCur = st.f.ro.length === 1 ? String(st.f.ro[0]) : st.f.ro.length ? 'vise' : '';
    bRo = S(() => UI.select(roOpts, roCur, pickRo, { label: 'Struktura' }), null) || E('select', { class: 'input select', 'aria-label': 'Struktura', onchange: (e) => pickRo(e.target.value) }, roOpts.map((o) => E('option', { value: o.v, selected: o.v === roCur }, o.l)));
    bSub = E('span', { class: 'sub' }, isRent() ? ' Vidi koliko kvadrata dobijaš.' : ' Vidi šta kupuje.');
    bNote = E('p', { class: 'note' });
    const bar = E('div', { class: 'mp-budget', role: 'region', 'aria-label': 'Budžet' });
    /* telefon: sklopljeno = naslov + [iznos €][grad][Podesi]; klizač, neto red i Kupujem/Iznajmljujem su u proširenju */
    const tog = E('button', { class: 'btn btn-secondary btn-sm tog', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'mp-bmore', onclick: () => { const open = !bar.classList.contains('open'); bar.classList.toggle('open', open); tog.setAttribute('aria-expanded', open ? 'true' : 'false'); } }, icon('filter', 16), E('span', {}, 'Podesi'));
    bar.append(
      E('div', { class: 'hd' }, E('h1', {}, 'Imaš ', E('em', {}, u(st.b, '€')), '?', bSub),
        E('button', { class: 'iconbtn backx', type: 'button', 'aria-label': 'Nazad na oglase', title: 'Nazad na oglase', onclick: back }, icon('x', 18))),
      E('div', { class: 'row2' }, E('div', { class: 'input-wrap' }, bInput, bSuffix), bCity, tog),
      E('div', { class: 'more', id: 'mp-bmore' }, bRange, bNet,
        E('div', { class: 'opts' }, bRo, bCost),
        bNote,
        E('div', { class: 'foot' }, seg, E('button', { class: 'back', type: 'button', onclick: back }, icon('arrow-left', 14), 'Nazad na oglase'))));
    return bar;
  }
  function onBudget() { writeHash(); budgetRows = computeBudget(); map.setBudget(budgetRows); paintBudgetBar(); paintBudgetList(); }
  /* useljenje u zakup: depozit i provizija iz KX.cost (sintetički oglas agencije; provizija = 50 % kirije), rezerva ako engine nije tu */
  const rentMoveIn = (B) => {
    const ag = (KV.agencies || []).find((a) => a.pm !== false);
    const c = S(() => KX.cost({ t: 'izdavanje', pt: budgetPt(), p: B, dep: B, a: 50, cs: st.f.c, ags: ag ? ag.s : 'agencija', ag: ag ? ag.n : 'Agencija' }), null);
    const amt = (k) => { const x = c && c.lines && c.lines.find((y) => y.key === k); return x && x.amount > 0 ? Math.round(x.amount) : null; };
    const dep = amt('depozit') ?? B, prov = amt('provizija') ?? Math.round(B * 0.5);
    return { dep, prov, total: dep + prov };
  };
  function paintBudgetBar() {
    if (!budgetBar || !netInfo) return;
    budgetBar.querySelector('h1 em').textContent = u(netInfo.B, isRent() ? '€/mes' : '€');
    syncBudgetInputs();
    bNet.innerHTML = '';
    if (isRent()) { const mi = rentMoveIn(netInfo.B); bNet.append(E('b', {}, u(netInfo.B, '€/mes')), ' kirije · za useljenje još oko ', E('b', {}, u(mi.total, '€')), ` — depozit ${u(mi.dep, '€')} i provizija agenciji do ${u(mi.prov, '€')} (pola kirije; plaća zakupac ili vlasnik, piše u oglasu).`); }
    else {
      const parts = ['porez' + NB + '2,5' + NB + '%', st.owner ? null : 'proviziju', st.credit ? 'troškove kredita' : null, 'overu'].filter(Boolean);
      const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' i ' + parts[parts.length - 1] : parts[0];
      bNet.append(E('b', {}, u(netInfo.B, '€')), ' = ', E('b', {}, '~' + u(netInfo.net, '€')), ' za stan ', E('span', {}, `(oko ${u(netInfo.costs, '€')} ode na ${list}${st.owner ? '; od vlasnika — bez provizije' : ''})`));
    }
    /* zum kontrole na telefonu idu ispod sklopljene trake */
    requestAnimationFrame(() => { if (!budgetBar) return; const r2 = budgetBar.querySelector('.row2'); if (r2) root.style.setProperty('--mp-btop', Math.round(r2.getBoundingClientRect().bottom - root.getBoundingClientRect().top + 22) + 'px'); });
  }
  function paintBudgetList() {
    if (st.mode !== 'budget' || !netInfo) return;
    const rowsB = [...budgetRows].sort((a, b) => b.m2 - a.m2); const max = Math.max(1, ...rowsB.map((r) => r.m2 || 0));
    drawerHd.innerHTML = ''; drawerBd.innerHTML = ''; carousel.innerHTML = ''; rows.clear(); slides.clear(); carKey = '';
    const city = cityOf(st.f.c); const withData = rowsB.filter((r) => r.m2 > 0);
    const unit = NB + (isRent() ? '€/mes' : '€');
    drawerHd.append(E('div', {}, E('h2', {}, `${city ? city.n : ''} · ${nf0.format(netInfo.B)}${unit}`), E('p', {}, withData.length > 1 ? `${withData.length} opština sa dovoljno oglasa · sortirano po m²` : rowsB.length ? `Za ${city ? city.loc || city.n : 'ovaj grad'} imamo malo oglasa — prikazujemo prosek grada.` : 'Nema dovoljno oglasa za ovaj grad.')));
    /* koliko još treba za najjeftiniji oglas u kraju (bruto, sa istim odnosom troškova kao budžet) */
    const gap = (r) => { if (!r.minP) return 0; const gross = isRent() ? r.minP : r.minP * (netInfo.net ? netInfo.B / netInfo.net : 1.054); return Math.max(0, Math.ceil((gross - netInfo.B) / (isRent() ? 10 : 500)) * (isRent() ? 10 : 500)); };
    const searchBtn = (r) => {
      const base = { ...(r.scope === 'city' ? { t: st.f.t, pt: [budgetPt()], c: r.cs || st.f.c } : { t: st.f.t, pt: [budgetPt()], c: st.f.c, m: [r.key] }), ...(roOn() ? { ro: st.f.ro } : {}) };
      const where = r.scope === 'city' ? 'gradu' : 'kraju';
      if (r.n > 0) return E('button', { class: 'btn btn-ink btn-sm', type: 'button', onclick: () => goHash('/pretraga', { ...base, pmax: netInfo.net, sort: 'p-asc' }) }, icon('search', 16), `Pretraži u ${where} · ${oglasa(r.n)}`);
      /* 0 u budžetu: ne vodi u garantovano praznu pretragu — pokaži najjeftinije u kraju */
      return E('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => goHash('/pretraga', { ...base, sort: 'p-asc' }) }, icon('search', 16), r.minP ? `Najjeftiniji ovde: ${nf0.format(r.minP)}${unit}` : `Pretraži u ${where}`);
    };
    const meta = (r) => {
      if (!(r.m2 > 0)) return `samo ${oglasa(r.total || 0)} — malo podataka`;
      const med = `medijan ${u(r.ppm, '€/m²')}` + (r.mixed ? ' svih struktura' : '');
      if (r.n > 0) return `${oglasa(r.n)} u budžetu · ${med}`;
      const g = gap(r); return g ? `0 oglasa u budžetu · treba ti još ~${nf0.format(g)}${unit}` : `0 oglasa u budžetu · ${med}`;
    };
    /* „tipičan stan”: pravi oglas u budžetu čija je kvadratura najbliža broju m² kraja */
    const typical = (r, full) => {
      const l = r.typical && (KV.listings || []).find((x) => x.s === r.typical); if (!l) return null;
      const t = S(() => KX.titleOf(l), null) || l.ti;
      const short = `${u(l.a, 'm²')}, ${u(l.p, isRent() ? '€/mes' : '€')}`;
      return E('a', { class: 'mp-typ', href: '#/oglas?s=' + encodeURIComponent(l.s), title: t }, E('span', { class: 'k' }, 'Tipičan stan:'), ' ', E('span', { class: 'v' }, full ? `${t} · ${u(l.p, isRent() ? '€/mes' : '€')}` : short), icon('arrow-right', 14));
    };
    if (isDesk()) {
      rowsB.forEach((r) => {
        const b = E('button', { class: 'mp-brow' + (budgetSel === r.key ? ' on' : ''), type: 'button', 'aria-pressed': budgetSel === r.key ? 'true' : 'false', onclick: () => { budgetSel = r.key; map.setSelected(r.key); paintBudgetList(); } },
          E('span', { class: 'm2' + (r.m2 > 0 ? '' : ' none') }, r.m2 > 0 ? u(r.m2, 'm²') : '—'), E('b', {}, r.label), E('p', { class: r.m2 > 0 && !r.n ? 'zero' : null }, meta(r)), E('span', { class: 'bar' }, E('i', { style: `width:${Math.round((r.m2 / max) * 100)}%` })));
        b.addEventListener('mouseenter', () => map.highlight(r.key)); b.addEventListener('mouseleave', () => map.highlight(null));
        rows.set(r.key, b); drawerBd.appendChild(b);
        if (budgetSel === r.key) drawerBd.appendChild(E('div', { class: 'barea' }, typical(r, true), searchBtn(r)));
      });
    } else {
      rowsB.forEach((r) => {
        const s = E('div', { class: 'mp-slide' + (budgetSel === r.key ? ' on' : ''), role: 'listitem', 'data-slug': r.key },
          E('div', { class: 'area' }, E('b', {}, r.label), E('span', { class: 'm2' }, r.m2 > 0 ? u(r.m2, 'm²') : '—'), E('p', {}, meta(r)), typical(r, false), searchBtn(r)));
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

  /* Esc prekida crtanje i kad je fokus na dugmetu „Nacrtaj zonu” (ili bilo gde na stranici van polja) */
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !map || !map.isDrawing || !map.isDrawing()) return;
    if (mapBox.contains(e.target)) return; /* mapView sam obrađuje Esc unutar mape */
    e.preventDefault(); map.cancelDraw(); drawBtn.focus();
  });

  /* ───────── start: mapa se pravi kad je element u dokumentu i ima dimenzije ───────── */
  paintFilterBtn(); paintChips();
  const boot = () => { if (map) return; if (!root.isConnected || !mapBox.clientWidth) { setTimeout(boot, 40); return; } makeMap(); };
  setTimeout(boot, 0);
  let lastDesk = null; const mq = window.matchMedia('(min-width:1101px)');
  const onMq = () => { const d = mq.matches; if (lastDesk !== null && d !== lastDesk) updateLists(true); lastDesk = d; };
  mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq); onMq();
  const mo = new MutationObserver(() => { if (!root.isConnected) { mo.disconnect(); if (typeof offProfile === 'function') S(() => offProfile()); mq.removeEventListener ? mq.removeEventListener('change', onMq) : mq.removeListener(onMq); if (map) map.destroy(); map = null; } });
  setTimeout(() => { if (root.isConnected) mo.observe(document.body, { childList: true, subtree: true }); }, 0);
  return root;
}
window.viewMap = viewMap;
