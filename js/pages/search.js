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
  const LEGACY_SORT = { preporuceno: 'rel', najnovije: 'new', 'cena-rastuce': 'p-asc', 'cena-opadajuce': 'p-desc', 'kvadratura-opadajuce': 'a-desc', 'cena-po-m2': 'ppm-asc', najpopularnije: 'rel', pop: 'rel' };
  const BASE_SORTS = [
    { v: 'rel', l: 'Preporučeno' }, { v: 'new', l: 'Najnovije' }, { v: 'p-asc', l: 'Cena ↑' }, { v: 'p-desc', l: 'Cena ↓' },
    { v: 'ppm-asc', l: '€/m² ↑' }, { v: 'ppm-desc', l: '€/m² ↓' }, { v: 'a-desc', l: 'Najveći m²' }, { v: 'delta', l: 'Najbolja vrednost (Δ)' },
    { v: 'drop', l: 'Najveće sniženje' }, { v: 'dom', l: 'Najduže na oglasu' },
  ];
  const HIDDEN_SORTS = [{ v: 'a-asc', l: 'Najmanji m²' }, { v: 'delta-desc', l: 'Δ opadajuće' }];
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
  const isSecondary = (l) => hasKX() && safe(() => KX.dupes.isSecondary(l.s), false);
  const groupOf = (l) => (hasKX() ? safe(() => KX.dupes.groupOf(l.s), null) : null);

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
    s.legal = flag('legal'); s.drop = flag('drop'); s.below = flag('below'); s.stale = flag('stale'); s.hid = flag('hid');
    s.dup = p.get('dup') !== '0' && p.get('dup') !== 'false';
    s.aff = (p.get('aff') || '').split(',').filter((x) => AFF_OPTS.some((o) => o.v === x));
    const bb = (p.get('bb') || '').split(',').map(Number);
    s.bb = bb.length >= 4 && bb.slice(0, 4).every(isFinite) && bb[0] > bb[1] ? bb.slice(0, 5) : null;
    const zona = (p.get('zona') || '').split('~').map((x) => x.split(',').map(Number)).filter((x) => x.length === 2 && x.every(isFinite));
    s.zona = zona.length >= 3 ? zona.map(([lat, lng]) => ({ lat, lng })) : null;
    s.per = PER_OPTS.includes(+p.get('per')) ? +p.get('per') : 20;
    s.page = Math.max(1, +f.page || 1);
    return s;
  }
  function validSort(v) {
    if (BASE_SORTS.some((x) => x.v === v) || HIDDEN_SORTS.some((x) => x.v === v)) return true;
    if (v === 'pair') return true;
    return /^near-[\w-]{1,40}$/.test(v);
  }
  function toParams(s) {
    const out = safe(() => filtersToParams({ ...s, sort: 'rel', view: 'grid' }), {});
    delete out.sort; delete out.view;
    if (s.sort && s.sort !== 'rel') out.sort = s.sort;
    if (s.view && s.view !== 'grid') out.view = s.view;
    if (s.mode && s.mode !== 'oglas') out.mode = s.mode;
    for (const k of ['legal', 'drop', 'below', 'stale', 'hid']) if (s[k]) out[k] = '1';
    if (!s.dup) out.dup = '0';
    if (s.aff && s.aff.length) out.aff = s.aff.slice();
    if (s.bb) out.bb = s.bb.map((x, i) => (i < 4 ? (+x).toFixed(4) : String(Math.round(x * 10) / 10)));
    if (s.zona) out.zona = s.zona.map((pt) => `${(+pt.lat).toFixed(4)},${(+pt.lng).toFixed(4)}`).join('~');
    if (s.per && s.per !== 20) out.per = String(s.per);
    if (s.page > 1) out.page = String(s.page); else delete out.page;
    return out;
  }
  /* broj aktivnih filtera (core + naši) */
  const extraActive = (s) => ['legal', 'drop', 'below', 'stale'].filter((k) => s[k]).length + (s.aff.length ? 1 : 0) + (s.bb || s.zona ? 1 : 0);
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
      s.legal, s.aff, s.drop, s.below, s.stale, s.hid, s.dup, o.area === false ? null : [s.bb, s.zona], o.sort === false ? '' : s.sort, profVer]);
    if (memo.has(key)) return memo.get(key);
    let list = safe(() => applyFilters(coreFilter(s)), []);
    if (!s.hid) { const h = hiddenSet(); if (h.size) list = list.filter((l) => !h.has(l.s)); }
    if (s.dup && hasKX()) list = list.filter((l) => !isSecondary(l));
    if (s.legal) list = list.filter((l) => { const t = trustOf(l); return t && t.color === 'zeleno'; });
    if (s.aff.length) list = list.filter((l) => s.aff.includes(affKey(l)));
    if (s.drop) list = list.filter((l) => !!dropInfo(l));
    if (s.below) list = list.filter((l) => { const f = fairOf(l); return f && f.verdict === 'ispod'; });
    if (s.stale) list = list.filter((l) => domOf(l) > 60);
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
    const pl = places();
    pl.slice(0, 5).forEach((p) => opts.push({ v: 'near-' + p.id, l: 'Najbliže: ' + p.name }));
    if (pl.some((p) => (p.who || 'ja') === 'ja') && pl.some((p) => p.who === 'partner')) opts.push({ v: 'pair', l: 'Najbolje za oboje' });
    const hid = HIDDEN_SORTS.find((x) => x.v === s.sort);
    if (hid) opts.push(hid);
    if (!opts.some((x) => x.v === s.sort)) opts.push({ v: s.sort, l: 'Najbliže mestu' });
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
      below: toggleCount('below', (l) => { const f = fairOf(l); return f && f.verdict === 'ispod'; }),
      stale: toggleCount('stale', (l) => domOf(l) > 60),
    };
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
  function captureFocus() {
    const a = document.activeElement;
    if (a && a.dataset && a.dataset.fkey) pendingFocus = { key: a.dataset.fkey, start: safe(() => a.selectionStart, null), end: safe(() => a.selectionEnd, null) };
  }
  function restoreFocus(root) {
    if (!pendingFocus) return;
    const pf = pendingFocus; pendingFocus = null;
    requestAnimationFrame(() => {
      const n = (root && root.isConnected ? root : document).querySelector(`[data-fkey="${pf.key}"]`);
      if (n && document.activeElement !== n) { n.focus({ preventScroll: true }); if (pf.start != null) safe(() => n.setSelectionRange(pf.start, pf.end)); }
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
  function numInput(fkey, value, placeholder, onType, label) {
    const i = el('input', { class: 'input', type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder, 'aria-label': label, value: value === '' || value == null ? '' : N0.format(value), 'data-fkey': fkey });
    i.addEventListener('input', () => { const d = i.value.replace(/[^\d]/g, ''); onType(d === '' ? '' : +d); });
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
      onChange: (a, b) => ch({ [kMin]: a <= lo ? '' : a, [kMax]: b >= hi ? '' : b }, 'push') });
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
        const mk = (m) => check(m.n, s.m.includes(m.s), (on) => ch({ m: on ? [...s.m, m.s] : s.m.filter((x) => x !== m.s), n: [] }, 'push'), { count: cnt(F.m, m.s) });
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
    G.t = grp('Transakcija', segmented([{ v: 'prodaja', l: `Prodaja · ${N0.format(F.t.prodaja)}` }, { v: 'izdavanje', l: `Izdavanje · ${N0.format(F.t.izdavanje)}` }], s.t, (v) => ch({ t: v, pmin: '', pmax: '', aff: [] }, 'push')), { id: 't' });
    G.tip = grp('Tip nekretnine', pillsCounted(TYPES.map((t) => ({ v: t.v, l: t.s })), s.pt, F.pt, (v, on, all) => ch({ pt: all }, 'push')), { id: 'tip' });
    G.lok = grp('Lokacija', locationGroup(s, F, ch), { id: 'lok' });
    G.cena = grp(isSale ? 'Cena' : 'Kirija', rangeGroup(s, F, ch, 'p', ctx), { id: 'cena' });
    G.kv = grp('Kvadratura', rangeGroup(s, F, ch, 'a', ctx), { id: 'kv' });
    G.sobe = grp('Sobe', pillsCounted(ROOM_OPTS.map(([v, l]) => ({ v, l })), s.ro.map((r) => (r === '4+' || /\+$/.test(r) ? '4+' : +r)), F.ro, (v, on, all) => ch({ ro: all }, 'push')), { id: 'sobe' });
    G.sprat = grp('Sprat', [
      el('div', { class: 'srp-pair' },
        numInput(ctx + '-fla', s.flmin, 'od', (v) => ch({ flmin: v }, 'type'), 'Sprat od'),
        numInput(ctx + '-flb', s.flmax, 'do', (v) => ch({ flmax: v }, 'type'), 'Sprat do'),
        el('span', { class: 'srp-unit' }, 'sprat')),
      el('p', { class: 'help' }, 'Prizemlje = 0, suteren = −1'),
      check('Nije poslednji sprat', s.notLast, (on) => ch({ notLast: on }, 'push'), { count: F.bool.notLast }),
    ], { id: 'sprat' });
    G.godina = grp('Godina izgradnje', el('div', { class: 'srp-pair' },
      numInput(ctx + '-ya', s.ymin, 'od', (v) => ch({ ymin: v }, 'type'), 'Godina od'),
      numInput(ctx + '-yb', s.ymax, 'do', (v) => ch({ ymax: v }, 'type'), 'Godina do'),
      el('span', { class: 'srp-unit' }, 'god.')), { id: 'godina' });
    G.stanje = grp('Stanje', pillsCounted(Object.keys(COND).map((k) => ({ v: k, l: COND[k] })), s.co, F.co, (v, on, all) => ch({ co: all }, 'push')), { id: 'stanje' });
    const heatKeys = Object.keys(HEAT).sort((a, b) => cnt(F.he, b) - cnt(F.he, a));
    G.grejanje = grp('Grejanje', el('div', { class: 'srp-checks' }, heatKeys.map((k) => check(HEAT[k], s.he.includes(k), (on) => ch({ he: on ? [...s.he, k] : s.he.filter((x) => x !== k) }, 'push'), { count: cnt(F.he, k) }))), { id: 'grejanje' });
    G.opr = grp('Opremljenost', pillsCounted(Object.keys(FURN).map((k) => ({ v: k, l: FURN[k] })), s.fu, F.fu, (v, on, all) => ch({ fu: all }, 'push')), { id: 'opr' });
    G.ogl = grp('Oglašivač', pillsCounted([{ v: 'agencija', l: 'Agencija' }, { v: 'vlasnik', l: 'Vlasnik' }], s.advertiser ? [s.advertiser] : [], F.adv, (v, on) => ch({ advertiser: on ? v : '' }, 'push'), { single: false }), { id: 'ogl' });
    const amKeys = (isSale ? AMEN_SALE : AMEN_RENT).filter((k) => AMEN[k]);
    const amCheck = (k) => check(AMEN[k], s.am.includes(k), (on) => ch({ am: on ? [...s.am, k] : s.am.filter((x) => x !== k) }, 'push'), { count: cnt(F.am, k) });
    const firstAm = amKeys.slice(0, 6), restAm = amKeys.slice(6);
    G.dodatno = grp('Dodatno', [
      el('div', { class: 'srp-checks' },
        check('Uknjiženo', s.reg, (on) => ch({ reg: on }, 'push'), { count: F.bool.reg }),
        isSale ? check('Novogradnja', s.newbuild, (on) => ch({ newbuild: on }, 'push'), { count: F.bool.newbuild }) : null,
        firstAm.map(amCheck)),
      restAm.length ? el('details', { class: 'srp-more-opts', open: restAm.some((k) => s.am.includes(k)) || null }, el('summary', {}, `Još ${restAm.length}`), el('div', { class: 'srp-checks' }, restAm.map(amCheck))) : null,
    ], { id: 'dodatno' });
    if (isSale && hasKX()) G.budzet = budgetGroup(s, F, ch, ctx);
    if (hasKX()) {
      const legal = check('Samo zeleni semafor', s.legal, (on) => ch({ legal: on }, 'push'), { count: F.bool.legal });
      G.pouzd = grp('Pouzdanost', [legal, el('p', { class: 'help' }, isSale ? 'Zeleno = uknjiženo, bez tereta po oglasu i oglašivač proveren. Uvek proveri list nepokretnosti u eKatastru.' : 'Zeleno = nema znakova prevare (cena, depozit unapred, neproverljiv oglašivač).')], { id: 'pouzd' });
      const quick = pillsCounted([{ v: 'drop', l: 'Snižena cena' }, { v: 'below', l: 'Ispod procene' }, { v: 'stale', l: 'Na oglasu > 60 dana' }], ['drop', 'below', 'stale'].filter((k) => s[k]), F.bool, (v, on) => ch({ [v]: on }, 'push'));
      const dupTog = toggle(s.dup, (on) => ch({ dup: on }, 'push'), { label: 'Spoji iste stanove' });
      const dupNote = el('p', { class: 'help' }, s.dup ? (F.dupN ? `${F.dupN} ${plural(F.dupN, 'duplikat', 'duplikata', 'duplikata')} spojeno u jednu karticu.` : 'Isti stan od više agencija prikazuje se kao jedna kartica sa najnižom cenom. U ovoj pretrazi nema duplikata.') : 'Prikazani su svi oglasi, i kad je isti stan oglašen više puta.');
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
        el('label', { class: 'fld' }, el('span', { class: 'lbl' }, 'Neto primanja (€/mes)'), inc),
        el('label', { class: 'fld' }, el('span', { class: 'lbl' }, 'Ušteđevina (€)'), cash)),
      summary, affPills,
    ], { id: 'budzet', aside: el('span', { class: 'srp-est' }, 'procena') });
  }
  const RAIL_ORDER = ['tip', 'lok', 'cena', 'kv', 'sobe', 'sprat', 'godina', 'stanje', 'grejanje', 'opr', 'ogl', 'dodatno', 'budzet', 'pouzd', 'brzo'];

  /* ───────────────────────── list sa filterima (sve ili jedna grupa) ───────────────────────── */
  function openFilterSheet(s, only) {
    let draft = { ...s, page: 1 };
    const bd = el('div', { class: 'srp-sheet' });
    const cta = el('button', { class: 'btn btn-ink', type: 'button' });
    const paintCta = () => { const n = run(draft, { sort: false }).length; cta.textContent = n ? `Prikaži ${listings(n)}` : 'Nema oglasa — promeni filtere'; };
    const ch = (patch, how) => {
      draft = { ...draft, ...patch };
      if (how === 'drag') return;
      paintCta();
      if (how === 'push') paint();
    };
    const paint = () => {
      const sc = api && api.body ? api.body.scrollTop : 0;
      captureFocus();
      const F = facets(draft);
      const G = buildGroups(draft, F, ch, 'sheet');
      const ids = only ? [].concat(only) : ['t', ...RAIL_ORDER];
      if (!only) G.prikaz = grp('Prikaz cene', segmented(MODES, draft.mode, (v) => ch({ mode: v }, 'drag')), { id: 'prikaz' });
      if (!only) ids.push('prikaz');
      bd.replaceChildren(...ids.map((k) => G[k]).filter(Boolean));
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
    api = sheet(only ? titles[only] || 'Filteri' : 'Filteri', bd, { footer: [reset, cta], onClose: () => { if (openSheet === api) openSheet = null; } });
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
  function openSortSheet(s) {
    const opts = sortOptions(s);
    const body = el('div', { class: 'srp-sortlist', role: 'radiogroup', 'aria-label': 'Sortiraj' },
      opts.map((o) => check(o.l, s.sort === o.v, () => { api.close(); go(s, { sort: o.v }); }, { type: 'radio', name: 'srp-sort', value: o.v })),
      el('p', { class: 'note-rule srp-honest' }, SORT_TIP));
    const api = sheet('Sortiraj', body, {});
  }
  function openModeSheet(s) {
    const body = el('div', { class: 'srp-sortlist', role: 'radiogroup', 'aria-label': 'Prikaz cene' },
      MODES.map((o) => check(o.l, s.mode === o.v, () => { api.close(); setMode(s, o.v); }, { type: 'radio', name: 'srp-mode', value: o.v })),
      el('p', { class: 'note-rule srp-honest' }, 'Ukupno i mesečno su procene iz modela troškova (porez, provizija, overa, kredit 80 %, računi). Detalji na stranici oglasa.'));
    const api = sheet('Prikaz cene', body, {});
  }
  function setMode(s, v) { if (hasKX()) safe(() => KX.profile.set({ priceMode: v })); go(s, { mode: v, page: s.page }, { replace: true }); }

  /* ───────────────────────── kartice: dekoracija ui.card ───────────────────────── */
  function modePrice(l, mode) {
    if (mode === 'oglas' || !hasKX()) return null;
    const c = safe(() => KX.cost(l), null);
    if (!c) return null;
    if (l.t === 'prodaja') {
      if (mode === 'ukupno') { const extra = c.onPurchase - l.p; return { text: eur(c.onPurchase), note: `cena + ${eur(extra)} porez, provizija, overa, kredit`, title: `Cena iz oglasa ${eur(l.p)}; ukupno pri kupovini ${eur(c.onPurchase)} (procena)` }; }
      const rata = (c.lines.find((x) => x.key === 'rata') || {}).amount || 0;
      return { text: eur(c.monthly, 'izdavanje'), note: rata ? `rata ${eur(rata)} + računi ~${eur(c.monthly - rata)}` : `računi i održavanje ~${eur(c.monthly)}`, title: `Mesečno: kredit 80 %, ${safe(() => profile().years, 25)} god. + računi (procena)` };
    }
    if (mode === 'ukupno') return { text: eur(c.moveIn), note: 'za useljenje: kirija, depozit, provizija', title: `Za useljenje ${eur(c.moveIn)} (procena)` };
    return { text: eur(c.monthly, 'izdavanje'), note: `kirija + računi ~${eur(c.monthly - l.p)}`, title: `Mesečno sa računima ${eur(c.monthly, 'izdavanje')} (procena)` };
  }
  function semDot(l) {
    const t = trustOf(l);
    if (!t) return null;
    const txt = `${t.title}${t.reasons && t.reasons[0] ? ' — ' + t.reasons[0] : ''}`;
    const d = el('span', { class: 'srp-sem srp-sem-' + t.color, role: 'img', tabindex: '0', 'aria-label': `Semafor: ${t.title}` });
    return tip(d, txt);
  }
  function affBadge(l) {
    if (l.t !== 'prodaja' || !hasBudget()) return null;
    const a = affOf(l);
    if (!a || a.state === 'nepoznato') return null;
    const lbl = a.state === 'odmah' ? 'Mogu odmah' : a.label;
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
  function dupStrip(l) {
    const g = groupOf(l);
    if (!g || g.offers.length < 2) return null;
    const n = g.offers.length;
    const agN = new Set(g.offers.map((o) => o.ags || 'vlasnik')).size;
    const label = `Isti stan nude ${agN} ${plural(agN, 'oglašivač', 'oglašivača', 'oglašivača')} — od ${eur(g.span.min, l.t)} do ${eur(g.span.max, l.t)}`;
    return el('div', { class: 'srp-dup' },
      el('button', { type: 'button', class: 'srp-dup-b', 'data-act': 'dup', 'aria-expanded': 'false' }, icon('blocks', 16), el('span', {}, label), icon('chev-d', 16)),
      el('ul', { class: 'srp-dup-l', hidden: true }, g.offers.map((o) => el('li', {},
        el('a', { href: safe(() => UI_HREF.listing(o.s), '#/oglas/' + o.s) }, el('span', { class: 'ag' }, o.ag || 'Vlasnik'), el('b', { class: 'num' }, eur(o.p, l.t)), el('span', { class: 'meta' }, safe(() => fmt.rel(o.dz), '')))))),
      el('span', { class: 'sr' }, `${n} oglasa za isti stan`));
  }
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
      else row.after(el('p', { class: 'srp-pm' }, el('span', {}, mp.note), el('span', { class: 'srp-est' }, 'procena')));
    }
    if (variant === 'table') {
      const ag = node.querySelector('.ag'); const d = semDot(l); if (ag && d) ag.prepend(d);
      return node;
    }
    const after = node.querySelector('.srp-pm') || node.querySelector('.pricerow');
    const ab = affBadge(l); if (ab && after) after.after(el('p', { class: 'srp-affrow' }, ab));
    const facts = node.querySelector('.facts');
    const tc = travelChips(l); if (tc && facts) facts.after(tc);
    const foot = node.querySelector('.foot');
    if (foot) { const d = semDot(l); const ag = foot.querySelector('.ag'); if (d && ag) ag.before(d); }
    if (variant === 'grid') node.appendChild(moreBtn(l));
    else if (variant === 'list') { const side = node.querySelector('.side'); if (side) side.insertBefore(moreBtn(l), side.children[1] || null); }
    else node.appendChild(moreBtn(l));
    if (s.dup) { const ds = dupStrip(l); if (ds) (node.querySelector('.body') || node).appendChild(ds); }
    return node;
  }
  const mkCard = (l, s, variant) => decorate(card(l, variant), l, s, variant);

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
    document.body.appendChild(menuEl);
    const r = btn.getBoundingClientRect();
    const w = menuEl.offsetWidth;
    menuEl.style.top = Math.min(window.innerHeight - menuEl.offsetHeight - 8, r.bottom + 6) + 'px';
    menuEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', menuKey, true);
    const first = menuEl.querySelector('button'); if (first) first.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => { if (menuEl && !menuEl.contains(e.target) && !(e.target.closest && e.target.closest('[data-act="more"]'))) closeMenu(); });
  window.addEventListener('scroll', () => closeMenu(), { passive: true });
  function toggleCompare(slug) {
    const on = safe(() => store.toggleCompare(slug), false);
    const ids = safe(() => store.compare.slice(), []);
    if (on) toast(`Dodato u poređenje (${ids.length})`, { action: { label: 'Uporedi', href: '#/uporedi?ids=' + ids.join(',') } });
    else if (!ids.includes(slug)) toast('Uklonjeno iz poređenja');
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
      nNew ? [el('span', { class: 'dot', 'aria-hidden': 'true' }, '·'), tip(el('span', { class: 'srp-new' }, `${nNew} ${plural(nNew, 'nov', 'nova', 'novih')}`), 'Objavljeno u poslednjih 7 dana')] : null);
    const params = toParams({ ...s, page: 1, view: 'grid', mode: 'oglas' });
    const pkey = JSON.stringify(params);
    const saved = safe(() => store.searches.find((x) => JSON.stringify(x.params) === pkey), null);
    const saveWrap = el('div', { class: 'srp-save' });
    const paintSave = (isSaved) => {
      saveWrap.replaceChildren(isSaved
        ? el('a', { class: 'btn btn-secondary btn-sm srp-saved', href: '#/sacuvani', 'aria-label': 'Pretraga je sačuvana — otvori sačuvane' }, icon('check'), 'Pretraga sačuvana')
        : el('button', { class: 'btn btn-secondary btn-sm', type: 'button', 'data-act': 'save-open', 'aria-expanded': 'false' }, icon('bookmark'), 'Sačuvaj pretragu'));
    };
    paintSave(!!saved);
    const form = el('form', { class: 'srp-saveform', hidden: true, 'aria-label': 'Sačuvaj pretragu' },
      el('label', { class: 'fld' }, el('span', { class: 'lbl' }, 'Naziv pretrage'), el('input', { class: 'input', name: 'name', value: autoName(s), maxlength: '80', 'data-fkey': 'save-name' })),
      el('div', { class: 'btn-row' }, el('button', { class: 'btn btn-ink btn-sm', type: 'submit' }, 'Sačuvaj'), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-act': 'save-cancel' }, 'Otkaži')),
      el('p', { class: 'help' }, 'Pretraga ostaje u ovom pregledaču; na stranici Sačuvano vidiš nove oglase od poslednje posete.'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (form.elements.name.value || '').trim() || autoName(s);
      const it = safe(() => store.saveSearch(name, params), null);
      form.hidden = true;
      paintSave(!!it);
      toast(it ? `Sačuvano: ${name}` : 'Čuvanje nije uspelo', it ? { action: { label: 'Sačuvane pretrage', href: '#/sacuvani' } } : {});
    });
    saveWrap.addEventListener('click', (e) => {
      if (!e.target.closest('[data-act="save-open"]')) return;
      form.hidden = !form.hidden;
      e.target.closest('button').setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) { const i = form.elements.name; i.focus(); i.select(); }
    });
    form.addEventListener('click', (e) => { if (e.target.closest('[data-act="save-cancel"]')) { form.hidden = true; const b = saveWrap.querySelector('button'); if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); } } });
    return el('header', { class: 'srp-head' },
      crumbsFor(s),
      el('div', { class: 'srp-hrow' },
        el('div', { class: 'srp-htxt' }, el('h1', { class: 't-h1' }, titleFor(s)), meta),
        saveWrap),
      form);
  }
  function pillLabel(s, id) {
    switch (id) {
      case 'tip': return s.pt.length === 1 ? typeOfV(s.pt[0]).l : s.pt.length ? `Tip · ${s.pt.length}` : 'Tip';
      case 'lok': { const c = s.c && safe(() => find.city(s.c), null); return s.m.length ? `${c ? c.n + ' · ' : ''}${s.m.length === 1 ? (safe(() => find.mun(s.m[0]).n, 'opština')) : s.m.length + ' opštine'}` : c ? c.n : 'Lokacija'; }
      case 'cena': return priceQual(s) || (s.t === 'izdavanje' ? 'Kirija' : 'Cena');
      case 'kv': { const a = num(s.amin), b = num(s.amax); return a != null && b != null ? `${a}–${b} m²` : b != null ? `do ${b} m²` : a != null ? `od ${a} m²` : 'Kvadratura'; }
      case 'sobe': return s.ro.length ? `Sobe ${s.ro.map((r) => (typeof r === 'number' ? safe(() => fmt.roomsN(r), r) : r)).join(', ')}` : 'Sobe';
      default: return id;
    }
  }
  const pillOn = (s, id) => (id === 'tip' ? s.pt.length : id === 'lok' ? !!(s.c || s.m.length) : id === 'cena' ? num(s.pmin) != null || num(s.pmax) != null : id === 'kv' ? num(s.amin) != null || num(s.amax) != null : id === 'sobe' ? s.ro.length : false);
  function filterBar(s, B) {
    const n = activeCount(s);
    const cut = (t) => (t.length > 26 ? t.slice(0, 25) + '…' : t);
    const pillsArr = ['tip', 'lok', 'cena', 'kv', 'sobe'].map((id) => { const b = filterChip(cut(pillLabel(s, id)), { on: !!pillOn(s, id), expands: true }); b.dataset.act = 'pill'; b.dataset.id = id; return b; });
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
    const modePill = filterChip(MODES.find((m) => m.v === s.mode).l, { on: s.mode !== 'oglas', expands: true }); modePill.dataset.act = 'modesheet';
    return el('div', { class: 'filterbar srp-bar' },
      el('div', { class: 'row1' }, fbtn, sbtn, el('span', { class: 'sp' }), phoneViews),
      el('div', { class: 'rail srp-rail-h' }, pillsArr.map((b) => b.cloneNode(true)), modePill),
      el('div', { class: 'desk srp-desk srp-desk-l' },
        segmented([{ v: 'prodaja', l: 'Prodaja' }, { v: 'izdavanje', l: 'Izdavanje' }], s.t, (v) => go(s, { t: v, pmin: '', pmax: '', aff: [] })),
        el('div', { class: 'srp-pills' }, pillsArr), allBtn),
      el('div', { class: 'desk srp-desk srp-desk-r' },
        el('label', { class: 'sort' }, icon('sort', 16), el('span', {}, 'Sortiraj'), sortSel), info, deskViews));
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
    if (num(s.flmin) != null || num(s.flmax) != null) add(`Sprat ${num(s.flmin) ?? '…'}–${num(s.flmax) ?? '…'}`, { flmin: '', flmax: '' });
    if (s.notLast) add('Nije poslednji sprat', { notLast: false });
    if (num(s.ymin) != null || num(s.ymax) != null) add(`Godina ${num(s.ymin) ?? '…'}–${num(s.ymax) ?? '…'}`, { ymin: '', ymax: '' });
    s.co.forEach((v) => add(COND[v] || v, { co: s.co.filter((x) => x !== v) }));
    s.he.forEach((v) => add(HEAT[v] || v, { he: s.he.filter((x) => x !== v) }));
    s.fu.forEach((v) => add(FURN[v] || v, { fu: s.fu.filter((x) => x !== v) }));
    if (s.reg) add('Uknjiženo', { reg: false });
    if (s.newbuild) add('Novogradnja', { newbuild: false });
    s.am.forEach((v) => add(AMEN[v] || v, { am: s.am.filter((x) => x !== v) }));
    if (s.advertiser) add(s.advertiser === 'vlasnik' ? 'Od vlasnika' : 'Agencije', { advertiser: '' });
    if (s.agency) { const a = safe(() => find.agency(s.agency), null); add(a ? a.n : s.agency, { agency: '' }); }
    if (s.q) add(`„${s.q}”`, { q: '' });
    if (num(s.deltaMax) != null) add(`Δ do ${s.deltaMax} %`, { deltaMax: '' });
    if (s.legal) add('Zeleni semafor', { legal: false });
    s.aff.forEach((v) => add(AFF_OPTS.find((o) => o.v === v).l, { aff: s.aff.filter((x) => x !== v) }));
    if (s.drop) add('Snižena cena', { drop: false });
    if (s.below) add('Ispod procene', { below: false });
    if (s.stale) add('Na oglasu > 60 dana', { stale: false });
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
    const left = el('p', { class: 'srp-count num', 'aria-live': 'polite' },
      el('b', {}, listings(list.length)),
      F.hiddenN ? [el('span', { class: 'dot', 'aria-hidden': 'true' }, '·'), el('button', { type: 'button', class: 'srp-lnk', 'data-act': 'showhidden' }, `Sakriveno: ${F.hiddenN} · Prikaži`)] : null,
      s.hid ? [el('span', { class: 'dot', 'aria-hidden': 'true' }, '·'), el('button', { type: 'button', class: 'srp-lnk', 'data-act': 'hidehidden' }, 'Sakrij sakrivene')] : null,
      el('a', { class: 'srp-lnk srp-cmp', href: '#/uporedi?ids=' + cmpIds.join(','), hidden: !cmpIds.length }, icon('compare', 16), `Uporedi (${cmpIds.length})`));
    const modeSeg = segmented(MODES.map((m) => ({ v: m.v, l: m.v === 'oglas' ? 'Iz oglasa' : m.v === 'ukupno' ? 'Ukupno sa troškovima' : 'Mesečno' })), s.mode, (v) => setMode(s, v));
    modeSeg.setAttribute('aria-label', 'Prikaz cene');
    const right = hasKX() ? el('div', { class: 'srp-mode' }, el('span', { class: 'lbl' }, 'Cena'), modeSeg,
      tip(el('button', { class: 'iconbtn srp-info', type: 'button', 'aria-label': 'Šta znači prikaz cene' }, icon('info', 16)), 'Ukupno = cena + porez/provizija/overa (i troškovi kredita). Mesečno = rata kredita 80 % + računi. Sve su procene, formule na „Kako računamo”.')) : null;
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
      const car = fill(el('div', { class: 'srp-car', role: 'list', 'aria-label': 'Oglasi na mapi' }), all.slice(0, 40), (l) => { const c = mkCard(l, s, 'compact'); c.setAttribute('role', 'listitem'); return c; }, 4, rowPh('row-c'));
      const box = el('div', { class: 'srp-mapfull' }, host, car);
      mountMap(host, s, pinsList, { phone: true, car });
      /* „pun ekran”: traka filtera staje ispod zaglavlja, mapa zauzima ostatak (samo pri ulasku u prikaz mape) */
      if (lastView !== 'map') requestAnimationFrame(() => { const bar = curRoot && curRoot.querySelector('.srp-bar'); if (bar && bar.isConnected) { const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64; window.scrollTo({ top: Math.max(0, bar.getBoundingClientRect().top + window.scrollY - hh), behavior: 'auto' }); } });
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
      if (curMap) { safe(() => curMap.destroy()); curMap = null; }
      const rowsBy = (slug) => (o.rows ? o.rows.querySelector(`[data-slug="${CSS.escape(slug)}"]`) : null);
      let lastHl = null;
      const view = s.bb && s.bb[4] ? { lat: (s.bb[0] + s.bb[1]) / 2, lng: (s.bb[2] + s.bb[3]) / 2, zoom: s.bb[4] } : undefined;
      const api = safe(() => mapView(host, {
        listings: list, city: s.c || undefined, legend: !o.phone, popover: !o.phone, showAreaButton: true, drawTool: !o.phone, view,
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
          if (b && b.polygon && b.polygon.length >= 3) go(s, { zona: b.polygon, bb: null });
          else if (s.zona) go(s, { zona: null });
          else if (b) go(s, { bb: [b.n, b.s, b.e, b.w, b.zoom], zona: null });
        },
        onDraw: (st) => { if (st === 'cancel' && s.zona) go(s, { zona: null }); },
      }), null);
      if (!api) return;
      curMap = api;
      if (s.zona) safe(() => api.setPolygon(s.zona));
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
    const push = (label, patch) => {
      if (seen.has(label)) return; seen.add(label);
      const n = run({ ...s, ...patch }, { sort: false }).length;
      if (n > 0) cands.push({ label, patch, n });
    };
    const extras = { legal: 'Zeleni semafor', drop: 'Snižena cena', below: 'Ispod procene', stale: 'Na oglasu > 60 dana' };
    for (const k of Object.keys(extras)) if (s[k]) push(`Ukloni filter ${extras[k]}`, { [k]: false });
    if (s.aff.length) push('Ukloni filter Moj budžet', { aff: [] });
    if (s.bb) push('Ukloni područje na mapi', { bb: null });
    if (s.zona) push('Ukloni nacrtanu zonu', { zona: null });
    if (hasKX()) {
      const core = coreFilter(s);
      if (s.legal) core.legal = true;
      for (const r of safe(() => KX.relax(core), [])) {
        const patch = {};
        for (const k of CORE_KEYS) if (k !== 'sort' && k !== 'view' && k !== 'page' && JSON.stringify(r.filters[k]) !== JSON.stringify(core[k])) patch[k] = r.filters[k];
        if ('legal' in r.filters && !r.filters.legal && s.legal) patch.legal = false;
        if (Object.keys(patch).length) push(r.label, patch);
      }
    }
    cands.sort((a, b) => b.n - a.n);
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

  /* ───────────────────────── ispod rezultata ───────────────────────── */
  function belowBlock(s, list) {
    if (!list.length) return null;
    const cityCounts = {};
    list.forEach((l) => { cityCounts[l.cs] = (cityCounts[l.cs] || 0) + 1; });
    const cs = s.c || Object.keys(cityCounts).sort((a, b) => cityCounts[b] - cityCounts[a])[0];
    const city = safe(() => find.city(cs), null);
    const pt = s.pt.length === 1 ? s.pt[0] : 'stan';
    const idx = safe(() => stats.munIndex(cs, s.t, pt), []) || [];
    const cityList = safe(() => D.listings.filter((l) => l.cs === cs && l.t === s.t && l.pt === pt && l.ppm), []);
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
      const ratios = months.map((m, i) => { const r = hs.filter(([, h]) => h.points[i].listed).map(([l, h]) => h.points[i].p / l.p); return r.length >= 5 ? median(r) : null; });
      if (nowPpm && ratios.filter((v) => v != null).length >= 5) {
        const firstIdx = ratios.findIndex((v) => v != null);
        const vals = ratios.map((r, i) => Math.round((r ?? ratios[firstIdx]) * nowPpm));
        const ch = (vals[vals.length - 1] / vals[firstIdx] - 1) * 100;
        spark = sparkline(vals, { title: 'Tražena cena po m² · 12 meseci', months, format: (v) => safe(() => fmt.ppm(v), N0.format(v)), source: 'Izvor: oglasi iz ove pretrage, promene cena po oglasu (procena)',
          delta: isFinite(ch) ? deltaChip({ pct: ch, label: '12 meseci' }, { title: `${safe(() => fmt.pct(ch, { sign: true }), ch.toFixed(1) + ' %')} za 12 meseci (iste nekretnine, tražena cena)` }) : null });
      }
    }
    const title = `Cena po m² u opštinama${city ? ' · ' + city.n : ''}`;
    const sub = `Medijana tražene cene, ${typeOfV(pt).pl}, ${s.t === 'izdavanje' ? 'izdavanje' : 'prodaja'} · referentna linija = ceo grad`;
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
    const byM = {};
    list.forEach((l) => { if (!l.m) return; (byM[l.m] = byM[l.m] || []).push(l); });
    const ms = Object.entries(byM).filter(([, a]) => a.length >= 3).map(([m, a]) => ({ m, n: a.length, ppm: median(a.filter((x) => x.ppm).map((x) => x.ppm)) })).filter((x) => x.ppm);
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
      t2.push(`Polovina oglasa je na tržištu duže od ${N0.format(Math.round(dom))} ${plural(Math.round(dom), 'dan', 'dana', 'dana')}${drops ? `, a ${drops} ${plural(drops, 'oglas je snizio', 'oglasa su snizila', 'oglasa je snizilo')} cenu` : ''}. Dani se računaju od prvog objavljivanja, ne od poslednjeg „obnavljanja”.`);
    }
    if (rent) {
      const furn = list.filter((l) => l.fu === 'namesten').length, pets = list.filter((l) => l.am && l.am.includes('petsAllowed')).length;
      t2.push(`Namešteno je ${pct(furn)} % stanova, a kućne ljubimce dozvoljava ${pct(pets)} % oglašivača.`);
    }
    return [t1.join(' '), t2.join(' ')];
  }

  /* ───────────────────────── rail (desktop) ───────────────────────── */
  function railBlock(s, F) {
    const ch = (patch, how) => { if (how === 'drag') return; if (how === 'type') goTyped(s, patch); else go(s, patch); };
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
    const withRail = B.desk && s.view === 'grid';
    const rail = withRail ? railBlock(s, F) : null; lap('rail');
    const body = el('div', { class: 'results srp-results' + (s.view === 'map' ? ' is-map' : '') },
      rail,
      el('div', { class: 'main' }, el('span', { class: 'srp-anchor' }), s.view === 'map' && !B.wide ? null : resBar(s, list, F, B), main, showPager ? pagerBlock(s, list, P, B) : null));
    const head = headBlock(s, list), bar = filterBar(s, B), tags = activeTags(s) || el('div', { class: 'srp-notags' }); lap('chrome');
    const below = s.view === 'map' && !B.wide ? [] : [].concat(belowBlock(s, list) || []); lap('below');
    root.className = 'wrap srp' + (withRail ? '' : ' srp-norail') + (s.view === 'map' ? ' srp-is-map' : '');
    root.dataset.view = s.view;
    root.replaceChildren(head, bar, tags, body, ...below);
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
      else if (act === 'pill') openFilterSheet(s, a.dataset.id);
      else if (act === 'filters') openFilterSheet(s);
      else if (act === 'sortsheet') openSortSheet(s);
      else if (act === 'modesheet') openModeSheet(s);
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
})();
