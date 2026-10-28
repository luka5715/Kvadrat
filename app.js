/* Kvadrat.rs — interaktivni preview. Podaci dolaze iz window.KV (data.js). */
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

/* ─────────── deterministička grafika ─────────── */
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const PALETTES = [
  { sky: ['#cfe0f2', '#eef4fb'], wall: '#e6e0d6', wall2: '#d3cabb', roof: '#6b5f57', win: '#3d5a77', accent: '#b9502f', ground: '#cdd4cb' },
  { sky: ['#dbe7f0', '#f4f7fa'], wall: '#dfe3e7', wall2: '#c7ced6', roof: '#4a5561', win: '#2f4558', accent: '#7d8b99', ground: '#c8cfc9' },
  { sky: ['#e9dfd2', '#faf5ee'], wall: '#f0e6d8', wall2: '#dcccb6', roof: '#8a6a4b', win: '#41566b', accent: '#a8763f', ground: '#d2d3c3' },
  { sky: ['#c9dbe6', '#edf3f6'], wall: '#cfd8d6', wall2: '#b4c0bd', roof: '#3f4a4a', win: '#2b3f4d', accent: '#4f7a6a', ground: '#bfc9bf' },
  { sky: ['#dde2ee', '#f5f6fa'], wall: '#e8e5ea', wall2: '#cfcad4', roof: '#55506a', win: '#3a3f5c', accent: '#6b5b95', ground: '#c9cbc6' },
];

/** Proceduralni „foto" prikaz nekretnine — deterministički po slug-u i rednom broju kadra. */
function scene(slug, kind, idx = 0) {
  const r = rng(hash(slug + '#' + idx));
  const P = PALETTES[Math.floor(r() * PALETTES.length)];
  const W = 800, H = 600;
  const parts = [];
  const rect = (x, y, w, h, f, extra = '') => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${extra}/>`);
  const uid = 'g' + hash(slug + idx).toString(36);

  parts.push(`<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky[0]}"/><stop offset="1" stop-color="${P.sky[1]}"/></linearGradient></defs>`);
  rect(0, 0, W, H, `url(#${uid})`);

  if (kind === 'interior') {
    rect(0, 0, W, 430, P.wall);
    rect(0, 430, W, 170, P.wall2);
    parts.push(`<polygon points="0,430 ${W},430 ${W},600 0,600" fill="${P.roof}" opacity=".14"/>`);
    const wx = 90 + Math.floor(r() * 60), ww = 240 + Math.floor(r() * 90);
    rect(wx, 90, ww, 220, '#fff', 'opacity=".92"');
    rect(wx + 6, 96, ww - 12, 208, P.sky[0]);
    parts.push(`<line x1="${wx + ww / 2}" y1="96" x2="${wx + ww / 2}" y2="304" stroke="#fff" stroke-width="7"/>`);
    parts.push(`<line x1="${wx + 6}" y1="200" x2="${wx + ww - 6}" y2="200" stroke="#fff" stroke-width="7"/>`);
    const sx = wx + ww + 60;
    rect(sx, 300, 250, 110, P.accent, 'rx="14" opacity=".85"');
    rect(sx + 14, 272, 60, 40, P.accent, 'rx="9" opacity=".65"');
    rect(sx + 90, 272, 60, 40, P.accent, 'rx="9" opacity=".65"');
    rect(sx - 10, 405, 270, 16, P.roof, 'rx="6" opacity=".5"');
    rect(110, 430, 330, 120, P.accent, 'rx="6" opacity=".22"');
    rect(560, 250, 22, 180, P.roof, 'opacity=".55"');
    parts.push(`<circle cx="571" cy="238" r="42" fill="${P.wall2}" opacity=".9"/>`);
    rect(640, 340, 110, 90, P.roof, 'rx="8" opacity=".28"');
  } else if (kind === 'land') {
    rect(0, 330, W, 270, '#a9bd8f');
    parts.push(`<path d="M0 330 Q 200 300 420 332 T 800 322 L800 600 L0 600Z" fill="#93ad78"/>`);
    parts.push(`<path d="M0 430 Q 260 400 520 436 T 800 424 L800 600 L0 600Z" fill="#7d9a66" opacity=".8"/>`);
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 92;
      rect(x, 352 - (i % 2) * 6, 7, 60, '#7a6349');
      parts.push(`<line x1="${x}" y1="372" x2="${x + 92}" y2="372" stroke="#7a6349" stroke-width="5" opacity=".85"/>`);
    }
    for (let i = 0; i < 4; i++) {
      const x = 90 + r() * 620, y = 300 + r() * 60, s = 0.7 + r() * 0.7;
      parts.push(`<ellipse cx="${x}" cy="${y - 34 * s}" rx="${34 * s}" ry="${40 * s}" fill="#4f7147"/>`);
      rect(x - 4 * s, y - 12 * s, 8 * s, 30 * s, '#6b5238');
    }
    parts.push(`<path d="M0 560 Q 400 520 800 566" stroke="#c8b48f" stroke-width="26" fill="none" opacity=".9"/>`);
  } else if (kind === 'garage') {
    rect(0, 0, W, 600, P.wall2);
    rect(60, 90, 680, 380, P.wall);
    rect(80, 130, 640, 310, P.roof, 'opacity=".9"');
    for (let i = 0; i < 11; i++) rect(88, 140 + i * 27, 624, 18, P.wall2, 'opacity=".85"');
    rect(88, 140, 624, 18, P.accent, 'opacity=".5"');
    rect(0, 470, W, 130, '#9a9a96');
    parts.push(`<line x1="0" y1="470" x2="800" y2="470" stroke="#7d7d79" stroke-width="6"/>`);
    for (let i = 0; i < 6; i++) rect(40 + i * 130, 520, 80, 8, '#e8e4d8', 'opacity=".75"');
  } else {
    /* facade */
    const nB = 2 + Math.floor(r() * 2);
    let x = 40;
    for (let b = 0; b < nB; b++) {
      const bw = 170 + Math.floor(r() * 150);
      const bh = 230 + Math.floor(r() * 220);
      const y = 470 - bh;
      rect(x, y, bw, bh, b % 2 ? P.wall2 : P.wall);
      rect(x, y, bw, 14, P.roof);
      const cols = Math.max(2, Math.floor(bw / 58));
      const rows = Math.max(2, Math.floor(bh / 66));
      const pw = (bw - 22) / cols, ph = (bh - 40) / rows;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const wx = x + 11 + cx * pw + pw * 0.14;
          const wy = y + 26 + cy * ph + ph * 0.16;
          const ww = pw * 0.72, wh = ph * 0.6;
          rect(wx, wy, ww, wh, P.win, `opacity="${(0.55 + r() * 0.4).toFixed(2)}" rx="2"`);
          if (r() > 0.72) rect(wx - 3, wy + wh, ww + 6, 7, P.accent, 'opacity=".8" rx="2"');
        }
      }
      if (r() > 0.5) rect(x + bw / 2 - 26, 470 - 62, 52, 62, P.accent, 'opacity=".9" rx="3"');
      x += bw + 16;
      if (x > W - 120) break;
    }
    rect(0, 470, W, 130, P.ground);
    parts.push(`<path d="M0 500 Q 400 476 800 504 L800 600 L0 600Z" fill="#9aa694" opacity=".55"/>`);
    for (let i = 0; i < 3; i++) {
      const tx = 90 + r() * 620;
      parts.push(`<ellipse cx="${tx}" cy="452" rx="30" ry="38" fill="#4f7147" opacity=".92"/>`);
      rect(tx - 4, 452, 8, 30, '#6b5238');
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Prikaz nekretnine">${parts.join('')}</svg>`;
}

