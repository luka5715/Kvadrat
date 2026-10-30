/* Kvadrat.rs — core: podaci (window.KV), DOM helperi ($, el), hash/rng, formatiranje (fmt), statistika (stats),
   deterministički „mock“ podaci o lokaciji (mock), stanje (store), ruter i filteri (router + globali), kredit/troškovi, toast.
   Nema build koraka; svi izvozi su globali u deljenom opsegu. Na učitavanju NE dira DOM (radi i u node testu dev/core.test.js).
   API dokumentacija: dev/API-core.md */
'use strict';

/* ───────────────────────── podaci ───────────────────────── */
const D = (typeof window !== 'undefined' && window.KV) || (typeof globalThis !== 'undefined' && globalThis.KV) ||
  { listings: [], cities: [], muns: [], agencies: [], articles: [] };
const HAS_DOM = typeof document !== 'undefined' && !!document && typeof document.createElement === 'function';

/* ───────────────────────── DOM helperi ───────────────────────── */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/* el(tag, attrs, ...kids)
   attrs: class | id | href | type | style (string) | html (innerHTML) | onclick/on* (listener) | data-* / aria-* / sve ostalo → setAttribute.
   null/undefined/false se preskače; true → prazan atribut. kids: string | number | Node | niz (ugnežđen) | null/false. */
