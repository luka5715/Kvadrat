/* Kvadrat.rs — stranica: početna (viewHome). Spec §6.1.
   Redosled: hero (pretraga + Oglas nedelje) → Izdvojeno ove nedelje → Novo u ponudi → Tržište ovog meseca → Novogradnja →
   Gradovi → Agencije → Saveti. Vraća jedan čvor (sadržaj za <main>); zaglavlje i podnožje crta ljuska (app.js).
   Zavisi od: core.js (D, el, fmt, stats, applyFilters, filtersToParams, FILTER_DEFAULTS, setHash, router, TYPES),
   images.js (img), ui.js (card, badge, sectionHead, tiles, deltaChip, bars, agencyCard, photoCap, chip, icon), engine.js (KX). */
'use strict';

const HOME_ROUTES = {
  search: (params) => (typeof router !== 'undefined' && router.href ? router.href('/pretraga', params || {}) : '#/pretraga'),
  listing: (s) => '#/oglas?s=' + encodeURIComponent(s),
  project: (id) => '#/projekat?s=' + encodeURIComponent(id),
  article: (s) => '#/savet?s=' + encodeURIComponent(s),
};

/* ─────────── podaci za početnu (deterministički, keš) ─────────── */
const homeData = (() => {
  let cache = null;
  const plural = (n, a, b, c) => (typeof fmt !== 'undefined' && fmt.plural ? fmt.plural(n, a, b, c) : (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c));
  const isPromo = (l) => l.pr === 'PREMIUM' || l.pr === 'TOP';
  const isNew = (l) => l.co === 'novogradnja' || l.co === 'u-izgradnji';

  /* Oglas nedelje: PREMIUM sa najviše pregleda; jednak broj → prodaja, pa stan, pa najsvežiji, pa slug */
  function pickFeature(L) {
    const rank = (l) => [-(l.v || 0), l.t === 'prodaja' ? 0 : 1, l.pt === 'stan' ? 0 : 1, l.dz, l.s];
    const cmp = (a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; };
    const prem = L.filter((l) => l.pr === 'PREMIUM').sort(cmp);
    return prem[0] || [...L].sort(cmp)[0];
  }

  /* lokacije za autocomplete: grad → opština → naselje, sa brojem oglasa */
  function buildLocations(L) {
    const cc = {}, mc = {}, nc = new Map();
    for (const l of L) {
      cc[l.cs] = (cc[l.cs] || 0) + 1;
      mc[l.ms] = (mc[l.ms] || 0) + 1;
      if (l.ns) {
        const k = l.ns;
        if (!nc.has(k)) nc.set(k, { kind: 'n', s: l.ns, label: l.n, ms: l.ms, m: l.m, cs: l.cs, c: l.c, count: 0 });
        nc.get(k).count++;
      }
    }
    const cityName = {}; D.cities.forEach((c) => { cityName[c.s] = c.n; });
    const out = [];
    D.cities.forEach((c) => out.push({ kind: 'c', s: c.s, label: c.n, cs: c.s, c: c.n, parent: 'grad', count: cc[c.s] || 0 }));
    D.muns.forEach((m) => out.push({ kind: 'm', s: m.s, label: m.n, cs: m.cs, c: cityName[m.cs] || '', parent: 'opština · ' + (cityName[m.cs] || ''), count: mc[m.s] || 0 }));
    nc.forEach((n) => { n.parent = (n.m && n.m !== n.label ? n.m + ', ' : '') + n.c; out.push(n); });
    out.forEach((x) => { x.fold = fmt.fold(x.label); x.id = x.kind + ':' + x.s; });
    return out;
  }

  /* projekti novogradnje: grupa po agenciji + naselju (t = prodaja), id = ags--ns */
  function buildProjects(L) {
    const g = new Map();
    for (const l of L) {
      if (l.t !== 'prodaja' || !l.ags || !isNew(l)) continue;
      const id = l.ags + '--' + l.ns;
      if (!g.has(id)) g.set(id, { id, units: [] });
      g.get(id).units.push(l);
    }
    const list = [...g.values()].map((p) => {
      const u = p.units.slice().sort((a, b) => a.p - b.p);
      const building = u.find((x) => x.co === 'u-izgradnji');
      let rok = null;
      if (building) { const m = String(typeof KX !== 'undefined' && KX.titleOf ? KX.titleOf(building) : '').match(/rok (Q\d \d{4})/); rok = m ? m[1] : null; }
      const allFlats = u.every((x) => x.pt === 'stan');
      const views = u.reduce((s, x) => s + (x.v || 0), 0);
      return {
        id: p.id, units: u, cover: u[0], from: u[0].p, n: u[0].n, m: u[0].m, c: u[0].c, cs: u[0].cs, agency: u[0].ag, ags: u[0].ags,
        status: building ? 'U izgradnji' : 'Useljivo', rok, views,
        unitLabel: allFlats ? `${u.length} ${plural(u.length, 'stan', 'stana', 'stanova')} u ponudi` : `${u.length} ${plural(u.length, 'jedinica', 'jedinice', 'jedinica')} u ponudi`,
      };
    });
    list.sort((a, b) => b.units.length - a.units.length || (a.rok ? 0 : 1) - (b.rok ? 0 : 1) || b.views - a.views || (a.id < b.id ? -1 : 1));
    return list;
  }

  function get() {
    if (cache) return cache;
    const L = D.listings;
    const feature = pickFeature(L);
    const used = new Set([feature.s]);
    const promoted = L.filter(isPromo);
    const week = promoted.filter((l) => l.dz <= 7);
    const pool = (week.length >= 4 ? week : promoted).slice().sort((a, b) => b.v - a.v || a.dz - b.dz || (a.s < b.s ? -1 : 1));
    const featured = [];
    for (const l of pool) { if (featured.length >= 4) break; if (!used.has(l.s)) { featured.push(l); used.add(l.s); } }
    const fresh = [];
    for (const l of L.slice().sort((a, b) => a.dz - b.dz || b.v - a.v || (a.s < b.s ? -1 : 1))) { if (fresh.length >= 4) break; if (!used.has(l.s)) { fresh.push(l); used.add(l.s); } }

    const byType = {}; const tByType = {};
    for (const l of L) { byType[l.pt] = (byType[l.pt] || 0) + 1; (tByType[l.pt] = tByType[l.pt] || { prodaja: 0, izdavanje: 0 })[l.t]++; }
    const cityCount = {}; L.forEach((l) => { cityCount[l.cs] = (cityCount[l.cs] || 0) + 1; });
    const cities = D.cities.map((c) => ({ s: c.s, n: c.n, count: cityCount[c.s] || 0 })).filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count || (a.n < b.n ? -1 : 1));
    const agencies = D.agencies.filter((a) => a.v).slice().sort((a, b) => (b.lc || 0) - (a.lc || 0) || (b.r || 0) - (a.r || 0)).slice(0, 4);
    const articles = [...D.articles.filter((a) => a.f), ...D.articles.filter((a) => !a.f)].slice(0, 3);
    const market = (() => { try { return stats.cityIndex(); } catch (e) { return []; } })();
    const sale = L.filter((l) => l.t === 'prodaja' && l.pt === 'stan' && l.ppm);
    const natPpm = stats.median(sale.map((l) => l.ppm));

    const projects = buildProjects(L);
    const projPick = projects.filter((p) => !p.units.some((u) => u.s === feature.s));
    cache = {
      total: L.length, feature, featured, fresh, promotedCount: promoted.length, newToday: L.filter((l) => l.dz <= 1).length,
      byType, tByType, cities, agencies, articles, market, natPpm, natN: sale.length,
      locations: buildLocations(L), projects: projPick.length >= 2 ? projPick : projects,
    };
    return cache;
  }
  return { get, plural };
})();