function kindFor(pt, idx) {
  if (pt === 'zemljiste') return 'land';
  if (pt === 'garaza') return 'garage';
  if (idx === 0) return 'facade';
  return idx % 2 ? 'interior' : 'facade';
}

/* ─────────── ikone ─────────── */
const ICON = {
  building: '<path d="M4 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15M12 21V11h6a1 1 0 0 1 1 1v9M7 9h2M7 13h2M7 17h2M15 15h1M15 18h1"/>',
  house: '<path d="M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5M10 21v-6h4v6"/>',
  office: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h2M13 10h2M9 14h2M13 14h2M9 18h6"/>',
  land: '<path d="M3 19h18M4 19l3-8 4 4 3-6 6 10"/>',
  garage: '<path d="M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 16h10"/>',
  bed: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 14h18M6 10V7h5v3"/>',
  area: '<path d="M4 4h16v16H4zM9 4v16M4 9h16"/>',
  bath: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  heart: '<path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7-2.5c0 5-7 9.5-7 9.5z"/>',
  eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
  check: '<path d="M4 12.5 9.5 18 20 6.5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  map: '<path d="m9 4 6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0"/>',
};
const icon = (name, size = 18, cls = '') =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;

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

/* ─────────── kartica oglasa ─────────── */
function card(l, variant = 'grid') {
  const isRent = l.t === 'izdavanje';
  const place = [l.n, l.m, l.c].filter(Boolean).slice(0, 2).join(', ');
  const badges = [];
  if (l.pr === 'TOP') badges.push(el('span', { class: 'badge badge-top' }, 'TOP'));
  else if (l.pr === 'PREMIUM') badges.push(el('span', { class: 'badge badge-prem' }, 'Premium'));
  else if (l.pr === 'ISTAKNUT') badges.push(el('span', { class: 'badge badge-ist' }, 'Istaknuto'));
  if (l.co === 'novogradnja') badges.push(el('span', { class: 'badge badge-new' }, 'Novogradnja'));

  const specs = [
    ['area', m2(l.a)],
    l.ro != null && ['bed', roomLabel(l.ro)],
    l.ba ? ['bath', l.ba + ' ' + plural(l.ba, 'kupatilo', 'kupatila', 'kupatila')] : null,
    l.fl != null && ['building', floorLabel(l.fl, l.tf)],
  ].filter(Boolean);

  const fav = favs.has(l.s);
  return el('article', { class: 'card card-' + variant },
    el('div', { class: 'card-media' },
      el('a', { class: 'card-media-link', href: '#/oglas?s=' + l.s, 'aria-label': l.ti, html: scene(l.s, kindFor(l.pt, 0), 0) }),
      l.im > 1 ? el('span', { class: 'shots' }, l.im + ' fotografija') : null),
    el('div', { class: 'card-badges' }, badges),
    el('button', {
      class: 'fav' + (fav ? ' is-on' : ''), type: 'button',
      'aria-pressed': fav ? 'true' : 'false', 'aria-label': fav ? 'Ukloni iz sačuvanih' : 'Sačuvaj oglas',
      html: icon('heart', 18),
      onclick: (e) => {
        e.preventDefault(); e.stopPropagation();
        if (favs.has(l.s)) favs.delete(l.s); else favs.add(l.s);
        saveFav(); render();
      },
    }),
    el('div', { class: 'card-body' },
      el('div', { class: 'card-price-row' },
        el('p', { class: 'price' }, eur(l.p), isRent ? el('span', { class: 'per' }, '/mes') : null),
        l.ppm && l.pt !== 'zemljiste' ? el('p', { class: 'ppm' }, nf.format(l.ppm) + ' €/m²') : null,
      ),
      el('h3', { class: 'card-title' }, el('a', { href: '#/oglas?s=' + l.s }, l.ti)),
      el('p', { class: 'card-place' }, el('span', { html: icon('pin', 14) }), place),
      el('ul', { class: 'specs' }, specs.map(([ic, tx]) => el('li', {}, el('span', { html: icon(ic, 15) }), tx))),
      el('div', { class: 'card-foot' },
        el('span', { class: 'agency' }, l.ag || 'Vlasnik', l.agv ? el('span', { class: 'verif', title: 'Verifikovana agencija', html: icon('check', 13) }) : null),
        el('span', { class: 'when' }, daysAgo(l.dz)),
      ),
    ),
  );
}

/* ─────────── početna ─────────── */
function viewHome() {
  const total = D.listings.length;
  const byType = {};
  for (const l of D.listings) byType[l.pt] = (byType[l.pt] || 0) + 1;
  const featured = D.listings.filter((l) => l.pr === 'TOP' || l.pr === 'PREMIUM').slice(0, 6);
  const newest = [...D.listings].sort((a, b) => a.dz - b.dz).slice(0, 3);
  const majors = D.cities.filter((c) => c.maj).slice(0, 8);

  const hero = el('section', { class: 'hero' },
    el('div', { class: 'hero-art', html: heroArt() }),
    el('div', { class: 'wrap hero-in' },
      el('p', { class: 'eyebrow' }, 'Portal za nekretnine · Srbija'),
      el('h1', {}, 'Pronađite svoj novi dom'),
      el('p', { class: 'lede' }, `Pretražite ${nf.format(total)} aktuelnih oglasa za prodaju i izdavanje stanova, kuća, poslovnih prostora i zemljišta širom Srbije.`),
      searchPanel(),
      el('div', { class: 'hero-stats' },
        stat(nf.format(total), 'aktivnih oglasa'),
        stat(String(D.cities.length), 'gradova'),
        stat(String(D.agencies.length), 'agencija'),
        stat(nf.format(D.muns.length), 'opština i zona'),
      ),
    ),
  );

  const cats = el('section', { class: 'wrap block' },
    head('Šta tražite?', 'Izaberite vrstu nekretnine i pregledajte ponudu.'),
    el('div', { class: 'cats' }, TYPES.map((t) => el('a', {
      class: 'cat', href: '#/pretraga?' + new URLSearchParams({ t: t.v === 'soba' ? 'izdavanje' : 'prodaja', pt: t.v }),
    },
      el('span', { class: 'cat-ic', html: icon(t.icon, 22) }),
      el('span', { class: 'cat-l' }, t.l),
      el('span', { class: 'cat-c' }, (byType[t.v] || 0) + ' ' + oglasa(byType[t.v] || 0)),
    ))),
  );

  const feat = el('section', { class: 'wrap block' },
    head('Izdvojeni oglasi', 'Promovisane nekretnine proverenih oglašivača.', '#/pretraga?promo=true'),
    el('div', { class: 'grid3' }, featured.map((l) => card(l))),
  );

  const cities = el('section', { class: 'wrap block' },
    head('Popularni gradovi', 'Pogledajte ponudu u najtraženijim gradovima.'),
    el('div', { class: 'cities' }, majors.map((c) => el('a', {
      class: 'city', href: '#/pretraga?' + new URLSearchParams({ loc: c.s }),
    },
      el('span', { class: 'city-art', html: cityArt(c.s) }),
      el('span', { class: 'city-b' }, el('strong', {}, c.n), el('span', {}, c.c + ' ' + oglasa(c.c))),
    ))),
  );

  const ags = el('section', { class: 'wrap block' },
    head('Proverene agencije', 'Agencije sa verifikovanim licencama i ocenama klijenata.', '#/agencije'),
    el('div', { class: 'ag-strip' }, D.agencies.filter((a) => a.v).slice(0, 6).map(agencyCard)),
  );

  const arts = el('section', { class: 'wrap block' },
    head('Saveti i vodiči', 'Kako kupiti, prodati ili izdati nekretninu bez neprijatnih iznenađenja.'),
    el('div', { class: 'grid3' }, D.articles.slice(0, 3).map((a) => el('article', { class: 'art' },
      el('span', { class: 'art-art', html: cityArt(a.s) }),
      el('div', { class: 'art-b' },
        el('span', { class: 'tag' }, a.c.replace('-', ' ')),
        el('h3', {}, a.t),
        el('p', {}, a.e),
        el('span', { class: 'when' }, a.au, ' · ', a.rm + ' min čitanja'),
      ),
    ))),
  );

  const newestSec = el('section', { class: 'wrap block' },
    head('Najnovije na portalu', 'Oglasi postavljeni u poslednjih nekoliko dana.', '#/pretraga?sort=najnovije'),
    el('div', { class: 'grid3' }, newest.map((l) => card(l))),
  );

  return [hero, cats, feat, newestSec, cities, ags, arts];
}

