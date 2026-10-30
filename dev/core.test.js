/* Kvadrat.rs — testovi za js/core.js. Pokretanje: node dev/core.test.js  (bez zavisnosti) */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');

/* ── minimalni DOM / localStorage ── */
function fakeDocument() {
  const mkNode = (tag) => {
    const n = {
      nodeType: 1, tagName: String(tag).toUpperCase(), children: [], attrs: {}, dataset: {}, listeners: {}, className: '', innerHTML: '', textContent: '', isConnected: true,
      appendChild(k) { n.children.push(k); return k; }, remove() {}, classList: { add() {}, remove() {} },
      setAttribute(k, v) { n.attrs[k] = v; }, getAttribute(k) { return n.attrs[k]; },
      addEventListener(t, fn) { (n.listeners[t] = n.listeners[t] || []).push(fn); },
    };
    return n;
  };
  const body = mkNode('body');
  const byId = {};
  return {
    body, createElement: (t) => mkNode(t), createTextNode: (s) => ({ nodeType: 3, textContent: s }),
    getElementById: (id) => byId[id] || null, querySelector: () => null, querySelectorAll: () => [],
  };
}
function memStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; }

function load({ storage, dom = true, hash = '' } = {}) {
  const ctx = { console, URLSearchParams, setTimeout, clearTimeout, Math, Date, JSON, Intl };
  ctx.window = { KV: null };
  ctx.globalThis = ctx;
  ctx.location = { hash };
  ctx.history = { replaceState: (a, b, h) => { ctx.location.hash = h; } };
  if (dom) ctx.document = fakeDocument();
  if (storage !== undefined) ctx.localStorage = storage;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8'), ctx, { filename: 'core.js' });
  /* top-level const/let/function u skripti žive u leksičkom opsegu konteksta — izvučemo ih eval-om */
  const names = ['D', '$', 'el', 'hash', 'rng', 'fmt', 'stats', 'mock', 'store', 'router', 'parseHash', 'setHash', 'FILTER_DEFAULTS', 'filtersToParams', 'paramsToFilters', 'applyFilters', 'countActive',
    'mortgage', 'amortization', 'purchaseCosts', 'rentCosts', 'toast', 'TYPES', 'ROOMS', 'COND', 'HEAT', 'FURN', 'ORIENT', 'AMEN', 'CITIES_MAJOR', 'SORTS', 'find', 'eur', 'm2', 'oglasa', 'daysAgo', 'nf', 'favs', 'DEFAULTS', 'F', 'typeOf', 'roomLabel', 'floorLabel', 'plural', 'heroArt', 'cityArt'];
  const api = vm.runInContext('({' + names.map((n) => `${JSON.stringify(n)}: ${n}`).join(',') + '})', ctx);
  api.ctx = ctx;
  return api;
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ok   ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.message ? e.message.split('\n')[0] : e)); } }
/* objekti iz vm konteksta imaju druge prototipe → poređenje preko JSON-a */
const eq = assert.strictEqual, deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);

const K = load({ storage: memStorage() });
const { D, fmt, stats, mock, store, router, mortgage, purchaseCosts, rentCosts } = K;
/* NBSP (U+00A0) između broja i jedinice; THIN = uski neprelomni razmak (U+202F) pre % */
const NBSP = ' ', THIN = ' ', MINUS = '−';

console.log('core.test.js — podaci: ' + D.listings.length + ' oglasa');