/* ─────────── kutija za pretragu: tabovi, tip, lokacija (autocomplete + čipovi + opis rečima), cena, živi broj ─────────── */
function homeSearch() {
  const H = homeData.get();
  const pl = homeData.plural;
  const TABS = [{ v: 'prodaja', l: 'Prodaja' }, { v: 'izdavanje', l: 'Izdavanje' }, { v: 'novogradnja', l: 'Novogradnja' }];
  const PRICES = {
    prodaja: [50000, 75000, 100000, 150000, 200000, 300000, 500000],
    izdavanje: [300, 400, 500, 700, 1000, 1500, 2500],
  };
  const LOCKEYS = new Set(['c', 'm', 'n']);
  const st = { tab: 'prodaja', pt: 'stan', pmax: '', locs: [], text: '', parsed: null, off: new Set(), sugg: [], active: -1, open: false };
  let uid = 0; const nid = (p) => 'hm-' + p + '-' + (++uid);

  /* tabovi (role=tablist, strelice levo/desno) */
  const tabBtns = TABS.map((t, i) => el('button', {
    type: 'button', role: 'tab', id: nid('tab'), 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1',
    onclick: () => setTab(t.v),
  }, t.l));
  const tabStrip = el('div', { class: 'tabs-ul', role: 'tablist', 'aria-label': 'Vrsta ponude' }, tabBtns);
  tabStrip.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.v === st.tab);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[j].v); tabBtns[j].focus();
  });

  /* tip */
  const typeSel = el('select', { id: nid('pt'), onchange: (e) => { st.pt = e.target.value; refresh(true); } },
    el('option', { value: '' }, 'Sve vrste'),
    TYPES.map((t) => el('option', { value: t.v, selected: t.v === st.pt }, t.l)));
  const fTip = el('div', { class: 'field f-tip' }, el('label', { for: typeSel.id }, 'Tip nekretnine'), el('div', { class: 'sel' }, typeSel, icon('chev-d')));

  /* cena do */
  const priceSel = el('select', { id: nid('pmax'), onchange: (e) => { st.pmax = e.target.value; refresh(true); } });
  const fillPrices = () => {
    const mode = st.tab === 'izdavanje' ? 'izdavanje' : 'prodaja';
    const keep = PRICES[mode].map(String).includes(String(st.pmax)) ? st.pmax : '';
    st.pmax = keep;
    priceSel.innerHTML = '';
    priceSel.append(el('option', { value: '' }, 'Bilo koja'), ...PRICES[mode].map((p) => el('option', { value: p, selected: String(p) === String(keep) }, fmt.price(p, mode))));
  };
  fillPrices();
  const fPrice = el('div', { class: 'field f-price' }, el('label', { for: priceSel.id }, 'Cena do'), el('div', { class: 'sel' }, priceSel, icon('chev-d')));

  /* lokacija: combobox + čipovi */
  const listId = nid('ac');
  const input = el('input', {
    type: 'text', id: nid('loc'), autocomplete: 'off', spellcheck: 'false', placeholder: 'Grad, opština, naselje',
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-describedby': null,
  });
  const chipBox = el('span', { class: 'loc-chips' });
  const fLoc = el('div', { class: 'field f-loc' }, el('label', { for: input.id }, 'Lokacija'), el('div', { class: 'loc-in' }, chipBox, input));
  const list = el('ul', { class: 'hm-ac', id: listId, role: 'listbox', 'aria-label': 'Predlozi lokacija', hidden: true });

  /* dugme sa živim brojem */
  const cnt = el('span', { class: 'cnt' }, '');
  const goBtn = el('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, icon('search'), 'Pretraži', cnt);
  const live = el('span', { class: 'sr', 'aria-live': 'polite' });
  const form = el('form', { class: 'fields', role: 'search', 'aria-label': 'Pretraga nekretnina', id: nid('form'), onsubmit: (e) => { e.preventDefault(); submit(); } },
    fTip, fLoc, fPrice, el('div', { class: 'go' }, goBtn));
  tabBtns.forEach((b) => b.setAttribute('aria-controls', form.id));
  const box = el('div', { class: 'search' }, tabStrip, form);

  /* red ispod kutije: prepoznato iz rečenice / primer; zatim „Više filtera“ + budžet */
  const parseRow = el('div', { class: 'hm-parse' });
  const moreLink = el('a', { href: HOME_ROUTES.search({}) }, 'sobe, sprat, stanje, grejanje…');
  const more = el('div', { class: 'hm-more' },
    el('p', { class: 'search-more' }, 'Više filtera: ', moreLink),
    el('a', { class: 'btn btn-secondary btn-sm hm-budget', href: '#/mapa?m=budzet' }, icon('ruler'), 'Koliko kvadrata za tvoj novac?'));
  const msg = el('p', { class: 'hm-msg', role: 'status' });

  const root = el('div', { class: 'hm-search' }, box, list, msg, parseRow, more, live);

  /* ── stanje → filteri ── */
  function locFilters() {
    const f = { c: '', m: [], n: [] };
    if (!st.locs.length) return f;
    f.c = st.locs[0].cs;
    const ms = st.locs.filter((x) => x.kind === 'm').map((x) => x.s);
    const ns = st.locs.filter((x) => x.kind === 'n').map((x) => x.s);
    if (ms.length && ns.length) {
      /* opština ILI naselje: core spaja m i n sa I, pa opštine razvijamo u njihova naselja */
      const set = new Set(ns);
      H.locations.forEach((x) => { if (x.kind === 'n' && ms.includes(x.ms)) set.add(x.s); });
      f.n = [...set];
    } else { f.m = ms; f.n = ns; }
    return f;
  }
  function parsedFilters() {
    if (!st.parsed) return null;
    const f = JSON.parse(JSON.stringify(st.parsed.filters || {}));
    for (const ch of st.parsed.chips || []) {
      if (!st.off.has(chipKey(ch)) || ch.key === 'route') continue;
      if (Array.isArray(f[ch.key])) f[ch.key] = f[ch.key].filter((v) => String(v) !== String(ch.value));
      else delete f[ch.key];
      if (ch.key === 'm' || ch.key === 'n') { if (!(f.m && f.m.length) && !(f.n && f.n.length) && !st.parsed.chips.some((x) => x.key === 'c' && !st.off.has(chipKey(x)))) delete f.c; }
    }
    return f;
  }
  function exactLoc() {
    const q = fmt.fold(st.text).trim().replace(/\s+/g, ' ');
    return !!q && H.locations.some((x) => x.fold === q);
  }
  function filters(forSubmit) {
    const f = { ...FILTER_DEFAULTS, t: st.tab === 'izdavanje' ? 'izdavanje' : 'prodaja', newbuild: st.tab === 'novogradnja', pt: st.pt ? [st.pt] : [], pmax: st.pmax === '' ? '' : +st.pmax, ...locFilters() };
    /* nedovršena reč („vr“) ne menja broj; rečenica, tačan naziv mesta ili slanje forme — menjaju */
    const p = forSubmit || freeTextMode() || exactLoc() ? parsedFilters() : null;
    if (p) {
      if (Object.keys(p).some((k) => LOCKEYS.has(k))) { f.c = ''; f.m = []; f.n = []; }
      Object.assign(f, p);
    }
    return f;
  }
  const chipKey = (ch) => ch.key + ':' + String(ch.value);

  /* ── autocomplete ── */
  const ALIAS = { bg: 'beograd', bgd: 'beograd', nbg: 'novi beograd', ns: 'novi sad', kg: 'kragujevac' };
  function suggest(text) {
    const chosen = new Set(st.locs.map((x) => x.id));
    let q = fmt.fold(text).trim().replace(/\s+/g, ' ');
    if (ALIAS[q]) q = ALIAS[q];
    const kindRank = { c: 0, m: 1, n: 2 };
    if (!q) {
      /* prazno polje: najtraženije (3 grada + 3 opštine po broju oglasa) */
      const top = (k, n) => H.locations.filter((x) => x.kind === k && !chosen.has(x.id) && x.count > 0).sort((a, b) => b.count - a.count).slice(0, n);
      return [...top('c', 3), ...top('m', 3)];
    }
    const out = [];
    for (const x of H.locations) {
      if (chosen.has(x.id) || !x.count) continue;
      let score = -1;
      if (x.fold === q) score = 0;
      else if (x.fold.startsWith(q)) score = 1;
      else if (x.fold.split(/[\s\-–—,.]+/).some((w) => w.startsWith(q))) score = 2;
      else if (q.length >= 3 && x.fold.includes(q)) score = 3;
      if (score >= 0) out.push([score, x]);
    }
    out.sort((a, b) => a[0] - b[0] || b[1].count - a[1].count || kindRank[a[1].kind] - kindRank[b[1].kind] || (a[1].label < b[1].label ? -1 : 1));
    return out.slice(0, 8).map((p) => p[1]);
  }
  function hilite(label, text) {
    const q = fmt.fold(text).trim();
    if (!q) return label;
    const i = fmt.fold(label).indexOf(q);
    if (i < 0) return label;
    return [label.slice(0, i), el('mark', {}, label.slice(i, i + q.length)), label.slice(i + q.length)];
  }
  function renderList() {
    list.innerHTML = '';
    if (!st.open || !st.sugg.length) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); return; }
    const empty = !st.text.trim();
    if (empty) list.append(el('li', { class: 'hm-ac-h', role: 'presentation' }, 'Najviše oglasa'));
    st.sugg.forEach((x, i) => {
      const li = el('li', {
        id: listId + '-' + i, role: 'option', class: 'hm-ac-o', 'aria-selected': i === st.active ? 'true' : 'false',
        onmousedown: (e) => e.preventDefault(), onclick: () => pick(i),
      },
      icon(x.kind === 'c' ? 'building' : x.kind === 'm' ? 'blocks' : 'pin', 16),
      el('span', { class: 'nm' }, el('b', {}, hilite(x.label, st.text)), el('span', { class: 'par' }, x.parent)),
      el('span', { class: 'n' }, fmt.num(x.count)));
      list.append(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (st.active >= 0) input.setAttribute('aria-activedescendant', listId + '-' + st.active); else input.removeAttribute('aria-activedescendant');
    placeList();
    const cur = st.active >= 0 ? list.querySelector('#' + listId + '-' + st.active) : null;
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function placeList() {
    const r = root.getBoundingClientRect(), f = fLoc.getBoundingClientRect();
    if (!r.width) return;
    const narrow = r.width < 560;
    const w = narrow ? r.width : Math.max(f.width, 340);
    const left = narrow ? 0 : Math.min(f.left - r.left, r.width - w);
    list.style.top = Math.round(f.bottom - r.top + 4) + 'px';
    list.style.left = Math.round(Math.max(0, left)) + 'px';
    list.style.width = Math.round(w) + 'px';
  }
  function openList() { st.sugg = suggest(st.text); st.open = true; st.active = defaultActive(); renderList(); }
  function closeList() { st.open = false; st.active = -1; renderList(); }
  function defaultActive() {
    /* rečenica sa nelokacijskim pojmovima → Enter pretražuje; inače Enter bira prvi predlog */
    if (!st.text.trim() || !st.sugg.length) return -1;
    return freeTextMode() ? -1 : 0;
  }
  function freeTextMode() {
    const p = st.parsed;
    if (!p || !p.chips || !p.chips.length) return false;
    return p.chips.some((c) => !LOCKEYS.has(c.key)) || p.chips.length > 1 || (p.unparsed && p.unparsed.length > 0 && !st.sugg.length);
  }
  function pick(i) {
    const x = st.sugg[i];
    if (!x) return;
    let note = '';
    if (st.locs.length && st.locs[0].cs !== x.cs) { note = `Lokacije su u jednom gradu — prethodne su zamenjene sa ${x.c || x.label}.`; st.locs = []; }
    if (x.kind === 'c') st.locs = st.locs.filter((y) => y.cs !== x.cs);
    else st.locs = st.locs.filter((y) => !(y.kind === 'c' && y.cs === x.cs));
    st.locs.push(x);
    st.text = ''; input.value = ''; st.parsed = null; st.off.clear();
    msg.textContent = note;
    renderChips(); closeList(); refresh(true);
    input.focus();
  }
  function removeLoc(id) {
    st.locs = st.locs.filter((x) => x.id !== id);
    msg.textContent = '';
    renderChips(); refresh(true); input.focus();
  }
  function renderChips() {
    chipBox.innerHTML = '';
    st.locs.forEach((x) => {
      const t = chip(x.label, () => removeLoc(x.id));
      const b = t.querySelector('button'); if (b) b.setAttribute('aria-label', 'Ukloni lokaciju ' + x.label);
      chipBox.append(t);
    });
    input.placeholder = st.locs.length ? 'Dodaj još…' : 'Grad, opština, naselje';
    fLoc.classList.toggle('has-chips', st.locs.length > 0);
  }

  input.addEventListener('input', () => {
    st.text = input.value; st.off.clear();
    st.parsed = st.text.trim() && typeof KX !== 'undefined' && KX.parseQuery ? KX.parseQuery(st.text) : null;
    openList(); renderParse(); refresh(false);
  });
  input.addEventListener('focus', () => { if (!st.open) openList(); });
  input.addEventListener('blur', () => setTimeout(() => { if (!root.contains(document.activeElement)) closeList(); }, 120));
  input.addEventListener('keydown', (e) => {
    const n = st.sugg.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!st.open) { openList(); return; } if (n) { st.active = (st.active + 1) % n; renderList(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (st.open && n) { st.active = st.active <= 0 ? n - 1 : st.active - 1; renderList(); } }
    else if (e.key === 'Home' && st.open && n && !input.value) { e.preventDefault(); st.active = 0; renderList(); }
    else if (e.key === 'Enter') { if (st.open && st.active >= 0) { e.preventDefault(); pick(st.active); } }
    else if (e.key === 'Escape') { if (st.open) { e.preventDefault(); closeList(); } else if (input.value) { input.value = ''; input.dispatchEvent(new Event('input')); } }
    else if (e.key === 'Backspace' && !input.value && st.locs.length) { e.preventDefault(); removeLoc(st.locs[st.locs.length - 1].id); }
    else if (e.key === 'Tab') closeList();
  });
  homeSearch.place = () => { if (st.open && root.isConnected) placeList(); };

  /* ── rečenica → čipovi (KX.parseQuery) ── */
  const EXAMPLES = ['dvosoban vračar do 150k', 'garsonjera kirija do 400 €'];
  function renderParse() {
    parseRow.innerHTML = '';
    const p = st.parsed;
    if (st.text.trim() && p && p.chips && p.chips.length && freeTextMode()) {
      const chips = p.chips.map((ch) => {
        const off = st.off.has(chipKey(ch));
        return el('button', {
          type: 'button', class: 'hm-pchip' + (off ? ' off' : ''), 'aria-pressed': off ? 'false' : 'true',
          'aria-label': (off ? 'Vrati uslov ' : 'Isključi uslov ') + ch.label,
          onclick: () => { if (st.off.has(chipKey(ch))) st.off.delete(chipKey(ch)); else st.off.add(chipKey(ch)); renderParse(); refresh(true); },
        }, ch.label, icon(off ? 'plus' : 'x', 14));
      });
      const rest = (p.unparsed || []).filter(Boolean);
      parseRow.append(
        el('span', { class: 'lbl' }, 'Prepoznato'),
        el('span', { class: 'chips' }, chips,
          rest.length ? el('span', { class: 'rest' }, 'i tekst „' + rest.join(' ') + '“') : null),
        el('span', { class: 'hint' }, 'Enter — pretraži'));
      parseRow.classList.add('on');
    } else {
      parseRow.classList.remove('on');
      parseRow.append(el('span', { class: 'lbl' }, 'Ili opiši rečima'),
        el('span', { class: 'chips' }, EXAMPLES.map((ex) => el('button', {
          type: 'button', class: 'hm-ex', onclick: () => { input.value = ex; input.dispatchEvent(new Event('input')); closeList(); input.focus(); },
        }, '„' + ex + '“'))));
    }
  }

  /* ── tabovi ── */
  function setTab(v) {
    st.tab = v;
    tabBtns.forEach((b, i) => { const on = TABS[i].v === v; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    fillPrices(); refresh(true);
  }

  /* ── živi broj (debounce) ── */
  let tCount = 0, tLive = 0, lastN = null;
  function refresh(now) {
    clearTimeout(tCount);
    const run = () => {
      const f = filters();
      let n = 0;
      try { n = applyFilters(f).length; } catch (e) { n = 0; }
      lastN = n;
      cnt.textContent = '· ' + fmt.num(n);
      goBtn.setAttribute('aria-label', `Pretraži — ${fmt.num(n)} ${pl(n, 'oglas', 'oglasa', 'oglasa')}`);
      moreLink.href = HOME_ROUTES.search(filtersToParams(f));
      clearTimeout(tLive);
      tLive = setTimeout(() => { live.textContent = `${fmt.num(n)} ${pl(n, 'oglas odgovara', 'oglasa odgovaraju', 'oglasa odgovara')} pretrazi`; }, 500);
      renderZero(f, n);
    };
    if (now) run(); else tCount = setTimeout(run, 140);
  }
  function renderZero(f, n) {
    const old = root.querySelector('.hm-zero'); if (old) old.remove();
    if (n > 0 || typeof KX === 'undefined' || !KX.relax) return;
    let r = [];
    try { r = KX.relax(f).slice(0, 2); } catch (e) { r = []; }
    if (!r.length) return;
    parseRow.after(el('p', { class: 'hm-zero' }, 'Nema oglasa za ovu kombinaciju. Najmanja promena: ',
      r.map((x, i) => [i ? ' · ' : '', el('a', { href: HOME_ROUTES.search(filtersToParams({ ...FILTER_DEFAULTS, ...x.filters })) }, `${x.label} (${fmt.num(x.count)})`)])));
  }

  function submit() {
    const p = st.parsed;
    /* naredba („kalkulator“, „KV-1112899“) bez drugih uslova → otvori tu stranu */
    if (p && p.route && p.chips.length && p.chips.every((c) => c.key === 'route')) { location.hash = p.route; return; }
    setHash('/pretraga', filtersToParams(filters(true)));
  }

  renderChips(); renderParse(); refresh(true);
  return root;
}

/* jedan globalni slušalac (bez curenja pri ponovnom renderu) */
window.addEventListener('resize', () => { if (homeSearch.place) homeSearch.place(); });

/* ─────────── sekcije ─────────── */
function homeHero() {
  const H = homeData.get();
  const pl = homeData.plural;
  const l = H.feature;
  const cityN = D.cities.length, agN = D.agencies.length, munN = D.muns.length;

  const types = TYPES.map((t) => {
    const n = H.byType[t.v] || 0;
    if (!n) return null;
    const tt = H.tByType[t.v] || {};
    const tr = (tt.izdavanje || 0) > (tt.prodaja || 0) ? 'izdavanje' : 'prodaja';
    return el('a', { href: HOME_ROUTES.search({ t: tr, pt: t.v }) }, el('b', {}, fmt.num(n)), t.pl);
  });

  const copy = el('div', { class: 'hm-copy' },
    el('p', { class: 'eyebrow' }, 'Nekretnine · Srbija'),
    el('h1', { class: 't-hero hm-h1', id: 'hm-h1' }, 'Znaj koliko', el('br'), 'vredi ', el('em', {}, 'svaki'), el('br'), 'kvadrat.'),
    el('p', { class: 'lede hm-lede' },
      `${fmt.num(H.total)} ${pl(H.total, 'oglas', 'oglasa', 'oglasa')} iz ${cityN} ${pl(cityN, 'grada', 'grada', 'gradova')}, ${fmt.num(H.newToday)} ${pl(H.newToday, 'nov', 'nova', 'novih')} od juče. `,
      'Uz svaki oglas vidiš cenu po m² u odnosu na prosek kraja — i koliko te stan zaista košta.'),
    homeSearch(),
    tiles([
      { v: fmt.num(H.total), l: 'aktivnih oglasa' },
      { v: String(cityN), l: pl(cityN, 'grad', 'grada', 'gradova') },
      { v: String(agN), l: pl(agN, 'agencija', 'agencije', 'agencija') },
      { v: String(munN), l: pl(munN, 'opština', 'opštine', 'opština') + ' i zona' },
    ]),
    el('nav', { class: 'types', 'aria-label': 'Brze pretrage po vrsti' }, types));

  const ph = el('div', { class: 'ph r45', role: 'img', 'aria-label': `Oglas nedelje: ${l.ti}` });
  ph.innerHTML = img.hero();
  const facts = [l.ro ? fmt.rooms(l.ro) : null, l.a ? fmt.m2(l.a) : null, fmt.price(l.p, l.t)].filter(Boolean).join(' · ');
  ph.append(photoCap({ eyebrow: 'Oglas nedelje', title: `${l.n}, ${l.m && l.m !== l.n ? l.m : l.c}`, facts, link: { href: HOME_ROUTES.listing(l.s), label: 'Pogledaj oglas' } }));
  const feature = el('figure', { class: 'hm-feature' }, ph,
    el('figcaption', { class: 'sr' }, `Oglas nedelje — ${l.ti}, ${fmt.price(l.p, l.t)}. Izabran kao premium oglas sa najviše pregleda ove nedelje.`));

  return el('section', { class: 'hm-hero', 'aria-labelledby': 'hm-h1' }, copy, feature);
}

function homeCards(list, opts = {}) {
  return el('div', { class: 'cards' }, list.map((l) => {
    const c = card(l, 'grid');
    if (opts.fresh) {
      /* „Novo u ponudi“: oznaka Novo mora da se vidi (max 2 na fotografiji) */
      const b = c.querySelector('.badges');
      if (b && !b.querySelector('[data-kind="novo"]')) {
        if (b.children.length >= 2) b.lastElementChild.remove();
        b.append(badge('novo'));
      }
    }
    return c;
  }));
}

function homeMarket() {
  const H = homeData.get();
  const pick = ['beograd', 'novi-sad', 'nis'].map((cs) => H.market.find((x) => x.cs === cs)).filter(Boolean);
  const tileItems = pick.map((x) => ({
    v: fmt.ppm(x.ppm),
    l: `${x.c} · prosek za stan · n=${x.n}`,
    delta: deltaChip({ pct: x.change12 }, { title: `${fmt.pct(x.change12, { sign: true })} za 12 meseci u ${x.loc} (procena)` }),
  }));
  const six = H.market.slice(0, 6);
  return el('div', { class: 'hm-market' },
    el('div', { class: 'hm-m-tiles' },
      el('p', { class: 'eyebrow' }, 'Prosečna cena po m² · Δ 12 meseci'),
      tiles(tileItems),
      el('p', { class: 'hm-src' }, 'Izvor: oglasi za prodaju stanova na Kvadrat.rs (medijana). Promena za 12 meseci je procena.')),
    el('div', { class: 'hm-m-bars' },
      el('p', { class: 'eyebrow' }, 'Stanovi, prodaja · €/m² po gradu'),
      bars(six.map((x) => ({ label: x.c, value: x.ppm, n: x.n })), H.natPpm ? { ref: { value: H.natPpm, label: 'Srbija' } } : {}),
      el('p', { class: 'hm-src' }, `n = broj oglasa u uzorku. Srbija: medijana ${fmt.num(H.natN)} oglasa.`)));
}

function homeProjects() {
  const H = homeData.get();
  const two = H.projects.slice(0, 2);
  return el('div', { class: 'hm-projects' }, two.map((p) => {
    const ph = el('div', { class: 'ph r16' }, img.el(p.cover, 0, { aspect: '16:10', alt: '' }), el('div', { class: 'badges' }, badge('novogradnja')));
    ph.append(photoCap({
      eyebrow: p.rok ? `U izgradnji · rok ${p.rok}` : 'Završeno · useljivo odmah',
      title: `${p.n}, ${p.m && p.m !== p.n ? p.m : p.c}`,
      facts: `od ${fmt.price(p.from, 'prodaja')} · ${p.unitLabel}`,
      link: { href: HOME_ROUTES.project(p.id), label: 'Pogledaj projekat' },
    }));
    return el('article', { class: 'hm-proj' }, ph,
      el('p', { class: 'hm-proj-by' }, el('span', {}, 'Prodaje: '), el('b', {}, p.agency), ' · cene sa ', el('span', { class: 'hm-nw' }, 'PDV-om')));
  }));
}

function homeCities() {
  const H = homeData.get();
  const SHOW = 12;
  const items = H.cities.map((c, i) => el('li', { hidden: i >= SHOW },
    el('a', { href: HOME_ROUTES.search({ c: c.s }) }, el('span', { class: 'nm' }, c.n), el('span', { class: 'n' }, fmt.num(c.count)))));
  const ul = el('ul', { class: 'hm-cities', id: 'hm-cities' }, items);
  const rest = H.cities.length - SHOW;
  const btn = rest > 0 ? el('button', {
    type: 'button', class: 'btn btn-ghost btn-sm hm-more-cities', 'aria-expanded': 'false', 'aria-controls': 'hm-cities',
    onclick: () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      items.forEach((li, i) => { if (i >= SHOW) li.hidden = !open; });
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.lastChild.textContent = open ? 'Prikaži manje' : `Prikaži sve gradove (${H.cities.length})`;
      btn.firstChild.replaceWith(icon(open ? 'chev-u' : 'chev-d', 16));
    },
  }, icon('chev-d', 16), el('span', {}, `Prikaži sve gradove (${H.cities.length})`)) : null;
  return el('div', {}, ul, btn);
}

function homeArticles() {
  const H = homeData.get();
  const CAT = { saveti: 'Saveti', vodici: 'Vodiči', trziste: 'Tržište', kredit: 'Kredit', 'pravni-saveti': 'Pravni saveti' };
  return el('div', { class: 'hm-arts' }, H.articles.map((a) => el('article', { class: 'hm-art' },
    el('div', { class: 'ph r16' }, el('img', { src: img.article(a.s), alt: '', decoding: 'async', width: '800', height: '500' })),
    el('p', { class: 'eyebrow' }, CAT[a.c] || 'Saveti'),
    el('h3', {}, el('a', { href: HOME_ROUTES.article(a.s) }, a.t)),
    el('p', { class: 'ex' }, a.e),
    el('p', { class: 'by' }, a.au, ' · ', `${a.rm} min čitanja`))));
}

/* ─────────── početna ─────────── */
function viewHome(q) {
  const H = homeData.get();
  const sec = (cls, head, body) => el('section', { class: 'section ' + cls }, head, body);
  const ags = el('div', { class: 'agencies hm-agencies' }, H.agencies.map((a) => agencyCard(a)));

  return el('div', { class: 'wrap hm' },
    homeHero(),
    sec('hm-featured', sectionHead('Izdvojeno ove nedelje', 'Promovisani oglasi sa najviše pregleda u poslednjih sedam dana.', HOME_ROUTES.search({ sort: 'rel' }), `Svih ${H.promotedCount} izdvojenih`),
      homeCards(H.featured)),
    sec('hm-fresh', sectionHead('Novo u ponudi', 'Oglasi postavljeni od juče.', HOME_ROUTES.search({ sort: 'new' }), 'Svi novi oglasi'),
      homeCards(H.fresh, { fresh: true })),
    sec('hm-market-s', sectionHead('Tržište ovog meseca', 'Koliko košta kvadrat stana u najvećim gradovima.', '#/trziste', 'Cene po gradovima i opštinama'),
      homeMarket()),
    sec('hm-new-s', sectionHead('Novogradnja', ['Stanovi od investitora — cene sa uračunatim ', el('span', { class: 'hm-nw' }, 'PDV-om'), '.'], '#/novogradnja', 'Svi projekti'),
      homeProjects()),
    sec('hm-cities-s', sectionHead('Gradovi', 'Broj aktivnih oglasa po gradu.', '#/mapa', 'Pogledaj na mapi'),
      homeCities()),
    sec('hm-ag-s', sectionHead('Agencije', 'Verifikovane agencije sa najviše aktivnih oglasa.', '#/agencije', 'Sve agencije'),
      ags),
    sec('hm-arts-s', sectionHead('Saveti', 'Kupovina, kredit i papiri — bez iznenađenja.', '#/saveti', 'Svi saveti'),
      homeArticles()));
}