const stat = (v, l) => el('div', { class: 'stat' }, el('strong', {}, v), el('span', {}, l));
const head = (t, s, href) => el('div', { class: 'head' },
  el('div', {}, el('h2', {}, t), s ? el('p', {}, s) : null),
  href ? el('a', { class: 'more', href }, 'Prikaži sve ', el('span', { html: icon('chev', 15) })) : null,
);

function heroArt() {
  const b = [];
  const r = rng(7);
  for (let i = 0; i < 26; i++) {
    const w = 34 + r() * 54, h = 60 + r() * 190, x = i * 48 - 10;
    b.push(`<rect x="${x}" y="${300 - h}" width="${w}" height="${h}" fill="rgba(255,255,255,${(0.05 + r() * 0.08).toFixed(3)})"/>`);
    for (let k = 0; k < Math.floor(h / 26); k++)
      b.push(`<rect x="${x + 7}" y="${300 - h + 12 + k * 24}" width="${w - 14}" height="9" fill="rgba(255,255,255,${(0.05 + r() * 0.1).toFixed(3)})"/>`);
  }
  return `<svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${b.join('')}</svg>`;
}
function cityArt(seed) {
  const r = rng(hash(seed));
  const P = PALETTES[Math.floor(r() * PALETTES.length)];
  const b = [`<defs><linearGradient id="c${hash(seed).toString(36)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky[0]}"/><stop offset="1" stop-color="${P.sky[1]}"/></linearGradient></defs>`,
    `<rect width="400" height="220" fill="url(#c${hash(seed).toString(36)})"/>`];
  let x = 0;
  while (x < 400) {
    const w = 30 + r() * 46, h = 60 + r() * 110;
    b.push(`<rect x="${x}" y="${190 - h}" width="${w}" height="${h}" fill="${r() > 0.5 ? P.wall : P.wall2}"/>`);
    for (let k = 0; k < Math.floor(h / 24); k++)
      b.push(`<rect x="${x + 6}" y="${190 - h + 9 + k * 22}" width="${w - 12}" height="8" fill="${P.win}" opacity="${(0.4 + r() * 0.45).toFixed(2)}"/>`);
    x += w + 6;
  }
  b.push(`<rect y="190" width="400" height="30" fill="${P.ground}"/>`);
  return `<svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${b.join('')}</svg>`;
}

