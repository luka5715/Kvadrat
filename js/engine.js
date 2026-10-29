/* Kvadrat.rs — engine: KX.* product logic. Čista logika, bez DOM-a pri učitavanju.
   Sve je determinističko (hash/rng iz core.js); sve što je procena ili demo navedeno je u KX.ledger.
   API: dev/API-engine.md. Ugovor: scratchpad CONTEXT.md ("Engine contract"). */
'use strict';

const KX = (() => {
  /* ─────────── osnovni helperi ─────────── */
  const LS_PROFILE = 'kv.profile';
  const LS_CHECKS = 'kv.checks';
  const EKATASTAR = 'https://katastar.rgz.gov.rs/eKatastarPublic/';
  const data = () => (typeof D !== 'undefined' && D) ? D : (typeof window !== 'undefined' && window.KV) || { listings: [], cities: [], muns: [], agencies: [], articles: [] };
  const all = () => data().listings || [];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const roundTo = (v, step) => Math.round(v / step) * step;
  const median = (arr) => {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const wmedian = (pairs) => { // [[value, weight]]
    if (!pairs.length) return null;
    const s = pairs.slice().sort((a, b) => a[0] - b[0]);
    const tot = s.reduce((t, p) => t + p[1], 0);
    let acc = 0;
    for (const p of s) { acc += p[1]; if (acc >= tot / 2) return p[0]; }
    return s[s.length - 1][0];
  };
  const haversine = (a, b) => {
    if (!a || !b || a.lat == null || b.lat == null) return Infinity;
    const R = 6371, toR = Math.PI / 180;
    const dl = (b.lat - a.lat) * toR, dg = (b.lng - a.lng) * toR;
    const x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dg / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  const deacc = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj');
  const fmtN = (n) => (typeof nf !== 'undefined' ? nf.format(Math.round(n)) : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  const fmtEur = (n) => fmtN(n) + ' €';
  const fmtPct = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',') + ' %';
  const H = (s) => (typeof hash === 'function' ? hash(s) : [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261));
  const R = (seed) => (typeof rng === 'function' ? rng(seed) : (() => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })());
  const has = (l, k) => Array.isArray(l.am) && l.am.includes(k);
  const isNew = (l) => l.co === 'novogradnja' || l.co === 'u-izgradnji';
  const isHome = (l) => l.pt === 'stan' || l.pt === 'kuca' || l.pt === 'vikendica' || l.pt === 'soba';
  const bySlug = new Map();
  const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
  const isoDay = (d) => d.toISOString().slice(0, 10);
  const monthKey = (d) => d.toISOString().slice(0, 7);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  /* ─────────── taksonomija (lokalna, da engine ne zavisi od UI stringova) ─────────── */
  const ROOM_WORDS = [[0.5, 'garsonjera'], [1, 'jednosoban'], [1.5, 'jednoiposoban'], [2, 'dvosoban'], [2.5, 'dvoiposoban'],
    [3, 'trosoban'], [3.5, 'troiposoban'], [4, 'četvorosoban'], [4.5, 'četvoroiposoban'], [5, 'petosoban'], [5.5, 'petoiposoban'],
    [6, 'šestosoban'], [7, 'sedmosoban']];
  const roomWord = (ro) => { const f = ROOM_WORDS.find((r) => r[0] === ro); return f ? f[1] : (ro != null ? ro + '-soban' : null); };
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const PT_NOUN = { stan: ['stan', 'm'], kuca: ['kuća', 'f'], 'poslovni-prostor': ['poslovni prostor', 'm'], zemljiste: ['plac', 'm'], soba: ['soba', 'f'], garaza: ['garaža', 'f'], vikendica: ['vikendica', 'f'] };
  const MUN_LABEL = () => { const m = new Map(); (data().muns || []).forEach((x) => m.set(x.s, x)); return m; };
  const CITY_LABEL = () => { const m = new Map(); (data().cities || []).forEach((x) => m.set(x.s, x)); return m; };
  const AGENCY = () => { const m = new Map(); (data().agencies || []).forEach((x) => m.set(x.s, x)); return m; };

  /* ─────────── profil (localStorage kv.profile) ─────────── */
  const PROFILE_DEFAULTS = {
    income: 0, partnerIncome: 0, obligations: 0, cash: 0, age: 35,
    firstHome: false, household: 1,
    ltv: 0.8, dti: 0.5, ratePct: 5.0, years: 25, financing: 'kredit', nkosk: false,
    agencyFeePct: 2, agencyPayer: 'kupac', taxPayer: 'kupac', vatIncluded: true,
    priceMode: 'oglas', budget: 0, places: [], hidden: new Set(),
  };
  const COST_KEYS = ['cash', 'firstHome', 'household', 'ltv', 'ratePct', 'years', 'financing', 'nkosk', 'agencyFeePct', 'agencyPayer', 'taxPayer', 'vatIncluded'];
  let profileState = null;
  let profileVersion = 0;
  const listeners = new Set();
  const loadProfile = () => {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_PROFILE) || 'null'); } catch { raw = null; }
    const p = { ...PROFILE_DEFAULTS, places: [], hidden: new Set() };
    if (raw && typeof raw === 'object') {
      for (const k of Object.keys(PROFILE_DEFAULTS)) if (raw[k] !== undefined) p[k] = raw[k];
      p.hidden = new Set(Array.isArray(raw.hidden) ? raw.hidden : []);
      p.places = Array.isArray(raw.places) ? raw.places : [];
    }
    return p;
  };
  const saveProfile = (p) => { try { localStorage.setItem(LS_PROFILE, JSON.stringify({ ...p, hidden: [...p.hidden] })); } catch {} };
  const profile = {
    get() { if (!profileState) profileState = loadProfile(); return profileState; },
    set(patch) {
      const cur = profile.get();
      const next = { ...cur, ...patch };
      if (patch.firstHome !== undefined && patch.ltv === undefined && (cur.ltv === 0.8 || cur.ltv === 0.9)) next.ltv = patch.firstHome ? 0.9 : 0.8;
      if (patch.hidden && !(patch.hidden instanceof Set)) next.hidden = new Set(patch.hidden);
      profileState = next;
      profileVersion++;
      memo.cost.clear(); memo.afford.clear();
      saveProfile(next);
      listeners.forEach((fn) => { try { fn(next, patch); } catch (e) { /* listener error must not break the engine */ } });
      return next;
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    reset() { return profile.set({ ...PROFILE_DEFAULTS, places: [], hidden: new Set() }); },
    hasBudget() { const p = profile.get(); return (p.income + p.partnerIncome) > 0 || p.cash > 0; },
    defaults: PROFILE_DEFAULTS,
  };

  const memo = { cost: new Map(), afford: new Map(), fair: new Map(), history: new Map(), trust: new Map(), budget: new Map(), count: new Map() };

  /* ─────────── naslovi ─────────── */
  const locLabel = (l) => {
    const major = l.cs === 'beograd' || l.cs === 'novi-sad' || l.cs === 'nis';
    const a = major ? l.m : l.c, b = l.n;
    if (!a) return b || '';
    if (!b || deacc(a) === deacc(b)) return a;
    return a + ' · ' + b;
  };
  const rok = (l) => { const r = R(H(l.s + ':rok')); const y = 2026 + 1 + Math.floor(r() * 2); return 'Q' + (1 + Math.floor(r() * 4)) + ' ' + y; };
  function titleOf(l) {
    const [noun, g] = PT_NOUN[l.pt] || ['nekretnina', 'f'];
    let head;
    if (l.pt === 'zemljiste') head = 'Plac ' + (l.la || l.a ? fmtN((l.la || l.a) / 100).replace(/^0$/, '1') + ' ari' : '').trim();
    else if (l.ro === 0.5 && l.pt === 'stan') head = 'Garsonjera';
    else if (l.ro != null && (l.pt === 'stan' || l.pt === 'kuca' || l.pt === 'vikendica')) {
      let w = roomWord(l.ro);
      if (g === 'f') w = w.replace(/an$/, 'na');
      head = cap(w) + ' ' + noun;
    } else head = cap(noun);
    const parts = [head];
    if (l.pt !== 'zemljiste' && l.a) parts.push(fmtN(l.a) + ' m²');
    const loc = locLabel(l);
    if (loc) parts.push(loc);
    if (l.t === 'izdavanje') parts.push(fmtN(l.p) + ' €/mes');
    if (l.co === 'u-izgradnji') parts.push('u izgradnji, rok ' + rok(l));
    else if (l.co === 'novogradnja' && l.t === 'prodaja') parts.push('novogradnja');
    return parts.join(', ');
  }

  /* ─────────── indeksi (enrich) ─────────── */
  const idx = { ready: false, byTP: new Map(), ppmMun: new Map(), ppmNbhd: new Map(), ppmCity: new Map(), dzMun: new Map(), dzCity: new Map(), dupes: new Map(), groups: [], muns: null, cities: null, agencies: null, dupesCount: 0 };
  const keyTP = (l) => l.t + '|' + l.pt;
  function buildIndexes() {
    idx.byTP.clear(); idx.ppmMun.clear(); idx.ppmNbhd.clear(); idx.ppmCity.clear(); idx.dzMun.clear(); idx.dzCity.clear();
    bySlug.clear();
    const push = (m, k, v) => { let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push(v); };
    for (const l of all()) {
      bySlug.set(l.s, l);
      push(idx.byTP, keyTP(l), l);
      if (l.ppm > 0) {
        push(idx.ppmMun, keyTP(l) + '|' + l.ms, l.ppm);
        push(idx.ppmNbhd, keyTP(l) + '|' + l.ns, l.ppm);
        push(idx.ppmCity, keyTP(l) + '|' + l.cs, l.ppm);
      }
      push(idx.dzMun, keyTP(l) + '|' + l.ms, l.dz);
      push(idx.dzCity, keyTP(l) + '|' + l.cs, l.dz);
    }
    idx.muns = MUN_LABEL(); idx.cities = CITY_LABEL(); idx.agencies = AGENCY();
  }
  const medOf = (map, k, min = 5) => { const a = map.get(k); return a && a.length >= min ? { median: median(a), n: a.length } : null; };
  /* medijan €/m² za oglas: naselje → opština → grad (min n), vraća {median, n, scope, label} */
  function medianPpm(l, min = 5, scopes = ['nbhd', 'mun', 'city']) {
    const k = keyTP(l);
    for (const sc of scopes) {
      const r = sc === 'nbhd' ? medOf(idx.ppmNbhd, k + '|' + l.ns, min) : sc === 'mun' ? medOf(idx.ppmMun, k + '|' + l.ms, min) : medOf(idx.ppmCity, k + '|' + l.cs, min);
      if (r) return { ...r, scope: sc, label: sc === 'nbhd' ? l.n : sc === 'mun' ? l.m : l.c };
    }
    return null;
  }
  function medianDz(l) {
    const k = keyTP(l);
    return medOf(idx.dzMun, k + '|' + l.ms, 5) && { ...medOf(idx.dzMun, k + '|' + l.ms, 5), scope: 'mun', label: l.m }
      || medOf(idx.dzCity, k + '|' + l.cs, 5) && { ...medOf(idx.dzCity, k + '|' + l.cs, 5), scope: 'city', label: l.c }
      || { median: median(all().filter((x) => x.t === l.t).map((x) => x.dz)) || 30, n: all().length, scope: 'all', label: 'Srbiji' };
  }
  /* Δ čip: €/m² naspram medijana opštine (isti t+pt), null kada je n < 5 (spec 5.7) */
  function ppmDelta(l) {
    if (!(l.ppm > 0)) return null;
    const r = medOf(idx.ppmMun, keyTP(l) + '|' + l.ms, 5);
    if (!r) return null;
    const pct = (l.ppm / r.median - 1) * 100;
    const dir = Math.abs(pct) < 1.5 ? 'flat' : pct > 0 ? 'up' : 'down';
    const label = dir === 'flat' ? `u proseku za ${l.m} (${fmtN(r.median)} €/m²)` : `${fmtPct(Math.abs(pct))} ${pct > 0 ? 'iznad' : 'ispod'} proseka za ${l.m} (${fmtN(r.median)} €/m²)`;
    return { pct, median: r.median, n: r.n, dir, label, scope: 'mun' };
  }

  /* ─────────── duplikati ─────────── */
  /* Ključ: isti t, pt, grad, opština, struktura; |Δm²| ≤ 2; sprat jednak (null = džoker) ili ±1 uz istu godinu; različit oglašivač.
     'sigurno' = isto naselje, |Δm²| ≤ 1, isti sprat; inače 'moguće'. Nijedan oglas nije izmišljen. */
  const dupeMatch = (a, b) => {
    if (a.t !== b.t || a.pt !== b.pt || a.cs !== b.cs || a.ms !== b.ms || a.ro !== b.ro) return null;
    if ((a.ags || null) === (b.ags || null)) return null;           // isti oglašivač nije duplikat; dva vlasnika takođe ne
    if (!(a.a > 0) || !(b.a > 0) || Math.abs(a.a - b.a) > 2) return null;
    const flEq = a.fl == null || b.fl == null || a.fl === b.fl;
    const flNear = a.fl != null && b.fl != null && Math.abs(a.fl - b.fl) === 1 && a.y != null && b.y != null && a.y === b.y;
    if (!flEq && !flNear) return null;
    if (a.y != null && b.y != null && Math.abs(a.y - b.y) > 2) return null;
    if (haversine(a, b) > 3) return null;
    const strict = a.ns === b.ns && Math.abs(a.a - b.a) <= 1 && a.fl != null && a.fl === b.fl;
    return strict ? 'sigurno' : 'moguce';
  };
  function buildDupes() {
    const r = groupList(all());
    idx.dupes = r.map; idx.groups = r.groups; idx.dupesCount = r.groups.length;
  }
  /* čista funkcija: grupiše proizvoljnu listu oglasa (koristi se i u testovima) */
  function groupList(list) {
    const map = new Map(), groups = [];
    const local = new Map(); list.forEach((l) => local.set(l.s, l));
    const buckets = new Map();
    for (const l of list) {
      if (l.pt !== 'stan' && l.pt !== 'kuca') continue;
      if (l.ro == null || !(l.a > 0)) continue;
      const k = l.t + '|' + l.pt + '|' + l.cs + '|' + l.ms + '|' + l.ro;
      let b = buckets.get(k); if (!b) { b = []; buckets.set(k, b); }
      b.push(l);
    }
    const parent = new Map();
    const find = (s) => { let p = parent.get(s); if (p == null) { parent.set(s, s); return s; } if (p !== s) { p = find(p); parent.set(s, p); } return p; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    const conf = new Map();
    for (const b of buckets.values()) {
      if (b.length < 2) continue;
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
        const c = dupeMatch(b[i], b[j]);
        if (!c) continue;
        union(b[i].s, b[j].s);
        const key = b[i].s < b[j].s ? b[i].s + '|' + b[j].s : b[j].s + '|' + b[i].s;
        conf.set(key, c);
      }
    }
    const members = new Map();
    for (const s of parent.keys()) { const r = find(s); let a = members.get(r); if (!a) { a = []; members.set(r, a); } a.push(local.get(s)); }
    let id = 0;
    for (const arr of members.values()) {
      if (arr.length < 2) continue;
      arr.sort((x, y) => x.p - y.p || x.dz - y.dz || (x.s < y.s ? -1 : 1));
      id++;
      let confidence = 'moguce';
      for (let i = 0; i < arr.length && confidence !== 'sigurno'; i++) for (let j = i + 1; j < arr.length; j++) {
        const key = arr[i].s < arr[j].s ? arr[i].s + '|' + arr[j].s : arr[j].s + '|' + arr[i].s;
        if (conf.get(key) === 'sigurno') { confidence = 'sigurno'; break; }
      }
      const g = {
        id: 'dup-' + id,
        master: arr[0].s,
        confidence,
        offers: arr.map((l) => ({ s: l.s, r: l.r, ag: l.ag || 'Vlasnik', ags: l.ags || null, p: l.p, ppm: l.ppm, dz: l.dz, agv: !!l.agv, owner: !l.ags, fl: l.fl, a: l.a, y: l.y })),
        span: { min: arr[0].p, max: arr[arr.length - 1].p },
        saving: arr[arr.length - 1].p - arr[0].p,
        daysMin: Math.min(...arr.map((l) => l.dz)),
        daysMax: Math.max(...arr.map((l) => l.dz)),
        ownerPosing: arr.some((l) => !l.ags) && arr.some((l) => l.ags),
      };
      groups.push(g);
      arr.forEach((l) => map.set(l.s, g));
    }
    return { groups, map };
  }
  const dupes = {
    match: dupeMatch,
    build: (list) => groupList(list).groups,
    groupOf: (slug) => idx.dupes.get(slug) || null,
    isSecondary: (slug) => { const g = idx.dupes.get(slug); return !!g && g.master !== slug; },
    groups: () => idx.groups.slice(),
    count: () => idx.dupesCount,
    hiddenCount: () => idx.groups.reduce((t, g) => t + g.offers.length - 1, 0),
  };

  /* ─────────── troškovi: tarife (demo konstante, sve u ledger-u) ─────────── */
  const TARIFF = {
    transferTaxPct: 2.5, vatPct: 10, feeVatPct: 20,
    notarBands: [[30000, 120], [60000, 180], [120000, 260], [200000, 340], [400000, 480], [Infinity, 650]],
    registry: 45, appraisal: 120, loanProcPct: 0.5, nkoskPct: [[0.7, 1.5], [0.8, 2.5], [1, 3.5]], homeInsurance: 40,
    rentalNotary: 30, movingBase: 120, movingPerM2: 2, renovPerM2: 150,
    cgPerM2: 1.15, heatPerM2: { etazno: 0.85, gas: 0.8, kotlarnica: 0.8, podno: 0.85, 'toplotna-pumpa': 0.45, pelet: 0.7, struja: 1.0, klima: 0.9, 'ta-pec': 1.05, null: 0.9 },
    enMul: { 'A+': 0.55, A: 0.65, B: 0.8, C: 1, D: 1.15, E: 1.3, F: 1.5, G: 1.7, null: 1 },
    powerBase: 20, powerPerM2: 0.3, waterBase: 8, waterPerM2: 0.2, hoaLift: 0.25, hoaNoLift: 0.12, hoaBase: 5,
    propTaxRate: 0.004, propTaxAmortMax: 0.4, propTaxCreditCapEur: 170, rgzFactor: 0.85,
  };
  const notar = (v) => TARIFF.notarBands.find((b) => v <= b[0])[1];
  const annuity = (loan, ratePct, years) => {
    if (!(loan > 0) || !(years > 0)) return 0;
    const i = ratePct / 100 / 12, n = years * 12;
    return i === 0 ? loan / n : loan * i / (1 - Math.pow(1 + i, -n));
  };
  const maxLoanFor = (rata, ratePct, years) => { const i = ratePct / 100 / 12, n = years * 12; return i === 0 ? rata * n : rata * (1 - Math.pow(1 + i, -n)) / i; };
  const nkoskPct = (ltv) => (TARIFF.nkoskPct.find((b) => ltv <= b[0] + 1e-9) || TARIFF.nkoskPct[2])[1];

  const line = (key, label, amount, when, payer, extra = {}) => ({ key, label, amount: Math.round(amount), when, payer, optional: false, note: '', estimate: false, ...extra });

  /* mesečni računi (procena) — zajedničko za kupovinu i zakup */
  function utilities(l) {
    const out = [];
    const a = l.a > 0 ? l.a : 0;
    if (!a) return out;
    if (isHome(l)) {
      let heat;
      if (l.he === 'centralno') heat = line('grejanje', 'Grejanje — centralno (Infostan, 12 meseci)', TARIFF.cgPerM2 * a, 'mesecno', 'kupac', { estimate: true, note: 'Procena: 1,15 €/m² mesečno, naplaćuje se cele godine.' });
      else {
        let m = (TARIFF.heatPerM2[l.he] ?? TARIFF.heatPerM2.null) * (TARIFF.enMul[l.en] ?? 1);
        if (l.fl != null && l.tf && l.fl === l.tf) m *= 1.1;
        if (l.fl === 0) m *= 1.05;
        if (l.or === 'sever') m *= 1.05;
        const lbl = l.he ? (typeof HEAT !== 'undefined' && HEAT[l.he]) || l.he : 'grejanje nije navedeno';
        heat = line('grejanje', 'Grejanje — ' + lbl.toLowerCase() + ' (prosek godine)', m * a, 'mesecno', 'kupac', { estimate: true, note: 'Godišnja potrošnja podeljena na 12; zimi ≈ 2,2× proseka, leti 0.', winter: Math.round(m * a * 2.2), summer: 0 });
      }
      out.push(heat);
      out.push(line('struja', 'Struja (bez grejanja)', TARIFF.powerBase + TARIFF.powerPerM2 * a, 'mesecno', 'kupac', { estimate: true, note: 'Procena: 20 € + 0,30 €/m².' }));
      out.push(line('komunalije', 'Voda, smeće, ekologija', TARIFF.waterBase + TARIFF.waterPerM2 * a, 'mesecno', 'kupac', { estimate: true, note: 'Procena: 8 € + 0,20 €/m².' }));
      out.push(line('odrzavanje', 'Stambena zajednica (održavanje, lift)', (has(l, 'hasElevator') ? TARIFF.hoaLift : TARIFF.hoaNoLift) * a + TARIFF.hoaBase, 'mesecno', 'kupac', { estimate: true, note: 'Procena po Zakonu o stanovanju: 0,12 €/m² (0,25 sa liftom) + 5 €.' }));
    } else if (l.pt === 'poslovni-prostor') {
      out.push(line('struja', 'Struja', TARIFF.powerBase + 0.6 * a, 'mesecno', 'kupac', { estimate: true, note: 'Procena: 20 € + 0,60 €/m² (poslovna tarifa).' }));
      out.push(line('komunalije', 'Voda, smeće, ekologija', TARIFF.waterBase + 0.25 * a, 'mesecno', 'kupac', { estimate: true }));
    }
    return out;
  }
  /* porez na imovinu — gruba procena (prava formula: m² × prosečna cena zone × (1 − amortizacija) × 0,4 %, −50 % za stanovanje, maks. 20.000 RSD) */
  function propertyTax(l) {
    if (l.pt === 'zemljiste' || !(l.a > 0)) return null;
    const ref = medianPpm({ ...l, t: 'prodaja', pt: l.pt === 'kuca' || l.pt === 'vikendica' ? 'kuca' : 'stan' }, 5, ['mun', 'city']) || medianPpm({ ...l, t: 'prodaja', pt: 'stan' }, 5, ['mun', 'city']);
    const zone = (ref ? ref.median : 1400) * TARIFF.rgzFactor * (l.pt === 'garaza' ? 0.35 : 1);
    const age = l.y ? Math.max(0, today().getFullYear() - l.y) : 20;
    const base = l.a * zone * (1 - Math.min(TARIFF.propTaxAmortMax, 0.01 * age));
    let annual = base * TARIFF.propTaxRate;
    if (isHome(l)) annual -= Math.min(annual * 0.5, TARIFF.propTaxCreditCapEur);
    return line('porez-imovina', 'Porez na imovinu (gruba procena)', annual / 12, 'mesecno', 'kupac', { estimate: true, note: `Gruba procena: ${fmtN(l.a)} m² × ${fmtN(zone)} €/m² (prosek zone) × (1 − amortizacija ${Math.round(Math.min(40, age))} %) × 0,4 %${isHome(l) ? ', umanjeno 50 % za stanovanje (maks. 20.000 RSD)' : ''}, podeljeno na 12.` });
  }

  /* ─────────── KX.cost ─────────── */
  function cost(l, prof) {
    const useMemo = !prof;
    const P = prof ? { ...profile.get(), ...prof } : profile.get();
    if (prof && prof.firstHome !== undefined && prof.ltv === undefined && (P.ltv === 0.8 || P.ltv === 0.9)) P.ltv = prof.firstHome ? 0.9 : 0.8;
    const mk = useMemo ? l.s : null;
    if (useMemo && memo.cost.has(mk)) return memo.cost.get(mk);
    const res = l.t === 'izdavanje' ? costRental(l, P) : costSale(l, P);
    if (useMemo) memo.cost.set(mk, res);
    return res;
  }
  function totals(lines) {
    const counts = (x) => !x.optional && x.payer !== 'prodavac' && x.payer !== 'vlasnik';
    const sum = (when) => lines.filter((x) => x.when === when && counts(x)).reduce((t, x) => t + x.amount, 0);
    const onPurchase = sum('kupovina'), moveIn = sum('useljenje'), monthly = sum('mesecno');
    const laterInflow = -lines.filter((x) => x.when === 'kasnije').reduce((t, x) => t + Math.min(0, x.amount), 0);
    const optional = {};
    lines.filter((x) => x.optional).forEach((x) => { optional[x.when] = (optional[x.when] || 0) + x.amount; });
    return { onPurchase, moveIn, monthly, laterInflow, total: onPurchase + moveIn, optional };
  }
  function costSale(l, P) {
    const p = l.p, a = l.a > 0 ? l.a : 0;
    const lines = [], assumptions = [];
    const newBuild = isNew(l);
    const vatIn = newBuild ? P.vatIncluded !== false : false;
    const netPrice = newBuild ? (vatIn ? p / (1 + TARIFF.vatPct / 100) : p) : p;
    const grossPrice = newBuild ? (vatIn ? p : p * (1 + TARIFF.vatPct / 100)) : p;
    lines.push(line('cena', 'Cena iz oglasa', p, 'kupovina', 'kupac', { note: newBuild && vatIn ? `Uključuje PDV 10 % (${fmtEur(p - netPrice)}).` : '' }));
    /* porez: PDV (novogradnja) ili porez na prenos 2,5 % */
    const exemptM2 = P.firstHome ? 40 + 15 * Math.max(0, (P.household || 1) - 1) : 0;
    const eligibleM2 = P.firstHome && a ? Math.min(a, exemptM2) : 0;
    const share = a ? eligibleM2 / a : 0;
    let firstHome = { eligible: !!P.firstHome, exemptM2, eligibleM2, sharePct: Math.round(share * 100), saving: 0, when: null };
    if (newBuild) {
      const vat = grossPrice - netPrice;
      lines.push(line('pdv', 'PDV 10 % (prva prodaja novogradnje)', vatIn ? 0 : vat, 'kupovina', 'kupac', { included: vatIn, inPrice: vatIn ? Math.round(vat) : 0, note: vatIn ? 'Investitori oglašavaju cene sa PDV-om; PDV je već u ceni iz oglasa.' : 'Cena je označena kao cena bez PDV-a, pa se PDV dodaje.' }));
      if (P.firstHome && a) {
        const refund = netPrice * TARIFF.vatPct / 100 * share;
        firstHome = { ...firstHome, saving: Math.round(refund), when: 'kasnije' };
        lines.push(line('pdv-povracaj', `Povraćaj PDV-a za prvi stan (${fmtN(eligibleM2)} od ${fmtN(a)} m²)`, -refund, 'kasnije', 'kupac', { note: 'Samo za prvu kupovinu od investitora, državljanin bez stana od 1. 7. 2006, obrazac RFN; stiže ≈ 45 dana posle isplate — ne smanjuje novac potreban na dan kupovine.' }));
      }
      assumptions.push('Novogradnja: umesto poreza na prenos plaća se PDV 10 %, koji je po pravilu već u oglašenoj ceni.');
    } else {
      const tax = p * TARIFF.transferTaxPct / 100;
      const relief = P.firstHome && a ? tax * share : 0;
      lines.push(line('porez', 'Porez na prenos apsolutnih prava 2,5 %', tax, 'kupovina', P.taxPayer || 'kupac', { note: 'Zakonski obveznik je prodavac; ugovorom se gotovo uvek prebacuje na kupca. Poreska uprava može osnovicu podići na tržišnu vrednost.' }));
      if (relief > 0) {
        firstHome = { ...firstHome, saving: Math.round(relief), when: 'kupovina' };
        lines.push(line('prvi-stan', `Oslobođenje za prvi stan (${fmtN(eligibleM2)} od ${fmtN(a)} m²)`, -relief, 'kupovina', P.taxPayer || 'kupac', { note: '40 m² za kupca + 15 m² po članu domaćinstva; smanjuje porez na dan kupovine.' }));
      }
      assumptions.push('Starogradnja: porez na prenos 2,5 % od ugovorene cene.');
    }
    /* provizija */
    if (l.ags) {
      const pct = P.agencyFeePct ?? 2;
      const fee = p * pct / 100, feeVat = fee * TARIFF.feeVatPct / 100;
      lines.push(line('provizija', `Provizija agencije ${String(pct).replace('.', ',')} % + PDV`, fee + feeVat, 'kupovina', P.agencyPayer || 'kupac', { net: Math.round(fee), vat: Math.round(feeVat), note: 'Zakon ne propisuje stopu; praksa je 2–3 % + PDV 20 %. Plaća onaj ko je potpisao posrednički ugovor — agencija mora da istakne iznos i ko plaća.' }));
    } else lines.push(line('provizija', 'Bez provizije (oglas vlasnika)', 0, 'kupovina', 'kupac'));
    /* notar, upis */
    lines.push(line('notar', 'Overa ugovora kod javnog beležnika', notar(p), 'kupovina', 'kupac', { estimate: true, note: 'Tarifa po vrednosti ugovora (razredi: 120–650 €), približno.' }));
    lines.push(line('upis', 'Upis u katastar i takse', TARIFF.registry, 'kupovina', 'kupac', { estimate: true }));
    /* kredit */
    const ltv = clamp(P.ltv ?? 0.8, 0.1, 0.95);
    const preLoan = lines.filter((x) => x.when === 'kupovina' && !x.optional && x.payer !== 'prodavac').reduce((t, x) => t + x.amount, 0);
    let loan = 0;
    if (P.financing !== 'kes') loan = P.cash > 0 ? clamp(preLoan - P.cash, 0, ltv * p) : ltv * p;
    loan = Math.round(loan);
    if (loan > 0) {
      lines.push(line('procena', 'Procena vrednosti nekretnine (banka)', TARIFF.appraisal, 'kupovina', 'kupac', { estimate: true }));
      lines.push(line('obrada', 'Obrada kredita 0,5 %', loan * TARIFF.loanProcPct / 100, 'kupovina', 'kupac', { estimate: true }));
      const actualLtv = loan / p;
      lines.push(line('nkosk', `Premija NKOSK ${String(nkoskPct(actualLtv)).replace('.', ',')} % (ako banka traži)`, loan * nkoskPct(actualLtv) / 100, 'kupovina', 'kupac', { optional: !P.nkosk, estimate: true, note: 'Osiguranje kredita kod NKOSK traže samo neke banke; premija raste sa LTV (1,5–3,5 %).' }));
      lines.push(line('osiguranje', 'Osiguranje nekretnine (prva godina)', TARIFF.homeInsurance, 'kupovina', 'kupac', { estimate: true }));
      assumptions.push(`Kredit: LTV ${Math.round(ltv * 100)} % (${P.firstHome ? 'prvi stan — NBS dozvoljava 90 %' : 'uobičajeno 80 %'}), ${String(P.ratePct).replace('.', ',')} % NKS, ${P.years} god.`);
    } else assumptions.push('Kupovina za keš — bez bankarskih troškova.');
    /* useljenje */
    if (isHome(l) && a) {
      lines.push(line('selidba', 'Selidba i sitne popravke', TARIFF.movingBase + TARIFF.movingPerM2 * a, 'useljenje', 'kupac', { estimate: true, note: 'Procena: 120 € + 2 €/m².' }));
      if (l.co === 'potrebno-renoviranje') lines.push(line('adaptacija', 'Rezerva za renoviranje (opciono)', TARIFF.renovPerM2 * a, 'useljenje', 'kupac', { optional: true, estimate: true, note: 'Procena 150 €/m² za stan koji zahteva renoviranje.' }));
    }
    /* mesečno */
    const years = P.years || 25, ratePct = P.ratePct ?? 5;
    if (loan > 0) lines.push(line('rata', 'Rata kredita', annuity(loan, ratePct, years), 'mesecno', 'kupac', { note: `Anuitet za ${fmtEur(loan)}, ${String(ratePct).replace('.', ',')} %, ${years} god.` }));
    utilities(l).forEach((x) => lines.push(x));
    const pt = propertyTax(l); if (pt) lines.push(pt);
    if (loan > 0) lines.push(line('osiguranje-mes', 'Osiguranje stana (mesečno)', TARIFF.homeInsurance / 12, 'mesecno', 'kupac', { estimate: true }));
    if (!isHome(l) && l.pt !== 'poslovni-prostor') assumptions.push('Mesečni računi se ne procenjuju za ovaj tip nekretnine.');
    const t = totals(lines);
    const utilLines = lines.filter((x) => x.when === 'mesecno' && x.key !== 'rata');
    const winter = t.monthly + utilLines.reduce((s, x) => s + ((x.winter ?? x.amount) - x.amount), 0);
    const summer = t.monthly + utilLines.reduce((s, x) => s + ((x.summer ?? x.amount) - x.amount), 0);
    return {
      kind: 'prodaja', price: p, netPrice: Math.round(netPrice), priceIncludesVat: newBuild ? vatIn : null, taxMode: newBuild ? 'pdv' : 'prenos',
      lines, ...t, monthlyWinter: Math.round(winter), monthlySummer: Math.round(summer),
      loan, downPayment: Math.max(0, p - loan), ltv: p ? loan / p : 0, cashOnDay: t.onPurchase - loan + t.moveIn,
      fees: t.onPurchase - p, firstHome, assumptions,
    };
  }
  function costRental(l, P) {
    const p = l.p, lines = [], assumptions = [];
    lines.push(line('kirija', 'Prva kirija', p, 'useljenje', 'zakupac'));
    const dep = l.dep != null ? l.dep : p;
    lines.push(line('depozit', `Depozit (${dep >= 2 * p ? '2 kirije' : dep > p ? fmtEur(dep) : '1 kirija'})`, dep, 'useljenje', 'zakupac', { refundable: true, note: 'Vraća se pri iseljenju — zamrznut novac, ne trošak.' }));
    const ag = l.ags ? idx.agencies.get(l.ags) : null;
    if (!l.ags) lines.push(line('provizija', 'Bez provizije (oglas vlasnika)', 0, 'useljenje', 'zakupac', { payerLabel: 'nema agencije' }));
    else if (ag && ag.pm === false) lines.push(line('provizija', 'Provizija agencije 50 % kirije — plaća vlasnik', p * 0.5, 'useljenje', 'vlasnik', { note: 'Agencija naplaćuje proviziju vlasniku, zakupac ne plaća.' }));
    else lines.push(line('provizija', 'Provizija agencije 50 % kirije', p * 0.5, 'useljenje', 'zakupac', { note: 'Praksa: 40–50 % prve kirije; ko plaća zavisi od ugovora sa agencijom.' }));
    lines.push(line('overa', 'Overa ugovora o zakupu', TARIFF.rentalNotary, 'useljenje', 'zakupac', { estimate: true, note: 'Nije obavezna, ali je preporučena (i uslov za prijavu boravka).' }));
    lines.push(line('kirija-mes', 'Kirija', p, 'mesecno', 'zakupac'));
    const util = utilities(l).map((x) => ({ ...x, payer: 'zakupac' }));
    util.forEach((x) => lines.push(x));
    const t = totals(lines);
    const winter = t.monthly + util.reduce((s, x) => s + ((x.winter ?? x.amount) - x.amount), 0);
    const summer = t.monthly + util.reduce((s, x) => s + ((x.summer ?? x.amount) - x.amount), 0);
    assumptions.push('Depozit je povratan; provizija se plaća jednom.');
    if (!util.length) assumptions.push('Računi se ne procenjuju za ovaj tip nekretnine.');
    return { kind: 'izdavanje', price: p, lines, ...t, refundable: dep, nonRefundable: t.moveIn - dep, monthlyWinter: Math.round(winter), monthlySummer: Math.round(summer), bills: Math.round(t.monthly - p), assumptions };
  }

  /* ─────────── KX.afford ─────────── */
  const FINANCEABLE = { uknjizeno: 'da', 'u-procesu': 'zavisi', 'poseban-zakon': 'zavisi', ozakonjenje: 'ne', nije: 'ne' };
  function creditCapacity(P = profile.get()) {
    const income = (P.income || 0) + (P.partnerIncome || 0);
    const years = Math.max(5, Math.min(P.years || 25, 70 - (P.age || 35)));
    const maxRata = Math.max(0, (P.dti ?? 0.5) * income - (P.obligations || 0));
    const maxLoan = income > 0 && 70 - (P.age || 35) >= 5 ? maxLoanFor(maxRata, P.ratePct ?? 5, years) : 0;
    const ltv = P.ltv ?? 0.8;
    const cash = P.cash || 0;
    /* maks. cena: ograničena LTV-om (keš mora pokriti učešće + ~6 % troškova) i kapacitetom kredita */
    const byLtv = cash / (1 - ltv + 0.06), byLoan = (cash + maxLoan) / 1.06;
    const maxPrice = Math.max(0, Math.round(Math.min(byLtv, byLoan)));
    return { income, maxRata: Math.round(maxRata), maxLoan: Math.round(maxLoan), years, ratePct: P.ratePct ?? 5, ltv, dti: P.dti ?? 0.5, maxPrice, cash, creditPossible: income > 0 && maxLoan > 0 };
  }
  function afford(l, prof) {
    const useMemo = !prof;
    if (useMemo && memo.afford.has(l.s)) return memo.afford.get(l.s);
    const P = prof ? { ...profile.get(), ...prof } : profile.get();
    const r = affordCalc(l, P);
    if (useMemo) memo.afford.set(l.s, r);
    return r;
  }
  function affordCalc(l, P) {
    const tr = trust(l);
    const legal = tr.legal;
    let financeable = l.pt === 'zemljiste' ? 'ne' : FINANCEABLE[legal] || 'zavisi';
    if (l.co === 'u-izgradnji' && financeable === 'da') financeable = 'zavisi';
    const gate = { legal, financeable };
    const base = { state: 'nepoznato', label: 'Unesi budžet', reason: 'Unesi platu i keš da vidiš da li se stan uklapa.', maxLoan: 0, monthly: 0, dtiUsed: 0, gate, loanNeeded: 0, cashAllIn: 0 };
    if (l.t !== 'prodaja') return { ...base, reason: 'Procena budžeta važi samo za prodaju.' };
    const income = (P.income || 0) + (P.partnerIncome || 0), cash = P.cash || 0;
    if (income <= 0 && cash <= 0) return base;
    const Ckes = cost(l, { ...P, financing: 'kes' });
    const cashAllIn = Ckes.onPurchase;
    const fees = cashAllIn - l.p;
    const cap = creditCapacity(P);
    const out = { ...base, maxLoan: cap.maxLoan, cashAllIn, fees: Math.round(fees) };
    if (cash >= cashAllIn) return { ...out, state: 'odmah', label: 'Možeš odmah', reason: `Keš ${fmtEur(cash)} pokriva cenu i troškove (${fmtEur(cashAllIn)}).` };
    if (financeable === 'ne') return { ...out, state: 'samo-kes', label: 'Samo keš', reason: legal === 'ozakonjenje' ? 'U postupku ozakonjenja — banke ne finansiraju.' : legal === 'nije' ? 'Nije uknjiženo — banke ne finansiraju.' : 'Banke po pravilu ne finansiraju zemljište.', missing: Math.round(cashAllIn - cash) };
    if (P.financing === 'kes') return { ...out, state: 'van-budzeta', label: 'Van budžeta', reason: `Za keš kupovinu nedostaje ${fmtEur(cashAllIn - cash)}.`, missing: Math.round(cashAllIn - cash) };
    if (cash < fees) return { ...out, state: 'van-budzeta', label: 'Van budžeta', reason: `Nedostaje ${fmtEur(fees - cash)} za troškove kupovine (${fmtEur(fees)}).`, missing: Math.round(fees - cash) };
    const loanNeeded = Math.round(l.p - (cash - fees));
    const ltv = cap.ltv;
    const maxByLtv = ltv * l.p;
    if (loanNeeded > maxByLtv + 1) return { ...out, state: 'van-budzeta', label: 'Van budžeta', reason: `Nedostaje ${fmtEur(loanNeeded - maxByLtv)} učešća (banka finansira do ${Math.round(ltv * 100)} %).`, loanNeeded, missing: Math.round(loanNeeded - maxByLtv) };
    if (!cap.creditPossible) return { ...out, state: 'van-budzeta', label: 'Van budžeta', reason: income <= 0 ? 'Bez prihoda kredit nije moguć; za keš nedostaje ' + fmtEur(cashAllIn - cash) + '.' : 'Kredit nije moguć zbog godina — prikazujemo samo keš.', loanNeeded };
    const monthly = Math.round(annuity(loanNeeded, cap.ratePct, cap.years));
    if (loanNeeded > cap.maxLoan) return { ...out, state: 'van-budzeta', label: 'Van budžeta', reason: `Rata bi bila ${fmtEur(monthly)}, maksimum je ${fmtEur(cap.maxRata)} (${Math.round(cap.dti * 100)} % prihoda).`, loanNeeded, monthly, dtiUsed: income ? monthly / income : 0 };
    const zavisi = financeable === 'zavisi';
    return {
      ...out, state: 'kredit', label: `Rata ${fmtEur(monthly)}`, loanNeeded, monthly, dtiUsed: income ? monthly / income : 0,
      reason: `Kredit ${fmtEur(loanNeeded)} na ${cap.years} god. uz ${String(cap.ratePct).replace('.', ',')} % — rata ${fmtEur(monthly)} (${Math.round(monthly / income * 100)} % prihoda).` + (zavisi ? (legal === 'poseban-zakon' ? ' Upis po Zakonu 2025 — finansiranje zavisi od banke.' : legal === 'u-procesu' ? ' Uknjižba u toku — finansiranje zavisi od banke.' : ' Stan u izgradnji — kredit zavisi od investitora i banke.') : ''),
    };
  }

  /* ─────────── KX.fair ─────────── */
  const ADJ = [
    ['prizemlje', (l) => l.fl === 0, -5, 'Prizemlje'],
    ['poslednji-bez-lifta', (l) => l.fl != null && l.tf >= 4 && l.fl === l.tf && !has(l, 'hasElevator'), -4, 'Poslednji sprat bez lifta'],
    ['poslednji-lift', (l) => l.fl != null && l.tf >= 4 && l.fl === l.tf && has(l, 'hasElevator'), -1, 'Poslednji sprat'],
    ['lux', (l) => l.co === 'lux', 8, 'Lux stanje'],
    ['renovirano', (l) => l.co === 'renovirano', 4, 'Renovirano'],
    ['novogradnja', (l) => l.co === 'novogradnja', 3, 'Novogradnja'],
    ['za-renoviranje', (l) => l.co === 'potrebno-renoviranje', -8, 'Potrebno renoviranje'],
    ['slabo-grejanje', (l) => l.he === 'ta-pec' || l.he === 'struja' || l.he === 'klima', -3, 'Grejanje na struju / TA'],
    ['dobro-grejanje', (l) => l.he === 'centralno' || l.he === 'podno' || l.he === 'toplotna-pumpa', 2, 'Centralno / podno grejanje'],
    ['terasa-garaza', (l) => has(l, 'hasTerrace') || has(l, 'hasGarage'), 2, 'Terasa ili garaža'],
    ['energetski-dobar', (l) => l.en === 'A+' || l.en === 'A' || l.en === 'B', 2, 'Energetski razred A/B'],
    ['energetski-los', (l) => l.en === 'F' || l.en === 'G', -3, 'Energetski razred F/G'],
    ['stara-gradnja', (l) => l.y != null && l.y < 1965, -3, 'Gradnja pre 1965.'],
  ];
  function fair(l) {
    if (memo.fair.has(l.s)) return memo.fair.get(l.s);
    const r = fairCalc(l);
    memo.fair.set(l.s, r);
    return r;
  }
  function fairCalc(l) {
    const empty = { estimate: null, verdict: null, diffPct: null, comps: [], n: 0, basePpm: null, adjustments: [], negotiation: negotiation(l, null), reason: 'nedovoljno uporedivih oglasa' };
    if (!(l.a > 0) || !(l.p > 0) || !(l.pt === 'stan' || l.pt === 'kuca')) return { ...empty, reason: 'procena samo za stanove i kuće' };
    const pool = idx.byTP.get(keyTP(l)) || [];
    const tolA = l.pt === 'kuca' ? 8 : 6;
    const scored = [];
    for (const c of pool) {
      if (c === l || c.s === l.s || !(c.ppm > 0) || !(c.a > 0) || c.cs !== l.cs) continue;
      const d = 0.5 * haversine(l, c) + tolA * Math.abs(Math.log(c.a / l.a)) + (l.ro != null && c.ro != null ? 2 * Math.abs(c.ro - l.ro) : 1) + (c.ns === l.ns ? 0 : 1.5) + (c.ms === l.ms ? 0 : 1);
      scored.push([d, c]);
    }
    scored.sort((x, y) => x[0] - y[0]);
    const near = scored.slice(0, 8);
    const comps = near.map(([d, c]) => ({ s: c.s, r: c.r, ppm: c.ppm, p: c.p, a: c.a, ro: c.ro, fl: c.fl, y: c.y, n: c.n, dz: c.dz, dist: Math.round(d * 10) / 10, km: Math.round(haversine(l, c) * 10) / 10 }));
    const good = near.filter(([d]) => d <= 8);
    if (good.length < 5) return { ...empty, comps, n: good.length };
    const basePpm = wmedian(good.map(([d, c]) => [c.ppm, 1 / (1 + d)]));
    const adjustments = [];
    let mul = 1;
    for (const [key, test, pct, label] of ADJ) {
      if (!test(l)) continue;
      const share = good.filter(([, c]) => test(c)).length / good.length;
      if (share >= 0.6) continue; // većina uporedivih već deli osobinu — ne računa se dvaput
      adjustments.push({ key, label, pct });
      mul *= 1 + pct / 100;
    }
    const ppm = basePpm * mul, mid = Math.round(ppm * l.a);
    const estimate = { low: Math.round(mid * 0.94), mid, high: Math.round(mid * 1.06), ppm: Math.round(ppm) };
    const diffPct = Math.round((l.p / mid - 1) * 1000) / 10;
    const verdict = diffPct <= -6 ? 'ispod' : diffPct >= 6 ? 'iznad' : 'fer';
    const res = { estimate, verdict, diffPct, comps, n: good.length, basePpm: Math.round(basePpm), adjustments, reason: null };
    res.negotiation = negotiation(l, res);
    return res;
  }
  function negotiation(l, f) {
    const pts = [], args = [];
    const add = (p, s) => { pts.push(p); if (s) args.push(s); };
    if (f && f.diffPct != null) {
      const d = f.diffPct;
      if (d >= 15) add(4, `Cena je ${fmtPct(d)} iznad procene sličnih ${l.pt === 'kuca' ? 'kuća' : 'stanova'} (${fmtN(f.estimate.ppm)} €/m², ovde ${fmtN(l.ppm)} €/m²)`);
      else if (d >= 8) add(3, `Cena je ${fmtPct(d)} iznad procene (${fmtN(f.estimate.ppm)} €/m² naspram ${fmtN(l.ppm)} €/m²)`);
      else if (d >= 4) add(2, `Cena je nešto iznad procene sličnih oglasa (${fmtPct(d)})`);
      else if (d >= 0) add(1, null);
    }
    const h = history(l), md = medianDz(l);
    if (h.daysOnMarket >= 14) {
      const ratio = md.median ? h.daysOnMarket / md.median : 0;
      if (ratio >= 2) add(3, `Na oglasu je ${h.daysOnMarket} dana, medijan u ${md.scope === 'all' ? md.label : md.label} je ${Math.round(md.median)}`);
      else if (ratio >= 1.5) add(2, `Na oglasu je ${h.daysOnMarket} dana, duže od medijana (${Math.round(md.median)})`);
      else if (ratio > 1) add(1, `Na oglasu je ${h.daysOnMarket} dana, nešto duže od medijana (${Math.round(md.median)})`);
    }
    if (h.changes.length) { const c = h.changes[0]; add(Math.min(2, h.changes.length), `Cena je već snižena (${fmtEur(c.from)} → ${fmtEur(c.to)}, ${fmtPct((c.to / c.from - 1) * 100)})`); }
    if (l.neg) add(2, 'Oglašivač je naveo da je cena po dogovoru');
    const g = idx.dupes.get(l.s);
    if (g) add(2, `Isti ${l.pt === 'kuca' ? 'kuću' : 'stan'} nudi još ${g.offers.length - 1} ${g.offers.length - 1 === 1 ? 'oglašivač' : 'oglašivača'} — prodavac nema ekskluzivu`);
    if (l.co === 'potrebno-renoviranje') add(1, 'Nekretnina zahteva renoviranje (procena 150 €/m²)');
    if (!l.ags) add(1, 'Oglas vlasnika — nema provizije, lakše se pregovara direktno');
    let total = Math.min(15, pts.reduce((t, x) => t + x, 0));
    if (!h.changes.length && h.daysOnMarket < 14) total = Math.min(total, 9);
    const step = l.t === 'izdavanje' ? 10 : 500;
    const roomPct = total;
    const roomEur = Math.round(l.p * roomPct / 100);
    const firstOffer = roundTo(l.p * (1 - (total + 3) / 100), step);
    const realistic = { low: roundTo(l.p * (1 - total / 100), step), high: roundTo(l.p * (1 - total / 200), step) };
    return { roomPct, roomEur, firstOffer, realistic, leverage: total <= 4 ? 'slab' : total <= 9 ? 'umeren' : 'jak', arguments: args };
  }

  /* ─────────── KX.history ─────────── */
  function history(l) {
    if (memo.history.has(l.s)) return memo.history.get(l.s);
    const r = R(H(l.s + ':hist'));
    const rb = R(H(l.s + ':bump'));
    const now = today();
    const bumped = l.dz >= 10 && rb() < 0.2;
    const daysOnMarket = bumped ? l.dz + 30 + Math.floor(rb() * 91) : l.dz;
    const firstSeen = addDays(now, -daysOnMarket);
    const step = l.p >= 100000 ? 500 : l.p >= 20000 ? 100 : l.p >= 2000 ? 10 : 5;
    const months = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 15, 12); months.push(monthKey(d)); }
    const firstMonth = monthKey(firstSeen);
    const listedFrom = Math.max(0, months.indexOf(firstMonth));
    let changes = [];
    const hasChange = l.dz >= 14 && r() < 0.35;
    let points;
    if (hasChange) {
      const lo = Math.min(11, listedFrom + 1);
      const k = lo + Math.floor(r() * (12 - lo));
      const dropPct = 2 + r() * 7;
      const p0 = Math.max(Math.ceil(l.p / 0.98 / step) * step, roundTo(l.p / (1 - dropPct / 100), step));
      changes = [{ m: months[k], from: p0, to: l.p, pct: Math.round((l.p / p0 - 1) * 1000) / 10 }];
      points = months.map((m, i) => ({ m, p: i < k ? p0 : l.p, listed: i >= listedFrom }));
    } else points = months.map((m, i) => ({ m, p: l.p, listed: i >= listedFrom }));
    const p0 = points[0].p;
    const res = { points, changes, daysOnMarket, shownDays: l.dz, bumped, firstSeen: isoDay(firstSeen), published: isoDay(addDays(now, -l.dz)), p0, dropPct: Math.round((l.p / p0 - 1) * 1000) / 10, context: null };
    const md = medianDz(l);
    const bucket = (md.scope === 'mun' ? idx.dzMun.get(keyTP(l) + '|' + l.ms) : md.scope === 'city' ? idx.dzCity.get(keyTP(l) + '|' + l.cs) : null) || [];
    const pct = bucket.length ? Math.round(bucket.filter((d) => d <= daysOnMarket).length / bucket.length * 100) : null;
    res.context = { median: Math.round(md.median), scope: md.scope, label: md.label, percentile: pct, n: bucket.length };
    memo.history.set(l.s, res);
    return res;
  }

  /* ─────────── KX.trust ─────────── */
  const LEGAL_LABEL = { uknjizeno: 'Uknjiženo', 'u-procesu': 'U procesu uknjižavanja', 'poseban-zakon': 'Upisano po Zakonu 2025 (bez garancije bezbednosti objekta)', ozakonjenje: 'U postupku ozakonjenja', nije: 'Nije uknjiženo' };
  const SCAM_RE = /(depozit\w*|uplat\w+|kapar\w*|novac|iznos)\s+(unapred|pre obilaska|pre pregleda)|placanje unapred|u inostranstvu|western union|moneygram|kurir\w*\s+(ce\s+)?(doneti|dostav\w+|poslati)|samo\s+(preko\s+)?vibera|kljuc\w*\s+(saljem|se salju|postom)/;
  const readChecks = () => { try { return JSON.parse(localStorage.getItem(LS_CHECKS) || '{}') || {}; } catch { return {}; } };
  function legalOf(l) {
    if (l.t !== 'prodaja' && l.t !== 'izdavanje') return 'uknjizeno';
    const r = R(H(l.s + ':leg'))();
    if (l.co === 'u-izgradnji') return 'u-procesu';
    if (l.reg) return r < 0.88 ? 'uknjizeno' : 'poseban-zakon';
    if (l.co === 'novogradnja') return 'u-procesu';
    return r < 0.45 ? 'u-procesu' : r < 0.78 ? 'ozakonjenje' : 'nije';
  }
  function trust(l) {
    if (memo.trust.has(l.s)) return memo.trust.get(l.s);
    const res = l.t === 'izdavanje' ? trustRental(l) : trustSale(l);
    const done = readChecks()[l.s] || [];
    res.checks = res.checks.map((c, i) => ({ ...c, done: done.includes(i) }));
    memo.trust.set(l.s, res);
    return res;
  }
  function trustSale(l) {
    const legal = legalOf(l);
    const reasons = [], flags = [];
    const hip = l.reg && H(l.s + ':hip') % 12 === 0;
    const suv = H(l.s + ':suv') % 20 === 0;
    const noUd = l.co === 'u-izgradnji' || (l.co === 'novogradnja' && H(l.s + ':ud') % 5 === 0);
    let color = 'zeleno';
    if (legal === 'nije' || legal === 'ozakonjenje') { color = 'crveno'; reasons.push(legal === 'nije' ? 'Nije uknjiženo — banka ne daje kredit, a preprodaja je rizična.' : 'U postupku ozakonjenja — do rešenja nema upisa ni kredita.'); }
    else if (legal === 'u-procesu') { color = 'zuto'; reasons.push('Uknjižba je u toku — tražite dokaz o podnetom zahtevu.'); }
    else if (legal === 'poseban-zakon') { color = 'zuto'; reasons.push('Upisano po Zakonu iz 2025. („Svoj na svome”) — upis bez garancije bezbednosti objekta; finansiranje zavisi od banke.'); }
    else reasons.push('Uknjiženo — proverite list nepokretnosti u eKatastru pre kapare.');
    if (hip) { flags.push('hipoteka'); if (color === 'zeleno') color = 'zuto'; reasons.push('Hipoteka na nekretnini (demo prikaz) — briše se isplatom na dan overe, tražite potvrdu banke.'); }
    if (suv) { flags.push('suvlasnistvo'); if (color === 'zeleno') color = 'zuto'; reasons.push('Suvlasništvo (demo prikaz) — svi suvlasnici potpisuju ugovor.'); }
    if (noUd) { flags.push('bez-upotrebne-dozvole'); if (color === 'zeleno') color = 'zuto'; reasons.push('Nema upotrebnu dozvolu — rok za pribavljanje mora u ugovor.'); }
    const f = fair(l);
    if (f.verdict === 'iznad' && f.diffPct >= 15) { if (color === 'zeleno') color = 'zuto'; reasons.push(`Cena je ${fmtPct(f.diffPct)} iznad procene sličnih oglasa.`); }
    if (f.verdict === 'ispod' && f.diffPct <= -25) { if (color === 'zeleno') color = 'zuto'; reasons.push(`Cena je ${fmtPct(-f.diffPct)} ispod procene — proverite terete i razlog prodaje.`); }
    if (l.ags && !l.agv) { if (color === 'zeleno' && legal !== 'uknjizeno') color = 'zuto'; reasons.push('Agencija nije verifikovana na Kvadratu.'); }
    else if (l.ags && l.agv) reasons.push('Verifikovana agencija.');
    else reasons.push('Oglas vlasnika — lična karta vlasnika mora da se poklapa sa listom nepokretnosti.');
    const checks = [
      { label: 'List nepokretnosti ne stariji od 7 dana (eKatastar)' },
      { label: 'Lična karta prodavca = ime u listu nepokretnosti' },
      { label: 'Potvrda o izmirenim računima (Infostan, EPS, stambena zajednica)' },
    ];
    if (hip) checks.push({ label: 'Potvrda banke o iznosu za brisanje hipoteke' });
    if (suv) checks.push({ label: 'Saglasnost i potpisi svih suvlasnika' });
    if (noUd) checks.push({ label: 'Upotrebna dozvola ili rok za nju u ugovoru' });
    if (legal === 'ozakonjenje') checks.push({ label: 'Rešenje o ozakonjenju ili dokaz o podnetom zahtevu' });
    if (legal === 'poseban-zakon') checks.push({ label: 'Rešenje o upisu po posebnom zakonu i potvrda banke da finansira' });
    if (legal === 'u-procesu') checks.push({ label: 'Dokaz o podnetom zahtevu za uknjižbu' });
    checks.push({ label: 'Ugovor samo kod javnog beležnika; kapara uobičajeno 10 % (kupac odustane — gubi je, prodavac — vraća dvostruko)' });
    const title = color === 'zeleno' ? 'Pravno čisto (po oglasu)' : color === 'zuto' ? 'Proveri pre kapare' : 'Visok pravni rizik';
    return { color, title, reasons, checks, legal, legalLabel: LEGAL_LABEL[legal], flags, ekatastarUrl: EKATASTAR, rental: null, face: 'pravni' };
  }
  function trustRental(l) {
    const legal = legalOf(l);
    const flags = [], reasons = [];
    let score = 0;
    const med = medianPpm(l, 4);
    let priceSignal = false;
    if (med && l.ppm > 0) {
      const dev = l.ppm / med.median - 1;
      if (dev <= -0.3) { score += 35; priceSignal = true; flags.push(`Kirija je ${fmtPct(-dev * 100, 0)} ispod proseka za ${med.label} — tipično za mamac oglase`); }
      else if (dev <= -0.15) { score += 15; priceSignal = true; flags.push(`Kirija je ${fmtPct(-dev * 100, 0)} ispod proseka za ${med.label}`); }
      else reasons.push(`Kirija je u skladu sa prosekom za ${med.label} (${fmtN(med.median)} €/m²).`);
    } else reasons.push('Nema dovoljno sličnih oglasa za poređenje kirije.');
    if (l.im <= 3) { score += 10; flags.push(`Samo ${l.im} ${l.im === 1 ? 'fotografija' : 'fotografije'}`); }
    if (!l.ags) { score += 8; flags.push('Oglas vlasnika bez verifikacije i telefona na profilu'); }
    else if (!l.agv) { score += 5; flags.push('Agencija nije verifikovana'); }
    else reasons.push('Verifikovana agencija.');
    const g = idx.dupes.get(l.s);
    if (!l.ags && g && g.offers.some((o) => o.ags)) { score += 20; flags.push('Isti stan nudi i agencija — „vlasnik” je možda agencija'); }
    if (l.dep != null && l.p > 0 && l.dep > 2 * l.p) { score += 15; flags.push('Depozit veći od dve kirije'); }
    const d = deacc(l.d);
    if (SCAM_RE.test(d)) { score += 30; flags.push('Opis traži uplatu unapred ili pominje vlasnika u inostranstvu'); }
    if (l.dz <= 2 && priceSignal) { score += 5; flags.push('Nov oglas sa sumnjivo niskom kirijom'); }
    const risk = score < 20 ? 'nizak' : score < 45 ? 'srednji' : 'visok';
    const color = risk === 'nizak' ? 'zeleno' : risk === 'srednji' ? 'zuto' : 'crveno';
    const title = risk === 'nizak' ? 'Nizak rizik' : risk === 'srednji' ? 'Proveri pre depozita' : 'Visok rizik prevare';
    const checks = [
      { label: 'Nikad ne plaćam kaparu ni depozit pre obilaska' },
      { label: 'Lična karta vlasnika i list nepokretnosti (eKatastar)' },
      { label: 'Pisani ugovor pre depozita, overa kod beležnika' },
      { label: 'Potvrda o uplati depozita i stanju stana (zapisnik, fotografije)' },
      { label: 'Ko plaća komunalije i koliki su bili poslednji računi' },
    ];
    return { color, title, reasons: flags.length ? flags.concat(reasons) : reasons, checks, legal, legalLabel: LEGAL_LABEL[legal], flags: [], ekatastarUrl: EKATASTAR, rental: { risk, score, flags }, face: 'prevara' };
  }
  /* korisnička akcija: čekiranje stavke (persistira u kv.checks) */
  function trustCheck(slug, i, done) {
    const m = readChecks();
    const arr = new Set(m[slug] || []);
    if (done) arr.add(i); else arr.delete(i);
    m[slug] = [...arr];
    try { localStorage.setItem(LS_CHECKS, JSON.stringify(m)); } catch {}
    memo.trust.delete(slug);
    return m[slug];
  }

  /* ─────────── KX.budgetMap ─────────── */
  /* neto za nekretninu: x + 2,5 % + provizija 2 % + PDV + notar(x) + upis = budžet (keš, starogradnja, agencija) */
  function netForBudget(budget, opts = {}) {
    const feeMul = 1 + TARIFF.transferTaxPct / 100 + (opts.owner ? 0 : 0.02 * (1 + TARIFF.feeVatPct / 100));
    let x = budget / feeMul;
    for (let i = 0; i < 4; i++) x = (budget - notar(x) - TARIFF.registry - (opts.credit ? TARIFF.appraisal + 0.005 * 0.8 * x + TARIFF.homeInsurance : 0)) / feeMul;
    return Math.max(0, Math.round(x));
  }
  function budgetMap(budget, opts = {}) {
    const t = opts.t || 'prodaja', pt = opts.pt || 'stan';
    const key = [t, pt, budget, !!opts.owner, !!opts.credit, opts.cs || ''].join('|');
    if (memo.budget.has(key)) return memo.budget.get(key);
    const net = t === 'prodaja' ? netForBudget(budget, opts) : budget;
    const pool = (idx.byTP.get(t + '|' + pt) || []).filter((l) => l.ppm > 0 && (!opts.cs || l.cs === opts.cs));
    const byMun = new Map(), byCity = new Map();
    for (const l of pool) {
      let a = byMun.get(l.ms); if (!a) { a = []; byMun.set(l.ms, a); } a.push(l);
      let c = byCity.get(l.cs); if (!c) { c = []; byCity.set(l.cs, c); } c.push(l);
    }
    const row = (key, label, cs, arr, scope) => {
      const ppm = median(arr.map((l) => l.ppm));
      const m2 = ppm > 0 ? Math.round(net / ppm) : 0;
      const city = idx.cities.get(cs);
      return {
        key, label, cs, city: city ? city.n : arr[0].c, scope, n: arr.length, ppm: Math.round(ppm), m2, net,
        lat: arr.reduce((s, l) => s + l.lat, 0) / arr.length, lng: arr.reduce((s, l) => s + l.lng, 0) / arr.length,
        count: arr.filter((l) => l.p <= net).length,
        typical: arr.filter((l) => l.p <= net).sort((x, y) => Math.abs(x.a - m2) - Math.abs(y.a - m2))[0]?.s || null,
        cheapest: arr.slice().sort((x, y) => x.p - y.p)[0]?.s || null,
      };
    };
    const rows = [];
    const citiesWithMun = new Set();
    for (const [ms, arr] of byMun) {
      if (arr.length < 5) continue;
      const mun = idx.muns.get(ms);
      rows.push(row(ms, mun ? mun.n : arr[0].m, arr[0].cs, arr, 'mun'));
      citiesWithMun.add(arr[0].cs);
    }
    for (const [cs, arr] of byCity) {
      if (citiesWithMun.has(cs) || arr.length < 5) continue;
      const city = idx.cities.get(cs);
      rows.push(row(cs, city ? city.n : arr[0].c, cs, arr, 'city'));
    }
    rows.sort((a, b) => b.m2 - a.m2);
    const res = Object.assign(rows, { net, budget, costs: t === 'prodaja' ? budget - net : 0, t, pt });
    memo.budget.set(key, res);
    return res;
  }

  /* ─────────── putovanja (procena) ─────────── */
  const SPEED = { auto: [22, 4], gradski: [14, 6], pesice: [4.5, 0], bicikl: [14, 2] };
  const CIRCUITY = 1.3;
  function travel(l, place) {
    const mode = place && SPEED[place.mode] ? place.mode : 'auto';
    const km = haversine(l, place);
    if (!isFinite(km)) return { min: null, mode, km: null };
    const [speed, fixed] = SPEED[mode];
    const min = clamp(Math.round(km * CIRCUITY / speed * 60 + fixed), 1, 180);
    return { min, mode, km: Math.round(km * 10) / 10, far: km > 60 };
  }
  function travelAll(l, places) {
    const list = places || profile.get().places || [];
    return list.map((place) => ({ place, ...travel(l, place) })).sort((a, b) => a.min - b.min);
  }
  const primaryPlace = (places, who) => { const mine = places.filter((p) => (p.who || 'ja') === who); return mine.find((p) => p.icon === 'work' || /posao|posl/i.test(p.name || '')) || mine[0] || null; };
  function fairMiddle(list, places) {
    const pl = places || profile.get().places || [];
    const a = primaryPlace(pl, 'ja'), b = primaryPlace(pl, 'partner');
    const out = new Map();
    for (const l of list) {
      const ma = a ? travel(l, a).min : null, mb = b ? travel(l, b).min : null;
      const vals = [ma, mb].filter((v) => v != null);
      out.set(l.s, { max: vals.length ? Math.max(...vals) : null, sum: vals.length ? vals.reduce((s, v) => s + v, 0) : null, ja: ma, partner: mb });
    }
    return out;
  }
  const POI = [
    { n: 'Slavija', cs: 'beograd', lat: 44.8026, lng: 20.4657 }, { n: 'Trg republike', cs: 'beograd', lat: 44.8163, lng: 20.4602 },
    { n: 'Ušće', cs: 'beograd', lat: 44.815, lng: 20.431 }, { n: 'Zeleni venac', cs: 'beograd', lat: 44.8135, lng: 20.4568 },
    { n: 'Autokomanda', cs: 'beograd', lat: 44.795, lng: 20.471 }, { n: 'FON', cs: 'beograd', lat: 44.7975, lng: 20.477 },
    { n: 'Klinički centar', cs: 'beograd', lat: 44.7935, lng: 20.4635 }, { n: 'Novi Beograd, Blok 21', cs: 'beograd', lat: 44.812, lng: 20.418 },
    { n: 'Ada Ciganlija', cs: 'beograd', lat: 44.788, lng: 20.408 }, { n: 'Vukov spomenik', cs: 'beograd', lat: 44.806, lng: 20.478 },
    { n: 'Banovo brdo', cs: 'beograd', lat: 44.778, lng: 20.415 }, { n: 'Airport City', cs: 'beograd', lat: 44.82, lng: 20.405 },
    { n: 'Zemun centar', cs: 'beograd', lat: 44.844, lng: 20.412 }, { n: 'Karaburma', cs: 'beograd', lat: 44.813, lng: 20.502 },
    { n: 'Dedinje', cs: 'beograd', lat: 44.779, lng: 20.452 }, { n: 'Aerodrom Nikola Tesla', cs: 'beograd', lat: 44.8184, lng: 20.3091 },
    { n: 'Trg slobode', cs: 'novi-sad', lat: 45.255, lng: 19.845 }, { n: 'Limanski park', cs: 'novi-sad', lat: 45.241, lng: 19.848 },
    { n: 'Štrand', cs: 'novi-sad', lat: 45.245, lng: 19.853 }, { n: 'Univerzitet', cs: 'novi-sad', lat: 45.246, lng: 19.852 },
    { n: 'Železnička stanica', cs: 'novi-sad', lat: 45.265, lng: 19.831 }, { n: 'Detelinara', cs: 'novi-sad', lat: 45.263, lng: 19.808 },
    { n: 'Trg kralja Milana', cs: 'nis', lat: 43.3209, lng: 21.8958 }, { n: 'Medicinski fakultet', cs: 'nis', lat: 43.314, lng: 21.915 },
    { n: 'Čair', cs: 'nis', lat: 43.315, lng: 21.9 },
  ];
  /* pretraga mesta za „Moja mesta”: POI + opštine + naselja (centroidi oglasa), bez dijakritika */
  function placeSuggest(text, limit = 8) {
    const q = deacc(text).trim();
    if (!q) return [];
    const out = [];
    for (const p of POI) if (deacc(p.n).includes(q)) out.push({ name: p.n, lat: p.lat, lng: p.lng, cs: p.cs, kind: 'poi' });
    const cent = new Map();
    for (const l of all()) { const k = l.ms; let c = cent.get(k); if (!c) { c = { n: l.m, cs: l.cs, lat: 0, lng: 0, k: 0 }; cent.set(k, c); } c.lat += l.lat; c.lng += l.lng; c.k++; }
    for (const [ms, c] of cent) if (deacc(c.n).includes(q)) { const city = idx.cities.get(c.cs); out.push({ name: c.n + (city ? ' (' + city.n + ')' : ''), lat: c.lat / c.k, lng: c.lng / c.k, cs: c.cs, kind: 'mun', ms }); }
    const ncent = new Map();
    for (const l of all()) { let c = ncent.get(l.ns); if (!c) { c = { n: l.n, cs: l.cs, m: l.m, lat: 0, lng: 0, k: 0 }; ncent.set(l.ns, c); } c.lat += l.lat; c.lng += l.lng; c.k++; }
    for (const [ns, c] of ncent) if (deacc(c.n).includes(q) && out.length < limit * 2) out.push({ name: c.n + ' (' + c.m + ')', lat: c.lat / c.k, lng: c.lng / c.k, cs: c.cs, kind: 'nbhd', ns });
    return out.slice(0, limit);
  }

  /* ─────────── KX.parseQuery ─────────── */
  let dict = null;
  const KEYWORDS = new Set(['stan', 'stanovi', 'kuca', 'kuce', 'plac', 'lokal', 'garaza', 'soba', 'sobe', 'do', 'od', 'ispod', 'preko', 'min', 'max', 'maks', 'lift', 'parking', 'terasa', 'balkon', 'klima', 'uknjizen', 'novogradnja', 'izdavanje', 'prodaja', 'kirija', 'vlasnik', 'sprat', 'prizemlje', 'ne', 'nije', 'bez', 'sa', 'u', 'na', 'i', 'za']);
  function buildDict() {
    const m = new Map();
    const add = (name, e) => { const k = deacc(name).trim(); if (!k || k.length < 3) return; let a = m.get(k); if (!a) { a = []; m.set(k, a); } if (!a.some((x) => x.kind === e.kind && x.s === e.s)) a.push(e); };
    const cityCount = new Map(), munCount = new Map(), nbCount = new Map();
    for (const l of all()) { cityCount.set(l.cs, (cityCount.get(l.cs) || 0) + 1); munCount.set(l.ms, (munCount.get(l.ms) || 0) + 1); nbCount.set(l.ns, (nbCount.get(l.ns) || 0) + 1); }
    for (const c of data().cities || []) { add(c.n, { kind: 'city', s: c.s, cs: c.s, n: c.n, count: cityCount.get(c.s) || 0 }); if (c.loc) add(c.loc, { kind: 'city', s: c.s, cs: c.s, n: c.n, count: cityCount.get(c.s) || 0 }); }
    add('bg', { kind: 'city', s: 'beograd', cs: 'beograd', n: 'Beograd', count: cityCount.get('beograd') || 0 });
    add('ns', { kind: 'city', s: 'novi-sad', cs: 'novi-sad', n: 'Novi Sad', count: cityCount.get('novi-sad') || 0 });
    add('nbg', { kind: 'mun', s: 'novi-beograd', cs: 'beograd', n: 'Novi Beograd', count: munCount.get('novi-beograd') || 0 });
    for (const mu of data().muns || []) { const city = idx.cities.get(mu.cs); add(mu.n, { kind: 'mun', s: mu.s, cs: mu.cs, n: mu.n, cityName: city ? city.n : '', count: munCount.get(mu.s) || 0 }); }
    const seen = new Set();
    for (const l of all()) {
      if (seen.has(l.ns)) continue; seen.add(l.ns);
      add(l.n, { kind: 'nbhd', s: l.ns, cs: l.cs, ms: l.ms, n: l.n, cityName: l.c, munName: l.m, count: nbCount.get(l.ns) || 0 });
      const mm = /^blok\s+(\d+)/i.exec(l.n); if (mm) add('blok ' + mm[1], { kind: 'nbhd', s: l.ns, cs: l.cs, ms: l.ms, n: l.n, cityName: l.c, munName: l.m, count: nbCount.get(l.ns) || 0 });
    }
    for (const k of KEYWORDS) m.delete(k);
    return m;
  }
  const ROOM_LOOKUP = (() => { const m = new Map(); for (const [v, w] of ROOM_WORDS) { const d = deacc(w); m.set(d, v); m.set(d.replace(/an$/, 'na'), v); m.set(d.replace(/an$/, 'ni'), v); } m.set('garsonjere', 0.5); m.set('garsonjeru', 0.5); return m; })();
  const parseNum = (tok) => {
    const m = /^(\d+(?:[.,]\d+)?)(k|m2|m²|€|e|eur|evra)?$/.exec(tok);
    if (!m) return null;
    let s = m[1];
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else s = s.replace(',', '.');
    let v = parseFloat(s);
    if (m[2] === 'k') v *= 1000;
    return { v, unit: m[2] === 'm2' || m[2] === 'm²' ? 'm2' : m[2] ? 'eur' : null, k: m[2] === 'k' };
  };
  const AREA_WORDS = new Set(['m2', 'm²', 'kvadrata', 'kvadrat', 'kvadratna', 'kvm', 'kv']);
  const EUR_WORDS = new Set(['€', 'e', 'eur', 'evra', 'eura']);
  const K_WORDS = new Set(['k', 'hiljada', 'hilj', 'hiljade']);
  function parseQuery(text) {
    if (!dict) dict = buildDict();
    const filters = {}, chips = [], unparsed = [];
    let route = null;
    const push = (k, v) => { if (!filters[k]) filters[k] = []; if (!filters[k].includes(v)) filters[k].push(v); };
    const chip = (label, key, value) => chips.push({ label, key, value });
    const setPt = (v, label) => { filters.pt = [v]; chip(label, 'pt', v); };
    const setFloor = (v, label) => { filters.flmin = v; filters.flmax = v; chip(label, 'fl', v); };
    const raw = String(text || '').replace(/[“”"’'()]/g, ' ').replace(/,\s/g, ' ').replace(/\s+-\s+/g, '-').replace(/(\d)\s*(m2|m²)/gi, '$1 $2').replace(/(\d)\s*€/g, '$1 €');
    const toks = deacc(raw).split(/\s+/).filter(Boolean);
    const isNumTok = (t) => !!parseNum(t);
    const takeNumber = (i) => { // vraća {v, unit, next}
      const n = parseNum(toks[i]); if (!n) return null;
      let j = i + 1, v = n.v, unit = n.unit, k = n.k;
      if (!k && !unit && toks[j] && K_WORDS.has(toks[j])) { v *= 1000; k = true; j++; }
      if (!unit && toks[j] && AREA_WORDS.has(toks[j])) { unit = 'm2'; j++; }
      else if (!unit && toks[j] && EUR_WORDS.has(toks[j])) { unit = 'eur'; j++; }
      return { v, unit, next: j, k };
    };
    const matchLoc = (i) => {
      for (let len = Math.min(3, toks.length - i); len >= 1; len--) {
        const key = toks.slice(i, i + len).join(' ');
        const es = dict.get(key);
        if (es && es.length) return { entries: es, len };
      }
      return null;
    };
    const ctxCity = () => filters.c || null;
    let i = 0;
    while (i < toks.length) {
      const t = toks[i], nx = toks[i + 1] || '';
      /* navigacija */
      if (/^kv-?\d{5,}$/.test(t)) { const ref = 'KV-' + t.replace(/\D/g, ''); const l = all().find((x) => x.r === ref); if (l) { route = '#/oglas?s=' + l.s; chip('Oglas ' + ref, 'route', route); i++; continue; } }
      const NAV = { uporedi: '#/uporedi', sacuvani: '#/sacuvani', sacuvano: '#/sacuvani', omiljeni: '#/sacuvani', kalkulator: '#/kalkulator', mapa: '#/mapa', agencije: '#/agencije', budzet: '#/mapa?mode=budzet', saveti: '#/saveti', procena: '#/procena', trziste: '#/trziste' };
      if (NAV[t] && toks.length <= 2) { route = NAV[t]; chip(cap(t), 'route', route); i++; continue; }
      if (t === 'moja' && nx === 'mesta') { route = '#/moja-mesta'; chip('Moja mesta', 'route', route); i += 2; continue; }
      /* negacije */
      if ((t === 'nije' || t === 'ne') && /^uknjiz/.test(nx)) { chip('nije uknjižen (bez filtera)', 'info', null); i += 2; continue; }
      if ((t === 'ne' || t === 'nije') && nx === 'poslednji') { filters.notLast = true; chip('Nije poslednji sprat', 'notLast', true); i += (toks[i + 2] === 'sprat' ? 3 : 2); continue; }
      if (t === 'bez' && (nx === 'provizije' || nx === 'agencije')) { filters.advertiser = 'vlasnik'; chip('Od vlasnika', 'advertiser', 'vlasnik'); i += 2; continue; }
      if (t === 'od' && nx === 'vlasnika') { filters.advertiser = 'vlasnik'; chip('Od vlasnika', 'advertiser', 'vlasnik'); i += 2; continue; }
      if (t === 'za' && /^renovir/.test(nx)) { push('co', 'potrebno-renoviranje'); chip('Za renoviranje', 'co', 'potrebno-renoviranje'); i += 2; continue; }
      if (t === 'visoko' && nx === 'prizemlje') { i += 2; continue; }
      /* cena / kvadratura sa prefiksom */
      const MAXW = ['do', 'ispod', 'max', 'maks', 'maksimalno', 'najvise'], MINW = ['od', 'preko', 'min', 'iznad', 'minimalno', 'najmanje'];
      const isMax = MAXW.includes(t) || (t === 'vise' && false);
      if ((isMax || MINW.includes(t)) && isNumTok(nx)) {
        const n = takeNumber(i + 1);
        let unit = n.unit;
        if (!unit) unit = n.v <= 400 && !n.k ? 'm2' : 'eur';
        if (n.unit == null && unit === 'eur' && n.v < 10000 && !n.k && filters.t !== 'izdavanje' && n.v >= 1000) { /* ostaje cena (kirija) */ }
        if (MINW.includes(t) && toks[n.next] === 'do' && isNumTok(toks[n.next + 1])) {
          const n2 = takeNumber(n.next + 1);
          const u2 = n2.unit || unit; let v1 = n.v; if (n2.k && !n.k && !n.unit) v1 *= 1000;
          if (u2 === 'm2') { filters.amin = v1; filters.amax = n2.v; chip(`${fmtN(v1)}–${fmtN(n2.v)} m²`, 'area', [v1, n2.v]); }
          else { filters.pmin = v1; filters.pmax = n2.v; chip(`${fmtEur(v1)} – ${fmtEur(n2.v)}`, 'price', [v1, n2.v]); }
          i = n2.next; continue;
        }
        if (unit === 'm2') { if (isMax) { filters.amax = n.v; chip(`do ${fmtN(n.v)} m²`, 'amax', n.v); } else { filters.amin = n.v; chip(`od ${fmtN(n.v)} m²`, 'amin', n.v); } }
        else if (isMax) { filters.pmax = n.v; chip(`do ${fmtEur(n.v)}`, 'pmax', n.v); } else { filters.pmin = n.v; chip(`od ${fmtEur(n.v)}`, 'pmin', n.v); }
        i = n.next; continue;
      }
      /* opseg A-B */
      if (/^\d[\d.,]*k?-\d[\d.,]*k?$/.test(t)) {
        const [a, b] = t.split('-').map((x) => parseNum(x));
        let va = a.v, vb = b.v; if (b.k && !a.k) va *= 1000;
        let unit = null, j = i + 1;
        if (AREA_WORDS.has(toks[j])) { unit = 'm2'; j++; } else if (EUR_WORDS.has(toks[j])) { unit = 'eur'; j++; } else if (K_WORDS.has(toks[j])) { va *= 1000; vb *= 1000; unit = 'eur'; j++; }
        if (!unit) unit = vb <= 400 ? 'm2' : 'eur';
        if (unit === 'm2') { filters.amin = va; filters.amax = vb; chip(`${fmtN(va)}–${fmtN(vb)} m²`, 'area', [va, vb]); }
        else { filters.pmin = va; filters.pmax = vb; chip(`${fmtEur(va)} – ${fmtEur(vb)}`, 'price', [va, vb]); }
        i = j; continue;
      }
      /* broj bez prefiksa */
      if (isNumTok(t)) {
        const n = takeNumber(i);
        const after = toks[n.next] || '';
        if (/^sob/.test(after) || /^soban/.test(after)) { push('ro', n.v); chip(cap(roomWord(n.v) || n.v + ' sobe'), 'ro', n.v); i = n.next + 1; continue; }
        if (n.unit === 'm2') { filters.amin = Math.round(n.v * 0.9); filters.amax = Math.round(n.v * 1.1); chip(`oko ${fmtN(n.v)} m²`, 'area', [filters.amin, filters.amax]); i = n.next; continue; }
        if (n.v >= 10000 || n.k || n.unit === 'eur') { filters.pmax = n.v; chip(`do ${fmtEur(n.v)}`, 'pmax', n.v); i = n.next; continue; }
        if (n.v <= 5000 && n.v >= 100 && (filters.t === 'izdavanje' || toks.includes('izdavanje') || toks.includes('kirija'))) { filters.pmax = n.v; chip(`do ${fmtEur(n.v)}`, 'pmax', n.v); i = n.next; continue; }
        if (n.v > 0 && n.v <= 7 && Number.isInteger(n.v * 2)) { push('ro', n.v); chip(cap(roomWord(n.v)), 'ro', n.v); i = n.next; continue; }
        unparsed.push(toks[i]); i++; continue;
      }
      /* sprat */
      if (t === 'sprat' && /^\d+$/.test(nx)) { setFloor(+nx, `Sprat ${nx}`); i += 2; continue; }
      if (/^\d+\.?$/.test(t) && nx === 'sprat') { setFloor(parseInt(t), `Sprat ${parseInt(t)}`); i += 2; continue; }
      if (t === 'prizemlje') { setFloor(0, 'Prizemlje'); i++; continue; }
      if (t === 'poslednji' && nx === 'sprat') { i += 2; continue; }
      /* struktura */
      if (ROOM_LOOKUP.has(t)) { const v = ROOM_LOOKUP.get(t); push('ro', v); chip(cap(roomWord(v)), 'ro', v); i++; continue; }
      /* tip transakcije */
      if (['izdavanje', 'kirija', 'iznajmljivanje', 'zakup', 'iznajmiti', 'najam', 'izdaje', 'rent'].includes(t)) { filters.t = 'izdavanje'; chip('Izdavanje', 't', 'izdavanje'); i++; continue; }
      if (['prodaja', 'kupovina', 'kupiti', 'prodaje'].includes(t)) { filters.t = 'prodaja'; chip('Prodaja', 't', 'prodaja'); i++; continue; }
      /* tip nekretnine */
      if (['stan', 'stanovi', 'stana', 'stanove'].includes(t)) { setPt('stan', 'Stan'); i++; continue; }
      if (['kuca', 'kuce', 'kucu'].includes(t)) { setPt('kuca', 'Kuća'); i++; continue; }
      if (['plac', 'placevi', 'zemljiste', 'parcela', 'njiva'].includes(t)) { setPt('zemljiste', 'Zemljište'); i++; continue; }
      if (['lokal', 'lokali', 'poslovni', 'kancelarija', 'magacin'].includes(t)) { setPt('poslovni-prostor', 'Poslovni prostor'); i += (t === 'poslovni' && nx === 'prostor' ? 2 : 1); continue; }
      if (['soba', 'sobe', 'cimer'].includes(t) && !ROOM_LOOKUP.has(toks[i - 1] || '')) { setPt('soba', 'Soba'); i++; continue; }
      if (t === 'vikendica' || t === 'vikendice') { setPt('vikendica', 'Vikendica'); i++; continue; }
      if (t === 'garaza' || t === 'garaze') { if (i === 0) setPt('garaza', 'Garaža'); else { push('am', 'hasGarage'); chip('Garaža', 'am', 'hasGarage'); } i++; continue; }
      /* stanje, grejanje, nameštenost, flagovi */
      if (/^uknjiz/.test(t)) { filters.reg = true; chip('Uknjiženo', 'reg', true); i++; continue; }
      if (/^novogradnj/.test(t) || t === 'nova' && nx === 'gradnja') { push('co', 'novogradnja'); chip('Novogradnja', 'co', 'novogradnja'); i += (t === 'nova' ? 2 : 1); continue; }
      if (/^renovir/.test(t)) { push('co', 'renovirano'); chip('Renovirano', 'co', 'renovirano'); i++; continue; }
      if (t === 'lux' || t === 'luksuzan' || t === 'luksuzno') { push('co', 'lux'); chip('Lux', 'co', 'lux'); i++; continue; }
      if (t === 'u' && nx === 'izgradnji') { push('co', 'u-izgradnji'); chip('U izgradnji', 'co', 'u-izgradnji'); i += 2; continue; }
      if (t === 'cg' || (t === 'centralno' && /^grej/.test(nx)) || t === 'centralno') { push('he', 'centralno'); chip('Centralno grejanje', 'he', 'centralno'); i += (/^grej/.test(nx) ? 2 : 1); continue; }
      if (t === 'eg' || t === 'etazno') { push('he', 'etazno'); chip('Etažno grejanje', 'he', 'etazno'); i += (/^grej/.test(nx) ? 2 : 1); continue; }
      if (t === 'ta' || t === 'ta-pec') { push('he', 'ta-pec'); chip('TA peć', 'he', 'ta-pec'); i += (/^pec/.test(nx) ? 2 : 1); continue; }
      if (t === 'gas' || t === 'plin') { push('he', 'gas'); chip('Gas', 'he', 'gas'); i++; continue; }
      if (t === 'podno') { push('he', 'podno'); chip('Podno grejanje', 'he', 'podno'); i += (/^grej/.test(nx) ? 2 : 1); continue; }
      if (t === 'toplotna' && nx === 'pumpa') { push('he', 'toplotna-pumpa'); chip('Toplotna pumpa', 'he', 'toplotna-pumpa'); i += 2; continue; }
      if (/^namest/.test(t) || t === 'opremljen') { push('fu', 'namesten'); chip('Namešten', 'fu', 'namesten'); i++; continue; }
      if (/^polunamest/.test(t)) { push('fu', 'polunamesten'); chip('Polunamešten', 'fu', 'polunamesten'); i++; continue; }
      if (t === 'prazan' || t === 'prazno' || t === 'nenamesten') { push('fu', 'prazan'); chip('Prazan', 'fu', 'prazan'); i++; continue; }
      const AM = { lift: 'hasElevator', liftom: 'hasElevator', terasa: 'hasTerrace', terasom: 'hasTerrace', balkon: 'hasBalcony', balkonom: 'hasBalcony', parking: 'hasParking', parkingom: 'hasParking', klima: 'hasAc', klimom: 'hasAc', podrum: 'hasBasement', bazen: 'hasPool', dvoriste: 'hasGarden', basta: 'hasGarden', bastom: 'hasGarden', interfon: 'hasIntercom', internet: 'hasInternet', alarm: 'hasAlarm', ljubimci: 'petsAllowed', ljubimce: 'petsAllowed', pas: 'petsAllowed', psa: 'petsAllowed', macka: 'petsAllowed', macku: 'petsAllowed', studenti: 'studentsOk', studente: 'studentsOk', pusenje: 'smokingAllowed' };
      if (AM[t]) { push('am', AM[t]); chip((typeof AMEN !== 'undefined' && AMEN[AM[t]]) || t, 'am', AM[t]); i++; continue; }
      if (t === 'kucni' && /^ljubim/.test(nx)) { push('am', 'petsAllowed'); chip('Dozvoljeni ljubimci', 'am', 'petsAllowed'); i += 2; continue; }
      if (t === 'vlasnik' || t === 'vlasnika') { filters.advertiser = 'vlasnik'; chip('Od vlasnika', 'advertiser', 'vlasnik'); i++; continue; }
      if (['sa', 'u', 'na', 'i', 'za', 'je', 'kod', 'blizu'].includes(t)) { i++; continue; }
      /* lokacija */
      const m = matchLoc(i);
      if (m) {
        let es = m.entries;
        const cc = ctxCity();
        if (es.length > 1) { const inCity = es.filter((e) => e.cs === cc); es = (inCity.length ? inCity : es).slice().sort((a, b) => b.count - a.count); }
        const e = es[0];
        if (e.kind === 'city') { if (!filters.c) filters.c = e.s; chip(e.n, 'c', e.s); }
        else if (e.kind === 'mun') { if (!filters.c) filters.c = e.cs; push('m', e.s); chip(e.n + (es.length > 1 || (cc && cc !== e.cs) || !['beograd', 'novi-sad', 'nis'].includes(e.cs) ? ` (${e.cityName})` : ''), 'm', e.s); }
        else { if (!filters.c) filters.c = e.cs; push('m', e.ms); push('n', e.s); chip(e.n + ` (${e.munName})`, 'n', e.s); }
        if (es.length > 1 && es[1].kind !== 'city') chip(`ili: ${es[1].n} (${es[1].cityName || ''})`, 'alt', es[1].s);
        i += m.len; continue;
      }
      unparsed.push(toks[i]); i++;
    }
    if (unparsed.length) filters.q = unparsed.join(' ');
    const count = kxCount(filters);
    return { filters, chips, unparsed, count, route };
  }

  /* ─────────── brojanje (applyFilters + dodatni predikati) ───────────
     Ugovor filtera = core.js FILTER_DEFAULTS: t, pt[], c, m[], n[], pmin, pmax, amin, amax, ro[], flmin, flmax, notLast,
     ymin, ymax, co[], he[], fu[], reg, newbuild, am[], agency, advertiser ('agencija'|'vlasnik'), q, deltaMax.
     Engine dodaje: legal (true → samo zeleni semafor), risk (true → sakrij crvene), fit (true → odmah/kredit), dup (true →
     sakrij sekundarne duplikate), hidden (true → sakrij oglase iz profile.hidden). */
  const MANUAL_DEFAULTS = { t: 'prodaja', pt: [], c: '', m: [], n: [], pmin: '', pmax: '', amin: '', amax: '', ro: [], flmin: '', flmax: '', notLast: false, ymin: '', ymax: '', co: [], he: [], fu: [], reg: false, newbuild: false, am: [], agency: '', advertiser: '', q: '', deltaMax: '', sort: 'rel', view: 'grid', page: 1 };
  const FILTER_BASE = () => (typeof FILTER_DEFAULTS !== 'undefined' ? FILTER_DEFAULTS : MANUAL_DEFAULTS);
  const EXTRA = {
    legal: (l, v) => !v || trust(l).color === 'zeleno',
    risk: (l, v) => !v || trust(l).color !== 'crveno',
    fit: (l, v) => !v || ['odmah', 'kredit'].includes(afford(l).state),
    dup: (l, v) => !v || !dupes.isSecondary(l.s),
    hidden: (l, v) => !v || !profile.get().hidden.has(l.s),
  };
  const isOn = (v) => !(v == null || v === false || v === '' || (Array.isArray(v) && !v.length));
  function applyExtra(list, f) {
    let out = list;
    for (const k of Object.keys(EXTRA)) { const v = f[k]; if (!isOn(v)) continue; out = out.filter((l) => EXTRA[k](l, v)); }
    return out;
  }
  function kxFilter(f) {
    const merged = { ...FILTER_BASE(), ...f };
    for (const k of ['pt', 'm', 'n', 'ro', 'co', 'he', 'fu', 'am']) if (!Array.isArray(merged[k])) merged[k] = isOn(merged[k]) ? [merged[k]] : [];
    let list;
    if (typeof FILTER_DEFAULTS !== 'undefined' && typeof applyFilters === 'function') { try { list = applyFilters(merged); } catch { list = manualFilter(merged); } }
    else list = manualFilter(merged);
    return applyExtra(list, f);
  }
  /* rezervni filter sa istim ugovorom (kada core.js nije učitan ili je stariji) */
  function manualFilter(f) {
    const pt = new Set(f.pt || []), m = new Set(f.m || []), n = new Set(f.n || []), co = new Set(f.co || []), he = new Set(f.he || []), fu = new Set(f.fu || []);
    const num = (v) => (v === '' || v == null ? null : +v);
    const pmin = num(f.pmin), pmax = num(f.pmax), amin = num(f.amin), amax = num(f.amax), flmin = num(f.flmin), flmax = num(f.flmax), ymin = num(f.ymin), ymax = num(f.ymax);
    const q = f.q ? deacc(f.q).split(/\s+/).filter(Boolean) : [];
    return all().filter((l) => {
      if (f.t && l.t !== f.t) return false; if (pt.size && !pt.has(l.pt)) return false;
      if (f.c && l.cs !== f.c) return false; if (m.size && !m.has(l.ms)) return false; if (n.size && !n.has(l.ns)) return false;
      if (pmin != null && l.p < pmin) return false; if (pmax != null && l.p > pmax) return false;
      if (amin != null && (l.a == null || l.a < amin)) return false; if (amax != null && (l.a == null || l.a > amax)) return false;
      if (f.ro?.length && !f.ro.some((r) => (typeof r === 'string' && r.endsWith('+') ? l.ro != null && l.ro >= parseFloat(r) : l.ro === +r))) return false;
      if (flmin != null && (l.fl == null || l.fl < flmin)) return false; if (flmax != null && (l.fl == null || l.fl > flmax)) return false;
      if (f.notLast && l.tf && l.fl === l.tf) return false;
      if (ymin != null && (l.y == null || l.y < ymin)) return false; if (ymax != null && (l.y == null || l.y > ymax)) return false;
      if (co.size && !co.has(l.co)) return false; if (he.size && !he.has(l.he)) return false; if (fu.size && !fu.has(l.fu)) return false;
      if (f.reg && !l.reg) return false; if (f.newbuild && !isNew(l)) return false;
      if (f.am?.length && !f.am.every((k) => l.am.includes(k))) return false;
      if (f.agency && l.ags !== f.agency) return false;
      if (f.advertiser === 'agencija' && !l.ags) return false; if (f.advertiser === 'vlasnik' && l.ags) return false;
      if (q.length) { const s = deacc([l.ti, l.n, l.m, l.c, l.r, l.ad, l.ag].filter(Boolean).join(' ')); if (!q.every((w) => s.includes(w))) return false; }
      return true;
    });
  }
  function kxCount(f) {
    const k = JSON.stringify(f, (key, v) => (v instanceof Set ? [...v] : v));
    if (memo.count.has(k)) return memo.count.get(k);
    const n = kxFilter(f).length;
    if (memo.count.size > 500) memo.count.clear();
    memo.count.set(k, n);
    return n;
  }

  /* ─────────── KX.relax ─────────── */
  const FILTER_LABEL = { c: 'Grad', m: 'Opština', n: 'Naselje', pmin: 'Cena od', pmax: 'Cena do', amin: 'Kvadratura od', amax: 'Kvadratura do', ro: 'Struktura', flmin: 'Sprat od', flmax: 'Sprat do', notLast: 'Nije poslednji sprat', ymin: 'Godina od', ymax: 'Godina do', co: 'Stanje', he: 'Grejanje', fu: 'Nameštenost', reg: 'Uknjiženo', newbuild: 'Novogradnja', agency: 'Agencija', advertiser: 'Oglašivač', q: 'Tekst', deltaMax: 'Δ cena', legal: 'Samo zeleni', risk: 'Sakrij rizične', fit: 'Uklapa se u budžet' };
  function relax(f) {
    const base = FILTER_BASE();
    const active = (k) => isOn(f[k]);
    const off = (k) => (k in base ? base[k] : (Array.isArray(f[k]) ? [] : false));
    const cands = [];
    const add = (label, filters) => { const count = kxCount(filters); if (count > 0) cands.push({ label, filters, count }); };
    for (const k of Object.keys(FILTER_LABEL)) {
      if (!active(k)) continue;
      const removed = { ...f, [k]: off(k) };
      if (k === 'c') { removed.m = []; removed.n = []; }
      if (k === 'm') removed.n = [];
      add(`Ukloni filter ${FILTER_LABEL[k]}`, removed);
      if (k === 'pmax') add(`Cena do ${fmtEur(+f.pmax * 1.2)} (+20 %)`, { ...f, pmax: Math.round(+f.pmax * 1.2) });
      if (k === 'pmin') add(`Cena od ${fmtEur(+f.pmin * 0.8)} (−20 %)`, { ...f, pmin: Math.round(+f.pmin * 0.8) });
      if (k === 'amax') add(`Kvadratura do ${fmtN(+f.amax * 1.2)} m² (+20 %)`, { ...f, amax: Math.round(+f.amax * 1.2) });
      if (k === 'amin') add(`Kvadratura od ${fmtN(+f.amin * 0.8)} m² (−20 %)`, { ...f, amin: Math.round(+f.amin * 0.8) });
      if (k === 'ro') { const r = f.ro.filter((v) => isFinite(+v)).map(Number); const ext = [...new Set(r.flatMap((v) => [v - 0.5, v, v + 0.5]).filter((v) => v >= 0.5))]; if (ext.length > r.length) add('Dodaj susednu strukturu (±0,5 sobe)', { ...f, ro: ext }); }
      if (k === 'n' && f.m?.length) add('Proširi na celu opštinu', { ...f, n: [] });
      if (k === 'flmax') add(`Sprat do ${+f.flmax + 2}`, { ...f, flmax: +f.flmax + 2 });
      if (k === 'ymin') add(`Godina od ${+f.ymin - 10}`, { ...f, ymin: +f.ymin - 10 });
    }
    const amLabel = (a) => (typeof AMEN !== 'undefined' && AMEN[a]) || a;
    if (Array.isArray(f.am)) for (const a of f.am) add(`Ukloni filter ${amLabel(a)}`, { ...f, am: f.am.filter((x) => x !== a) });
    /* nijedan pojedinačni filter ne pomaže → probaj parove, pa „samo lokacija”, pa „bez filtera” */
    if (!cands.length) {
      const units = [];
      for (const k of Object.keys(FILTER_LABEL)) if (active(k) && k !== 'q') units.push({ label: FILTER_LABEL[k], patch: k === 'c' ? { c: '', m: [], n: [] } : k === 'm' ? { m: [], n: [] } : { [k]: off(k) } });
      if (Array.isArray(f.am)) for (const a of f.am) units.push({ label: amLabel(a), patch: { am: f.am.filter((x) => x !== a) } });
      for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
        const patch = { ...units[i].patch, ...units[j].patch };
        if (units[i].patch.am && units[j].patch.am) patch.am = f.am.filter((x) => units[i].patch.am.includes(x) && units[j].patch.am.includes(x));
        add(`Ukloni filtere ${units[i].label} i ${units[j].label}`, { ...f, ...patch });
      }
      if (active('c') || active('m') || active('n')) add('Zadrži samo lokaciju', { ...base, t: f.t, pt: f.pt || [], c: f.c || '', m: f.m || [], n: f.n || [] });
      if (!cands.length) add('Ukloni sve filtere', { ...base, t: f.t, pt: f.pt || [] });
    }
    cands.sort((x, y) => y.count - x.count);
    const seen = new Set();
    return cands.filter((c) => { if (seen.has(c.label)) return false; seen.add(c.label); return true; }).slice(0, 5);
  }

  /* ─────────── ledger („Kako računamo”) ─────────── */
  const ledger = [
    { feature: 'Cena, €/m², kvadratura, struktura, sprat, grejanje, uknjiženost', real: true, how: 'Polja iz oglasa (data.js); ništa se ne menja.' },
    { feature: 'Porez na prenos 2,5 % / PDV 10 %', real: true, how: 'Starogradnja: 2,5 % × cena (zakonski obveznik prodavac, ugovorom kupac). Novogradnja: PDV 10 % je već u oglašenoj ceni (cena ÷ 1,10 = neto); prekidač „cena je bez PDV-a” dodaje 10 %.' },
    { feature: 'Olakšice za prvi stan', real: true, how: 'Oslobođeno 40 m² + 15 m² po članu domaćinstva. Starogradnja: porez × (oslobođeni m² ÷ m²) odbija se na dan kupovine. Novogradnja: povraćaj PDV-a = neto cena × 10 % × udeo, stiže ≈ 45 dana kasnije (RFN), samo za prvu kupovinu od investitora.' },
    { feature: 'Provizija agencije', real: true, how: 'Oglas agencije: procenat iz profila (2 %) × cena + PDV 20 %; oglas vlasnika: 0. Ko plaća (kupac/prodavac) bira se u profilu. Zakup: 50 % kirije; plaća zakupac, osim kad agencija (pm=false) naplaćuje vlasniku.' },
    { feature: 'Overa, upis, bankarski troškovi', real: false, how: 'Demo tarife: beležnik po razredima 120–650 €, upis 45 €, procena 120 €, obrada 0,5 % kredita, NKOSK 1,5–3,5 % (raste sa LTV, opciono), osiguranje 40 €/god.' },
    { feature: 'Rata kredita', real: true, how: 'Anuitet: kredit × i ÷ (1 − (1+i)^−n), i = NKS ÷ 12, n = godine × 12. Kredit = LTV × cena (80 %, 90 % za prvi stan) ili cena + troškovi − keš.' },
    { feature: 'Keš ili kredit', real: true, how: 'Maks. rata = DTI (50 %, konzervativno; NBS dozvoljava 60 %) × neto prihod − postojeće rate; maks. kredit iz anuiteta; kapija uknjiženosti: neuknjiženo/ozakonjenje → samo keš, u procesu/Zakon 2025 → zavisi od banke.' },
    { feature: 'Mesečni računi (grejanje, struja, voda, održavanje)', real: false, how: 'Procena po m²: CG 1,15 €/m²; ostala grejanja 0,45–1,05 €/m² × faktor energetskog razreda; struja 20 € + 0,30 €/m²; voda i smeće 8 € + 0,20 €/m²; stambena zajednica 0,12 €/m² (0,25 sa liftom) + 5 €.' },
    { feature: 'Porez na imovinu', real: false, how: 'Gruba procena: m² × medijan €/m² opštine × 0,85 × (1 − amortizacija 1 %/god, maks. 40 %) × 0,4 %, −50 % za stanovanje (maks. 20.000 RSD). Prava osnovica je prosečna cena zone koju utvrđuje opština.' },
    { feature: 'Fer cena', real: true, how: 'Do 8 najsličnijih oglasa istog tipa u istom gradu (udaljenost + razlika m², soba, naselja); medijan €/m² ponderisan blizinom, korigovan za sprat, stanje, grejanje, terasu, energetski razred; opseg ±6 %. Bez presude kada je manje od 5 uporedivih.' },
    { feature: 'Pregovarač', real: true, how: 'Bodovi za odstupanje od procene, dane na oglasu naspram medijana opštine, sniženja, „po dogovoru”, više oglašivača, renoviranje, oglas vlasnika; zbir (maks. 15 %) = prostor za pregovor; prva ponuda = cena × (1 − (bodovi + 3) %).' },
    { feature: 'Istorija cene', real: false, how: 'Demo prikaz: oko trećine oglasa starijih od dve nedelje dobija tačno jedno sniženje 2–9 % u determinisanom mesecu (hash sluga); trenutna cena je uvek prava. 12 mesečnih tačaka.' },
    { feature: 'Dani na oglasu', real: false, how: 'Objavljeno = danas − dz (pravo polje). ~20 % oglasa je „obnavljano” (demo): pravi broj dana = dz + 30–120 i taj pošten broj prikazujemo. Percentil i medijan dana računaju se iz pravih dz vrednosti opštine.' },
    { feature: 'Isti stan, više agencija', real: true, how: `Ključ: isti tip, grad, opština, struktura, |Δm²| ≤ 2, isti sprat (ili nepoznat), ista godina ±2, različit oglašivač, ≤ 3 km. „Sigurno” = isto naselje, |Δm²| ≤ 1, isti sprat; ostalo „moguće”. U demo podacima nema pravih duplikata, pa su grupe „moguće” — nijedan oglas nije izmišljen.` },
    { feature: 'Pravni status (semafor)', real: false, how: 'Iz polja uknjiženo + demo raspodela (hash): uknjiženo ≈ 70 %, u procesu ≈ 10 %, upisano po Zakonu 2025 ≈ 8 %, ozakonjenje ≈ 7 %, nije ≈ 5 %. Hipoteka, suvlasništvo i upotrebna dozvola su demo zastavice. Proverite u eKatastru.' },
    { feature: 'Rizik prevare (zakup)', real: true, how: 'Bodovi: kirija ≥ 30 % ispod medijana naselja/opštine (35), ≥ 15 % (15), ≤ 3 fotografije (10), vlasnik bez verifikacije (8), neverifikovana agencija (5), depozit > 2 kirije (15), fraze „uplata unapred / u inostranstvu / Western Union” (30), nov oglas sa niskom kirijom (5). < 20 zeleno, 20–44 žuto, ≥ 45 crveno. Demo opisi ne sadrže takve fraze.' },
    { feature: 'Šta dobijaš za svoj budžet', real: true, how: 'Po opštini (≥ 5 oglasa): medijan €/m²; neto = budžet − porez 2,5 % − provizija 2 % + PDV − beležnik − upis; m² = neto ÷ medijan €/m².' },
    { feature: 'Vreme do mojih mesta', real: false, how: 'Vazdušna linija × 1,3; auto 22 km/h + 4 min, gradski prevoz 14 km/h + 6 min, peške 4,5 km/h, bicikl 14 km/h + 2 min; 1–180 min. Procena, bez saobraćaja i linija.' },
    { feature: 'Brza pretraga i živi brojači', real: true, how: 'Rečnik gradova, opština i naselja (bez dijakritika), gramatika cena/kvadratura/struktura/osobina; brojači = applyFilters nad svih 660 oglasa.' },
    { feature: 'Δ naspram proseka opštine', real: true, how: '€/m² oglasa ÷ medijan €/m² iste opštine (isti tip, ≥ 5 oglasa) − 1; sakriveno kad nema uzorka.' },
  ];

  /* ─────────── enrich ─────────── */
  let enriched = false;
  function enrich(force) {
    if (enriched && !force) return idx;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    buildIndexes();
    buildDupes();
    for (const m of Object.values(memo)) m.clear();
    dict = buildDict();
    enriched = true;
    idx.enrichMs = Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) * 10) / 10;
    return idx;
  }
  const ensure = () => { if (!enriched) enrich(); };
  const guard = (fn) => (...args) => { ensure(); return fn(...args); };

  return {
    enrich, profile, ledger, titleOf, EKATASTAR, POI, TARIFF,
    cost: guard(cost), afford: guard(afford), creditCapacity, fair: guard(fair), history: guard(history),
    dupes: { groupOf: guard(dupes.groupOf), isSecondary: guard(dupes.isSecondary), groups: guard(dupes.groups), count: guard(dupes.count), hiddenCount: guard(dupes.hiddenCount), match: dupes.match, build: dupes.build },
    trust: guard(trust), trustCheck, budgetMap: guard(budgetMap), netForBudget,
    travel, travelAll, fairMiddle, placeSuggest: guard(placeSuggest),
    parseQuery: guard(parseQuery), count: guard(kxCount), filter: guard(kxFilter), relax: guard(relax),
    ppmDelta: guard(ppmDelta), medianPpm: guard(medianPpm), medianDz: guard(medianDz),
    annuity, notar, haversine, deacc, median, utilities, legalLabel: LEGAL_LABEL, roomWord,
    get stats() { return { enrichMs: idx.enrichMs, dupes: idx.dupesCount, listings: all().length }; },
  };
})();
if (typeof window !== 'undefined') window.KX = KX;
