/* Kvadrat.rs — core: podaci (window.KV), DOM helperi, formatiranje, taksonomija, hash/rng, stanje (favs, filteri), rutiranje (parseHash/setHash), applyFilters, toast. */
'use strict';

const D = window.KV;
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    n.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return n;
};

/* ─────────── formatiranje ─────────── */
const nf = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });
const eur = (n) => nf.format(Math.round(n)) + ' €';
const m2 = (n) => nf.format(Math.round(n * 10) / 10) + ' m²';
const plural = (n, a, b, c) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b;
  return c;
};
const oglasa = (n) => plural(n, 'oglas', 'oglasa', 'oglasa');
const daysAgo = (d) =>
  d === 0 ? 'danas' : d === 1 ? 'juče' : d < 30 ? `pre ${d} ${plural(d, 'dan', 'dana', 'dana')}`
  : d < 365 ? `pre ${Math.round(d / 30)} ${plural(Math.round(d / 30), 'mesec', 'meseca', 'meseci')}`
  : 'pre godinu dana';

/* ─────────── taksonomija ─────────── */
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
const roomLabel = (v) => (v == null ? null : (ROOMS.find((r) => r[0] === v) || [0, v + ' sobe'])[1]);
const floorLabel = (f, t) => f == null ? null : (f === 0 ? 'Prizemlje' : f === -1 ? 'Suteren' : f + '.') + (t ? ' / ' + t : '');
const typeOf = (v) => TYPES.find((t) => t.v === v) || TYPES[0];

/* ─────────── deterministički hash / rng ─────────── */
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ─────────── stanje i rutiranje ─────────── */
const LS = { fav: 'kvp_fav', theme: 'kvp_theme' };
const readFav = () => { try { return new Set(JSON.parse(localStorage.getItem(LS.fav) || '[]')); } catch { return new Set(); } };
let favs = readFav();
const saveFav = () => { try { localStorage.setItem(LS.fav, JSON.stringify([...favs])); } catch {} };

const DEFAULTS = {
  t: 'prodaja', pt: 'stan', loc: [], pmin: '', pmax: '', amin: '', amax: '',
  rooms: [], cond: [], heat: [], furn: [], am: [], reg: false, promo: false,
  sort: 'preporuceno', view: 'grid', page: 1,
};
let F = { ...DEFAULTS };

function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  const [path, qs] = raw.split('?');
  const q = new URLSearchParams(qs || '');
  return { path: path || '/', q };
}
function setHash(path, params = {}, replace = false) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
    q.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = q.toString();
  const h = '#' + path + (s ? '?' + s : '');
  if (replace) history.replaceState(null, '', h); else location.hash = h;
  if (replace) render();
}
function filtersToParams(f) {
  return {
    t: f.t !== 'prodaja' ? f.t : '', pt: f.pt !== 'stan' ? f.pt : '', loc: f.loc, pmin: f.pmin, pmax: f.pmax,
    amin: f.amin, amax: f.amax, rooms: f.rooms, cond: f.cond, heat: f.heat, furn: f.furn, am: f.am,
    reg: f.reg, promo: f.promo, sort: f.sort !== 'preporuceno' ? f.sort : '',
    view: f.view !== 'grid' ? f.view : '', page: f.page > 1 ? f.page : '',
  };
}
function paramsToFilters(q) {
  const list = (k) => (q.get(k) ? q.get(k).split(',').filter(Boolean) : []);
  return {
    ...DEFAULTS,
    t: q.get('t') || 'prodaja', pt: q.get('pt') || 'stan', loc: list('loc'),
    pmin: q.get('pmin') || '', pmax: q.get('pmax') || '', amin: q.get('amin') || '', amax: q.get('amax') || '',
    rooms: list('rooms').map(Number), cond: list('cond'), heat: list('heat'), furn: list('furn'), am: list('am'),
    reg: q.get('reg') === 'true', promo: q.get('promo') === 'true',
    sort: q.get('sort') || 'preporuceno', view: q.get('view') || 'grid', page: Math.max(1, Number(q.get('page')) || 1),
  };
}

/* ─────────── pretraga ─────────── */
const PROMO_RANK = { PREMIUM: 3, TOP: 2, ISTAKNUT: 1, NONE: 0 };
function applyFilters(f) {
  const locSet = new Set(f.loc);
  let out = D.listings.filter((l) => {
    if (l.t !== f.t || l.pt !== f.pt) return false;
    if (locSet.size && !(locSet.has(l.cs) || (l.ms && locSet.has(l.ms)))) return false;
    if (f.pmin && l.p < +f.pmin) return false;
    if (f.pmax && l.p > +f.pmax) return false;
    if (f.amin && l.a < +f.amin) return false;
    if (f.amax && l.a > +f.amax) return false;
    if (f.rooms.length && !f.rooms.includes(l.ro)) return false;
    if (f.cond.length && !f.cond.includes(l.co)) return false;
    if (f.heat.length && !f.heat.includes(l.he)) return false;
    if (f.furn.length && !f.furn.includes(l.fu)) return false;
    if (f.am.length && !f.am.every((k) => l.am.includes(k))) return false;
    if (f.reg && !l.reg) return false;
    if (f.promo && l.pr === 'NONE') return false;
    return true;
  });
  const by = {
    'najnovije': (a, b) => a.dz - b.dz,
    'cena-rastuce': (a, b) => a.p - b.p,
    'cena-opadajuce': (a, b) => b.p - a.p,
    'kvadratura-opadajuce': (a, b) => b.a - a.a,
    'cena-po-m2': (a, b) => (a.ppm || 1e9) - (b.ppm || 1e9),
    'najpopularnije': (a, b) => b.v - a.v,
    'preporuceno': (a, b) => (PROMO_RANK[b.pr] - PROMO_RANK[a.pr]) || (a.dz - b.dz),
  };
  return out.sort(by[f.sort] || by.preporuceno);
}
const countActive = (f) =>
  (f.loc.length ? 1 : 0) + (f.pmin ? 1 : 0) + (f.pmax ? 1 : 0) + (f.amin ? 1 : 0) + (f.amax ? 1 : 0) +
  (f.rooms.length ? 1 : 0) + (f.cond.length ? 1 : 0) + (f.heat.length ? 1 : 0) + (f.furn.length ? 1 : 0) +
  f.am.length + (f.reg ? 1 : 0) + (f.promo ? 1 : 0);

/* ─────────── toast ─────────── */
function toast(msg) {
  const t = el('div', { class: 'toast', role: 'status' }, msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