/* ─────────── panel pretrage (hero) ─────────── */
function searchPanel() {
  let t = 'prodaja', pt = 'stan', loc = '', pmax = '';
  const box = el('form', {
    class: 'sp',
    onsubmit: (e) => {
      e.preventDefault();
      const params = { t, pt };
      if (loc) params.loc = loc;
      if (pmax) params.pmax = pmax;
      setHash('/pretraga', params);
    },
  });
  const tabs = el('div', { class: 'sp-tabs', role: 'tablist' },
    ['prodaja', 'izdavanje'].map((v) => el('button', {
      type: 'button', role: 'tab', class: 'sp-tab' + (v === t ? ' is-on' : ''), 'aria-selected': v === t ? 'true' : 'false',
      onclick: (e) => {
        t = v;
        [...e.currentTarget.parentElement.children].forEach((b) => {
          const on = b === e.currentTarget;
          b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        priceSel.innerHTML = '';
        priceSel.append(...priceOptions(t));
        pmax = '';
      },
    }, v === 'prodaja' ? 'Prodaja' : 'Izdavanje')),
  );
  const priceOptions = (tr) => {
    const steps = tr === 'prodaja' ? [40000, 60000, 80000, 100000, 130000, 160000, 200000, 300000] : [200, 300, 400, 500, 700, 900, 1200, 2000];
    return [el('option', { value: '' }, 'Cena do'), ...steps.map((s) => el('option', { value: s }, nf.format(s) + ' €'))];
  };
  const typeSel = el('select', { class: 'inp', 'aria-label': 'Vrsta nekretnine', onchange: (e) => { pt = e.target.value; } },
    TYPES.map((x) => el('option', { value: x.v }, x.l)));
  const locSel = el('select', { class: 'inp', 'aria-label': 'Lokacija', onchange: (e) => { loc = e.target.value; } },
    el('option', { value: '' }, 'Cela Srbija'),
    el('optgroup', { label: 'Gradovi' }, D.cities.slice(0, 16).map((c) => el('option', { value: c.s }, `${c.n} (${c.c})`))),
    el('optgroup', { label: 'Beogradske opštine' },
      D.muns.filter((m) => m.cs === 'beograd').sort((a, b) => b.c - a.c).slice(0, 17).map((m) => el('option', { value: m.s }, `${m.n} (${m.c})`))),
  );
  const priceSel = el('select', { class: 'inp', 'aria-label': 'Cena do', onchange: (e) => { pmax = e.target.value; } }, priceOptions('prodaja'));

  box.append(tabs, el('div', { class: 'sp-row' }, typeSel, locSel, priceSel,
    el('button', { class: 'btn btn-primary sp-go', type: 'submit' }, el('span', { html: icon('search', 18) }), 'Pretraži')));
  return box;
}

/* ─────────── rezultati ─────────── */
const PER_PAGE = 12;
function viewResults(f) {
  const all = applyFilters(f);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const page = Math.min(f.page, pages);
  const items = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const T = typeOf(f.pt);
  const locNames = f.loc.map((s) => (D.cities.find((c) => c.s === s) || D.muns.find((m) => m.s === s) || {}).n).filter(Boolean);
  const title = `${f.t === 'prodaja' ? 'Prodaja' : 'Izdavanje'} ${T.pl}${locNames.length ? ' — ' + locNames.join(', ') : ' u Srbiji'}`;
  const avg = all.filter((l) => l.ppm).reduce((s, l, _, a) => s + l.ppm / a.length, 0);

  const go = (patch) => setHash('/pretraga', filtersToParams({ ...f, page: 1, ...patch }));

  const chips = [];
  const chip = (label, patch) => chips.push(el('button', { class: 'chip', type: 'button', onclick: () => go(patch) },
    label, el('span', { html: icon('x', 13) })));
  locNames.forEach((n, i) => chip(n, { loc: f.loc.filter((_, k) => k !== i) }));
  if (f.pmin) chip('od ' + eur(+f.pmin), { pmin: '' });
  if (f.pmax) chip('do ' + eur(+f.pmax), { pmax: '' });
  if (f.amin) chip('od ' + m2(+f.amin), { amin: '' });
  if (f.amax) chip('do ' + m2(+f.amax), { amax: '' });
  f.rooms.forEach((r) => chip(roomLabel(r), { rooms: f.rooms.filter((x) => x !== r) }));
  f.cond.forEach((c) => chip(COND[c], { cond: f.cond.filter((x) => x !== c) }));
  f.heat.forEach((c) => chip(HEAT[c], { heat: f.heat.filter((x) => x !== c) }));
  f.furn.forEach((c) => chip(FURN[c], { furn: f.furn.filter((x) => x !== c) }));
  f.am.forEach((c) => chip(AMEN[c], { am: f.am.filter((x) => x !== c) }));
  if (f.reg) chip('Uknjižen', { reg: false });
  if (f.promo) chip('Samo promovisani', { promo: false });

  const header = el('div', { class: 'res-head' },
    el('nav', { class: 'crumbs', 'aria-label': 'Putanja' },
      el('a', { href: '#/' }, 'Početna'), el('span', { html: icon('chev', 13) }),
      el('span', {}, `${f.t === 'prodaja' ? 'Prodaja' : 'Izdavanje'} ${T.pl}`)),
    el('h1', {}, title),
    el('p', { class: 'res-sub' },
      el('strong', {}, nf.format(all.length)), ' ' + oglasa(all.length),
      avg ? el('span', {}, ` · prosečno ${nf.format(Math.round(avg))} €/m²`) : null),
  );

  const toolbar = el('div', { class: 'toolbar' },
    el('button', { class: 'btn btn-ghost only-m', type: 'button', onclick: () => $('.rail').classList.add('open') },
      el('span', { html: icon('filter', 17) }), `Filteri${countActive(f) ? ' (' + countActive(f) + ')' : ''}`),
    el('div', { class: 'seg' }, [['grid', 'grid', 'Mreža'], ['list', 'list', 'Lista']].map(([v, ic, lbl]) =>
      el('button', {
        type: 'button', class: 'seg-b' + (f.view === v ? ' is-on' : ''), 'aria-pressed': f.view === v ? 'true' : 'false',
        onclick: () => setHash('/pretraga', filtersToParams({ ...f, view: v })),
      }, el('span', { html: icon(ic, 16) }), lbl))),
    el('label', { class: 'sort' }, 'Sortiranje',
      el('select', { class: 'inp', onchange: (e) => go({ sort: e.target.value }) },
        [['preporuceno', 'Preporučeno'], ['najnovije', 'Najnovije'], ['cena-rastuce', 'Cena: rastuće'],
         ['cena-opadajuce', 'Cena: opadajuće'], ['kvadratura-opadajuce', 'Kvadratura: opadajuće'],
         ['cena-po-m2', 'Cena po m²'], ['najpopularnije', 'Najpopularnije']]
          .map(([v, l]) => el('option', { value: v, selected: f.sort === v }, l)))),
  );

  const results = items.length
    ? el('div', { class: f.view === 'list' ? 'stack' : 'grid3' }, items.map((l) => card(l, f.view)))
    : el('div', { class: 'empty' },
        el('h3', {}, 'Nema oglasa za izabrane filtere'),
        el('p', {}, 'Pokušajte da proširite cenu ili uklonite deo filtera.'),
        el('div', { class: 'empty-acts' },
          el('button', { class: 'btn btn-outline', type: 'button', onclick: () => go({ pmax: f.pmax ? String(Math.round(+f.pmax * 1.25)) : '' }) }, 'Proširi cenu za 25%'),
          el('button', { class: 'btn btn-primary', type: 'button', onclick: () => setHash('/pretraga', { t: f.t, pt: f.pt }) }, 'Očisti sve filtere')));

  const pager = pages > 1 ? el('nav', { class: 'pager', 'aria-label': 'Paginacija' },
    el('button', { class: 'pg', type: 'button', disabled: page === 1, 'aria-label': 'Prethodna strana', onclick: () => setHash('/pretraga', filtersToParams({ ...f, page: page - 1 })) }, '‹'),
    Array.from({ length: pages }, (_, i) => i + 1)
      .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
      .map((n, i, arr) => [
        i > 0 && arr[i - 1] !== n - 1 ? el('span', { class: 'gap' }, '…') : null,
        el('button', { class: 'pg' + (n === page ? ' is-on' : ''), type: 'button', 'aria-label': 'Strana ' + n, 'aria-current': n === page ? 'page' : null, onclick: () => setHash('/pretraga', filtersToParams({ ...f, page: n })) }, String(n)),
      ]),
    el('button', { class: 'pg', type: 'button', disabled: page === pages, 'aria-label': 'Sledeća strana', onclick: () => setHash('/pretraga', filtersToParams({ ...f, page: page + 1 })) }, '›'),
  ) : null;

  return el('div', { class: 'wrap res' },
    header,
    el('div', { class: 'res-grid' },
      rail(f, all.length),
      el('div', { class: 'res-main' },
        toolbar,
        chips.length ? el('div', { class: 'chips' }, chips, el('button', { class: 'chip chip-clear', type: 'button', onclick: () => setHash('/pretraga', { t: f.t, pt: f.pt }) }, 'Očisti sve')) : null,
        results, pager,
      ),
    ),
  );
}

/* ─────────── filter rail ─────────── */
function rail(f, count) {
  const go = (patch) => setHash('/pretraga', filtersToParams({ ...f, page: 1, ...patch }));
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const group = (title, body, open = true) => el('details', { class: 'grp', open: open || null },
    el('summary', {}, title, el('span', { class: 'grp-ic', html: icon('chev', 15) })), el('div', { class: 'grp-b' }, body));

  const seg = (opts, cur, onPick) => el('div', { class: 'seg seg-full' }, opts.map(([v, l]) =>
    el('button', { type: 'button', class: 'seg-b' + (cur === v ? ' is-on' : ''), 'aria-pressed': cur === v ? 'true' : 'false', onclick: () => onPick(v) }, l)));

  const pills = (opts, cur, onPick, labelOf = (x) => x) => el('div', { class: 'pills' }, opts.map((v) =>
    el('button', { type: 'button', class: 'pill' + (cur.includes(v) ? ' is-on' : ''), 'aria-pressed': cur.includes(v) ? 'true' : 'false', onclick: () => onPick(v) }, labelOf(v))));

  const numPair = (label, aVal, bVal, aKey, bKey, unit) => el('div', { class: 'pair' },
    el('label', {}, el('span', { class: 'sr' }, `${label} od`),
      el('input', { class: 'inp', type: 'number', min: '0', placeholder: 'Od', value: aVal, 'aria-label': `${label} od`,
        onchange: (e) => go({ [aKey]: e.target.value }) })),
    el('label', {}, el('span', { class: 'sr' }, `${label} do`),
      el('input', { class: 'inp', type: 'number', min: '0', placeholder: 'Do', value: bVal, 'aria-label': `${label} do`,
        onchange: (e) => go({ [bKey]: e.target.value }) })),
    el('span', { class: 'unit' }, unit),
  );

  // Brojevi uz lokacije prate izabranu transakciju i tip nekretnine,
  // da ne bi obećavali oglase kojih u trenutnoj pretrazi nema.
  const cityN = {}, munN = {};
  for (const l of D.listings) {
    if (l.t !== f.t || l.pt !== f.pt) continue;
    cityN[l.cs] = (cityN[l.cs] || 0) + 1;
    if (l.ms) munN[l.ms] = (munN[l.ms] || 0) + 1;
  }
  const locOptions = [
    el('optgroup', { label: 'Gradovi' }, D.cities.filter((c) => cityN[c.s] || f.loc.includes(c.s))
      .sort((a, b) => (cityN[b.s] || 0) - (cityN[a.s] || 0))
      .map((c) => el('option', { value: c.s, selected: f.loc.includes(c.s) }, `${c.n} (${cityN[c.s] || 0})`))),
    el('optgroup', { label: 'Opštine i zone' }, D.muns.filter((m) => munN[m.s] || f.loc.includes(m.s))
      .sort((a, b) => (munN[b.s] || 0) - (munN[a.s] || 0)).slice(0, 60)
      .map((m) => el('option', { value: m.s, selected: f.loc.includes(m.s) }, `${m.n} (${munN[m.s] || 0})`))),
  ];

  return el('aside', { class: 'rail', 'aria-label': 'Filteri' },
    el('div', { class: 'rail-top' },
      el('strong', {}, 'Filteri'),
      el('button', { class: 'x only-m', type: 'button', 'aria-label': 'Zatvori filtere', html: icon('x', 20), onclick: (e) => e.currentTarget.closest('.rail').classList.remove('open') })),
    el('div', { class: 'rail-scroll' },
      group('Vrsta oglasa', seg([['prodaja', 'Prodaja'], ['izdavanje', 'Izdavanje']], f.t, (v) => go({ t: v }))),
      group('Tip nekretnine', el('div', { class: 'pills' }, TYPES.map((t) =>
        el('button', { type: 'button', class: 'pill' + (f.pt === t.v ? ' is-on' : ''), 'aria-pressed': f.pt === t.v ? 'true' : 'false', onclick: () => go({ pt: t.v }) }, t.l)))),
      group('Lokacija', el('div', {},
        el('select', {
          class: 'inp multi', multiple: true, size: 7, 'aria-label': 'Lokacija',
          onchange: (e) => go({ loc: [...e.target.selectedOptions].map((o) => o.value) }),
        }, locOptions),
        el('p', { class: 'hint' }, 'Držite Ctrl (⌘) za izbor više lokacija.'))),
      group('Cena', numPair('Cena', f.pmin, f.pmax, 'pmin', 'pmax', '€')),
      group('Kvadratura', numPair('Kvadratura', f.amin, f.amax, 'amin', 'amax', 'm²')),
      typeOf(f.pt).v !== 'zemljiste' && typeOf(f.pt).v !== 'garaza'
        ? group('Broj soba', pills(ROOMS.map((r) => r[0]), f.rooms, (v) => go({ rooms: toggle(f.rooms, v) }), (v) => roomLabel(v))) : null,
      group('Stanje', pills(Object.keys(COND), f.cond, (v) => go({ cond: toggle(f.cond, v) }), (v) => COND[v]), false),
      group('Grejanje', pills(Object.keys(HEAT), f.heat, (v) => go({ heat: toggle(f.heat, v) }), (v) => HEAT[v]), false),
      f.t === 'izdavanje' ? group('Nameštenost', pills(Object.keys(FURN), f.furn, (v) => go({ furn: toggle(f.furn, v) }), (v) => FURN[v]), false) : null,
      group('Dodatno', el('div', { class: 'checks' },
        Object.entries(AMEN).map(([k, l]) => el('label', { class: 'chk' },
          el('input', { type: 'checkbox', checked: f.am.includes(k), onchange: () => go({ am: toggle(f.am, k) }) }), l))), false),
      group('Ostalo', el('div', { class: 'checks' },
        el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: f.reg, onchange: () => go({ reg: !f.reg }) }), 'Samo uknjižene nekretnine'),
        el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: f.promo, onchange: () => go({ promo: !f.promo }) }), 'Samo promovisani oglasi'))),
    ),
    el('div', { class: 'rail-foot only-m' },
      el('button', { class: 'btn btn-primary w-full', type: 'button', onclick: (e) => e.currentTarget.closest('.rail').classList.remove('open') },
        `Prikaži ${nf.format(count)} ${oglasa(count)}`)),
  );
}

