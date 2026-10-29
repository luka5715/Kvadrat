/* Kvadrat.rs — map.js: nacrtana mapa (SVG) bez pločica. Globalno: mapView(container, opts).
   Projekcija: ekvirektangularna oko centra grada (x skaliran sa cos(lat)), zum 11–17, jedinice "sveta" = px na zumu 13.
   Tkivo grada (reka, blokovi, avenije, parkovi) generiše se deterministički iz KV.cities / KV.listings (hash+rng).
   Pinovi su HTML (.pin iz components.css) u jednom sloju koji se samo translira pri pomeranju; SVG tkivo je jedna grupa sa transform-om.
   Zavisi (meko) od core.js (hash, rng, fmt, store) i ui.js (pin, cluster, mapLegend, pinPopover, icon); sve kroz guard-ove. */
'use strict';

const mapView = (() => {
  /* ───────── pomoćno ───────── */
  const S = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const DATA = () => window.KV || window.D || { listings: [], cities: [], muns: [] };
  const UI = () => window.ui || window;
  const nf0 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 1 });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const H = (s) => S(() => hash(s), null) ?? (() => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; })();
  const RNG = (seed) => S(() => rng(seed), null) || (() => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const reduced = () => S(() => window.matchMedia('(prefers-reduced-motion:reduce)').matches, false);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k === 'html') n.innerHTML = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : String(v)); }
    for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; n.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid); }
    return n;
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}, ...kids) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; n.setAttribute(k, String(v)); }
    kids.flat(Infinity).forEach((k) => { if (k) n.appendChild(k); });
    return n;
  };
  const icon = (name, size) => S(() => UI().icon(name, size), null) || el('span', { 'aria-hidden': 'true' }, name === 'zoom-in' ? '+' : name === 'zoom-out' ? '−' : name === 'x' ? '×' : '');
  const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b; return c; };
  const oglasa = (n) => `${nf0.format(n)} ${plural(n, 'oglas', 'oglasa', 'oglasa')}`;
  const fullPrice = (l) => S(() => fmt.price(l.p, l.t), null) || (nf0.format(l.p) + (l.t === 'izdavanje' ? ' €/mes' : ' €'));
  function shortPrice(l) {
    const p = l.p || 0;
    if (l.t === 'izdavanje') return nf0.format(p) + ' €';
    if (p >= 1e6) { const m = Math.round(p / 1e5) / 10; return (Number.isInteger(m) ? String(m) : nf1.format(m)) + 'M'; }
    if (p >= 1000) return Math.round(p / 1000) + 'k';
    return nf0.format(p) + ' €';
  }
  const isNew = (l) => l.co === 'novogradnja' || l.co === 'u-izgradnji';
  const recentSet = () => S(() => new Set(store.recent || []), new Set());

  /* ───────── projekcija ───────── */
  const ZB = 13, ZMIN = 11, ZMAX = 17;
  const M_PER_DEG = 111320;
  function makeProj(lat0, lng0) {
    const cx = Math.cos((lat0 * Math.PI) / 180);
    const mpp = (156543.03 * cx) / Math.pow(2, ZB); /* metara po px na zumu 13 (kao web-merkator na toj širini) */
    const u = 1 / mpp; /* jedinica sveta po metru */
    return {
      u, lat0, lng0,
      toW: (lat, lng) => [(lng - lng0) * M_PER_DEG * cx * u, -(lat - lat0) * M_PER_DEG * u],
      fromW: (x, y) => [lat0 - y / (M_PER_DEG * u), lng0 + x / (M_PER_DEG * cx * u)],
    };
  }
  const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
    return Math.sqrt(dist2(px, py, ax + t * dx, ay + t * dy));
  }
  function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  /* ───────── geografija (približno; deklarisano kao mock u izveštaju) ───────── */
  const RIVERS = {
    beograd: [
      { n: 'Sava', w: 320, pts: [[44.735, 20.355], [44.768, 20.385], [44.787, 20.405], [44.803, 20.426], [44.818, 20.438], [44.826, 20.445]] },
      { n: 'Dunav', w: 700, pts: [[44.905, 20.33], [44.875, 20.37], [44.846, 20.405], [44.828, 20.436], [44.826, 20.445], [44.832, 20.47], [44.826, 20.51], [44.81, 20.56], [44.79, 20.62], [44.78, 20.7]] },
    ],
    'novi-sad': [{ n: 'Dunav', w: 420, pts: [[45.215, 19.74], [45.238, 19.79], [45.246, 19.83], [45.254, 19.858], [45.243, 19.885], [45.222, 19.905]] }],
    nis: [{ n: 'Nišava', w: 70, pts: [[43.3, 22.03], [43.315, 21.96], [43.319, 21.92], [43.321, 21.895], [43.324, 21.86], [43.33, 21.81]] }],
    smederevo: [{ n: 'Dunav', w: 650, pts: [[44.70, 20.88], [44.675, 20.92], [44.665, 20.96]] }],
    sabac: [{ n: 'Sava', w: 280, pts: [[44.78, 19.66], [44.765, 19.70], [44.745, 19.73]] }],
    'sremska-mitrovica': [{ n: 'Sava', w: 280, pts: [[44.95, 19.56], [44.965, 19.61], [44.96, 19.65]] }],
    cacak: [{ n: 'Zapadna Morava', w: 90, pts: [[43.9, 20.30], [43.885, 20.35], [43.88, 20.40]] }],
    kraljevo: [{ n: 'Ibar', w: 90, pts: [[43.69, 20.67], [43.72, 20.69], [43.74, 20.72]] }],
    zrenjanin: [{ n: 'Begej', w: 50, pts: [[45.40, 20.36], [45.383, 20.385], [45.365, 20.41]] }],
    kragujevac: [{ n: 'Lepenica', w: 30, pts: [[43.99, 20.90], [44.012, 20.93], [44.03, 20.96]] }],
    uzice: [{ n: 'Đetinja', w: 30, pts: [[43.85, 19.82], [43.858, 19.845], [43.86, 19.87]] }],
    loznica: [{ n: 'Drina', w: 220, pts: [[44.56, 19.18], [44.53, 19.19], [44.50, 19.20]] }],
    krusevac: [{ n: 'Rasina', w: 40, pts: [[43.57, 21.30], [43.585, 21.335], [43.60, 21.36]] }],
  };
  const PARKS = {
    beograd: [[44.8235, 20.4515, 330, 'Kalemegdan'], [44.8075, 20.4695, 180, 'Tašmajdan'], [44.766, 20.431, 520, 'Košutnjak'], [44.787, 20.395, 480, 'Ada Ciganlija'], [44.8165, 20.4315, 260, 'Ušće'], [44.797, 20.503, 320, 'Zvezdarska šuma'], [44.778, 20.447, 300, 'Topčider'], [44.781, 20.49, 160, null]],
    'novi-sad': [[45.2555, 19.8475, 170, 'Dunavski park'], [45.2415, 19.845, 200, 'Limanski park'], [45.2345, 19.8565, 260, 'Štrand'], [45.249, 19.868, 180, null]],
    nis: [[43.323, 21.9, 170, 'Tvrđava'], [43.3145, 21.902, 150, 'Čair'], [43.333, 21.925, 170, null]],
  };

  /* ───────── generator tkiva grada ───────── */
  const FABRIC = new Map();
  function fabricFor(city, proj, listings) {
    const key = city.s + '|' + proj.lat0.toFixed(4) + '|' + proj.lng0.toFixed(4);
    if (FABRIC.has(key)) return FABRIC.get(key);
    const u = proj.u, r = RNG(H('fabric:' + city.s));
    const [cx, cy] = proj.toW(city.lat, city.lng);
    const mine = listings.filter((l) => l.cs === city.s);
    /* poluprečnik jezgra: 90. percentil udaljenosti oglasa od centra (m), ograničen */
    const dists = mine.map((l) => { const [x, y] = proj.toW(l.lat, l.lng); return Math.sqrt(dist2(x, y, cx, cy)) / u; }).sort((a, b) => a - b);
    const p90 = dists.length ? dists[Math.floor(dists.length * 0.85)] : 2500;
    const R = clamp(p90 * 1.15, 1600, 7800) * (city.s === 'beograd' ? 1.1 : 1);
    const rivers = (RIVERS[city.s] || []).map((rv) => ({ ...rv, w: rv.w, wpts: rv.pts.map(([la, ln]) => proj.toW(la, ln)) }));
    const parks = (PARKS[city.s] || []).map(([la, ln, rad, n]) => { const [x, y] = proj.toW(la, ln); return { x, y, r: rad * u, n }; });
    if (!parks.length) { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = (0.15 + r() * 0.55) * R * u; parks.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: (140 + r() * 260) * u, n: null }); } }
    const nearWater = (x, y, extra) => rivers.some((rv) => { for (let i = 1; i < rv.wpts.length; i++) { const a = rv.wpts[i - 1], b = rv.wpts[i]; if (segDist(x, y, a[0], a[1], b[0], b[1]) < (rv.w / 2 + extra) * u) return true; } return false; });
    const inPark = (x, y) => parks.some((p) => dist2(x, y, p.x, p.y) < p.r * p.r * 0.9);

    const g = svg('g', { class: 'mv-city', 'data-city': city.s });
    /* voda */
    const gw = svg('g', { class: 'mv-water' });
    rivers.forEach((rv) => { const d = rv.wpts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''); gw.appendChild(svg('path', { d, 'stroke-width': (rv.w * u).toFixed(2), 'data-w': (rv.w * u).toFixed(2), fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })); });
    /* parkovi */
    const gp = svg('g', { class: 'mv-parks' });
    parks.forEach((p, idx) => {
      const pr = RNG(H('park:' + city.s + idx)); const n = 11; const pts = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const rr = p.r * (0.72 + pr() * 0.36); pts.push([p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr]); }
      let d = '';
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; d += (i ? '' : `M${mx.toFixed(1)} ${my.toFixed(1)}`); const c = pts[(i + 1) % n], nx = (b[0] + pts[(i + 2) % n][0]) / 2, ny = (b[1] + pts[(i + 2) % n][1]) / 2; d += `Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`; }
      gp.appendChild(svg('path', { d: d + 'Z' }));
    });
    /* blokovi: sektori sa sopstvenom rotacijom i veličinom ćelije; svaki sektor = jedna putanja (grubo) + jedna fina */
    const nSec = 4 + Math.floor(r() * 3);
    const bounds = []; let a0 = r() * Math.PI * 2;
    for (let i = 0; i < nSec; i++) { bounds.push(a0); a0 += (Math.PI * 2) / nSec + (r() - 0.5) * 0.6; }
    const secOf = (x, y) => { let a = Math.atan2(y - cy, x - cx) - bounds[0]; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); let acc = 0; for (let i = 0; i < nSec; i++) { const span = ((bounds[(i + 1) % nSec] - bounds[i]) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) || (Math.PI * 2) / nSec; acc += span; if (a < acc) return i; } return nSec - 1; };
    const gbC = svg('g', { class: 'mv-blocks' }), gbF = svg('g', { class: 'mv-blocks mv-fine' }), gs = svg('g', { class: 'mv-streets' }), ga = svg('g', { class: 'mv-avenues' });
    const Ru = R * u;
    const blockPass = (cellM, maxR, fine) => {
      for (let s = 0; s < nSec; s++) {
        const rot = bounds[s] + (r() - 0.5) * 0.4, cell = cell_(cellM, s); const cs_ = Math.cos(rot), sn = Math.sin(rot);
        const gap = (fine ? 18 : 26) * u; const n = Math.ceil((maxR * u) / cell) + 1; let d = '', sd = '';
        const sr = RNG(H('blk:' + city.s + s + (fine ? 'f' : 'c')));
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
          const lx = i * cell, ly = j * cell; const x = cx + lx * cs_ - ly * sn, y = cy + lx * sn + ly * cs_;
          const dd = Math.sqrt(dist2(x, y, cx, cy)) / u; if (dd > maxR * (0.82 + 0.3 * sr())) continue;
          if (secOf(x, y) !== s) continue;
          const keep = 1 - 0.72 * Math.pow(dd / R, 1.6); if (sr() > keep) continue;
          if (nearWater(x, y, 70) || inPark(x, y)) continue;
          const w = cell - gap - sr() * cell * 0.18, h = cell - gap - sr() * cell * 0.18; const hw = w / 2, hh = h / 2;
          const c = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([px, py]) => [x + px * cs_ - py * sn, y + px * sn + py * cs_]);
          d += `M${c[0][0].toFixed(1)} ${c[0][1].toFixed(1)}L${c[1][0].toFixed(1)} ${c[1][1].toFixed(1)}L${c[2][0].toFixed(1)} ${c[2][1].toFixed(1)}L${c[3][0].toFixed(1)} ${c[3][1].toFixed(1)}Z`;
        }
        (fine ? gbF : gbC).appendChild(svg('path', { d }));
        if (!fine) {
          /* sekundarne ulice: svaka 5. linija mreže, isečena na sektor (uzorkovanje) */
          const step = cell * (4 + Math.floor(sr() * 3)); const m = Math.ceil((maxR * u) / step) + 1; const seg = cell / 2;
          for (let dir = 0; dir < 2; dir++) for (let i = -m; i <= m; i++) {
            let on = false; const off = (sr() - 0.5) * step;
            for (let t = -maxR * u; t <= maxR * u; t += seg) {
              const lx = dir ? t : i * step + off, ly = dir ? i * step + off : t; const x = cx + lx * cs_ - ly * sn, y = cy + lx * sn + ly * cs_;
              const ok = Math.sqrt(dist2(x, y, cx, cy)) / u < maxR * 0.92 && secOf(x, y) === s && !nearWater(x, y, 40) && !inPark(x, y);
              if (ok) { sd += (on ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); on = true; } else on = false;
            }
          }
          gs.appendChild(svg('path', { d: sd, fill: 'none' }));
        }
      }
    };
    const cell_ = (base, s) => base * (0.85 + ((H(city.s + 'cell' + s) % 100) / 100) * 0.4) * u;
    blockPass(city.s === 'beograd' ? 300 : 240, R, false);
    blockPass(130, Math.min(R, 2600), true);
    /* glavne avenije: zraci iz centra sa blagom krivinom + 2 polukružne obilaznice */
    const nAv = 6 + Math.floor(r() * 4);
    for (let i = 0; i < nAv; i++) {
      const a = (i / nAv) * Math.PI * 2 + (r() - 0.5) * 0.5; const len = Ru * (0.95 + r() * 0.35); const bend = (r() - 0.5) * 0.3 * len;
      const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len; const mx = cx + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, my = cy + Math.sin(a) * len * 0.5 + Math.cos(a) * bend;
      if (nearWater((cx + ex) / 2, (cy + ey) / 2, 30) && r() < 0.5) continue;
      ga.appendChild(svg('path', { d: `M${cx.toFixed(1)} ${cy.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`, fill: 'none' }));
    }
    [0.32, 0.68].forEach((f, ri) => {
      const rad = Ru * f; const start = r() * Math.PI * 2, span = Math.PI * (1.1 + r() * 0.9); let d = ''; let on = false;
      for (let t = 0; t <= span; t += 0.06) { const rr = rad * (1 + Math.sin(t * 3 + ri) * 0.04); const x = cx + Math.cos(start + t) * rr, y = cy + Math.sin(start + t) * rr; const ok = !nearWater(x, y, 20); if (ok) { d += (on ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); on = true; } else on = false; }
      ga.appendChild(svg('path', { d, fill: 'none', class: 'mv-ring' }));
    });
    /* sateliti: opštine/naselja daleko od jezgra dobijaju malo tkivo */
    const far = new Map();
    mine.forEach((l) => { const [x, y] = proj.toW(l.lat, l.lng); if (Math.sqrt(dist2(x, y, cx, cy)) / u > R * 1.25) { const k = l.ms || l.ns; const e = far.get(k) || { x: 0, y: 0, n: 0 }; e.x += x; e.y += y; e.n++; far.set(k, e); } });
    const gsat = svg('g', { class: 'mv-sat' });
    [...far.entries()].forEach(([k, e]) => {
      const sx = e.x / e.n, sy = e.y / e.n; const sr = RNG(H('sat:' + city.s + k)); const rad = (700 + Math.min(e.n, 8) * 120) * u; const rot = sr() * Math.PI; const cs_ = Math.cos(rot), sn = Math.sin(rot); const cell = 170 * u; const n = Math.ceil(rad / cell); let d = '';
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const lx = i * cell, ly = j * cell; if (lx * lx + ly * ly > rad * rad * (0.6 + sr() * 0.5)) continue; if (sr() > 0.72) continue; const x = sx + lx * cs_ - ly * sn, y = sy + lx * sn + ly * cs_; const hw = cell * 0.36, hh = cell * 0.36; const c = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([px, py]) => [x + px * cs_ - py * sn, y + px * sn + py * cs_]); d += `M${c[0][0].toFixed(1)} ${c[0][1].toFixed(1)}L${c[1][0].toFixed(1)} ${c[1][1].toFixed(1)}L${c[2][0].toFixed(1)} ${c[2][1].toFixed(1)}L${c[3][0].toFixed(1)} ${c[3][1].toFixed(1)}Z`; }
      gsat.appendChild(svg('path', { d, class: 'mv-blocks' }));
      const a = sr() * Math.PI; gsat.appendChild(svg('path', { d: `M${(sx - Math.cos(a) * rad * 1.3).toFixed(1)} ${(sy - Math.sin(a) * rad * 1.3).toFixed(1)}L${(sx + Math.cos(a) * rad * 1.3).toFixed(1)} ${(sy + Math.sin(a) * rad * 1.3).toFixed(1)}`, class: 'mv-sat-road', fill: 'none' }));
    });
    g.append(gsat, gbC, gbF, gp, gs, ga, gw);
    const out = { g, cx, cy, R: Ru, parks, rivers };
    FABRIC.set(key, out);
    return out;
  }

  /* ───────── komponenta ───────── */
  function mapView(container, opts = {}) {
    const o = { interactive: true, drawTool: true, legend: true, showAreaButton: true, popover: true, labels: true, mode: 'pins', places: [], radius: null, height: null, ...opts };
    const KV = DATA();
    container.classList.add('map', 'mv');
    if (o.height) container.style.height = typeof o.height === 'number' ? o.height + 'px' : o.height;
    container.innerHTML = '';
    if (o.interactive) { container.tabIndex = 0; container.setAttribute('role', 'application'); container.setAttribute('aria-label', 'Interaktivna mapa oglasa. Strelice pomeraju, plus i minus zumiraju.'); } else container.setAttribute('aria-label', 'Mapa');

    /* slojevi */
    const svgEl = svg('svg', { class: 'mv-svg', 'aria-hidden': 'true' });
    const world = svg('g', { class: 'mv-world' });
    const gCities = svg('g', { class: 'mv-cities' });
    const gBudget = svg('g', { class: 'mv-budget' });
    const gPlaces = svg('g', { class: 'mv-places' });
    const gPoly = svg('g', { class: 'mv-poly' });
    const gRadius = svg('g', { class: 'mv-radius' });
    world.append(gCities, gRadius, gPlaces, gBudget, gPoly);
    svgEl.appendChild(world);
    const labels = el('div', { class: 'mv-labels', 'aria-hidden': 'true' });
    const pinsL = el('div', { class: 'mv-pins' });
    const overlay = svg('svg', { class: 'mv-overlay', 'aria-hidden': 'true' });
    const popL = el('div', { class: 'mv-pop' });
    const chrome = el('div', { class: 'mv-chrome' });
    container.append(svgEl, labels, pinsL, overlay, popL, chrome);

    /* stanje */
    let all = (o.listings || []).filter((l) => l && typeof l.lat === 'number' && typeof l.lng === 'number');
    let visible = all;
    let polygon = null; /* [[x,y] svet] */
    let selected = o.selected || null, hovered = null;
    let mode = o.mode === 'budget' ? 'budget' : 'pins';
    let budgetRows = [], places = o.places || [], radius = o.radius;
    let W = container.clientWidth || 600, Hh = container.clientHeight || 400;
    const cityOf = () => {
      const counts = new Map(); all.forEach((l) => counts.set(l.cs, (counts.get(l.cs) || 0) + 1));
      let best = o.city || null; if (!best) { let m = -1; counts.forEach((n, cs) => { if (n > m) { m = n; best = cs; } }); }
      return KV.cities.find((c) => c.s === best) || KV.cities.find((c) => c.s === 'beograd') || { s: 'x', n: '', lat: all[0] ? all[0].lat : 44.79, lng: all[0] ? all[0].lng : 20.45 };
    };
    let city = cityOf();
    let proj = makeProj(city.lat, city.lng);
    let view = { cx: 0, cy: 0, z: 13 }; /* centar u jedinicama sveta */
    let committed = null; /* granice poslednje "pretrage u ovom području" */
    let drawing = false, drawPts = [], freehand = false;
    let destroyed = false;
    const recent = recentSet();

    /* ── chrome: kontrole ── */
    const ctl = el('div', { class: 'ctl' });
    const zin = el('button', { type: 'button', 'aria-label': 'Približi', title: 'Približi (+)', onclick: () => zoomBy(1) }, icon('zoom-in'));
    const zout = el('button', { type: 'button', 'aria-label': 'Udalji', title: 'Udalji (−)', onclick: () => zoomBy(-1) }, icon('zoom-out'));
    const zfit = el('button', { type: 'button', 'aria-label': 'Prikaži sve oglase', title: 'Prikaži sve', onclick: () => api.fit() }, icon('map'));
    ctl.append(zin, zout, zfit);
    const drawBtn = el('button', { class: 'draw', type: 'button', 'aria-pressed': 'false', onclick: () => (drawing ? cancelDraw() : startDraw()) }, icon('pen'), el('span', {}, 'Nacrtaj zonu'));
    const drawBar = el('div', { class: 'mv-drawbar', hidden: true },
      el('span', { class: 'mv-drawhint' }, 'Klikni tačke oko zone, dupli klik ili „Završi” zatvara.'),
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => finishDraw() }, 'Završi'),
      el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => cancelDraw() }, 'Poništi'));
    const zoneChip = el('div', { class: 'mv-zone', hidden: true });
    const areaBtn = el('button', { class: 'btn btn-ink btn-sm mv-area', type: 'button', hidden: true, onclick: () => commitArea() }, icon('search', 16), 'Pretraži u ovom području');
    const legend = el('div', { class: 'mv-legend' });
    const scale = el('div', { class: 'mv-scale', 'aria-hidden': 'true' }, el('i'), el('span'));
    const live = el('div', { class: 'sr', 'aria-live': 'polite' });
    if (o.interactive) chrome.append(ctl);
    if (o.interactive && o.drawTool) chrome.append(drawBtn, drawBar);
    chrome.append(zoneChip);
    if (o.interactive && o.showAreaButton) chrome.append(areaBtn);
    if (o.legend) chrome.append(legend);
    chrome.append(scale, live);

    /* ── pomoćne konverzije ── */
    const k = () => Math.pow(2, view.z - ZB);
    const toScreen = (wx, wy) => { const kk = k(); return [W / 2 + (wx - view.cx) * kk, Hh / 2 + (wy - view.cy) * kk]; };
    const fromScreen = (sx, sy) => { const kk = k(); return [view.cx + (sx - W / 2) / kk, view.cy + (sy - Hh / 2) / kk]; };
    const lw = (l) => { if (!l._w || l._w.p !== proj) l._w = { p: proj, xy: proj.toW(l.lat, l.lng) }; return l._w.xy; };
    const latLngOfW = (x, y) => { const [lat, lng] = proj.fromW(x, y); return { lat: +lat.toFixed(5), lng: +lng.toFixed(5) }; };

    function getBounds() {
      const [x1, y1] = fromScreen(0, 0), [x2, y2] = fromScreen(W, Hh);
      const a = proj.fromW(x1, y1), b = proj.fromW(x2, y2);
      return { n: +a[0].toFixed(5), s: +b[0].toFixed(5), w: +a[1].toFixed(5), e: +b[1].toFixed(5), zoom: +view.z.toFixed(2), center: latLngOfW(view.cx, view.cy), polygon: polygon ? polygon.map(([x, y]) => latLngOfW(x, y)) : null };
    }
    const inView = (l, pad = 0) => { const [x, y] = lw(l); const [sx, sy] = toScreen(x, y); return sx >= -pad && sx <= W + pad && sy >= -pad && sy <= Hh + pad; };

    /* ── render ── */
    let raf = 0, needPins = true, needLabels = true, lastZb = null, clusterCache = null, pinOrigin = null, settleT = 0;
    const pinNodes = new Map(), clNodes = new Map(), labelNodes = [];
    function schedule() { if (destroyed) return; if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
    function render() {
      W = container.clientWidth || W; Hh = container.clientHeight || Hh;
      const kk = k(); const tx = W / 2 - view.cx * kk, ty = Hh / 2 - view.cy * kk;
      world.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${kk.toFixed(5)})`);
      const tr = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0)`;
      pinsL.style.transform = tr; labels.style.transform = tr;
      ensureCities();
      const zb = Math.round(view.z * 2) / 2;
      if (zb !== lastZb) {
        lastZb = zb; container.dataset.z = String(Math.floor(view.z));
        /* širine puteva u jedinicama sveta tako da na ekranu budu ~px */
        const f = Math.pow(2, (view.z - ZB) * 0.45) / kk;
        gCities.style.setProperty('--av', (4.2 * f).toFixed(3)); gCities.style.setProperty('--st', (1.6 * f).toFixed(3)); gCities.style.setProperty('--sat', (2.2 * f).toFixed(3));
        gCities.querySelectorAll('.mv-water path').forEach((p) => { const w = +p.dataset.w; p.setAttribute('stroke-width', Math.max(w, 3 / kk).toFixed(2)); });
        needPins = true; needLabels = true;
      }
      if (mode === 'pins') {
        /* ponovni prolaz pinova kad zum/podaci/pomeraj preko margine */
        if (!needPins && pinOrigin) { const dx = Math.abs(view.cx - pinOrigin.cx) * kk, dy = Math.abs(view.cy - pinOrigin.cy) * kk; if (dx > W * 0.6 || dy > Hh * 0.6) needPins = true; }
        if (needPins) { pinsPass(zb, kk); needPins = false; needLabels = true; }
      } else { budgetPass(kk); }
      if (needLabels) { labelsPass(kk); needLabels = false; }
      placesPass(kk); polyPass(kk); radiusPass(kk); drawOverlay(); scalePass(kk); popPass();
      clearTimeout(settleT); settleT = setTimeout(settle, 220);
    }
    function ensureCities() {
      const [x1, y1] = fromScreen(-W, -Hh), [x2, y2] = fromScreen(2 * W, 2 * Hh);
      (KV.cities || []).forEach((c) => {
        if (!c.lat) return;
        if (gCities.querySelector(`[data-city="${c.s}"]`)) return;
        const [x, y] = proj.toW(c.lat, c.lng); const m = 9000 * proj.u;
        if (x + m < x1 || x - m > x2 || y + m < y1 || y - m > y2) return;
        const fb = fabricFor(c, proj, KV.listings || all);
        gCities.appendChild(fb.g);
      });
    }

    /* klasterisanje u px na zumu zb (nezavisno od pomeraja) */
    function clusters(zb) {
      if (clusterCache && clusterCache.zb === zb && clusterCache.list === visible) return clusterCache.out;
      const kb = Math.pow(2, zb - ZB);
      const rad = zb < 13 ? 46 : zb < 14.5 ? 36 : zb < 16 ? 26 : zb < 17 ? 16 : 8;
      const cells = new Map(); const items = visible.map((l) => { const [x, y] = lw(l); return { l, x: x * kb, y: y * kb, used: false }; });
      const ck = (x, y) => Math.floor(x / rad) + ':' + Math.floor(y / rad);
      items.forEach((it, i) => { const kkey = ck(it.x, it.y); (cells.get(kkey) || cells.set(kkey, []).get(kkey)).push(i); });
      const out = [];
      items.forEach((it, i) => {
        if (it.used) return; it.used = true; const mem = [it];
        const gx = Math.floor(it.x / rad), gy = Math.floor(it.y / rad);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const arr = cells.get((gx + dx) + ':' + (gy + dy)); if (!arr) continue; arr.forEach((j) => { const jt = items[j]; if (jt.used) return; if (Math.abs(jt.x - it.x) < rad && Math.abs(jt.y - it.y) < rad) { jt.used = true; mem.push(jt); } }); }
        if (mem.length === 1) out.push({ l: it.l, x: it.x / kb, y: it.y / kb });
        else { let sx = 0, sy = 0; mem.forEach((m) => { sx += m.x; sy += m.y; }); out.push({ cl: mem.map((m) => m.l), x: sx / mem.length / kb, y: sy / mem.length / kb, id: 'c' + H(mem.map((m) => m.l.s).sort().join('|')) }); }
      });
      clusterCache = { zb, list: visible, out };
      return out;
    }
    const pinState = (l) => (l.s === selected ? 'selected' : l.s === hovered ? 'hover' : recent.has(l.s) ? 'visited' : 'default');
    function makePin(l) {
      let n = S(() => UI().pin(l, pinState(l), {}), null);
      if (!n) {
        n = el('button', { class: 'pin', type: 'button', 'data-slug': l.s }, el('span', { class: 'p' }), el('span', { class: 's', 'aria-hidden': 'true' }));
        n.setState = (s) => { n.classList.toggle('on', s === 'selected'); n.classList.toggle('seen', s === 'visited'); n.classList.toggle('hov', s === 'hover'); n.setAttribute('aria-pressed', s === 'selected' ? 'true' : 'false'); };
        if (isNew(l)) n.classList.add('new');
      }
      n.querySelector('.p').textContent = shortPrice(l);
      n.setAttribute('aria-label', `${l.ti || ''}, ${fullPrice(l)}`);
      n.dataset.slug = l.s; n.classList.add('mv-pin');
      return n;
    }
    function makeCluster(c) {
      const n = c.cl.length;
      let node = S(() => UI().cluster(n, {}), null);
      if (!node) node = el('button', { class: 'pin cl' + (n >= 50 ? ' lg' : ''), type: 'button', 'aria-label': `${n} oglasa, približi` }, el('span', { class: 'p' }, String(n)), el('span', { class: 's' }));
      node.dataset.cluster = c.id; node.classList.add('mv-pin');
      node.title = `${oglasa(n)} — klikni da približiš`;
      return node;
    }
    let visibleBoxes = []; /* za sudare natpisa */
    function pinsPass(zb, kk) {
      const cl = clusters(zb); const keepP = new Set(), keepC = new Set(); visibleBoxes = [];
      pinOrigin = { cx: view.cx, cy: view.cy };
      const pad = Math.max(W, Hh) * 0.75;
      const [x1, y1] = fromScreen(-pad, -pad), [x2, y2] = fromScreen(W + pad, Hh + pad);
      const frag = document.createDocumentFragment();
      cl.forEach((c) => {
        if (c.x < x1 || c.x > x2 || c.y < y1 || c.y > y2) return;
        const px = c.x * kk, py = c.y * kk;
        if (c.cl) {
          let n = clNodes.get(c.id); if (!n) { n = makeCluster(c); clNodes.set(c.id, n); frag.appendChild(n); }
          n._mem = c.cl; n.style.left = px.toFixed(1) + 'px'; n.style.top = py.toFixed(1) + 'px'; keepC.add(c.id);
          const hs = c.cl.length >= 50 ? 22 : 18; visibleBoxes.push([px - hs, py - hs, px + hs, py + hs]);
          if (c.cl.some((l) => l.s === hovered || l.s === selected)) n.classList.add('hov'); else n.classList.remove('hov');
        } else {
          let n = pinNodes.get(c.l.s); if (!n) { n = makePin(c.l); pinNodes.set(c.l.s, n); frag.appendChild(n); }
          n.style.left = px.toFixed(1) + 'px'; n.style.top = py.toFixed(1) + 'px'; keepP.add(c.l.s);
          const hw = (shortPrice(c.l).length * 7.6 + 20) / 2; visibleBoxes.push([px - hw, py - 38, px + hw, py + 2]);
        }
      });
      pinNodes.forEach((n, s) => { if (!keepP.has(s)) { n.remove(); pinNodes.delete(s); } });
      clNodes.forEach((n, id) => { if (!keepC.has(id)) { n.remove(); clNodes.delete(id); } });
      pinsL.appendChild(frag);
    }
    function refreshStates() { pinNodes.forEach((n, s) => { const l = visible.find((x) => x.s === s); if (l && n.setState) n.setState(pinState(l)); }); clNodes.forEach((n) => { n.classList.toggle('hov', !!(n._mem && n._mem.some((l) => l.s === hovered || l.s === selected))); }); }

    /* natpisi: grad (z<12.5), opštine (12–15.5), naselja (≥14); pobeđuje pin kod sudara */
    let labelData = null;
    function buildLabels() {
      const muns = new Map(), nbs = new Map();
      (KV.listings || all).forEach((l) => {
        if (!l.lat) return; const [x, y] = lw(l);
        if (l.ms) { const e = muns.get(l.cs + '/' + l.ms) || { x: 0, y: 0, n: 0, name: l.m, cs: l.cs }; e.x += x; e.y += y; e.n++; muns.set(l.cs + '/' + l.ms, e); }
        if (l.ns && l.n) { const e = nbs.get(l.cs + '/' + l.ns) || { x: 0, y: 0, n: 0, name: l.n, cs: l.cs }; e.x += x; e.y += y; e.n++; nbs.set(l.cs + '/' + l.ns, e); }
      });
      const out = [];
      (KV.cities || []).forEach((c) => { if (!c.lat) return; const [x, y] = proj.toW(c.lat, c.lng); out.push({ kind: 'city', x, y, name: c.n, n: c.c || 0 }); });
      muns.forEach((e) => { if (e.n >= 2) out.push({ kind: 'mun', x: e.x / e.n, y: e.y / e.n, name: e.name, n: e.n }); });
      nbs.forEach((e) => { if (e.n >= 2) out.push({ kind: 'nb', x: e.x / e.n, y: e.y / e.n, name: e.name, n: e.n }); });
      out.sort((a, b) => b.n - a.n);
      return out;
    }
    const budgetLabels = [];
    function labelsPass(kk) {
      if (!labelData) labelData = buildLabels();
      labelNodes.forEach((n) => n.remove()); labelNodes.length = 0;
      if (!o.labels) return;
      const z = view.z; const placed = [...visibleBoxes];
      const pad = Math.max(W, Hh) * 0.75; const [x1, y1] = fromScreen(-pad, -pad), [x2, y2] = fromScreen(W + pad, Hh + pad);
      const hit = (b) => placed.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1]);
      const frag = document.createDocumentFragment();
      labelData.forEach((d) => {
        const show = d.kind === 'city' ? z < 13.5 : d.kind === 'mun' ? z >= 12 && z < 16 : z >= 14.2;
        if (!show) return; if (d.x < x1 || d.x > x2 || d.y < y1 || d.y > y2) return;
        const px = d.x * kk, py = d.y * kk; const fs = d.kind === 'city' ? 14 : d.kind === 'mun' ? 13 : 11;
        const hw = (d.name.length * (fs * 0.62 + 2.2)) / 2 + 4, hh = fs * 0.8;
        /* probaj nekoliko pomeraja da izbegneš pinove */
        const cands = [[0, 0], [0, -26], [0, 26], [-40, 0], [40, 0]];
        let box = null;
        for (const [ox, oy] of cands) { const b = [px + ox - hw, py + oy - hh, px + ox + hw, py + oy + hh]; if (!hit(b)) { box = b; break; } }
        if (!box) return; placed.push(box);
        const n = el('span', { class: 'mlabel mv-label mv-' + d.kind }, d.name);
        n.style.left = ((box[0] + box[2]) / 2).toFixed(1) + 'px'; n.style.top = ((box[1] + box[3]) / 2).toFixed(1) + 'px';
        frag.appendChild(n); labelNodes.push(n);
      });
      if (mode === 'budget') budgetLabels.forEach((n) => { frag.appendChild(n); labelNodes.push(n); });
      labels.appendChild(frag);
    }

    /* budžet: krugovi po opštinama, poluprečnik ∝ sqrt(m²), potiskivanje preklapanja */
    let budgetNodes = [];
    function budgetPass(kk) {
      if (!budgetRows.length) return;
      const max = Math.max(...budgetRows.map((r) => r.m2 || 0), 1);
      const items = budgetRows.map((r) => { const [x, y] = proj.toW(r.lat, r.lng); const rp = r.m2 > 0 ? 16 + 24 * Math.sqrt(r.m2 / max) : 12; return { r, x: x * kk, y: y * kk, rp }; });
      for (let it = 0; it < 20; it++) for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 0.01; const min = a.rp + b.rp + 6;
        if (d < min) { const push = (min - d) / 2; const ux = dx / d, uy = dy / d; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
      }
      budgetNodes.forEach((n) => n.remove()); budgetNodes = []; budgetLabels.forEach((n) => n.remove()); budgetLabels.length = 0;
      items.forEach((it) => {
        const t = it.r.m2 > 0 ? clamp(it.r.m2 / max, 0, 1) : 0;
        const c = svg('circle', { cx: (it.x / kk).toFixed(2), cy: (it.y / kk).toFixed(2), r: (it.rp / kk).toFixed(3), class: 'mv-bc' + (it.r.m2 > 0 ? '' : ' hollow') + (selected === it.r.key ? ' on' : ''), 'data-key': it.r.key });
        c.style.fillOpacity = (0.14 + t * 0.42).toFixed(2); c.style.strokeWidth = (1.25 / kk).toFixed(3);
        c.addEventListener('click', (e) => { e.stopPropagation(); selected = it.r.key; if (o.onArea) o.onArea(it.r); if (o.onSelect) o.onSelect(it.r.key); needLabels = true; schedule(); });
        c.addEventListener('pointerenter', () => { if (o.onHover) o.onHover(it.r.key); });
        c.addEventListener('pointerleave', () => { if (o.onHover) o.onHover(null); });
        gBudget.appendChild(c); budgetNodes.push(c);
        const lab = el('span', { class: 'mv-blabel' + (it.r.m2 > 0 ? '' : ' hollow') }, el('b', {}, it.r.label), el('span', {}, it.r.m2 > 0 ? `${nf0.format(Math.round(it.r.m2))} m²` : 'malo podataka'));
        lab.style.left = it.x.toFixed(1) + 'px'; lab.style.top = it.y.toFixed(1) + 'px';
        budgetLabels.push(lab);
      });
      needLabels = true;
    }
    /* moja mesta: koncentrični krugovi 10/20/30 min po režimu mesta */
    const SPEED = { auto: 25, gradski: 18, prevoz: 18, pesice: 4.5, peske: 4.5, bicikl: 14 };
    function placesPass(kk) {
      gPlaces.innerHTML = '';
      labels.querySelectorAll('.mv-plabel').forEach((n) => n.remove());
      if (!places.length) return;
      places.forEach((p, i) => {
        if (typeof p.lat !== 'number') return;
        const [x, y] = proj.toW(p.lat, p.lng); const who = p.who === 'partner' ? 'b' : 'a'; const sp = (SPEED[p.mode] || 25) * (p.mode === 'auto' && city.s !== 'beograd' ? 1.12 : 1);
        [30, 20, 10].forEach((min, j) => {
          const km = (min * sp) / 60 / 1.3; const r = km * 1000 * proj.u;
          gPlaces.appendChild(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1), class: `mv-ring mv-${who} r${j}`, style: `stroke-width:${(1 / kk).toFixed(3)}` }));
          if (view.z >= 12.5 && j !== 1) { const lab = el('span', { class: `mv-plabel mv-${who}` }, `${min} min`); lab.style.left = (x * kk).toFixed(1) + 'px'; lab.style.top = ((y - r) * kk + 10).toFixed(1) + 'px'; labels.appendChild(lab); }
        });
        gPlaces.appendChild(svg('rect', { x: (x - 7 / kk).toFixed(2), y: (y - 7 / kk).toFixed(2), width: (14 / kk).toFixed(2), height: (14 / kk).toFixed(2), class: `mv-pmark mv-${who}`, style: `stroke-width:${(1.5 / kk).toFixed(3)}` }));
        const nl = el('span', { class: `mv-plabel mv-pname mv-${who}` }, p.name || `Mesto ${i + 1}`); nl.style.left = (x * kk + 12).toFixed(1) + 'px'; nl.style.top = (y * kk).toFixed(1) + 'px'; labels.appendChild(nl);
      });
    }
    function polyPass(kk) {
      gPoly.innerHTML = '';
      if (!polygon) return;
      gPoly.appendChild(svg('path', { d: polygon.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + 'Z', class: 'mv-zone-path', style: `stroke-width:${(1.5 / kk).toFixed(3)}` }));
    }
    function radiusPass(kk) {
      gRadius.innerHTML = '';
      if (!radius || typeof radius.lat !== 'number') return;
      const [x, y] = proj.toW(radius.lat, radius.lng);
      gRadius.appendChild(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: ((radius.m || 150) * proj.u).toFixed(1), class: 'mv-radius-c', style: `stroke-width:${(1 / kk).toFixed(3)}` }));
    }
    function scalePass(kk) {
      const mPerPx = 1 / (proj.u * kk); const target = 90 * mPerPx; const nice = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000].reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
      scale.firstChild.style.width = (nice / mPerPx).toFixed(0) + 'px'; scale.lastChild.textContent = nice >= 1000 ? nf0.format(nice / 1000) + ' km' : nice + ' m';
    }
    function drawOverlay() {
      overlay.innerHTML = '';
      if (!drawing || !drawPts.length) return;
      const pts = drawPts.map(([x, y]) => toScreen(x, y));
      overlay.appendChild(svg('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + (pts.length > 2 ? 'Z' : ''), class: 'mv-draw-path' }));
      if (!freehand) pts.forEach((p, i) => overlay.appendChild(svg('rect', { x: p[0] - 4, y: p[1] - 4, width: 8, height: 8, class: 'mv-draw-pt' + (i === 0 ? ' first' : '') })));
    }
    /* popover izabranog pina */
    let popNode = null, popSlug = null;
    function popPass() {
      if (!o.popover || mode !== 'pins' || !selected) { if (popNode) { popNode.remove(); popNode = null; popSlug = null; } return; }
      const l = visible.find((x) => x.s === selected); const n = l && pinNodes.get(selected);
      if (!l || !n) { if (popNode) { popNode.remove(); popNode = null; popSlug = null; } return; }
      if (popSlug !== selected) {
        if (popNode) popNode.remove();
        const inner = S(() => UI().pinPopover(l), null) || el('div', { class: 'pin-pop' }, el('b', {}, fullPrice(l)), el('h4', {}, l.ti || l.s), el('a', { class: 'btn btn-secondary btn-sm', href: '#/oglas?s=' + l.s }, 'Detalji'));
        popNode = el('div', { class: 'mv-popwrap' }, inner, el('button', { class: 'iconbtn mv-popclose', type: 'button', 'aria-label': 'Zatvori', onclick: () => api.setSelected(null) }, icon('x', 16)));
        popL.appendChild(popNode); popSlug = selected;
      }
      const [x, y] = lw(l); const [sx, sy] = toScreen(x, y);
      const pw = 280, ph = popNode.offsetHeight || 300;
      let left = clamp(sx - pw / 2, 8, Math.max(8, W - pw - 8)); let top = sy - 44 - ph; let below = false;
      if (top < 8) { top = Math.min(sy + 12, Hh - ph - 8); below = true; }
      popNode.style.left = left.toFixed(0) + 'px'; popNode.style.top = Math.max(8, top).toFixed(0) + 'px'; popNode.classList.toggle('below', below);
    }
    function settle() {
      if (destroyed) return;
      if (o.onViewChange) o.onViewChange(getBounds());
      if (o.showAreaButton && o.interactive && mode === 'pins' && committed) {
        const b = getBounds(); const moved = Math.abs(b.n - committed.n) + Math.abs(b.s - committed.s) + Math.abs(b.e - committed.e) + Math.abs(b.w - committed.w) > 0.0004 || Math.abs(b.zoom - committed.zoom) > 0.2;
        areaBtn.hidden = !moved || drawing;
      }
      live.textContent = `${oglasa(countInView())} u prikazu`;
    }
    const countInView = () => visible.reduce((n, l) => n + (inView(l) ? 1 : 0), 0);
    function commitArea() { committed = getBounds(); areaBtn.hidden = true; if (o.onBoundsChange) o.onBoundsChange(committed); }

    /* ── legenda ── */
    function paintLegend() {
      legend.innerHTML = '';
      if (!o.legend) return;
      if (mode === 'budget') {
        const vals = budgetRows.map((r) => r.m2).filter((v) => v > 0);
        const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 0;
        legend.appendChild(el('div', { class: 'legend mv-legend-b' }, el('span', { class: 'mv-ramp' }, el('i'), el('span', {}, `${nf0.format(Math.round(lo))} m²`), el('span', {}, `${nf0.format(Math.round(hi))} m²`)), el('span', {}, el('i', { class: 'hollow' }), 'malo podataka')));
      } else {
        const lg = S(() => UI().mapLegend(), null) || el('div', { class: 'legend' }, el('span', {}, el('i'), 'Cena oglasa'), el('span', {}, el('i', { class: 'on' }), 'Izabran'), el('span', {}, el('i', { class: 'seen' }), 'Već pogledan'), el('span', {}, el('i', { class: 'new' }), 'Novogradnja'));
        if (places.length) { lg.appendChild(el('span', {}, el('i', { class: 'mv-la' }), 'Ja')); if (places.some((p) => p.who === 'partner')) lg.appendChild(el('span', {}, el('i', { class: 'mv-lb' }), 'Partner')); lg.appendChild(el('span', { class: 'mv-lnote' }, 'krugovi 10/20/30 min, procena')); }
        legend.appendChild(lg);
      }
    }

    /* ── interakcija ── */
    const ptrs = new Map(); let drag = null, pinchD = 0, pinchZ = 0, vel = { x: 0, y: 0, t: 0 }, inertiaRaf = 0;
    function zoomAt(z, sx, sy) {
      const nz = clamp(z, ZMIN, ZMAX); if (nz === view.z) return;
      const [wx, wy] = fromScreen(sx, sy); const nk = Math.pow(2, nz - ZB);
      view.z = nz; view.cx = wx - (sx - W / 2) / nk; view.cy = wy - (sy - Hh / 2) / nk; schedule();
    }
    function zoomBy(dz, sx = W / 2, sy = Hh / 2) {
      const target = clamp(Math.round(view.z + dz), ZMIN, ZMAX);
      if (reduced()) { zoomAt(target, sx, sy); return; }
      const z0 = view.z, t0 = performance.now(), dur = 180;
      const step = (now) => { const t = clamp((now - t0) / dur, 0, 1); const e = 1 - Math.pow(1 - t, 3); zoomAt(z0 + (target - z0) * e, sx, sy); if (t < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
    function onWheel(e) {
      if (!o.interactive) return; e.preventDefault();
      const r = container.getBoundingClientRect(); const d = clamp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022), -0.6, 0.6);
      zoomAt(view.z + d, e.clientX - r.left, e.clientY - r.top);
    }
    function onDown(e) {
      if (!o.interactive) return;
      if (e.target.closest('.mv-chrome') || e.target.closest('.mv-pop')) return;
      if (e.button != null && e.button !== 0) return;
      container.setPointerCapture(e.pointerId);
      const r = container.getBoundingClientRect(); ptrs.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
      cancelAnimationFrame(inertiaRaf);
      if (ptrs.size === 1) { drag = { x0: e.clientX, y0: e.clientY, cx: view.cx, cy: view.cy, moved: false, target: e.target, t: performance.now(), lx: e.clientX, ly: e.clientY, type: e.pointerType }; vel = { x: 0, y: 0, t: performance.now() }; }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); pinchZ = view.z; drag = null; }
      if (drawing && ptrs.size === 1) { const [wx, wy] = fromScreen(e.clientX - r.left, e.clientY - r.top); drag.draw = [wx, wy]; }
    }
    function onMove(e) {
      if (!ptrs.has(e.pointerId)) return;
      const r = container.getBoundingClientRect(); const p = { x: e.clientX - r.left, y: e.clientY - r.top }; ptrs.set(e.pointerId, p);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (!pinchD) { pinchD = d; return; }
        zoomAt(pinchZ + Math.log2(d / pinchD), (a.x + b.x) / 2, (a.y + b.y) / 2); return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (drawing && drag.draw) {
        /* slobodna ruka: tačke na svakih 8 px */
        if (!freehand) { freehand = true; drawPts = [drag.draw]; }
        const last = toScreen(...drawPts[drawPts.length - 1]); if (Math.hypot(p.x - last[0], p.y - last[1]) >= 8) { drawPts.push(fromScreen(p.x, p.y)); schedule(); }
        drag.moved = true; return;
      }
      drag.moved = true; container.classList.add('mv-dragging');
      const kk = k(); view.cx = drag.cx - dx / kk; view.cy = drag.cy - dy / kk;
      const now = performance.now(); const dt = Math.max(1, now - vel.t); vel = { x: (e.clientX - drag.lx) / dt, y: (e.clientY - drag.ly) / dt, t: now }; drag.lx = e.clientX; drag.ly = e.clientY;
      areaBtn.hidden = true; schedule();
    }
    function onUp(e) {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId); S(() => container.releasePointerCapture(e.pointerId));
      if (ptrs.size === 1) { pinchD = 0; return; }
      if (ptrs.size) return;
      container.classList.remove('mv-dragging');
      const d = drag; drag = null; if (!d) return;
      if (drawing) {
        if (freehand) { if (drawPts.length >= 8) finishDraw(); else { drawPts = []; freehand = false; schedule(); } }
        else if (!d.moved) { const r = container.getBoundingClientRect(); addDrawPoint(fromScreen(e.clientX - r.left, e.clientY - r.top)); }
        return;
      }
      if (d.moved) {
        /* inercija */
        const sp = Math.hypot(vel.x, vel.y); if (sp > 0.25 && !reduced() && performance.now() - vel.t < 60) {
          let vx = vel.x, vy = vel.y; const stepI = () => { const kk = k(); view.cx -= (vx * 16) / kk; view.cy -= (vy * 16) / kk; vx *= 0.9; vy *= 0.9; schedule(); if (Math.hypot(vx, vy) > 0.03) inertiaRaf = requestAnimationFrame(stepI); };
          inertiaRaf = requestAnimationFrame(stepI);
        }
        return;
      }
      /* klik bez pomeranja */
      const pinN = d.target.closest && d.target.closest('.pin');
      if (pinN) { activatePin(pinN); return; }
      if (selected && mode === 'pins' && !d.target.closest('.mv-pop')) api.setSelected(null);
    }
    function activatePin(n) {
      if (n.dataset.cluster) { const mem = n._mem || []; if (mem.length) fitList(mem, Math.min(ZMAX, Math.floor(view.z) + 2)); return; }
      const s = n.dataset.slug; if (!s) return;
      selected = s; refreshStates(); popPass(); if (o.onSelect) o.onSelect(s);
    }
    function onKey(e) {
      if (!o.interactive) return; if (e.target !== container && e.target.closest('input,select,textarea')) return;
      const step = 60; let h = true;
      switch (e.key) {
        case 'ArrowLeft': view.cx -= step / k(); break; case 'ArrowRight': view.cx += step / k(); break;
        case 'ArrowUp': view.cy -= step / k(); break; case 'ArrowDown': view.cy += step / k(); break;
        case '+': case '=': zoomBy(1); break; case '-': case '_': zoomBy(-1); break;
        case 'Escape': if (drawing) cancelDraw(); else if (selected) api.setSelected(null); else h = false; break;
        case 'Enter': if (drawing) finishDraw(); else h = false; break;
        default: h = false;
      }
      if (h) { e.preventDefault(); schedule(); }
    }
    function onDbl(e) {
      if (!o.interactive || e.target.closest('.mv-chrome')) return; e.preventDefault();
      if (drawing) { finishDraw(); return; }
      const r = container.getBoundingClientRect(); zoomBy(1, e.clientX - r.left, e.clientY - r.top);
    }
    function onOver(e) { if (e.pointerType && e.pointerType !== 'mouse') return; const n = e.target.closest && e.target.closest('.pin'); const s = n && n.dataset.slug; if (s && s !== hovered) { hovered = s; refreshStates(); if (o.onHover) o.onHover(s); } }
    function onOut(e) { const n = e.target.closest && e.target.closest('.pin'); if (n && n.dataset.slug && hovered === n.dataset.slug) { hovered = null; refreshStates(); if (o.onHover) o.onHover(null); } }
    function onClick(e) { if (e.detail === 0) { const n = e.target.closest && e.target.closest('.pin'); if (n) activatePin(n); } }
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onUp);
    container.addEventListener('keydown', onKey);
    container.addEventListener('dblclick', onDbl);
    pinsL.addEventListener('pointerover', onOver);
    pinsL.addEventListener('pointerout', onOut);
    pinsL.addEventListener('click', onClick);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { needPins = true; schedule(); }) : null;
    if (ro) ro.observe(container);

    /* ── crtanje zone ── */
    function startDraw() {
      if (!o.interactive) return;
      drawing = true; freehand = false; drawPts = []; container.classList.add('mv-drawing'); drawBtn.setAttribute('aria-pressed', 'true'); drawBar.hidden = false; areaBtn.hidden = true;
      api.setSelected(null); schedule();
    }
    function addDrawPoint(p) {
      if (drawPts.length >= 3) { const f = toScreen(...drawPts[0]); const s = toScreen(...p); if (Math.hypot(f[0] - s[0], f[1] - s[1]) < 12) { finishDraw(); return; } }
      drawPts.push(p); schedule();
    }
    function simplify(pts, tol) {
      if (pts.length < 3) return pts;
      const sq = tol * tol; const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
      const rec = (a, b) => { let m = 0, idx = -1; for (let i = a + 1; i < b; i++) { const d = segDist(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]); if (d > m) { m = d; idx = i; } } if (m * m > sq && idx > 0) { keep[idx] = true; rec(a, idx); rec(idx, b); } };
      rec(0, pts.length - 1);
      const out = pts.filter((_, i) => keep[i]); return out.length > 40 ? out.filter((_, i) => i % Math.ceil(out.length / 40) === 0) : out;
    }
    function finishDraw() {
      if (!drawing) return;
      const pts = simplify(drawPts, 3 / k());
      drawing = false; freehand = false; container.classList.remove('mv-drawing'); drawBtn.setAttribute('aria-pressed', 'false'); drawBar.hidden = true; drawPts = [];
      if (pts.length < 3) { polygon = null; applyPolygon(); return; }
      polygon = pts; applyPolygon();
    }
    function cancelDraw() { drawing = false; freehand = false; drawPts = []; container.classList.remove('mv-drawing'); drawBtn.setAttribute('aria-pressed', 'false'); drawBar.hidden = true; schedule(); }
    function applyPolygon() {
      visible = polygon ? all.filter((l) => { const [x, y] = lw(l); return inPoly(x, y, polygon); }) : all;
      clusterCache = null; needPins = true;
      zoneChip.innerHTML = '';
      if (polygon) {
        zoneChip.hidden = false;
        zoneChip.append(icon('pen', 14), el('span', {}, `Nacrtana zona · ${oglasa(visible.length)}`), el('button', { type: 'button', 'aria-label': 'Obriši zonu', onclick: () => { polygon = null; applyPolygon(); } }, icon('x', 14)));
        drawBtn.hidden = true;
      } else { zoneChip.hidden = true; drawBtn.hidden = false; }
      if (o.onBoundsChange) o.onBoundsChange({ ...getBounds(), count: visible.length });
      schedule();
    }

    /* ── prilagođavanje prikaza ── */
    function fitList(list, zmax = ZMAX, pad = 48) {
      const pts = (list || []).map((l) => lw(l)); if (!pts.length) { view = { cx: 0, cy: 0, z: 13 }; const [x, y] = proj.toW(city.lat, city.lng); view.cx = x; view.cy = y; schedule(); return; }
      W = container.clientWidth || W; Hh = container.clientHeight || Hh;
      /* bez ekstremnih tačaka: 6–94 percentil po osi kad ima dosta tačaka */
      const xs = pts.map((p) => p[0]).sort((a, b) => a - b), ys = pts.map((p) => p[1]).sort((a, b) => a - b);
      const q = (arr, f) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * f)))];
      const trim = pts.length >= 24 ? 0.06 : 0;
      const x1 = q(xs, trim), x2 = q(xs, 1 - trim), y1 = q(ys, trim), y2 = q(ys, 1 - trim);
      const dw = Math.max(x2 - x1, 1), dh = Math.max(y2 - y1, 1);
      const z = clamp(Math.floor(Math.log2(Math.min((W - pad * 2) / dw, (Hh - pad * 2) / dh)) * 4) / 4 + ZB, ZMIN, zmax);
      view = { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, z: pts.length === 1 ? Math.min(zmax, 15) : z };
      committed = null; schedule(); committed = null;
      setTimeout(() => { committed = getBounds(); }, 0);
    }
    function panTo(lat, lng, z) { const [x, y] = proj.toW(lat, lng); view.cx = x; view.cy = y; if (z != null) view.z = clamp(z, ZMIN, ZMAX); schedule(); }

    /* ── javni API ── */
    const api = {
      el: container,
      setListings(list) {
        all = (list || []).filter((l) => l && typeof l.lat === 'number'); labelData = null; clusterCache = null;
        const nc = cityOf(); if (nc.s !== city.s) { city = nc; proj = makeProj(city.lat, city.lng); gCities.innerHTML = ''; }
        polygon = null; visible = all; zoneChip.hidden = true; drawBtn.hidden = false; needPins = true; schedule();
      },
      setSelected(slug) { selected = slug || null; refreshStates(); popPass(); if (slug && mode === 'pins') { const l = visible.find((x) => x.s === slug); if (l && !inView(l, -40)) { const [x, y] = lw(l); view.cx = x; view.cy = y; schedule(); } } else if (slug && mode === 'budget') { needLabels = true; schedule(); } },
      highlight(slug) { hovered = slug || null; refreshStates(); },
      fit(list) { fitList(list || visible, 15); },
      fitTo(list, zmax) { fitList(list, zmax == null ? ZMAX : zmax); },
      panTo, setZoom(z) { zoomAt(z, W / 2, Hh / 2); }, getZoom: () => view.z, getView: () => ({ ...latLngOfW(view.cx, view.cy), zoom: view.z }),
      setView(v) { if (v && typeof v.lat === 'number') panTo(v.lat, v.lng, v.zoom); },
      setMode(m) { mode = m === 'budget' ? 'budget' : 'pins'; container.dataset.mode = mode; pinsL.hidden = mode === 'budget'; areaBtn.hidden = true; drawBtn.hidden = mode === 'budget' || !!polygon; if (mode === 'pins') { gBudget.innerHTML = ''; budgetLabels.forEach((n) => n.remove()); budgetLabels.length = 0; } needLabels = true; needPins = true; paintLegend(); schedule(); },
      setBudget(rows) { budgetRows = (rows || []).filter((r) => typeof r.lat === 'number'); gBudget.innerHTML = ''; paintLegend(); if (mode === 'budget' && budgetRows.length) { const pts = budgetRows.map((r) => ({ lat: r.lat, lng: r.lng })); fitList(pts, 13); } schedule(); },
      setPlaces(p) { places = p || []; paintLegend(); schedule(); },
      setRadius(r) { radius = r; schedule(); },
      getBounds, getVisible: () => visible.filter((l) => inView(l)), getFiltered: () => visible, getPolygon: () => (polygon ? polygon.map(([x, y]) => latLngOfW(x, y)) : null),
      startDraw, finishDraw, cancelDraw, clearZone() { polygon = null; applyPolygon(); },
      setPolygon(latlngs) { polygon = latlngs && latlngs.length >= 3 ? latlngs.map((p) => proj.toW(p.lat, p.lng)) : null; applyPolygon(); },
      refresh() { needPins = true; needLabels = true; clusterCache = null; schedule(); },
      destroy() {
        destroyed = true; cancelAnimationFrame(raf); cancelAnimationFrame(inertiaRaf); clearTimeout(settleT); if (ro) ro.disconnect();
        container.removeEventListener('wheel', onWheel); container.removeEventListener('pointerdown', onDown); container.removeEventListener('pointermove', onMove); container.removeEventListener('pointerup', onUp); container.removeEventListener('pointercancel', onUp); container.removeEventListener('keydown', onKey); container.removeEventListener('dblclick', onDbl);
        container.innerHTML = ''; container.classList.remove('mv', 'mv-drawing');
      },
    };
    container.dataset.mode = mode; pinsL.hidden = mode === 'budget';
    paintLegend();
    fitList(all, 15);
    if (o.view && typeof o.view.lat === 'number') panTo(o.view.lat, o.view.lng, o.view.zoom);
    if (mode === 'budget' && o.budget) api.setBudget(o.budget);
    return api;
  }
  mapView.shortPrice = shortPrice;
  mapView.inPolygon = (lat, lng, poly) => inPoly(lng, lat, poly.map((p) => [p.lng, p.lat]));
  return mapView;
})();
window.mapView = mapView;
