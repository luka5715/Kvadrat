/* Kvadrat.rs — stranica rezultata pretrage: viewResults(q[, path]).
   URL (hash) je jedini izvor istine: svaka kontrola piše parametre preko setHash (replace za kucanje, push za izbor).
   Zavisi od: core.js (D, el, $, fmt, stats, store, find, TYPES, COND, HEAT, FURN, AMEN, FILTER_DEFAULTS, applyFilters,
   paramsToFilters, filtersToParams, countActive, setHash, toast), ui.js (card, listTable, pills, …), engine.js (KX, opciono),
   map.js (mapView, opciono). Sve je u IIFE; napolje izlaze samo viewResults i resultsParamsFromPath. */
'use strict';
(function () {
  /* ───────────────────────── pomoćne ───────────────────────── */
  const safe = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const hasKX = () => typeof KX !== 'undefined' && !!KX;
  const hasMap = () => typeof mapView === 'function';
  const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
  const bp = () => ({ desk: mq('(min-width:1101px)'), wide: mq('(min-width:861px)'), phone: mq('(max-width:600px)') });
  const N0 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });
  const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
  const median = (arr) => { const a = arr.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const quant = (arr, q) => { const a = arr.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; return a[Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))))]; };
  const plural = (n, a, b, c) => safe(() => fmt.plural(n, a, b, c), c);
  const listings = (n) => safe(() => fmt.listings(n), `${N0.format(n)} oglasa`);
  const eur = (v, t) => safe(() => fmt.price(v, t), N0.format(Math.round(v)) + ' €');
  const typeOfV = (v) => safe(() => typeOf(v), { v, l: v, s: v, pl: v });
  const roundTo = (v, step) => Math.round(v / step) * step;

  const PER_OPTS = [20, 40, 60];
  const ROOM_OPTS = [[0.5, 'Garsonjera'], [1, '1'], [1.5, '1,5'], [2, '2'], [2.5, '2,5'], [3, '3'], [3.5, '3,5'], ['4+', '4+']];
  const AMEN_SALE = ['hasElevator', 'hasTerrace', 'hasBalcony', 'hasLoggia', 'hasParking', 'hasGarage', 'hasBasement', 'hasAc', 'hasIntercom', 'hasVideoSurv', 'hasStorage', 'hasGarden'];
  const AMEN_RENT = ['petsAllowed', 'studentsOk', 'hasElevator', 'hasTerrace', 'hasBalcony', 'hasParking', 'hasGarage', 'hasAc', 'hasInternet', 'hasIntercom', 'hasBasement'];
  const AFF_OPTS = [{ v: 'odmah', l: 'Mogu odmah', st: 'odmah' }, { v: 'kredit', l: 'Na kredit', st: 'kredit' }, { v: 'kes', l: 'Samo keš', st: 'samo-kes' }];
  const MODES = [{ v: 'oglas', l: 'Cena iz oglasa' }, { v: 'ukupno', l: 'Ukupno sa troškovima' }, { v: 'mesecno', l: 'Mesečno' }];
  /* nazivi prikaza cene zavise od transakcije (RESEARCH „Koliko me stvarno košta”) */
  const modesFor = (t) => (t === 'izdavanje'
    ? [{ v: 'oglas', l: 'Kirija' }, { v: 'ukupno', l: 'Za useljenje' }, { v: 'mesecno', l: 'Mesečno sa računima' }]
    : [{ v: 'oglas', l: 'Cena' }, { v: 'ukupno', l: 'Ukupno sa troškovima' }, { v: 'mesecno', l: 'Mesečno' }]);
  const LEGACY_SORT = { preporuceno: 'rel', najnovije: 'new', 'cena-rastuce': 'p-asc', 'cena-opadajuce': 'p-desc', 'kvadratura-opadajuce': 'a-desc', 'cena-po-m2': 'ppm-asc', najpopularnije: 'rel', pop: 'rel' };
  const BASE_SORTS = [
    { v: 'rel', l: 'Preporučeno' }, { v: 'new', l: 'Najnovije' }, { v: 'p-asc', l: 'Cena ↑' }, { v: 'p-desc', l: 'Cena ↓' },
    { v: 'ppm-asc', l: '€/m² ↑' }, { v: 'ppm-desc', l: '€/m² ↓' }, { v: 'a-desc', l: 'Najveći m²' }, { v: 'delta', l: 'Najbolja vrednost (Δ)' },
    { v: 'drop', l: 'Najveće sniženje' }, { v: 'dom', l: 'Najduže na oglasu' },
  ];
  /* sortovi iz modela troškova (KX.cost / KX.afford); naziv zavisi od transakcije */
  const costSorts = (t) => (t === 'izdavanje'
    ? [{ v: 'total', l: 'Najjeftinije useljenje' }, { v: 'monthly', l: 'Mesečno sa računima ↑' }]
    : [{ v: 'total', l: 'Ukupno sa troškovima ↑' }, { v: 'monthly', l: 'Mesečno ukupno ↑' }]);
  const COST_SORTS = ['total', 'monthly', 'rata'];
  const HIDDEN_SORTS = [{ v: 'a-asc', l: 'Najmanji m²' }, { v: 'delta-desc', l: 'Δ opadajuće' }];
  /* dodatne grupe filtera (samo stranica rezultata; core ih ne zna) */
  const DMAX_OPTS = [{ v: 1, l: 'Danas' }, { v: 3, l: '3 dana' }, { v: 7, l: '7 dana' }, { v: 30, l: '30 dana' }];
  const EN_OPTS = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const BA_OPTS = [{ v: 1, l: '1+' }, { v: 2, l: '2+' }, { v: 3, l: '3+' }];
  const OR_OPTS = [['sever', 'Sever'], ['severoistok', 'Severoistok'], ['istok', 'Istok'], ['jugoistok', 'Jugoistok'], ['jug', 'Jug'], ['jugozapad', 'Jugozapad'], ['zapad', 'Zapad'], ['severozapad', 'Severozapad']];
  const LG_OPTS = [['uknjizeno', 'Uknjiženo'], ['poseban-zakon', 'Upisano po Zakonu 2025'], ['u-procesu', 'U procesu uknjižavanja'], ['ozakonjenje', 'U postupku ozakonjenja'], ['nije', 'Nije uknjiženo']];
  const LG_L = Object.fromEntries(LG_OPTS);
  const OR_L = Object.fromEntries(OR_OPTS);
  /* promena transakcije poništava filtere koji važe samo za jednu stranu */
  const T_RESET = { pmin: '', pmax: '', aff: [], tot: '', mes: '', dep1: false, lg: [] };
  const SORT_TIP = 'Redosled je uvek onaj koji izabereš. Plaćeni oglasi (Premium, Top, Istaknuto) su samo označeni i nikad ne preskaču izabrani redosled. „Preporučeno” = svežina oglasa i cena po m² u odnosu na prosek opštine.';

  /* ───────────────────────── engine omotači (memo u engine-u) ───────────────────────── */
  const trustOf = (l) => (hasKX() ? safe(() => KX.trust(l), null) : null);
  const fairOf = (l) => (hasKX() ? safe(() => KX.fair(l), null) : null);
  const histOf = (l) => (hasKX() ? safe(() => KX.history(l), null) : null);
  const affOf = (l) => (hasKX() ? safe(() => KX.afford(l), null) : null);
  const profile = () => (hasKX() ? safe(() => KX.profile.get(), null) : null);
  const hiddenSet = () => { const p = profile(); return p && p.hidden instanceof Set ? p.hidden : new Set(); };
  const hasBudget = () => hasKX() && safe(() => KX.profile.hasBudget(), false);
  const places = () => { const p = profile(); return p && Array.isArray(p.places) ? p.places : []; };
  const domOf = (l) => { const h = histOf(l); return h && h.daysOnMarket != null ? h.daysOnMarket : l.dz || 0; };
  const affKey = (l) => { const a = affOf(l); if (!a) return null; return a.state === 'samo-kes' ? 'kes' : a.state; };
  /* sniženje: istorija cene iz engine-a ILI oznaka „Snižena cena” sa kartice (ui.saleInfo) — da filter i kartica nikad ne protivreče */
  const dropCache = new Map();
  function dropInfo(l) {
    if (dropCache.has(l.s)) return dropCache.get(l.s);
    let best = null;
    const h = histOf(l);
    if (h && h.changes && h.changes.length) { const ch = h.changes[h.changes.length - 1]; if (ch.to < ch.from) best = { pct: (ch.to / ch.from - 1) * 100, old: ch.from }; }
    const si = typeof saleInfo === 'function' ? safe(() => saleInfo(l), null) : null;
    if (si && si.old > l.p) { const pct = (l.p / si.old - 1) * 100; if (!best || pct < best.pct) best = { pct, old: si.old }; }
    dropCache.set(l.s, best);
    return best;
  }
  /* sniženo „ovog meseca”: istorija engine-a beleži promene po mesecima, pa je ovo najpreciznije pošteno merilo */
  const curMonth = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const droppedRecently = (l) => { const h = histOf(l); return !!(h && h.changes && h.changes.some((c) => c.to < c.from && c.m === curMonth)); };
  const costOf = (l) => (hasKX() ? safe(() => KX.cost(l), null) : null);
  const totalOf = (l) => { const c = costOf(l); return c ? (l.t === 'izdavanje' ? c.moveIn : c.onPurchase) : null; };
  const monthlyOf = (l) => { const c = costOf(l); return c && isFinite(c.monthly) ? c.monthly : null; };
  /* „oboje (najgori)” i jedno mesto: minuti putovanja za filter Udaljenost */
  function travelMin(l, tp) {
    if (!hasKX()) return null;
    if (tp === 'oboje') { const pl = places(); const ja = pl.find((p) => (p.who || 'ja') === 'ja'), pa = pl.find((p) => p.who === 'partner'); if (!ja || !pa) return null; const a = safe(() => KX.travel(l, ja).min, null), b = safe(() => KX.travel(l, pa).min, null); return a == null || b == null ? null : Math.max(a, b); }
    const p = places().find((x) => x.id === tp); return p ? safe(() => KX.travel(l, p).min, null) : null;
  }
  const isSecondary = (l) => hasKX() && safe(() => KX.dupes.isSecondary(l.s), false);
  const groupOf = (l) => (hasKX() ? safe(() => KX.dupes.groupOf(l.s), null) : null);
  const legalKey = (l) => { const t = trustOf(l); return t && t.legal ? t.legal : l.reg ? 'uknjizeno' : 'nije'; };
  /* tlocrt: isti model kao stranica oglasa (viewListing._planModel) kad je učitan, inače isti uslovi kao taj model */
  const planCache = new Map();
  function hasPlan(l) {
    if (planCache.has(l.s)) return planCache.get(l.s);
    const pm = typeof viewListing === 'function' && typeof viewListing._planModel === 'function' ? viewListing._planModel : null;
    const v = pm ? !!safe(() => pm(l), null)
      : !!(l.a > 0 && l.a <= 600 && (l.ro != null || l.pt === 'poslovni-prostor') && ['stan', 'kuca', 'vikendica', 'poslovni-prostor'].includes(l.pt));
    planCache.set(l.s, v);
    return v;
  }
  /* depozit do jedne kirije (bez navedenog depozita = uobičajeni jedan mesec, kao na stranici oglasa) */
  const depOk = (l) => l.dep == null || !(l.p > 0) || l.dep <= l.p * 1.05;

  /* ───────────────────────── stanje ⇄ URL ───────────────────────── */
  const PT_PATH = { stanovi: 'stan', stan: 'stan', kuce: 'kuca', kuca: 'kuca', 'poslovni-prostori': 'poslovni-prostor', 'poslovni-prostor': 'poslovni-prostor', lokali: 'poslovni-prostor', placevi: 'zemljiste', zemljista: 'zemljiste', zemljiste: 'zemljiste', plac: 'zemljiste', sobe: 'soba', soba: 'soba', garaze: 'garaza', garaza: 'garaza', vikendice: 'vikendica', vikendica: 'vikendica' };
  /** '/prodaja', '/izdavanje', '/novogradnja-pretraga', '/prodaja/stanovi/beograd/vracar' → params {t, pt, c, m, newbuild} */
  function resultsParamsFromPath(path) {
    const seg = String(path || '').replace(/^#?\/?/, '').split('?')[0].split('/').filter(Boolean);
    const out = {};
    if (!seg.length) return out;
    if (seg[0] === 'novogradnja-pretraga' || seg[0] === 'novogradnja') { out.t = 'prodaja'; out.newbuild = '1'; return out; }
    if (seg[0] === 'prodaja' || seg[0] === 'izdavanje') out.t = seg[0];
    if (seg[1] && PT_PATH[seg[1]]) out.pt = PT_PATH[seg[1]];
    if (seg[2]) { const c = safe(() => find.city(seg[2]), null); if (c) out.c = c.s; else { const m = safe(() => find.mun(seg[2]), null); if (m) { out.m = m.s; out.c = m.cs; } } }
    if (seg[3]) { const m = safe(() => find.mun(seg[3]), null); if (m) out.m = m.s; }
    return out;
  }
  function normQ(q, path) {
    let p;
    if (q instanceof URLSearchParams) p = new URLSearchParams(q.toString());
    else if (typeof q === 'string') p = new URLSearchParams(q.replace(/^.*\?/, ''));
    else if (q && typeof q === 'object') { p = new URLSearchParams(); const prm = safe(() => filtersToParams(q), {}); for (const k of Object.keys(prm)) p.set(k, [].concat(prm[k]).join(',')); }
    else p = new URLSearchParams();
    const fromPath = resultsParamsFromPath(path);
    for (const k of Object.keys(fromPath)) if (!p.has(k)) p.set(k, fromPath[k]);
    /* legacy ključevi starog search.js */
    if (p.has('loc') && !p.has('c') && !p.has('m')) {
      for (const s of (p.get('loc') || '').split(',').filter(Boolean)) {
        if (safe(() => find.city(s), null)) p.set('c', s);
        else { const m = safe(() => find.mun(s), null); if (m) { p.set('m', [p.get('m'), s].filter(Boolean).join(',')); if (!p.has('c')) p.set('c', m.cs); } }
      }
    }
    for (const [a, b] of [['rooms', 'ro'], ['cond', 'co'], ['heat', 'he'], ['furn', 'fu']]) if (p.has(a) && !p.has(b)) p.set(b, p.get(a));
    return p;
  }
  function readState(qIn) {
    const p = qIn;
    const f = safe(() => paramsToFilters(p), { ...FILTER_DEFAULTS });
    const s = { ...f };
    for (const k of ['pt', 'm', 'n', 'ro', 'co', 'he', 'fu', 'am']) s[k] = Array.isArray(f[k]) ? f[k].slice() : [];
    if (!s.c && s.m.length) { const m = safe(() => find.mun(s.m[0]), null); if (m) s.c = m.cs; }
    const rawSort = p.get('sort') || 'rel';
    s.sort = LEGACY_SORT[rawSort] || rawSort;
    if (!validSort(s.sort)) s.sort = 'rel';
    const v = p.get('view');
    s.view = v === 'list' || v === 'map' || v === 'grid' ? v : v === 'lista' ? 'list' : v === 'mapa' ? 'map' : 'grid';
    const md = p.get('mode');
    s.mode = MODES.some((x) => x.v === md) ? md : 'oglas';
    const flag = (k) => p.has(k) && ['1', 'true', ''].includes(p.get(k));
    s.legal = flag('legal'); s.drop = flag('drop'); s.dropm = flag('dropm'); s.below = flag('below'); s.stale = flag('stale'); s.hid = flag('hid');
    s.dup = p.get('dup') !== '0' && p.get('dup') !== 'false';
    s.tot = num(p.get('tot')) ?? ''; s.mes = num(p.get('mes')) ?? '';
    s.tp = p.get('tp') || ''; s.tmax = num(p.get('tmax')) ?? '';
    if (s.tp && s.tp !== 'oboje' && !places().some((x) => x.id === s.tp)) s.tp = '';
    if (!s.tp) s.tmax = '';
    s.aff = (p.get('aff') || '').split(',').filter((x) => AFF_OPTS.some((o) => o.v === x));
    const bb = (p.get('bb') || '').split(',').map(Number);
    s.bb = bb.length >= 4 && bb.slice(0, 4).every(isFinite) && bb[0] > bb[1] ? bb.slice(0, 5) : null;
    const zona = (p.get('zona') || '').split('~').map((x) => x.split(',').map(Number)).filter((x) => x.length === 2 && x.every(isFinite));
    s.zona = zona.length >= 3 ? zona.map(([lat, lng]) => ({ lat, lng })) : null;
    const lst = (k) => (p.get(k) || '').split(',').map((x) => x.trim()).filter(Boolean);
    const dm = num(p.get('dmax')); s.dmax = DMAX_OPTS.some((o) => o.v === dm) ? dm : '';
    const bam = num(p.get('ba')); s.ba = BA_OPTS.some((o) => o.v === bam) ? bam : '';
    s.en = lst('en').filter((x) => EN_OPTS.includes(x));
    s.or = lst('or').filter((x) => x in OR_L);
    s.lg = lst('lg').filter((x) => x in LG_L);
    s.nog = flag('nog'); s.plan = flag('plan'); s.dep1 = flag('dep1');
    /* prodaja: „uknjiženo” (reg) je deo grupe Pravni status — reg iz starih linkova = upisano u katastar (uknjiženo ili po Zakonu 2025) */
    if (s.t === 'prodaja' && s.reg) { s.reg = false; s.lg = [...new Set([...s.lg, 'uknjizeno', 'poseban-zakon'])]; }
    if (s.t !== 'prodaja') s.lg = [];
    if (s.t !== 'izdavanje') s.dep1 = false;
    s.per = PER_OPTS.includes(+p.get('per')) ? +p.get('per') : 20;
    s.page = Math.max(1, +f.page || 1);
    return s;
  }
  function validSort(v) {
    if (BASE_SORTS.some((x) => x.v === v) || HIDDEN_SORTS.some((x) => x.v === v)) return true;
    if (v === 'pair' || COST_SORTS.includes(v)) return true;
    return /^near-[\w-]{1,40}$/.test(v);
  }
  function toParams(s) {
    const out = safe(() => filtersToParams({ ...s, sort: 'rel', view: 'grid' }), {});
    delete out.sort; delete out.view;
    out.t = s.t === 'izdavanje' ? 'izdavanje' : 'prodaja'; /* transakcija je uvek eksplicitna u URL-u */
    if (s.sort && s.sort !== 'rel') out.sort = s.sort;
    if (s.view && s.view !== 'grid') out.view = s.view;
    if (s.mode && s.mode !== 'oglas') out.mode = s.mode;
    for (const k of ['legal', 'drop', 'dropm', 'below', 'stale', 'hid', 'nog', 'plan', 'dep1']) if (s[k]) out[k] = '1';
    if (num(s.dmax) != null) out.dmax = String(s.dmax);
    if (num(s.ba) != null) out.ba = String(s.ba);
    for (const k of ['en', 'or', 'lg']) if (s[k] && s[k].length) out[k] = s[k].slice();
    if (num(s.tot) != null) out.tot = String(s.tot);
    if (num(s.mes) != null) out.mes = String(s.mes);
    if (s.tp) { out.tp = s.tp; if (num(s.tmax) != null) out.tmax = String(s.tmax); }
    if (!s.dup) out.dup = '0';
    if (s.aff && s.aff.length) out.aff = s.aff.slice();
    if (s.bb) out.bb = s.bb.map((x, i) => (i < 4 ? (+x).toFixed(4) : String(Math.round(x * 10) / 10)));
    if (s.zona) out.zona = s.zona.map((pt) => `${(+pt.lat).toFixed(4)},${(+pt.lng).toFixed(4)}`).join('~');
    if (s.per && s.per !== 20) out.per = String(s.per);
    if (s.page > 1) out.page = String(s.page); else delete out.page;
    return out;
  }
  /* broj aktivnih filtera (core + naši) */
  const extraActive = (s) => ['legal', 'drop', 'dropm', 'below', 'stale', 'nog', 'plan', 'dep1'].filter((k) => s[k]).length + (s.aff.length ? 1 : 0) + (s.bb || s.zona ? 1 : 0)
    + ['en', 'or', 'lg'].filter((k) => s[k] && s[k].length).length + (num(s.dmax) != null ? 1 : 0) + (num(s.ba) != null ? 1 : 0)
    + (num(s.tot) != null ? 1 : 0) + (num(s.mes) != null ? 1 : 0) + (s.tp && num(s.tmax) != null ? 1 : 0);
  const activeCount = (s) => safe(() => countActive(s), 0) + extraActive(s);

  /* ───────────────────────── filtriranje i sortiranje ───────────────────────── */
  const CORE_KEYS = Object.keys(typeof FILTER_DEFAULTS !== 'undefined' ? FILTER_DEFAULTS : {});
  function coreFilter(s) {
    const f = {};
    for (const k of CORE_KEYS) f[k] = s[k];
    f.sort = 'new'; f.view = 'grid'; f.page = 1;
    return f;
  }
  const inBox = (l, bb) => l.lat != null && l.lat <= bb[0] && l.lat >= bb[1] && l.lng <= bb[2] && l.lng >= bb[3];
  const inPoly = (l, poly) => {
    if (l.lat == null) return false;
    if (hasMap() && typeof mapView.inPolygon === 'function') return safe(() => mapView.inPolygon(l.lat, l.lng, poly), false);
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.lng > l.lng) !== (b.lng > l.lng) && l.lat < ((b.lat - a.lat) * (l.lng - a.lng)) / (b.lng - a.lng) + a.lat) inside = !inside;
    }
    return inside;
  };
  let profVer = 0;
  if (hasKX()) safe(() => KX.profile.on(() => { profVer++; memo.clear(); dropCache.clear(); }));
  const memo = new Map();
  /** run(s, {sort:false, area:false}) → oglasi; memo po ključu stanja */
  function run(s, o = {}) {
    const key = JSON.stringify([s.t, s.pt, s.c, s.m, s.n, s.pmin, s.pmax, s.amin, s.amax, s.ro, s.flmin, s.flmax, s.notLast, s.ymin, s.ymax, s.co, s.he, s.fu, s.reg, s.newbuild, s.am, s.agency, s.advertiser, s.q, s.deltaMax,
      s.legal, s.aff, s.drop, s.dropm, s.below, s.tot, s.mes, s.tp, s.tmax, s.stale, s.hid, s.dup, s.dmax, s.ba, s.en, s.or, s.lg, s.nog, s.plan, s.dep1, o.area === false ? null : [s.bb, s.zona], o.sort === false ? '' : s.sort, profVer]);
    if (memo.has(key)) return memo.get(key);
    let list = safe(() => applyFilters(coreFilter(s)), []);
    if (!s.hid) { const h = hiddenSet(); if (h.size) list = list.filter((l) => !h.has(l.s)); }
    if (s.dup && hasKX()) list = list.filter((l) => !isSecondary(l));
    if (s.legal) list = list.filter((l) => { const t = trustOf(l); return t && t.color === 'zeleno'; });
    if (s.aff.length) list = list.filter((l) => s.aff.includes(affKey(l)));
    if (s.drop) list = list.filter((l) => !!dropInfo(l));
    if (s.dropm) list = list.filter(droppedRecently);
    if (num(s.tot) != null) list = list.filter((l) => { const v = totalOf(l); return v != null && v <= s.tot; });
    if (num(s.mes) != null) list = list.filter((l) => { const v = monthlyOf(l); return v != null && v <= s.mes; });
    if (s.tp && num(s.tmax) != null) list = list.filter((l) => { const v = travelMin(l, s.tp); return v != null && v <= s.tmax; });
    if (s.below) list = list.filter((l) => { const f = fairOf(l); return f && f.verdict === 'ispod'; });
    if (s.stale) list = list.filter((l) => domOf(l) > 60);
    if (num(s.dmax) != null) list = list.filter((l) => (l.dz || 0) < s.dmax);
    if (num(s.ba) != null) list = list.filter((l) => l.ba != null && l.ba >= s.ba);
    if (s.en && s.en.length) list = list.filter((l) => s.en.includes(l.en));
    if (s.or && s.or.length) list = list.filter((l) => s.or.includes(l.or));
    if (s.lg && s.lg.length) list = list.filter((l) => s.lg.includes(legalKey(l)));
    if (s.nog) list = list.filter((l) => l.fl == null || l.fl > 0);
    if (s.plan) list = list.filter(hasPlan);
    if (s.dep1) list = list.filter(depOk);
    if (o.area !== false) {
      if (s.bb) list = list.filter((l) => inBox(l, s.bb));
      if (s.zona) list = list.filter((l) => inPoly(l, s.zona));
    }
    if (o.sort !== false) list = sortList(list, s);
    if (memo.size > 200) memo.clear();
    memo.set(key, list);
    return list;
  }
  const NUL = 1e12;
  function sortList(list, s) {
    const a = list.slice();
    const by = (fn, dir = 1) => a.sort((x, y) => { const vx = fn(x), vy = fn(y); const nx = vx == null || !isFinite(vx), ny = vy == null || !isFinite(vy); if (nx || ny) return nx - ny; return (vx - vy) * dir || x.dz - y.dz; });
    const dpct = (l) => safe(() => stats.deltaPct(l), null);
    switch (s.sort) {
      case 'new': return a.sort((x, y) => x.dz - y.dz || y.v - x.v);
      case 'p-asc': return by((l) => l.p);
      case 'p-desc': return by((l) => l.p, -1);
      case 'ppm-asc': return by((l) => l.ppm);
      case 'ppm-desc': return by((l) => l.ppm, -1);
      case 'a-desc': return by((l) => l.a, -1);
      case 'a-asc': return by((l) => l.a);
      case 'delta': return by(dpct);
      case 'delta-desc': return by(dpct, -1);
      case 'drop': return by((l) => { const d = dropInfo(l); return d ? d.pct : 0; });
      case 'dom': return by(domOf, -1);
      case 'total': return by(totalOf);
      case 'monthly': return by(monthlyOf);
      case 'rata': {
        /* Najniža rata: kredit (po rati) → odmah (bez kredita) → samo keš → van budžeta */
        const RANK = { kredit: 0, odmah: 1, 'samo-kes': 2, 'van-budzeta': 3 };
        const key = (l) => { const a = affOf(l); if (!a || !(a.state in RANK)) return null; return RANK[a.state] * 1e7 + (a.state === 'kredit' ? Math.min(9e6, a.monthly || 0) : totalOf(l) / 1000 || 0); };
        return by(key);
      }
      case 'pair': {
        const fm = hasKX() ? safe(() => KX.fairMiddle(a), null) : null;
        return fm ? by((l) => { const r = fm.get(l.s); return r ? r.max : null; }) : a;
      }
      default:
        if (/^near-/.test(s.sort)) {
          const pl = places().find((x) => 'near-' + x.id === s.sort);
          if (pl && hasKX()) return by((l) => safe(() => KX.travel(l, pl).min, null));
          return a;
        }
        /* Preporučeno: svežina + vrednost; promocija NE utiče na redosled */
        return by((l) => { const d = dpct(l); return Math.min(l.dz, 120) / 30 + (d == null ? 0 : Math.max(-30, Math.min(30, d)) / 10); });
    }
  }
  function sortOptions(s) {
    const opts = BASE_SORTS.slice();
    if (hasKX()) { opts.push(...costSorts(s.t)); if (s.t === 'prodaja' && hasBudget()) opts.push({ v: 'rata', l: 'Najniža rata' }); }
    const pl = places();
    pl.slice(0, 5).forEach((p) => opts.push({ v: 'near-' + p.id, l: 'Najbliže: ' + p.name }));
    if (pl.some((p) => (p.who || 'ja') === 'ja') && pl.some((p) => p.who === 'partner')) opts.push({ v: 'pair', l: 'Najbolje za oboje' });
    const hid = HIDDEN_SORTS.find((x) => x.v === s.sort);
    if (hid) opts.push(hid);
    if (!opts.some((x) => x.v === s.sort)) opts.push({ v: s.sort, l: s.sort === 'rata' ? 'Najniža rata' : COST_SORTS.includes(s.sort) ? 'Po troškovima' : 'Najbliže mestu' });
    return opts;
  }

  /* ───────────────────────── brojači pored opcija (živi) ───────────────────────── */
  const facetMemo = new Map();
  function facets(s, cur) {
    const key = JSON.stringify(toParams({ ...s, page: 1, view: 'grid', mode: 'oglas', sort: 'rel' })) + '|' + profVer;
    if (facetMemo.has(key)) return facetMemo.get(key);
    const base = (patch) => run({ ...s, ...patch }, { sort: false });
    const tally = (list, fn) => { const o = {}; for (const l of list) { const k = fn(l); if (k != null) o[k] = (o[k] || 0) + 1; } return o; };
    const curL = cur || run(s, { sort: false });
    const F = {};
    F.pt = tally(base({ pt: [] }), (l) => l.pt);
    F.t = { prodaja: run({ ...s, t: 'prodaja' }, { sort: false }).length, izdavanje: run({ ...s, t: 'izdavanje' }, { sort: false }).length };
    F.c = tally(base({ c: '', m: [], n: [] }), (l) => l.cs);
    F.m = tally(base({ m: [], n: [] }), (l) => l.ms);
    const roBase = base({ ro: [] });
    F.ro = {};
    for (const [v] of ROOM_OPTS) F.ro[v] = roBase.filter((l) => (v === '4+' ? l.ro != null && l.ro >= 4 : l.ro === v)).length;
    F.co = tally(base({ co: [] }), (l) => l.co);
    F.he = tally(base({ he: [] }), (l) => l.he);
    F.fu = tally(base({ fu: [] }), (l) => l.fu);
    F.adv = tally(base({ advertiser: '' }), (l) => (l.ag ? 'agencija' : 'vlasnik'));
    F.aff = hasBudget() ? tally(base({ aff: [] }), affKey) : {};
    /* uključivanje = koliko ostaje uz tu opciju; isključivanje = koliko bi bilo bez nje */
    const toggleCount = (k, pred) => (s[k] ? base({ [k]: false }).length : curL.filter(pred).length);
    F.bool = {
      reg: toggleCount('reg', (l) => l.reg),
      newbuild: toggleCount('newbuild', (l) => l.co === 'novogradnja' || l.co === 'u-izgradnji'),
      notLast: toggleCount('notLast', (l) => !(l.tf && l.fl === l.tf)),
      legal: toggleCount('legal', (l) => { const t = trustOf(l); return t && t.color === 'zeleno'; }),
      drop: toggleCount('drop', (l) => !!dropInfo(l)),
      dropm: toggleCount('dropm', droppedRecently),
      below: toggleCount('below', (l) => { const f = fairOf(l); return f && f.verdict === 'ispod'; }),
      stale: toggleCount('stale', (l) => domOf(l) > 60),
      nog: toggleCount('nog', (l) => l.fl == null || l.fl > 0),
      plan: toggleCount('plan', hasPlan),
      dep1: toggleCount('dep1', depOk),
    };
    F.en = tally(base({ en: [] }), (l) => l.en);
    F.or = tally(base({ or: [] }), (l) => l.or);
    F.lg = s.t === 'prodaja' ? tally(base({ lg: [] }), legalKey) : {};
    const baBase = base({ ba: '' });
    F.ba = {}; for (const o of BA_OPTS) F.ba[o.v] = baBase.filter((l) => l.ba != null && l.ba >= o.v).length;
    const dzBase = base({ dmax: '' });
    F.dmax = {}; for (const o of DMAX_OPTS) F.dmax[o.v] = dzBase.filter((l) => (l.dz || 0) < o.v).length;
    F.am = {};
    for (const a of new Set([...AMEN_SALE, ...AMEN_RENT, ...s.am])) F.am[a] = s.am.includes(a) ? base({ am: s.am.filter((x) => x !== a) }).length : curL.filter((l) => l.am && l.am.includes(a)).length;
    F.priceBase = base({ pmin: '', pmax: '' });
    F.areaBase = base({ amin: '', amax: '' });
    F.hiddenN = s.hid ? 0 : Math.max(0, run({ ...s, hid: true }, { sort: false }).length - curL.length);
    F.dupN = s.dup && hasKX() ? Math.max(0, run({ ...s, dup: false }, { sort: false }).length - curL.length) : 0;
    if (facetMemo.size > 60) facetMemo.clear();
    facetMemo.set(key, F);
    return F;
  }

  /* ───────────────────────── tekstovi ───────────────────────── */
  const tWord = (t) => (t === 'izdavanje' ? 'Izdavanje' : 'Prodaja');
  const typeGen = (s) => (s.pt.length === 1 ? typeOfV(s.pt[0]).pl : 'nekretnina');
  function priceQual(s) {
    const unit = s.t === 'izdavanje' ? 'izdavanje' : undefined;
    const a = num(s.pmin), b = num(s.pmax);
    if (a != null && b != null) return `${N0.format(a)}–${eur(b, unit)}`;
    if (b != null) return 'do ' + eur(b, unit);
    if (a != null) return 'od ' + eur(a, unit);
    return null;
  }
  function roomsQual(s) {
    if (!s.ro.length || s.ro.length > 2) return null;
    return s.ro.map((r) => (r === '4+' || r === '4.0+' ? '4+ sobe' : safe(() => fmt.rooms(+r), String(r)))).join(' ili ').toLowerCase();
  }
  function titleFor(s) {
    let t = `${tWord(s.t)} ${typeGen(s)}`;
    const city = s.c ? safe(() => find.city(s.c), null) : null;
    const muns = s.m.map((m) => safe(() => find.mun(m), null)).filter(Boolean).map((m) => m.n);
    const quals = [];
    if (muns.length) quals.push(muns.slice(0, 2).join(', ') + (muns.length > 2 ? ` +${muns.length - 2}` : ''));
    const pq = priceQual(s); if (pq) quals.push(pq);
    if (city && !quals.length) return `${t} u ${city.loc || city.n}`;
    if (city && !muns.length) return [t, city.n, ...quals].join(' · ');
    if (!quals.length) return `${t} u Srbiji`;
    return [t, ...quals].join(' · ');
  }
  function autoName(s) {
    const parts = [];
    const rq = roomsQual(s); if (rq) parts.push(rq[0].toUpperCase() + rq.slice(1));
    else parts.push(s.pt.length === 1 ? typeOfV(s.pt[0]).l : tWord(s.t));
    const muns = s.m.map((m) => safe(() => find.mun(m), null)).filter(Boolean);
    if (muns.length) parts.push(muns.map((m) => m.n).slice(0, 2).join(', '));
    else if (s.c) { const c = safe(() => find.city(s.c), null); if (c) parts.push(c.n); }
    const pq = priceQual(s); if (pq) parts.push(pq);
    if (s.t === 'izdavanje' && !parts.some((x) => /izdavanje/i.test(x))) parts.push('izdavanje');
    return parts.join(', ');
  }

  /* ───────────────────────── modulsko stanje (jedna stranica u isto vreme) ───────────────────────── */
  let lastView = null, curRoot = null, curParams = null, curMap = null, pendingFocus = null, typeTimer = 0, openSheet = null, budgetTimer = 0, budgetPending = {};
  /* fokus preživljava ponovno građenje: svaka kontrola u trakama, railu, listu, paginaciji i tagovima dobija stabilan
     data-fkey (grupa + naziv opcije bez brojača), pa se posle izgradnje fokus vraća na istu kontrolu */
  const FKEY_SCOPES = '[data-grp], .srp-bar .row1, .srp-rail-h, .srp-desk-l, .srp-desk-r, .srp-qrow, .pager, .active-filters, .srp-resbar, .srp-reset, .srp-relax, .srp-empty, .srp-table thead';
  const FOCUSABLE_Q = 'button, input, select, a[href], summary, [tabindex="0"]';
  function fname(n) {
    if (n.tagName === 'INPUT') { const lb = n.closest('label.check'); const sp = lb && lb.querySelector('span'); return 'in:' + (sp ? sp.textContent.trim() : n.value || n.name || ''); }
    if (n.dataset.act) return n.dataset.act + (n.dataset.id ? ':' + n.dataset.id : '') + (n.dataset.i ? ':' + n.dataset.i : '');
    const al = n.getAttribute('aria-label'); if (al) return al;
    let t = ''; n.childNodes.forEach((c) => { if (!(c.classList && (c.classList.contains('n') || c.classList.contains('cnt')))) t += c.textContent; });
    /* „Prodaja · 20” → „Prodaja”: brojač se menja, naziv ne */
    return t.replace(/\s*·\s*[\d.]+\s*$/, '').trim().slice(0, 48) || n.tagName;
  }
  function keyify(scope, pre) {
    if (!scope) return;
    scope.querySelectorAll(FKEY_SCOPES).forEach((box) => {
      const id = pre + ':' + (box.dataset.grp || box.classList[box.classList.length - 1] || box.tagName.toLowerCase());
      const seen = {};
      box.querySelectorAll(FOCUSABLE_Q).forEach((n) => {
        if (n.dataset.fkey) return;
        const k = id + '|' + fname(n);
        seen[k] = (seen[k] || 0) + 1;
        n.dataset.fkey = seen[k] > 1 ? k + '#' + seen[k] : k;
      });
    });
  }
  function captureFocus() {
    const a = document.activeElement;
    if (!a || !a.dataset || !a.dataset.fkey) return;
    const tag = a.closest('.active-filters .tag');
    const tagIdx = tag ? [...tag.parentNode.querySelectorAll('.tag')].indexOf(tag) : -1;
    pendingFocus = { key: a.dataset.fkey, inSheet: !!a.closest('.sheet'), tagIdx, start: safe(() => a.selectionStart, null), end: safe(() => a.selectionEnd, null) };
  }
  function restoreFocus(root) {
    if (!pendingFocus) return;
    const pf = pendingFocus; pendingFocus = null;
    requestAnimationFrame(() => {
      const scope = root && root.isConnected ? root : document;
      let n = scope.querySelector(`[data-fkey="${CSS.escape(pf.key)}"]`);
      if (n && (n.disabled || !n.getClientRects().length)) n = null;
      /* uklonjen tag → sledeći tag, pa „Obriši sve”, pa broj rezultata */
      if (!n && pf.tagIdx >= 0) { const tb = [...scope.querySelectorAll('.active-filters .tag button')]; n = tb[Math.min(pf.tagIdx, tb.length - 1)] || scope.querySelector('.active-filters .clear'); }
      if (!n && !pf.inSheet) n = scope.querySelector('.srp-count');
      if (!n || document.activeElement === n) return;
      const det = n.closest('details'); if (det && !det.open) det.open = true;
      n.focus({ preventScroll: true });
      if (pf.start != null) safe(() => n.setSelectionRange(pf.start, pf.end));
    });
  }
  /** jedina tačka promene stanja: piše URL. replace=true → kucanje (bez istorije), inače push */
  function go(s, patch, opts = {}) {
    const next = { ...s, ...patch };
    if (!('page' in patch)) next.page = 1;
    captureFocus();
    const params = toParams(next);
    const replace = !!opts.replace;
    const path = '/pretraga';
    if (typeof setHash === 'function') setHash(path, params, replace);
    if (opts.scrollTop && curRoot && curRoot.isConnected) {
      const top = curRoot.querySelector('.srp-anchor');
      if (top) { const y = top.getBoundingClientRect().top + window.scrollY - 140; if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: 'auto' }); }
    }
  }
  function goTyped(s, patch) { clearTimeout(typeTimer); typeTimer = setTimeout(() => go(s, patch, { replace: true }), 350); }
  function refresh() { if (curRoot && curRoot.isConnected && curParams) build(curRoot, curParams); }
  /* promena prelomne tačke → ponovo izgradi (drugi raspored kartica) */
  if (typeof matchMedia === 'function') ['(min-width:1101px)', '(min-width:861px)', '(max-width:600px)'].forEach((q) => {
    const m = matchMedia(q); const fn = () => refresh();
    if (m.addEventListener) m.addEventListener('change', fn); else if (m.addListener) m.addListener(fn);
  });
  if (typeof store !== 'undefined' && store.on) safe(() => store.on((what) => { if (what === 'compare' && curRoot && curRoot.isConnected) paintCompareLink(curRoot); }));

  /* ───────────────────────── kontrole grupa (rail i sheet dele isti graditelj) ───────────────────────── */
  /* ch(patch, how): how = 'push' (izbor) | 'type' (kucanje) | 'drag' (prevlačenje, samo prikaz) */
  function grp(title, body, extra = {}) {
    return el('section', { class: 'grp srp-grp' + (extra.cls ? ' ' + extra.cls : ''), 'data-grp': extra.id || null },
      el('h3', { class: 't' }, el('span', {}, title), extra.aside || null), body);
  }
  const cnt = (o, k) => (o && o[k]) || 0;
  function pillsCounted(opts, cur, counts, onToggle, o = {}) {
    const items = opts.map((x) => ({ ...x, n: counts ? cnt(counts, x.v) : undefined }));
    const node = pills(items, cur, onToggle, o);
    [...node.children].forEach((b, i) => { if (counts && !items[i].n && !cur.includes(items[i].v)) b.classList.add('is-zero'); });
    return node;
  }
  /* opcija sa živim brojem 0: siva (i dalje može da se klikne) — kao .chip.is-zero */
  function checkC(label, on, onChange, o = {}) {
    const n = check(label, on, onChange, o);
    if (o.count === 0 && !on) n.classList.add('is-zero');
    return n;
  }
  /* o.signed: dozvoljen jedan vodeći minus (sprat: suteren = −1); sam „−” se ne šalje dok se ne otkuca broj */
  function numInput(fkey, value, placeholder, onType, label, o = {}) {
    const shown = value === '' || value == null ? '' : o.signed || o.raw ? String(Math.trunc(+value)) : N0.format(value);
    const i = el('input', { class: 'input', type: 'text', inputmode: o.signed ? 'text' : 'numeric', autocomplete: 'off', placeholder, 'aria-label': label, value: shown, 'data-fkey': fkey });
    i.addEventListener('input', () => {
      if (o.signed) {
        const d = i.value.replace(/[\u2212\u2013\u2010]/g, '-').replace(/[^\d-]/g, '').replace(/(?!^)-/g, '');
        if (d === '-') return;
        onType(d === '' ? '' : +d);
        return;
      }
      const d = i.value.replace(/[^\d]/g, ''); onType(d === '' ? '' : +d);
    });
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } });
    return i;
  }
  function pairInputs(prefix, a, b, unit, onType, label) {
    return el('div', { class: 'srp-pair' },
      numInput(prefix + '-a', a, 'od', (v) => onType('a', v), `${label} od`),
      numInput(prefix + '-b', b, 'do', (v) => onType('b', v), `${label} do`),
      el('span', { class: 'srp-unit' }, unit));
  }
  function rangeGroup(s, F, ch, kind, ctx) {
    const isP = kind === 'p';
    const kMin = isP ? 'pmin' : 'amin', kMax = isP ? 'pmax' : 'amax';
    const rent = s.t === 'izdavanje';
    const baseList = isP ? F.priceBase : F.areaBase;
    const bins = baseList.length ? safe(() => stats.histogram(baseList, isP ? 'p' : 'a', 24), []) : [];
    const lo = 0;
    const hiRaw = bins.length ? bins[bins.length - 1].to : isP ? (rent ? 3000 : 500000) : 300;
    const step = isP ? (rent ? (hiRaw > 2000 ? 50 : 10) : hiRaw > 400000 ? 5000 : 1000) : (hiRaw > 400 ? 10 : 1);
    const hi = Math.max(step, Math.ceil(hiRaw / step) * step);
    const from = num(s[kMin]) ?? lo, to = num(s[kMax]) ?? hi;
    const fmtV = (v) => (isP ? (v >= hi ? eur(hi, rent ? 'izdavanje' : undefined) + '+' : eur(v, rent ? 'izdavanje' : undefined)) : (v >= hi ? N0.format(hi) + '+ m²' : N0.format(v) + ' m²'));
    let hg = null;
    if (isP && bins.length) hg = histogram(bins, { from: num(s.pmin), to: num(s.pmax) });
    const inputs = pairInputs(`${ctx}-${kind}`, s[kMin], s[kMax], isP ? (rent ? '€/mes' : '€') : 'm²', (which, v) => ch(which === 'a' ? { [kMin]: v } : { [kMax]: v }, 'type'), isP ? 'Cena' : 'Kvadratura');
    const rg = range({ min: lo, max: hi, step, from: Math.max(lo, Math.min(from, hi)), to: Math.max(lo, Math.min(to, hi)), format: fmtV, label: isP ? 'Cena' : 'Kvadratura',
      onInput: (a, b) => { if (hg) hg.update(a <= lo ? null : a, b >= hi ? null : b); const [ia, ib] = inputs.querySelectorAll('input'); ia.value = a <= lo ? '' : N0.format(a); ib.value = b >= hi ? '' : N0.format(b); },
      onChange: (a, b) => {
        /* niz strelica na klizaču = jedan korak istorije: prvi pritisak push, sledeći (u roku 2 s) replace */
        const now = performance.now(), kb = now - rangeKeyAt < 60;
        const how = kb && now - rangeKeyPush < 2000 ? 'key' : 'push';
        if (kb) rangeKeyPush = now;
        ch({ [kMin]: a <= lo ? '' : a, [kMax]: b >= hi ? '' : b }, how);
      } });
    /* capture: beleži se pre ui.range keydown obrade koja odmah zove onChange */
    rg.addEventListener('keydown', (e) => { if (/^Arrow/.test(e.key) && e.target.closest('.kn')) rangeKeyAt = performance.now(); }, true);
    return el('div', { class: 'srp-range' }, hg, rg, inputs);
  }
  function locationGroup(s, F, ch) {
    const cities = (D.cities || []).filter((c) => cnt(F.c, c.s) || c.s === s.c).sort((a, b) => cnt(F.c, b.s) - cnt(F.c, a.s));
    const total = Object.values(F.c).reduce((a, b) => a + b, 0);
    const sel = select([{ v: '', l: `Cela Srbija · ${N0.format(total)}` }, ...cities.map((c) => ({ v: c.s, l: `${c.n} · ${N0.format(cnt(F.c, c.s))}` }))], s.c, (v) => ch({ c: v, m: [], n: [] }, 'push'), { label: 'Grad' });
    const body = [el('div', { class: 'fld' }, el('label', { class: 'lbl', for: sel.id || (sel.id = 'srp-city-' + Math.random().toString(36).slice(2, 7)) }, 'Grad'), sel)];
    if (s.c) {
      const muns = safe(() => find.munsOf(s.c), []).filter((m) => cnt(F.m, m.s) || s.m.includes(m.s)).sort((a, b) => cnt(F.m, b.s) - cnt(F.m, a.s));
      if (muns.length > 1) {
        const mk = (m) => checkC(m.n, s.m.includes(m.s), (on) => ch({ m: on ? [...s.m, m.s] : s.m.filter((x) => x !== m.s), n: [] }, 'push'), { count: cnt(F.m, m.s) });
        const first = muns.slice(0, 8), rest = muns.slice(8);
        const restOpen = rest.some((m) => s.m.includes(m.s));
        body.push(el('div', { class: 'srp-checks' }, first.map(mk)));
        if (rest.length) body.push(el('details', { class: 'srp-more-opts', open: restOpen || null }, el('summary', {}, `Još ${rest.length} ${plural(rest.length, 'opština', 'opštine', 'opština')}`), el('div', { class: 'srp-checks' }, rest.map(mk))));
      }
    }
    return body;
  }
  /** sve grupe filtera; ctx = 'rail' | 'sheet' */
  function buildGroups(s, F, ch, ctx) {
    const G = {};
    const isSale = s.t === 'prodaja';
    G.t = grp('Transakcija', segmented([{ v: 'prodaja', l: `Prodaja · ${N0.format(F.t.prodaja)}` }, { v: 'izdavanje', l: `Izdavanje · ${N0.format(F.t.izdavanje)}` }], s.t, (v) => ch({ t: v, ...T_RESET }, 'push')), { id: 't' });
    G.tip = grp('Tip nekretnine', pillsCounted(TYPES.map((t) => ({ v: t.v, l: t.s })), s.pt, F.pt, (v, on, all) => ch({ pt: all }, 'push')), { id: 'tip' });
    G.lok = grp('Lokacija', locationGroup(s, F, ch), { id: 'lok' });
    G.cena = grp(isSale ? 'Cena' : 'Kirija', rangeGroup(s, F, ch, 'p', ctx), { id: 'cena' });
    G.kv = grp('Kvadratura', rangeGroup(s, F, ch, 'a', ctx), { id: 'kv' });
    if (!noRooms(s)) G.sobe = grp('Sobe', pillsCounted(ROOM_OPTS.map(([v, l]) => ({ v, l })), s.ro.map((r) => (r === '4+' || /\+$/.test(r) ? '4+' : +r)), F.ro, (v, on, all) => ch({ ro: all }, 'push')), { id: 'sobe' });
    G.sprat = grp('Sprat', [
      el('div', { class: 'srp-pair' },
        numInput(ctx + '-fla', s.flmin, 'od', (v) => ch({ flmin: v }, 'type'), 'Sprat od', { signed: true }),
        numInput(ctx + '-flb', s.flmax, 'do', (v) => ch({ flmax: v }, 'type'), 'Sprat do', { signed: true }),
        el('span', { class: 'srp-unit' }, 'sprat')),
      el('p', { class: 'help' }, 'Prizemlje = 0, suteren = −1'),
      el('div', { class: 'srp-checks' },
        checkC('Nije prizemlje', s.nog, (on) => ch({ nog: on }, 'push'), { count: F.bool.nog }),
        checkC('Nije poslednji sprat', s.notLast, (on) => ch({ notLast: on }, 'push'), { count: F.bool.notLast })),
    ], { id: 'sprat' });
    G.godina = grp('Godina izgradnje', el('div', { class: 'srp-pair' },
      numInput(ctx + '-ya', s.ymin, 'od', (v) => ch({ ymin: v }, 'type'), 'Godina od', { raw: true }),
      numInput(ctx + '-yb', s.ymax, 'do', (v) => ch({ ymax: v }, 'type'), 'Godina do', { raw: true }),
      el('span', { class: 'srp-unit' }, 'god.')), { id: 'godina' });
    G.stanje = grp('Stanje', pillsCounted(Object.keys(COND).map((k) => ({ v: k, l: COND[k] })), s.co, F.co, (v, on, all) => ch({ co: all }, 'push')), { id: 'stanje' });
    const heatKeys = Object.keys(HEAT).sort((a, b) => cnt(F.he, b) - cnt(F.he, a));
    G.grejanje = grp('Grejanje', el('div', { class: 'srp-checks' }, heatKeys.map((k) => checkC(HEAT[k], s.he.includes(k), (on) => ch({ he: on ? [...s.he, k] : s.he.filter((x) => x !== k) }, 'push'), { count: cnt(F.he, k) }))), { id: 'grejanje' });
    G.opr = grp('Opremljenost', pillsCounted(Object.keys(FURN).map((k) => ({ v: k, l: FURN[k] })), s.fu, F.fu, (v, on, all) => ch({ fu: all }, 'push')), { id: 'opr' });
    G.kup = grp('Kupatila', pillsCounted(BA_OPTS, num(s.ba) != null ? [s.ba] : [], F.ba, (v, on) => ch({ ba: on ? v : '' }, 'push')), { id: 'kup' });
    G.orij = grp('Orijentacija', pillsCounted(OR_OPTS.map(([v, l]) => ({ v, l })), s.or, F.or, (v, on, all) => ch({ or: all }, 'push')), { id: 'orij' });
    G.energ = grp('Energetski razred', pillsCounted(EN_OPTS.map((v) => ({ v, l: v })), s.en, F.en, (v, on, all) => ch({ en: all }, 'push')), { id: 'energ' });
    G.datum = grp('Datum objave', pillsCounted(DMAX_OPTS, num(s.dmax) != null ? [s.dmax] : [], F.dmax, (v, on) => ch({ dmax: on ? v : '' }, 'push')), { id: 'datum' });
    if (isSale) {
      G.pravni = grp('Pravni status', [
        el('div', { class: 'srp-checks' }, LG_OPTS.map(([k, lbl]) => checkC(lbl, s.lg.includes(k), (on) => ch({ lg: on ? [...s.lg, k] : s.lg.filter((x) => x !== k) }, 'push'), { count: cnt(F.lg, k) }))),
        el('p', { class: 'help' }, 'Status je onakav kako ga oglas navodi. „Po Zakonu 2025” = upis po posebnom zakonu, bez garancije bezbednosti objekta; da li će banka dati kredit, zavisi od banke.'),
      ], { id: 'pravni' });
    }
    G.mediji = grp('Mediji', el('div', { class: 'srp-checks' }, checkC('Sa tlocrtom', s.plan, (on) => ch({ plan: on }, 'push'), { count: F.bool.plan })), { id: 'mediji' });
    G.ogl = grp('Oglašivač', pillsCounted([{ v: 'agencija', l: 'Agencija' }, { v: 'vlasnik', l: 'Vlasnik' }], s.advertiser ? [s.advertiser] : [], F.adv, (v, on) => ch({ advertiser: on ? v : '' }, 'push'), { single: false }), { id: 'ogl' });
    const amKeys = (isSale ? AMEN_SALE : AMEN_RENT).filter((k) => AMEN[k]);
    const amCheck = (k) => checkC(AMEN[k], s.am.includes(k), (on) => ch({ am: on ? [...s.am, k] : s.am.filter((x) => x !== k) }, 'push'), { count: cnt(F.am, k) });
    const firstAm = amKeys.slice(0, 6), restAm = amKeys.slice(6);
    G.dodatno = grp('Dodatno', [
      el('div', { class: 'srp-checks' },
        isSale ? null : checkC('Uknjiženo', s.reg, (on) => ch({ reg: on }, 'push'), { count: F.bool.reg }),
        isSale ? checkC('Novogradnja', s.newbuild, (on) => ch({ newbuild: on }, 'push'), { count: F.bool.newbuild }) : null,
        isSale ? null : checkC('Depozit do jedne kirije', s.dep1, (on) => ch({ dep1: on }, 'push'), { count: F.bool.dep1 }),
        firstAm.map(amCheck)),
      restAm.length ? el('details', { class: 'srp-more-opts', open: restAm.some((k) => s.am.includes(k)) || null }, el('summary', {}, `Još ${restAm.length}`), el('div', { class: 'srp-checks' }, restAm.map(amCheck))) : null,
    ], { id: 'dodatno' });
    if (isSale && hasKX()) G.budzet = budgetGroup(s, F, ch, ctx);
    if (hasKX()) {
      G.trosk = costGroup(s, ch, ctx);
      if (places().length) G.udalj = distGroup(s, ch);
      const legal = checkC('Samo zeleni semafor', s.legal, (on) => ch({ legal: on }, 'push'), { count: F.bool.legal });
      const ek = safe(() => KX.EKATASTAR, null) || 'https://katastar.rgz.gov.rs/eKatastarPublic/';
      G.pouzd = grp('Pouzdanost', [legal, isSale
        ? [el('p', { class: 'help' }, 'Zeleno = uknjiženo, bez tereta po oglasu i oglašivač proveren. Pre kapare uvek proveri list nepokretnosti (ne stariji od 7 dana).'),
          el('a', { class: 'srp-ext', href: ek, target: '_blank', rel: 'noopener noreferrer' }, 'Proveri u eKatastru', icon('external', 14))]
        : el('p', { class: 'help' }, 'Zeleno = nema znakova prevare (cena, depozit unapred, neproverljiv oglašivač).')], { id: 'pouzd' });
      const quick = pillsCounted([{ v: 'drop', l: 'Snižena cena' }, { v: 'dropm', l: 'Sniženo ovog meseca' }, { v: 'below', l: 'Ispod procene' }, { v: 'stale', l: 'Na oglasu duže od 60 dana' }], ['drop', 'dropm', 'below', 'stale'].filter((k) => s[k]), F.bool, (v, on) => ch({ [v]: on }, 'push'));
      const dupTog = toggle(s.dup, (on) => ch({ dup: on }, 'push'), { label: 'Spoji iste stanove' });
      const dupNote = el('p', { class: 'help' }, s.dup ? (F.dupN ? `${F.dupN} ${plural(F.dupN, 'ponovljen oglas skriven', 'ponovljena oglasa skrivena', 'ponovljenih oglasa skriveno')} — svaki stan je prikazan jednom, sa najnižom cenom.` : 'Isti stan od više agencija prikazuje se kao jedna kartica sa najnižom cenom. U ovoj pretrazi nema duplikata.') : 'Prikazani su svi oglasi, i kad je isti stan oglašen više puta.');
      G.brzo = grp('Brzi izbori', [quick, dupTog, dupNote], { id: 'brzo' });
    }
    return G;
  }
  function budgetGroup(s, F, ch, ctx) {
    const p = profile() || {};
    const cap = safe(() => KX.creditCapacity(), null);
    const setProf = (patch) => {
      budgetPending = { ...budgetPending, ...patch };
      clearTimeout(budgetTimer);
      budgetTimer = setTimeout(() => { const p2 = budgetPending; budgetPending = {}; captureFocus(); safe(() => KX.profile.set(p2)); if (ctx === 'rail') refresh(); else if (openSheet && openSheet.recount) openSheet.recount(); }, 450);
    };
    const inc = numInput(ctx + '-inc', p.income || '', 'npr. 1.200', (v) => setProf({ income: v === '' ? 0 : v }), 'Neto primanja mesečno');
    const cash = numInput(ctx + '-cash', p.cash || '', 'npr. 30.000', (v) => setProf({ cash: v === '' ? 0 : v }), 'Ušteđevina za kupovinu');
    const has = hasBudget();
    const summary = has && cap ? el('p', { class: 'srp-cap num' }, cap.creditPossible ? `Kredit do ${eur(cap.maxLoan)} · cena do ~${eur(roundTo(cap.maxPrice, 1000))}` : `Bez kredita · keš ${eur(p.cash || 0)}`) : el('p', { class: 'help' }, 'Unesi primanja i ušteđevinu: na svakoj kartici videćeš da li ti je stan na dohvat. Ostaje samo u ovom pregledaču.');
    const affPills = has ? pillsCounted(AFF_OPTS.map((o) => ({ v: o.v, l: o.l })), s.aff, F.aff, (v, on, all) => ch({ aff: all }, 'push')) : null;
    return grp('Moj budžet', [
      el('div', { class: 'srp-budget' },
        el('label', { class: 'fld' }, el('span', { class: 'lbl' }, 'Primanja €/mes'), inc),
        el('label', { class: 'fld' }, el('span', { class: 'lbl' }, 'Ušteđevina €'), cash)),
      summary, affPills,
    ], { id: 'budzet', aside: el('span', { class: 'srp-est' }, 'procena') });
  }
  /* Troškovi: gornje granice iz modela troškova (KX.cost) — prodaja: ukupno pri kupovini; izdavanje: za useljenje */
  function costGroup(s, ch, ctx) {
    const rent = s.t === 'izdavanje';
    const fld = (key, lbl, ph, unit) => el('label', { class: 'fld' }, el('span', { class: 'lbl' }, lbl),
      el('div', { class: 'srp-one' }, numInput(`${ctx}-${key}`, s[key], ph, (v) => ch({ [key]: v }, 'type'), lbl), el('span', { class: 'srp-unit' }, unit)));
    return grp('Troškovi', [
      el('div', { class: 'srp-costf' },
        fld('tot', rent ? 'Za useljenje do' : 'Ukupno pri kupovini do', rent ? 'npr. 1.500' : 'npr. 150.000', '€'),
        fld('mes', rent ? 'Mesečno sa računima do' : 'Mesečno ukupno do', rent ? 'npr. 700' : 'npr. 900', '€/mes')),
      el('p', { class: 'help' }, rent ? 'Za useljenje = kirija + depozit + provizija (ako je plaća zakupac) + overa. Mesečno = kirija + procena računa.' : saleFormula()),
    ], { id: 'trosk', aside: el('span', { class: 'srp-est' }, 'procena') });
  }
  /* Udaljenost od mojih mesta (procena iz vazdušne linije × faktor puta) */
  const TMAX_OPTS = [10, 15, 20, 30, 45, 60];
  function distGroup(s, ch) {
    const pl = places();
    const both = pl.some((p) => (p.who || 'ja') === 'ja') && pl.some((p) => p.who === 'partner');
    const opts = [{ v: '', l: 'Bez ograničenja' }, ...pl.slice(0, 5).map((p) => ({ v: p.id, l: p.name })), ...(both ? [{ v: 'oboje', l: 'Oboje (najgori)' }] : [])];
    const tp = s.tp || '';
    const sel = select(opts, tp, (v) => ch({ tp: v, tmax: v ? (num(s.tmax) ?? 30) : '' }, 'push'), { label: 'Mesto' });
    if (!sel.id) sel.id = 'srp-tp-' + Math.random().toString(36).slice(2, 7);
    const mins = tp ? pills(TMAX_OPTS.map((m) => ({ v: m, l: `do ${m} min` })), num(s.tmax) != null ? [s.tmax] : [], (v, on) => ch({ tmax: on ? v : '' }, 'push'), { single: false }) : null;
    return grp('Udaljenost', [
      el('div', { class: 'fld' }, el('label', { class: 'lbl', for: sel.id }, 'Od mesta'), sel),
      mins,
      el('p', { class: 'help' }, tp ? 'Vreme puta je procena: vazdušna linija × 1,3 i brzina izabranog prevoza.' : 'Izaberi mesto pa najduže vreme puta. ', tp ? null : el('a', { href: '#/moja-mesta' }, 'Uredi moja mesta')),
    ], { id: 'udalj', aside: el('span', { class: 'srp-est' }, 'procena') });
  }
  const RAIL_ORDER = ['tip', 'lok', 'cena', 'kv', 'sobe', 'sprat', 'godina', 'stanje', 'pravni', 'grejanje', 'opr', 'kup', 'orij', 'energ', 'ogl', 'datum', 'dodatno', 'mediji', 'budzet', 'trosk', 'udalj', 'pouzd', 'brzo'];

  /* ───────────────────────── list sa filterima (sve ili jedna grupa) ───────────────────────── */
  /* otvarač dijaloga nosi aria-expanded=true dok je dijalog otvoren */
  function markOpen(opener) {
    if (!opener || !opener.hasAttribute || !opener.hasAttribute('aria-expanded')) return () => {};
    opener.setAttribute('aria-expanded', 'true');
    return () => { if (opener.isConnected) opener.setAttribute('aria-expanded', 'false'); };
  }
  function openFilterSheet(s, only, opener) {
    const unmark = markOpen(opener);
    let draft = { ...s, page: 1 };
    const bd = el('div', { class: 'srp-sheet' });
    const cta = el('button', { class: 'btn btn-ink', type: 'button' });
    const paintCta = () => { const n = run(draft, { sort: false }).length; cta.textContent = n ? `Prikaži ${listings(n)}` : 'Nema oglasa — promeni filtere'; };
    const ch = (patch, how) => {
      draft = { ...draft, ...patch };
      if (how === 'drag') return;
      paintCta();
      if (how === 'push' || how === 'key') paint();
    };
    const paint = () => {
      const sc = api && api.body ? api.body.scrollTop : 0;
      captureFocus();
      const F = facets(draft);
      const G = buildGroups(draft, F, ch, 'sheet');
      const ids = only ? [].concat(only) : ['t', ...RAIL_ORDER];
      if (!only) G.prikaz = grp('Prikaz cene', segmented(modesFor(draft.t), draft.mode, (v) => ch({ mode: v }, 'drag')), { id: 'prikaz' });
      if (!only) ids.push('prikaz');
      bd.replaceChildren(...ids.map((k) => G[k]).filter(Boolean));
      keyify(bd, 'sheet');
      if (api && api.body) api.body.scrollTop = sc;
      restoreFocus(bd);
    };
    const reset = el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => {
      const keep = { t: draft.t, view: draft.view, sort: draft.sort, mode: draft.mode, per: draft.per, dup: true };
      if (only) { const patch = clearPatch(only); draft = { ...draft, ...patch }; } else draft = { ...readState(new URLSearchParams()), ...keep };
      paint(); paintCta();
    } }, only ? 'Poništi' : 'Obriši sve');
    cta.addEventListener('click', () => { api.close(); go(s, { ...draft, page: 1 }); });
    const titles = { tip: 'Tip nekretnine', lok: 'Lokacija', cena: s.t === 'prodaja' ? 'Cena' : 'Kirija', kv: 'Kvadratura', sobe: 'Sobe' };
    let api = null;
    paint();
    paintCta();
    api = sheet(only ? titles[only] || 'Filteri' : 'Filteri', bd, { footer: [reset, cta], onClose: () => { unmark(); if (openSheet === api) openSheet = null; } });
    api.recount = () => { paint(); paintCta(); };
    openSheet = api;
    return api;
  }
  function clearPatch(id) {
    switch (id) {
      case 'tip': return { pt: [] };
      case 'lok': return { c: '', m: [], n: [], bb: null, zona: null };
      case 'cena': return { pmin: '', pmax: '' };
      case 'kv': return { amin: '', amax: '' };
      case 'sobe': return { ro: [] };
      default: return {};
    }
  }
  /* radio u sheetu: strelice samo pomeraju izbor (nativno ponašanje radio grupe), primena tek na klik/dodir
     ili Enter/Space — inače svaka strelica okida change → zatvaranje + navigacija */
  let radioArrowAt = 0, rangeKeyAt = 0, rangeKeyPush = 0;
  function sheetRadio(label, checked, name, value, apply) {
    const lb = check(label, checked, null, { type: 'radio', name, value });
    const input = lb.querySelector('input');
    let done = false;
    const once = () => { if (done) return; done = true; apply(); };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); once(); return; }
      /* keydown stiže na stari radio, click na novi — zato zajednički vremenski žig, ne zastavica po inputu */
      if (/^Arrow/.test(e.key)) radioArrowAt = performance.now();
    });
    /* strelica nativno okida click (detail 0) na sledećem radiju — to je samo pomeranje izbora */
    input.addEventListener('click', (e) => { if (e.detail === 0 && performance.now() - radioArrowAt < 300) return; once(); });
    return lb;
  }
  function openSortSheet(s, opener) {
    const unmark = markOpen(opener);
    const opts = sortOptions(s);
    const body = el('div', { class: 'srp-sortlist', role: 'radiogroup', 'aria-label': 'Sortiraj' },
      opts.map((o) => sheetRadio(o.l, s.sort === o.v, 'srp-sort', o.v, () => { api.close(); go(s, { sort: o.v }); })),
      el('p', { class: 'note-rule srp-honest' }, SORT_TIP));
    const api = sheet('Sortiraj', body, { onClose: unmark });
  }
  function openModeSheet(s, opener) {
    const unmark = markOpen(opener);
    const body = el('div', { class: 'srp-sortlist', role: 'radiogroup', 'aria-label': 'Prikaz cene' },
      modesFor(s.t).map((o) => sheetRadio(o.l, s.mode === o.v, 'srp-mode', o.v, () => { api.close(); setMode(s, o.v); })),
      el('p', { class: 'note-rule srp-honest' }, modeHelp(s.t)));
    const api = sheet('Prikaz cene', body, { onClose: unmark });
  }
  /* LTV iz profila (80 %, prvi stan 90 % po NBS); keš kupovina = bez kredita */
  const loanText = () => { const p = profile() || {}; if (p.financing === 'kes') return 'bez kredita'; return `kredit ${Math.round((+p.ltv || 0.8) * 100)} %`; };
  const modeHelp = (t) => (t === 'izdavanje'
    ? 'Za useljenje = kirija + depozit + provizija (ako je plaća zakupac) + overa. Mesečno sa računima = kirija + procena računa. Sve su procene, formule na „Kako računamo”.'
    : `${saleFormula()} Sve su procene, formule na „Kako računamo”.`);
  /* jedna formula za rail (Troškovi) i „Prikaži kao”: PDV je već u ceni novogradnje, porez na prenos samo za starogradnju */
  const saleFormula = () => { const cash = loanText() === 'bez kredita';
    return `Ukupno = cena + porez na prenos 2,5 % (starogradnja; kod novogradnje je PDV već u ceni), provizija, overa, upis${cash ? '' : ' i troškovi kredita'}. `
      + (cash ? 'Mesečno = računi i održavanje (bez kredita).' : `Mesečno = rata kredita (${loanText().replace('kredit ', '')} cene) + računi.`); };
  function setMode(s, v) { if (hasKX()) safe(() => KX.profile.set({ priceMode: v })); go(s, { mode: v, page: s.page }, { replace: true }); }

  /* ───────────────────────── kartice: dekoracija ui.card ───────────────────────── */
  function modePrice(l, mode) {
    if (mode === 'oglas' || !hasKX()) return null;
    const c = safe(() => KX.cost(l), null);
    if (!c) return null;
    if (l.t === 'prodaja') {
      if (mode === 'ukupno') { const extra = c.onPurchase - l.p; return { text: eur(c.onPurchase), note: `cena + ${eur(extra)} troškova kupovine`, title: `Cena iz oglasa ${eur(l.p)}; ukupno pri kupovini ${eur(c.onPurchase)} (procena)` }; }
      const rata = (c.lines.find((x) => x.key === 'rata') || {}).amount || 0;
      const ltvPct = Math.round((+c.ltv || +safe(() => profile().ltv, 0.8) || 0.8) * 100);
      const title = rata && c.loan !== 0 ? `Mesečno: kredit ${ltvPct} % cene, ${safe(() => profile().years, 25)} god. + računi (procena)` : `Mesečno: bez kredita${c.cashOnly ? ' (ovaj oglas se ne kreditira)' : ''} — računi i održavanje (procena)`;
      return { text: eur(c.monthly, 'izdavanje'), note: rata ? `rata ${eur(rata)} + računi ~${eur(c.monthly - rata)}` : `bez kredita · računi i održavanje ~${eur(c.monthly)}`, title };
    }
    if (mode === 'ukupno') { const pn = rentProvNote(l, c); return { text: eur(c.moveIn), note: 'za useljenje: ' + pn, title: `Za useljenje ${eur(c.moveIn)}: ${pn} (procena)` }; }
    return { text: eur(c.monthly, 'izdavanje'), note: `kirija + računi ~${eur(c.monthly - l.p)}`, title: `Mesečno sa računima ${eur(c.monthly, 'izdavanje')} (procena)` };
  }
  /* sastav iznosa „za useljenje” iz stavki modela: provizija samo kad je zaista plaća zakupac */
  function rentProvNote(l, c) {
    const pv = (c.lines || []).find((x) => x.key === 'provizija');
    const has = (k) => (c.lines || []).some((x) => x.key === k && x.amount > 0 && x.when === 'useljenje');
    const parts = ['kirija', has('depozit') ? 'depozit' : null].filter(Boolean);
    if (pv && pv.amount > 0 && pv.payer !== 'vlasnik') parts.push('provizija 50 %');
    if (has('overa')) parts.push('overa');
    const tail = !pv || !pv.amount || !l.ags ? ' · bez provizije' : pv.payer === 'vlasnik' ? ' · proviziju plaća vlasnik' : '';
    return parts.join(' + ') + tail;
  }
  /* jedan naziv za „oglase-mamce” (engine piše dve varijante — vidi Integration requests) */
  const mamac = (t) => String(t || '').replace(/tipično za mamac oglase/g, 'tipično za oglase-mamce').replace(/nije znak mamac-oglasa/g, 'nije znak oglasa-mamca');
  const SEM_L = { zeleno: 'Provereno', zuto: 'Proveri', crveno: 'Oprez' };
  /* tekst semafora: zeleno nikad ne počinje upozorenjem — napomene idu posle („napomena: …”); žuto/crveno vode najtežim znakom */
  function semText(t) {
    const rf = t.rental && Array.isArray(t.rental.flags) ? t.rental.flags : null;
    if (rf) {
      if (t.color === 'zeleno') return `Nizak rizik — nema ozbiljnih znakova prevare${rf[0] ? '; napomena: ' + mamac(rf[0]).replace(/^./, (c) => c.toLowerCase()) : ''}`;
      /* žuto/crveno: do dva najteža znaka (rizik je zbir, pa jedan znak sam ne objašnjava boju) */
      const top = rf.slice(0, 2).map((x, i) => (i ? mamac(x).replace(/^./, (c) => c.toLowerCase()) : mamac(x)));
      return `${t.title}${top.length ? ' — ' + top.join('; ') : t.reasons && t.reasons[0] ? ' — ' + mamac(t.reasons[0]) : ''}`;
    }
    return `${t.title}${t.reasons && t.reasons[0] ? ' — ' + mamac(t.reasons[0]) : ''}`;
  }
  function semDot(l) {
    const t = trustOf(l);
    if (!t) return null;
    const d = el('span', { class: 'srp-sem srp-sem-' + t.color, role: 'img', tabindex: '0', 'aria-label': `Semafor: ${t.title}` });
    return tip(d, semText(t));
  }
  /* semafor sa vidljivim nazivom (kartice): tačka + „Provereno / Proveri / Oprez”, objašnjenje na prelazu/fokusu */
  function semLabel(l) {
    const t = trustOf(l);
    if (!t) return null;
    const txt = semText(t);
    const n = el('span', { class: 'srp-sem-l', tabindex: '0', 'aria-label': `Semafor: ${SEM_L[t.color] || t.title}` },
      el('span', { class: 'srp-sem srp-sem-' + t.color, 'aria-hidden': 'true' }), SEM_L[t.color] || t.title);
    return tip(n, txt);
  }
  function affBadge(l) {
    if (l.t !== 'prodaja' || !hasBudget()) return null;
    const a = affOf(l);
    if (!a || a.state === 'nepoznato') return null;
    const lbl = a.state === 'odmah' ? 'Možeš odmah' : a.label;
    return tip(el('span', { class: 'srp-aff srp-aff-' + a.state }, lbl), a.reason || lbl);
  }
  function travelChips(l) {
    if (!places().length || !hasKX()) return null;
    const tr = safe(() => KX.travelAll(l), []).filter((x) => !x.far).slice(0, 2);
    if (!tr.length) return null;
    return el('p', { class: 'srp-trav' }, tr.map((x) => el('span', { class: 'srp-tchip', title: `${x.place.name}: ~${x.min} min (procena iz vazdušne linije × 1,3)` }, icon(x.mode === 'pesice' ? 'walk' : x.mode === 'bicikl' ? 'clock' : 'clock'), `${x.place.name} ${x.min} min`)));
  }
  function moreBtn(l) {
    const inCmp = safe(() => store.inCompare(l.s), false);
    return el('button', { class: 'srp-more' + (inCmp ? ' on' : ''), type: 'button', 'data-act': 'more', 'data-s': l.s, 'aria-haspopup': 'menu', 'aria-label': 'Još opcija: uporedi, sakrij' }, icon('dots'));
  }
  /* provizija jednog oglasa iz modela troškova: „bez provizije” / „2 % + PDV” / „50 % kirije” / „plaća vlasnik/prodavac” */
  function provText(l, c) {
    const pv = c && (c.lines || []).find((x) => x.key === 'provizija');
    if (!l.ag || !l.ags || !pv || !pv.amount) return 'bez provizije';
    if (l.t === 'izdavanje') return pv.payer === 'vlasnik' ? 'proviziju plaća vlasnik' : 'provizija 50 % kirije';
    if (pv.payer === 'prodavac') return 'proviziju plaća prodavac';
    const pct = safe(() => profile().agencyFeePct, 2);
    return `provizija ${String(pct).replace('.', ',')} % + PDV`;
  }
  function dupStrip(l) {
    const g = groupOf(l);
    if (!g || g.offers.length < 2) return null;
    const n = g.offers.length;
    const rent = l.t === 'izdavanje';
    const agN = new Set(g.offers.map((o) => o.ags || 'vlasnik')).size;
    const anyAgency = g.offers.some((o) => !o.owner && o.ags);
    /* po ponudi: ukupno sa troškovima (prodaja: pri kupovini; izdavanje: za useljenje), provizija, dani na oglasu */
    const rows = g.offers.map((o) => {
      const ol = safe(() => find.listing(o.s), null) || { ...l, s: o.s, p: o.p, ag: o.owner ? null : o.ag, ags: o.owner ? null : o.ags, dz: o.dz };
      const c = costOf(ol);
      const all = c ? (rent ? c.moveIn : c.onPurchase) : null;
      const h = histOf(ol);
      return { o, all, prov: provText(ol, c), days: h && h.daysOnMarket != null ? h.daysOnMarket : o.dz };
    });
    const alls = rows.map((r) => r.all).filter((v) => v != null && isFinite(v));
    const minAll = alls.length ? Math.min(...alls) : null;
    const saving = alls.length > 1 ? Math.max(...alls) - minAll : 0;
    /* ušteda = razlika u ceni iz oglasa (isto kao na stranici oglasa); razlika sa troškovima ide u objašnjenje */
    const diff = Math.max(0, g.span.max - g.span.min);
    const label = `${n} ${plural(n, 'ponuda', 'ponude', 'ponuda')} · od ${eur(g.span.min, l.t)}${diff >= 1 ? ` · uštedi do ${eur(diff, l.t)}` : ''}`;
    const why = `Isti stan nudi ${agN} ${plural(agN, 'oglašivač', 'oglašivača', 'oglašivača')}: ${eur(g.span.min, l.t)} – ${eur(g.span.max, l.t)}.`
      + (diff >= 1 ? ` Razlika u ceni iz oglasa do ${eur(diff, l.t)}` : '')
      + (saving >= 1 && Math.round(saving) !== Math.round(diff) ? `; ${rent ? 'za useljenje' : 'sa troškovima kupovine'} do ${eur(saving)}.` : diff >= 1 ? '.' : '');
    const POSE = 'Moguće da agencija nastupa kao vlasnik — isti opis i fotografije';
    let bestDone = false;
    return el('div', { class: 'srp-dup' },
      el('button', { type: 'button', class: 'srp-dup-b', 'data-act': 'dup', 'aria-expanded': 'false', title: why }, el('span', {}, label), el('span', { class: 'sr' }, ' — ' + why), icon('chev-d', 16)),
      el('ul', { class: 'srp-dup-l', hidden: true }, rows.map((r) => {
        const { o } = r;
        const best = !bestDone && minAll != null && r.all === minAll && alls.length > 1;
        if (best) bestDone = true;
        const who = o.owner
          ? [el('span', {}, 'Vlasnik'), g.ownerPosing && anyAgency ? el('span', { class: 'srp-dup-q', title: POSE, 'aria-label': POSE, role: 'img' }, '?') : null]
          : [el('span', {}, o.ag), o.agv ? icon('check', 14) : null];
        return el('li', { class: best ? 'is-best' : null },
          el('a', { href: safe(() => UI_HREF.listing(o.s), '#/oglas?s=' + o.s) },
            el('span', { class: 'ag' }, who),
            el('b', { class: 'num' }, eur(o.p, l.t)),
            el('span', { class: 'srp-dup-m num' },
              r.prov,
              r.all != null ? [el('span', { class: 'dot', 'aria-hidden': 'true' }, ' · '), `${rent ? 'za useljenje' : 'ukupno'} ${eur(r.all)}`] : null,
              [el('span', { class: 'dot', 'aria-hidden': 'true' }, ' · '), `na oglasu ${N0.format(r.days)} ${plural(r.days, 'dan', 'dana', 'dana')}`]),
            best ? el('span', { class: 'srp-dup-best' }, icon('check', 14), 'Najpovoljnije ukupno') : null));
      })),
      el('span', { class: 'sr' }, `${n} oglasa za isti stan`));
  }
  /* bez spajanja duplikata: svaki ponovljeni oglas nosi napomenu sa šifrom prvog (najjeftinijeg) oglasa */
  function dupNote(l) {
    const g = groupOf(l);
    if (!g || g.offers.length < 2) return null;
    const master = g.offers.find((o) => o.s === g.master) || g.offers[0];
    const txt = l.s === g.master
      ? `Isti stan je oglašen još ${g.offers.length - 1} ${plural(g.offers.length - 1, 'put', 'puta', 'puta')} · ovo je najniža cena`
      : `Duplikat oglasa ${master.r || ''} · najniža cena ${eur(g.span.min, l.t)}`;
    return el('p', { class: 'srp-dupnote' }, icon('blocks', 14), txt);
  }
  const floorShort = (fl, tf) => { const b = fl === -1 ? 'SU' : fl === 0 ? 'PR' : fl < -1 ? '\u2212' + Math.abs(fl) : String(fl); return tf ? `${b}/${tf}` : b; };
  function decorate(node, l, s, variant) {
    if (!node) return node;
    const seen = safe(() => store.recent.includes(l.s), false);
    if (seen) { node.classList.add('is-seen'); const h = node.querySelector('h3 a, a.ttl'); if (h) h.appendChild(el('span', { class: 'sr' }, ' (pogledano)')); }
    if (s.hid && hiddenSet().has(l.s)) node.classList.add('is-hidden');
    const mp = modePrice(l, s.mode);
    const pr = node.querySelector('.price');
    if (mp && pr) {
      pr.replaceChildren(document.createTextNode(mp.text));
      pr.title = mp.title;
      pr.classList.add('srp-pmode');
      const row = pr.closest('.pricerow') || pr.parentNode;
      if (variant === 'table') pr.appendChild(el('span', { class: 'srp-pm' }, `oglas ${eur(l.p, l.t)}`));
      else if (variant === 'car') row.after(el('p', { class: 'srp-pm' }, el('span', {}, `${s.mode === 'mesecno' ? 'mesečno' : l.t === 'izdavanje' ? 'za useljenje' : 'ukupno'} · procena`)));
      else row.after(el('p', { class: 'srp-pm' }, el('span', {}, mp.note), el('span', { class: 'srp-est' }, 'procena')));
    }
    /* sniženje iz istorije cene engine-a: kartica mora da ga pokaže, da se slaže sa filterom „Snižena cena” */
    const dr = dropInfo(l);
    if (dr && !mp) {
      if (pr && !pr.querySelector('s')) pr.appendChild(el('s', { 'aria-label': 'stara cena', title: `Snižena ${safe(() => fmt.pct(dr.pct, { sign: true }), Math.round(dr.pct) + ' %')}` }, eur(dr.old, l.t)));
      const bx = node.querySelector('.badges');
      const max = variant === 'compact' || variant === 'car' ? 1 : 2;
      if (bx && bx.children.length < max && !bx.querySelector('.badge-sale')) {
        const b = typeof badge === 'function' ? safe(() => badge('snizena', 'Snižena cena'), null) : null;
        if (b) bx.insertBefore(b, bx.querySelector('.badge-reg, .badge-fresh'));
      }
    }
    if (variant === 'table') {
      const ag = node.querySelector('.ag');
      if (ag) {
        /* naziv u svom elementu: skraćuje se elipsom, a oznaka provere ostaje u istom redu */
        const nm = el('span', { class: 'nm' });
        [...ag.childNodes].filter((c) => c.nodeType === 3).forEach((c) => nm.appendChild(c));
        ag.prepend(nm); nm.title = nm.textContent;
        const d = semDot(l); if (d) ag.prepend(d);
      }
      const tds = node.children;
      /* sprat kratko („PR/3”, „13/14”, „SU/4”), pun tekst na prelazu — kolona ostaje u jednom redu */
      if (tds[3] && l.fl != null) { const full = safe(() => fmt.floor(l.fl, l.tf), ''); tds[3].textContent = floorShort(l.fl, l.tf); tds[3].title = full; tds[3].setAttribute('aria-label', full); }
      /* Δ opštine: ispod €/m² kad je kolona „Δ opština” skrivena (< 1280px); kopija, original ostaje u svojoj koloni */
      if (tds.length > 5) { const dc = tds[5].querySelector('.delta'); if (dc && tds[4]) tds[4].appendChild(el('span', { class: 'srp-ppmd', 'aria-hidden': 'true' }, dc.cloneNode(true))); }
      return node;
    }
    const car = variant === 'car';
    const after = node.querySelector('.srp-pm') || node.querySelector('.pricerow');
    const ab = car ? null : affBadge(l); if (ab && after) after.after(el('p', { class: 'srp-affrow' }, ab));
    const facts = node.querySelector('.facts');
    const tc = car ? null : travelChips(l); if (tc && facts) facts.after(tc);
    const foot = node.querySelector('.foot');
    const body = node.querySelector('.body');
    if (foot) {
      /* semafor: uvek na početku podnožja, sa nazivom (isto mesto u Mreži i u Listi pored mape) */
      const sl = semLabel(l); if (sl) foot.prepend(sl);
      /* naziv oglašivača u svom elementu: skraćuje se elipsom (tekst direktno u flex kutiji se samo odseca) */
      const agEl = foot.querySelector('.ag');
      if (agEl && !agEl.querySelector('.nm')) { const nm = el('span', { class: 'nm' }); [...agEl.childNodes].filter((c) => c.nodeType === 3).forEach((c) => nm.appendChild(c)); agEl.prepend(nm); nm.title = nm.textContent; }
      const time = foot.querySelector('time');
      if (seen) {
        const sn = el('span', { class: 'srp-seen' }, 'Pogledano');
        /* uska kartica Mreže: „Pogledano” stoji na mestu datuma (datum ostaje u title i za čitače ekrana), da naziv oglašivača ne nestane */
        if (time && variant === 'grid') { const rel = time.textContent; sn.title = 'Objavljeno ' + rel; time.hidden = true; time.before(sn); sn.appendChild(el('span', { class: 'sr' }, ', objavljeno ' + rel)); }
        else if (time) time.before(sn); else foot.appendChild(sn);
      }
      /* izdavanje: ko plaća proviziju — sopstveni red iznad podnožja (podnožje ostaje jedan red) */
      if (l.t === 'izdavanje') {
        const c = costOf(l); const pv = c && (c.lines || []).find((x) => x.key === 'provizija');
        const txt = !l.ags || !pv || !pv.amount ? 'bez provizije' : pv.payer === 'vlasnik' ? 'proviziju plaća vlasnik' : 'provizija 50 % kirije';
        const pr2 = el('p', { class: 'srp-provrow' }, el('span', { class: 'srp-prov', title: pv && pv.note ? pv.note : txt }, txt));
        const host = node.querySelector('.mid');
        if (host) host.appendChild(pr2); else foot.before(pr2);
      }
    }
    else if (variant === 'compact') {
      /* telefon: semafor i „Pogledano” u redu ispod činjenica (cena ostaje sama u svom redu) */
      const sl = semLabel(l);
      const line = sl || seen ? el('p', { class: 'srp-crow' }, sl, seen ? el('span', { class: 'srp-seen' }, 'Pogledano') : null) : null;
      if (line) { const anchor = node.querySelector('.srp-trav') || facts; if (anchor) anchor.after(line); else if (body) body.appendChild(line); }
    }
    /* „⋯”: Mreža — u podnožju posle datuma (fotografija nosi samo srce); Lista — u bočnoj koloni; telefon — ispod srca */
    if (variant === 'grid' && foot) foot.appendChild(moreBtn(l));
    else if (variant === 'list') { const side = node.querySelector('.side'); if (side) side.insertBefore(moreBtn(l), side.children[1] || null); }
    else node.appendChild(moreBtn(l));
    /* duplikati: iznad podnožja (sva podnožja u redu mreže ostaju poravnata); telefon — cela širina ispod sličice */
    const ds = car ? null : s.dup ? dupStrip(l) : dupNote(l);
    if (ds) {
      if (foot && body && foot.parentNode === body) body.insertBefore(ds, foot);
      else if (variant === 'compact') node.appendChild(ds);
      else (body || node).appendChild(ds);
    }
    return node;
  }
  /* 'car' = kompaktna kartica u karuselu mape na telefonu: samo cena, Δ, naslov i činjenice (bez traka duplikata, budžeta, puta) */
  const mkCard = (l, s, variant) => decorate(card(l, variant === 'car' ? 'compact' : variant), l, s, variant);

  /* meni „⋯” na kartici (jedan, deljen) */
  let menuEl = null;
  function closeMenu() { if (menuEl) { const o = menuEl._opener; menuEl.remove(); menuEl = null; document.removeEventListener('keydown', menuKey, true); if (o && o.isConnected) o.setAttribute('aria-expanded', 'false'); } }
  function menuKey(e) { if (e.key === 'Escape') { const o = menuEl && menuEl._opener; closeMenu(); if (o) o.focus(); } }
  function openMenu(btn, slug, s) {
    closeMenu();
    const l = safe(() => find.listing(slug), null); if (!l) return;
    const inCmp = safe(() => store.inCompare(slug), false);
    const isHidden = hiddenSet().has(slug);
    const item = (ic, label, fn) => el('button', { type: 'button', role: 'menuitem', onclick: () => { closeMenu(); fn(); } }, icon(ic, 16), label);
    menuEl = el('div', { class: 'srp-menu', role: 'menu', 'aria-label': 'Opcije oglasa' },
      item('compare', inCmp ? 'Ukloni iz poređenja' : 'Dodaj u poređenje', () => toggleCompare(slug)),
      hasKX() ? item(isHidden ? 'eye' : 'x', isHidden ? 'Vrati u rezultate' : 'Sakrij oglas', () => (isHidden ? unhide(slug) : hide(slug))) : null);
    menuEl._opener = btn;
    menuEl._y = window.scrollY;
    document.body.appendChild(menuEl);
    placeMenu();
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', menuKey, true);
    const first = menuEl.querySelector('button'); if (first) first.focus({ preventScroll: true });
  }
  function placeMenu() {
    if (!menuEl) return;
    const r = menuEl._opener.getBoundingClientRect();
    const w = menuEl.offsetWidth;
    menuEl.style.top = Math.max(8, Math.min(window.innerHeight - menuEl.offsetHeight - 8, r.bottom + 6)) + 'px';
    menuEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
  }
  /* pri skrolu meni prati dugme; zatvara se tek kad dugme izađe iz ekrana ili posle > 120 px skrola */
  function menuScroll() {
    if (!menuEl) return;
    const o = menuEl._opener;
    const r = o && o.isConnected ? o.getBoundingClientRect() : null;
    if (!r || r.bottom < 0 || r.top > window.innerHeight || Math.abs(window.scrollY - menuEl._y) > 120) closeMenu();
    else placeMenu();
  }
  document.addEventListener('click', (e) => { if (menuEl && !menuEl.contains(e.target) && !(e.target.closest && e.target.closest('[data-act="more"]'))) closeMenu(); });
  window.addEventListener('scroll', menuScroll, { passive: true });
  window.addEventListener('resize', menuScroll, { passive: true });
  function toggleCompare(slug) {
    /* stanje pre promene: false iz toggleCompare znači „uklonjeno” samo ako je oglas već bio u poređenju;
       inače je lista puna i core je već prikazao „Možete uporediti najviše 4 oglasa” */
    const was = safe(() => store.inCompare(slug), false);
    const on = safe(() => store.toggleCompare(slug), false);
    const ids = safe(() => store.compare.slice(), []);
    if (on) toast(`Dodato u poređenje (${ids.length})`, { action: { label: 'Uporedi', href: '#/uporedi?ids=' + ids.join(',') } });
    else if (was && !ids.includes(slug)) toast('Uklonjeno iz poređenja');
    $$('.srp-more[data-s="' + slug + '"]').forEach((b) => b.classList.toggle('on', ids.includes(slug)));
  }
  function hide(slug) {
    const h = new Set(hiddenSet()); h.add(slug);
    safe(() => KX.profile.set({ hidden: h }));
    refresh();
    toast('Oglas je sakriven iz rezultata', { action: { label: 'Vrati', onClick: (e) => { if (e) { e.preventDefault(); const t = e.target.closest('.toast'); if (t) t.remove(); } unhide(slug); } } });
  }
  function unhide(slug) {
    const h = new Set(hiddenSet()); h.delete(slug);
    safe(() => KX.profile.set({ hidden: h }));
    refresh();
  }
  function paintCompareLink(root) {
    const a = root.querySelector('.srp-cmp');
    if (!a) return;
    const ids = safe(() => store.compare.slice(), []);
    a.hidden = !ids.length;
    a.href = '#/uporedi?ids=' + ids.join(',');
    a.lastChild.textContent = `Uporedi (${ids.length})`;
  }

  /* ───────────────────────── delovi stranice ───────────────────────── */
  function crumbsFor(s) {
    const items = [{ label: 'Početna', href: '#/' }];
    const t = { t: s.t };
    items.push({ label: tWord(s.t), href: router.href('/pretraga', t) });
    if (s.pt.length === 1) items.push({ label: `${tWord(s.t)} ${typeOfV(s.pt[0]).pl}`, href: router.href('/pretraga', { ...t, pt: s.pt }) });
    const city = s.c ? safe(() => find.city(s.c), null) : null;
    if (city) items.push({ label: city.n, href: router.href('/pretraga', { ...t, pt: s.pt, c: s.c }) });
    if (s.m.length === 1) { const m = safe(() => find.mun(s.m[0]), null); if (m) items.push({ label: m.n, href: router.href('/pretraga', { ...t, pt: s.pt, c: s.c, m: s.m }) }); }
    return crumbs(items);
  }
  function headBlock(s, list) {
    const ppms = list.filter((l) => l.ppm && l.pt !== 'zemljiste').map((l) => l.ppm);
    const avg = ppms.length ? ppms.reduce((a, b) => a + b, 0) / ppms.length : null;
    const nNew = list.filter((l) => l.dz <= 7).length;
    const meta = el('p', { class: 'srp-meta num' },
      el('b', {}, listings(list.length)),
      avg ? [el('span', { class: 'dot', 'aria-hidden': 'true' }, '·'), `prosečno ${safe(() => fmt.ppm(avg), N0.format(avg) + ' €/m²')}`] : null,
      nNew ? [el('span', { class: 'dot', 'aria-hidden': 'true' }, '·'), tip(el('span', { class: 'srp-new' }, `${nNew} ${plural(nNew, 'novi', 'nova', 'novih')}`), 'Objavljeno u poslednjih 7 dana')] : null);
    const params = toParams({ ...s, page: 1, view: 'grid', mode: 'oglas' });
    const pkey = JSON.stringify(params);
    const saved = safe(() => store.searches.find((x) => JSON.stringify(x.params) === pkey), null);
    const saveWrap = el('div', { class: 'srp-save' });
    const saveSlot = el('span', { class: 'srp-saveslot' });
    const nPl = places().length;
    const shareBox = el('div', { class: 'srp-share', hidden: true });
    const shareBtn = el('button', { class: 'btn btn-secondary btn-sm srp-hbtn', type: 'button', 'aria-label': 'Podeli pretragu', title: 'Podeli pretragu' }, icon('share', 16), el('span', {}, 'Podeli'));
    const placesBtn = el('a', { class: 'btn btn-secondary btn-sm srp-hbtn', href: '#/moja-mesta', 'aria-label': nPl ? `Moja mesta (${nPl})` : 'Moja mesta: dodaj posao, školu…', title: 'Moja mesta: vreme puta na svakoj kartici' }, icon('pin', 16), el('span', {}, nPl ? `Moja mesta · ${nPl}` : 'Moja mesta'));
    saveWrap.append(shareBtn, placesBtn, saveSlot);
    shareBtn.addEventListener('click', async () => {
      const url = location.href;
      const fallback = () => {
        const inp = el('input', { class: 'input', readonly: true, value: url, 'aria-label': 'Link ove pretrage', onfocus: (e) => e.target.select() });
        shareBox.replaceChildren(el('span', { class: 'lbl' }, 'Kopiraj link pretrage'), inp);
        shareBox.hidden = false; inp.focus(); inp.select();
      };
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('nema clipboard');
        await navigator.clipboard.writeText(url);
        shareBox.hidden = true;
        toast('Link kopiran');
      } catch (e) { fallback(); }
    });
    const paintSave = (isSaved) => {
      saveSlot.replaceChildren(isSaved
        ? el('a', { class: 'btn btn-secondary btn-sm srp-saved', href: '#/sacuvani', 'aria-label': 'Pretraga je sačuvana — otvori sačuvane' }, icon('check'), 'Pretraga sačuvana')
        : el('button', { class: 'btn btn-secondary btn-sm', type: 'button', 'data-act': 'save-open', 'aria-expanded': 'false' }, icon('bookmark'), 'Sačuvaj pretragu'));
    };
    paintSave(!!saved);
    const form = el('form', { class: 'srp-saveform', hidden: true, 'aria-label': 'Sačuvaj pretragu' },
      el('label', { class: 'fld' }, el('span', { class: 'lbl' }, 'Naziv pretrage'), el('input', { class: 'input', name: 'name', value: autoName(s), maxlength: '80', 'data-fkey': 'save-name' })),
      el('fieldset', { class: 'srp-freq' }, el('legend', { class: 'lbl' }, 'Obaveštenja o novim oglasima'),
        el('div', { class: 'srp-freq-l' }, FREQ.map((f, i) => check(f.l, i === 1, () => {}, { type: 'radio', name: 'freq', value: f.v })))),
      el('div', { class: 'btn-row' }, el('button', { class: 'btn btn-ink btn-sm', type: 'submit' }, 'Sačuvaj'), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-act': 'save-cancel' }, 'Otkaži')),
      el('p', { class: 'help' }, 'Pretraga ostaje u ovom pregledaču; na stranici Sačuvano vidiš nove oglase od poslednje posete. Obaveštenja su demo: ništa se ne šalje.'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (form.elements.name.value || '').trim() || autoName(s);
      const fr = form.querySelector('input[name="freq"]:checked');
      const it = safe(() => store.saveSearch(name, params), null);
      /* učestalost: store.saveSearch još ne prima opcije — upiši je na stavku i snimi listu (removeSearch bez pogotka samo snima) */
      if (it && fr) { it.freq = fr.value; safe(() => store.removeSearch('__nema__')); }
      form.hidden = true;
      paintSave(!!it);
      toast(it ? `Sačuvano: ${name}` : 'Čuvanje nije uspelo', it ? { action: { label: 'Sačuvane pretrage', href: '#/sacuvani' } } : {});
    });
    saveSlot.addEventListener('click', (e) => {
      if (!e.target.closest('[data-act="save-open"]')) return;
      form.hidden = !form.hidden;
      e.target.closest('button').setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) { const i = form.elements.name; i.focus(); i.select(); }
    });
    form.addEventListener('click', (e) => { if (e.target.closest('[data-act="save-cancel"]')) { form.hidden = true; const b = saveSlot.querySelector('button'); if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); } } });
    return el('header', { class: 'srp-head' },
      crumbsFor(s),
      el('div', { class: 'srp-hrow' },
        el('div', { class: 'srp-htxt' }, el('h1', { class: 't-h1' }, titleFor(s)), meta),
        saveWrap),
      shareBox,
      form);
  }
  const FREQ = [{ v: 'odmah', l: 'Odmah' }, { v: 'dnevno', l: 'Dnevno' }, { v: 'nedeljno', l: 'Nedeljno' }, { v: 'nikad', l: 'Bez obaveštenja' }];
  function pillLabel(s, id) {
    switch (id) {
      case 'tip': return s.pt.length === 1 ? (s.pt[0] === 'soba' ? 'Tip: soba' : typeOfV(s.pt[0]).l) : s.pt.length ? `Tip · ${s.pt.length}` : 'Tip';
      case 'lok': { const c = s.c && safe(() => find.city(s.c), null); return s.m.length ? `${c ? c.n + ' · ' : ''}${s.m.length === 1 ? (safe(() => find.mun(s.m[0]).n, 'opština')) : s.m.length + ' opštine'}` : c ? c.n : 'Lokacija'; }
      case 'cena': return priceQual(s) || (s.t === 'izdavanje' ? 'Kirija' : 'Cena');
      case 'kv': { const a = num(s.amin), b = num(s.amax); return a != null && b != null ? `${a}–${b} m²` : b != null ? `do ${b} m²` : a != null ? `od ${a} m²` : 'Kvadratura'; }
      case 'sobe': return s.ro.length ? `Sobe ${s.ro.map((r) => (typeof r === 'number' ? safe(() => fmt.roomsN(r), r) : r)).join(', ')}` : 'Sobe';
      default: return id;
    }
  }
  /* soba, garaža, plac, lokal: broj soba nema smisla — bez pilule i grupe „Sobe” (osim ako je filter već postavljen) */
  const NO_ROOMS = ['soba', 'garaza', 'zemljiste', 'poslovni-prostor'];
  const noRooms = (s) => s.pt.length > 0 && s.pt.every((v) => NO_ROOMS.includes(v)) && !s.ro.length;
  const pillOn = (s, id) => (id === 'tip' ? s.pt.length : id === 'lok' ? !!(s.c || s.m.length) : id === 'cena' ? num(s.pmin) != null || num(s.pmax) != null : id === 'kv' ? num(s.amin) != null || num(s.amax) != null : id === 'sobe' ? s.ro.length : false);
  /* brzi izbori u traci (RESEARCH: jednim dodirom, zavisno od transakcije) — samo uključuju postojeće ključeve filtera */
  function quickDefs(s) {
    const amT = (k, l) => ({ id: k, l, on: s.am.includes(k), patch: (on) => ({ am: on ? [...s.am, k] : s.am.filter((x) => x !== k) }) });
    const own = { id: 'vlasnik', l: 'Od vlasnika', on: s.advertiser === 'vlasnik', patch: (on) => ({ advertiser: on ? 'vlasnik' : '' }) };
    if (s.t === 'izdavanje') return [own,
      { id: 'namesten', l: 'Namešteno', on: s.fu.includes('namesten'), patch: (on) => ({ fu: on ? [...s.fu, 'namesten'] : s.fu.filter((x) => x !== 'namesten') }) },
      amT('petsAllowed', 'Ljubimci OK'),
      { id: 'dep1', l: 'Depozit ≤ 1 kirija', on: s.dep1, patch: (on) => ({ dep1: on }) }];
    return [own,
      { id: 'uknj', l: 'Uknjiženo', on: s.lg.includes('uknjizeno'), patch: (on) => ({ lg: on ? [...s.lg, 'uknjizeno'] : s.lg.filter((x) => x !== 'uknjizeno') }) },
      { id: 'newbuild', l: 'Novogradnja', on: s.newbuild, patch: (on) => ({ newbuild: on }) },
      amT('hasElevator', 'Lift'),
      { id: 'drop', l: 'Snižena cena', on: s.drop, patch: (on) => ({ drop: on }) }];
  }
  function quickChips(s, cur) {
    const defs = quickDefs(s);
    /* bez rezultata brzi izbori samo smetaju (svi bi bili 0) — osim uključenih, da mogu da se isključe */
    return (cur ? defs : defs.filter((q) => q.on)).map((q) => {
      /* broj = koliko oglasa ostaje kad je izbor uključen */
      const n = q.on ? cur : run({ ...s, ...q.patch(true) }, { sort: false }).length;
      const b = filterChip(q.l, { on: q.on, n: N0.format(n), chevron: false });
      b.dataset.act = 'quick'; b.dataset.id = q.id;
      b.classList.add('srp-quick');
      if (!n && !q.on) b.classList.add('is-zero');
      return b;
    });
  }
  /* desktop/tablet: brzi izbori u svom redu ispod trake (u traci nema mesta; na telefonu su u skrol-railu trake) */
  function quickRow(s, cur) {
    const ch = quickChips(s, cur);
    if (!ch.length) return null;
    return el('div', { class: 'srp-qrow', role: 'group', 'aria-label': 'Brzi izbori' }, el('span', { class: 'lbl' }, 'Brzo'), el('div', { class: 'srp-qchips' }, ch));
  }
  function filterBar(s, B, cur) {
    const n = activeCount(s);
    const cut = (t) => (t.length > 26 ? t.slice(0, 25) + '…' : t);
    const pillsArr = ['tip', 'lok', 'cena', 'kv', ...(noRooms(s) ? [] : ['sobe'])].map((id) => { const b = filterChip(cut(pillLabel(s, id)), { on: !!pillOn(s, id), expands: true }); b.dataset.act = 'pill'; b.dataset.id = id; return b; });
    const sortSel = select(sortOptions(s), s.sort, (v) => go(s, { sort: v }), { inline: true, label: 'Sortiraj' });
    sortSel.dataset.fkey = 'sort';
    const info = tip(el('button', { class: 'iconbtn srp-info', type: 'button', 'aria-label': 'Kako sortiramo' }, icon('info', 16)), SORT_TIP);
    const viewOpts = [{ v: 'grid', l: 'Mreža' }, { v: 'list', l: 'Lista' }, { v: 'map', l: 'Mapa' }];
    const deskViews = views(viewOpts, s.view, (v) => go(s, { view: v, page: s.page }, { replace: false }));
    const phoneView = s.view === 'map' ? 'map' : 'list';
    const phoneViews = views([{ v: 'list', l: 'Lista' }, { v: 'map', l: 'Mapa' }], phoneView, (v) => go(s, { view: v === 'list' ? 'grid' : 'map', page: 1 }));
    const fbtn = filterChip('Filteri', { filters: true, n: n || null, icon: 'filter' }); fbtn.dataset.act = 'filters';
    const sbtn = el('button', { class: 'btn btn-ghost btn-sm srp-sortbtn', type: 'button', 'data-act': 'sortsheet' }, icon('sort', 16), 'Sortiraj');
    const allBtn = filterChip('Svi filteri', { n: n || null, icon: 'filter', chevron: false }); allBtn.dataset.act = 'filters'; allBtn.classList.add('srp-all');
    [fbtn, sbtn, allBtn].forEach((b) => { b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false'); });
    const modePill = filterChip(s.mode === 'oglas' ? 'Prikaz cene' : modesFor(s.t).find((m) => m.v === s.mode).l, { on: s.mode !== 'oglas', expands: true }); modePill.dataset.act = 'modesheet';
    return el('div', { class: 'filterbar srp-bar' },
      el('div', { class: 'row1' }, fbtn, sbtn, el('span', { class: 'sp' }), phoneViews),
      el('div', { class: 'rail srp-rail-h' }, pillsArr.map((b) => b.cloneNode(true)), modePill, cur || quickDefs(s).some((q) => q.on) ? [el('span', { class: 'srp-pdiv', 'aria-hidden': 'true' }), quickChips(s, cur)] : null),
      el('div', { class: 'desk srp-desk srp-desk-l' },
        segmented([{ v: 'prodaja', l: 'Prodaja' }, { v: 'izdavanje', l: 'Izdavanje' }], s.t, (v) => go(s, { t: v, ...T_RESET })),
        el('div', { class: 'srp-pills' }, pillsArr), allBtn),
      el('div', { class: 'desk srp-desk srp-desk-r' },
        el('label', { class: 'sort' }, icon('sort', 16), el('span', {}, 'Sortiraj'), sortSel), info, deskViews));
  }
  /* oznaka sprata rečima: −1 = suteren, 0 = prizemlje; ostali negativni sa pravim minusom (U+2212) */
  function floorLabel(a, b) {
    const gen = (v) => (v === -1 ? 'suterena' : v === 0 ? 'prizemlja' : v < 0 ? '\u2212' + Math.abs(v) + '.' : v + '.');
    const nom = (v) => (v === -1 ? 'suteren' : v === 0 ? 'prizemlje' : v < 0 ? '\u2212' + Math.abs(v) + '. sprat' : v + '. sprat');
    if (a != null && b != null) {
      if (a === b) return a <= 0 ? 'Samo ' + nom(a) : `Samo ${a}. sprat`;
      return `Sprat od ${gen(a)} do ${gen(b)}`;
    }
    if (a != null) return `Sprat od ${gen(a)}`;
    return `Sprat do ${gen(b)}`;
  }
  function activeTags(s) {
    const tags = [];
    const add = (label, patch) => tags.push({ label, onRemove: () => go(s, patch) });
    s.pt.forEach((v) => add(typeOfV(v).l, { pt: s.pt.filter((x) => x !== v) }));
    if (s.c) { const c = safe(() => find.city(s.c), null); add(c ? c.n : s.c, { c: '', m: [], n: [] }); }
    s.m.forEach((v) => { const m = safe(() => find.mun(v), null); add(m ? m.n : v, { m: s.m.filter((x) => x !== v), n: [] }); });
    s.n.forEach((v) => add(v, { n: s.n.filter((x) => x !== v) }));
    const pq = priceQual(s); if (pq) add(pq, { pmin: '', pmax: '' });
    if (num(s.amin) != null || num(s.amax) != null) add(pillLabel(s, 'kv'), { amin: '', amax: '' });
    s.ro.forEach((r) => add(r === '4+' || /\+$/.test(r) ? '4+ sobe' : safe(() => fmt.roomsText(+r), String(r)), { ro: s.ro.filter((x) => x !== r) }));
    if (num(s.flmin) != null || num(s.flmax) != null) add(floorLabel(num(s.flmin), num(s.flmax)), { flmin: '', flmax: '' });
    if (s.nog) add('Nije prizemlje', { nog: false });
    if (s.notLast) add('Nije poslednji sprat', { notLast: false });
    if (num(s.ymin) != null || num(s.ymax) != null) add(`Godina ${num(s.ymin) ?? '…'}–${num(s.ymax) ?? '…'}`, { ymin: '', ymax: '' });
    s.co.forEach((v) => add(COND[v] || v, { co: s.co.filter((x) => x !== v) }));
    s.he.forEach((v) => add(HEAT[v] || v, { he: s.he.filter((x) => x !== v) }));
    s.fu.forEach((v) => add(FURN[v] || v, { fu: s.fu.filter((x) => x !== v) }));
    if (s.reg) add('Uknjiženo', { reg: false });
    if (s.newbuild) add('Novogradnja', { newbuild: false });
    s.lg.forEach((v) => add(LG_L[v] || v, { lg: s.lg.filter((x) => x !== v) }));
    if (num(s.ba) != null) add(`Kupatila ${s.ba}+`, { ba: '' });
    s.or.forEach((v) => add(`Orijentacija: ${(OR_L[v] || v).toLowerCase()}`, { or: s.or.filter((x) => x !== v) }));
    s.en.forEach((v) => add(`Energetski razred ${v}`, { en: s.en.filter((x) => x !== v) }));
    if (num(s.dmax) != null) add(s.dmax === 1 ? 'Objavljeno danas' : `Objavljeno u poslednjih ${s.dmax} dana`, { dmax: '' });
    if (s.plan) add('Sa tlocrtom', { plan: false });
    if (s.dep1) add('Depozit do jedne kirije', { dep1: false });
    s.am.forEach((v) => add(AMEN[v] || v, { am: s.am.filter((x) => x !== v) }));
    if (s.advertiser) add(s.advertiser === 'vlasnik' ? 'Od vlasnika' : 'Agencije', { advertiser: '' });
    if (s.agency) { const a = safe(() => find.agency(s.agency), null); add(a ? a.n : s.agency, { agency: '' }); }
    if (s.q) add(`„${s.q}”`, { q: '' });
    if (num(s.deltaMax) != null) add(`Δ do ${s.deltaMax} %`, { deltaMax: '' });
    if (s.legal) add('Zeleni semafor', { legal: false });
    s.aff.forEach((v) => add(AFF_OPTS.find((o) => o.v === v).l, { aff: s.aff.filter((x) => x !== v) }));
    if (s.drop) add('Snižena cena', { drop: false });
    if (s.dropm) add('Sniženo ovog meseca', { dropm: false });
    if (num(s.tot) != null) add(`${s.t === 'izdavanje' ? 'Za useljenje' : 'Ukupno'} do ${eur(s.tot)}`, { tot: '' });
    if (num(s.mes) != null) add(`Mesečno do ${eur(s.mes, 'izdavanje')}`, { mes: '' });
    if (s.tp && num(s.tmax) != null) { const pn = s.tp === 'oboje' ? 'Oboje' : safe(() => places().find((x) => x.id === s.tp).name, 'Mesto'); add(`${pn} do ${s.tmax} min`, { tp: '', tmax: '' }); }
    if (s.below) add('Ispod procene', { below: false });
    if (s.stale) add('Na oglasu duže od 60 dana', { stale: false });
    if (s.bb) add('Izabrano područje na mapi', { bb: null });
    if (s.zona) add('Nacrtana zona', { zona: null });
    return activeFilters(tags, () => go(s, clearAllPatch(s)));
  }
  function clearAllPatch(s) {
    const d = readState(new URLSearchParams());
    return { ...d, t: s.t, view: s.view, sort: s.sort, mode: s.mode, per: s.per, dup: s.dup };
  }
  function resBar(s, list, F, B) {
    const cmpIds = safe(() => store.compare.slice(), []);
    const left = el('p', { class: 'srp-count num', 'aria-live': 'polite', tabindex: '-1' },
      el('b', {}, listings(list.length)),
      F.hiddenN ? [el('span', { class: 'dot', 'aria-hidden': 'true' }, '·'), el('button', { type: 'button', class: 'srp-lnk', 'data-act': 'showhidden' }, `Sakriveno: ${F.hiddenN} · Prikaži`)] : null,
      s.hid ? [el('span', { class: 'dot', 'aria-hidden': 'true' }, '·'), el('button', { type: 'button', class: 'srp-lnk', 'data-act': 'hidehidden' }, 'Ne prikazuj sakrivene')] : null,
      el('a', { class: 'srp-lnk srp-cmp', href: '#/uporedi?ids=' + cmpIds.join(','), hidden: !cmpIds.length }, icon('compare', 16), `Uporedi (${cmpIds.length})`));
    const modeSeg = segmented(modesFor(s.t), s.mode, (v) => setMode(s, v));
    modeSeg.setAttribute('aria-label', 'Prikaži cenu kao');
    const right = hasKX() ? el('div', { class: 'srp-mode' }, el('span', { class: 'lbl' }, 'Prikaži kao'), modeSeg,
      tip(el('button', { class: 'iconbtn srp-info', type: 'button', 'aria-label': 'Šta znači prikaz cene' }, icon('info', 16)), modeHelp(s.t))) : null;
    return el('div', { class: 'srp-resbar' }, left, right);
  }

  /* ───────────────────────── glavni sadržaj po prikazu ───────────────────────── */
  function pageSlice(list, s, B) {
    const pages = Math.max(1, Math.ceil(list.length / s.per));
    const page = Math.min(s.page, pages);
    if (!B.wide) return { items: list.slice(0, page * s.per), page, pages, cumulative: true };
    return { items: list.slice((page - 1) * s.per, page * s.per), page, pages, cumulative: false };
  }
  function pagerBlock(s, list, P, B) {
    if (!list.length) return null;
    if (!B.wide) {
      const shown = P.items.length;
      return el('div', { class: 'srp-more-load' },
        el('p', { class: 'meta num' }, `Prikazano ${N0.format(shown)} od ${listings(list.length)}`),
        shown < list.length ? el('button', { class: 'btn btn-secondary btn-block', type: 'button', 'data-act': 'loadmore' }, `Učitaj još ${Math.min(s.per, list.length - shown)}`) : null);
    }
    return pager(P.page, P.pages, (p) => go(s, { page: p }, { scrollTop: true }), { per: s.per, perOptions: PER_OPTS, onPer: (n) => go(s, { per: n, page: 1 }) });
  }
  /* prvih N kartica odmah, ostatak u sledećem frejmu (mesta drže kosturi iste visine) — render ostaje < 50 ms */
  function fill(container, items, mk, first, ph) {
    items.slice(0, first).forEach((l) => container.appendChild(mk(l)));
    const tail = items.slice(first);
    if (!tail.length) return container;
    const holders = tail.map(() => container.appendChild(ph()));
    requestAnimationFrame(() => {
      if (!container.isConnected) return;
      tail.forEach((l, i) => { if (holders[i].isConnected) holders[i].replaceWith(mk(l)); });
    });
    return container;
  }
  const rowPh = (cls) => () => el('div', { class: cls + ' srp-ph', 'aria-hidden': 'true' });
  function gridView(s, items, B) {
    if (B.phone) return fill(el('div', { class: 'rows srp-rows' }), items, (l) => mkCard(l, s, 'compact'), 6, rowPh('row-c'));
    return fill(el('div', { class: 'cards' + (B.desk ? ' cards-3' : '') + ' srp-cards' }), items, (l) => mkCard(l, s, 'grid'), B.desk ? 6 : 4, () => skeletonCard());
  }
  function tableSortFor(s) { return ['a-desc', 'a-asc', 'ppm-asc', 'ppm-desc', 'p-asc', 'p-desc', 'delta', 'delta-desc'].includes(s.sort) ? s.sort : null; }
  function listView(s, items, B) {
    if (!B.wide) return gridView(s, items, { ...B, phone: true });
    const cur = tableSortFor(s);
    const onSort = (key) => {
      const base = key.split('-')[0];
      let next = key;
      if (cur && cur.split('-')[0] === base) next = base === 'delta' ? (cur === 'delta' ? 'delta-desc' : 'delta') : base + (cur.endsWith('desc') ? '-asc' : '-desc');
      go(s, { sort: next, page: 1 });
    };
    const FIRST = 8;
    const wrap = listTable(items.slice(0, FIRST), { sort: cur, onSort });
    wrap.classList.add('srp-table');
    const deco = (tr) => { const l = safe(() => find.listing(tr.dataset.slug), null); if (l) decorate(tr, l, s, 'table'); return tr; };
    $$('tbody tr', wrap).forEach(deco);
    const rest = items.slice(FIRST);
    if (rest.length) {
      const tb = wrap.querySelector('tbody');
      const holders = rest.map(() => tb.appendChild(el('tr', { class: 'srp-ph', 'aria-hidden': 'true' }, el('td', { colspan: '10' }))));
      requestAnimationFrame(() => {
        if (!wrap.isConnected) return;
        const more = listTable(rest, { sort: cur, onSort });
        $$('tbody tr', more).forEach((tr, i) => { if (holders[i] && holders[i].isConnected) holders[i].replaceWith(deco(tr)); });
      });
    }
    return wrap;
  }
  function mapViewBlock(s, items, B, all) {
    const pinsList = run({ ...s, bb: null, zona: null });
    const host = el('div', { class: 'srp-map', 'aria-label': 'Mapa rezultata' });
    if (!B.wide) {
      const car = fill(el('div', { class: 'srp-car', role: 'list', 'aria-label': 'Oglasi na mapi' }), all.slice(0, 40), (l) => { const c = mkCard(l, s, 'car'); c.setAttribute('role', 'listitem'); return c; }, 4, rowPh('row-c'));
      const box = el('div', { class: 'srp-mapfull' }, host, car);
      const scrollIn = lastView !== 'map';
      /* „pun ekran”: traka filtera staje ispod zaglavlja, mapa zauzima tačno ostatak ekrana iznad donje navigacije.
         Meri se zaglavlje stranice (nije sticky) i sama kutija mape — sticky traka bi dala svoj „zalepljeni” položaj. */
      const prep = () => {
        const root = box.closest('.srp'); const head = root && root.querySelector('.srp-head');
        if (!head) return;
        const css = getComputedStyle(document.documentElement);
        const hh = parseFloat(css.getPropertyValue('--header-h')) || 64;
        const nav = document.querySelector('.bnav');
        const navH = nav && nav.getClientRects().length ? nav.getBoundingClientRect().height : 0;
        const bar = root.querySelector('.srp-bar');
        const mt = bar ? parseFloat(getComputedStyle(bar).marginTop) || 0 : 0;
        const target = Math.max(0, head.getBoundingClientRect().bottom + mt + window.scrollY - hh);
        const boxTop = box.getBoundingClientRect().top + window.scrollY - target;
        box.style.height = Math.max(360, Math.round(window.innerHeight - boxTop - navH)) + 'px';
        if (scrollIn) window.scrollTo({ top: target, behavior: 'auto' });
      };
      mountMap(host, s, pinsList, { phone: true, car, prep });
      return box;
    }
    const rows = fill(el('div', { class: 'rows srp-maprows' }), items, (l) => mkCard(l, s, 'list'), 5, rowPh('row'));
    mountMap(host, s, pinsList, { rows });
    return el('div', { class: 'srp-split' }, el('div', { class: 'srp-split-l' }, rows), el('div', { class: 'srp-split-r' }, host));
  }
  function mountMap(host, s, list, o) {
    if (!hasMap()) { host.appendChild(el('p', { class: 'srp-nomap meta' }, 'Mapa nije učitana.')); return; }
    let tries = 0;
    const tryMount = () => {
      if (!host.isConnected || host.offsetWidth < 10) { if (++tries < 60) requestAnimationFrame(tryMount); return; }
      if (o.prep) safe(o.prep);
      if (curMap) { safe(() => curMap.destroy()); curMap = null; }
      const rowsBy = (slug) => (o.rows ? o.rows.querySelector(`[data-slug="${CSS.escape(slug)}"]`) : null);
      let lastHl = null;
      const view = s.bb && s.bb[4] ? { lat: (s.bb[0] + s.bb[1]) / 2, lng: (s.bb[2] + s.bb[3]) / 2, zoom: s.bb[4] } : undefined;
      const api = safe(() => mapView(host, {
        listings: list, city: s.c || undefined, legend: !o.phone, popover: !o.phone, showAreaButton: true, drawTool: true, view,
        insets: o.car ? () => ({ top: 64, right: 12, bottom: (o.car.offsetHeight || 120) + 24, left: 12 }) : undefined,
        onHover: (slug) => {
          if (lastHl) lastHl.classList.remove('hl');
          const r = slug && rowsBy(slug);
          lastHl = r || null;
          if (r) { r.classList.add('hl'); r.scrollIntoView({ block: 'nearest', behavior: mq('(prefers-reduced-motion: reduce)') ? 'auto' : 'smooth' }); }
        },
        onSelect: (slug) => {
          if (o.car) { const c = o.car.querySelector(`[data-slug="${CSS.escape(slug)}"]`); if (c) { carLock = Date.now(); c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } }
          const r = rowsBy(slug); if (r) { if (lastHl) lastHl.classList.remove('hl'); r.classList.add('hl'); lastHl = r; r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        },
        onBoundsChange: (b) => {
          if (!b) return;
          /* promena zone (nacrtana/obrisana) stiže sa `count` (applyPolygon); „Pretraži u ovom području” stiže bez njega
             i uvek znači okvir pogleda — i kad je zona bila aktivna (getBounds tada nosi i staru zonu) */
          if ('count' in b) {
            if (b.polygon && b.polygon.length >= 3) { if (JSON.stringify(b.polygon.map((p) => [+p.lat.toFixed(4), +p.lng.toFixed(4)])) !== JSON.stringify((s.zona || []).map((p) => [+p.lat.toFixed(4), +p.lng.toFixed(4)]))) go(s, { zona: b.polygon, bb: null }); }
            else if (s.zona) go(s, { zona: null });
          } else if (isFinite(b.n) && isFinite(b.s)) go(s, { bb: [b.n, b.s, b.e, b.w, b.zoom], zona: null });
        },
        onDraw: (st) => { if (st === 'cancel' && s.zona) go(s, { zona: null }); },
      }), null);
      if (!api) return;
      curMap = api;
      if (s.zona) safe(() => api.setPolygon(s.zona));
      /* malo rezultata (≤ 120): jedan nivo bliže, da se vide pinovi sa cenom (ispod z13 su samo tačke i klasteri) */
      else if (!view && list.length <= 120) {
        const z = safe(() => api.getZoom(), null);
        if (z != null && z < 13 && z >= 11) {
          safe(() => api.setZoom(Math.min(13, z + 1)));
          /* samo ako u kadru ostaje bar 85 % rezultata; inače nazad na pregled celog skupa */
          const bb = safe(() => api.getBounds(), null);
          const inside = bb ? list.filter((l) => l.lat != null && l.lat <= bb.n && l.lat >= bb.s && l.lng <= bb.e && l.lng >= bb.w).length : 0;
          if (!bb || inside < list.length * 0.85) safe(() => api.setZoom(z));
        }
      }
      if (o.rows) {
        o.rows.addEventListener('pointerover', (e) => { const r = e.target.closest('[data-slug]'); if (r && o.rows.contains(r)) safe(() => api.highlight(r.dataset.slug)); });
        o.rows.addEventListener('pointerleave', () => safe(() => api.highlight(null)));
        o.rows.addEventListener('focusin', (e) => { const r = e.target.closest('[data-slug]'); if (r) safe(() => api.highlight(r.dataset.slug)); });
      }
      if (o.car) {
        let t = 0;
        o.car.addEventListener('scroll', () => {
          clearTimeout(t);
          t = setTimeout(() => {
            if (Date.now() - carLock < 700) return;
            const cr = o.car.getBoundingClientRect(); const mid = cr.left + cr.width / 2;
            let best = null, bd = 1e9;
            for (const c of o.car.children) { const r = c.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = c; } }
            if (best) safe(() => api.setSelected(best.dataset.slug));
          }, 160);
        }, { passive: true });
      }
    };
    requestAnimationFrame(tryMount);
  }
  let carLock = 0;

  /* ───────────────────────── prazno stanje ───────────────────────── */
  function emptyBlock(s) {
    const cands = [];
    const seen = new Set();
    /* cost = koliko je promena velika: proširenje granice < uklanjanje filtera < drugi grad < više filtera odjednom */
    const push = (label, patch, cost) => {
      if (seen.has(label)) return; seen.add(label);
      const n = run({ ...s, ...patch }, { sort: false }).length;
      if (n > 0) cands.push({ label, patch, n, cost: cost ?? 10 * Object.keys(patch).length });
    };
    const extras = { legal: 'Zeleni semafor', drop: 'Snižena cena', dropm: 'Sniženo ovog meseca', below: 'Ispod procene', stale: 'Na oglasu duže od 60 dana' };
    for (const k of Object.keys(extras)) if (s[k]) push(`Ukloni filter ${extras[k]}`, { [k]: false });
    const extras2 = { nog: ['Nije prizemlje', false], plan: ['Sa tlocrtom', false], dep1: ['Depozit do jedne kirije', false], dmax: ['Datum objave', ''], ba: ['Kupatila', ''], en: ['Energetski razred', []], or: ['Orijentacija', []], lg: ['Pravni status', []] };
    for (const k of Object.keys(extras2)) if (Array.isArray(s[k]) ? s[k].length : num(s[k]) != null || s[k] === true) push(`Ukloni filter ${extras2[k][0]}`, { [k]: extras2[k][1] });
    if (s.aff.length) push('Ukloni filter Moj budžet', { aff: [] });
    if (num(s.tot) != null) push('Ukloni granicu ukupnih troškova', { tot: '' });
    if (num(s.mes) != null) push('Ukloni granicu mesečnih troškova', { mes: '' });
    if (s.tp && num(s.tmax) != null) push('Ukloni granicu udaljenosti', { tp: '', tmax: '' });
    if (s.bb) push('Ukloni područje na mapi', { bb: null });
    if (s.zona) push('Ukloni nacrtanu zonu', { zona: null });
    /* šira cena: ×1,5 i ×3 (zaokruženo) pre nego što predložimo uklanjanje granice */
    const pmax = num(s.pmax);
    if (pmax != null) {
      const stp = s.t === 'izdavanje' ? 50 : 5000;
      const up = (v) => Math.max(stp, Math.ceil(v / stp) * stp);
      /* ×1,5 i ×3, pa (kad je granica nerealno niska) cena 5. i 15. najjeftinijeg oglasa bez gornje granice */
      const cheap = run({ ...s, pmax: '' }, { sort: false }).map((l) => l.p).filter((p) => p > 0).sort((x, y) => x - y);
      const steps = [[pmax * 1.5, 4], [pmax * 3, 6]];
      if (cheap.length >= 5) steps.push([cheap[4], 7]);
      if (cheap.length >= 15) steps.push([cheap[14], 8]);
      steps.forEach(([v, c]) => { const w = up(v); if (w > pmax) push(`Cena do ${eur(w, s.t === 'izdavanje' ? 'izdavanje' : undefined)}`, { pmax: w }, c); });
    }
    /* najbliži grad sa ponudom */
    const city = s.c ? safe(() => find.city(s.c), null) : null;
    if (city && city.lat != null) {
      const km = (a) => { const dx = (a.lng - city.lng) * 111 * Math.cos((city.lat * Math.PI) / 180), dy = (a.lat - city.lat) * 111; return Math.sqrt(dx * dx + dy * dy); };
      const near = (D.cities || []).filter((c) => c.s !== city.s && c.lat != null).map((c) => ({ c, d: km(c) })).sort((a, b) => a.d - b.d).slice(0, 8);
      for (const { c, d } of near) {
        const n = run({ ...s, c: c.s, m: [], n: [], bb: null, zona: null }, { sort: false }).length;
        if (n > 0) { push(`Pogledaj obližnji grad: ${c.n} (${N0.format(Math.round(d))} km)`, { c: c.s, m: [], n: [], bb: null, zona: null }, 12); break; }
      }
    }
    /* opština → dodaj dve najbliže opštine istog grada (težište oglasa), pre nego što se lokacija ukloni */
    if (s.c && s.m.length && !s.n.length) {
      const cen = (ms) => { const a = D.listings.filter((l) => l.ms === ms && l.lat != null && !l.syn); return a.length ? { lat: a.reduce((x, l) => x + l.lat, 0) / a.length, lng: a.reduce((x, l) => x + l.lng, 0) / a.length } : null; };
      const mine = s.m.map(cen).filter(Boolean);
      if (mine.length) {
        const c0 = { lat: mine.reduce((x, p) => x + p.lat, 0) / mine.length, lng: mine.reduce((x, p) => x + p.lng, 0) / mine.length };
        const near = safe(() => find.munsOf(s.c), []).filter((m) => !s.m.includes(m.s)).map((m) => ({ m, p: cen(m.s) })).filter((x) => x.p)
          .map((x) => ({ ...x, d: Math.hypot(x.p.lat - c0.lat, (x.p.lng - c0.lng) * Math.cos((c0.lat * Math.PI) / 180)) })).sort((a, b) => a.d - b.d).slice(0, 2);
        near.forEach(({ m }) => push(`Dodaj opštinu ${m.n}`, { m: [...s.m, m.s], n: [] }, 9));
      }
    }
    if (hasKX()) {
      const core = coreFilter(s);
      if (s.legal) core.legal = true;
      for (const r of safe(() => KX.relax(core), [])) {
        const patch = {};
        for (const k of CORE_KEYS) if (k !== 'sort' && k !== 'view' && k !== 'page' && JSON.stringify(r.filters[k]) !== JSON.stringify(core[k])) patch[k] = r.filters[k];
        if ('legal' in r.filters && !r.filters.legal && s.legal) patch.legal = false;
        if (!Object.keys(patch).length) continue;
        const rl = relaxFrom(s, patch);
        const widen = /\(\+\d+ %\)|±/.test(r.label);
        if (rl) push(rl.label, patch, rl.cost);
        else push(relaxLabel(r.label), patch, widen ? 3 : 10 * Object.keys(patch).length);
      }
    }
    /* najmanja promena prva: cena promene, pa unutar iste cene manje oglasa = bliže onome što je traženo */
    cands.sort((a, b) => a.cost - b.cost || a.n - b.n);
    const top = cands.slice(0, 4);
    const lead = top.length ? `Najmanja promena: ${top[0].label.charAt(0).toLowerCase() + top[0].label.slice(1)} — ${listings(top[0].n)}.` : 'Probaj šire filtere ili drugi grad.';
    const box = empty('Nema oglasa za ove filtere', lead, 'Obriši filtere', null, {
      onClick: () => go(s, clearAllPatch(s)),
      primary: { label: 'Sačuvaj pretragu i javi mi', onClick: () => { const it = safe(() => store.saveSearch(autoName(s), toParams({ ...s, page: 1, view: 'grid', mode: 'oglas' })), null); toast(it ? 'Pretraga je sačuvana. Novi oglasi biće označeni na stranici Sačuvano.' : 'Čuvanje nije uspelo', it ? { action: { label: 'Sačuvano', href: '#/sacuvani' } } : {}); } },
    });
    const relax = top.length ? el('div', { class: 'srp-relax' }, el('p', { class: 'label' }, 'Pokušaj'), el('div', { class: 'srp-relax-l' }, top.map((c, i) => el('button', { type: 'button', class: 'btn btn-secondary', 'data-act': 'relax', 'data-i': String(i) }, el('span', {}, c.label), el('span', { class: 'srp-rn num' }, listings(c.n)))))) : null;
    if (relax) relax._cands = top;
    return el('div', { class: 'srp-empty' }, box, relax);
  }

  /* nazivi iz KX.relax na prirodniji srpski (za predloge koji ne uklanjaju nego šire: „Cena do 180.000 € (+20 %)”) */
  const RELAX_FIELD = { 'Cena do': 'gornju granicu cene', 'Cena od': 'donju granicu cene', 'Kvadratura do': 'gornju granicu kvadrature', 'Kvadratura od': 'donju granicu kvadrature',
    'Sprat od': 'donju granicu sprata', 'Sprat do': 'gornju granicu sprata', 'Godina od': 'donju granicu godine', 'Godina do': 'gornju granicu godine', Struktura: 'broj soba', Grad: 'grad (cela Srbija)', Lokacija: 'lokaciju (cela Srbija)', 'Opština': 'opštinu', Naselje: 'naselje' };
  const relaxLabel = (t) => String(t).replace(/^Ukloni filtere? (.+)$/, (m0, rest) => 'Ukloni ' + rest.split(' i ').map((x) => RELAX_FIELD[x] || x.toLowerCase()).join(' i '));
  const isEmptyV = (v) => v == null || v === '' || v === false || (Array.isArray(v) && !v.length);
  /** predlog koji samo uklanja filtere → {label, cost}; null kad patch šta drugo menja (širenje granice) */
  function relaxFrom(s, patch) {
    const keys = Object.keys(patch);
    if (!keys.every((k) => isEmptyV(patch[k]))) return null;
    const names = (arr, find1) => arr.map((v) => safe(() => find1(v).n, v));
    const phr = [];
    let cost = 0;
    if ('c' in patch && s.c) {
      /* skok na celu Srbiju je najveća promena: uvek iza svega ostalog */
      phr.push(s.m.length || s.n.length ? 'lokaciju (cela Srbija)' : 'grad (cela Srbija)'); cost += 40 + (s.m.length || s.n.length ? 20 : 0);
    } else if ('m' in patch && s.m.length) {
      const mn = names(s.m, find.mun);
      phr.push(mn.length === 1 ? `opštinu ${mn[0]}` : `opštine ${mn.join(', ')}`); cost += 10 + (s.n.length ? 5 : 0);
    } else if ('n' in patch && s.n.length) { phr.push(s.n.length === 1 ? `naselje ${s.n[0]}` : 'naselja'); cost += 8; }
    const F = { pmax: 'gornju granicu cene', pmin: 'donju granicu cene', amax: 'gornju granicu kvadrature', amin: 'donju granicu kvadrature', ro: 'broj soba', flmin: 'donju granicu sprata', flmax: 'gornju granicu sprata',
      ymin: 'donju granicu godine', ymax: 'gornju granicu godine', co: 'stanje', he: 'grejanje', fu: 'opremljenost', am: 'dodatke', reg: 'uslov „uknjiženo”', newbuild: 'uslov „novogradnja”', notLast: 'uslov „nije poslednji sprat”',
      advertiser: 'izbor oglašivača', agency: 'agenciju', q: 'tekst pretrage', deltaMax: 'granicu Δ', legal: 'zeleni semafor', pt: 'tip nekretnine' };
    for (const k of keys) {
      if (k === 'c' || k === 'm' || k === 'n') continue;
      if (isEmptyV(s[k])) continue;
      if (k === 'am' && s.am.length === 1) phr.push(`dodatak „${(typeof AMEN !== 'undefined' && AMEN[s.am[0]]) || s.am[0]}”`);
      else phr.push(F[k] || k);
      cost += 10;
    }
    if (!phr.length) return null;
    const label = phr[0].includes('cela Srbija') && phr.length === 1 ? 'Pretraži celu Srbiju (ukloni lokaciju)' : 'Ukloni ' + (phr.length > 1 ? phr.slice(0, -1).join(', ') + ' i ' + phr[phr.length - 1] : phr[0]);
    return { label, cost };
  }

  /* ───────────────────────── ispod rezultata ───────────────────────── */
  function belowBlock(s, list) {
    if (!list.length) return null;
    const cityCounts = {};
    list.forEach((l) => { cityCounts[l.cs] = (cityCounts[l.cs] || 0) + 1; });
    const cs = s.c || Object.keys(cityCounts).sort((a, b) => cityCounts[b] - cityCounts[a])[0];
    const city = safe(() => find.city(cs), null);
    const pt = s.pt.length === 1 ? s.pt[0] : 'stan';
    const idx = safe(() => stats.munIndex(cs, s.t, pt), []) || [];
    const cityList = safe(() => D.listings.filter((l) => l.cs === cs && l.t === s.t && l.pt === pt && l.ppm && !l.syn && !l._clone), []);
    const cityMed = median(cityList.map((l) => l.ppm));
    let barsNode = null;
    if (idx.filter((r) => r.n >= 3).length >= 2) {
      const rows = idx.filter((r) => r.n >= 3 || s.m.includes(r.ms)).slice(0, 12).map((r) => ({ label: r.m, value: r.ppm, n: r.n, me: s.m.includes(r.ms) }));
      barsNode = bars(rows, { ref: cityMed ? { value: cityMed, label: city ? city.n : 'grad' } : undefined });
    }
    /* 12 meseci: indeks tražene cene (svaki oglas normalizovan na svoju današnju cenu, pa medijana) × današnja medijana €/m².
       Ne zavisi od toga koji su oglasi tada bili objavljeni (sastav), samo od promena cena; istorija je procena engine-a. */
    let spark = null;
    if (hasKX() && list.length >= 5) {
      const withA = list.filter((l) => l.a && l.ppm && l.pt !== 'zemljiste').slice(0, 300);
      const hs = withA.map((l) => [l, histOf(l)]).filter(([, h]) => h && h.points && h.points.length === 12);
      const months = hs.length ? hs[0][1].points.map((p) => p.m) : [];
      const nowPpm = median(withA.map((l) => l.ppm));
      /* podrezana sredina (5 % sa svake strane): samo ~⅓ oglasa ima promenu, pa bi medijana uvek bila 1 */
      const tmean = (r) => { const a = r.slice().sort((x, y) => x - y); const k = Math.floor(a.length * 0.05); const t = a.slice(k, a.length - k); return t.reduce((x, y) => x + y, 0) / t.length; };
      const ratios = months.map((m, i) => { const r = hs.filter(([, h]) => h.points[i].listed).map(([l, h]) => h.points[i].p / l.p); return r.length >= 5 ? tmean(r) : null; });
      if (nowPpm && ratios.filter((v) => v != null).length >= 5) {
        const firstIdx = ratios.findIndex((v) => v != null);
        /* kirije su ~10 €/m²: zaokruživanje na ceo evro bi izbrisalo trend, pa ispod 100 €/m² ide na 0,1 */
        const rnd = nowPpm < 100 ? (v) => Math.round(v * 10) / 10 : Math.round;
        const vals = ratios.map((r) => rnd((r ?? ratios[firstIdx]) * nowPpm));
        const lastR = ratios[ratios.length - 1] ?? 1;
        const ch = (lastR / ratios[firstIdx] - 1) * 100;
        if (!isFinite(ch) || Math.abs(ch) < 0.5) spark = el('div', { class: 'srp-flat' }, el('p', { class: 'label' }, 'Tražena cena po m² · 12 meseci'), el('p', { class: 'srp-flat-v num' }, 'Nedovoljno promena za trend'), el('p', { class: 'meta' }, `Tražena cena istih oglasa u proseku se promenila manje od 0,5 % za 12 meseci (procena iz istorije cena). Današnja medijana: ${safe(() => fmt.ppm(nowPpm), N0.format(nowPpm))}.`));
        else spark = sparkline(vals, { title: 'Tražena cena po m² · 12 meseci', months, format: (v) => safe(() => fmt.ppm(v), N0.format(v)), source: 'Izvor: oglasi iz ove pretrage, promene cena po oglasu (procena)',
          delta: isFinite(ch) ? deltaChip({ pct: ch, label: '12 meseci' }, { title: `${safe(() => fmt.pct(ch, { sign: true }), ch.toFixed(1) + ' %')} za 12 meseci (iste nekretnine, tražena cena)` }) : null });
      }
    }
    const title = `Cena po m² u opštinama${city ? ' · ' + city.n + (s.c ? '' : ' (grad sa najviše oglasa)') : ''}`;
    const sub = `Medijana tražene cene po m² · ${typeOfV(pt).pl} · ${s.t === 'izdavanje' ? 'izdavanje' : 'prodaja'} · referentna linija = ceo grad`;
    const stats1 = barsNode || spark ? el('section', { class: 'section srp-below' },
      sectionHead(title, sub),
      el('div', { class: 'srp-below-g' }, barsNode ? el('div', { class: 'srp-bars' }, barsNode) : null, spark ? el('div', { class: 'srp-spark' }, spark) : null)) : null;
    const about = aboutText(s, list);
    return [stats1, about ? el('section', { class: 'section srp-about' }, el('h2', { class: 't-h2s' }, 'O ponudi'), el('div', { class: 'prose' }, about.map((t) => el('p', {}, t)))) : null];
  }
  function aboutText(s, list) {
    if (list.length < 3) return null;
    const n = list.length;
    const word = typeGen(s);
    const city = s.c ? safe(() => find.city(s.c), null) : null;
    const where = city ? `u ${city.loc || city.n}` : 'u Srbiji';
    const rent = s.t === 'izdavanje';
    const pMed = median(list.map((l) => l.p)), p25 = quant(list.map((l) => l.p), 0.25), p75 = quant(list.map((l) => l.p), 0.75);
    const ppmMed = median(list.filter((l) => l.ppm && l.pt !== 'zemljiste').map((l) => l.ppm));
    const unit = rent ? 'izdavanje' : undefined;
    const t1 = [`U ovoj pretrazi ${plural(n, 'je', 'su', 'je')} ${listings(n)} za ${rent ? 'izdavanje' : 'prodaju'} ${word} ${where}.`];
    if (pMed) t1.push(`Srednja tražena ${rent ? 'kirija' : 'cena'} je ${eur(pMed, unit)}${p25 && p75 && p25 !== p75 ? `, a polovina oglasa je između ${eur(p25, unit)} i ${eur(p75, unit)}` : ''}${ppmMed ? ` (medijana ${safe(() => fmt.ppm(ppmMed), '')})` : ''}.`);
    /* grupisanje po slugu opštine (ime se ponavlja: 27 opština „Centar”, Stari grad, Palilula…) */
    const byM = {}, citiesOfName = {};
    list.forEach((l) => {
      const k = l.ms || (l.cs + '|' + l.m); if (!l.m) return;
      (byM[k] = byM[k] || []).push(l);
      (citiesOfName[l.m] = citiesOfName[l.m] || new Set()).add(l.cs || l.c);
    });
    const munName = (l) => {
      const dupName = !s.c || (citiesOfName[l.m] && citiesOfName[l.m].size > 1);
      if (!dupName || !l.c) return l.m;
      const cc = safe(() => find.city(l.cs), null);
      return `${l.m} u ${(cc && cc.loc) || l.c}`;
    };
    const ms = Object.values(byM).filter((a) => a.length >= 3).map((a) => ({ m: munName(a[0]), n: a.length, ppm: median(a.filter((x) => x.ppm).map((x) => x.ppm)) })).filter((x) => x.ppm);
    if (ms.length >= 2) {
      const most = ms.slice().sort((a, b) => b.n - a.n)[0];
      const cheap = ms.slice().sort((a, b) => a.ppm - b.ppm)[0], dear = ms.slice().sort((a, b) => b.ppm - a.ppm)[0];
      t1.push(`Najviše oglasa ima ${most.m} (${most.n}); najpovoljniji kvadrat ima ${cheap.m} (${safe(() => fmt.ppm(cheap.ppm), '')}), a najskuplji ${dear.m} (${safe(() => fmt.ppm(dear.ppm), '')}), računajući opštine sa bar tri oglasa.`);
    }
    const pct = (k) => Math.round((k / n) * 100);
    const t2 = [];
    const regN = list.filter((l) => l.reg).length, ownN = list.filter((l) => !l.ag).length;
    t2.push(`${pct(regN)} % oglasa je uknjiženo, a ${pct(ownN)} % je od vlasnika, bez agencije.`);
    if (hasKX()) {
      const dom = median(list.map(domOf));
      const drops = list.filter((l) => dropInfo(l)).length;
      t2.push(`Polovina oglasa je na tržištu duže od ${N0.format(Math.round(dom))} dana${drops ? `, a ${drops} ${plural(drops, 'oglas je snizio', 'oglasa su snizila', 'oglasa je snizilo')} cenu` : ''}. Dani se računaju od prvog objavljivanja, ne od poslednjeg „obnavljanja”.`);
    }
    if (rent) {
      const furn = list.filter((l) => l.fu === 'namesten').length, pets = list.filter((l) => l.am && l.am.includes('petsAllowed')).length;
      t2.push(`Namešteno je ${pct(furn)} % ${s.pt.length === 1 ? typeGen(s) : 'oglasa'}, a kućne ljubimce dozvoljava ${pct(pets)} % oglašivača.`);
    }
    return [t1.join(' '), t2.join(' ')];
  }

  /* ───────────────────────── rail (desktop) ───────────────────────── */
  function railBlock(s, F) {
    const ch = (patch, how) => { if (how === 'drag') return; if (how === 'type') goTyped(s, patch); else go(s, patch, how === 'key' ? { replace: true } : {}); };
    const G = buildGroups(s, F, ch, 'rail');
    const n = activeCount(s);
    return el('aside', { class: 'frail srp-frail', 'aria-label': 'Filteri' },
      RAIL_ORDER.map((k) => G[k]).filter(Boolean),
      el('div', { class: 'srp-reset' }, el('button', { class: 'btn btn-secondary btn-block', type: 'button', disabled: !n, onclick: () => go(s, clearAllPatch(s)) }, n ? `Poništi · ${n}` : 'Nema aktivnih filtera')));
  }

  /* ───────────────────────── sklapanje ───────────────────────── */
  function build(root, params) {
    const t0 = performance.now();
    const T = {};
    const lap = (k) => { T[k] = +(performance.now() - t0).toFixed(1); };
    closeMenu();
    if (curMap) { safe(() => curMap.destroy()); curMap = null; }
    curParams = params;
    const s = readState(params);
    const B = bp();
    const list = run(s); lap('run');
    const F = facets(s, list); lap('facets');
    const P = pageSlice(list, s, B);
    let main;
    if (!list.length) main = emptyBlock(s);
    else if (s.view === 'map') main = mapViewBlock(s, P.items, B, list);
    else if (s.view === 'list') main = listView(s, P.items, B);
    else main = gridView(s, P.items, B);
    lap('main');
    const showPager = !(s.view === 'map' && !B.wide);
    /* SPEC 6.2: rail (272px) pored Mreže i Liste. Mapa namerno bez raila: kontejner je najviše ~1250px, pa bi pored raila
       ostalo ~490px za redove i ~440px za mapu (oznake se prelamaju, mapa premala) — filteri su tu u „Svi filteri”. */
    const withRail = B.desk && s.view !== 'map';
    const rail = withRail ? railBlock(s, F) : null; lap('rail');
    const body = el('div', { class: 'results srp-results' + (s.view === 'map' ? ' is-map' : '') },
      rail,
      el('div', { class: 'main' }, el('span', { class: 'srp-anchor' }), s.view === 'map' && !B.wide ? null : resBar(s, list, F, B), main, showPager ? pagerBlock(s, list, P, B) : null));
    const head = headBlock(s, list), bar = filterBar(s, B, list.length), qrow = B.wide ? quickRow(s, list.length) : null, tags = activeTags(s) || el('div', { class: 'srp-notags' }); lap('chrome');
    const below = s.view === 'map' && !B.wide ? [] : [].concat(belowBlock(s, list) || []); lap('below');
    root.className = 'wrap srp' + (withRail ? '' : ' srp-norail') + (s.view === 'map' ? ' srp-is-map' : '');
    root.dataset.view = s.view;
    root.replaceChildren(...[head, bar, qrow, tags, body, ...below].filter(Boolean));
    keyify(root, 'p');
    restoreFocus(root);
    lap('dom');
    root.dataset.ms = T.dom;
    root._timing = T;
    root._state = s;
    lastView = s.view;
  }
  function attach(root) {
    /* delegirani događaji (kartice, meni, učitaj još, prazno stanje, trake) */
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a || !root.contains(a)) return;
      const s = root._state;
      const act = a.dataset.act;
      if (act === 'more') { e.preventDefault(); e.stopPropagation(); if (menuEl && menuEl._opener === a) closeMenu(); else openMenu(a, a.dataset.s, s); }
      else if (act === 'pill') openFilterSheet(s, a.dataset.id, a);
      else if (act === 'quick') { const q = quickDefs(s).find((x) => x.id === a.dataset.id); if (q) go(s, q.patch(!q.on)); }
      else if (act === 'filters') openFilterSheet(s, null, a);
      else if (act === 'sortsheet') openSortSheet(s, a);
      else if (act === 'modesheet') openModeSheet(s, a);
      else if (act === 'loadmore') go(s, { page: s.page + 1 }, { replace: true });
      else if (act === 'showhidden') go(s, { hid: true, page: s.page }, { replace: true });
      else if (act === 'hidehidden') go(s, { hid: false, page: s.page }, { replace: true });
      else if (act === 'relax') { const box = a.closest('.srp-relax'); const c = box && box._cands && box._cands[+a.dataset.i]; if (c) go(s, c.patch); }
      else if (act === 'dup') { const ul = a.nextElementSibling; const open = a.getAttribute('aria-expanded') === 'true'; a.setAttribute('aria-expanded', String(!open)); if (ul) ul.hidden = open; }
    });
  }

  /** viewResults(q[, path]) — q: URLSearchParams | string | stari objekat filtera; path: '/pretraga' ili '/prodaja/stanovi/beograd' */
  function viewResults(q, path) {
    const params = normQ(q, path);
    const root = el('div', { class: 'wrap srp' });
    attach(root);
    build(root, params);
    root.update = (q2, path2) => build(root, normQ(q2, path2));
    curRoot = root;
    return root;
  }

  window.viewResults = viewResults;
  window.resultsParamsFromPath = resultsParamsFromPath;
  window.__srp = { run: (q) => run(readState(normQ(q))), readState: (q) => readState(normQ(q)), toParams, map: () => curMap };
  /* stabilan API za druge stranice (Sačuvano): ista lista rezultata kao stranica pretrage za dati upit (URLSearchParams | string | objekat) */
  window.searchCount = (q) => {
    if (q && typeof q === 'object' && !(q instanceof URLSearchParams)) { const p = new URLSearchParams(); Object.keys(q).forEach((k) => { const v = q[k]; if (v != null && v !== '' && v !== false) p.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v)); }); q = p; }
    return run(readState(normQ(q)));
  };
})();