/* ─────────── detalj oglasa ─────────── */
function viewListing(slug) {
  const l = D.listings.find((x) => x.s === slug);
  if (!l) return el('div', { class: 'wrap block' }, el('h1', {}, 'Oglas nije pronađen'),
    el('p', {}, 'Oglas je možda uklonjen ili je adresa pogrešna.'),
    el('a', { class: 'btn btn-primary', href: '#/pretraga' }, 'Nazad na pretragu'));

  const isRent = l.t === 'izdavanje';
  const T = typeOf(l.pt);
  const place = [l.n, l.m, l.c].filter(Boolean).join(', ');
  const shots = Math.min(l.im, 6);
  let active = 0;

  const stage = el('div', { class: 'gal-stage', html: scene(l.s, kindFor(l.pt, 0), 0) });
  const counter = el('span', { class: 'gal-count' }, `1 / ${shots}`);
  const thumbs = el('div', { class: 'gal-thumbs' }, Array.from({ length: shots }, (_, i) =>
    el('button', {
      type: 'button', class: 'thumb' + (i === 0 ? ' is-on' : ''), 'aria-label': `Fotografija ${i + 1}`,
      html: scene(l.s, kindFor(l.pt, i), i),
      onclick: () => show(i),
    })));
  function show(i) {
    active = (i + shots) % shots;
    stage.innerHTML = scene(l.s, kindFor(l.pt, active), active);
    counter.textContent = `${active + 1} / ${shots}`;
    [...thumbs.children].forEach((t, k) => t.classList.toggle('is-on', k === active));
  }

  const gallery = el('div', { class: 'gal' },
    el('div', { class: 'gal-main' }, stage,
      el('button', { class: 'gal-nav prev', type: 'button', 'aria-label': 'Prethodna fotografija', html: icon('chev', 22), onclick: () => show(active - 1) }),
      el('button', { class: 'gal-nav next', type: 'button', 'aria-label': 'Sledeća fotografija', html: icon('chev', 22), onclick: () => show(active + 1) }),
      counter,
      el('div', { class: 'gal-badges' },
        l.pr !== 'NONE' ? el('span', { class: 'badge badge-' + (l.pr === 'TOP' ? 'top' : l.pr === 'PREMIUM' ? 'prem' : 'ist') }, l.pr === 'TOP' ? 'TOP' : l.pr === 'PREMIUM' ? 'Premium' : 'Istaknuto') : null,
        l.reg ? el('span', { class: 'badge badge-ok' }, 'Uknjižen') : null)),
    thumbs);

  const specRows = [
    ['Kvadratura', m2(l.a)],
    l.la ? ['Površina placa', m2(l.la)] : null,
    l.ro != null ? ['Broj soba', roomLabel(l.ro)] : null,
    l.ba ? ['Kupatila', String(l.ba)] : null,
    l.fl != null ? ['Sprat', floorLabel(l.fl, l.tf)] : null,
    l.y ? ['Godina izgradnje', String(l.y)] : null,
    l.co ? ['Stanje', COND[l.co]] : null,
    l.he ? ['Grejanje', HEAT[l.he]] : null,
    l.fu ? ['Nameštenost', FURN[l.fu]] : null,
    l.or ? ['Orijentacija', ORIENT[l.or] || l.or] : null,
    l.en ? ['Energetski razred', l.en] : null,
    ['Uknjiženost', l.reg ? 'Uknjižen' : 'Nije uknjižen'],
    isRent && l.dep ? ['Depozit', eur(l.dep)] : null,
    ['Broj oglasa', l.r],
  ].filter(Boolean);

  let phoneShown = false;
  const phoneBtn = el('button', { class: 'btn btn-primary w-full', type: 'button' },
    el('span', { html: icon('phone', 18) }), '06• ••• ••• — prikaži broj');
  phoneBtn.addEventListener('click', () => {
    if (phoneShown) return;
    phoneShown = true;
    phoneBtn.innerHTML = icon('phone', 18) + ' 063 ' + (100 + (hash(l.s) % 900)) + ' ' + (1000 + (hash(l.s + 'x') % 9000));
    phoneBtn.classList.add('is-revealed');
  });

  const contact = el('aside', { class: 'contact' },
    el('div', { class: 'contact-who' },
      el('span', { class: 'avatar' }, (l.ag || 'Vlasnik').slice(0, 2).toUpperCase()),
      el('div', {},
        el('strong', {}, l.ag || 'Privatni oglašivač'),
        el('span', { class: 'muted' }, l.ag ? (l.agv ? 'Verifikovana agencija' : 'Agencija') : 'Vlasnik nekretnine'))),
    phoneBtn,
    el('button', { class: 'btn btn-outline w-full', type: 'button', onclick: () => alert('U pravoj aplikaciji ovde se otvara forma za poruku oglašivaču.') }, 'Pošalji poruku'),
    el('button', { class: 'btn btn-outline w-full', type: 'button', onclick: () => alert('U pravoj aplikaciji ovde se zakazuje obilazak nekretnine.') }, 'Zakaži obilazak'),
    el('p', { class: 'safety' }, 'Nikada ne uplaćujte kaparu pre obilaska nekretnine i provere dokumentacije.'),
  );

  const similar = D.listings.filter((x) => x.s !== l.s && x.pt === l.pt && x.t === l.t && x.cs === l.cs)
    .sort((a, b) => Math.abs(a.p - l.p) - Math.abs(b.p - l.p)).slice(0, 3);

  const fav = favs.has(l.s);
  return el('div', { class: 'wrap det' },
    el('nav', { class: 'crumbs', 'aria-label': 'Putanja' },
      el('a', { href: '#/' }, 'Početna'), el('span', { html: icon('chev', 13) }),
      el('a', { href: '#/pretraga?' + new URLSearchParams({ t: l.t, pt: l.pt }) }, `${l.t === 'prodaja' ? 'Prodaja' : 'Izdavanje'} ${T.pl}`),
      el('span', { html: icon('chev', 13) }),
      el('a', { href: '#/pretraga?' + new URLSearchParams({ t: l.t, pt: l.pt, loc: l.cs }) }, l.c),
      el('span', { html: icon('chev', 13) }), el('span', {}, l.ti)),
    gallery,
    el('div', { class: 'det-grid' },
      el('div', { class: 'det-main' },
        el('div', { class: 'det-head' },
          el('div', {},
            el('h1', {}, l.ti),
            el('p', { class: 'det-place' }, el('span', { html: icon('pin', 15) }), place, l.ad ? ' · ' + l.ad : ''),
            el('p', { class: 'det-meta' },
              el('span', { html: icon('eye', 14) }), ` ${nf.format(l.v)} ${plural(l.v, 'pregled', 'pregleda', 'pregleda')}`,
              ' · ', el('span', { html: icon('heart', 14) }), ` ${l.fv} ${plural(l.fv, 'čuvanje', 'čuvanja', 'čuvanja')}`,
              ' · ', daysAgo(l.dz))),
          el('div', { class: 'det-price' },
            el('p', { class: 'price price-xl' }, eur(l.p), isRent ? el('span', { class: 'per' }, '/mes') : null),
            l.ppm && l.pt !== 'zemljiste' ? el('p', { class: 'ppm' }, nf.format(l.ppm) + ' €/m²') : null,
            l.neg ? el('span', { class: 'badge badge-soft' }, 'Cena po dogovoru') : null)),
        el('div', { class: 'det-acts' },
          el('button', {
            class: 'btn btn-outline' + (fav ? ' is-fav' : ''), type: 'button', 'aria-pressed': fav ? 'true' : 'false',
            onclick: () => { if (favs.has(l.s)) favs.delete(l.s); else favs.add(l.s); saveFav(); render(); },
          }, el('span', { html: icon('heart', 17) }), fav ? 'Sačuvano' : 'Sačuvaj'),
          el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { navigator.clipboard?.writeText(location.href); toast('Link je kopiran.'); } }, 'Kopiraj link'),
          el('a', { class: 'btn btn-ghost', href: '#/mapa?c=' + l.cs }, el('span', { html: icon('map', 17) }), 'Prikaži na mapi')),
        el('section', { class: 'panel' }, el('h2', {}, 'Opis'),
          el('div', { class: 'prose' }, l.d.split('\n\n').map((p) => el('p', {}, p)))),
        el('section', { class: 'panel' }, el('h2', {}, 'Detalji nekretnine'),
          el('dl', { class: 'specs-grid' }, specRows.map(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]))),
        l.am.length ? el('section', { class: 'panel' }, el('h2', {}, 'Dodatne pogodnosti'),
          el('ul', { class: 'amen' }, l.am.map((k) => el('li', {}, el('span', { html: icon('check', 15) }), AMEN[k] || k)))) : null,
        el('section', { class: 'panel' }, el('h2', {}, 'Lokacija'),
          el('div', { class: 'minimap', html: miniMap(l) }),
          el('p', { class: 'muted small' }, l.ad ? 'Tačna adresa je prikazana uz saglasnost oglašivača.' : 'Oglašivač je sakrio tačnu adresu — prikazana je približna lokacija.')),
      ),
      contact),
    similar.length ? el('section', { class: 'block' },
      head('Slični oglasi', `Nekretnine iste vrste u lokaciji ${l.c}.`),
      el('div', { class: 'grid3' }, similar.map((x) => card(x)))) : null,
  );
}