console.log('\nfmt');
test('num', () => { eq(fmt.num(125000), '125.000'); eq(fmt.num(1234567), '1.234.567'); eq(fmt.num(4.756, 2), '4,76'); eq(fmt.num(999), '999'); eq(fmt.num(-1500), MINUS + '1.500'); });
test('price', () => { eq(fmt.price(125000), '125.000' + NBSP + '€'); eq(fmt.price(125000, 'prodaja'), '125.000' + NBSP + '€'); eq(fmt.price(450, 'izdavanje'), '450' + NBSP + '€/mes'); eq(fmt.price(1299.6), '1.300' + NBSP + '€'); });
test('ppm', () => { eq(fmt.ppm(1850.4), '1.850' + NBSP + '€/m²'); eq(fmt.ppm(5519), '5.519' + NBSP + '€/m²'); eq(fmt.ppm(13.13), '13,1' + NBSP + '€/m²'); eq(fmt.ppm(13), '13' + NBSP + '€/m²'); eq(fmt.ppm(null), ''); });
test('m2 / land', () => { eq(fmt.m2(46), '46' + NBSP + 'm²'); eq(fmt.m2(46.5), '46,5' + NBSP + 'm²'); eq(fmt.m2(1200), '1.200' + NBSP + 'm²'); eq(fmt.land(650), '6,5 ari'); eq(fmt.land(100), '1 ar'); eq(fmt.land(300), '3 ara'); eq(fmt.land(12000), '1,2 ha'); });
test('pct', () => {
  eq(fmt.pct(9.66, { sign: true }), '+9,7' + THIN + '%'); eq(fmt.pct(-6.2, { sign: true }), MINUS + '6,2' + THIN + '%'); eq(fmt.pct(-6.2), MINUS + '6,2' + THIN + '%');
  eq(fmt.pct(0, { sign: true }), '±0,0' + THIN + '%'); eq(fmt.pct(0.04, { sign: true }), '±0,0' + THIN + '%'); eq(fmt.pct(9.66), '9,7' + THIN + '%'); eq(fmt.pct(12.345, { dec: 0 }), '12' + THIN + '%');
});
test('rel', () => { eq(fmt.rel(0), 'danas'); eq(fmt.rel(1), 'juče'); eq(fmt.rel(3), 'pre 3 dana'); eq(fmt.rel(7), 'pre nedelju dana'); eq(fmt.rel(14), 'pre 2 nedelje'); eq(fmt.rel(35), 'pre mesec dana'); eq(fmt.rel(90), 'pre 3 meseca'); eq(fmt.rel(150), 'pre 5 meseci'); eq(fmt.rel(400), 'pre godinu dana'); eq(fmt.rel(800), 'pre 2 godine'); });
test('floor', () => { eq(fmt.floor(2, 10), '2. od 10'); eq(fmt.floor(0), 'Prizemlje'); eq(fmt.floor(0, 6), 'Prizemlje od 6'); eq(fmt.floor(-1, 6), 'Suteren od 6'); eq(fmt.floor(3), '3.'); eq(fmt.floor(null, 5), ''); });
test('rooms', () => { eq(fmt.rooms(2), 'Dvosoban'); eq(fmt.rooms(0.5), 'Garsonjera'); eq(fmt.rooms(5), 'Petosoban i više'); eq(fmt.roomsN(2), '2'); eq(fmt.roomsN(1.5), '1,5'); eq(fmt.roomsN(5), '5+'); eq(fmt.roomsText(2), '2 sobe'); eq(fmt.roomsText(1.5), '1,5 sobe'); eq(fmt.roomsText(3.5), '3,5 sobe'); eq(fmt.roomsText(1), '1 soba'); eq(fmt.roomsText(5), '5+ soba'); });
test('plural / count / listings', () => { eq(fmt.listings(106), '106 oglasa'); eq(fmt.listings(1), '1 oglas'); eq(fmt.listings(3), '3 oglasa'); eq(fmt.listings(5), '5 oglasa'); eq(fmt.listings(21), '21 oglas'); eq(fmt.listings(11), '11 oglasa'); eq(fmt.count(2, 'agent', 'agenta', 'agenata'), '2 agenta'); });
test('year / month / fold', () => { eq(fmt.year(2025), '2025.'); eq(fmt.month('2025-11'), 'nov ’25'); eq(fmt.fold('Čačak Đeram Žarkovo Šabac Ćuprija'), 'cacak djeram zarkovo sabac cuprija'); });

