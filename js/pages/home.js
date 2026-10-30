/* Kvadrat.rs — stranica: početna (viewHome). Spec §6.1.
   Redosled: hero (pretraga + Oglas nedelje) → Izdvojeno ove nedelje → Novo u ponudi → Tržište ovog meseca → Novogradnja →
   Gradovi → Agencije → Saveti. Vraća jedan čvor (sadržaj za <main>); zaglavlje i podnožje crta ljuska (app.js).
   Zavisi od: core.js (D, el, fmt, stats, applyFilters, filtersToParams, FILTER_DEFAULTS, setHash, router, TYPES),
   images.js (img), ui.js (card, badge, sectionHead, tiles, deltaChip, bars, agencyCard, photoCap, chip, icon), engine.js (KX). */
'use strict';

const HOME_ROUTES = {
  search: (params) => (typeof router !== 'undefined' && router.href ? router.href('/pretraga', params || {}) : '#/pretraga'),
  home: (params) => (typeof router !== 'undefined' && router.href ? router.href('/', params || {}) : '#/'),
  listing: (s) => '#/oglas?s=' + encodeURIComponent(s),
  project: (id) => '#/projekat?s=' + encodeURIComponent(id),
  article: (s) => '#/savet?s=' + encodeURIComponent(s),
};

/* ─────────── vidljivi oglasi — isti podrazumevani skup kao rezultati (search.js run()) ───────────
   Rezultati po defaultu kriju sporedne duplikate (dup ≠ 0) i oglase koje je korisnik sakrio (bez hid=1),
   pa se svaki broj na početnoj računa kroz ovaj filter — broj uz link = broj koji link otvara. */
const homeVisible = (() => {
  const hasKX = () => typeof KX !== 'undefined';
  const sec = (l) => { try { return hasKX() && !!KX.dupes && KX.dupes.isSecondary(l.s); } catch (e) { return false; } };
  const hidden = () => {
    try { const h = hasKX() && KX.profile ? KX.profile.get().hidden : null; return h instanceof Set ? h : new Set(h || []); } catch (e) { return new Set(); }
  };
  /* o.dup === false → prikaži i duplikate (dup=0); o.hid === true → prikaži i sakrivene (hid=1) */
  function filter(list, o = {}) {
    const h = o.hid ? null : hidden();
    const dup = o.dup !== false && hasKX();
    if (!dup && !(h && h.size)) return list;
    return list.filter((l) => !(dup && sec(l)) && !(h && h.has(l.s)));
  }
  /* opcije iz parametara pretrage (isto čitanje kao search.js: dup ≠ '0'/'false', hid ∈ {'1','true',''}) */
  function optsFromQs(qs) {
    try {
      const p = new URLSearchParams(qs || '');
      return { dup: !(p.get('dup') === '0' || p.get('dup') === 'false'), hid: p.has('hid') && ['1', 'true', ''].includes(p.get('hid')) };
    } catch (e) { return {}; }
  }
  filter.sec = sec; filter.hidden = hidden; filter.optsFromQs = optsFromQs;
  filter.sig = () => [...hidden()].sort().join(',');
  return filter;
})();

/* ─────────── podaci za početnu (deterministički, keš) ─────────── */
const homeData = (() => {
  let cache = null, cacheSig = null;
  const plural = (n, a, b, c) => (typeof fmt !== 'undefined' && fmt.plural ? fmt.plural(n, a, b, c) : (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c));
  const isPromo = (l) => l.pr === 'PREMIUM' || l.pr === 'TOP';
  const isNew = (l) => l.co === 'novogradnja' || l.co === 'u-izgradnji';

  /* Oglas nedelje: PREMIUM sa najviše pregleda među oglasima postavljenim ove nedelje (dz ≤ 7; ako ih nema — svi PREMIUM);
     jednak broj → prodaja, pa stan, pa najsvežiji, pa slug */
  /* duplikati (isti stan kod više agencija): na početnoj samo glavna ponuda (najjeftinija) i najviše jedna kartica po grupi */
  const isSec = (l) => { try { return typeof KX !== 'undefined' && !!KX.dupes && KX.dupes.isSecondary(l.s); } catch (e) { return false; } };
  const groupId = (l) => { try { const g = typeof KX !== 'undefined' && KX.dupes ? KX.dupes.groupOf(l.s) : null; return g ? g.id : null; } catch (e) { return null; } };

  function pickFeature(L) {
    const rank = (l) => [-(l.v || 0), l.t === 'prodaja' ? 0 : 1, l.pt === 'stan' ? 0 : 1, l.dz, l.s];
    const cmp = (a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; };
    const prem = L.filter((l) => l.pr === 'PREMIUM' && !isSec(l));
    const week = prem.filter((l) => l.dz <= 7);
    const pool = (week.length ? week : prem).sort(cmp);
    return { l: pool[0] || [...L].sort(cmp)[0], week: week.length > 0 };
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
      /* isto grupisanje kao content.js (projekti samo od stana, kuće i lokala) — linkovi #/projekat?s= uvek vode na projekat */
      if (l.t !== 'prodaja' || !l.ags || !isNew(l) || !(l.pt === 'stan' || l.pt === 'kuca' || l.pt === 'poslovni-prostor')) continue;
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
    /* sakriveni oglasi menjaju brojeve → keš važi samo za isti skup sakrivenih */
    const sig = homeVisible.sig();
    if (cache && cacheSig === sig) return cache;
    cacheSig = sig;
    const hid = homeVisible.hidden();
    const L = D.listings;
    const V = homeVisible(L);
    const pf = pickFeature(V);
    const feature = pf.l;
    const used = new Set([feature.s]);
    const usedG = new Set([groupId(feature)].filter(Boolean));
    const take = (l, out) => {
      if (used.has(l.s) || isSec(l) || hid.has(l.s)) return false;
      const g = groupId(l);
      if (g && usedG.has(g)) return false;
      out.push(l); used.add(l.s); if (g) usedG.add(g);
      return true;
    };
    /* obe sekcije samo iz prodaje: link („Svi izdvojeni“ = promo, „Svi novi“ = sort=new) otvara prodaju, pa svaka kartica mora biti u tom skupu */
    const promoted = L.filter((l) => l.t === 'prodaja' && isPromo(l));
    const week = promoted.filter((l) => l.dz <= 7);
    const pool = (week.length >= 4 ? week : promoted).slice().sort((a, b) => b.v - a.v || a.dz - b.dz || (a.s < b.s ? -1 : 1));
    const featured = [];
    for (const l of pool) { if (featured.length >= 4) break; take(l, featured); }
    const fresh = [];
    for (const l of L.filter((x) => x.t === 'prodaja').sort((a, b) => a.dz - b.dz || b.v - a.v || (a.s < b.s ? -1 : 1))) { if (fresh.length >= 4) break; take(l, fresh); }

    const byType = {}; const tByType = {};
    for (const l of V) { byType[l.pt] = (byType[l.pt] || 0) + 1; (tByType[l.pt] = tByType[l.pt] || { prodaja: 0, izdavanje: 0 })[l.t]++; }
    /* broj po gradu = oglasi za prodaju, jer link #/pretraga?c=… podrazumeva t=prodaja */
    const cityCount = {}; V.forEach((l) => { if (l.t === 'prodaja') cityCount[l.cs] = (cityCount[l.cs] || 0) + 1; });
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
      total: V.length, feature, featureWeek: pf.week, featured, fresh, promotedCount: homeVisible(promoted).length, newToday: V.filter((l) => l.dz <= 1).length,
      byType, tByType, cities, agencies, articles, market, natPpm, natN: sale.length,
      locations: buildLocations(V), projects: projPick.length >= 2 ? projPick : projects,
    };
    return cache;
  }
  return { get, plural };
})();