function miniMap(l) {
  const r = rng(hash(l.s + 'map'));
  const roads = [];
  for (let i = 0; i < 7; i++) {
    const y = 30 + i * 42 + r() * 14;
    roads.push(`<path d="M0 ${y} Q ${200 + r() * 200} ${y - 30 + r() * 60} 800 ${y - 20 + r() * 40}" stroke="var(--map-road)" stroke-width="${2 + r() * 5}" fill="none"/>`);
  }
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 130 + r() * 30;
    roads.push(`<path d="M${x} 0 Q ${x + r() * 60 - 30} 150 ${x + r() * 80 - 40} 320" stroke="var(--map-road)" stroke-width="${2 + r() * 4}" fill="none"/>`);
  }
  const blocks = [];
  for (let i = 0; i < 26; i++) {
    const x = r() * 760, y = r() * 300, w = 20 + r() * 50, h = 14 + r() * 36;
    blocks.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="2" fill="var(--map-block)"/>`);
  }
  return `<svg viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice" aria-label="Približna lokacija nekretnine">
    <rect width="800" height="320" fill="var(--map-bg)"/>${blocks.join('')}${roads.join('')}
    <circle cx="400" cy="160" r="${l.ad ? 10 : 62}" fill="var(--brand)" opacity="${l.ad ? '1' : '.18'}"/>
    ${l.ad ? '' : '<circle cx="400" cy="160" r="62" fill="none" stroke="var(--brand)" stroke-width="2" stroke-dasharray="6 5"/>'}
    <circle cx="400" cy="160" r="9" fill="var(--brand)"/><circle cx="400" cy="160" r="3.5" fill="#fff"/>
  </svg>`;
}

/* ─────────── mapa ─────────── */
function viewMap(citySlug) {
  const city = D.cities.find((c) => c.s === citySlug) || D.cities.find((c) => c.s === 'beograd') || D.cities[0];
  const items = D.listings.filter((l) => l.cs === city.s).slice(0, 160);
  const lats = items.map((l) => l.lat), lngs = items.map((l) => l.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 900, H = 620, pad = 48;
  const px = (lng) => pad + ((lng - minLng) / Math.max(1e-6, maxLng - minLng)) * (W - pad * 2);
  const py = (lat) => H - pad - ((lat - minLat) / Math.max(1e-6, maxLat - minLat)) * (H - pad * 2);

  const r = rng(hash(city.s));
  const bg = [`<rect width="${W}" height="${H}" fill="var(--map-bg)"/>`];
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = r() * H, w = 30 + r() * 90, h = 20 + r() * 70;
    bg.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="3" fill="var(--map-block)"/>`);
  }
  for (let i = 0; i < 9; i++) {
    const y = r() * H;
    bg.push(`<path d="M0 ${y.toFixed(0)} Q ${(W / 2).toFixed(0)} ${(y + r() * 120 - 60).toFixed(0)} ${W} ${(y + r() * 90 - 45).toFixed(0)}" stroke="var(--map-road)" stroke-width="${(2 + r() * 5).toFixed(1)}" fill="none"/>`);
  }
  bg.push(`<path d="M0 ${(H * 0.62).toFixed(0)} Q ${(W * 0.35).toFixed(0)} ${(H * 0.5).toFixed(0)} ${W} ${(H * 0.72).toFixed(0)}" stroke="var(--map-water)" stroke-width="26" fill="none" opacity=".85"/>`);

  const svg = el('div', { class: 'bigmap', html: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-label="Mapa oglasa u gradu ${city.n}">${bg.join('')}</svg>` });
  const pins = el('div', { class: 'pins' });
  items.forEach((l) => {
    const short = l.p >= 1e6 ? (l.p / 1e6).toFixed(1) + 'M' : l.p >= 1000 ? Math.round(l.p / 1000) + 'k' : String(l.p);
    const p = el('a', {
      class: 'pin' + (l.pr !== 'NONE' ? ' pin-promo' : ''), href: '#/oglas?s=' + l.s,
      style: `left:${(px(l.lng) / W * 100).toFixed(2)}%;top:${(py(l.lat) / H * 100).toFixed(2)}%`,
      title: `${l.ti} — ${eur(l.p)}`,
    }, short + ' €');
    pins.appendChild(p);
  });

  return el('div', { class: 'wrap block' },
    el('div', { class: 'head' },
      el('div', {}, el('h1', {}, 'Pretraga na mapi'),
        el('p', {}, `${items.length} ${oglasa(items.length)} u lokaciji ${city.loc || city.n}. Kliknite na cenu da otvorite oglas.`)),
      el('label', { class: 'sort' }, 'Grad',
        el('select', { class: 'inp', onchange: (e) => setHash('/mapa', { c: e.target.value }) },
          D.cities.filter((c) => c.c > 3).map((c) => el('option', { value: c.s, selected: c.s === city.s }, `${c.n} (${c.c})`))))),
    el('div', { class: 'mapwrap' }, svg, pins,
      el('p', { class: 'map-note' }, 'Prikaz je šematski — u aplikaciji se koristi Leaflet sa OpenStreetMap podlogom, grupisanjem markera i pretragom po vidljivom delu mape.')),
  );
}

/* ─────────── agencije ─────────── */
function agencyCard(a) {
  return el('article', { class: 'agc' },
    el('span', { class: 'agc-logo', style: `--h:${hash(a.s) % 360}` }, a.n.split(' ').slice(0, 2).map((w) => w[0]).join('')),
    el('div', { class: 'agc-b' },
      el('h3', {}, a.n, a.v ? el('span', { class: 'verif', title: 'Verifikovana agencija', html: icon('check', 13) }) : null),
      el('p', { class: 'muted small' }, a.c, a.y ? ` · od ${a.y}.` : ''),
      el('p', { class: 'rate' }, el('span', { class: 'stars', html: icon('star', 14).repeat(Math.round(a.r)) }),
        a.r.toFixed(1), el('span', { class: 'muted' }, ` (${a.rc})`)),
      el('p', { class: 'muted small' }, `${a.lc} ${oglasa(a.lc)} · ${a.ac} ${plural(a.ac, 'agent', 'agenta', 'agenata')}`)),
  );
}
function viewAgencies() {
  const sorted = [...D.agencies].sort((a, b) => (b.v - a.v) || (b.lc - a.lc));
  return el('div', { class: 'wrap block' },
    el('div', { class: 'head' }, el('div', {},
      el('h1', {}, 'Agencije za nekretnine'),
      el('p', {}, `${D.agencies.length} registrovanih agencija sa aktivnim oglasima na portalu.`))),
    el('div', { class: 'grid3' }, sorted.map((a) => el('div', { class: 'agc-wrap' }, agencyCard(a),
      el('p', { class: 'agc-d' }, a.d),
      el('a', { class: 'btn btn-outline w-full', href: '#/pretraga?' + new URLSearchParams({ loc: '' }) }, 'Pogledaj oglase')))),
  );
}

/* ─────────── kalkulator ─────────── */
function viewCalc() {
  const S = { price: 120000, downPct: 20, years: 20, rate: 5.45 };
  const out = el('div', { class: 'calc-out' });

  function calc() {
    const down = S.price * (S.downPct / 100);
    const loan = Math.max(0, S.price - down);
    const n = S.years * 12;
    const i = S.rate / 100 / 12;
    const pay = i === 0 ? loan / n : (loan * i) / (1 - Math.pow(1 + i, -n));
    const total = pay * n;
    const interest = total - loan;
    const fees = S.price * 0.025 + 300 + (loan > 0 ? loan * 0.03 : 0);

    const bars = [];
    let bal = loan;
    const yearly = [];
    for (let y = 0; y < S.years; y++) {
      let pr = 0, ir = 0;
      for (let m = 0; m < 12; m++) { const int = bal * i; const prin = pay - int; bal -= prin; pr += prin; ir += int; }
      yearly.push([pr, ir]);
    }
    const maxY = Math.max(...yearly.map(([a, b]) => a + b));
    const bw = 100 / S.years;
    yearly.forEach(([pr, ir], y) => {
      const hP = (pr / maxY) * 100, hI = (ir / maxY) * 100;
      bars.push(`<g><rect x="${(y * bw + bw * 0.14).toFixed(2)}" y="${(100 - hP - hI).toFixed(2)}" width="${(bw * 0.72).toFixed(2)}" height="${hI.toFixed(2)}" fill="var(--accent)"/><rect x="${(y * bw + bw * 0.14).toFixed(2)}" y="${(100 - hP).toFixed(2)}" width="${(bw * 0.72).toFixed(2)}" height="${hP.toFixed(2)}" fill="var(--brand)"/></g>`);
    });

    out.innerHTML = '';
    out.append(
      el('div', { class: 'calc-hero' },
        el('p', { class: 'calc-label' }, 'Mesečna rata (anuitet)'),
        el('p', { class: 'calc-big' }, eur(pay)),
        el('p', { class: 'calc-sub' }, `Kredit ${eur(loan)} · ${S.years} god · NKS ${S.rate.toFixed(2)}%`)),
      el('dl', { class: 'calc-rows' },
        ...[['Iznos kredita', eur(loan)], ['Učešće', `${eur(down)} (${S.downPct}%)`],
            ['Ukupno plaćeno banci', eur(total)], ['Ukupna kamata', eur(interest)],
            ['Preplata', ((interest / Math.max(1, loan)) * 100).toFixed(1) + '%'],
            ['Jednokratni troškovi', eur(fees)], ['Potrebno pre useljenja', eur(down + fees)],
            ['Preporučena zarada', eur(pay * 2)]]
          .flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])),
      el('div', { class: 'calc-chart' },
        el('p', { class: 'calc-label' }, 'Otplata po godinama'),
        el('div', { class: 'chart', html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Odnos glavnice i kamate po godinama">${bars.join('')}</svg>` }),
        el('p', { class: 'legend' },
          el('span', { class: 'lg lg-b' }, 'Glavnica'), el('span', { class: 'lg lg-a' }, 'Kamata'),
          el('span', { class: 'muted' }, `godina 1 – ${S.years}`))),
    );
  }

  const field = (label, key, min, max, step, fmt) => {
    const num = el('input', { class: 'inp', type: 'number', min, max, step, value: S[key], 'aria-label': label,
      oninput: (e) => { S[key] = Number(e.target.value) || 0; rangeEl.value = S[key]; calc(); } });
    const rangeEl = el('input', { type: 'range', min, max, step, value: S[key], 'aria-label': label + ' (klizač)',
      oninput: (e) => { S[key] = Number(e.target.value); num.value = S[key]; calc(); } });
    return el('div', { class: 'cfield' }, el('label', {}, label, num), rangeEl, fmt ? el('span', { class: 'hint' }, fmt) : null);
  };

  calc();
  return el('div', { class: 'wrap block' },
    el('div', { class: 'head' }, el('div', {},
      el('h1', {}, 'Kalkulator stambenog kredita'),
      el('p', {}, 'Izračunajte mesečnu ratu, ukupnu kamatu i jednokratne troškove kupovine — uključujući porez na prenos apsolutnih prava.'))),
    el('div', { class: 'calc' },
      el('div', { class: 'calc-in panel' },
        el('h2', {}, 'Parametri kredita'),
        field('Cena nekretnine (€)', 'price', 20000, 500000, 5000),
        field('Učešće (%)', 'downPct', 0, 60, 1),
        field('Rok otplate (godina)', 'years', 5, 30, 1),
        field('Nominalna kamatna stopa (%)', 'rate', 2, 9, 0.05, 'Prosek za stambene kredite u Srbiji je oko 5–6%.')),
      out),
  );
}