console.log('\nstats');
test('refPpm obim: naselje → opština → prigradske → grad → region → null (nikad cela Srbija)', () => {
  const scopes = { nbhd: 0, mun: 0, sub: 0, city: 0, region: 0, none: 0 };
  for (const l of D.listings) {
    const r = stats.refPpm(l); assert(r, 'ref');
    if (r.scope == null) { eq(r.ppm, null); assert(['malo', 'tip'].includes(r.reason), r.reason); scopes.none++; continue; }
    assert(['nbhd', 'mun', 'sub', 'city', 'region'].includes(r.scope), r.scope); scopes[r.scope]++;
    assert(r.ppm > 0 && r.n >= 5, 'n>=5 za ' + r.scope);
    if (r.scope === 'nbhd') eq(r.label, l.n);
    if (r.scope === 'mun') { eq(r.label, l.m); const same = D.listings.filter((x) => x.t === l.t && x.pt === l.pt && x.ns === l.ns && x.ppm > 0); assert(same.length < 5, 'nbhd bi trebalo <5'); }
    if (r.scope === 'sub') { assert(stats.isSuburban(l), 'prigradski'); eq(r.label, 'prigradske opštine Beograda'); }
    if (r.scope === 'city') { eq(r.label, l.c); assert(!stats.isSuburban(l), 'prigradska opština ne ide u grad'); }
    if (r.scope === 'region') { assert(/^(manji gradovi — |turistička mesta)/.test(r.label), r.label); assert(r.n >= 6, 'region n>=6'); }
    if (l.pt === 'zemljiste' || l.pt === 'soba') assert(false, 'plac/soba bez Δ');
  }
  assert(scopes.mun > 0 && scopes.city > 0 && scopes.sub > 0 && scopes.region > 0 && scopes.none > 0, JSON.stringify(scopes));
  for (const l of D.listings.filter((x) => x.pt === 'zemljiste' || x.pt === 'soba')) { const r = stats.refPpm(l); eq(r.scope, null); eq(r.reason, 'tip'); eq(stats.delta(l).pct, null); }
  /* Vrčin (Grocka) se poredi sa prigradskim opštinama, ne sa gradskim Beogradom */
  const vr = D.listings.find((x) => x.ms === 'grocka' && x.t === 'prodaja' && x.pt === 'stan'); if (vr) assert(['nbhd', 'mun', 'sub', null].includes(stats.refPpm(vr).scope));
});
test('Δ: prosek po (t, pt, obim) bez sistemske pristrasnosti (nijedan obim izvan ±11 %)', () => {
  const g = {};
  for (const l of D.listings) { const d = stats.delta(l); if (d.pct == null) continue; const k = l.t + '|' + l.pt + '|' + d.scope; (g[k] = g[k] || []).push(d.pct); }
  for (const k of Object.keys(g)) { const avg = g[k].reduce((a, b) => a + b, 0) / g[k].length; assert(Math.abs(avg) <= 11, k + ' ' + avg.toFixed(1)); }
  assert(!Object.keys(g).some((k) => k.endsWith('|all')), 'bez obima all');
});
test('inScope prati obim reference', () => {
  const l = D.listings.find((x) => stats.refPpm(x).scope === 'region');
  const ref = stats.refPpm(l);
  const pool = D.listings.filter((x) => !x.syn && x.ppm > 0 && stats.inScope(x, l, ref)).map((x) => x.ppm);
  eq(pool.length, ref.n); const md = stats.median(pool); eq(md >= 100 ? Math.round(md) : Math.round(md * 100) / 100, ref.ppm);
});
test('refPpm = medijana grupe', () => {
  const l = D.listings.find((x) => x.cs === 'beograd' && x.t === 'prodaja' && x.pt === 'stan');
  const r = stats.refPpm(l);
  const key = { nbhd: 'ns', mun: 'ms', city: 'cs' }[r.scope];
  const vals = D.listings.filter((x) => x.t === l.t && x.pt === l.pt && (r.scope === 'all' || x[key] === l[key])).map((x) => x.ppm);
  eq(r.n, vals.length); eq(r.ppm, Math.round(stats.median(vals)));
});
test('delta sign + cache', () => {
  const l = D.listings[0]; const d = stats.delta(l); const r = stats.refPpm(l);
  eq(d.ppm, r.ppm); eq(d.label, r.label); eq(d.n, r.n); eq(d.pct, Math.round((l.ppm / r.ppm - 1) * 1000) / 10);
  assert(stats.delta(l) === d, 'keširano');
  const above = D.listings.find((x) => x.ppm > stats.refPpm(x).ppm); assert(stats.delta(above).pct > 0);
  const below = D.listings.find((x) => x.ppm < stats.refPpm(x).ppm); assert(stats.delta(below).pct < 0);
});
test('cityIndex', () => {
  const idx = stats.cityIndex(); assert(idx.length >= 10, 'bar 10 gradova');
  const bg = idx.find((x) => x.cs === 'beograd'); assert(bg && bg.ppm > 1000 && bg.n >= 100);
  for (const x of idx) { assert(x.change >= -1.5 && x.change <= 1.5, 'change'); assert(typeof x.change12 === 'number'); }
  assert(stats.cityIndex() === idx, 'keširano'); deq(idx.map((x) => x.change), stats.cityIndex().map((x) => x.change));
});
test('munIndex', () => { const m = stats.munIndex('beograd'); assert(m.length >= 10); assert(m.every((x) => x.ppm > 0 && x.n > 0)); assert(m[0].ppm >= m[m.length - 1].ppm); });
test('histogram', () => {
  const list = D.listings.filter((l) => l.t === 'prodaja' && l.pt === 'stan');
  const h = stats.histogram(list, 'p', 24); assert(h.length > 0 && h.length <= 24);
  eq(h.reduce((s, b) => s + b.n, 0), list.length, 'sve vrednosti su u korpama');
  for (let i = 1; i < h.length; i++) eq(h[i].from, h[i - 1].to);
  const step = h[0].to - h[0].from; assert(/^[125]$|^25$/.test(String(step).replace(/0+$/, '').replace('.', '')), 'lepa ivica: ' + step);
  deq(stats.histogram([], 'p'), []);
});
test('medians', () => { const m = stats.medians(D.listings.slice(0, 50)); assert(m.p > 0 && m.ppm > 0 && m.a > 0); eq(m.n, 50); eq(stats.median([3, 1, 2]), 2); eq(stats.median([4, 1, 3, 2]), 2.5); });
test('similar', () => {
  const l = D.listings.find((x) => x.cs === 'beograd' && x.t === 'prodaja' && x.pt === 'stan');
  const s = stats.similar(l, 4); eq(s.length, 4);
  for (const x of s) { assert(x.s !== l.s); eq(x.t, l.t); eq(x.pt, l.pt); eq(x.cs, l.cs); }
  const kop = D.listings.find((x) => x.cs === 'kopaonik'); const s2 = stats.similar(kop, 3); eq(s2.length, 3);
});