/* ─────────── kutija za pretragu: tabovi, tip, lokacija (autocomplete + čipovi + opis rečima), cena, živi broj ───────────
   Pravilo: broj na dugmetu = tačno ono što „Pretraži“ šalje (isti filters()). Rečenica u polju (KX.parseQuery) ima prednost nad
   kontrolama i kontrole to prikazuju: tab prati „kirija/prodaja“, cena prikazuje „do X“ iz rečenice, čipovi lokacije se precrtavaju. */
const HOME_RECENT_KEY = 'kv.recentSearches';
const homeRecent = {
  read() {
    try { const r = JSON.parse(localStorage.getItem(HOME_RECENT_KEY) || '[]'); return Array.isArray(r) ? r.filter((x) => x && x.label && x.params).slice(0, 5) : []; } catch (e) { return []; }
  },
  push(label, params) {
    try {
      const key = JSON.stringify(params);
      const r = homeRecent.read().filter((x) => JSON.stringify(x.params) !== key);
      r.unshift({ label, params });
      localStorage.setItem(HOME_RECENT_KEY, JSON.stringify(r.slice(0, 5)));
    } catch (e) { /* skladište nedostupno — pretraga ide dalje */ }
  },
};
const homeCountParams = (params) => {
  try {
    const qs = (typeof buildHash === 'function' ? buildHash('/pretraga', params) : router.buildHash('/pretraga', params)).split('?')[1] || '';
    return homeVisible(applyFilters(paramsToFilters(qs)), homeVisible.optsFromQs(qs)).length;
  } catch (e) { return null; }
};

/* stanje kutije u istoriji (#/?hs=…) da dugme Nazad vrati pretragu */
const homeState = {
  encode: (st) => [st.tab, st.pt, st.pmax, st.locs.map((x) => x.id).join(','), [...st.off].join(','), st.text].join('~'),
  decode(hs) {
    if (!hs || typeof hs !== 'string') return null;
    const p = hs.split('~');
    if (p.length < 6) return null;
    return { tab: p[0], pt: p[1], pmax: p[2], locs: p[3] ? p[3].split(',') : [], off: p[4] ? p[4].split(',') : [], text: p.slice(5).join('~') };
  },
};