/* ─────────── sačuvani ─────────── */
function viewSaved() {
  const items = D.listings.filter((l) => favs.has(l.s));
  return el('div', { class: 'wrap block' },
    el('div', { class: 'head' }, el('div', {},
      el('h1', {}, 'Sačuvani oglasi'),
      el('p', {}, items.length ? `${items.length} ${oglasa(items.length)} u vašoj listi.` : 'Lista je prazna.'))),
    items.length
      ? el('div', { class: 'grid3' }, items.map((l) => card(l)))
      : el('div', { class: 'empty' }, el('h3', {}, 'Još niste sačuvali nijedan oglas'),
          el('p', {}, 'Kliknite na srce na kartici oglasa da biste ga sačuvali.'),
          el('a', { class: 'btn btn-primary', href: '#/pretraga' }, 'Pretraži oglase')),
  );
}

/* ─────────── ljuska ─────────── */
function toast(msg) {
  const t = el('div', { class: 'toast', role: 'status' }, msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

const NAV = [
  ['#/pretraga?t=prodaja&pt=stan', 'Prodaja'],
  ['#/pretraga?t=izdavanje&pt=stan', 'Izdavanje'],
  ['#/mapa', 'Mapa'],
  ['#/agencije', 'Agencije'],
  ['#/kalkulator', 'Kalkulator'],
];

function header(path) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return el('header', { class: 'top' },
    el('div', { class: 'wrap top-in' },
      el('a', { class: 'logo', href: '#/', 'aria-label': 'Kvadrat.rs — početna' },
        el('span', { class: 'logo-m', html: icon('house', 20) }),
        el('span', { class: 'logo-t' }, 'Kvadrat', el('span', {}, '.rs'))),
      el('nav', { class: 'nav', 'aria-label': 'Glavna navigacija' },
        NAV.map(([href, label]) => el('a', {
          href, class: 'nav-a' + (path.startsWith('/' + href.split('#/')[1].split('?')[0]) ? ' is-on' : ''),
        }, label))),
      el('div', { class: 'top-r' },
        el('a', { class: 'iconbtn', href: '#/sacuvani', 'aria-label': 'Sačuvani oglasi', html: icon('heart', 19) + (favs.size ? `<span class="dot">${favs.size}</span>` : '') }),
        el('button', {
          class: 'iconbtn', type: 'button', 'aria-label': dark ? 'Uključi svetlu temu' : 'Uključi tamnu temu',
          html: icon(dark ? 'sun' : 'moon', 19),
          onclick: () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem(LS.theme, next); } catch {}
            render();
          },
        }),
        el('button', { class: 'btn btn-accent', type: 'button', onclick: () => toast('Postavljanje oglasa radi u punoj aplikaciji — čarobnjak u 6 koraka.') }, 'Postavi oglas')),
    ));
}