console.log('\nmock (determinizam)');
test('street', () => {
  const noAd = D.listings.find((l) => !l.ad);
  const bare = (ad) => ad.replace(/\s+\d+[a-zA-Z]?(\/\d+)?\s*$/, '');
  /* l.ad koji pripada opštini se poštuje (Knez Mihailova u Starom gradu) */
  const fits = D.listings.find((l) => l.ad && l.ms === 'stari-grad' && /^Knez Mihailova/.test(l.ad)) || D.listings.find((l) => l.ad && l.cs !== 'beograd' && !['novi-sad', 'nis', 'kragujevac'].includes(l.cs));
  assert(fits, 'postoji oglas sa validnim l.ad'); eq(mock.street(fits), fits.ad);
  /* l.ad iz pogrešnog dela grada se zamenjuje ulicom te opštine */
  const wrong = D.listings.filter((l) => l.ad && l.cs === 'beograd' && ['vozdovac', 'grocka', 'zemun'].includes(l.ms) && /^(Makenzijeva|Gospodar Jevremova|Knez Mihailova|Njegoševa)\b/.test(l.ad));
  for (const l of wrong) assert(mock.street(l) !== l.ad, l.ms + ': ' + l.ad);
  const reject = D.listings.filter((l) => l.ad && mock.street(l) !== l.ad).length; assert(reject < D.listings.filter((l) => l.ad).length, 'ne odbacuje sve');
  const s = mock.street(noAd); eq(mock.street(noAd), s); assert(/^.+ \d{1,3}$/.test(s), s);
  const n = +s.match(/(\d+)$/)[1]; assert(n >= 1 && n <= 150);
  const bg = D.listings.filter((l) => l.cs === 'beograd' && !l.ad).map(mock.street); assert(new Set(bg).size > 20, 'raznovrsno');
});
test('walk', () => {
  const l = D.listings.find((x) => x.ms === 'rakovica');
  const w = mock.walk(l); deq(mock.walk(l), w); assert(w.min >= 3 && w.min <= 14); assert(typeof w.to === 'string' && w.to.length > 3); deq(Object.keys(w).sort(), ['min', 'to']);
  const all = D.listings.map((x) => mock.walk(x)); assert(all.every((x) => x.min >= 3 && x.min <= 14 && x.to));
  const rak = D.listings.filter((x) => x.ms === 'rakovica').map((x) => mock.walk(x).to); assert(rak.some((t) => /Vidikovac|Košutnjak|Miljakov|Rakovica|Kanarev/.test(t)), rak.join(','));
});
test('history', () => {
  const l = D.listings.find((x) => x.t === 'prodaja' && x.pt === 'stan');
  const h = mock.history(l); eq(h.length, 12); deq(mock.history(l), h);
  eq(h[11].p, l.p, 'poslednja tačka = trenutna cena');
  for (const pt of h) { assert(/^\d{4}-\d{2}$/.test(pt.m)); assert(pt.p > l.p * 0.8 && pt.p < l.p * 1.25, 'realno odstupanje'); assert(pt.p % 100 === 0 || pt === h[11]); }
  for (let i = 1; i < h.length; i++) assert(h[i].m > h[i - 1].m, 'meseci rastu');
  let jumps = 0; for (let i = 1; i < h.length; i++) if (Math.abs(h[i].p / h[i - 1].p - 1) > 0.02) jumps++; assert(jumps <= 1, 'najviše jedan skok: ' + jumps);
  const r = D.listings.find((x) => x.t === 'izdavanje'); const hr = mock.history(r); eq(hr[11].p, r.p); assert(hr.every((x) => x.p > 0));
});
test('hood', () => {
  const l = D.listings.find((x) => x.ms === 'vracar');
  const h = mock.hood(l); deq(mock.hood(l), h);
  assert(h.transport.length >= 2 && h.transport.length <= 3);
  for (const t of h.transport) { assert(t.type && t.line && t.stop); assert(t.min >= 2 && t.min <= 8); }
  eq(h.pijaca.name, 'Pijaca Kalenić'); eq(h.park.name, 'Karađorđev park'); assert(/^OŠ „/.test(h.skola.name)); assert(/^Vrtić „/.test(h.vrtic.name));
  assert(h.note.length > 40 && h.note.length < 320, h.note); assert(!/\{/.test(h.note), 'bez neiskorišćenih placeholdera');
  for (const x of D.listings) { const hh = mock.hood(x); assert(hh.note && !/\{/.test(hh.note), x.s); assert(hh.pijaca.min >= 4 && hh.skola.min >= 3 && hh.park.min >= 4); }
  const kinds = new Set(D.listings.map((x) => mock.hood(x).kind)); assert(kinds.size >= 6, [...kinds].join(','));
  /* prigradske opštine i Zemun: samo autobus; Vračar bez tramvaja na Novom Beogradu itd. */
  for (const x of D.listings.filter((y) => y.cs === 'beograd' && ['mladenovac', 'lazarevac', 'obrenovac', 'sopot', 'barajevo', 'grocka', 'surcin', 'zemun'].includes(y.ms)))
    for (const t of mock.hood(x).transport) eq(t.type, 'Autobus', x.ms + ' ' + t.type + ' ' + t.line);
  for (const x of D.listings.filter((y) => y.ms === 'vracar')) for (const t of mock.hood(x).transport) assert(t.type !== 'Tramvaj', 'Vračar ' + t.line);
  assert(D.listings.filter((y) => y.ms === 'novi-beograd').some((x) => mock.hood(x).transport.some((t) => t.type === 'Tramvaj')), 'NBG ima tramvaj');
  eq(mock.cityGen('novi-sad'), 'Novog Sada'); eq(mock.cityGen('beograd'), 'Beograda');
});

console.log('\nrouter + filteri');
const { parseHash, setHash, FILTER_DEFAULTS, filtersToParams, paramsToFilters, applyFilters, countActive } = K;
test('parseHash', () => { const r = parseHash('#/pretraga?t=izdavanje&pt=stan,kuca'); eq(r.path, '/pretraga'); eq(r.q.get('t'), 'izdavanje'); eq(r.q.get('pt'), 'stan,kuca'); eq(parseHash('').path, '/'); eq(parseHash('#/').path, '/'); });
test('podrazumevano → prazni parametri', () => { deq(filtersToParams({ ...FILTER_DEFAULTS }), {}); deq(paramsToFilters(new URLSearchParams('')), { ...FILTER_DEFAULTS }); eq(countActive({ ...FILTER_DEFAULTS }), 0); });
test('round-trip filtersToParams ∘ paramsToFilters', () => {
  const f = { ...FILTER_DEFAULTS, t: 'izdavanje', pt: ['stan', 'kuca'], c: 'beograd', m: ['vracar', 'zvezdara'], n: ['cubura'], pmin: 300, pmax: 900, amin: 40, amax: 80, ro: [2, 2.5, '4+'], flmin: 1, flmax: 5, notLast: true,
    ymin: 1990, ymax: 2024, co: ['renovirano'], he: ['centralno', 'gas'], fu: ['namesten'], reg: true, newbuild: false, am: ['hasElevator', 'hasAc'], agency: 'dom-plus-nekretnine', advertiser: 'agencija', q: 'Čubura dvosoban', deltaMax: 5, sort: 'ppm-asc', view: 'list', page: 3 };
  const p = filtersToParams(f);
  const h = router.buildHash('/pretraga', p); const back = paramsToFilters(parseHash(h).q);
  deq(back, f);
  deq(filtersToParams(back), p);
  eq(countActive(f), 24);   /* 7 lista + 4 stringa + 9 brojeva + 2 bool + 2 am */
});
test('round-trip: brojevi kao stringovi, nepoznat sort', () => {
  const f = paramsToFilters(new URLSearchParams('pmin=50000&sort=xyz&t=nesto&page=0&ro=1.5,abc,3%2B&reg=1&notLast=true'));
  eq(f.pmin, 50000); eq(f.sort, 'rel'); eq(f.t, 'prodaja'); eq(f.page, 1); deq(f.ro, [1.5, '3+']); eq(f.reg, true); eq(f.notLast, true);
  deq(filtersToParams({ ...FILTER_DEFAULTS, pmin: '50000' }), { pmin: '50000' });
});
test('applyFilters: osnovno', () => {
  const all = applyFilters({ ...FILTER_DEFAULTS }); assert(all.every((l) => l.t === 'prodaja')); eq(all.length, D.listings.filter((l) => l.t === 'prodaja').length);
  const r = applyFilters({ ...FILTER_DEFAULTS, t: 'izdavanje', pt: ['stan'], c: 'beograd', pmin: 400, pmax: 800, ro: [2, '3+'], reg: true, am: ['hasElevator'] });
  assert(r.length > 0); for (const l of r) { eq(l.t, 'izdavanje'); eq(l.pt, 'stan'); eq(l.cs, 'beograd'); assert(l.p >= 400 && l.p <= 800); assert(l.ro === 2 || l.ro >= 3); assert(l.reg); assert(l.am.includes('hasElevator')); }
});
test('applyFilters: notLast, newbuild, advertiser, agency, q, deltaMax', () => {
  assert(applyFilters({ ...FILTER_DEFAULTS, notLast: true }).every((l) => !l.tf || l.fl !== l.tf));
  assert(applyFilters({ ...FILTER_DEFAULTS, newbuild: true }).every((l) => l.co === 'novogradnja' || l.co === 'u-izgradnji'));
  assert(applyFilters({ ...FILTER_DEFAULTS, advertiser: 'vlasnik' }).every((l) => !l.ag));
  assert(applyFilters({ ...FILTER_DEFAULTS, advertiser: 'agencija' }).every((l) => !!l.ag));
  const ag = D.agencies[0].s; const byAg = applyFilters({ ...FILTER_DEFAULTS, agency: ag }); assert(byAg.length > 0 && byAg.every((l) => l.ags === ag));
  const q = applyFilters({ ...FILTER_DEFAULTS, q: 'vracar' }); assert(q.length > 0 && q.every((l) => /vra[čc]ar/i.test(l.ti + ' ' + l.m + ' ' + l.n)));
  const ref = applyFilters({ ...FILTER_DEFAULTS, q: 'KV-1112899', t: 'izdavanje' }); eq(ref.length, 1);
  const dm = applyFilters({ ...FILTER_DEFAULTS, deltaMax: -5 }); assert(dm.length > 0 && dm.every((l) => stats.delta(l).pct <= -5));
});
test('applyFilters: sortiranja', () => {
  const rel = applyFilters({ ...FILTER_DEFAULTS, sort: 'rel' }); const rk = (l) => ({ PREMIUM: 3, TOP: 2, ISTAKNUT: 1 }[l.pr] || 0);
  for (let i = 1; i < rel.length; i++) assert(rk(rel[i - 1]) > rk(rel[i]) || (rk(rel[i - 1]) === rk(rel[i]) && rel[i - 1].dz <= rel[i].dz), 'rel');
  const chk = (sort, cmp) => { const r = applyFilters({ ...FILTER_DEFAULTS, sort }); for (let i = 1; i < r.length; i++) assert(cmp(r[i - 1], r[i]), sort); };
  chk('new', (a, b) => a.dz <= b.dz); chk('p-asc', (a, b) => a.p <= b.p); chk('p-desc', (a, b) => a.p >= b.p); chk('ppm-asc', (a, b) => a.ppm <= b.ppm); chk('ppm-desc', (a, b) => a.ppm >= b.ppm); chk('a-desc', (a, b) => (a.a || 0) >= (b.a || 0));
  const dv = (l) => (stats.delta(l).pct == null ? Infinity : stats.delta(l).pct);   /* bez Δ (malo podataka) idu na kraj */
  chk('delta', (a, b) => dv(a) <= dv(b));
});
test('promo filter, sortovi stranice, saveSearch {freq}', () => {
  const pr = applyFilters({ ...FILTER_DEFAULTS, promo: true }); assert(pr.length > 0 && pr.every((l) => ['PREMIUM', 'TOP', 'ISTAKNUT'].includes(l.pr)), 'promo');
  eq(paramsToFilters(new URLSearchParams('promo=1')).promo, true); deq(filtersToParams({ ...FILTER_DEFAULTS, promo: true }), { promo: true });
  eq(paramsToFilters(new URLSearchParams('sort=near-p1')).sort, 'near-p1'); eq(paramsToFilters(new URLSearchParams('sort=total')).sort, 'total'); eq(paramsToFilters(new URLSearchParams('sort=xyz')).sort, 'rel');
  const it = store.saveSearch('Test', { c: 'beograd' }, { freq: 'dnevno', n: 12 }); eq(it.freq, 'dnevno'); eq(it.n, 12); store.removeSearch(it.id);
});
test('applyFilters: brzina (660 × 200 poziva)', () => {
  const f = { ...FILTER_DEFAULTS, pt: ['stan'], c: 'beograd', pmin: 50000, q: 'stan', sort: 'delta' };
  const t0 = Date.now(); for (let i = 0; i < 200; i++) applyFilters(f); const dt = Date.now() - t0; assert(dt < 2000, dt + 'ms');
});
test('setHash / router.onChange (replace bez hashchange)', () => {
  const seen = []; const off = router.onChange((r, o) => seen.push([r.path, r.q.get('x'), o.replace]));
  const h = setHash('/pretraga', { x: 1, y: '', z: [], w: ['a', 'b'], b: true }, true);
  eq(h, '#/pretraga?x=1&w=a,b&b=1'); eq(router.buildHash('/p', { ro: ['4+'], q: 'a b' }), '#/p?ro=4%2B&q=a+b'); eq(K.ctx.location.hash, h); deq(seen, [['/pretraga', '1', true]]); off();
  setHash('/oglas', { s: 'abc' }); eq(K.ctx.location.hash, '#/oglas?s=abc'); eq(seen.length, 1);
  eq(router.href('/mapa', { c: 'nis' }), '#/mapa?c=nis');
});

console.log('\nkredit i troškovi');
test('mortgage 100.000 € / 5 % / 20 g ≈ 659,96', () => { const m = mortgage(100000, 5, 20); eq(m.monthly, 659.96); eq(m.n, 240); eq(m.total, 158390.4); eq(m.interest, 58390.4); eq(mortgage(12000, 0, 1).monthly, 1000); eq(fmt.price(m.monthly, 'izdavanje'), '660' + NBSP + '€/mes'); });
test('amortization', () => { const a = K.amortization(100000, 5, 20); eq(a.length, 240); eq(a[239].balance, 0); assert(a[0].interest > a[100].interest); });
test('purchaseCosts', () => {
  const c = purchaseCosts(120000); eq(c.tax, 3000); eq(c.taxRate, 2.5); eq(c.agencyFee, 2400); eq(c.notary, 320); eq(c.total, 5720); eq(c.totalWithPrice, 125720);
  const nb = purchaseCosts(120000, { newbuild: true, agency: false }); eq(nb.tax, 12000); eq(nb.agencyFee, 0); eq(nb.total, 12320);
  eq(purchaseCosts(20000).notary, 120); eq(purchaseCosts(1e6).notary, 900); eq(purchaseCosts(0).total, 0);
});
test('rentCosts', () => { deq(rentCosts(450, 450), { deposit: 450, agencyFee: 225, firstMonth: 450, moveIn: 1125 }); eq(rentCosts(500).deposit, 500); eq(rentCosts(500, 1000).moveIn, 1750); });

console.log('\nstore');
test('favs/compare/recent/searches/notes + persist + on()', () => {
  const ls = memStorage(); const S = load({ storage: ls }).store; const ev = []; const off = S.on((w) => ev.push(w));
  eq(S.toggleFav('a'), true); assert(S.isFav('a')); eq(S.toggleFav('a'), false); eq(S.toggleFav('b'), true);
  deq(JSON.parse(ls.getItem('kv.favs')), ['b']);
  for (const s of ['1', '2', '3', '4']) eq(S.toggleCompare(s), true);
  eq(S.toggleCompare('5'), false, 'max 4'); deq(S.compare, ['1', '2', '3', '4']); eq(S.toggleCompare('2'), false); deq(S.compare, ['1', '3', '4']); assert(S.inCompare('3') && !S.inCompare('2'));
  for (let i = 0; i < 15; i++) S.pushRecent('r' + i); eq(S.recent.length, 12); eq(S.recent[0], 'r14'); S.pushRecent('r3'); eq(S.recent[0], 'r3'); eq(S.recent.length, 12);
  const it = S.saveSearch('Vračar dvosobni', { c: 'beograd' }); eq(S.searches[0].id, it.id); S.removeSearch(it.id); eq(S.searches.length, 0);
  S.setNote('x', 'proveriti vlagu'); eq(S.getNote('x'), 'proveriti vlagu'); S.setNote('x', ''); eq(S.getNote('x'), '');
  assert(ev.includes('favs') && ev.includes('compare') && ev.includes('recent') && ev.includes('searches') && ev.includes('notes')); off();
  const S2 = load({ storage: ls }).store; assert(S2.isFav('b')); deq(S2.compare, ['1', '3', '4']); eq(S2.recent[0], 'r3');
});
test('store bez localStorage (fallback u memoriji) i sa pokvarenim localStorage', () => {
  const S = load({ storage: undefined }).store; eq(S._persisted(), false); S.toggleFav('z'); assert(S.isFav('z')); S.toggleCompare('q'); deq(S.compare, ['q']);
  const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const S3 = load({ storage: bad }).store; S3.toggleFav('y'); assert(S3.isFav('y')); S3.pushRecent('k'); deq(S3.recent, ['k']);
  const corrupt = memStorage(); corrupt.setItem('kv.favs', '{not json'); const S4 = load({ storage: corrupt }).store; eq(S4.favs.size, 0);
});

console.log('\nDOM helperi, toast, legacy');
test('el', () => {
  const { el } = K;
  const n = el('a', { class: ['btn', null, 'x'], href: '#/', 'data-s': 'abc', dataset: { k: 1 }, hidden: true, skip: null, onclick: () => 1 }, 'tekst', 2, null, false, [el('b', {}, 'u'), ['dublje']]);
  eq(n.className, 'btn x'); eq(n.attrs.href, '#/'); eq(n.attrs['data-s'], 'abc'); eq(n.dataset.k, '1'); eq(n.attrs.hidden, ''); assert(!('skip' in n.attrs)); eq(n.listeners.click.length, 1);
  eq(n.children.length, 4); eq(n.children[0].textContent, 'tekst'); eq(n.children[1].textContent, '2'); eq(n.children[2].tagName, 'B'); eq(n.children[3].textContent, 'dublje');
  eq(el('p', { html: '<i>x</i>' }).innerHTML, '<i>x</i>');
});
test('toast', () => { const t = K.toast('Sačuvano', { action: { label: 'Pogledaj', href: '#/sacuvano' } }); assert(t && t.attrs.role === 'status'); eq(t.children.length, 2); eq(K.ctx.document.body.children[0].attrs.id, 'toasts'); eq(load({ dom: false }).toast('x'), null); });
test('hash/rng deterministični i nepromenjeni', () => { eq(K.hash('kvadrat'), K.hash('kvadrat')); eq(K.hash(''), 2166136261); const r = K.rng(42); const a = r(); assert(a >= 0 && a < 1); eq(K.rng(42)(), a); });
test('konstante', () => { eq(K.TYPES.length, 7); eq(K.COND.novogradnja, 'Novogradnja'); eq(K.HEAT['ta-pec'], 'TA peć'); eq(K.AMEN.hasElevator, 'Lift'); eq(K.ROOMS[3][1], 'Dvosoban'); assert(K.CITIES_MAJOR.some((c) => c.s === 'beograd')); eq(K.SORTS[0].v, 'rel'); eq(K.find.city('nis').n, 'Niš'); eq(K.find.listing(D.listings[5].s), D.listings[5]); });
test('legacy aliasi', () => {
  eq(K.eur(125000), '125.000' + NBSP + '€'); eq(K.m2(46), '46' + NBSP + 'm²'); eq(K.oglasa(3), 'oglasa'); eq(K.daysAgo(1), 'juče'); eq(K.nf.format(1234.6), '1.235'); assert(K.favs === K.store.favs);
  eq(K.DEFAULTS.sort, 'preporuceno'); eq(K.F.t, 'prodaja'); eq(K.typeOf('kuca').l, 'Kuće'); eq(K.roomLabel(2), 'Dvosoban'); eq(K.floorLabel(2, 5), '2. / 5');
  /* heroArt/cityArt prosleđuju na img.* (ovde lažni img u kontekstu) */
  eq(K.heroArt(), ''); K.ctx.img = { hero: () => '<svg/>', city: (s) => 'data:c,' + s, article: (s) => 'data:a,' + s };
  vm.runInContext('var img = globalThis.img;', K.ctx);
  eq(K.heroArt(), '<svg/>'); assert(K.cityArt('beograd').includes('src="data:c,beograd"')); assert(K.cityArt(D.articles[0].s).includes('src="data:a,' + D.articles[0].s + '"'));
  const f = paramsToFilters(new URLSearchParams('c=beograd&m=vracar&ro=2&co=lux')); deq(f.loc, ['beograd', 'vracar']); deq(f.rooms, [2]); deq(f.cond, ['lux']); assert(!Object.keys(f).includes('loc'));
});

console.log(`\n${passed} prošlo, ${failed} palo`);
process.exit(failed ? 1 : 0);