function homeSearch(init) {
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
  const modeOf = (v) => (v === 'izdavanje' ? 'izdavanje' : 'prodaja');
  const chipKey = (ch) => ch.key + ':' + String(ch.value);
  const hasVal = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);
  const parse = (t) => (t.trim() && typeof KX !== 'undefined' && KX.parseQuery ? KX.parseQuery(t) : null);

  /* povratak dugmetom Nazad: vrati tab, tip, cenu, lokacije i tekst */
  const saved = homeState.decode(init && init.hs);
  if (saved) {
    if (TABS.some((t) => t.v === saved.tab)) st.tab = saved.tab;
    if (saved.pt === '' || TYPES.some((t) => t.v === saved.pt)) st.pt = saved.pt;
    if (/^\d+$/.test(saved.pmax)) st.pmax = saved.pmax;
    const byId = new Map(H.locations.map((x) => [x.id, x]));
    saved.locs.map((id) => byId.get(id)).filter(Boolean).forEach((x) => { if (!st.locs.length || st.locs[0].cs === x.cs) st.locs.push(x); });
    st.text = saved.text || '';
    st.parsed = parse(st.text);
    saved.off.forEach((k) => st.off.add(k));
  }

  /* tabovi (role=tablist, strelice levo/desno) */
  const tabBtns = TABS.map((t) => el('button', {
    type: 'button', role: 'tab', id: nid('tab'), 'aria-selected': t.v === st.tab ? 'true' : 'false', tabindex: t.v === st.tab ? '0' : '-1',
    onclick: () => setTab(t.v),
  }, t.l));
  const tabStrip = el('div', { class: 'tabs-ul', role: 'tablist', 'aria-label': 'Vrsta ponude' }, tabBtns);
  tabStrip.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.v === viewTab(textFilters()));
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[j].v); tabBtns[j].focus();
  });

  /* tip — ručna promena gasi tip iz rečenice */
  const typeSel = el('select', { id: nid('pt'), onchange: (e) => { st.pt = e.target.value; offKeys(['pt']); renderParse(); refresh(true); } },
    el('option', { value: '' }, 'Sve vrste'),
    TYPES.map((t) => el('option', { value: t.v, selected: t.v === st.pt }, t.l)));
  const fTip = el('div', { class: 'field f-tip' }, el('label', { for: typeSel.id }, 'Tip nekretnine'), el('div', { class: 'sel' }, typeSel, icon('chev-d')));

  /* cena do — ručna promena gasi cenu iz rečenice */
  const priceSel = el('select', { id: nid('pmax'), onchange: (e) => { st.pmax = e.target.value; offKeys(['pmax']); renderParse(); refresh(true); } });
  const validPmax = (mode) => (PRICES[mode].map(String).includes(String(st.pmax)) ? String(st.pmax) : '');
  let priceSig = '';
  function fillPrices(pf) {
    const mode = modeOf(viewTab(pf));
    const fromText = pf && hasVal(pf.pmax) ? String(pf.pmax) : '';
    const sel = fromText || validPmax(mode);
    const sig = mode + '|' + fromText + '|' + sel;
    if (sig === priceSig) return;
    priceSig = sig;
    const vals = PRICES[mode].slice();
    if (fromText && !vals.includes(+fromText)) { vals.push(+fromText); vals.sort((a, b) => a - b); }
    priceSel.innerHTML = '';
    priceSel.append(el('option', { value: '' }, 'Bilo koja'), ...vals.map((p) => el('option', { value: p }, fmt.price(p, mode))));
    priceSel.value = sel;
  }
  const fPrice = el('div', { class: 'field f-price' }, el('label', { for: priceSel.id }, 'Cena do'), el('div', { class: 'sel' }, priceSel, icon('chev-d')));

  /* lokacija: combobox + čipovi */
  const listId = nid('ac');
  const PH = 'Grad, naselje ili ulica';
  const input = el('input', {
    type: 'text', id: nid('loc'), autocomplete: 'off', spellcheck: 'false', placeholder: PH,
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId,
  });
  input.value = st.text;
  const chipBox = el('span', { class: 'loc-chips' });
  /* „Izaberi iz liste“: Grad → Opština → Naselje sa brojevima (za one koji ne znaju tačan naziv kraja) */
  const pickBtn = el('button', { type: 'button', class: 'hm-pick', 'aria-haspopup': 'dialog', 'aria-label': 'Izaberi lokaciju iz liste', onclick: () => openPicker() },
    icon('list', 16), el('span', { class: 'l1' }, 'Izaberi iz liste'), el('span', { class: 'l2' }, 'Lista'));
  const fLoc = el('div', { class: 'field f-loc' }, el('div', { class: 'f-lh' }, el('label', { for: input.id }, 'Lokacija'), pickBtn), el('div', { class: 'loc-in' }, chipBox, input));
  const list = el('ul', { class: 'hm-ac', id: listId, role: 'listbox', 'aria-label': 'Predlozi lokacija', hidden: true });

  /* dugme sa živim brojem */
  const cnt = el('span', { class: 'cnt' }, '');
  const goBtn = el('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, icon('search'), 'Pretraži', cnt);
  const live = el('span', { class: 'sr', 'aria-live': 'polite' });
  const form = el('form', { class: 'fields', role: 'search', 'aria-label': 'Pretraga nekretnina', id: nid('form'), onsubmit: (e) => { e.preventDefault(); submit(); } },
    fTip, fLoc, fPrice, el('div', { class: 'go' }, goBtn));
  tabBtns.forEach((b) => b.setAttribute('aria-controls', form.id));
  const box = el('div', { class: 'search' }, tabStrip, form);

  /* ispod kutije: obaveštenja → prepoznato/primeri → nedavne pretrage → „Više filtera“ + budžet */
  const msg = el('p', { class: 'hm-msg', role: 'status' });
  const locNote = el('p', { class: 'hm-msg hm-locnote', role: 'status' });
  const parseRow = el('div', { class: 'hm-parse' });
  const recentRow = el('div', { class: 'hm-recent', hidden: true });
  const moreLink = el('a', { href: HOME_ROUTES.search({}) }, 'sobe, sprat, stanje, grejanje…');

  /* D7: „Imam ___ €“ → mapa u režimu budžeta sa iznosom */
  const bIn = el('input', { type: 'text', inputmode: 'numeric', id: nid('b'), autocomplete: 'off', placeholder: '120.000', 'aria-label': 'Budžet u evrima' });
  const bCur = el('span', { class: 'cur', 'aria-hidden': 'true' }, '€');
  const bWrap = el('span', { class: 'b-in' }, bIn, bCur);
  let bMode = 'prodaja';
  /* u režimu izdavanja iznos je mesečna kirija: drugi primer, „€/mes“ i opis za čitače ekrana */
  function syncBudget(mode) {
    if (mode === bMode) return;
    bMode = mode;
    const rent = mode === 'izdavanje';
    bIn.placeholder = rent ? '500' : '120.000';
    bIn.setAttribute('aria-label', rent ? 'Mesečna kirija u evrima' : 'Budžet u evrima');
    bCur.textContent = rent ? '€/mes' : '€';
    bWrap.classList.toggle('rent', rent);
  }
  const bAmount = () => {
    /* srpski zapis: tačka = hiljade, zarez = decimale; „85,5k“ = 85.500, „1,5 mil“ = 1.500.000, „120.000,50“ = 120.001 */
    const raw = String(bIn.value).toLowerCase().replace(/\s/g, '').replace(/[€e]+$|eur\w*$/, '');
    const m = raw.match(/^(\d[\d.]*)(?:,(\d+))?(k|hilj\w*|mil\w*)?/);
    if (!m) return 0;
    /* „1.5k“: tačka bez grupe od tri cifre je decimalna */
    const dotDec = !m[2] && /^\d+\.\d{1,2}$/.test(m[1]);
    const val = dotDec ? +m[1] : +(m[1].replace(/\./g, '') + '.' + (m[2] || '0'));
    const mul = !m[3] ? 1 : m[3].startsWith('mil') ? 1e6 : 1000;
    const n = Math.round(val * mul);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  bIn.addEventListener('blur', () => { const n = bAmount(); if (n) bIn.value = fmt.num(n); });
  const bForm = el('form', {
    class: 'hm-budget', 'aria-label': 'Koliko kvadrata za tvoj budžet',
    onsubmit: (e) => {
      e.preventDefault();
      const n = bAmount();
      const pf = textFilters();
      const c = pf && pf.c ? pf.c : st.locs.length ? st.locs[0].cs : '';
      /* mapa budžeta računa za vrstu ponude i tip iz kutije: „Izdavanje“ / „kirija“ → mesečna kirija, „Kuće“ → kuće */
      const t = modeOf(viewTab(pf)) === 'izdavanje' ? 'izdavanje' : '';
      const pt = pf && pf.pt && pf.pt.length ? (pf.pt.length === 1 ? pf.pt[0] : '') : st.pt;
      const P = { m: 'budzet', b: n || '', c, t, pt: pt || '' };
      location.hash = (typeof router !== 'undefined' && router.href ? router.href('/mapa', P)
        : '#/mapa?' + Object.keys(P).filter((k) => P[k] !== '').map((k) => k + '=' + encodeURIComponent(P[k])).join('&'));
    },
  },
  el('label', { for: bIn.id }, 'Imam'),
  bWrap,
  el('button', { class: 'btn btn-secondary btn-sm', type: 'submit' }, icon('ruler'), 'Koliko kvadrata?'));

  /* drugi načini pretrage: oblast nacrtana na mapi, vreme puta do mojih mesta */
  const drawLink = el('a', { href: '#/mapa?draw=1' }, icon('draw', 16), 'Nacrtaj oblast na mapi');
  const ways = el('p', { class: 'hm-ways' }, drawLink, el('a', { href: '#/moja-mesta' }, icon('clock', 16), 'Pretraga po udaljenosti'));
  const more = el('div', { class: 'hm-more' }, el('p', { class: 'search-more' }, 'Više filtera: ', moreLink), bForm, ways);
  const root = el('div', { class: 'hm-search' }, box, list, msg, locNote, parseRow, recentRow, more, live);

  /* ── stanje → filteri ── */
  function locFilters(locs = st.locs) {
    const f = { c: '', m: [], n: [] };
    if (!locs.length) return f;
    f.c = locs[0].cs;
    const ms = locs.filter((x) => x.kind === 'm').map((x) => x.s);
    const ns = locs.filter((x) => x.kind === 'n').map((x) => x.s);
    if (ms.length && ns.length) {
      /* opština ILI naselje: core spaja m i n sa I, pa opštine razvijamo u njihova naselja */
      const set = new Set(ns);
      H.locations.forEach((x) => { if (x.kind === 'n' && ms.includes(x.ms)) set.add(x.s); });
      f.n = [...set];
    } else { f.m = ms; f.n = ns; }
    return f;
  }
  /* filteri iz teksta (bez isključenih čipova); null kad je polje prazno */
  function textFilters() {
    if (!st.text.trim() || !st.parsed) return null;
    const f = JSON.parse(JSON.stringify(st.parsed.filters || {}));
    for (const ch of st.parsed.chips || []) {
      if (!st.off.has(chipKey(ch)) || ch.key === 'route') continue;
      if (Array.isArray(f[ch.key])) { f[ch.key] = f[ch.key].filter((v) => String(v) !== String(ch.value)); if (!f[ch.key].length) delete f[ch.key]; }
      else delete f[ch.key];
      if (ch.key === 'm' || ch.key === 'n') { if (!(f.m && f.m.length) && !(f.n && f.n.length) && !st.parsed.chips.some((x) => x.key === 'c' && !st.off.has(chipKey(x)))) delete f.c; }
    }
    return f;
  }
  const locOverride = (pf) => !!pf && Object.keys(pf).some((k) => LOCKEYS.has(k) && hasVal(pf[k]));
  /* tab koji se prikazuje: rečenica sa „kirija/izdavanje/prodaja“ ima prednost */
  function viewTab(pf) {
    if (pf && pf.t === 'izdavanje') return 'izdavanje';
    if (pf && pf.t === 'prodaja' && st.tab === 'izdavanje') return 'prodaja';
    return st.tab;
  }
  function filters() {
    const pf = textFilters();
    const vt = viewTab(pf);
    const vp = validPmax(modeOf(vt));
    const f = { ...FILTER_DEFAULTS, t: modeOf(vt), newbuild: vt === 'novogradnja', pt: st.pt ? [st.pt] : [], pmax: vp === '' ? '' : +vp, ...locFilters() };
    if (pf) {
      if (locOverride(pf)) { f.c = ''; f.m = []; f.n = []; }
      Object.assign(f, pf);
    }
    return f;
  }
  /* ručna promena kontrole gasi odgovarajući uslov iz rečenice */
  function offKeys(keys) {
    if (!st.parsed || !st.text.trim()) return;
    (st.parsed.chips || []).forEach((ch) => { if (keys.includes(ch.key)) st.off.add(chipKey(ch)); });
  }
  /* kontrole prikazuju stvarno stanje pretrage */
  function syncControls(pf) {
    const vt = viewTab(pf);
    tabBtns.forEach((b, i) => { const on = TABS[i].v === vt; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    fillPrices(pf);
    syncBudget(modeOf(vt));
    fPrice.classList.toggle('from-text', !!(pf && hasVal(pf.pmax)));
    const tp = pf && pf.pt && pf.pt.length ? (pf.pt.length === 1 ? pf.pt[0] : '') : st.pt;
    if (typeSel.value !== tp) typeSel.value = tp;
    fTip.classList.toggle('from-text', !!(pf && pf.pt && pf.pt.length));
    const over = st.locs.length > 0 && locOverride(pf);
    fLoc.classList.toggle('loc-off', over);
    chipBox.querySelectorAll('.tag').forEach((t) => t.classList.toggle('off', over));
    const note = over ? 'Lokacija iz rečenice zamenjuje izabrane.' : '';
    if (locNote.textContent !== note) locNote.textContent = note;
  }

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
    /* telefon: lista ne sme da ode ispod donje navigacije — visina = prostor između polja (posle pomeranja) i navigacije */
    if (narrow) {
      const nav = document.querySelector('.bnav');
      const navTop = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight;
      const fTop = locScrolling ? hdrBottom() + 8 : f.top;
      const room = Math.floor(navTop - (fTop + f.height + 4) - 8);
      list.style.maxHeight = Math.max(144, Math.min(372, room)) + 'px';
    } else list.style.maxHeight = '';
  }
  /* telefon: polje Lokacija ide odmah ispod zaglavlja kad za predloge nema mesta (inače bi lista bila iza donje navigacije / tastature) */
  let locScrolling = false, tScroll = 0;
  const hdrBottom = () => { const h = document.querySelector('.hdr'); const r = h ? h.getBoundingClientRect() : null; return r && r.bottom > 0 ? r.bottom : 0; };
  function revealLoc() {
    const r = root.getBoundingClientRect();
    if (!r.width || r.width >= 560 || !fLoc.scrollIntoView) return;
    const f = fLoc.getBoundingClientRect();
    const nav = document.querySelector('.bnav');
    const navTop = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight;
    const top = hdrBottom() + 8;
    /* dovoljno mesta za bar četiri predloga ispod polja i polje nije pod zaglavljem → ne pomeraj */
    if (f.top >= top - 1 && navTop - f.bottom >= 4 * 48 + 24) return;
    /* odmah, bez animacije: kucanje pomera kursor u vidno polje i prekinulo bi glatko pomeranje na pola puta */
    locScrolling = true; clearTimeout(tScroll);
    fLoc.scrollIntoView({ block: 'start', behavior: 'auto' });
    tScroll = setTimeout(() => { locScrolling = false; if (st.open) placeList(); }, 60);
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
    if (!p || !p.chips) return false;
    /* „ili: Palilula (Niš)“ je samo ponuđena alternativa, ne uslov — jedno dvosmisleno ime je i dalje izbor lokacije */
    const ch = p.chips.filter((c) => c.key !== 'alt');
    if (!ch.length) return false;
    return ch.some((c) => !LOCKEYS.has(c.key)) || ch.length > 1 || (p.unparsed && p.unparsed.length > 0 && !st.sugg.length);
  }
  function pick(i) {
    const x = st.sugg[i];
    if (!x) return;
    let note = '';
    if (st.locs.length && st.locs[0].cs !== x.cs) { note = `Pretraga radi u jednom gradu — prethodne lokacije su uklonjene. Sada: ${x.c || x.label}.`; st.locs = []; }
    if (x.kind === 'c') st.locs = st.locs.filter((y) => y.cs !== x.cs);
    else st.locs = st.locs.filter((y) => !(y.kind === 'c' && y.cs === x.cs));
    st.locs.push(x);
    st.text = ''; input.value = ''; st.parsed = null; st.off.clear();
    msg.textContent = note;
    renderChips(); closeList(); renderParse(); refresh(true);
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
    input.placeholder = st.locs.length ? 'Dodaj još…' : PH;
    fLoc.classList.toggle('has-chips', st.locs.length > 0);
  }

  input.addEventListener('input', () => {
    st.text = input.value; st.off.clear();
    st.parsed = parse(st.text);
    openList(); renderParse(); refresh(false);
  });
  input.addEventListener('focus', () => { revealLoc(); if (!st.open) openList(); });
  input.addEventListener('blur', () => setTimeout(() => { if (!root.contains(document.activeElement)) closeList(); }, 120));
  input.addEventListener('keydown', (e) => {
    const n = st.sugg.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!st.open) { openList(); return; } if (n) { st.active = (st.active + 1) % n; renderList(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (st.open && n) { st.active = st.active <= 0 ? n - 1 : st.active - 1; renderList(); } }
    else if (e.key === 'Home' && st.open && n && !input.value) { e.preventDefault(); st.active = 0; renderList(); }
    else if (e.key === 'Enter') { if (st.open && st.active >= 0) { e.preventDefault(); pick(st.active); } }
    else if (e.key === 'Escape') { if (st.open) { e.preventDefault(); closeList(); } else if (input.value) { e.preventDefault(); input.value = ''; input.dispatchEvent(new Event('input')); closeList(); } }
    else if (e.key === 'Backspace' && !input.value && st.locs.length) { e.preventDefault(); removeLoc(st.locs[st.locs.length - 1].id); }
    else if (e.key === 'Tab') closeList();
  });
  homeSearch.place = () => { if (st.open && root.isConnected) placeList(); };

  /* ── rečenica → čipovi (KX.parseQuery) ──
     Primeri se proveravaju na podacima: prikazuju se samo oni koji daju rezultate (prvo dva koja prođu). */
  const EXAMPLE_POOL = ['dvosoban vračar do 300k', 'garsonjera kirija do 400 €', 'trosoban novi sad', 'dvosoban novi beograd uknjižen', 'garsonjera izdavanje'];
  const examples = (() => {
    if (typeof KX === 'undefined' || !KX.parseQuery) return [];
    const out = [];
    for (const ex of EXAMPLE_POOL) {
      if (out.length >= 2) break;
      try {
        const p = KX.parseQuery(ex);
        const n = homeVisible(applyFilters({ ...FILTER_DEFAULTS, t: 'prodaja', pt: ['stan'], ...p.filters })).length;
        if (n > 0) out.push(ex);
      } catch (e) { /* preskoči */ }
    }
    return out;
  })();
  function renderParse() {
    parseRow.innerHTML = '';
    const p = st.parsed;
    if (st.text.trim() && p && p.chips && p.chips.length && freeTextMode()) {
      const chips = p.chips.map((ch) => {
        if (ch.key === 'alt') {
          /* alternativa istog imena u drugom gradu: dugme zamenjuje lokaciju iz rečenice tom alternativom */
          const alt = H.locations.find((x) => x.id === 'm:' + ch.value) || H.locations.find((x) => x.id === 'n:' + ch.value);
          if (!alt || st.locs.some((y) => y.id === alt.id)) return null;
          const lbl = ch.label.replace(/^ili:\s*/, '');
          return el('button', {
            type: 'button', class: 'hm-ex hm-alt', 'aria-label': 'Traži umesto toga: ' + lbl,
            onclick: () => { offKeys(['c', 'm', 'n']); st.locs = [alt]; msg.textContent = 'Lokacija promenjena: ' + lbl + '.'; renderChips(); renderParse(); refresh(true); input.focus(); },
          }, 'ili: ', el('b', {}, lbl));
        }
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
    } else if (examples.length) {
      parseRow.classList.remove('on');
      parseRow.append(el('span', { class: 'lbl' }, 'Ili opiši rečima'),
        el('span', { class: 'chips' }, examples.map((ex) => el('button', {
          type: 'button', class: 'hm-ex', onclick: () => { input.value = ex; input.dispatchEvent(new Event('input')); closeList(); refresh(true); input.focus(); },
        }, '„' + ex + '“'))));
    }
  }

  /* ── nedavne pretrage (kv.recentSearches, poslednjih 5) sa današnjim brojem ── */
  function renderRecent() {
    const r = homeRecent.read();
    recentRow.innerHTML = '';
    recentRow.hidden = !r.length;
    if (!r.length) return;
    recentRow.append(el('span', { class: 'lbl' }, 'Nedavne pretrage'),
      el('span', { class: 'chips' }, r.map((x) => {
        const n = homeCountParams(x.params);
        return el('a', {
          class: 'tag hm-rtag', href: HOME_ROUTES.search(x.params),
          'aria-label': n == null ? x.label : `${x.label} — ${fmt.num(n)} ${pl(n, 'oglas', 'oglasa', 'oglasa')} danas`,
        }, el('span', { class: 'lb' }, x.label), n == null ? null : el('span', { class: 'k' }, fmt.num(n)));
      })));
  }
  /* opis pretrage za čip: „Dvosoban, Vračar, do 300.000 €“ */
  function labelFor(f) {
    const pf = textFilters();
    const parts = [];
    if (f.t === 'izdavanje') parts.push('Izdavanje'); else if (f.newbuild) parts.push('Novogradnja');
    const rooms = (f.ro || []).map((v) => { const r = (typeof ROOMS !== 'undefined' ? ROOMS : []).find((x) => x[0] === +v); return r ? r[1] : fmt.rooms(+v); });
    if (rooms.length) parts.push(...rooms);
    else if (f.pt && f.pt.length === 1) { const t = TYPES.find((x) => x.v === f.pt[0]); if (t) parts.push(t.l); }
    else if (!f.pt || !f.pt.length) parts.push('Sve vrste');
    if (locOverride(pf)) (st.parsed.chips || []).forEach((ch) => { if (LOCKEYS.has(ch.key) && !st.off.has(chipKey(ch))) parts.push(ch.label); });
    else st.locs.forEach((x) => parts.push(x.label));
    if (hasVal(f.pmin)) parts.push('od ' + fmt.price(+f.pmin, f.t));
    if (hasVal(f.pmax)) parts.push('do ' + fmt.price(+f.pmax, f.t));
    const SKIP = new Set(['ro', 't', 'pmax', 'pmin', 'c', 'm', 'n', 'pt', 'route']);
    if (pf && st.parsed) (st.parsed.chips || []).forEach((ch) => { if (!SKIP.has(ch.key) && !st.off.has(chipKey(ch))) parts.push(ch.label); });
    if (f.q) parts.push('„' + f.q + '“');
    const s = [...new Set(parts)].join(', ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ── tabovi (ručni izbor; ako se razlikuje od rečenice, gasi „kirija/prodaja“ iz teksta) ── */
  function setTab(v) {
    const pf = textFilters();
    if (pf && pf.t && pf.t !== modeOf(v)) offKeys(['t']);
    st.tab = v;
    if (!validPmax(modeOf(v))) st.pmax = '';
    renderParse(); refresh(true);
  }

  /* ── živi broj (debounce) ── */
  let tCount = 0, tLive = 0;
  function refresh(now) {
    clearTimeout(tCount);
    const run = () => {
      const f = filters();
      syncControls(textFilters());
      let n = 0;
      try { n = homeVisible(applyFilters(f)).length; } catch (e) { n = 0; }
      cnt.textContent = '· ' + fmt.num(n);
      goBtn.setAttribute('aria-label', `Pretraži — ${fmt.num(n)} ${pl(n, 'oglas', 'oglasa', 'oglasa')}`);
      moreLink.href = HOME_ROUTES.search(filtersToParams(f));
      drawLink.href = '#/mapa?' + [f.c ? 'c=' + encodeURIComponent(f.c) : '', f.t === 'izdavanje' ? 't=izdavanje' : '', 'draw=1'].filter(Boolean).join('&');
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
    /* broj uz predlog = ono što link otvara (bez sporednih duplikata i sakrivenih), ne sirovi KX.relax count */
    try {
      r = KX.relax(f).map((x) => { let c = x.count; try { c = homeVisible(applyFilters({ ...FILTER_DEFAULTS, ...x.filters })).length; } catch (e) { /* zadrži KX broj */ } return { ...x, count: c }; })
        .filter((x) => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 2);
    } catch (e) { r = []; }
    if (!r.length) return;
    parseRow.after(el('p', { class: 'hm-zero' }, 'Nema oglasa za ovu kombinaciju. Najmanja promena: ',
      r.map((x, i) => [i ? ' · ' : '', el('a', { href: HOME_ROUTES.search(filtersToParams({ ...FILTER_DEFAULTS, ...x.filters })) }, `${x.label} (${fmt.num(x.count)})`)])));
  }

  /* ── „Izaberi iz liste“: list sa opštinama izabranog grada (polja za potvrdu), svaka se razvija u naselja sa brojem oglasa ── */
  function openPicker() {
    if (typeof sheet !== 'function') return;
    const cities = H.locations.filter((x) => x.kind === 'c' && x.count > 0).sort((a, b) => b.count - a.count);
    if (!cities.length) return;
    let cs = st.locs.length ? st.locs[0].cs : (cities.find((x) => x.s === 'beograd') || cities[0]).s;
    let sel = new Set(st.locs.filter((x) => x.kind !== 'c').map((x) => x.id));
    const open = new Set(), shut = new Set();
    const byId = new Map(H.locations.map((x) => [x.id, x]));
    const coll = (a, b) => a.label.localeCompare(b.label, 'sr');
    const citySel = el('select', { id: nid('pkc'), onchange: () => { cs = citySel.value; sel = new Set(); open.clear(); shut.clear(); draw(); } },
      cities.map((c) => el('option', { value: c.s, selected: c.s === cs }, `${c.label} (${fmt.num(c.count)})`)));
    const listBox = el('div', { class: 'hm-pk-list' });
    const sum = el('p', { class: 'hm-pk-sum', 'aria-live': 'polite' });
    const okBtn = el('button', { type: 'button', class: 'btn btn-ink', onclick: () => apply() }, 'Primeni');
    const clrBtn = el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { sel = new Set(); draw(); } }, 'Ceo grad');
    const chosen = () => [...sel].map((id) => byId.get(id)).filter((x) => x && x.cs === cs)
      .sort((a, b) => (a.kind === b.kind ? coll(a, b) : a.kind === 'm' ? -1 : 1));
    function draw() {
      /* ponovno crtanje ne sme da izgubi fokus ni položaj skrola u listu */
      const ae = document.activeElement;
      const fid = ae && ae.dataset ? ae.dataset.pk : null;
      const scroller = listBox.closest('.bd');
      const top = scroller ? scroller.scrollTop : 0;
      listBox.innerHTML = '';
      const muns = H.locations.filter((x) => x.kind === 'm' && x.cs === cs && x.count > 0).sort(coll);
      muns.forEach((m) => {
        const nbs = H.locations.filter((x) => x.kind === 'n' && x.cs === cs && x.ms === m.s && x.count > 0 && fmt.fold(x.label) !== m.fold).sort(coll);
        const mOn = sel.has(m.id);
        const nPicked = mOn ? 0 : nbs.filter((n) => sel.has(n.id)).length;
        /* razvijeno: ručno otvoreno ili ima izabrana naselja (dok ga korisnik ne skupi) */
        const isOpen = open.has(m.id) || (nPicked > 0 && !shut.has(m.id));
        const row = el('div', { class: 'hm-pk-m' + (isOpen ? ' open' : '') },
          tagCheck(check(m.label, mOn, (on) => { if (on) { sel.add(m.id); nbs.forEach((n) => sel.delete(n.id)); } else sel.delete(m.id); draw(); }, { count: m.count }), m.id),
          nbs.length ? el('button', {
            type: 'button', class: 'iconbtn hm-pk-x', 'aria-expanded': isOpen ? 'true' : 'false',
            'aria-label': `${isOpen ? 'Sakrij' : 'Prikaži'} naselja: ${m.label}${nPicked ? ` (izabrano ${nPicked})` : ''}`,
            onclick: (e) => toggleRow(m.id, e.currentTarget.getAttribute('aria-expanded') !== 'true'),
          }, icon(isOpen ? 'chev-u' : 'chev-d', 16)) : null);
        const sub = nbs.length ? el('div', { class: 'hm-pk-ns', hidden: !isOpen },
          nbs.map((n) => {
            const c = check(n.label, mOn || sel.has(n.id), (on) => { if (on) sel.add(n.id); else sel.delete(n.id); draw(); }, { count: n.count });
            if (mOn) { const i = c.querySelector('input'); i.disabled = true; c.classList.add('dis'); }
            return tagCheck(c, n.id);
          })) : null;
        listBox.append(el('div', { class: 'hm-pk-g', 'data-id': m.id }, row, sub));
      });
      const pick = chosen();
      const city = cities.find((c) => c.s === cs);
      const locs = pick.length ? pick : city ? [city] : [];
      let n = 0;
      /* isti broj kao dugme Pretraži posle primene (lokacija iz liste zamenjuje lokaciju iz rečenice) */
      try { n = homeVisible(applyFilters({ ...filters(), ...locFilters(locs) })).length; } catch (e) { n = 0; }
      sum.textContent = pick.length ? `Izabrano: ${pick.map((x) => x.label).join(', ')}` : `Ceo grad: ${city ? city.label : ''}`;
      okBtn.textContent = `Primeni · ${fmt.num(n)} ${pl(n, 'oglas', 'oglasa', 'oglasa')}`;
      clrBtn.disabled = !pick.length;
      if (scroller) scroller.scrollTop = top;
      if (fid) { const f = listBox.querySelector(`[data-pk="${CSS.escape(fid)}"]`); if (f && !f.disabled) f.focus({ preventScroll: true }); }
    }
    function tagCheck(lbl, id) { const i = lbl.querySelector('input'); if (i) i.dataset.pk = id; return lbl; }
    /* razvijanje bez ponovnog crtanja (fokus ostaje na dugmetu) */
    function toggleRow(id, on) {
      if (on) { open.add(id); shut.delete(id); } else { open.delete(id); shut.add(id); }
      const g = listBox.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!g) return;
      const b = g.querySelector('.hm-pk-x'), sub = g.querySelector('.hm-pk-ns');
      if (sub) sub.hidden = !on;
      g.firstChild.classList.toggle('open', on);
      if (b) {
        b.setAttribute('aria-expanded', on ? 'true' : 'false');
        b.setAttribute('aria-label', b.getAttribute('aria-label').replace(/^(Sakrij|Prikaži)/, on ? 'Sakrij' : 'Prikaži'));
        b.lastChild.replaceWith(icon(on ? 'chev-u' : 'chev-d', 16));
      }
    }
    function apply() {
      const pick = chosen();
      const city = cities.find((c) => c.s === cs);
      offKeys(['c', 'm', 'n']);
      st.locs = pick.length ? pick : city ? [city] : [];
      msg.textContent = '';
      renderChips(); renderParse(); refresh(true);
      if (sh) sh.close();
      requestAnimationFrame(() => pickBtn.focus());
    }
    const body = el('div', { class: 'hm-pk' },
      el('div', { class: 'hm-pk-city' }, el('label', { for: citySel.id }, 'Grad'), el('div', { class: 'sel' }, citySel, icon('chev-d', 16))),
      sum,
      el('p', { class: 'hm-pk-t' }, 'Opštine i naselja'),
      listBox);
    draw();
    let sh = null;
    try { sh = sheet('Izaberi lokaciju', body, { footer: [clrBtn, okBtn], onClose: () => requestAnimationFrame(() => { if (!document.activeElement || document.activeElement === document.body) pickBtn.focus(); }) }); } catch (e) { sh = null; }
  }

  function submit() {
    const p = st.parsed;
    /* naredba („kalkulator“, „KV-1112899“) bez drugih uslova → otvori tu stranu */
    if (st.text.trim() && p && p.route && p.chips.length && p.chips.every((c) => c.key === 'route')) { location.hash = p.route; return; }
    const f = filters();
    const params = filtersToParams(f);
    /* u nedavne idu samo pretrage sa rezultatima (prazne ne pomažu pri povratku) */
    let n = 0; try { n = homeVisible(applyFilters(f)).length; } catch (e) { n = 0; }
    if (n > 0) homeRecent.push(labelFor(f), params);
    /* upiši stanje kutije u trenutni unos istorije (bez hashchange) → Nazad vraća pretragu */
    try {
      const cur = typeof parseHash === 'function' ? parseHash() : { path: '/' };
      if (cur.path === '/' && history.replaceState) history.replaceState(history.state, '', HOME_ROUTES.home({ hs: homeState.encode(st) }));
    } catch (e) { /* bez istorije — samo nastavi */ }
    setHash('/pretraga', params);
  }

  renderChips(); renderParse(); renderRecent(); refresh(true);
  return root;
}

/* jedan globalni slušalac (bez curenja pri ponovnom renderu) */
window.addEventListener('resize', () => { if (homeSearch.place) homeSearch.place(); });

/* ─────────── sekcije ─────────── */
/* tri oblika množine po vrsti (1 / 2–4 / 5+): „52 poslovna prostora“, „37 zemljišta“ */
const HOME_TYPE_FORMS = {
  stan: ['stan', 'stana', 'stanova'], kuca: ['kuća', 'kuće', 'kuća'], 'poslovni-prostor': ['poslovni prostor', 'poslovna prostora', 'poslovnih prostora'],
  zemljiste: ['zemljište', 'zemljišta', 'zemljišta'], garaza: ['garaža', 'garaže', 'garaža'], soba: ['soba', 'sobe', 'soba'], vikendica: ['vikendica', 'vikendice', 'vikendica'],
};

function homeHero(init) {
  const H = homeData.get();
  const pl = homeData.plural;
  const l = H.feature;
  const cityN = D.cities.length, agN = D.agencies.length, munN = D.muns.length;

  const types = TYPES.map((t) => {
    const tt = H.tByType[t.v] || {};
    const tr = (tt.izdavanje || 0) > (tt.prodaja || 0) ? 'izdavanje' : 'prodaja';
    /* broj = tačno ono što link otvara (jedna vrsta ponude), ne zbir prodaje i izdavanja */
    const params = { t: tr, pt: t.v };
    const c = homeCountParams(params);
    const n = c == null ? (tt[tr] || 0) : c;
    if (!n) return null;
    const F = HOME_TYPE_FORMS[t.v];
    return el('a', { href: HOME_ROUTES.search(params), title: tr === 'izdavanje' ? 'Izdavanje' : 'Prodaja' }, el('b', {}, fmt.num(n)), F ? pl(n, F[0], F[1], F[2]) : t.pl);
  });

  const copy = el('div', { class: 'hm-copy' },
    el('p', { class: 'eyebrow' }, 'Nekretnine · Srbija'),
    el('h1', { class: 't-hero hm-h1', id: 'hm-h1' }, 'Znaj koliko', el('br'), 'vredi ', el('em', {}, 'svaki'), el('br'), 'kvadrat.'),
    el('p', { class: 'lede hm-lede' },
      `${fmt.num(H.total)} ${pl(H.total, 'oglas', 'oglasa', 'oglasa')} iz ${cityN} ${pl(cityN, 'grada', 'grada', 'gradova')}, ${fmt.num(H.newToday)} ${pl(H.newToday, 'nov', 'nova', 'novih')} od juče. `,
      'Uz svaki oglas vidiš cenu po m² u odnosu na prosek kraja — i koliko te stan zaista košta.'),
    homeSearch(init),
    tiles([
      { v: fmt.num(H.total), l: 'aktivnih oglasa' },
      { v: String(cityN), l: pl(cityN, 'grad', 'grada', 'gradova') },
      { v: String(agN), l: pl(agN, 'agencija', 'agencije', 'agencija') },
      { v: String(munN), l: pl(munN, 'opština', 'opštine', 'opština') + ' ' + pl(munN, 'i zona', 'i zone', 'i zona') },
    ]),
    el('nav', { class: 'types', 'aria-label': 'Brze pretrage po vrsti' }, types));

  const ph = el('div', { class: 'ph r45', role: 'img', 'aria-label': `Oglas nedelje: ${l.ti}` });
  ph.innerHTML = img.hero();
  const facts = [l.ro ? fmt.rooms(l.ro) : null, l.a ? fmt.m2(l.a) : null, fmt.price(l.p, l.t)].filter(Boolean).join(' · ');
  ph.append(photoCap({ eyebrow: 'Oglas nedelje', title: `${l.n}, ${l.m && l.m !== l.n ? l.m : l.c}`, facts, link: { href: HOME_ROUTES.listing(l.s), label: 'Pogledaj oglas' } }));
  const feature = el('figure', { class: 'hm-feature' }, ph,
    el('figcaption', { class: 'sr' }, `Oglas nedelje — ${l.ti}, ${fmt.price(l.p, l.t)}. Izabran kao premium oglas sa najviše pregleda${H.featureWeek ? ' među oglasima postavljenim ove nedelje' : ''}.`));

  return el('section', { class: 'hm-hero', 'aria-labelledby': 'hm-h1' }, copy, feature);
}

function homeCards(list, opts = {}) {
  return el('div', { class: 'cards' + (opts.cls ? ' ' + opts.cls : '') }, list.map((l) => {
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
    l: `${x.c} · medijana za stan · n=${x.n}`,
    delta: deltaChip({ pct: x.change12 }, { title: `${fmt.pct(x.change12, { sign: true })} za 12 meseci u ${x.loc} (procena)` }),
  }));
  const six = H.market.slice(0, 6);
  return el('div', { class: 'hm-market' },
    el('div', { class: 'hm-m-tiles' },
      el('p', { class: 'eyebrow' }, 'Cena po m² (medijana) · Δ 12 meseci'),
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
      /* naziv projekta isti kao na stranicama novogradnje (contentProjects iz content.js), inače mesto */
      title: (() => { try { const cp = typeof window.contentProjects === 'function' ? window.contentProjects().find((x) => x.id === p.id) : null; if (cp && cp.name) return cp.name; } catch (e) { /* content.js nije učitan */ } return `${p.n}, ${p.m && p.m !== p.n ? p.m : p.c}`; })(),
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

/* „Nastavi gde si stao“ — samo za korisnike koji se vraćaju: sačuvane pretrage sa današnjim brojem + poslednje gledani oglasi.
   Podaci sa ovog uređaja (store.searches, store.recent); bez ičega — sekcija se ne crta. */
function homeResume() {
  const pl = homeData.plural;
  let searches = [], recent = [], recs = [];
  const by = new Map(D.listings.map((l) => [l.s, l]));
  try { searches = (store.searches || []).slice(0, 3); } catch (e) { searches = []; }
  try { recent = (store.recent || []).map((s) => by.get(s)).filter(Boolean).slice(0, 6); } catch (e) { recent = []; }
  /* „Preporučeno za tebe“: isti tip ponude, vrsta i opština kao sačuvani oglasi, cena po m² ±20 %;
     bez sačuvanih, gledanih, sakrivenih i sporednih duplikata; najbliži po €/m² prvi */
  try {
    const favs = [...(store.favs || [])].map((s) => by.get(s)).filter((l) => l && l.ppm);
    if (favs.length) {
      const seen = new Set([...(store.favs || []), ...(store.recent || [])]);
      let hidden = new Set();
      try { const h = typeof KX !== 'undefined' && KX.profile ? KX.profile.get().hidden : null; hidden = h instanceof Set ? h : new Set(h || []); } catch (e) { hidden = new Set(); }
      const sec = (l) => { try { return typeof KX !== 'undefined' && !!KX.dupes && KX.dupes.isSecondary(l.s); } catch (e) { return false; } };
      const gid = (l) => { try { const g = typeof KX !== 'undefined' && KX.dupes ? KX.dupes.groupOf(l.s) : null; return g ? g.id : null; } catch (e) { return null; } };
      const favG = new Set(favs.map(gid).filter(Boolean));
      const scored = [];
      for (const l of D.listings) {
        if (!l.ppm || seen.has(l.s) || hidden.has(l.s) || sec(l)) continue;
        let best = Infinity;
        for (const f of favs) {
          if (f.t !== l.t || f.pt !== l.pt || f.ms !== l.ms) continue;
          if (Math.abs(l.ppm - f.ppm) > f.ppm * 0.2) continue;
          best = Math.min(best, Math.abs(l.ppm - f.ppm));
        }
        if (best < Infinity && !(gid(l) && favG.has(gid(l)))) scored.push([best, l]);
      }
      scored.sort((a, b) => a[0] - b[0] || a[1].dz - b[1].dz || (a[1].s < b[1].s ? -1 : 1));
      const g = new Set();
      for (const [, l] of scored) { if (recs.length >= 4) break; const k = gid(l); if (k && g.has(k)) continue; if (k) g.add(k); recs.push(l); }
    }
  } catch (e) { recs = []; }
  if (!searches.length && !recent.length && !recs.length) return null;
  const parts = [];
  if (searches.length) {
    parts.push(el('div', { class: 'hm-recent hm-saved' },
      el('span', { class: 'lbl' }, 'Tvoje pretrage'),
      el('span', { class: 'chips' }, searches.map((x) => {
        const n = homeCountParams(x.params || {});
        return el('a', { class: 'tag hm-rtag', href: HOME_ROUTES.search(x.params || {}), 'aria-label': n == null ? x.name : `${x.name} — ${fmt.num(n)} ${pl(n, 'oglas', 'oglasa', 'oglasa')}` },
          el('span', { class: 'lb' }, x.name), n == null ? null : el('span', { class: 'k' }, fmt.num(n)));
      })),
      el('span', { class: 'hint' }, 'Broj je današnji; novih od poslednje posete nema u demo podacima.')));
  }
  if (recent.length) parts.push(homeCards(recent, { cls: 'hm-viewed' }));
  if (recs.length) {
    parts.push(el('div', { class: 'hm-recs' },
      el('h3', { class: 'hm-recs-h' }, 'Preporučeno za tebe'),
      el('p', { class: 'hm-src' }, 'Slično sačuvanim oglasima: isti kraj i vrsta, cena po m² do ±20 %. Bez oglasa koje si već gledao ili sakrio.'),
      homeCards(recs)));
  }
  return el('section', { class: 'section hm-resume', 'aria-label': 'Nastavi gde si stao' },
    sectionHead('Nastavi gde si stao', recent.length ? 'Poslednji oglasi koje si gledao na ovom uređaju.' : recs.length ? 'Predlozi na osnovu sačuvanih oglasa na ovom uređaju.' : 'Sačuvane pretrage sa današnjim brojem oglasa.', '#/sacuvani', 'Sačuvano'),
    parts);
}

/* ─────────── početna ─────────── */
function viewHome(q) {
  const H = homeData.get();
  const init = { hs: q && typeof q.get === 'function' ? q.get('hs') : q && q.hs };
  const sec = (cls, head, body) => el('section', { class: 'section ' + cls }, head, body);
  const ags = el('div', { class: 'agencies hm-agencies' }, H.agencies.map((a) => agencyCard(a)));
  /* „Svih N izdvojenih“: filter promo (core BOOL_KEYS), broj = tačno ono što link otvara */
  const featF = { ...FILTER_DEFAULTS, promo: true };
  const featP = filtersToParams(featF);
  let featN = 0; try { featN = homeVisible(applyFilters(featF)).length; } catch (e) { featN = 0; }

  return el('div', { class: 'wrap hm' },
    homeHero(init),
    homeResume(),
    sec('hm-featured', sectionHead('Izdvojeno ove nedelje', 'Promovisani oglasi za prodaju sa najviše pregleda u poslednjih sedam dana.', HOME_ROUTES.search(featP), (featN % 10 === 1 && featN % 100 !== 11 ? `Svi izdvojeni oglasi (${fmt.num(featN)})` : `Svih ${fmt.num(featN)} izdvojenih`)),
      homeCards(H.featured)),
    sec('hm-fresh', sectionHead('Novo u ponudi', 'Oglasi za prodaju postavljeni od juče.', HOME_ROUTES.search({ sort: 'new' }), 'Svi novi oglasi'),
      homeCards(H.fresh, { fresh: true })),
    sec('hm-market-s', sectionHead('Tržište ovog meseca', 'Koliko košta kvadrat stana u najvećim gradovima.', '#/trziste', 'Cene po gradovima i opštinama'),
      homeMarket()),
    sec('hm-new-s', sectionHead('Novogradnja', ['Stanovi od investitora — cene sa uračunatim ', el('span', { class: 'hm-nw' }, 'PDV-om'), '.'], '#/novogradnja', 'Svi projekti'),
      homeProjects()),
    sec('hm-cities-s', sectionHead('Gradovi', 'Broj oglasa za prodaju po gradu.', '#/mapa', 'Pogledaj na mapi'),
      homeCities()),
    sec('hm-ag-s', sectionHead('Agencije', 'Verifikovane agencije sa najviše aktivnih oglasa.', '#/agencije', 'Sve agencije'),
      ags),
    sec('hm-arts-s', sectionHead('Saveti', 'Kupovina, kredit i papiri — bez iznenađenja.', '#/saveti', 'Svi saveti'),
      homeArticles()));
}