const el = (tag, attrs, ...kids) => {
  const n = document.createElement(tag);
  if (attrs) for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') n.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v);
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset' && typeof v === 'object') { for (const dk of Object.keys(v)) if (v[dk] != null) n.dataset[dk] = String(v[dk]); }
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  appendKids(n, kids);
  return n;
};
function appendKids(n, kids) {
  for (const kid of kids) {
    if (kid == null || kid === false || kid === true) continue;
    if (Array.isArray(kid)) { appendKids(n, kid); continue; }
    n.appendChild(typeof kid === 'object' && kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
}

/* ───────────────────────── hash / rng (identični starim — images.js zavisi od njih) ───────────────────────── */
function hash(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

/* ───────────────────────── taksonomija (etikete zadržane iz starog core.js) ───────────────────────── */
const TYPES = [
  { v: 'stan', l: 'Stanovi', s: 'Stan', pl: 'stanova', icon: 'building' },
  { v: 'kuca', l: 'Kuće', s: 'Kuća', pl: 'kuća', icon: 'house' },
  { v: 'poslovni-prostor', l: 'Poslovni prostori', s: 'Poslovni prostor', pl: 'poslovnih prostora', icon: 'office' },
  { v: 'zemljiste', l: 'Zemljišta', s: 'Zemljište', pl: 'zemljišta', icon: 'land' },
  { v: 'garaza', l: 'Garaže', s: 'Garaža', pl: 'garaža', icon: 'garage' },
  { v: 'soba', l: 'Sobe', s: 'Soba', pl: 'soba', icon: 'bed' },
  { v: 'vikendica', l: 'Vikendice', s: 'Vikendica', pl: 'vikendica', icon: 'house' },
];
const ROOMS = [[0.5, 'Garsonjera'], [1, 'Jednosoban'], [1.5, 'Jednoiposoban'], [2, 'Dvosoban'], [2.5, 'Dvoiposoban'],
  [3, 'Trosoban'], [3.5, 'Troiposoban'], [4, 'Četvorosoban'], [4.5, 'Četvoroiposoban'], [5, 'Petosoban i više']];
const COND = { 'novogradnja': 'Novogradnja', 'lux': 'Lux', 'renovirano': 'Renovirano', 'dobro-stanje': 'Dobro stanje', 'potrebno-renoviranje': 'Potrebno renoviranje', 'u-izgradnji': 'U izgradnji' };
const HEAT = { 'centralno': 'Centralno grejanje', 'etazno': 'Etažno grejanje', 'podno': 'Podno grejanje', 'gas': 'Gas', 'struja': 'Struja', 'ta-pec': 'TA peć', 'klima': 'Klima uređaj', 'pelet': 'Pelet / biomasa', 'kotlarnica': 'Sopstvena kotlarnica', 'toplotna-pumpa': 'Toplotna pumpa' };
const FURN = { 'namesten': 'Namešten', 'polunamesten': 'Polunamešten', 'prazan': 'Prazan' };
const ORIENT = { istok: 'Istok', zapad: 'Zapad', sever: 'Sever', jug: 'Jug', jugoistok: 'Jugoistok', jugozapad: 'Jugozapad', severoistok: 'Severoistok', severozapad: 'Severozapad' };
const AMEN = {
  hasElevator: 'Lift', hasBalcony: 'Balkon', hasTerrace: 'Terasa', hasLoggia: 'Lođa', hasParking: 'Parking',
  hasGarage: 'Garaža', hasBasement: 'Podrum', hasStorage: 'Ostava', hasGarden: 'Dvorište / bašta', hasPool: 'Bazen',
  hasAc: 'Klima', hasInternet: 'Internet', hasCableTv: 'Kablovska TV', hasIntercom: 'Interfon', hasAlarm: 'Alarm',
  hasVideoSurv: 'Video nadzor', hasPhoneLine: 'Telefon', isAccessible: 'Pristup za invalide',
  petsAllowed: 'Dozvoljeni ljubimci', smokingAllowed: 'Dozvoljeno pušenje', studentsOk: 'Pogodno za studente',
};
const ENERGY = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SORTS = [
  { v: 'rel', l: 'Preporučeno' }, { v: 'new', l: 'Najnovije' }, { v: 'p-asc', l: 'Cena rastuće' }, { v: 'p-desc', l: 'Cena opadajuće' },
  { v: 'ppm-asc', l: '€/m² rastuće' }, { v: 'ppm-desc', l: '€/m² opadajuće' }, { v: 'a-desc', l: 'Kvadratura' }, { v: 'delta', l: 'Najbolja vrednost' },
];
const ADVERTISERS = [{ v: '', l: 'Svi oglašivači' }, { v: 'agencija', l: 'Agencije' }, { v: 'vlasnik', l: 'Vlasnici' }];
const CITIES_MAJOR = D.cities.filter((c) => c.maj).map((c) => ({ s: c.s, n: c.n, loc: c.loc }));
const typeOf = (v) => TYPES.find((t) => t.v === v) || TYPES[0];

/* brzi pregledi po slug-u */
const find = (() => {
  let maps = null;
  const build = () => {
    if (maps) return maps;
    const mk = (arr) => { const m = new Map(); for (const x of arr) m.set(x.s, x); return m; };
    maps = { listing: mk(D.listings), city: mk(D.cities), mun: mk(D.muns), agency: mk(D.agencies), article: mk(D.articles) };
    return maps;
  };
  return {
    listing: (s) => build().listing.get(s) || null,
    city: (s) => build().city.get(s) || null,
    mun: (s) => build().mun.get(s) || null,
    agency: (s) => build().agency.get(s) || null,
    article: (s) => build().article.get(s) || null,
    munsOf: (cs) => D.muns.filter((m) => m.cs === cs),
    /* posle dodavanja oglasa u D.listings (KX.enrich) mape se grade iznova */
    reset: () => { maps = null; },
  };
})();

/* ───────────────────────── formatiranje (sr-RS: hiljade '.', decimale ',') ───────────────────────── */
/* NBSP između broja i jedinice (jedinica ne prelazi sama u novi red); THIN = uski NEPRELOMNI razmak (U+202F) pre % */
const NBSP = ' ', THIN = ' ', MINUS = '−';
function fmtNum(n, dec = 0) {
  if (n == null || !isFinite(n)) return '';
  const neg = n < 0; const abs = Math.abs(n);
  const fixed = abs.toFixed(dec);
  let [int, frac] = fixed.split('.');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? MINUS : '') + int + (frac ? ',' + frac : '');
}
const plural = (n, a, b, c) => {
  n = Math.abs(Math.round(n)); const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b;
  return c;
};
const fmt = {
  /* fmt.num(1234.5) → "1.235"; fmt.num(4.75, 2) → "4,75" */
  num: fmtNum,
  /* fmt.price(125000) → "125.000 €"; fmt.price(450, 'izdavanje') → "450 €/mes" */
  price: (n, t) => (n == null ? '' : fmtNum(Math.round(n)) + NBSP + (t === 'izdavanje' ? '€/mes' : '€')),
  /* fmt.ppm(1850.4) → "1.850 €/m²"; za kiriju (< 100) čuva jednu decimalu: "13,1 €/m²" */
  ppm: (n) => (n == null || !isFinite(n) ? '' : (n >= 100 ? fmtNum(Math.round(n)) : fmtNum(Math.round(n * 10) / 10, Number.isInteger(Math.round(n * 10) / 10) ? 0 : 1)) + NBSP + '€/m²'),
  /* fmt.m2(46) → "46 m²"; fmt.m2(46.5) → "46,5 m²" */
  m2: (n) => { if (n == null) return ''; const r = Math.round(n * 10) / 10; return fmtNum(r, Number.isInteger(r) ? 0 : 1) + NBSP + 'm²'; },
  /* fmt.land(650) → "6,5 ari"; fmt.land(12000) → "1,2 ha" */
  land: (m2) => {
    if (m2 == null) return '';
    if (m2 >= 10000) { const ha = Math.round(m2 / 1000) / 10; return fmtNum(ha, Number.isInteger(ha) ? 0 : 1) + ' ha'; }
    const ari = Math.round(m2 / 10) / 10;
    return fmtNum(ari, Number.isInteger(ari) ? 0 : 1) + ' ' + (Number.isInteger(ari) ? plural(ari, 'ar', 'ara', 'ari') : 'ari');
  },
  /* fmt.pct(9.66, {sign:true}) → "+9,7 %"; fmt.pct(-6.2) → "−6,2 %"; fmt.pct(0, {sign:true}) → "±0,0 %" (tanak razmak pre %) */
  pct: (x, opts = {}) => {
    if (x == null || !isFinite(x)) return '';
    const dec = opts.dec == null ? 1 : opts.dec;
    const r = Math.round(Math.abs(x) * Math.pow(10, dec)) / Math.pow(10, dec);
    const s = x < 0 && r > 0 ? MINUS : x > 0 && r > 0 ? (opts.sign ? '+' : '') : (opts.sign ? '±' : '');
    return s + fmtNum(r, dec) + THIN + '%';
  },
  /* fmt.rel(0) → "danas", 1 → "juče", 3 → "pre 3 dana", 14 → "pre 2 nedelje", 90 → "pre 3 meseca", 400 → "pre godinu dana" */
  rel: (d) => {
    d = Math.max(0, Math.round(d || 0));
    if (d === 0) return 'danas';
    if (d === 1) return 'juče';
    if (d < 7) return `pre ${d} dana`;
    if (d < 30) { const w = Math.max(1, Math.round(d / 7)); return w === 1 ? 'pre nedelju dana' : `pre ${w} ${plural(w, 'nedelju', 'nedelje', 'nedelja')}`; }
    if (d < 365) { const m = Math.min(11, Math.max(1, Math.round(d / 30))); return m === 1 ? 'pre mesec dana' : `pre ${m} ${plural(m, 'mesec', 'meseca', 'meseci')}`; }
    const y = Math.floor(d / 365); return y === 1 ? 'pre godinu dana' : `pre ${y} ${plural(y, 'godinu', 'godine', 'godina')}`;
  },
  /* fmt.floor(2, 10) → "2. od 10"; (0, 6) → "Prizemlje od 6"; (-1) → "Suteren"; (3) → "3." */
  floor: (fl, tf) => {
    if (fl == null) return '';
    const base = fl === -1 ? 'Suteren' : fl === 0 ? 'Prizemlje' : `${fl}.`;
    return tf ? `${base} od ${tf}` : base;
  },
  /* fmt.rooms(2) → "Dvosoban"; (0.5) → "Garsonjera"; (6) → "Petosoban i više" */
  rooms: (ro) => { if (ro == null) return ''; const r = ROOMS.find((x) => x[0] === ro); return r ? r[1] : ro >= 5 ? ROOMS[ROOMS.length - 1][1] : `${fmtNum(ro, Number.isInteger(ro) ? 0 : 1)} sobe`; },
  /* fmt.roomsN(2) → "2"; (1.5) → "1,5"; (5) → "5+" */
  roomsN: (ro) => (ro == null ? '' : ro >= 5 ? '5+' : fmtNum(ro, Number.isInteger(ro) ? 0 : 1)),
  /* fmt.roomsText(2) → "2 sobe"; (1.5) → "1,5 sobe" (decimalni broj → genitiv jednine); (1) → "1 soba"; (5) → "5+ soba" */
  roomsText: (ro) => { if (ro == null) return ''; const n = fmt.roomsN(ro); if (ro >= 5) return n + ' soba'; return n + ' ' + (Number.isInteger(ro) ? plural(ro, 'soba', 'sobe', 'soba') : 'sobe'); },
  /* fmt.year(1990) → "1990." */
  year: (y) => (y == null ? '' : `${y}.`),
  /* fmt.count(106, 'oglas', 'oglasa', 'oglasa') → "106 oglasa" ; fmt.listings(1) → "1 oglas" */
  count: (n, a, b, c) => `${fmtNum(n)} ${plural(n, a, b, c)}`,
  listings: (n) => fmt.count(n, 'oglas', 'oglasa', 'oglasa'),
  plural,
  /* fmt.month('2026-01') → "jan ’26" (za ose sparkline-a) */
  month: (ym) => { const [y, m] = String(ym).split('-'); const names = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec']; return `${names[(+m || 1) - 1]} ’${String(y).slice(2)}`; },
  /* fmt.fold('Čačak Đeram') → "cacak djeram" — za pretragu bez dijakritika */
  fold: (s) => String(s || '').toLowerCase().replace(/đ/g, 'dj').replace(/dž/g, 'dz').normalize('NFD').replace(/[̀-ͯ]/g, ''),
};

/* ───────────────────────── statistika ───────────────────────── */
const median = (arr) => { if (!arr.length) return null; const a = arr.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const percentile = (sorted, p) => { if (!sorted.length) return null; const i = (sorted.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); };
const niceStep = (raw) => { if (!(raw > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };

const stats = (() => {
  /* "t|pt" → { nbhd: Map(ns→ppm[]), mun, sub: ppm[], city (Beograd bez prigradskih), region: Map(reg→ppm[] manjih gradova) }
     Sintetički ponovljeni oglasi (l.syn — isti stan kod druge agencije, vidi KX.enrich) ne ulaze u medijane: jedan stan = jedan glas. */
  let groups = new Map();
  let deltaCache = new Map();
  const MIN_N = 5;
  const REGION_MIN = 6;   /* uzorak iz više manjih gradova: jedan oglas više nego za jedan grad */
  /* prigradske opštine Beograda: porede se međusobno, nikad sa gradskim jezgrom */
  const SUBURBAN = new Set(['surcin', 'grocka', 'obrenovac', 'lazarevac', 'mladenovac', 'sopot', 'barajevo']);
  const isSub = (l) => l.cs === 'beograd' && SUBURBAN.has(l.ms);
  /* Δ se ne računa za plac (cena po aru, €/m² se ne prikazuje) i sobu (cena po m² sobe zavisi od veličine sobe, ne od kraja) */
  const NO_DELTA = new Set(['zemljiste', 'soba']);
  const SUB_LABEL = 'prigradske opštine Beograda';
  /* planinski i banjski centri imaju svoje cene (vikend-tržište): porede se međusobno, ne sa gradovima regiona */
  const RESORTS = new Set(['zlatibor', 'kopaonik', 'vrnjacka-banja']);
  const RESORT_REG = 'turistička mesta';
  const regLabel = (reg) => (reg === RESORT_REG ? 'turistička mesta (Zlatibor, Kopaonik, Vrnjačka Banja)' : 'manji gradovi — ' + reg);
  const cityReg = (cs) => { if (RESORTS.has(cs)) return RESORT_REG; const c = find.city(cs); return c && c.reg && c.reg !== 'Beograd' ? c.reg : null; };
  function group(t, pt) {
    const key = t + '|' + pt;
    if (groups.has(key)) return groups.get(key);
    const g = { nbhd: new Map(), mun: new Map(), sub: [], city: new Map(), region: new Map(), all: [] };
    const push = (m, k, v) => { if (!k) return; let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push(v); };
    const own = [];
    for (const l of D.listings) {
      if (l.t !== t || l.pt !== pt || l.syn || l.ppm == null || !(l.ppm > 0)) continue;
      own.push(l);
      push(g.nbhd, l.ns, l.ppm); push(g.mun, l.ms, l.ppm); g.all.push(l.ppm);
      if (isSub(l)) g.sub.push(l.ppm); else push(g.city, l.cs, l.ppm);
    }
    /* region: samo gradovi koji nemaju sopstveni uzorak (n<5), da mali grad ne bi bio poređen sa Novim Sadom ili Nišem */
    for (const l of own) { if (isSub(l)) continue; const reg = cityReg(l.cs); if (reg && (g.city.get(l.cs) || []).length < MIN_N) push(g.region, reg, l.ppm); }
    const medCache = new Map();
    g.med = (scope, k) => {
      const ck = scope + ':' + k;
      if (medCache.has(ck)) return medCache.get(ck);
      const arr = scope === 'all' ? g.all : scope === 'sub' ? g.sub : (g[scope] && g[scope].get(k)) || [];
      const md = arr.length ? median(arr) : null;
      const r = { ppm: md == null ? null : md >= 100 ? Math.round(md) : Math.round(md * 100) / 100, n: arr.length };
      medCache.set(ck, r); return r;
    };
    groups.set(key, g);
    return g;
  }
  /* referentna medijana €/m² za isti t+pt, prvi obim sa n ≥ 5:
     naselje → opština → (prigradske opštine Beograda) → grad (Beograd bez prigradskih) → manji gradovi istog regiona → null.
     Nikad cela Srbija (Beograd bi dominirao). Bez obima: {ppm:null, n:0, scope:null, reason:'malo'|'tip'} */
  function refPpm(l) {
    if (!l) return null;
    if (NO_DELTA.has(l.pt)) return { ppm: null, label: '', n: 0, scope: null, reason: 'tip' };
    const g = group(l.t, l.pt);
    const sub = isSub(l);
    const reg = sub ? null : cityReg(l.cs);
    const tries = [['nbhd', l.ns, l.n], ['mun', l.ms, l.m]];
    if (sub) tries.push(['sub', '', SUB_LABEL]);
    else { tries.push(['city', l.cs, l.c]); if (reg) tries.push(['region', reg, regLabel(reg)]); }
    for (const [scope, k, label] of tries) {
      if (!k && scope !== 'sub') continue;
      const r = g.med(scope, k);
      if (r.n >= (scope === 'region' ? REGION_MIN : MIN_N) && r.ppm > 0) return { ppm: r.ppm, label, n: r.n, scope, key: k };
    }
    return { ppm: null, label: '', n: 0, scope: null, reason: 'malo' };
  }
  /* da li oglas x pripada obimu reference ref (izračunate za oglas l) — za grafike „oblast Merila” na stranicama */
  function inScope(x, l, ref) {
    if (!ref || !ref.scope || !x || !l) return false;
    if (x.t !== l.t || x.pt !== l.pt) return false;
    switch (ref.scope) {
      case 'nbhd': return x.ns === l.ns && x.cs === l.cs;
      case 'mun': return x.ms === l.ms;
      case 'sub': return isSub(x);
      case 'city': return x.cs === l.cs && !isSub(x);
      case 'region': return !isSub(x) && cityReg(x.cs) === ref.key && (group(l.t, l.pt).city.get(x.cs) || []).length < MIN_N;
      default: return false;
    }
  }
  function delta(l) {
    if (!l) return null;
    if (deltaCache.has(l.s)) return deltaCache.get(l.s);
    const ref = refPpm(l);
    const ok = ref && ref.ppm > 0 && l.ppm != null && l.ppm > 0;
    const d = { pct: ok ? Math.round((l.ppm / ref.ppm - 1) * 1000) / 10 : null, ppm: ok ? ref.ppm : null, label: ok ? ref.label : '', n: ok ? ref.n : 0, scope: ok ? ref.scope : null, reason: ok ? null : (ref && ref.reason) || 'malo' };
    deltaCache.set(l.s, d);
    return d;
  }
  /* posle dodavanja oglasa u D.listings (KX.enrich): sve medijane i Δ se računaju iznova */
  function reset() { groups = new Map(); deltaCache = new Map(); cityIdx = null; }
  const deltaPct = (l) => { const d = delta(l); return d && d.pct != null ? d.pct : null; };
  let cityIdx = null;
  /* medijana €/m² prodaja+stan po većim gradovima (maj ili ≥10 oglasa) + deterministička mesečna/godišnja promena */
  function cityIndex() {
    if (cityIdx) return cityIdx;
    const g = group('prodaja', 'stan');
    const counts = new Map();
    for (const l of D.listings) if (l.t === 'prodaja' && l.pt === 'stan' && !l.syn) counts.set(l.cs, (counts.get(l.cs) || 0) + 1);
    cityIdx = D.cities.filter((c) => c.maj || (counts.get(c.s) || 0) >= 10).map((c) => {
      const r = g.med('city', c.s); const rr = rng(hash(c.s + '#idx'));
      return { c: c.n, cs: c.s, loc: c.loc, ppm: r.ppm, n: r.n, change: Math.round((rr() * 3 - 1.5) * 10) / 10, change12: Math.round((rr() * 12 - 2) * 10) / 10 };
    }).filter((x) => x.ppm != null).sort((a, b) => b.n - a.n || b.ppm - a.ppm);
    return cityIdx;
  }
  /* medijane €/m² po opštinama datog grada za t+pt (za bar-chart sa n=) */
  function munIndex(cs, t = 'prodaja', pt = 'stan') {
    const g = group(t, pt);
    return D.muns.filter((m) => m.cs === cs).map((m) => { const r = g.med('mun', m.s); return { m: m.n, ms: m.s, ppm: r.ppm, n: r.n }; })
      .filter((x) => x.ppm != null).sort((a, b) => b.ppm - a.ppm);
  }
  /* histogram(list, 'p', 24) → [{from,to,n}] sa „lepim“ ivicama; poslednja korpa skuplja i vrednosti preko gornje ivice (p98) */
  function histogram(list, key = 'p', bins = 24) {
    const vals = list.map((l) => (typeof key === 'function' ? key(l) : l[key])).filter((v) => v != null && isFinite(v)).sort((a, b) => a - b);
    if (!vals.length) return [];
    const lo0 = vals[0], hi0 = Math.max(percentile(vals, 0.98), lo0 + 1);
    const step = niceStep((hi0 - lo0) / bins);
    const lo = Math.floor(lo0 / step) * step;
    const n = Math.max(1, Math.min(bins, Math.ceil((hi0 - lo) / step)));
    const out = Array.from({ length: n }, (_, i) => ({ from: lo + i * step, to: lo + (i + 1) * step, n: 0 }));
    for (const v of vals) { let i = Math.floor((v - lo) / step); if (i >= n) i = n - 1; if (i < 0) i = 0; out[i].n++; }
    return out;
  }
  function medians(list) {
    const p = [], ppm = [], a = [];
    for (const l of list) { if (l.p != null) p.push(l.p); if (l.ppm != null) ppm.push(l.ppm); if (l.a != null) a.push(l.a); }
    return { p: median(p), ppm: ppm.length ? Math.round(median(ppm)) : null, a: median(a), n: list.length };
  }
  /* similar(l, 4): isti t+pt, isti grad (dopuna iz drugih gradova ako nema dovoljno), najbliži po ceni i m², bonus za istu opštinu/naselje */
  function similar(l, n = 4) {
    if (!l) return [];
    const score = (x) => {
      let s = Math.abs(Math.log((x.p || 1) / (l.p || 1))) + 0.8 * Math.abs(Math.log((x.a || 1) / (l.a || 1)));
      if (x.ms === l.ms) s -= 0.15;
      if (x.ns === l.ns) s -= 0.15;
      if (x.cs !== l.cs) s += 0.6;
      return s;
    };
    const pool = D.listings.filter((x) => x.s !== l.s && !x.syn && x.t === l.t && x.pt === l.pt);
    const same = pool.filter((x) => x.cs === l.cs);
    const src = same.length >= n ? same : pool;
    return src.map((x) => [score(x), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
  }
  return { refPpm, delta, deltaPct, inScope, reset, isSuburban: isSub, cityIndex, munIndex, histogram, medians, similar, median, MIN_N, SUBURBAN };
})();

/* ───────────────────────── mock: ulice, hod, istorija cene, komšiluk (sve deterministički iz hash(l.s); fizička svojstva stana iz l.ps || l.s — ponovljeni oglas istog stana deli ulicu, hod i komšiluk) ───────────────────────── */
const mock = (() => {
  const STREETS = {
    'beograd': ['Bulevar kralja Aleksandra', 'Cara Dušana', 'Vojvode Stepe', 'Požeška', 'Nemanjina', 'Kneza Miloša', 'Takovska', 'Ruzveltova', 'Ustanička', 'Jurija Gagarina', 'Omladinskih brigada', 'Bulevar Zorana Đinđića', 'Prvomajska', 'Dimitrija Tucovića', 'Kraljice Natalije', 'Gospodar Jevremova', 'Strahinjića Bana', 'Cvijićeva', 'Kumodraška', 'Tošin bunar', 'Bulevar Mihajla Pupina', 'Vojvode Mišića', 'Makenzijeva', 'Njegoševa', 'Svetogorska'],
    'beograd/stari-grad': ['Knez Mihailova', 'Cara Dušana', 'Strahinjića Bana', 'Gospodar Jevremova', 'Dobračina', 'Francuska', 'Skadarska', 'Dositejeva', 'Kralja Petra', 'Uzun Mirkova', 'Kosančićev venac', 'Brankova', 'Jovanova', 'Džordža Vašingtona', 'Dunavska'],
    'beograd/vracar': ['Makenzijeva', 'Njegoševa', 'Maksima Gorkog', 'Mileševska', 'Kursulina', 'Krunska', 'Baba Višnjina', 'Internacionalnih brigada', 'Vojvode Dragomira', 'Bulevar oslobođenja', 'Cara Nikolaja II', 'Kičevska', 'Hadži Melentijeva', 'Molerova', 'Sinđelićeva'],
    'beograd/savski-venac': ['Nemanjina', 'Kneza Miloša', 'Bulevar vojvode Mišića', 'Koste Glavinića', 'Užička', 'Topčiderska', 'Savska', 'Karađorđeva', 'Hercegovačka', 'Teodora Drajzera', 'Bulevar vojvode Putnika', 'Mostarska', 'Dinarska'],
    'beograd/novi-beograd': ['Jurija Gagarina', 'Omladinskih brigada', 'Bulevar Zorana Đinđića', 'Bulevar Mihajla Pupina', 'Tošin bunar', 'Dr Ivana Ribara', 'Gandijeva', 'Narodnih heroja', 'Bulevar umetnosti', 'Bulevar Arsenija Čarnojevića', 'Pariske komune', 'Nehruova', 'Ismeta Mujezinovića', 'Španskih boraca', 'Milutina Milankovića'],
    'beograd/zemun': ['Glavna', 'Prvomajska', 'Cara Dušana', 'Tošin bunar', 'Ugrinovačka', 'Pregrevica', 'Kej oslobođenja', 'Magistratski trg', 'Dobanovačka', 'Prve pruge', 'Zemunska', 'Bačka', 'Vojni put', 'Despota Stefana Lazarevića', 'Autoput'],
    'beograd/cukarica': ['Požeška', 'Blagoja Parovića', 'Kirovljeva', 'Trgovačka', 'Ace Joksimovića', 'Vodovodska', 'Obalskih radnika', 'Lazarevački drum', 'Ljubomira Stojanovića', 'Petra Lekovića', 'Jablanička', 'Radnička', 'Ratka Mitrovića', 'Beogradska', 'Vladimira Rolovića'],
    'beograd/rakovica': ['Patrisa Lumumbe', 'Pilota Mihaila Petrovića', 'Vidikovački venac', 'Kneza Višeslava', 'Borska', 'Miljakovački vinogradi', 'Ibarska', 'Lole Ribara', 'Varešćka', 'Vase Čarapića', 'Stevana Lukovića', 'Bogdana Žerajića', 'Kružni put'],
    'beograd/vozdovac': ['Vojvode Stepe', 'Kumodraška', 'Ustanička', 'Bulevar oslobođenja', 'Zaplanjska', 'Paunova', 'Braće Jerković', 'Jove Ilića', 'Darvinova', 'Crnotravska', 'Kružni put', 'Dimitrija Koturovića', 'Vojislava Ilića', 'Meštrovićeva', 'Bulevar JNA'],
    'beograd/zvezdara': ['Bulevar kralja Aleksandra', 'Ruzveltova', 'Dimitrija Tucovića', 'Čingrijina', 'Živka Davidovića', 'Mis Irbijeve', 'Milana Rakića', 'Vojislava Ilića', 'Ustanička', 'Mirijevski bulevar', 'Rade Končara', 'Ljubljanska', 'Batutova', 'Gospodara Vučića', 'Vjekoslava Kovača'],
    'beograd/palilula': ['Cvijićeva', 'Takovska', 'Bulevar despota Stefana', 'Stanoja Glavaša', 'Mije Kovačevića', 'Zrenjaninski put', 'Pančevački put', '27. marta', 'Dalmatinska', 'Jovanke Radaković', 'Višnjička', 'Ivankovačka', 'Ruzveltova', 'Čarlija Čaplina', 'Valjevska'],
    'beograd/surcin': ['Vojvođanska', 'Vinogradska', 'Bratstva i jedinstva', 'Braće Puhalović', 'Surčinska', 'Petrovčićka', 'Ugrinovačka'],
    'beograd/grocka': ['Bulevar oslobođenja', 'Hajduk Stankova', 'Smederevski put', 'Grocka obala', 'Kralja Petra Prvog', 'Zelena', 'Vinčanska'],
    'beograd/obrenovac': ['Vojvode Mišića', 'Miloša Obrenovića', 'Kralja Aleksandra Prvog', 'Nemanjina', 'Karađorđeva', 'Cara Lazara', 'Kneza Mihaila'],
    'beograd/lazarevac': ['Karađorđeva', 'Vojvode Mišića', 'Dimitrija Tucovića', 'Branka Pešića', 'Dušana Petrovića Šaneta', 'Janka Stajčića', 'Hilandarska'],
    'beograd/mladenovac': ['Kralja Petra Prvog', 'Vojvode Putnika', 'Kraljice Marije', 'Janka Katića', 'Braće Baruh', 'Nikole Pašića', 'Kosmajska'],
    'beograd/sopot': ['Kosmajski trg', 'Milorada Mice Markovića', 'Kneza Miloša', 'Ljubivoja Gajića', 'Kosmajska'],
    'beograd/barajevo': ['Svetosavska', 'Miodraga Vukovića', 'Lipovačka', 'Beogradska', 'Vuka Karadžića'],
    'novi-sad': ['Bulevar oslobođenja', 'Bulevar cara Lazara', 'Narodnog fronta', 'Futoška', 'Dunavska', 'Zmaj Jovina', 'Železnička', 'Jevrejska', 'Maksima Gorkog', 'Stražilovska', 'Bulevar Jaše Tomića', 'Rumenačka', 'Hadži Ruvimova', 'Kisačka', 'Temerinska', 'Šafarikova', 'Laze Kostića', 'Miše Dimitrijevića', 'Cara Dušana', 'Braće Ribnikar', 'Vojvode Šupljikca', 'Bulevar kralja Petra I', 'Novosadskog sajma', 'Pap Pavla', 'Somborska', 'Fruškogorska', 'Sremska'],
    'nis': ['Obrenovićeva', 'Bulevar Nemanjića', 'Vožda Karađorđa', 'Dušanova', 'Nikole Pašića', 'Bulevar Zorana Đinđića', 'Vizantijski bulevar', 'Bulevar Medijana', 'Somborska', 'Dimitrija Tucovića', 'Cara Dušana', 'Episkopska', 'Kopitareva', 'Jadranska', 'Sinđelićev trg', 'Zetska', 'Pantelejska', 'Knjaževačka', 'Bulevar 12. februar', 'Hajduk Veljkova', 'Učitelj Tasina', 'Ratka Vukićevića', 'Trg kralja Aleksandra', 'Milojka Lešjanina', 'Čairska', 'Stevana Sremca'],
    'kragujevac': ['Kralja Petra I', 'Kralja Aleksandra I Karađorđevića', 'Lepenički bulevar', 'Bulevar kraljice Marije', 'Nikole Pašića', 'Daničićeva', 'Svetozara Markovića', 'Kneza Mihaila', 'Save Kovačevića', 'Zmaj Jovina', 'Vojvode Putnika', 'Dr Zorana Đinđića', 'Kralja Milana IV', 'Jovana Ristića', 'Radoja Domanovića', 'Branka Radičevića', 'Luja Pastera', 'Cara Lazara', 'Atinska', 'Vojislava Kalanovića', 'Milovana Glišića', '27. marta', 'Miloja Pavlovića', 'Crvenog krsta', 'Ilije Kolovića'],
    '*': ['Kralja Petra I', 'Karađorđeva', 'Cara Dušana', 'Vuka Karadžića', 'Svetog Save', 'Nemanjina', 'Kneza Miloša', 'Hajduk Veljkova', 'Vojvode Mišića', 'Dositejeva', 'Njegoševa', 'Braće Jugovića', 'Save Kovačevića', 'Jovana Cvijića', 'Železnička'],
  };
  const streetsFor = (l) => STREETS[l.cs + '/' + l.ms] || STREETS[l.cs] || STREETS['*'];
  /* street(l) → "Makenzijeva 41" (l.ad ako postoji) */
  /* l.ad se poštuje samo ako ulica zaista pripada opštini/gradu (izvorni podaci ponekad
     dodele „Makenzijevu“ Voždovcu ili „Gospodar Jevremovu“ Grockoj); za grad bez tabele
     ulica l.ad se prihvata bez provere. */
  const adStreet = (ad) => String(ad).replace(/\s+\d+[a-zA-Z]?(\/\d+)?\s*$/, '').trim();
  const adFits = (l) => {
    const tbl = STREETS[l.cs + '/' + l.ms] || STREETS[l.cs];
    return !tbl || tbl.includes(adStreet(l.ad));
  };
  function street(l) {
    if (!l) return '';
    if (l.ad && adFits(l)) return l.ad;
    const r = rng(hash((l.ps || l.s) + '#street'));
    return `${pick(r, streetsFor(l))} ${between(r, 1, 150)}`;
  }

  /* POI u genitivu („do …“) po gradu/opštini */
  const POIS = {
    'beograd/stari-grad': ['Kalemegdana', 'pijace Bajloni', 'Zelenog venca', 'Skadarlije', 'Trga republike', 'Studentskog parka', 'Dorćola'],
    'beograd/vracar': ['pijace Kalenić', 'Hrama Svetog Save', 'Slavije', 'Cvetnog trga', 'Karađorđevog parka', 'Tašmajdana'],
    'beograd/savski-venac': ['Topčiderskog parka', 'Hajd parka', 'pijace Senjak', 'Sajma', 'Savamale', 'stanice Prokop'],
    'beograd/novi-beograd': ['Ušća', 'Arene', 'pijace Blok 44', 'keja na Savi', 'Parka prijateljstva', 'bloka 70', 'Studentskog grada'],
    'beograd/zemun': ['Zemunskog keja', 'Gardoša', 'Zemunske pijace', 'parka Kalvarija', 'Gradskog parka', 'stanice Zemun'],
    'beograd/cukarica': ['Ade Ciganlije', 'pijace Banovo brdo', 'Košutnjaka', 'pijace Cerak', 'Čukaričke padine', 'Makiškog polja'],
    'beograd/rakovica': ['pijace Vidikovac', 'Košutnjaka', 'Miljakovačke šume', 'stanice Rakovica', 'Kanarevog brda'],
    'beograd/vozdovac': ['Banjice', 'Smederevske pijace', 'Autokomande', 'parka Šumice', 'Voždovačke pijace', 'parka Jajinci'],
    'beograd/zvezdara': ['Cvetkove pijace', 'Zvezdarske šume', 'stanice Vukov spomenik', 'Olimpa', 'pijace Đeram', 'Tašmajdana'],
    'beograd/palilula': ['Tašmajdana', 'Palilulske pijace', 'Botaničke bašte', 'Bogoslovije', 'stanice Pančevački most', 'Dunavskog keja'],
    'beograd/surcin': ['centra Surčina', 'Bojčinske šume', 'autobuske stanice'],
    'beograd/grocka': ['Dunavskog keja', 'centra Grocke', 'autobuske stanice'],
    'beograd/obrenovac': ['centra Obrenovca', 'Kolubare', 'Obrenovačke pijace'],
    'beograd/lazarevac': ['centra Lazarevca', 'gradske pijace', 'železničke stanice'],
    'beograd/mladenovac': ['centra Mladenovca', 'gradskog parka', 'železničke stanice'],
    'beograd/sopot': ['centra Sopota', 'Kosmaja', 'autobuske stanice'],
    'beograd/barajevo': ['centra Barajeva', 'Lipovičke šume', 'železničke stanice'],
    'beograd': ['Kalemegdana', 'Ade Ciganlije', 'Tašmajdana', 'Ušća', 'Košutnjaka', 'stanice Vukov spomenik'],
    'novi-sad/liman': ['Štranda', 'Limanske pijace', 'Limanskog parka', 'Spensa', 'keja'],
    'novi-sad/stari-grad-novi-sad': ['Trga slobode', 'Dunavskog parka', 'Riblje pijace', 'keja', 'Zmaj Jovine'],
    'novi-sad/grbavica': ['Futoške pijace', 'Spensa', 'Bulevara oslobođenja', 'Limanskog parka'],
    'novi-sad/podbara': ['Riblje pijace', 'Dunavskog parka', 'Almaške crkve', 'keja'],
    'novi-sad/petrovaradin': ['Petrovaradinske tvrđave', 'Štranda', 'keja', 'centra Petrovaradina'],
    'novi-sad/sremska-kamenica': ['Dunava', 'Fruške gore', 'centra Kamenice'],
    'novi-sad': ['Štranda', 'Dunavskog parka', 'Futoške pijace', 'Limanske pijace', 'Spensa', 'Trga slobode', 'Železničke stanice', 'Najlon pijace'],
    'nis/medijana': ['Trga kralja Milana', 'Tvrđave', 'Čaira', 'Kazandžijskog sokačeta', 'keja na Nišavi'],
    'nis/palilula-nis': ['pijace Palilula', 'Bulevara Nemanjića', 'keja na Nišavi', 'Čaira'],
    'nis/niska-banja': ['banjskog parka', 'centra Niške Banje', 'izvora'],
    'nis': ['Tvrđave', 'Čaira', 'Kazandžijskog sokačeta', 'keja na Nišavi', 'Trga kralja Milana', 'pijace Palilula', 'Gradskog polja'],
    'kragujevac': ['Velikog parka', 'Šumarica', 'Gradske pijace', 'Trga Radomira Putnika', 'Lepenice', 'Knjaževsko-srpskog teatra'],
    'subotica': ['Gradske kuće', 'Palićkog jezera', 'Gradske pijace', 'Dudove šume', 'korza'],
    'zlatibor': ['Kraljevog trga', 'jezera', 'Gold gondole', 'šetališta'],
    'vrnjacka-banja': ['Promenade', 'Vrnjačkog parka', 'Mosta ljubavi', 'izvora'],
    'kopaonik': ['centra Kopaonika', 'žičare', 'Pančićevog vrha'],
    'pancevo': ['Tamiškog keja', 'Gradskog parka', 'Zelene pijace', 'Narodne bašte'],
    'cacak': ['Gradskog trga', 'Zapadne Morave', 'Gradske pijace', 'parka Sunce'],
    'novi-pazar': ['Gradskog trga', 'Bedema', 'Gradske pijace', 'Raške'],
    'zrenjanin': ['Trga slobode', 'Begejskog keja', 'Gradske pijace', 'Karađorđevog parka'],
    'kraljevo': ['Gradskog trga', 'Ibra', 'Gradske pijace', 'Pljakinog šanca'],
    '*': ['centra grada', 'gradske pijace', 'gradskog parka', 'autobuske stanice', 'doma zdravlja', 'reke'],
  };
  const poisFor = (l) => POIS[l.cs + '/' + l.ms] || POIS[l.cs] || POIS['*'];
  /* walk(l) → {min:6, to:'pijace Vidikovac'} (3–14 min); `to` je u genitivu („do …“) */
  function walk(l) {
    if (!l) return null;
    const r = rng(hash((l.ps || l.s) + '#walk'));
    const to = pick(r, poisFor(l));
    return { min: between(r, 3, 14), to };
  }

  /* history(l) → 12 mesečnih tačaka [{m:'2025-11', p}] koje se završavaju na trenutnoj ceni; mali drift + najviše jedan skok */
  function history(l, months = 12) {
    if (!l || l.p == null) return [];
    const r = rng(hash(l.s + '#hist'));
    const unit = l.p >= 20000 ? 100 : l.p >= 2000 ? 10 : 5;
    const stepAt = r() < 0.55 ? between(r, 1, months - 2) : -1;     /* indeks posle kog se desio skok */
    const stepPct = (r() < 0.6 ? -1 : 1) * (0.03 + r() * 0.05);   /* −8…−3 % ili +3…+8 % */
    const drifts = Array.from({ length: months - 1 }, () => (r() - 0.55) * 0.012); /* mesečni drift ≈ −0,7…+0,5 % */
    const now = new Date(); const y = now.getFullYear(), m0 = now.getMonth();
    const out = new Array(months);
    let p = l.p;
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(y, m0 - (months - 1 - i), 1);
      const mm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      out[i] = { m: mm, p: i === months - 1 ? l.p : Math.max(unit, Math.round(p / unit) * unit) };
      if (i > 0) { p = p / (1 + drifts[i - 1]); if (i - 1 === stepAt) p = p / (1 + stepPct); }
    }
    return out;
  }

  const SCHOOLS = {
    'beograd': ['OŠ „Vuk Karadžić“', 'OŠ „Kralj Petar I“', 'OŠ „Sveti Sava“', 'OŠ „Vladislav Ribnikar“', 'OŠ „Josif Pančić“', 'OŠ „Ivo Andrić“', 'OŠ „Branko Radičević“', 'OŠ „Dositej Obradović“', 'OŠ „Filip Višnjić“', 'OŠ „Nikola Tesla“', 'OŠ „Đorđe Krstić“', 'OŠ „Stevan Sremac“', 'OŠ „Jovan Dučić“', 'OŠ „Drinka Pavlović“', 'OŠ „Kosta Abrašević“', 'OŠ „Ratko Mitrović“', 'OŠ „Svetozar Marković“', 'OŠ „Jovan Jovanović Zmaj“'],
    'novi-sad': ['OŠ „Đorđe Natošević“', 'OŠ „Jovan Popović“', 'OŠ „Petefi Šandor“', 'OŠ „Svetozar Marković Toza“', 'OŠ „Ivo Lola Ribar“', 'OŠ „Kosta Trifković“', 'OŠ „Žarko Zrenjanin“', 'OŠ „Prva vojvođanska brigada“', 'OŠ „Dositej Obradović“'],
    'nis': ['OŠ „Učitelj Tasa“', 'OŠ „Car Konstantin“', 'OŠ „Sveti Sava“', 'OŠ „Vožd Karađorđe“', 'OŠ „Čegar“', 'OŠ „Bubanjski heroji“', 'OŠ „Kole Rašić“', 'OŠ „Ratko Vukićević“'],
    'kragujevac': ['OŠ „Radoje Domanović“', 'OŠ „Svetozar Marković“', 'OŠ „Đura Jakšić“', 'OŠ „Mirko Jovanović“', 'OŠ „Vuk Stefanović Karadžić“', 'OŠ „Treći kragujevački bataljon“'],
    '*': ['OŠ „Vuk Karadžić“', 'OŠ „Sveti Sava“', 'OŠ „Dositej Obradović“', 'OŠ „Branko Radičević“', 'OŠ „Jovan Jovanović Zmaj“', 'OŠ „Nikola Tesla“', 'OŠ „Karađorđe“'],
  };
  const KINDERGARTENS = ['Vrtić „Zvončica“', 'Vrtić „Leptirić“', 'Vrtić „Pčelica“', 'Vrtić „Sunce“', 'Vrtić „Bambi“', 'Vrtić „Zvezdica“', 'Vrtić „Kolibri“', 'Vrtić „Lane“'];
  const SHOPS = ['Market na uglu', 'Supermarket', 'Pekara i market', 'Piljara i market', 'Prodavnica u zgradi'];
  const MARKETS = {
    'beograd/stari-grad': ['Pijaca Bajloni', 'Pijaca Zeleni venac'], 'beograd/vracar': ['Pijaca Kalenić'], 'beograd/savski-venac': ['Pijaca Senjak'],
    'beograd/novi-beograd': ['Pijaca Blok 44'], 'beograd/zemun': ['Zemunska pijaca'], 'beograd/cukarica': ['Pijaca Banovo brdo', 'Pijaca Cerak'],
    'beograd/rakovica': ['Pijaca Vidikovac'], 'beograd/vozdovac': ['Smederevska pijaca', 'Voždovačka pijaca'], 'beograd/zvezdara': ['Cvetkova pijaca', 'Pijaca Đeram'],
    'beograd/palilula': ['Palilulska pijaca'], 'beograd': ['Gradska pijaca'],
    'novi-sad/liman': ['Limanska pijaca'], 'novi-sad/stari-grad-novi-sad': ['Riblja pijaca'], 'novi-sad/podbara': ['Riblja pijaca'], 'novi-sad': ['Futoška pijaca', 'Najlon pijaca'],
    'nis': ['Pijaca Palilula', 'Pijaca Tvrđava'], 'kragujevac': ['Gradska pijaca'], '*': ['Gradska pijaca', 'Zelena pijaca'],
  };
  const PARKS = {
    'beograd/stari-grad': 'Kalemegdan', 'beograd/vracar': 'Karađorđev park', 'beograd/savski-venac': 'Topčiderski park', 'beograd/novi-beograd': 'Park prijateljstva',
    'beograd/zemun': 'Gradski park Zemun', 'beograd/cukarica': 'Ada Ciganlija', 'beograd/rakovica': 'Miljakovačka šuma', 'beograd/vozdovac': 'Park Šumice',
    'beograd/zvezdara': 'Zvezdarska šuma', 'beograd/palilula': 'Tašmajdan', 'novi-sad/liman': 'Limanski park', 'novi-sad': 'Dunavski park',
    'nis': 'Park Čair', 'kragujevac': 'Veliki park', 'subotica': 'Dudova šuma', 'pancevo': 'Narodna bašta', '*': 'Gradski park',
  };
  const TRANSPORT = {
    'beograd': [['Autobus', '16'], ['Autobus', '23'], ['Autobus', '26'], ['Autobus', '31'], ['Autobus', '33'], ['Autobus', '37'], ['Autobus', '48'], ['Autobus', '52'], ['Autobus', '58'], ['Autobus', '65'], ['Autobus', '74'], ['Autobus', '83'], ['Autobus', '95'], ['Tramvaj', '2'], ['Tramvaj', '3'], ['Tramvaj', '7'], ['Tramvaj', '9'], ['Tramvaj', '12'], ['Tramvaj', '14'], ['Trolejbus', '19'], ['Trolejbus', '21'], ['Trolejbus', '22'], ['Trolejbus', '28'], ['Trolejbus', '29'], ['Trolejbus', '40'], ['Trolejbus', '41']],
    'novi-sad': [['Autobus', '1'], ['Autobus', '2'], ['Autobus', '3'], ['Autobus', '4'], ['Autobus', '7'], ['Autobus', '8'], ['Autobus', '9'], ['Autobus', '11A'], ['Autobus', '12'], ['Autobus', '14']],
    'nis': [['Autobus', '1'], ['Autobus', '2'], ['Autobus', '3'], ['Autobus', '5'], ['Autobus', '10'], ['Autobus', '12'], ['Autobus', '34']],
    'kragujevac': [['Autobus', '1'], ['Autobus', '2'], ['Autobus', '3'], ['Autobus', '7'], ['Autobus', '13'], ['Autobus', '16'], ['Autobus', '24']],
    '*': [['Autobus', '1'], ['Autobus', '2'], ['Autobus', '3'], ['Autobus', '5'], ['Autobus', '8']],
    /* Beograd po opštinama: tramvaj/trolejbus samo tamo gde zaista saobraćaju; prigradske opštine samo autobus */
    'beograd/stari-grad': [['Tramvaj', '2'], ['Tramvaj', '5'], ['Tramvaj', '10'], ['Trolejbus', '28'], ['Trolejbus', '41'], ['Autobus', '26'], ['Autobus', '31'], ['Autobus', '37'], ['Autobus', '58']],
    'beograd/vracar': [['Trolejbus', '19'], ['Trolejbus', '21'], ['Trolejbus', '22'], ['Trolejbus', '29'], ['Trolejbus', '40'], ['Trolejbus', '41'], ['Autobus', '31'], ['Autobus', '33'], ['Autobus', '39']],
    'beograd/savski-venac': [['Tramvaj', '2'], ['Tramvaj', '3'], ['Tramvaj', '9'], ['Tramvaj', '12'], ['Trolejbus', '40'], ['Trolejbus', '41'], ['Autobus', '23'], ['Autobus', '37'], ['Autobus', '52'], ['Autobus', '53']],
    'beograd/novi-beograd': [['Tramvaj', '7'], ['Tramvaj', '9'], ['Tramvaj', '11'], ['Tramvaj', '13'], ['Autobus', '16'], ['Autobus', '65'], ['Autobus', '67'], ['Autobus', '68'], ['Autobus', '71'], ['Autobus', '75'], ['Autobus', '95']],
    'beograd/zemun': [['Autobus', '15'], ['Autobus', '17'], ['Autobus', '18'], ['Autobus', '45'], ['Autobus', '83'], ['Autobus', '84'], ['Autobus', '704'], ['Autobus', '706']],
    'beograd/cukarica': [['Tramvaj', '12'], ['Tramvaj', '13'], ['Autobus', '23'], ['Autobus', '37'], ['Autobus', '50'], ['Autobus', '51'], ['Autobus', '53'], ['Autobus', '56'], ['Autobus', '88'], ['Autobus', '89']],
    'beograd/rakovica': [['Tramvaj', '3'], ['Autobus', '37'], ['Autobus', '47'], ['Autobus', '48'], ['Autobus', '59'], ['Autobus', '94'], ['Autobus', '504']],
    'beograd/vozdovac': [['Tramvaj', '9'], ['Tramvaj', '10'], ['Tramvaj', '14'], ['Trolejbus', '40'], ['Trolejbus', '41'], ['Autobus', '25'], ['Autobus', '26'], ['Autobus', '33'], ['Autobus', '39'], ['Autobus', '47'], ['Autobus', '48']],
    'beograd/zvezdara': [['Tramvaj', '5'], ['Tramvaj', '6'], ['Tramvaj', '7'], ['Trolejbus', '19'], ['Trolejbus', '21'], ['Trolejbus', '22'], ['Trolejbus', '28'], ['Trolejbus', '29'], ['Autobus', '20'], ['Autobus', '25'], ['Autobus', '65']],
    'beograd/palilula': [['Tramvaj', '2'], ['Tramvaj', '5'], ['Tramvaj', '6'], ['Tramvaj', '14'], ['Autobus', '16'], ['Autobus', '24'], ['Autobus', '26'], ['Autobus', '32E'], ['Autobus', '35'], ['Autobus', '43'], ['Autobus', '95'], ['Autobus', '105']],
    'beograd/surcin': [['Autobus', '601'], ['Autobus', '605'], ['Autobus', '606'], ['Autobus', '607']],
    'beograd/grocka': [['Autobus', '302'], ['Autobus', '307'], ['Autobus', '308'], ['Autobus', '309']],
    'beograd/obrenovac': [['Autobus', '551'], ['Autobus', '553'], ['Autobus', '860']],
    'beograd/lazarevac': [['Autobus', '860'], ['Autobus', '861']],
    'beograd/mladenovac': [['Autobus', '470'], ['Autobus', '471']],
    'beograd/sopot': [['Autobus', '491'], ['Autobus', '492']],
    'beograd/barajevo': [['Autobus', '502'], ['Autobus', '503']],
  };
  const byKey = (tbl, l) => tbl[l.cs + '/' + l.ms] || tbl[l.cs] || tbl['*'];

  /* vrsta kraja → šabloni za „Kakav je kraj“ */
  const KIND_BG = { 'stari-grad': 'centar', 'vracar': 'centar', 'savski-venac': 'centar', 'novi-beograd': 'blokovi', 'cukarica': 'brdo', 'rakovica': 'brdo', 'vozdovac': 'brdo', 'zemun': 'stari', 'zvezdara': 'stari', 'palilula': 'stari' };
  const RESORTS = new Set(['zlatibor', 'kopaonik', 'vrnjacka-banja']);
  const kindOf = (l) => {
    if (RESORTS.has(l.cs)) return 'odmor';
    if (l.cs === 'beograd') return KIND_BG[l.ms] || 'prigradski';
    if (/^(centar|stari-grad|liman|grbavica|medijana|podbara)/.test(l.ms || '')) return 'centar-grad';
    return 'mirno';
  };
  const NOTES = {
    'centar': [
      '{n} je kraj u kome se sve radi peške: pijaca, kafane i stanice prevoza su na par minuta, a zgrade su uglavnom starije, sa visokim plafonima. Uveče je živo, pa parking treba planirati.',
      'Sam centar, ali sa mirnim ulicama iza bulevara. {pijaca} je tu za svakodnevnu kupovinu, a {park} za šetnju; komšiluk je mešavina starih stanara i mlađih porodica.',
      'Kraj sa karakterom: stare fasade, pekare koje rade od ranog jutra i tramvaj na uglu. Buke ima koliko i u svakom centru, ali se do svega stiže bez auta.',
    ],
    'blokovi': [
      'Blokovi su široki i zeleni, sa puno mesta za decu i parkiranje. Zgrade su solidne, komšiluk miran, a do centra se stiže za dvadesetak minuta preko mosta.',
      '{n} ima sve što blokovi obećavaju: ravne ulice za bicikl, kej na pet minuta i prodavnice u prizemljima. Uveče je tiho, vikendom živo na keju.',
    ],
    'brdo': [
      '{n} je mirno naselje na brdu, sa puno zelenila i porodica sa decom. Ulice su tihe, a do grada vode autobusi koji idu često; vikendom je {park} na korak.',
      'Kraj za one koji vole mir: zgrade srednje visine, dvorišta i drveće, {pijaca} na deset minuta hoda. Do centra se putuje, ali se ovde zato lepo spava.',
    ],
    'stari': [
      'Stari kraj sa svojim ritmom: pekara i piljara na uglu, komšije koje se znaju po imenu. Zgrade su mešavina starih i novih, a {pijaca} je tu za svakodnevnu kupovinu.',
      '{n} je deo {m_gen} koji se menja polako: pored starih kuća niču nove zgrade, ali su ulice i dalje mirne. Prevoz je dobar, škola i vrtić su blizu.',
    ],
    'prigradski': [
      '{m} ima tempo manjeg mesta: kuće sa dvorištima, široke ulice i tišina. Do centra Beograda se putuje, ali se ovde zato lakše diše.',
      'Kraj u kome se živi sporije: komšije se pozdravljaju, deca su na ulici, a {pijaca} i škola su na par minuta. Auto je skoro obavezan.',
    ],
    'centar-grad': [
      'Sam centar {c_loc}: sve je peške, od pijace do kafića na korzu. Kraj je živ danju, a uveče tiši nego što se očekuje.',
      '{n} je deo grada gde se do svega stiže za deset minuta hoda, a {park} je mesto za nedeljno popodne. Zgrade su starije, ali održavane.',
    ],
    'mirno': [
      '{n} je miran deo grada, gde se do svega stiže za desetak minuta. Komšiluk je porodičan, a zelenila ima dovoljno.',
      'Tiho naselje sa kućama i manjim zgradama, bez gužve i sa dovoljno parkinga. Do centra {c_loc} vodi autobus, a peške je prijatna šetnja.',
    ],
    'odmor': [
      '{n} je kraj za odmor i miran život: čist vazduh, šetnja i tišina, uz sezonsku živost kad stignu gosti.',
      'Mesto gde se dolazi da se uspori: {park} i šetalište su tu, restorani rade sezonski, a zimi je najtiše.',
    ],
  };
  /* genitiv imena grada („centar Beograda“) */
  const CITY_GEN = { beograd: 'Beograda', 'novi-sad': 'Novog Sada', nis: 'Niša', kragujevac: 'Kragujevca', subotica: 'Subotice', pancevo: 'Pančeva', cacak: 'Čačka', 'novi-pazar': 'Novog Pazara', zrenjanin: 'Zrenjanina', kraljevo: 'Kraljeva',
    leskovac: 'Leskovca', krusevac: 'Kruševca', smederevo: 'Smedereva', sabac: 'Šapca', valjevo: 'Valjeva', uzice: 'Užica', 'sremska-mitrovica': 'Sremske Mitrovice', vranje: 'Vranja', loznica: 'Loznice', sombor: 'Sombora',
    pozarevac: 'Požarevca', jagodina: 'Jagodine', kikinda: 'Kikinde', zajecar: 'Zaječara', paracin: 'Paraćina', pirot: 'Pirota', ruma: 'Rume', vrsac: 'Vršca', arandjelovac: 'Aranđelovca', prokuplje: 'Prokuplja', bor: 'Bora',
    zlatibor: 'Zlatibora', 'vrnjacka-banja': 'Vrnjačke Banje', kopaonik: 'Kopaonika' };
  const cityGen = (cs) => CITY_GEN[cs] || ((find.city(cs) || {}).n || cs);
  const munGen = (m) => (m ? (m.endsWith('a') ? m.slice(0, -1) + 'e' : m.endsWith('e') || m.endsWith('o') ? m.slice(0, -1) + 'a' : m + 'a') : '');
  /* hood(l) → {transport:[{type,line,stop,min}], pijaca:{name,min}, skola:{name,min}, vrtic:{name,min}, park:{name,min}, prodavnica:{name,min}, note, kind} */
  function hood(l) {
    if (!l) return null;
    const r = rng(hash((l.ps || l.s) + '#hood'));
    const lines = byKey(TRANSPORT, l).slice();
    const nT = between(r, 2, 3);
    const transport = [];
    const stops = [l.n || l.m, street(l).replace(/\s\d+$/, '')].filter(Boolean);
    for (let i = 0; i < nT && lines.length; i++) {
      const idx = Math.floor(r() * lines.length); const [type, line] = lines.splice(idx, 1)[0];
      transport.push({ type, line, stop: pick(r, stops), min: between(r, 2, 8) });
    }
    const pijaca = { name: pick(r, byKey(MARKETS, l)), min: between(r, 4, 14) };
    const skola = { name: pick(r, byKey(SCHOOLS, l)), min: between(r, 3, 12) };
    const vrtic = { name: pick(r, KINDERGARTENS), min: between(r, 3, 10) };
    const park = { name: byKey(PARKS, l), min: between(r, 4, 15) };
    const prodavnica = { name: pick(r, SHOPS), min: between(r, 1, 6) };
    const kind = kindOf(l);
    const tpl = pick(r, NOTES[kind]);
    const note = tpl.replace(/\{n\}/g, l.n || l.m || l.c).replace(/\{m\}/g, l.m || l.c).replace(/\{m_gen\}/g, munGen(l.m)).replace(/\{c\}/g, l.c)
      .replace(/\{c_loc\}/g, cityGen(l.cs)).replace(/\{pijaca\}/g, pijaca.name).replace(/\{park\}/g, park.name);
    return { transport, pijaca, skola, vrtic, park, prodavnica, note, kind };
  }
  return { street, walk, history, hood, cityGen };
})();

/* ───────────────────────── store (localStorage 'kv.*' + fallback u memoriji) ───────────────────────── */
const store = (() => {
  const PREFIX = 'kv.';
  const mem = {};
  const ls = () => { try { return typeof localStorage !== 'undefined' && localStorage ? localStorage : null; } catch (e) { return null; } };
  const read = (k, fb) => { try { const s = ls(); const raw = s ? s.getItem(PREFIX + k) : mem[k]; return raw == null ? fb : JSON.parse(raw); } catch (e) { return fb; } };
  const write = (k, v) => { const raw = JSON.stringify(v); mem[k] = raw; try { const s = ls(); if (s) s.setItem(PREFIX + k, raw); } catch (e) { /* kvota / privatni režim */ } };
  const subs = new Set();
  const S = {
    favs: new Set(read('favs', [])),
    compare: read('compare', []).slice(0, 4),
    recent: read('recent', []).slice(0, 12),
    searches: read('searches', []),
    notes: read('notes', {}) || {},
    COMPARE_MAX: 4, RECENT_MAX: 12,
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    emit(what) { for (const fn of Array.from(subs)) { try { fn(what, S); } catch (e) { /* pretplatnik ne sme da sruši ostale */ } } },
    /* ♡ */
    isFav: (s) => S.favs.has(s),
    toggleFav(s) { const on = !S.favs.has(s); if (on) S.favs.add(s); else S.favs.delete(s); write('favs', Array.from(S.favs)); S.emit('favs'); return on; },
    /* Uporedi (max 4) */
    inCompare: (s) => S.compare.includes(s),
    toggleCompare(s) {
      const i = S.compare.indexOf(s);
      if (i >= 0) S.compare.splice(i, 1);
      else if (S.compare.length >= S.COMPARE_MAX) { toast(`Možete uporediti najviše ${S.COMPARE_MAX} oglasa`); return false; }
      else S.compare.push(s);
      write('compare', S.compare); S.emit('compare'); return i < 0;
    },
    clearCompare() { S.compare.length = 0; write('compare', S.compare); S.emit('compare'); },
    /* nedavno pogledano (najnovije prvo) */
    pushRecent(s) { const i = S.recent.indexOf(s); if (i >= 0) S.recent.splice(i, 1); S.recent.unshift(s); S.recent.length = Math.min(S.recent.length, S.RECENT_MAX); write('recent', S.recent); S.emit('recent'); },
    /* sačuvane pretrage */
    /* saveSearch(name, params, {freq:'odmah'|'dnevno'|'nedeljno'|'nikad', n}) — učestalost obaveštenja i broj rezultata u trenutku čuvanja */
    saveSearch(name, params, o = {}) { const id = 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); const it = { id, name: String(name || 'Pretraga'), params: params || {}, created: new Date().toISOString() }; if (o && o.freq) it.freq = String(o.freq); if (o && o.n != null && isFinite(+o.n)) it.n = +o.n; S.searches.unshift(it); write('searches', S.searches); S.emit('searches'); return it; },
    removeSearch(id) { const i = S.searches.findIndex((x) => x.id === id); if (i >= 0) S.searches.splice(i, 1); write('searches', S.searches); S.emit('searches'); },
    /* beleške uz oglas */
    getNote: (s) => S.notes[s] || '',
    setNote(s, text) { if (text && String(text).trim()) S.notes[s] = String(text); else delete S.notes[s]; write('notes', S.notes); S.emit('notes'); },
    /* tema ('light'|'dark'|null = sistemska) */
    getTheme: () => read('theme', null),
    setTheme(t) { write('theme', t || null); S.emit('theme'); },
    /* interno */
    _persisted: () => !!ls(),
    _save(k) { write(k, k === 'favs' ? Array.from(S.favs) : S[k]); S.emit(k); },
  };
  return S;
})();

/* ───────────────────────── ruter + filteri ───────────────────────── */
const FILTER_DEFAULTS = Object.freeze({
  t: 'prodaja', pt: [], c: '', m: [], n: [], pmin: '', pmax: '', amin: '', amax: '', ro: [], flmin: '', flmax: '', notLast: false,
  ymin: '', ymax: '', co: [], he: [], fu: [], reg: false, newbuild: false, promo: false, am: [], agency: '', advertiser: '', q: '', deltaMax: '',
  sort: 'rel', view: 'grid', page: 1,
});
const LIST_KEYS = ['pt', 'm', 'n', 'ro', 'co', 'he', 'fu', 'am'];
const NUM_KEYS = ['pmin', 'pmax', 'amin', 'amax', 'flmin', 'flmax', 'ymin', 'ymax', 'deltaMax'];
const BOOL_KEYS = ['notLast', 'reg', 'newbuild', 'promo'];
const STR_KEYS = ['t', 'c', 'agency', 'advertiser', 'q', 'sort', 'view'];

function parseHash(h) {
  const raw = String(h != null ? h : (typeof location !== 'undefined' && location.hash) || '').replace(/^#/, '');
  const i = raw.indexOf('?');
  const path = i >= 0 ? raw.slice(0, i) : raw;
  const q = new URLSearchParams(i >= 0 ? raw.slice(i + 1) : '');
  return { path: path || '/', q };
}
function buildHash(path, params) {
  const q = new URLSearchParams();
  if (params) for (const k of Object.keys(params)) {
    const v = params[k];
    if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
    q.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v));
  }
  const s = q.toString().replace(/%2C/g, ',');   /* zapete ostaju čitljive; '+' mora ostati %2B (URLSearchParams '+' = razmak) */
  return '#' + (path || '/') + (s ? '?' + s : '');
}
const routeSubs = new Set();
function notifyRoute(opts) { const r = parseHash(); for (const fn of Array.from(routeSubs)) { try { fn(r, opts); } catch (e) { console.error(e); } } return routeSubs.size; }
/* setHash(path, params, replace): replace=true → history.replaceState (bez skrola, bez 'hashchange'), obaveštava router.onChange pretplatnike */
function setHash(path, params, replace) {
  const h = buildHash(path, params);
  if (typeof location === 'undefined') return h;
  if (replace) {
    if (typeof history !== 'undefined' && history.replaceState) history.replaceState(null, '', h); else location.hash = h;
    if (!notifyRoute({ replace: true }) && typeof render === 'function') render();   /* stari app.js nema pretplatu */
  } else if (location.hash !== h) location.hash = h;
  return h;
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('hashchange', () => notifyRoute({ replace: false }));
const router = {
  parseHash, setHash, buildHash,
  href: (path, params) => buildHash(path, params),
  onChange(fn) { routeSubs.add(fn); return () => routeSubs.delete(fn); },
  current: () => parseHash(),
};

/* filteri ⇄ URL parametri (inverzne funkcije; podrazumevane vrednosti se izostavljaju) */
function filtersToParams(f) {
  f = f || FILTER_DEFAULTS;
  const out = {};
  for (const k of STR_KEYS) { const v = f[k] == null ? '' : String(f[k]); if (v !== '' && v !== FILTER_DEFAULTS[k]) out[k] = v; }
  for (const k of LIST_KEYS) { const v = f[k]; if (Array.isArray(v) && v.length) out[k] = v.map(String); else if (typeof v === 'string' && v) out[k] = [v]; }
  for (const k of NUM_KEYS) { const v = f[k]; if (v !== '' && v != null && isFinite(+v)) out[k] = String(+v); }
  for (const k of BOOL_KEYS) if (f[k]) out[k] = true;
  if (f.page && +f.page > 1) out.page = String(+f.page);
  return out;
}
const parseRo = (v) => (/^\d+(\.\d+)?\+$/.test(v) ? v : isFinite(+v) ? +v : null);
const PAGE_SORT = /^(total|monthly|rata|pair|near-[a-z0-9-]{1,40})$/;
function paramsToFilters(q) {
  if (!(q instanceof URLSearchParams)) q = new URLSearchParams(q || '');
  const f = { ...FILTER_DEFAULTS };
  for (const k of LIST_KEYS) f[k] = [];
  const list = (k) => (q.get(k) || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const k of STR_KEYS) if (q.has(k) && q.get(k) !== '') f[k] = q.get(k);
  if (f.t !== 'prodaja' && f.t !== 'izdavanje') f.t = 'prodaja';
  /* sortovi stranice rezultata (troškovi, rata, blizina mestima) ostaju u filterima; applyFilters za njih koristi 'rel', stranica sortira sama */
  if (!SORTS.some((s) => s.v === f.sort) && !PAGE_SORT.test(String(f.sort))) f.sort = 'rel';
  for (const k of LIST_KEYS) f[k] = list(k);
  f.ro = f.ro.map(parseRo).filter((x) => x != null);
  for (const k of NUM_KEYS) { const v = q.get(k); f[k] = v != null && v !== '' && isFinite(+v) ? +v : ''; }
  for (const k of BOOL_KEYS) f[k] = ['1', 'true', ''].includes(q.get(k)) && q.has(k);
  f.page = Math.max(1, Math.floor(+q.get('page')) || 1);
  return f;
}

/* pretraga */
const PROMO_RANK = { PREMIUM: 3, TOP: 2, ISTAKNUT: 1, NONE: 0 };
const promoRank = (l) => PROMO_RANK[l.pr] || 0;
let searchIdx = null;
const searchText = (l) => {
  if (!searchIdx) searchIdx = new Map();
  let s = searchIdx.get(l.s);
  if (s == null) { s = fmt.fold([l.ti, l.n, l.m, l.c, l.r, l.ad, l.ag].filter(Boolean).join(' ')); searchIdx.set(l.s, s); }
  return s;
};
const SORT_FN = {
  'rel': (a, b) => promoRank(b) - promoRank(a) || a.dz - b.dz || b.v - a.v,
  'new': (a, b) => a.dz - b.dz || b.v - a.v,
  'p-asc': (a, b) => a.p - b.p,
  'p-desc': (a, b) => b.p - a.p,
  'ppm-asc': (a, b) => (a.ppm == null ? 1e12 : a.ppm) - (b.ppm == null ? 1e12 : b.ppm),
  'ppm-desc': (a, b) => (b.ppm == null ? -1 : b.ppm) - (a.ppm == null ? -1 : a.ppm),
  'a-desc': (a, b) => (b.a || 0) - (a.a || 0),
  'pop': (a, b) => b.v - a.v,
  'delta': (a, b) => { const x = stats.deltaPct(a), y = stats.deltaPct(b); return (x == null ? 1e9 : x) - (y == null ? 1e9 : y) || a.dz - b.dz; },
};
function applyFilters(f) {
  f = { ...FILTER_DEFAULTS, ...(f || {}) };
  const ptSet = new Set(Array.isArray(f.pt) ? f.pt : f.pt ? [f.pt] : []);
  const mSet = new Set(f.m), nSet = new Set(f.n), coSet = new Set(f.co), heSet = new Set(f.he), fuSet = new Set(f.fu);
  const roEx = new Set(), roMin = []; for (const r of f.ro || []) { if (typeof r === 'string' && r.endsWith('+')) roMin.push(parseFloat(r)); else if (isFinite(+r)) roEx.add(+r); }
  const num = (v) => (v === '' || v == null ? null : +v);
  const pmin = num(f.pmin), pmax = num(f.pmax), amin = num(f.amin), amax = num(f.amax), flmin = num(f.flmin), flmax = num(f.flmax), ymin = num(f.ymin), ymax = num(f.ymax), deltaMax = num(f.deltaMax);
  const q = f.q ? fmt.fold(f.q).split(/\s+/).filter(Boolean) : [];
  const out = [];
  for (const l of D.listings) {
    if (l.t !== f.t) continue;
    if (ptSet.size && !ptSet.has(l.pt)) continue;
    if (f.c && l.cs !== f.c) continue;
    if (mSet.size && !mSet.has(l.ms)) continue;
    if (nSet.size && !nSet.has(l.ns)) continue;
    if (pmin != null && l.p < pmin) continue;
    if (pmax != null && l.p > pmax) continue;
    if (amin != null && (l.a == null || l.a < amin)) continue;
    if (amax != null && (l.a == null || l.a > amax)) continue;
    if ((roEx.size || roMin.length) && !(roEx.has(l.ro) || roMin.some((m) => l.ro != null && l.ro >= m))) continue;
    if (flmin != null && (l.fl == null || l.fl < flmin)) continue;
    if (flmax != null && (l.fl == null || l.fl > flmax)) continue;
    if (f.notLast && l.tf && l.fl === l.tf) continue;
    if (ymin != null && (l.y == null || l.y < ymin)) continue;
    if (ymax != null && (l.y == null || l.y > ymax)) continue;
    if (coSet.size && !coSet.has(l.co)) continue;
    if (heSet.size && !heSet.has(l.he)) continue;
    if (fuSet.size && !fuSet.has(l.fu)) continue;
    if (f.reg && !l.reg) continue;
    if (f.newbuild && l.co !== 'novogradnja' && l.co !== 'u-izgradnji') continue;
    if (f.promo && !(promoRank(l) > 0)) continue;   /* izdvojeni (PREMIUM/TOP/ISTAKNUT) */
    if (f.am && f.am.length && !f.am.every((k) => l.am.includes(k))) continue;
    if (f.agency && l.ags !== f.agency) continue;
    if (f.advertiser === 'agencija' && !l.ag) continue;
    if (f.advertiser === 'vlasnik' && l.ag) continue;
    if (deltaMax != null) { const d = stats.deltaPct(l); if (d == null || d > deltaMax) continue; }
    if (q.length) { const s = searchText(l); if (!q.every((w) => s.includes(w))) continue; }
    out.push(l);
  }
  return out.sort(SORT_FN[f.sort] || SORT_FN.rel);
}
/* broj aktivnih filtera (bez t, sort, view, page); svaki am se broji posebno */
function countActive(f) {
  if (!f) return 0;
  let n = 0;
  for (const k of ['pt', 'm', 'n', 'ro', 'co', 'he', 'fu']) if (Array.isArray(f[k]) ? f[k].length : f[k]) n++;
  for (const k of ['c', 'agency', 'advertiser', 'q']) if (f[k]) n++;
  for (const k of NUM_KEYS) if (f[k] !== '' && f[k] != null) n++;
  for (const k of BOOL_KEYS) if (f[k]) n++;
  n += Array.isArray(f.am) ? f.am.length : 0;
  return n;
}

/* ───────────────────────── kredit i troškovi ───────────────────────── */
/* mortgage(100000, 5, 20) → {monthly: 659.96, total, interest, n: 240, rate: 5} (standardni anuitet) */
function mortgage(principal, ratePct, years) {
  const P = Math.max(0, +principal || 0), n = Math.max(1, Math.round((+years || 0) * 12)), r = (+ratePct || 0) / 100 / 12;
  const monthly = r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
  const m = Math.round(monthly * 100) / 100, total = Math.round(m * n * 100) / 100;
  return { monthly: m, total, interest: Math.round((total - P) * 100) / 100, n, rate: +ratePct || 0 };
}
/* amortization(principal, ratePct, years) → [{m, balance, interest, principal}] po mesecu (za sparkline u kalkulatoru) */
function amortization(principal, ratePct, years) {
  const { monthly, n } = mortgage(principal, ratePct, years); const r = (+ratePct || 0) / 100 / 12;
  let bal = +principal || 0; const out = [];
  for (let i = 1; i <= n; i++) { const int = bal * r; const pr = Math.min(bal, monthly - int); bal = Math.max(0, bal - pr); out.push({ m: i, balance: Math.round(bal), interest: Math.round(int * 100) / 100, principal: Math.round(pr * 100) / 100 }); }
  return out;
}
/* javni beležnik — fiksna naknada po cenovnom razredu (≈ 0,2 %) */
const NOTARY_BANDS = [[30000, 120], [60000, 180], [100000, 250], [150000, 320], [250000, 420], [500000, 600], [Infinity, 900]];
const notaryFee = (price) => (NOTARY_BANDS.find(([lim]) => price < lim) || NOTARY_BANDS[NOTARY_BANDS.length - 1])[1];
/* purchaseCosts(120000, {newbuild:false, agency:true}) → {tax, taxRate, agencyFee, agencyRate, notary, total, totalWithPrice}
   porez na prenos apsolutnih prava 2,5 % ili PDV 10 % za novogradnju od investitora; provizija agencije 2 % (0 kod vlasnika) */
function purchaseCosts(price, opts = {}) {
  const P = Math.max(0, +price || 0);
  const taxRate = opts.newbuild ? 10 : 2.5;
  const agencyRate = opts.agency === false ? 0 : (opts.agencyRate != null ? +opts.agencyRate : 2);
  const tax = Math.round(P * taxRate / 100), agencyFee = Math.round(P * agencyRate / 100), notary = P ? notaryFee(P) : 0;
  const total = tax + agencyFee + notary;
  return { tax, taxRate, agencyFee, agencyRate, notary, total, totalWithPrice: P + total };
}
/* rentCosts(450, 450) → {deposit: 450, agencyFee: 225, firstMonth: 450, moveIn: 1125} */
function rentCosts(rent, dep) {
  const R = Math.max(0, +rent || 0); const deposit = dep != null && dep !== '' ? Math.max(0, +dep) : R;
  const agencyFee = Math.round(R * 0.5), firstMonth = R;
  return { deposit, agencyFee, firstMonth, moveIn: deposit + agencyFee + firstMonth };
}

/* ───────────────────────── toast ───────────────────────── */
/* toast('Sačuvano', {action:{label:'Pogledaj sačuvane', href:'#/sacuvani'}, ms:4000}) → element (null bez DOM-a) */
function toast(msg, opts = {}) {
  if (!HAS_DOM || !document.body) return null;
  let host = document.getElementById('toasts');
  if (!host) { host = el('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(host); }
  const t = el('div', { class: 'toast' + (opts.kind ? ' ' + opts.kind : ''), role: 'status' }, el('span', { class: 'toast-msg' }, msg),
    opts.action ? el('a', { class: 'toast-act', href: opts.action.href || '#', onclick: (e) => {
      /* akcija bez href-a (npr. „Poništi”) ne sme da menja adresu (href="#" bi vodio na početnu) */
      if (!opts.action.href) e.preventDefault();
      if (typeof opts.action.onClick === 'function') opts.action.onClick(e);
      t.classList.add('is-out'); setTimeout(() => t.remove(), 240);
    } }, opts.action.label) : null);
  host.appendChild(t);
  const ms = opts.ms || 4000;
  setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 240); }, ms);
  return t;
}

/* ───────────────────────── legacy aliasi (stare stranice js/pages/*.js pre prepisivanja) ───────────────────────── */
const nf = { format: (n) => fmtNum(Math.round(n)) };
const eur = (n) => fmt.price(n);
const m2 = (n) => fmt.m2(n);
const oglasa = (n) => plural(n, 'oglas', 'oglasa', 'oglasa');
/* stari home.js zove heroArt()/cityArt() (globali iz starog images.js) — prosleđuju na img.* u trenutku poziva */
function heroArt() { return typeof img !== 'undefined' && img.hero ? img.hero() : ''; }
function cityArt(seed) {
  if (typeof img === 'undefined') return '';
  const isArticle = !D.cities.some((c) => c.s === seed) && D.articles.some((a) => a.s === seed);
  const src = isArticle && img.article ? img.article(seed) : img.city(seed);
  return `<img src="${src}" alt="" width="400" height="220" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block">`;
}
const daysAgo = (d) => fmt.rel(d);
const roomLabel = (v) => (v == null ? null : fmt.rooms(v));
const floorLabel = (f, t) => (f == null ? null : (f === 0 ? 'Prizemlje' : f === -1 ? 'Suteren' : f + '.') + (t ? ' / ' + t : ''));
const LS = { fav: 'kv.favs', theme: 'kv.theme' };
const readFav = () => store.favs;
const favs = store.favs;
const saveFav = () => store._save('favs');
const DEFAULTS = {
  t: 'prodaja', pt: 'stan', loc: [], pmin: '', pmax: '', amin: '', amax: '',
  rooms: [], cond: [], heat: [], furn: [], am: [], reg: false, promo: false,
  sort: 'preporuceno', view: 'grid', page: 1,
};
let F = { ...DEFAULTS };
/* stari search.js čita f.loc/f.rooms/… — ne-enumerabilni getteri da ne pukne; novi kod ih ne koristi */
(function legacyGetters() {
  const orig = paramsToFilters;
  paramsToFilters = function (q) {
    const f = orig(q);
    Object.defineProperties(f, {
      loc: { get() { return [f.c, ...f.m].filter(Boolean); }, enumerable: false, configurable: true },
      rooms: { get() { return f.ro; }, enumerable: false, configurable: true },
      cond: { get() { return f.co; }, enumerable: false, configurable: true },
      heat: { get() { return f.he; }, enumerable: false, configurable: true },
      furn: { get() { return f.fu; }, enumerable: false, configurable: true },
    });
    return f;
  };
})();
Object.assign(router, { filtersToParams, paramsToFilters, applyFilters, countActive, FILTER_DEFAULTS, SORTS });