function footer() {
  return el('footer', { class: 'foot' },
    el('div', { class: 'wrap foot-in' },
      el('div', {},
        el('p', { class: 'foot-b' }, 'Kvadrat.rs'),
        el('p', { class: 'muted small' }, 'Interaktivni preview portala za nekretnine. Podaci su generisani i nisu stvarni oglasi.')),
      el('nav', { class: 'foot-nav', 'aria-label': 'Podnožje' },
        NAV.map(([h, l]) => el('a', { href: h }, l)),
        el('a', { href: '#/sacuvani' }, 'Sačuvani')),
    ));
}

function render() {
  const { path, q } = parseHash();
  const app = $('#app');
  const prevScroll = path === lastPath ? window.scrollY : 0;
  lastPath = path;

  let body;
  if (path === '/' || path === '') body = viewHome();
  else if (path === '/pretraga') { F = paramsToFilters(q); body = viewResults(F); }
  else if (path === '/oglas') body = viewListing(q.get('s'));
  else if (path === '/mapa') body = viewMap(q.get('c'));
  else if (path === '/agencije') body = viewAgencies();
  else if (path === '/kalkulator') body = viewCalc();
  else if (path === '/sacuvani') body = viewSaved();
  else body = el('div', { class: 'wrap block' }, el('h1', {}, 'Stranica nije pronađena'),
    el('a', { class: 'btn btn-primary', href: '#/' }, 'Nazad na početnu'));

  app.innerHTML = '';
  app.append(header(path), el('main', { id: 'main' }, body), footer());
  window.scrollTo({ top: prevScroll, behavior: 'instant' in window ? 'auto' : 'auto' });
}
let lastPath = null;

/* ─────────── start ─────────── */
(function boot() {
  try {
    const saved = localStorage.getItem(LS.theme);
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch {}
  if (!location.hash) history.replaceState(null, '', '#/');
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
  render();
})();
