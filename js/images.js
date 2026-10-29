/* Kvadrat.rs — images.js: proceduralne SVG „fotografije" (spec §7).
   Globali: img { src, el, kinds, hero, city, article, mark, palette, scene, uri }, KV_CONFIG.
   Sve je determinističko: paleta po hash(slug), scena po hash(slug + '#' + idx). Bez eksternih resursa. */
'use strict';

window.KV_CONFIG = Object.assign({ externalPhotos: false }, window.KV_CONFIG || {});

const img = (() => {
  /* ─── hash / rng (iz core.js; lokalna kopija ako core nije učitan) ─── */
  const H32 = typeof hash === 'function' ? hash : (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const RNG = typeof rng === 'function' ? rng : (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* ─── konstante ─── */
  const W = 800, H = 600, HZ = 456;            // master 4:3, horizont na 76 %
  const MIN_TOP = 70;                           // krovna linija glavne zgrade nikad iznad y=70 (≥ 12 % neba; hero prosleđuje negativan S.minTop)
  const PINE = '#1F6B52', MINT = '#8ED0B0', PAPER = '#F4F1EC', INK = '#15181A';
  const PAL = {
    A: { id: 'A', name: 'zlatni sat', sky: ['#B9C2CC', '#E9DCCB'], haze: '#E6DCCF', wall: ['#D8CFC0', '#CBB9A4', '#B8A590', '#D9C9B2'], roof: '#3E3A36', glass: '#2E3A44', lit: '#F0C98A', ground: '#A8A196', tree: '#4F6150', vig: '#2A2622' },
    B: { id: 'B', name: 'kasno leto', sky: ['#AFBAC6', '#E3D5C4'], haze: '#DDD4C7', wall: ['#C9C2B4', '#B9AE9C', '#A89A86', '#D3C3AD'], roof: '#35322F', glass: '#28333C', lit: '#EBC585', ground: '#9E9A90', tree: '#46584A', vig: '#221F1C' },
    C: { id: 'C', name: 'svetla jesen', sky: ['#C3C9D1', '#F0E3D2'], haze: '#ECE3D7', wall: ['#E2D9CB', '#CDBFAA', '#BBAE9B', '#D6C8B4'], roof: '#46423E', glass: '#33404A', lit: '#F3D095', ground: '#B2ACA1', tree: '#5A6B52', vig: '#2E2A27' },
  };
  const VB = { '4:3': [0, 0, 800, 600, 800, 600], '16:10': [0, 30, 800, 500, 800, 500], '1:1': [100, 0, 600, 600, 600, 600] };
  const KIND_ALT = { facade: 'Fasada zgrade', house: 'Kuća spolja', living: 'Dnevna soba', kitchen: 'Kuhinja', bedroom: 'Spavaća soba', bath: 'Kupatilo', balcony: 'Pogled sa terase', entrance: 'Ulaz u zgradu', land: 'Plac', backyard: 'Dvorište', garage: 'Garaža', office: 'Poslovna zgrada', 'office-interior': 'Kancelarija' };
  const SETS = {
    stan: ['facade', 'living', 'kitchen', 'bedroom', 'bath', 'balcony', 'entrance', 'facade', 'living'],
    kuca: ['house', 'living', 'kitchen', 'bedroom', 'backyard', 'entrance', 'bath', 'house', 'land'],
    vikendica: ['house', 'living', 'kitchen', 'bedroom', 'backyard', 'land', 'bath', 'house', 'living'],
    'poslovni-prostor': ['office', 'office-interior', 'entrance', 'office-interior', 'bath', 'office', 'kitchen', 'office-interior', 'balcony'],
    zemljiste: ['land', 'land', 'land', 'land', 'land', 'land', 'land', 'land', 'land'],   // varijanta po idx % 3: njiva+put / livada / voćnjak
    garaza: ['garage', 'garage', 'facade', 'garage', 'entrance', 'facade', 'garage', 'garage', 'facade'],
    soba: ['bedroom', 'living', 'facade', 'kitchen', 'bath', 'entrance', 'bedroom', 'balcony', 'living'],
  };

  /* ─── pomoćne ─── */
  const N = (v) => Math.round(v);
  const F = (v) => (Math.round(v * 100) / 100).toString().replace(/^0\./, '.');
  const mix = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = (i) => Math.round(((pa >> i) & 255) * (1 - t) + ((pb >> i) & 255) * t); return '#' + [16, 8, 0].map((i) => c(i).toString(16).padStart(2, '0')).join(''); };
  const op = (v) => (v >= 1 ? '' : ` opacity='${F(v)}'`);
  const RP = (x, y, w, h) => `M${N(x)} ${N(y)}h${N(w)}v${N(h)}h${-N(w)}z`;
  const ENC = (s) => s.replace(/[%#<>"\u0080-￿]/g, (c) => encodeURIComponent(c));
  const uri = (svg) => 'data:image/svg+xml;utf8,' + ENC(svg);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&apos;');

  function mk(P) {
    const d = [], b = [];
    const S = {
      P, d, b, top: 0,
      def: (s) => d.push(s),
      add: (s) => b.push(s),
      rect: (x, y, w, h, f, ex = '') => b.push(`<rect x='${N(x)}' y='${N(y)}' width='${N(w)}' height='${N(h)}' fill='${f}'${ex}/>`),
      path: (dd, f, ex = '') => b.push(`<path d='${dd}' fill='${f}'${ex}/>`),
      poly: (pts, f, ex = '') => b.push(`<path d='M${pts.map((p) => N(p[0]) + ' ' + N(p[1])).join('L')}z' fill='${f}'${ex}/>`),
      circle: (cx, cy, r, f, ex = '') => b.push(`<circle cx='${N(cx)}' cy='${N(cy)}' r='${N(r)}' fill='${f}'${ex}/>`),
      ell: (cx, cy, rx, ry, f, ex = '') => b.push(`<ellipse cx='${N(cx)}' cy='${N(cy)}' rx='${N(rx)}' ry='${N(ry)}' fill='${f}'${ex}/>`),
      line: (x1, y1, x2, y2, st, w, ex = '') => b.push(`<path d='M${N(x1)} ${N(y1)}L${N(x2)} ${N(y2)}' stroke='${st}' stroke-width='${w}'${ex}/>`),
      lines: (dd, st, w, ex = '') => b.push(`<path d='${dd}' stroke='${st}' stroke-width='${w}' fill='none'${ex}/>`),
      text: (x, y, s, ex = '') => b.push(`<text x='${N(x)}' y='${N(y)}'${ex}>${esc(s)}</text>`),
      lin: (id, c1, c2, o1 = 1, o2 = 1, vert = true) => d.push(`<linearGradient id='${id}' x1='0' y1='0' x2='${vert ? 0 : 1}' y2='${vert ? 1 : 0}'><stop offset='0' stop-color='${c1}' stop-opacity='${o1}'/><stop offset='1' stop-color='${c2}' stop-opacity='${o2}'/></linearGradient>`),
      rad: (id, c, o1, o2 = 0, r = '.5') => d.push(`<radialGradient id='${id}' r='${r}'><stop offset='0' stop-color='${c}' stop-opacity='${o1}'/><stop offset='1' stop-color='${c}' stop-opacity='${o2}'/></radialGradient>`),
      glow: (cx, cy, r, c, o) => { const id = 'q' + b.length; S.rad(id, c, o); S.circle(cx, cy, r, `url(#${id})`); },
      out: (vb, label, w, h) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}' width='${w}' height='${h}' preserveAspectRatio='xMidYMid slice' role='img' aria-label='${esc(label)}'><defs>${d.join('')}</defs>${b.join('')}</svg>`,
    };
    return S;
  }
  const R = (r) => ({ f: (a, b) => a + r() * (b - a), i: (a, b) => Math.floor(a + r() * (b - a + 1)), p: (arr) => arr[Math.floor(r() * arr.length)], b: (p) => r() < p, r });

  /* finiš: vinjeta + zrno filma (svaka slika) */
  function finish(S, vig = .35, grain = .5) {
    const P = S.P;
    S.def(`<radialGradient id='v' r='.72'><stop offset='.55' stop-color='${P.vig}' stop-opacity='0'/><stop offset='1' stop-color='${P.vig}' stop-opacity='${F(vig)}'/></radialGradient>`);
    S.def(`<filter id='g' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='.3 .3 .3 0 .25 .3 .3 .3 0 .25 .3 .3 .3 0 .25 0 0 0 0 .18'/></filter>`);
    S.rect(-10, S.top - 10, W + 20, H - S.top + 20, 'url(#v)');
    S.rect(0, S.top, W, H - S.top, '#000', ` filter='url(#g)'${op(grain)}`);
  }

  /* ─── eksterijer: nebo, sunce, izmaglica, tlo ─── */
  function skyAndSun(S, q, hz = HZ, sunOp = .5, sunX = null) {
    const P = S.P;
    S.lin('s', P.sky[0], P.sky[1]);
    S.rect(0, S.top, W, hz - S.top, 'url(#s)');
    S.glow(sunX == null ? q.f(600, 760) : sunX, hz - 24, 300, P.lit, sunOp);
  }
  function farRow(S, q, hz = HZ, minH = 50, maxH = 180, tint = .9) {
    const P = S.P; let x = -20, dd = '';
    while (x < W + 20) { const w = q.i(36, 120), h = q.i(minH, maxH); dd += RP(x, hz - h, w, h); x += w + q.i(0, 8); }
    S.path(dd, P.haze, op(tint));
    // izmaglica pri horizontu
    S.lin('hz', P.haze, P.haze, 0, .55);
    S.rect(0, hz - 220, W, 220, 'url(#hz)');
  }
  function street(S, q, hz = HZ) {
    const P = S.P;
    S.rect(0, hz, W, H - hz, mix(P.ground, P.vig, .16));           // asfalt
    S.rect(0, hz, W, 30, mix(P.ground, '#ffffff', .16));             // trotoar
    S.rect(0, hz + 29, W, 3, P.roof, op(.3));                        // ivičnjak
    let dd = ''; for (let x = -40 + q.i(0, 60); x < W; x += 110) dd += RP(x, hz + 96, 50, 3);
    S.path(dd, PAPER, op(.14));
  }
  function tree(S, q, x, base, s, shade = 0) {
    const P = S.P; const c = shade ? mix(P.tree, P.vig, .25) : P.tree;
    S.ell(x + 10 * s, base + 8, 44 * s, 8, P.vig, op(.1));
    S.rect(x - 3 * s, base - 70 * s, 6 * s, 70 * s, mix(P.roof, P.vig, .3), op(.85));
    S.ell(x, base - 96 * s, 38 * s, 46 * s, c, op(.9));
    S.ell(x - 18 * s, base - 76 * s, 26 * s, 28 * s, mix(c, P.vig, .18), op(.9));
    S.ell(x + 16 * s, base - 112 * s, 24 * s, 26 * s, mix(c, P.lit, .14), op(.88));
  }
  function lamp(S, x, base, h = 130) {
    const P = S.P;
    S.glow(x, base - h, 70, P.lit, .4);
    S.rect(x - 2, base - h, 4, h, P.roof, op(.85));
    S.rect(x - 9, base - h - 5, 18, 7, P.roof, op(.85));
    S.circle(x, base - h + 6, 4, P.lit);
  }
  function car(S, q, x, y, c) {
    const P = S.P;
    S.rect(x, y - 16, 72, 18, c, ` rx='4'${op(.92)}`);
    S.rect(x + 14, y - 28, 40, 14, mix(c, P.glass, .5), ` rx='5'`);
    S.circle(x + 16, y + 2, 6, P.vig); S.circle(x + 56, y + 2, 6, P.vig);
    S.ell(x + 36, y + 6, 44, 5, P.vig, op(.18));
  }
  function shadowLeft(S, x, w, base, k = 1) { S.poly([[x, base], [x - 70 * k, base + 46 * k], [x + w * .5 - 70 * k, base + 46 * k], [x + w * .5, base]], S.P.vig, op(.1)); }

  /* prozori: skupljanje u putanje po stanju */
  function winBatch() { return { g: ['', '', '', ''], lit: '', sill: '', blind: '', rev: '', list: [] }; }
  function flushWins(S, B) {
    const P = S.P; const ops = [.6, .72, .84, .95];
    B.g.forEach((d, i) => { if (d) S.path(d, P.glass, op(ops[i])); });
    if (B.lit) S.path(B.lit, P.lit);
    if (B.rev) S.path(B.rev, P.vig, op(.28));
    if (B.blind) S.path(B.blind, mix(P.wall[0], P.haze, .4), op(.5));
    if (B.sill) S.path(B.sill, P.roof, op(.45));
  }
  function brandWin(S, w, big = false) {
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2, r = big ? 44 : 26;
    S.glow(cx, cy, r, MINT, big ? .2 : .14);
    S.rect(w.x, w.y, w.w, w.h, PINE, op(.95));
    S.add(`<rect x='${F(w.x + 1)}' y='${F(w.y + 1)}' width='${F(w.w - 2)}' height='${F(w.h - 2)}' fill='none' stroke='${MINT}' stroke-width='1.5'/>`);
  }
  // okvir + sims + pregrada za pojedinačne prozore (garaža): da brend pravougaonik čita kao prozor, ne kao tabla
  function winFrame(S, x, y, w, h) { S.rect(x - 4, y - 4, w + 8, h + 8, mix(PAPER, S.P.wall[0], .3), op(.9)); S.rect(x - 4, y - 4, w + 8, 3, S.P.vig, op(.18)); }
  function winBars(S, x, y, w, h) { S.rect(x + w / 2 - 1, y, 2, h, S.P.roof, op(.45)); S.rect(x - 8, y + h + 4, w + 16, 5, S.P.roof, op(.45)); }
  // bira brend prozor: nije u gornjem redu, nije upaljen i nema upaljenog suseda
  function pickBrand(q, list, maxY = Infinity) {
    if (list.some((w) => w.y + w.h < maxY)) list = list.filter((w) => w.y + w.h < maxY);
    const ok = (w) => w.row > 0 && !w.lit && !list.some((o) => o !== w && o.b === w.b && ((o.row === w.row && Math.abs(o.col - w.col) === 1) || (o.col === w.col && Math.abs(o.row - w.row) === 1)) && o.lit);
    let c = list.filter(ok);
    if (!c.length) c = list.filter((w) => w.row > 0 && !w.lit);
    if (!c.length) c = list.filter((w) => w.row > 0);
    if (!c.length) c = list;
    if (!c.length) return null;
    const w = q.p(c); w.lit = false; return w;
  }

  /* ─── FASADA (blok / stara gradnja / novogradnja) ─── */
  function building(S, q, B, bx, bw, sub, floors, bi, isMain, litRate) {
    const P = S.P;
    const fh = sub === 'stara' ? 60 : sub === 'blok' ? 34 : 44;
    const gf = sub === 'stara' ? 60 : 56;
    // krovna linija ne ide iznad minTop: ostaje ≥ 12 % neba i u 16:10 / 1:1 isečku (hero zadaje negativan S.minTop)
    const minTop = S.minTop == null ? MIN_TOP : S.minTop;
    floors = Math.max(2, Math.min(floors, Math.floor((HZ - minTop - gf - 12) / fh)));
    const h = floors * fh + gf + 12, top = HZ - h;
    const wall = sub === 'stara' ? q.p([P.wall[3], P.wall[0], P.wall[1]]) : sub === 'blok' ? q.p([P.wall[1], P.wall[2], P.wall[0]]) : q.p([P.wall[0], P.wall[1], P.wall[3]]);
    S.rect(bx, top, bw, h, wall);
    if (sub === 'stara') { // rustika prizemlja + venci
      S.rect(bx, HZ - gf, bw, gf, mix(wall, P.vig, .12));
      let dd = ''; for (let y = HZ - gf + 14; y < HZ; y += 14) dd += RP(bx, y, bw, 1);
      S.path(dd, P.roof, op(.18));
      dd = ''; for (let f = 1; f < floors; f++) dd += RP(bx, top + 12 + f * fh - 3, bw, 3);
      S.path(dd, P.roof, op(.28));
      S.rect(bx, top + 12 + 4, bw, 2, P.roof, op(.3));
      S.rect(bx, top, bw, 12, P.roof, op(.85));
      S.rect(bx - 4, top + 10, bw + 8, 6, mix(wall, P.vig, .25));
    } else if (sub === 'blok') {
      S.rect(bx, top, bw, 8, P.roof, op(.85));
      S.rect(bx, HZ - gf, bw, gf, mix(wall, P.vig, .1));
    } else {
      S.rect(bx, top, bw, 6, P.roof, op(.85));
      S.rect(bx, top + 6, bw, 10, mix(wall, '#ffffff', .18));          // parapet
      S.rect(bx, HZ - gf, bw, gf, mix(P.glass, wall, .35));            // staklena baza
      S.rect(bx, HZ - gf, bw, 8, P.roof, op(.5));
    }
    // senka sa leve strane (svetlo s desna)
    S.rect(bx, top, bw * .12, h, P.vig, op(.12));
    // prozori
    const cellw = sub === 'stara' ? 60 : sub === 'blok' ? 34 : 48;
    const cols = Math.max(2, Math.floor((bw - 20) / cellw));
    const mg = (bw - cols * cellw) / 2;
    const ww = cellw * (sub === 'nova' ? .72 : sub === 'stara' ? .46 : .56), wh = fh * (sub === 'stara' ? .62 : sub === 'nova' ? .6 : .52);
    const balc = sub === 'nova' ? q.i(0, 2) : -1;  // koji stubac ima balkone
    let loggia = '', slab = '', rail = '';
    // osnovna mreža prozora kao <pattern> (staklo + špaletna senka + nadprozornik), ostalo pojedinačno
    const gx0 = bx + mg, gy0 = top + 12, ox = (cellw - ww) / 2, oy = fh * .22, pid = 'p' + bi;
    S.def(`<pattern id='${pid}' x='${N(gx0)}' y='${N(gy0)}' width='${cellw}' height='${fh}' patternUnits='userSpaceOnUse'><rect x='${N(ox)}' y='${N(oy)}' width='${N(ww)}' height='${N(wh)}' fill='${P.glass}' opacity='.82'/><rect x='${N(ox)}' y='${N(oy)}' width='${N(ww)}' height='3' fill='${P.vig}' opacity='.3'/><rect x='${N(ox)}' y='${N(oy)}' width='2' height='${N(wh)}' fill='${P.vig}' opacity='.2'/>${sub === 'stara' ? `<rect x='${N(ox - 3)}' y='${N(oy - 5)}' width='${N(ww + 6)}' height='4' fill='${P.roof}' opacity='.3'/>` : ''}</pattern>`);
    if (sub === 'blok') for (let c = 1; c < cols; c += 3) loggia += RP(gx0 + c * cellw + 2, gy0, cellw - 4, floors * fh);
    if (loggia) S.path(loggia, P.vig, op(.26));
    S.rect(gx0, gy0, cols * cellw, floors * fh, `url(#${pid})`);
    for (let c = 0; c < cols; c++) {
      const cx = bx + mg + c * cellw;
      const isLog = sub === 'blok' && c % 3 === 1;
      for (let f = 0; f < floors; f++) {
        const y = top + 12 + f * fh;
        const wx = cx + (cellw - ww) / 2, wy = y + fh * .22;
        const lit = q.b(litRate);
        const w = { x: wx, y: wy, w: ww, h: wh, row: f, col: c, b: bi, lit, main: isMain };
        B.list.push(w);
        if (sub === 'nova' && (c % 3 === balc)) { // balkon: ploča + ograda
          slab += RP(cx - 2, y + fh - 6, cellw + 4, 4);
          rail += RP(cx + 1, y + fh - 22, cellw - 2, 1) + RP(cx + 1, y + fh - 22, 1, 16) + RP(cx + cellw - 2, y + fh - 22, 1, 16);
        }
        if (sub === 'blok' && isLog) slab += RP(cx + 2, y + fh - 5, cellw - 4, 4);
        if (sub === 'stara') { if (q.b(.5)) B.sill += RP(wx - 4, wy + wh, ww + 8, 5); }
        else if (q.b(.22)) B.sill += RP(wx - 3, wy + wh, ww + 6, 4);
      }
    }
    if (slab) S.path(slab, P.roof, op(.5));
    if (rail) S.path(rail, P.roof, op(.5));
    // prizemlje: izlozi / ulaz
    if (sub !== 'blok') {
      const n = Math.max(1, Math.floor(bw / 120));
      for (let i = 0; i < n; i++) {
        const sx = bx + 16 + i * ((bw - 32) / n), sw = (bw - 32) / n - 14;
        if (isMain && i === Math.floor(n / 2)) continue;
        S.rect(sx, HZ - gf + 14, sw, gf - 22, q.b(.5) ? P.lit : P.glass, op(q.b(.5) ? .9 : .75));
      }
    }
    if (isMain) {
      const ex = bx + bw / 2 - 24, dh = gf - 14;
      S.rect(ex - 10, HZ - dh - 12, 68, 6, P.roof, op(.6));   // nadstrešnica
      S.rect(ex, HZ - dh - 6, 48, 6, P.lit);                  // svetlo iznad vrata
      S.rect(ex, HZ - dh, 48, dh, P.roof);                    // vrata
      S.rect(ex + 23, HZ - dh, 2, dh, mix(P.roof, '#ffffff', .25));
      S.rect(ex + 56, HZ - dh + 8, 12, 12, PAPER, op(.9));    // broj
    }
    return { x: bx, w: bw, top, h, wall };
  }

  function facade(S, q, ctx, opts = {}) {
    const P = S.P;
    skyAndSun(S, q, HZ, opts.sunOp || .5, opts.sunX);
    farRow(S, q);
    street(S, q);
    // raspored zgrada
    const nB = q.i(2, 3);
    const subs = [];
    for (let i = 0; i < nB; i++) subs.push(i === 0 ? ctx.sub : q.p(['blok', 'nova', 'stara', ctx.sub]));
    const widths = subs.map((s) => s === 'blok' ? q.i(260, 330) : s === 'stara' ? q.i(170, 260) : q.i(180, 300));
    const gaps = subs.map(() => q.i(0, 18));
    const total = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
    let x = (W - total) / 2 + q.i(-50, 50);
    const mainI = widths.indexOf(Math.max(...widths));
    const B = winBatch();
    const order = subs.map((s, i) => i);
    if (mainI !== 0) { order.splice(order.indexOf(mainI), 1); order.push(mainI); }
    const geo = [];
    let xx = x;
    for (let i = 0; i < nB; i++) { geo[i] = { x: xx, w: widths[i] }; xx += widths[i] + gaps[i]; }
    for (const i of order) {
      const s = subs[i];
      const floors = (s === 'blok' ? q.i(8, 10) : s === 'stara' ? q.i(4, 5) : s === 'nova' ? q.i(6, 7) : q.i(5, 8)) + (opts.extraFloors || 0);
      shadowLeft(S, geo[i].x, geo[i].w, HZ);
      building(S, q, B, geo[i].x, geo[i].w, s, floors, i, i === mainI, opts.litRate || .22);
    }
    // stanja prozora → putanje
    const brand = pickBrand(q, B.list.filter((w) => w.main), HZ - 215);   // iznad krošnji
    for (const w of B.list) {
      if (w === brand) continue;
      if (w.lit) B.lit += RP(w.x, w.y, w.w, w.h);
      else if (q.b(.25)) B.g[3] += RP(w.x, w.y, w.w, w.h);
      else if (q.b(.35)) B.blind += RP(w.x, w.y, w.w, w.h * .42);
    }
    flushWins(S, B);
    if (brand) brandWin(S, brand);
    // ulica: lampa, automobili, drveće
    const lx = q.b(.5) ? q.i(120, 300) : q.i(500, 680);
    lamp(S, lx, HZ + 26);
    const nc = q.i(1, 2);
    for (let i = 0; i < nc; i++) car(S, q, q.i(40, 620) + i * 90, HZ + 50 + i * 6, q.p([P.roof, P.haze, P.glass, '#8E8C86', PAPER]));
    const nt = q.i(3, 4);
    for (let i = 0; i < nt; i++) { const s = q.f(.8, 1.6); tree(S, q, q.i(40, 760), HZ + 26 + q.i(0, 30), s, i % 2); }
    finish(S, .35);
  }

  /* ─── KUĆA ─── */
  function house(S, q, ctx) {
    const P = S.P;
    skyAndSun(S, q, HZ, .45);
    // brda u izmaglici (nasumična)
    const hp = (n, lo, hi) => { const pts = [[0, HZ]]; for (let i = 0; i <= n; i++) pts.push([i * W / n, HZ - q.i(lo, hi)]); pts.push([W, HZ]); return pts; };
    S.poly(hp(5, 50, 160), P.haze, op(.9));
    S.poly(hp(4, 20, 90), mix(P.haze, P.tree, .22), op(.9));
    S.rect(0, HZ, W, H - HZ, P.ground);
    S.rect(0, HZ, W, 90, q.p(['#8C9A6E', '#95A072', '#879468']), op(.7));                 // travnjak
    S.rect(0, HZ + 90, W, 54, mix(P.ground, P.vig, .12));                 // ulica
    const story = ctx.vik ? 1 : q.i(1, 2);
    const bw = ctx.vik ? q.i(280, 340) : q.i(360, 460), bh = story * 112 + 34;
    const bx = (W - bw) / 2 + q.i(-50, 50), base = HZ + 20, top = base - bh;
    const wall = ctx.vik ? q.p([P.wall[2], P.wall[1], '#9C7F66']) : q.p([P.wall[0], P.wall[3], P.wall[1]]);
    const roofC = q.b(.45) ? '#7A4A3A' : P.roof;
    const hip = !ctx.vik && q.b(.4);
    shadowLeft(S, bx, bw, base, 1.2);
    // garaža / bočno krilo
    const wing = !ctx.vik && q.b(.5) ? (q.b(.5) ? 'l' : 'r') : null;
    if (wing) { const wx = wing === 'l' ? bx - 150 : bx + bw - 10; S.rect(wx, base - 96, 160, 96, mix(wall, P.vig, .06)); S.rect(wx - 8, base - 104, 176, 10, roofC, op(.85)); S.rect(wx + 30, base - 76, 100, 76, mix(P.roof, PAPER, .55)); let dd = ''; for (let y = base - 68; y < base; y += 10) dd += RP(wx + 30, y, 100, 1); S.path(dd, P.roof, op(.3)); }
    S.rect(bx, top, bw, bh, wall);
    S.rect(bx, top, bw * .12, bh, P.vig, op(.12));
    const rh = ctx.vik ? 120 : 96;
    if (hip) S.poly([[bx - 24, top], [bx + bw * .3, top - rh * .8], [bx + bw * .7, top - rh * .8], [bx + bw + 24, top]], roofC, op(.85));
    else S.poly([[bx - 24, top], [bx + bw / 2, top - rh], [bx + bw + 24, top]], roofC, op(.85));
    let dd = ''; for (let i = 1; i < 8; i++) { const yy = top - (hip ? rh * .8 : rh) * i / 8; const hw = hip ? bw * .2 + (bw * .3 + 24) * i / 8 : (bw / 2 + 24) * i / 8; dd += RP(bx + bw / 2 - hw, yy, 2 * hw, 1); }
    S.path(dd, P.vig, op(.18));                                                   // crep
    S.rect(bx - 28, top - 2, bw + 56, 7, mix(roofC, P.vig, .3));                  // oluk
    S.rect(bx + bw * .68, top - rh * .62, 22, rh * .4, mix(roofC, P.vig, .2));    // dimnjak
    // prozori
    const B = winBatch();
    const cols = Math.floor(bw / 100);
    const cell = (bw - 60) / cols;
    for (let f = 0; f < story; f++) for (let c = 0; c < cols; c++) {
      const wx = bx + 30 + c * cell + (cell - 44) / 2, wy = top + 26 + f * 112;
      if (f === story - 1 && c === Math.floor(cols / 2)) continue;
      const w = { x: wx, y: wy, w: 44, h: 52, row: f + 1, col: c, b: 0, lit: q.b(.3) };
      B.list.push(w);
      S.rect(wx - 10, wy, 8, 52, roofC, op(.6)); S.rect(wx + 46, wy, 8, 52, roofC, op(.6));  // kapci
      B.sill += RP(wx - 3, wy + 52, 50, 4); B.rev += RP(wx, wy, 44, 3);
      if (story === 2 && f === 0 && q.b(.4)) { S.rect(wx - 16, wy + 56, 76, 4, P.roof, op(.55)); S.rect(wx - 16, wy + 40, 1, 16, P.roof, op(.5)); S.rect(wx + 59, wy + 40, 1, 16, P.roof, op(.5)); S.rect(wx - 16, wy + 40, 76, 1, P.roof, op(.5)); }
    }
    const brand = pickBrand(q, B.list);
    for (const w of B.list) { if (w === brand) continue; if (w.lit) B.lit += RP(w.x, w.y, w.w, w.h); else B.g[q.i(1, 3)] += RP(w.x, w.y, w.w, w.h); }
    flushWins(S, B); if (brand) brandWin(S, brand);
    // vrata + nadstrešnica + staza
    const dx = bx + 30 + Math.floor(cols / 2) * cell + (cell - 44) / 2;
    S.rect(dx - 24, base - 84, 92, 6, P.roof, op(.7)); S.rect(dx - 24, base - 78, 3, 78, P.roof, op(.6)); S.rect(dx + 65, base - 78, 3, 78, P.roof, op(.6));
    S.rect(dx - 2, base - 70, 48, 6, P.lit);
    S.rect(dx, base - 64, 44, 64, P.roof); S.circle(dx + 36, base - 32, 2, P.lit);
    S.poly([[dx + 2, base], [dx + 42, base], [dx + 90, HZ + 90], [dx - 30, HZ + 90]], mix(P.ground, PAPER, .3));
    // ograda + kapija
    dd = ''; for (let x = -10; x < W; x += 10) if (x < dx - 40 || x > dx + 90) dd += RP(x, HZ + 52, 8, 30);
    S.path(RP(0, HZ + 58, W, 3) + RP(0, HZ + 74, W, 3), PAPER, op(.7));
    S.path(dd, PAPER, op(.85));
    S.rect(dx - 44, HZ + 48, 4, 36, P.roof, op(.7)); S.rect(dx + 90, HZ + 48, 4, 36, P.roof, op(.7));
    lamp(S, q.b(.5) ? 70 : 740, HZ + 96, 110);
    tree(S, q, bx - 50 + q.i(-40, 20), HZ + 60, q.f(1.1, 1.5));
    tree(S, q, bx + bw + 40 + q.i(0, 60), HZ + 40, q.f(.9, 1.3), 1);
    if (ctx.vik || q.b(.3)) { // prednje drvo: nikad ispred vrata/staze (dx-110 … dx+120 ostaje slobodno)
      const segs = []; if (dx - 110 > bx + 40) segs.push([bx + 40, dx - 110]); if (bx + bw - 40 > dx + 120) segs.push([dx + 120, bx + bw - 40]);
      if (segs.length) { const sg = q.p(segs); tree(S, q, q.i(sg[0], sg[1]), HZ + 100, q.f(.8, 1.1), 1); }
      tree(S, q, 60, HZ + 30, .9);
    }
    // živa ograda ponekad
    if (q.b(.4)) { dd = ''; for (let x = 0; x < W; x += 20) dd += `M${x} ${HZ + 56}a10 14 0 1 1 20 0z`; S.path(dd, mix(P.tree, '#8C9A6E', .3), op(.9)); }
    finish(S, .35);
  }

  /* ─── ENTERIJER: kutija sobe ─── */
  function room(S, q, wall, floor, opts = {}) {
    const P = S.P;
    const dp = opts.flat ? 0 : q.i(90, 140), FL = opts.fl || 392;
    S.rect(0, 0, W, H, wall);
    S.lin('cg', '#ffffff', '#ffffff', .22, 0);
    S.rect(0, 0, W, 170, 'url(#cg)');                                  // plafon/svetlo odozgo
    S.rect(0, FL, W, H - FL, floor);
    // pod: daske u perspektivi
    let dd = '';
    for (let i = 0; i <= 9; i++) { const t = i / 9; dd += `M${N(t * W)} ${H}L${N(dp + t * (W - 2 * dp))} ${FL}`; }
    for (let k = 1; k < 6; k++) { const y = FL + (H - FL) * Math.pow(k / 6, 1.6); dd += `M0 ${N(y)}H${W}`; }
    S.lines(dd, P.roof, 1, op(.14));
    if (dp) {
      S.poly([[0, 0], [dp, 60], [dp, FL], [0, FL + 90]], P.vig, op(.16));
      S.poly([[W, 0], [W - dp, 60], [W - dp, FL], [W, FL + 90]], '#ffffff', op(.12));
      S.poly([[0, 0], [W, 0], [W - dp, 60], [dp, 60]], '#ffffff', op(.1));
      S.poly([[0, FL + 90], [dp, FL], [W - dp, FL], [W, FL + 90], [W, H], [0, H]], P.vig, op(.05));
      S.rect(dp, FL - 8, W - 2 * dp, 8, mix(wall, P.vig, .18));  // lajsna
    } else S.rect(0, FL - 8, W, 8, mix(wall, P.vig, .18));
    S.lin('fs', P.vig, P.vig, .18, 0);
    S.rect(0, FL, W, 40, 'url(#fs)');
    return { dp, FL };
  }
  // pogled kroz prozor: nebo + izmaglica + bliža zgrada sa brend prozorom
  function cityView(S, q, x, y, w, h, brand = true, big = false) {
    const P = S.P; const id = 'c' + N(x);
    S.def(`<clipPath id='${id}'><rect x='${N(x)}' y='${N(y)}' width='${N(w)}' height='${N(h)}'/></clipPath>`);
    S.add(`<g clip-path='url(#${id})'>`);
    S.lin('s', P.sky[0], P.sky[1]);
    S.rect(x, y, w, h, 'url(#s)');
    S.glow(x + w * .8, y + h * .55, w * .5, P.lit, .5);
    let dd = ''; let bx = x - 10;
    while (bx < x + w) { const bw = q.i(24, 60), bh = q.i(h * .25, h * .55); dd += RP(bx, y + h * .66 - bh, bw, bh); bx += bw + q.i(0, 6); }
    S.path(dd, P.haze, op(.9));
    const left = q.b(.5);
    const nb = { x: x + (left ? -w * .04 : w * .42), y: y + h * .24, w: w * .62, h: h * .76 };
    S.rect(nb.x, nb.y, nb.w, nb.h, q.p([P.wall[1], P.wall[3], P.wall[0]]));
    S.rect(nb.x, nb.y, nb.w * .12, nb.h, P.vig, op(.12));
    S.rect(nb.x, nb.y, nb.w, 5, P.roof, op(.75));
    const pitch = 34, cols = Math.max(2, Math.floor((nb.w - 16) / 36)), rows = Math.max(2, Math.floor((nb.h - 14) / pitch)), cw = (nb.w - 16) / cols;
    const B = winBatch();
    for (let r2 = 0; r2 < rows; r2++) for (let c = 0; c < cols; c++) B.list.push({ x: nb.x + 8 + c * cw + 5, y: nb.y + 14 + r2 * pitch, w: cw - 10, h: 21, row: r2, col: c, b: 0, lit: q.b(.25) });
    const br = brand ? pickBrand(q, B.list) : null;
    for (const wn of B.list) { if (wn === br) continue; if (wn.lit) B.lit += RP(wn.x, wn.y, wn.w, wn.h); else B.g[q.i(1, 3)] += RP(wn.x, wn.y, wn.w, wn.h); if (q.b(.3)) B.sill += RP(wn.x - 2, wn.y + wn.h, wn.w + 4, 3); }
    flushWins(S, B); if (br) brandWin(S, br, big);
    S.rect(x, y + h * .8, w, h * .2, mix(P.ground, P.haze, .4));
    const tx = left ? x + w * .84 : x + w * .16, tb = y + h * .92, ts = h / 230;
    S.rect(tx - 3 * ts, tb - 70 * ts, 6 * ts, 70 * ts, P.roof, op(.8));
    S.ell(tx - 14 * ts, tb - 78 * ts, 30 * ts, 34 * ts, P.tree, op(.9)); S.ell(tx + 12 * ts, tb - 90 * ts, 26 * ts, 30 * ts, mix(P.tree, P.lit, .12), op(.9));
    S.add('</g>');
  }
  function windowFrame(S, x, y, w, h, white = PAPER) {
    const t = 10;
    S.rect(x, y, w, 7, S.P.vig, op(.16));                                     // senka špaletne
    S.path(RP(x - t, y - t, w + 2 * t, t) + RP(x - t, y + h, w + 2 * t, t) + RP(x - t, y, t, h) + RP(x + w, y, t, h) + RP(x + w / 2 - 3, y, 6, h) + RP(x, y + h * .45, w, 6), white);
    S.rect(x - 14, y + h + 10, w + 28, 8, white);
    S.rect(x - 14, y + h + 18, w + 28, 3, S.P.vig, op(.15));
  }
  function lightShaft(S, x, y, w, FL, o = .14) { S.poly([[x - 30, FL], [x + w + 10, FL], [x + w - 70, H], [x - 280, H]], '#ffffff', op(o)); }
  function plant(S, q, x, base, s = 1) {
    const P = S.P;
    S.rect(x - 16 * s, base - 36 * s, 32 * s, 36 * s, mix(P.roof, P.wall[2], .4), op(.9));
    S.rect(x - 3, base - 90 * s, 4, 56 * s, P.tree);
    for (let i = 0; i < 5; i++) { const a = -70 + i * 35; S.add(`<ellipse cx='${N(x)}' cy='${N(base - 92 * s)}' rx='${N(10 * s)}' ry='${N(34 * s)}' fill='${mix(P.tree, P.lit, i % 2 ? .12 : 0)}' transform='rotate(${a} ${N(x)} ${N(base - 60 * s)})'${op(.92)}/>`); }
  }
  function frame(S, q, x, y, w, h) {
    const P = S.P;
    S.rect(x + 3, y + 4, w, h, P.vig, op(.12));
    S.rect(x, y, w, h, P.roof);
    S.rect(x + 4, y + 4, w - 8, h - 8, P.haze);
    S.rect(x + 4, y + h * .55, w - 8, h * .45 - 4, q.p([P.tree, P.wall[2], P.glass]), op(.6));
    S.circle(x + w * .65, y + h * .32, h * .09, P.lit, op(.8));
  }
  function floorLamp(S, x, base) {
    const P = S.P;
    S.glow(x, base - 150, 60, P.lit, .35);
    S.rect(x - 1, base - 150, 3, 150, P.roof, op(.8));
    S.ell(x, base, 16, 3, P.roof, op(.7));
    S.poly([[x - 22, base - 150], [x + 22, base - 150], [x + 28, base - 112], [x - 28, base - 112]], PAPER, op(.9));
  }

  function living(S, q, ctx) {
    const P = S.P;
    const wall = q.p([P.wall[0], P.wall[1], P.wall[3]]), floor = q.p(['#B8A58F', '#A9A094', '#C2AE97']);
    const mir = q.b(.5);
    if (mir) S.add(`<g transform='translate(${W} 0) scale(-1 1)'>`);
    const { dp, FL } = room(S, q, wall, floor);
    const ww = W * q.f(.32, .42), wx = Math.max(dp + 60, W - dp - 60 - ww) - q.i(0, 40), wy = 70, wh = 230;
    cityView(S, q, wx, wy, ww, wh);
    windowFrame(S, wx, wy, ww, wh);
    S.rect(wx - 36, wy - 20, 26, wh + 50, q.p([P.wall[3], P.haze, '#C9B9A3']), op(.85));      // zavesa
    S.rect(wx + ww + 10, wy - 20, 26, wh + 50, q.p([P.wall[3], P.haze, '#C9B9A3']), op(.85));
    lightShaft(S, wx, wy, ww, FL);
    // tepih
    S.rect(dp + 40, FL + 50, W - 2 * dp - 80, 120, P.haze, op(.55));
    S.rect(dp + 60, FL + 70, W - 2 * dp - 120, 2, P.roof, op(.12));
    S.rect(dp + 60, FL + 148, W - 2 * dp - 120, 2, P.roof, op(.12));
    // sofa
    const set = q.p([['#8A9A84', '#6F7F6A'], ['#6F7A82', '#59636A'], ['#9E8F80', '#857767']]);
    const sx = ctx.office ? 0 : dp + 50 + q.i(0, 60), sy = FL + 40, sw = 290;
    if (ctx.office) {
      // kancelarija: dva stola, monitori, stolice, staklena pregrada
      const dx = dp + 40;
      S.rect(W - dp - 30, 40, 24, FL - 40, mix(wall, P.glass, .35), op(.5));
      for (let i = 0; i < 2; i++) {
        const tx = dx + i * 300, ty = FL + 30 + i * 8;
        S.rect(tx + 10, ty + 10, 250, 70, P.vig, op(.1));
        S.rect(tx, ty, 250, 12, PAPER); S.rect(tx + 8, ty + 12, 6, 90, P.roof, op(.7)); S.rect(tx + 236, ty + 12, 6, 90, P.roof, op(.7));
        S.rect(tx + 60, ty - 56, 80, 50, P.glass, op(.95)); S.rect(tx + 96, ty - 6, 8, 6, P.roof); S.rect(tx + 80, ty - 2, 40, 3, P.roof);
        S.rect(tx + 64, ty - 52, 72, 42, mix(P.glass, MINT, .25), op(.5));
        S.rect(tx + 160, ty - 10, 40, 10, P.wall[2]);                           // sveska
        S.rect(tx + 150, ty + 14, 70, 60, set[0], ` rx='6'`); S.rect(tx + 158, ty + 74, 54, 10, set[1]); // stolica
      }
    } else {
      S.rect(sx + 14, sy + 68, sw - 10, 26, P.vig, op(.14));
      S.rect(sx, sy - 56, sw, 60, set[0], ` rx='6'`);
      S.rect(sx - 18, sy - 30, 28, 100, set[1], ` rx='6'`); S.rect(sx + sw - 10, sy - 30, 28, 100, set[1], ` rx='6'`);
      S.rect(sx, sy, sw, 70, set[0], ` rx='4'`);
      S.rect(sx + sw / 3, sy, 2, 68, set[1], op(.6)); S.rect(sx + 2 * sw / 3, sy, 2, 68, set[1], op(.6));
      S.rect(sx + 18, sy - 44, 44, 40, P.lit, ` rx='4'${op(.95)}`);
      S.rect(sx + sw - 70, sy - 44, 44, 40, mix(wall, PAPER, .4), ` rx='4'`);
      S.rect(sx + 10, sy + 70, 8, 16, P.roof); S.rect(sx + sw - 18, sy + 70, 8, 16, P.roof);
      // sto
      const tx = sx + 60, ty = FL + 150;
      S.ell(tx + 90, ty + 46, 100, 10, P.vig, op(.14));
      S.rect(tx, ty, 180, 12, P.roof, ` rx='3'${op(.85)}`);
      S.rect(tx + 14, ty + 12, 4, 34, P.roof, op(.8)); S.rect(tx + 162, ty + 12, 4, 34, P.roof, op(.8));
      S.rect(tx + 60, ty - 12, 46, 12, PAPER); S.rect(tx + 120, ty - 16, 14, 16, P.tree, op(.8));
      floorLamp(S, sx + sw + 60, FL + 60);
    }
    frame(S, q, Math.min(dp + 60 + q.i(0, 40), wx - 36 - 100), 90, 90, 110);
    plant(S, q, W - dp - 70, FL + 80, 1.1);
    S.glow(W * .5, 0, 240, P.lit, .14);
    if (mir) S.add('</g>');
    finish(S, .35);
  }

  function kitchen(S, q, ctx) {
    const P = S.P;
    const wall = q.p([P.wall[0], P.wall[3]]), floor = q.p(['#B8A58F', '#C2AE97', '#A9A094']);
    const { dp, FL } = room(S, q, wall, floor, { flat: true, fl: 420 });
    const CT = q.i(348, 380);                                          // radna ploča 58–63 %
    // prozor levo
    const wx = 70, wy = 90, ww = 190, wh = 170;
    cityView(S, q, wx, wy, ww, wh);
    windowFrame(S, wx, wy, ww, wh);
    // gornji elementi
    const cab = q.p([PAPER, '#DED7CB', P.wall[3], '#9CA394']);
    const ux = 310;
    S.rect(ux, 70, W - ux, 150, cab);
    let dd = ''; for (let x = ux + 1; x < W; x += 92) dd += RP(x, 70, 1, 150);
    S.path(dd + RP(ux, 70, W - ux, 1) + RP(ux, 219, W - ux, 1), P.vig, op(.22));
    dd = ''; for (let x = ux + 36; x < W; x += 92) dd += RP(x, 190, 20, 3);
    S.path(dd, P.roof, op(.7));
    S.rect(ux, 220, W - ux, 6, P.vig, op(.14));
    // pločice iza
    S.rect(ux, 226, W - ux, CT - 226, '#E8E3DA');
    dd = ''; for (let y = 226; y < CT; y += 24) dd += RP(ux, y, W - ux, 1); for (let x = ux; x < W; x += 24) dd += RP(x, 226, 1, CT - 226);
    S.path(dd, P.haze, op(.9));
    // radna ploča + donji elementi
    S.rect(0, CT, W, 10, mix(PAPER, P.wall[2], .3));
    S.rect(0, CT + 10, W, FL - CT - 10, P.wall[2]);
    dd = ''; for (let x = 92; x < W; x += 92) dd += RP(x, CT + 10, 1, FL - CT - 10);
    S.path(dd, P.vig, op(.25));
    dd = ''; for (let x = 36; x < W; x += 92) dd += RP(x, CT + 22, 20, 3);
    S.path(dd, P.roof, op(.7));
    // rerna + ploča
    const ox = 290; S.rect(ox, CT + 10, 92, FL - CT - 10, P.roof, op(.85)); S.rect(ox + 8, CT + 26, 76, 40, P.glass, op(.9));
    S.rect(ox - 2, CT - 2, 96, 4, P.roof); for (let i = 0; i < 4; i++) S.circle(ox + 20 + (i % 2) * 54, CT - 1 + 0, 1, P.roof);
    // sudopera + slavina
    const kx = 520; S.rect(kx, CT + 1, 80, 8, PAPER, ` rx='2'`); S.rect(kx + 36, CT - 34, 4, 36, '#9A9B98'); S.rect(kx + 36, CT - 36, 22, 4, '#9A9B98', ` rx='2'`);
    // frižider
    S.rect(W - 110, 70, 100, FL - 70, P.glass, op(.92)); S.rect(W - 110, 70, 12, FL - 70, P.vig, op(.25)); S.rect(W - 110, 200, 100, 3, P.vig, op(.4)); S.rect(W - 30, 110, 4, 60, '#9A9B98'); S.rect(W - 30, 220, 4, 90, '#9A9B98');
    // sitnice
    S.rect(400, CT - 30, 12, 30, P.tree, op(.8)); S.rect(418, CT - 20, 10, 20, P.lit); S.ell(460, CT - 2, 22, 6, PAPER); S.circle(455, CT - 9, 6, P.lit); S.circle(466, CT - 8, 5, '#B85C4A', op(.8));
    // pendant lampe
    for (let i = 0; i < 3; i++) { const lx = 380 + i * 130; S.rect(lx, 0, 1, 92, P.roof, op(.6)); S.glow(lx, 100, 26, P.lit, .45); S.poly([[lx - 14, 92], [lx + 14, 92], [lx + 9, 104], [lx - 9, 104]], P.roof); S.circle(lx, 104, 6, P.lit); }
    // ostrvo / stolica
    const ix = q.i(60, 140); S.rect(ix + 14, FL + 150, 220, 20, P.vig, op(.14)); S.rect(ix, FL + 30, 220, 14, mix(PAPER, P.wall[2], .3)); S.rect(ix + 6, FL + 44, 208, 110, q.p([P.wall[1], '#8A9A84', P.roof, P.wall[2]]), op(.9)); S.rect(ix + 6, FL + 44, 208, 1, P.vig, op(.3)); S.rect(ix + 230, FL + 90, 2, 70, P.roof, op(.8)); S.rect(ix + 258, FL + 90, 2, 70, P.roof, op(.8)); S.rect(ix + 222, FL + 84, 46, 8, P.roof, ` rx='3'`);
    S.rect(0, FL, W, 30, P.vig, op(.08));
    lightShaft(S, wx, wy, ww, FL, .1);
    plant(S, q, W - 60, FL + 170, .9);
    finish(S, .33);
  }

  function bedroom(S, q, ctx) {
    const P = S.P;
    const wall = q.p([P.wall[1], P.wall[0], '#C7C0B2']), floor = q.p(['#B8A58F', '#A9A094', '#C2AE97']);
    const { dp, FL } = room(S, q, wall, floor, { flat: q.b(.4) });
    const wx = W - dp - 70 - 220, wy = 80, ww = 200, wh = 200;
    cityView(S, q, wx, wy, ww, wh);
    windowFrame(S, wx, wy, ww, wh);
    S.rect(wx - 48, 40, 40, FL - 40, q.p([P.wall[3], '#C9B9A3', P.haze]), op(.9));   // zavesa
    S.rect(wx + ww + 10, 40, 40, FL - 40, q.p([P.wall[3], '#C9B9A3', P.haze]), op(.9));
    let dd = ''; for (let x = wx - 44; x < wx - 10; x += 8) dd += RP(x, 40, 1, FL - 40); for (let x = wx + ww + 14; x < wx + ww + 50; x += 8) dd += RP(x, 40, 1, FL - 40);
    S.path(dd, P.vig, op(.12));
    lightShaft(S, wx, wy, ww, FL, .1);
    // krevet
    const bx = dp + 60 + q.i(0, 40), by = FL - 30, bw = 320;
    S.rect(bx + 10, by + 98, bw + 30, 24, P.vig, op(.14));
    S.rect(bx + 20, by - 90, bw - 40, 100, P.roof, ` rx='4'${op(.9)}`);     // uzglavlje
    S.rect(bx, by, bw, 110, P.haze);                                          // dušek/posteljina
    S.rect(bx, by + 60, bw, 50, mix(P.haze, P.vig, .12));
    S.rect(bx, by + 50, bw, 38, q.p(['#8A9A84', P.wall[2], '#6F7A82']), op(.8));   // ćebe
    S.rect(bx + 36, by - 16, 100, 28, PAPER, ` rx='5'`); S.rect(bx + 150, by - 16, 100, 28, PAPER, ` rx='5'`);
    S.rect(bx + 12, by + 110, 10, 14, P.roof); S.rect(bx + bw - 22, by + 110, 10, 14, P.roof);
    // noćni stočići + lampe
    for (const nx of [bx - 60, bx + bw + 20]) { S.rect(nx, by + 20, 46, 60, P.roof, op(.8)); S.rect(nx + 8, by + 40, 30, 3, P.lit, op(.6)); S.glow(nx + 23, by - 20, 40, P.lit, .5); S.rect(nx + 21, by - 4, 4, 24, P.roof); S.poly([[nx + 6, by - 4], [nx + 40, by - 4], [nx + 36, by - 28], [nx + 10, by - 28]], PAPER); }
    frame(S, q, bx + 100, 60, 120, 80);
    S.rect(bx - 40, by + 120, bw + 120, 50, P.haze, op(.45));                 // tepih
    plant(S, q, dp + 30, FL + 60, .8);
    S.glow(W * .5, 0, 220, P.lit, .12);
    finish(S, .28);
  }

  function bath(S, q, ctx) {
    const P = S.P;
    const FL = 400;
    S.rect(0, 0, W, FL, mix('#E8E3DA', P.wall[1], .25));
    let dd = ''; for (let y = 0; y <= FL; y += 40) dd += RP(0, y, W, 1); for (let x = 0; x < W; x += 40) dd += RP(x, 0, 1, FL);
    S.path(dd, '#D4CEC4');
    S.rect(0, 0, W * .14, FL, P.vig, op(.1));
    S.rect(0, FL, W, H - FL, mix('#CFC8BC', P.vig, .12));
    dd = ''; for (let x = 0; x < W; x += 60) dd += RP(x, FL, 1, H - FL); for (let y = FL; y < H; y += 50) dd += RP(0, y, W, 1);
    S.path(dd, '#BDB5A8');
    S.lin('cg', '#ffffff', '#ffffff', .25, 0); S.rect(0, 0, W, 160, 'url(#cg)');
    S.rect(0, FL - 10, W, 10, '#D4CEC4');
    const bwx = q.b(.5) ? 70 : 640;
    // ogledalo + lavabo
    const mx = bwx < 300 ? 470 : 150;
    S.rect(mx - 6, 94, 212, 142, PAPER); S.lin('mr', P.sky[0], P.sky[1]); S.rect(mx, 100, 200, 130, 'url(#mr)'); S.rect(mx, 100, 200, 130, '#ffffff', op(.12)); S.rect(mx + 100, 100, 1, 130, '#ffffff', op(.3));
    S.rect(mx - 20, 270, 240, 14, PAPER); S.rect(mx - 12, 284, 224, 100, q.p([P.roof, P.wall[2], '#8A9A84']), op(.9)); S.rect(mx + 20, 330, 60, 3, PAPER, op(.6)); S.rect(mx + 120, 330, 60, 3, PAPER, op(.6));
    S.ell(mx + 100, 268, 50, 10, '#FFFFFF'); S.rect(mx + 98, 236, 4, 30, '#9A9B98'); S.rect(mx + 98, 234, 18, 4, '#9A9B98', ` rx='2'`);
    S.glow(mx + 100, 86, 40, P.lit, .5); S.rect(mx + 70, 80, 60, 6, PAPER); S.rect(mx + 70, 86, 60, 3, P.lit);
    // kada / tuš
    const tx = bwx < 300 ? 60 : 420;
    if (q.b(.5)) { S.rect(tx + 10, FL - 20, 320, 30, P.vig, op(.1)); S.rect(tx - 8, FL - 104, 336, 120, P.vig, op(.14)); S.rect(tx, FL - 110, 320, 120, '#FFFFFF', ` rx='8'`); S.rect(tx, FL - 40, 320, 50, mix('#FFFFFF', P.vig, .08), ` rx='8'`); S.rect(tx + 10, FL - 100, 300, 12, mix('#ffffff', P.vig, .1), ` rx='4'`); S.rect(tx + 250, FL - 150, 4, 44, '#9A9B98'); S.rect(tx + 250, FL - 152, 24, 4, '#9A9B98', ` rx='2'`); S.rect(tx + 280, FL - 160, 30, 10, mix(P.lit, PAPER, .5)); }
    else { S.rect(tx, 40, 300, FL - 40, mix(P.sky[0], '#ffffff', .4), op(.55)); S.rect(tx, 40, 300, 3, '#9A9B98'); S.rect(tx + 298, 40, 3, FL - 40, '#9A9B98'); S.rect(tx + 220, 60, 50, 6, '#9A9B98', ` rx='3'`); S.rect(tx + 243, 50, 4, 10, '#9A9B98'); dd = ''; for (let i = 0; i < 7; i++) dd += RP(tx + 226 + i * 7, 70, 1, 120); S.path(dd, '#ffffff', op(.5)); S.rect(tx + 10, FL - 14, 280, 14, '#F7F5F1'); S.rect(tx + 140, FL - 6, 20, 4, '#9A9B98'); }
    // brend prozor (mat staklo) — na zidu pored ogledala, ništa ga ne prekriva
    const wxp = bwx < 300 ? 700 : 40;
    S.glow(wxp + 40, 110, 60, MINT, .22); S.rect(wxp - 6, 64, 92, 98, PAPER); S.rect(wxp, 70, 80, 80, PINE, op(.6));
    S.path(RP(wxp, 86, 80, 10) + RP(wxp, 112, 80, 10) + RP(wxp, 138, 80, 10), '#ffffff', op(.16));
    S.add(`<rect x='${wxp + 1}' y='71' width='78' height='78' fill='none' stroke='${MINT}' stroke-width='1.5'/>`);
    S.rect(wxp - 6, 156, 92, 6, mix(PAPER, P.vig, .15));
    // peškir + biljka
    S.rect(mx + 230, 300, 4, 60, '#9A9B98'); S.rect(mx + 236, 296, 36, 70, q.p(['#8A9A84', P.lit, P.wall[1]]), ` rx='2'${op(.95)}`);
    plant(S, q, tx + (bwx < 300 ? 340 : -40), FL + 70, .9);
    S.rect(80, FL + 60, 200, 80, q.p(['#8A9A84', P.wall[1], P.haze]), op(.7));
    finish(S, .3);
  }

  function balcony(S, q, ctx) {
    const P = S.P; const hz = 270;
    S.lin('s', P.sky[0], P.sky[1]); S.rect(0, 0, W, hz + 10, 'url(#s)');
    S.glow(700, 40, 260, P.lit, .14);
    S.glow(620, hz - 10, 260, P.lit, .35);
    farRow(S, q, hz, 30, 110, .92);
    // srednji red
    const B = winBatch(); let x = -20; const mids = []; const wp = ['', '', ''], caps = { d: '' };
    while (x < W + 40) { const bw = q.i(70, 160), bh = q.i(60, 140); mids.push({ x, w: bw, h: bh }); wp[q.i(0, 2)] += RP(x, hz - bh, bw, bh + 10); caps.d += RP(x, hz - bh, bw, 4); const cols = Math.floor(bw / 18), rows = Math.floor(bh / 22); for (let r2 = 0; r2 < rows; r2++) for (let c = 0; c < cols; c++) B.list.push({ x: x + 6 + c * 18, y: hz - bh + 8 + r2 * 22, w: 9, h: 11, row: r2, col: c, b: mids.length, lit: q.b(.25) }); x += bw + q.i(2, 10); }
    [P.wall[1], P.wall[2], P.wall[0]].forEach((c, i) => { if (wp[i]) S.path(wp[i], c); }); S.path(caps.d, P.roof, op(.7));
    for (const wn of B.list) { if (wn.lit) B.lit += RP(wn.x, wn.y, wn.w, wn.h); else B.g[q.i(0, 3)] += RP(wn.x, wn.y, wn.w, wn.h); }
    flushWins(S, B);
    S.lin('hb', P.haze, P.haze, 0, .5); S.rect(0, hz - 120, W, 200, 'url(#hb)');
    // bliži red (niži, tamniji) + ulica — brend prozor je ovde (veći)
    S.rect(0, hz + 10, W, 80, mix(P.ground, P.haze, .3));
    x = -10; let dd = '', lit = '', sh = ''; const np = ['', '', ''], NB = winBatch(); let bi = 0;
    while (x < W) { const bw = q.i(100, 220), bh = q.i(90, 150); np[q.i(0, 2)] += RP(x, hz + 90 - bh, bw, bh); sh += RP(x, hz + 90 - bh, bw * .12, bh); let r2 = 0; for (let yy = hz + 100 - bh; yy < hz + 80; yy += 30, r2++) { let c = 0; for (let xx = x + 10; xx < x + bw - 16; xx += 30, c++) NB.list.push({ x: xx, y: yy, w: 16, h: 18, row: r2, col: c, b: bi, lit: q.b(.25) }); } x += bw + q.i(6, 18); bi++; }
    [P.wall[0], P.wall[3], P.wall[1]].forEach((c, i) => { if (np[i]) S.path(np[i], c); }); S.path(sh, P.vig, op(.12));
    const br = pickBrand(q, NB.list.filter((w) => w.x > 60 && w.x < 720));
    for (const wn of NB.list) { if (wn === br) continue; if (wn.lit) lit += RP(wn.x, wn.y, wn.w, wn.h); else dd += RP(wn.x, wn.y, wn.w, wn.h); }
    S.path(dd, P.glass, op(.8)); S.path(lit, P.lit); if (br) brandWin(S, br, true);
    S.rect(0, hz + 90, W, 330, mix(P.ground, P.haze, .25));
    S.rect(0, hz + 150, W, 10, mix(P.ground, PAPER, .3), op(.7));
    for (let i = 0; i < 4; i++) tree(S, q, q.i(0, 800), hz + 120 + q.i(0, 20), q.f(.6, .9), i % 2);
    // ograda terase
    S.rect(0, 420, W, 180, P.haze, op(.18));
    dd = ''; for (let bx = 8; bx < W; bx += 24) dd += RP(bx, 424, 2, 176);
    S.path(dd, P.roof, op(.9));
    S.rect(0, 416, W, 8, P.roof, op(.85)); S.rect(0, 592, W, 8, P.roof, op(.85));
    // saksija na ogradi + šolja
    const px = q.i(80, 600); S.rect(px, 388, 110, 30, mix(P.roof, P.wall[2], .3)); S.ell(px + 30, 380, 28, 18, P.tree, op(.92)); S.ell(px + 70, 376, 30, 22, mix(P.tree, P.lit, .15), op(.92)); S.ell(px + 50, 392, 22, 10, mix(P.tree, P.vig, .2), op(.9));
    S.rect(px + 150, 400, 18, 18, PAPER, ` rx='2'`);
    finish(S, .32);
  }

  function entrance(S, q, ctx) {
    const P = S.P;
    const wall = q.p([P.wall[0], P.wall[1], P.wall[3]]);
    S.rect(0, 0, W, H, wall);
    const panel = q.i(0, 2); let dd = '';
    if (panel === 0) { for (let y = 0; y < 420; y += 70) dd += RP(0, y, W, 1); for (let x = 60; x < W; x += 160) dd += RP(x, 0, 1, 420); }
    else if (panel === 1) { for (let y = 0; y < 420; y += 36) dd += RP(0, y, W, 1); }
    else { for (let x = 0; x < W; x += 48) dd += RP(x, 0, 1, 420); }
    S.path(dd, P.vig, op(.14));
    S.rect(0, 0, W * .14, H, P.vig, op(.1));
    S.lin('cg', P.lit, P.lit, .16, 0); S.rect(0, 150, W, 200, 'url(#cg)');
    const off = q.i(-90, 90), mir = q.b(.5);
    if (mir) S.add(`<g transform='translate(${W} 0) scale(-1 1)'>`);
    // trotoar + stepenik
    S.rect(0, 480, W, 120, mix(P.ground, '#ffffff', .12)); S.rect(0, 478, W, 4, P.roof, op(.3));
    S.rect(240 + off, 456, 320, 24, mix(P.ground, '#ffffff', .22)); S.rect(240 + off, 456, 320, 3, '#ffffff', op(.3));
    // nadstrešnica
    const cw = q.i(380, 520); S.poly([[400 + off - cw / 2, 130], [400 + off + cw / 2, 130], [420 + off + cw / 2, 150], [380 + off - cw / 2, 150]], P.roof, op(.9)); S.rect(380 + off - cw / 2, 150, cw + 40, 40, P.vig, op(.14));
    // vrata
    const dx = 290 + off, dy = 180, dw = q.i(190, 240), dh = 276;
    S.rect(dx - 14, dy - 14 - 50, dw + 28, dh + 64, P.roof);
    S.glow(dx + dw / 2, dy + 60, 110, P.lit, .35);
    S.lin('dl', P.lit, P.glass, .9, .95); S.rect(dx, dy, dw / 2 - 3, dh, 'url(#dl)'); S.rect(dx + dw / 2 + 3, dy, dw / 2 - 3, dh, 'url(#dl)');
    S.rect(dx + dw / 2 - 3, dy, 6, dh, P.roof);
    S.rect(dx + dw / 2 - 16, dy + 120, 6, 60, '#9A9B98', ` rx='3'`); S.rect(dx + dw / 2 + 10, dy + 120, 6, 60, '#9A9B98', ` rx='3'`);
    S.rect(dx + 10, dy + 20, 10, dh - 40, '#ffffff', op(.18));
    // brend prozor iznad vrata (nadsvetlo)
    brandWin(S, { x: dx, y: dy - 50, w: dw, h: 38 }, true);
    // broj + interfon + poštanski sandučići
    const num = String(1 + (H32(ctx.seed) % 180));
    S.rect(dx + dw + 30, 230, 56, 56, PAPER); S.rect(dx + dw + 30, 230, 56, 56, P.vig, op(.05));
    S.text(dx + dw + 58, 268, num, ` font-family='Hanken Grotesk,Arial,sans-serif' font-weight='600' font-size='26' fill='${INK}' text-anchor='middle'${mir ? ` transform='translate(${N(2 * (dx + dw + 58))} 0) scale(-1 1)'` : ''}`);
    S.rect(dx + dw + 36, 310, 44, 110, '#9A9B98', ` rx='2'`); dd = ''; for (let i = 0; i < 8; i++) dd += RP(dx + dw + 44, 322 + i * 12, 28, 6); S.path(dd, P.roof, op(.7)); S.rect(dx + dw + 44, 404, 28, 12, P.lit, op(.7));
    S.rect(dx - 100, 260, 56, 120, '#9A9B98', ` rx='2'`); dd = ''; for (let i = 0; i < 4; i++) dd += RP(dx - 94, 270 + i * 28, 44, 20); S.path(dd, P.roof, op(.4));
    // žardinjere
    plant(S, q, dx - 50, 480, q.f(.9, 1.3)); if (q.b(.7)) plant(S, q, dx + dw + 60, 480, q.f(.8, 1.1));
    S.rect(dx - 78, 436, 56, 44, P.roof, op(.8)); S.rect(dx + dw + 32, 436, 56, 44, P.roof, op(.8));
    if (q.b(.5)) { S.rect(dx - 150, 300, 36, 60, P.roof, op(.5)); S.rect(dx - 146, 304, 28, 28, P.lit, op(.5)); }  // tabla / svetlo
    if (mir) S.add('</g>');
    finish(S, .34);
  }

  function land(S, q, ctx) {
    const P = S.P; const hz = ctx.backyard ? 330 : q.i(340, 380);
    skyAndSun(S, q, hz, q.f(.35, .55), q.i(520, 740));
    const hp = (n, lo, hi) => { const pts = [[0, hz]]; for (let i = 0; i <= n; i++) pts.push([i * W / n, hz - q.i(lo, hi)]); pts.push([W, hz]); return pts; };
    S.poly(hp(q.i(4, 6), 30, 130), P.haze, op(.9));
    S.poly(hp(q.i(3, 5), 10, 60), mix(P.haze, P.tree, .3), op(.9));
    // tree line
    let dd = ''; for (let x = -10; x < W; x += 14) dd += `M${x} ${hz}a7 ${q.i(8, 18)} 0 1 1 14 0z`;
    S.path(dd, P.tree, op(.8));
    const g1 = q.p(['#8C9A6E', '#95A072', '#879468']), g2 = q.p(['#A4A872', '#9EA66C', '#ADA878']), sand = mix(q.p(['#C9B48A', '#D2BB92', '#BFAA82']), P.ground, .4);
    const b1 = q.i(50, 90), b2 = q.i(30, 70);
    S.rect(0, hz, W, b1, g1); S.rect(0, hz + b1, W, b2, sand); S.rect(0, hz + b1 + b2, W, H - hz, g2);
    if (ctx.backyard) {
      const mir = q.b(.5); if (mir) S.add(`<g transform='translate(${W} 0) scale(-1 1)'>`);
      S.rect(0, hz + 40, W, 300, g1);
      // ugao kuće s desna sa brend prozorom
      const wall = q.p([P.wall[0], P.wall[3], P.wall[1]]), hx = 500, hw = 380;
      S.rect(hx, 70, hw, 390, wall); S.rect(hx, 70, 40, 390, P.vig, op(.12));
      S.rect(hx - 24, 36, hw + 60, 34, q.b(.5) ? P.roof : '#7A4A3A', op(.88)); S.rect(hx - 24, 70, hw + 60, 14, P.vig, op(.2)); // streha + senka
      S.rect(hx - 24, 62, hw + 60, 8, mix(P.roof, P.vig, .3));
      const B = winBatch(); for (let f = 0; f < 2; f++) for (let c = 0; c < 2; c++) B.list.push({ x: hx + 50 + c * 150, y: 110 + f * 125, w: 62, h: 72, row: f + 1, col: c, b: 0, lit: q.b(.3) });
      const br = pickBrand(q, B.list); for (const w of B.list) { if (w === br) continue; if (w.lit) B.lit += RP(w.x, w.y, w.w, w.h); else B.g[2] += RP(w.x, w.y, w.w, w.h); B.sill += RP(w.x - 4, w.y + w.h, w.w + 8, 6); B.rev += RP(w.x, w.y, w.w, 4); } flushWins(S, B); if (br) brandWin(S, br);
      S.rect(hx + 70, 350, 64, 110, P.roof); S.rect(hx + 64, 340, 76, 8, P.lit); S.rect(hx + 60, 336, 84, 5, P.roof, op(.8)); S.glow(hx + 102, 342, 40, P.lit, .4);   // vrata + lampa
      S.rect(hx + 150, 352, 70, 50, P.glass, op(.85)); S.rect(hx + 146, 402, 78, 5, P.roof, op(.45));                                                  // prizemni prozor
      const tc = mix(P.ground, PAPER, .3);
      S.poly([[hx - 60, 460], [860, 460], [860, 540], [hx - 140, 540]], tc);                                                                            // terasa
      dd = ''; for (let i = 1; i < 5; i++) { const t = i / 5; dd += `M${N(hx - 60 - 80 * t)} ${N(460 + 80 * t)}H860`; } for (let i = 1; i < 8; i++) dd += `M${N(hx - 60 + i * 50)} 460L${N(hx - 140 + i * 50)} 540`;
      S.lines(dd, P.vig, 1, op(.12));
      S.rect(hx - 60, 458, 440, 4, mix(tc, P.vig, .25));
      if (q.b(.75)) { const tx = q.i(200, 360); S.ell(tx, 500, 80, 14, P.vig, op(.1)); S.rect(tx - 2, 300, 4, 200, P.roof, op(.85)); S.poly([[tx - 110, 318], [tx + 110, 318], [tx, 270]], q.p([PAPER, '#C9B9A3', '#8A9A84']), op(.95)); S.ell(tx, 460, 58, 13, mix(PAPER, P.ground, .3)); S.rect(tx - 2, 460, 4, 36, P.roof, op(.8)); S.rect(tx - 90, 452, 30, 34, mix(P.roof, P.wall[2], .3), ` rx='3'`); S.rect(tx + 60, 452, 30, 34, mix(P.roof, P.wall[2], .3), ` rx='3'`); }
      if (q.b(.5)) { S.rect(90, 380, 160, 40, mix(P.roof, '#8C9A6E', .3), ` rx='3'`); S.rect(100, 360, 140, 22, mix(P.roof, '#8C9A6E', .3), ` rx='3'`); }   // ležaljka/klupa
      S.rect(0, hz + 10, hx - 20, 4, PAPER, op(.6)); dd = ''; for (let x = 0; x < hx - 20; x += 12) dd += RP(x, hz - 6, 8, 40); S.path(dd, PAPER, op(.8));   // ograda
      dd = ''; for (let x = 0; x < W; x += 9) dd += `M${x} ${H}l4 -16l4 16z`; S.path(dd, mix(g1, P.tree, .4), op(.6));                    // trava
      tree(S, q, q.i(80, 200), hz + 90, q.f(1.5, 2.1)); tree(S, q, q.i(380, 500), hz + 60, q.f(.9, 1.3), 1);
      if (q.b(.5)) tree(S, q, q.i(220, 340), hz + 20, q.f(.7, 1), 1);
      plant(S, q, 700, 560, 1.2);
      if (mir) S.add('</g>');
    } else {
      // tri varijante placa: 0 njiva + zemljani put + ograda · 1 livada bez puta (šupa, bale) · 2 voćnjak u redovima + put
      const lv = ctx.landVar || 0;
      const vx = lv === 1 ? q.i(300, 500) : q.i(380, 640);
      if (lv !== 1) { // brazde u perspektivi
        dd = ''; for (let i = -8; i <= 16; i++) dd += `M${N(vx + i * 110)} ${H}L${N(vx + i * 10)} ${hz + 10}`;
        S.lines(dd, P.vig, 1, op(.1));
      }
      if (lv !== 1) { // zemljani put
        const rw = q.i(120, 200);
        S.poly([[vx - 4, hz + 4], [vx + 6, hz + 4], [vx + rw, H], [vx - rw + 30, H]], mix(P.ground, '#C9B48A', .5), op(.95));
        S.poly([[vx, hz + 20], [vx + 3, hz + 20], [vx + 24, H], [vx + 8, H]], g1, op(.6));
      }
      // strana ograde/voćnjaka (fl=1 desno) — parcela ide na SUPROTNU stranu puta da je stubovi ne seku
      const fl = vx > 500 ? 0 : 1; const fx0 = fl ? W - 40 : 40, fx1 = fl ? vx + 60 : vx - 60;
      if (lv === 0) { // ograda + stubovi
        dd = ''; const nP = q.i(6, 10); for (let i = 0; i < nP; i++) { const t = i / (nP - 1); const x = fx0 + t * (fx1 - fx0), y = hz + 30 + t * 150, s = .6 + t; dd += RP(x, y - 40 * s, 5 * s, 40 * s); }
        S.path(dd, mix(P.roof, '#C9B48A', .4), op(.9));
        S.lines(`M${fx0} ${hz + 10}L${fx1} ${hz + 110}M${fx0} ${hz + 20}L${fx1} ${hz + 140}`, mix(P.roof, '#C9B48A', .4), 1.5, op(.6));
      } else if (lv === 1) { // daleka ograda duž horizonta
        dd = ''; for (let x = 20; x < W; x += 36) dd += RP(x, hz + 14, 3, 22); S.path(dd, mix(P.roof, '#C9B48A', .4), op(.7));
        S.rect(0, hz + 22, W, 1.5, mix(P.roof, '#C9B48A', .4), op(.5));
      } else { // voćnjak: dva reda stabala u perspektivi
        for (let r2 = 0; r2 < 2; r2++) for (let i = 0; i < 5; i++) { const t = i / 4; const x = fx0 + t * (fx1 - fx0) + (fl ? 1 : -1) * r2 * (40 + 70 * t), y = hz + 16 + t * 170 + r2 * 10, sc = .3 + t * .55; if (x > 0 && x < W) tree(S, q, x, y, sc, (i + r2) % 2); }
      }
      // katastarska parcela (brend element): na strani bez ograde, temena unutar 60–740 × ≤ 560
      const px0 = lv === 1 ? 170 : (fl ? 60 : vx + 60), px1 = lv === 1 ? 630 : (fl ? vx - 60 : W - 60);
      const yb = Math.min(560, hz + 230), clampP = (p) => [Math.max(60, Math.min(740, p[0])), Math.max(hz + 28, Math.min(560, p[1]))];
      const px = [[px0 + q.i(20, 60), hz + q.i(40, 70)], [px1 - q.i(0, 40), hz + q.i(30, 60)], [px1 + q.i(-20, 20), yb - q.i(0, 30)], [px0 + q.i(-10, 30), yb - q.i(0, 20)]].map(clampP);
      S.poly(px, PINE, op(.1));
      S.add(`<path d='M${px.map((p) => N(p[0]) + ' ' + N(p[1])).join('L')}z' fill='none' stroke='${PINE}' stroke-width='2.5' stroke-dasharray='12 7'/>`);
      for (const p of px) S.circle(p[0], p[1], 4.5, PINE);
      // detalji: šupa, bale, bandera (šupa i bandera na strani ograde, dalje od parcele)
      if (lv === 1 || q.b(.4)) { const sx = lv === 1 ? q.i(60, 120) : fl ? q.i(560, 700) : q.i(80, 240); S.rect(sx, hz - 26, 60, 36, mix(P.roof, P.wall[2], .5)); S.poly([[sx - 6, hz - 26], [sx + 30, hz - 50], [sx + 66, hz - 26]], P.roof, op(.85)); S.rect(sx + 24, hz - 10, 12, 20, P.roof); }
      if (lv === 1 || q.b(.4)) for (let i = 0; i < (lv === 1 ? 5 : 3); i++) { const bx = q.i(60, 740), by = hz + 100 + q.i(0, 120), s = .6 + (by - hz) / 200; S.ell(bx, by, 22 * s, 13 * s, mix('#C9B48A', P.lit, .3)); S.ell(bx, by, 22 * s, 13 * s, P.vig, op(.12)); }
      if (lv !== 2 && q.b(.6)) { const bx = fl ? q.i(600, 740) : q.i(100, 300); S.rect(bx, hz - 110, 4, 170, P.roof, op(.8)); S.rect(bx - 14, hz - 104, 32, 3, P.roof, op(.8)); S.lines(`M${bx - 14} ${hz - 104}L${fl ? 800 : 0} ${hz - 70}M${bx + 18} ${hz - 104}L${fl ? 800 : 0} ${hz - 80}`, P.roof, 1, op(.4)); }
      const nt = lv === 2 ? q.i(1, 2) : q.i(2, 4); for (let i = 0; i < nt; i++) tree(S, q, q.i(20, 780), hz + q.i(10, 60), q.f(.7, 1.4), i % 2);
      S.glow(q.i(520, 740), hz, 200, P.lit, .2);
    }
    finish(S, .32);
  }

  function garage(S, q, ctx) {
    const P = S.P;
    if (ctx.idx % 2 === 0 && !ctx.l) ctx.idx = 1;
    const outside = ctx.idx % 2 === 0;
    const doorC = q.p(['#CFCBC3', '#C9C2B4', '#8A9A84', mix(P.roof, PAPER, .5), '#B7B0A4']);
    const num = 'G ' + (1 + (H32(ctx.seed) % 40));
    const rollDoor = (dx, dy, dw, dh) => { S.rect(dx - 12, dy - 12, dw + 24, dh + 12, P.roof); S.rect(dx, dy, dw, dh, doorC); let dd = ''; for (let y = dy + 18; y < dy + dh; y += 18) dd += RP(dx, y, dw, 1); S.path(dd, P.roof, op(.35)); S.rect(dx, dy, dw, dh, P.vig, op(.06)); S.rect(dx + dw / 2 - 30, dy + dh - 50, 60, 10, P.roof, op(.8)); };
    if (outside) {
      skyAndSun(S, q, HZ, .45);
      farRow(S, q, HZ, 30, 120, .9);
      S.rect(0, HZ, W, H - HZ, mix(P.ground, P.vig, .1));
      // zid objekta sa garažama
      const wall = q.p([P.wall[1], P.wall[2], '#B9B5AD', P.wall[0]]);
      const top = HZ - q.i(300, 340);
      S.rect(-20, top, W + 40, HZ - top, wall); S.rect(-20, top, 120, HZ - top, P.vig, op(.12)); S.rect(-20, top, W + 40, 10, P.roof, op(.85)); S.rect(-20, top + 10, W + 40, 6, mix(wall, P.vig, .25));
      const nD = q.i(1, 3), dw = nD === 1 ? 300 : nD === 2 ? 250 : 200, gap = (W - nD * dw) / (nD + 1);
      for (let i = 0; i < nD; i++) { const dx = gap + i * (dw + gap); rollDoor(dx, HZ - 200, dw, 200); S.rect(dx + dw / 2 - 20, HZ - 230, 40, 20, PAPER); S.text(dx + dw / 2, HZ - 215, String(1 + ((H32(ctx.seed) + i) % 40)), ` font-family='Hanken Grotesk,Arial,sans-serif' font-weight='600' font-size='14' fill='${INK}' text-anchor='middle'`); S.poly([[dx, HZ], [dx + dw, HZ], [dx + dw + 30, H], [dx - 30, H]], mix(P.ground, PAPER, .2)); S.glow(dx + dw / 2, HZ - 236, 50, P.lit, .35); }
      // red prozora u zidu iznad vrata: iznad svakih vrata i u svakom razmaku; brend prozor je jedan od njih (u razmaku)
      const side = q.b(.5), wy = top + 26, cx = [];
      for (let i = 0; i <= nD; i++) { cx.push({ x: gap / 2 + i * (dw + gap), g: true }); if (i < nD) cx.push({ x: gap + i * (dw + gap) + dw / 2, g: false }); }
      const bwi = q.p(cx.map((c, i) => c.g ? i : -1).filter((i) => i >= 0));
      cx.forEach((c, i) => { const wxx = N(c.x - 30); winFrame(S, wxx, wy, 60, 46); if (i === bwi) brandWin(S, { x: wxx, y: wy, w: 60, h: 46 }); else S.rect(wxx, wy, 60, 46, q.b(.25) ? P.lit : P.glass, op(.85)); winBars(S, wxx, wy, 60, 46); });
      S.rect(0, HZ, W, H - HZ, mix(P.ground, PAPER, .14));
      S.rect(0, HZ, W, 20, P.vig, op(.08));
      lamp(S, side ? 740 : 60, HZ + 10, 120);
      if (q.b(.6)) car(S, q, q.i(40, 600), HZ + 70, q.p([P.roof, P.glass, PAPER, '#8E8C86']));
      tree(S, q, side ? q.i(720, 790) : q.i(10, 80), HZ + 20, q.f(1, 1.4));
      S.rect(0, H - 60, W, 60, P.vig, op(.08));
      finish(S, .36);
      return;
    }
    S.rect(0, 0, W, H, q.p(['#B9B5AD', '#BDB8AE', '#B2AEA6']));
    let dd = ''; for (let y = 60; y < 400; y += 60) dd += RP(0, y, W, 1); S.path(dd, P.vig, op(.1));
    S.poly([[0, 0], [110, 70], [110, 420], [0, 500]], P.vig, op(.16));                      // levi zid
    S.poly([[0, 0], [W, 0], [W, 70], [110, 70]], P.vig, op(.12));                            // plafon
    S.rect(0, 420, W, 180, mix(P.ground, P.vig, .18));
    dd = ''; for (let i = -4; i <= 12; i++) dd += `M${N(100 + i * 110)} ${H}L${N(400 + i * 40)} 420`; S.lines(dd, P.vig, 1, op(.1));
    S.rect(110, 416, W, 6, P.roof, op(.35));
    if (q.b(.6)) { S.rect(300, 520, 200, 10, P.roof, op(.5)); dd = ''; for (let x = 306; x < 500; x += 10) dd += RP(x, 522, 4, 6); S.path(dd, '#B9B5AD'); }   // rešetka
    if (q.b(.5)) S.ell(q.i(200, 600), 560, 50, 14, P.vig, op(.14));                                                                                     // mrlja
    const dw = q.i(380, 460), dx = 180 + (440 - dw) / 2 + q.i(-20, 40), dy = 100 + q.i(0, 30), dh = 420 - dy;
    rollDoor(dx, dy, dw, dh);
    S.text(dx + dw / 2, dy + 70, num, ` font-family='Hanken Grotesk,Arial,sans-serif' font-weight='700' font-size='44' fill='${P.roof}' text-anchor='middle'${op(.8)}`);
    const lx = dx + dw / 2 + q.i(-100, 100);
    S.glow(lx, 56, 90, P.lit, .5); S.rect(lx - 20, 44, 40, 10, P.roof); S.rect(lx - 16, 54, 32, 4, P.lit);
    const bwx = Math.min(dx + dw + 40, 720);   // dva visoka prozora na zidu: mat staklo + brend prozor
    winFrame(S, bwx - 80, 150, 60, 46); S.rect(bwx - 80, 150, 60, 46, mix(P.sky[1], '#ffffff', .3), op(.85)); winBars(S, bwx - 80, 150, 60, 46);
    winFrame(S, bwx, 150, 60, 46); brandWin(S, { x: bwx, y: 150, w: 60, h: 46 }, false); winBars(S, bwx, 150, 60, 46);
    // police, kante, gume, bicikl
    if (q.b(.6)) { S.rect(40, 290, 60, 130, P.roof, op(.55)); S.rect(46, 300, 48, 110, '#9A9B98', op(.6)); }
    else { S.rect(30, 230, 70, 190, P.roof, op(.5)); dd = ''; for (let i = 0; i < 4; i++) dd += RP(34, 240 + i * 46, 62, 3); S.path(dd, PAPER, op(.6)); S.rect(40, 250, 18, 28, P.lit, op(.6)); S.rect(66, 300, 22, 20, '#8A9A84'); }
    S.rect(110, 360, 40, 60, mix(P.roof, '#8A9A84', .4)); S.rect(118, 350, 24, 10, P.roof);
    if (q.b(.5)) for (let i = 0; i < 3; i++) S.circle(dx + dw + 60, 400 - i * 26, 22, P.vig, op(.7));
    if (q.b(.5)) { const bx = dx + dw + 30; S.add(`<circle cx='${bx}' cy='400' r='24' fill='none' stroke='${P.roof}' stroke-width='3' opacity='.8'/><circle cx='${bx + 70}' cy='400' r='24' fill='none' stroke='${P.roof}' stroke-width='3' opacity='.8'/><path d='M${bx} 400L${bx + 30} 360L${bx + 70} 400M${bx + 30} 360L${bx + 50} 360L${bx + 35} 400z' fill='none' stroke='${P.roof}' stroke-width='3' opacity='.8'/>`); }
    S.lin('cv', P.vig, P.vig, .4, 0); S.rect(0, 0, W, 120, 'url(#cv)');
    finish(S, .4);
  }

  function office(S, q, ctx) {
    const P = S.P;
    skyAndSun(S, q, HZ, .45);
    farRow(S, q);
    street(S, q);
    // tri kompozicije: uska kula (vidljivo nebo, viši susedi) / široka niska lamela (4–6 etaža) / ugaona, pomerena zgrada
    const comp = q.p(['tower', 'slab', 'corner']);
    const LOB = 60;
    let bw, fh, floors;
    if (comp === 'tower') { bw = q.i(260, 360); fh = q.i(28, 32); floors = q.i(9, 11); }
    else if (comp === 'slab') { bw = q.i(480, 620); fh = q.i(44, 50); floors = q.i(4, 6); }
    else { bw = q.i(360, 450); fh = q.i(36, 42); floors = q.i(6, 8); }
    const minTop = MIN_TOP + (comp === 'slab' ? 40 : 0);
    floors = Math.max(3, Math.min(floors, Math.floor((HZ - minTop - LOB - 10) / fh)));   // krov uvek ≥ 12 % od vrha
    const bx = comp === 'corner' ? (q.b(.5) ? q.i(30, 90) : W - bw - q.i(30, 90)) : N((W - bw) / 2 + q.i(-70, 70));
    const top = HZ - floors * fh - LOB - 10;
    const style = q.p(['curtain', 'spandrel', 'ribbon']);   // staklena zavesa / parapetne ploče / trakasti prozori
    const spC = q.p([P.wall[2], P.wall[1], mix(P.roof, P.wall[2], .5), P.wall[0]]);
    // susedi: 1–2, nasumične širine, visine, boje zida; kod kule viši od obične lamele
    const nN = q.i(1, 2), leftN = q.b(.5);
    for (let i = 0; i < nN; i++) {
      const side = i === 0 ? leftN : !leftN;
      const nw = q.i(120, 260), nh = comp === 'tower' ? q.i(200, Math.min(330, HZ - MIN_TOP - 20)) : q.i(130, 250);
      const nx = side ? bx - nw + q.i(-20, 30) : bx + bw + q.i(-30, 20);
      const wall = q.p([P.wall[0], P.wall[1], P.wall[3], P.wall[2]]), old = q.b(.4), ntop = HZ - nh;
      S.rect(nx, ntop, nw, nh, wall); S.rect(nx, ntop, nw * .12, nh, P.vig, op(.12)); S.rect(nx, ntop, nw, old ? 10 : 6, P.roof, op(.85));
      const cw = old ? 50 : 40, ch = old ? 58 : 44, cols = Math.max(2, Math.floor((nw - 20) / cw)), rows = Math.max(1, Math.floor((nh - 70) / ch)), mg = (nw - cols * cw) / 2;
      let g = '', lit = '', sill = '', corn = '';
      for (let r2 = 0; r2 < rows; r2++) for (let c = 0; c < cols; c++) {
        const x = nx + mg + c * cw + (old ? 13 : 7), y = ntop + 20 + r2 * ch, w = old ? 24 : 26, h = old ? 34 : 24;
        if (q.b(.22)) lit += RP(x, y, w, h); else g += RP(x, y, w, h);
        if (old) sill += RP(x - 3, y + h, w + 6, 4);
        if (old && c === 0 && r2 < rows - 1) corn += RP(nx, y + h + 12, nw, 3);
      }
      S.path(g, P.glass, op(.78)); if (lit) S.path(lit, P.lit); if (sill) S.path(sill, P.roof, op(.45)); if (corn) S.path(corn, P.roof, op(.25));
      S.rect(nx, HZ - 50, nw, 50, mix(wall, P.vig, .1));
    }
    shadowLeft(S, bx, bw, HZ, 1.3);
    // glavna zgrada
    S.rect(bx, top, bw, HZ - top, style === 'curtain' ? P.glass : spC, op(.92));
    if (style === 'curtain') { S.lin('gl', '#ffffff', '#ffffff', .18, .02, false); S.rect(bx, top, bw, HZ - top, 'url(#gl)'); }
    const bayW = comp === 'tower' ? q.i(44, 60) : q.i(60, 84);
    const bays = Math.max(3, Math.floor(bw / bayW)), bwid = bw / bays;
    const brandBay = { c: q.i(1, bays - 2), f: q.i(1, Math.max(1, floors - 2)) };   // nikad gornji ni poslednji red
    let lit = '', dd = '';
    for (let f = 0; f < floors; f++) {
      const y0 = top + 10 + f * fh;
      const inset = style === 'curtain' ? 4 : style === 'spandrel' ? Math.round(fh * .3) : Math.round(fh * .22);
      const y = y0 + inset, h = fh - inset - (style === 'ribbon' ? 4 : 6);
      if (style === 'ribbon') S.rect(bx + 4, y, bw - 8, h, P.glass, op(.85));   // trakasti prozor preko cele etaže
      for (let c = 0; c < bays; c++) {
        const x = bx + c * bwid + 3, w = bwid - 6;
        if (c === brandBay.c && f === brandBay.f) { S.glow(x + w / 2, y + h / 2, 60, MINT, .18); S.rect(x, y, w, h, PINE, op(.85)); S.add(`<rect x='${N(x + 1)}' y='${N(y + 1)}' width='${N(w - 2)}' height='${N(h - 2)}' fill='none' stroke='${MINT}' stroke-width='1.5'/>`); }
        else if (style === 'spandrel') { if (q.b(.3)) lit += RP(x, y, w, h); else dd += RP(x, y, w, h); }
        else if (q.b(.3)) lit += RP(x, y, w, h); else if (q.b(.3)) dd += RP(x, y, w, h);
      }
    }
    if (style === 'spandrel') S.path(dd, P.glass, op(.88)); else S.path(dd, '#ffffff', op(.08));
    S.path(lit, P.lit, op(.85));
    // ploče etaža + stubovi (mulioni)
    dd = ''; const sh = style === 'curtain' ? 6 : 3;
    for (let f = 0; f <= floors; f++) dd += RP(bx, top + 10 + f * fh - sh / 2, bw, sh);
    S.path(dd, style === 'curtain' ? P.haze : P.roof, op(style === 'curtain' ? .9 : .3));
    if (style !== 'ribbon') { dd = ''; for (let c = 1; c < bays; c++) dd += RP(bx + c * bwid, top, 1, HZ - top - LOB); S.path(dd, style === 'curtain' ? P.haze : P.roof, op(.35)); }
    S.rect(bx, top, bw, 10, P.roof, op(.85)); S.rect(bx, top, bw * .12, HZ - top, P.vig, op(.14));
    if (comp === 'tower' && q.b(.5)) S.rect(bx + bw * .25, top - 16, bw * .5, 16, P.roof, op(.7));   // krovna kućica (mašinska)
    // lobi: svetla traka, staklo, ulaz (kod ugaone kompozicije pomeren), natpisi
    S.rect(bx, HZ - LOB, bw, LOB, P.lit, op(.5)); S.rect(bx, HZ - LOB, bw, 6, P.roof, op(.6));
    dd = ''; for (let x = bx + 60; x < bx + bw - 30; x += 60) dd += RP(x, HZ - LOB + 6, 2, LOB - 6); S.path(dd, P.roof, op(.3));
    const doorX = N(bx + bw / 2 - 40 + (comp === 'corner' ? q.i(-80, 80) : q.i(-20, 20)));
    S.rect(doorX, HZ - 54, 80, 54, P.glass, op(.6)); S.rect(doorX + 39, HZ - 54, 2, 54, P.roof);
    S.rect(doorX - 10, HZ - 58, 100, 4, P.roof, op(.8));
    S.rect(bx + 24, HZ - 40, q.i(60, 110), 16, P.roof, op(.8));
    const sgx = bx + bw - 140; S.rect(sgx, HZ - 40, 110, 16, P.roof, op(.8)); S.rect(sgx + 6, HZ - 36, 26, 8, MINT, op(.9));
    // ulica: lampa bilo gde osim ispred ulaza, 0–2 automobila, 2–4 krošnje
    const lxs = []; for (let x = 60; x <= 740; x += 20) if (x < doorX - 50 || x > doorX + 130) lxs.push(x);
    lamp(S, q.p(lxs), HZ + 26);
    const nc = q.i(0, 2); for (let i = 0; i < nc; i++) car(S, q, q.i(40, 660), HZ + 52 + q.i(0, 14), q.p([P.roof, P.glass, PAPER, '#8E8C86', P.haze]));
    const nt = q.i(2, 4); for (let i = 0; i < nt; i++) tree(S, q, q.i(20, 780), HZ + 24 + q.i(0, 24), q.f(.7, 1.3), i % 2);
    finish(S, .34);
  }

  /* ─── scena po vrsti ─── */
  function subFor(l, q) {
    const co = l.co || '';
    if (co === 'novogradnja' || co === 'u-izgradnji' || (co === 'lux' && q.b(.6))) return 'nova';
    if (l.y && l.y < 1950) return 'stara';
    if (/novi-beograd|blok|cerak|vidikovac|liman|banovo|bezanij/.test((l.ms || '') + ' ' + (l.ns || '') + ' ' + (l.n || '').toLowerCase())) return q.b(.75) ? 'blok' : 'nova';
    if (l.y && l.y >= 2005) return q.b(.8) ? 'nova' : 'blok';
    return q.p(l.y && l.y < 1985 ? ['blok', 'stara', 'blok'] : ['blok', 'nova', 'stara']);
  }
  function paletteFor(seed) { const r = RNG(H32(String(seed))); return [PAL.A, PAL.B, PAL.C][Math.floor(r() * 3)]; }
  function scene(seed, kind, idx = 0, l = null) {
    const P = paletteFor(seed);
    const q = R(RNG(H32(seed + '#' + idx)));
    const S = mk(P);
    const ctx = { seed, l, idx, sub: l ? subFor(l, q) : q.p(['blok', 'nova', 'stara']), vik: l && l.pt === 'vikendica', office: kind === 'office-interior', backyard: kind === 'backyard', landVar: kind === 'land' ? idx % 3 : 0 };
    switch (kind) {
      case 'house': house(S, q, ctx); break;
      case 'living': case 'office-interior': living(S, q, ctx); break;
      case 'kitchen': kitchen(S, q, ctx); break;
      case 'bedroom': bedroom(S, q, ctx); break;
      case 'bath': bath(S, q, ctx); break;
      case 'balcony': balcony(S, q, ctx); break;
      case 'entrance': entrance(S, q, ctx); break;
      case 'land': case 'backyard': land(S, q, ctx); break;
      case 'garage': garage(S, q, ctx); break;
      case 'office': office(S, q, ctx); break;
      default: facade(S, q, ctx);
    }
    return S;
  }
  function kinds(l) {
    const set = SETS[l.pt] || SETS.stan, n = Math.max(1, l.im || set.length);
    const out = []; for (let i = 0; i < n; i++) out.push(set[i % set.length]);
    return out;
  }
  function altFor(l, idx, kind) { return `${l.ti || 'Nekretnina'} — ${KIND_ALT[kind] || 'fotografija'} (${idx + 1}/${Math.max(1, l.im || 1)})`; }
  function src(l, idx = 0, o = {}) {
    const a = VB[o.aspect] || VB['4:3'];
    const kind = kinds(l)[idx % kinds(l).length];
    const S = scene(l.s, kind, idx, l);
    return uri(S.out(`${a[0]} ${a[1]} ${a[2]} ${a[3]}`, altFor(l, idx, kind), o.w || a[4], o.w ? N(o.w * a[5] / a[4]) : a[5]));
  }
  function external(l, idx, aspect) {
    const a = VB[aspect] || VB['4:3']; const kind = kinds(l)[idx % kinds(l).length];
    const tag = /facade|house|office$|entrance|land|backyard|garage|balcony/.test(kind) ? 'building,house' : 'apartment,interior';
    return `https://loremflickr.com/${a[4]}/${a[5]}/${tag}?lock=${H32(l.s + '#' + idx) % 100000}`;
  }
  function el(l, idx = 0, o = {}) {
    const a = VB[o.aspect] || VB['4:3'];
    const kind = kinds(l)[idx % kinds(l).length];
    const im = document.createElement('img');
    im.loading = 'lazy'; im.decoding = 'async';
    im.width = a[4]; im.height = a[5];
    im.alt = o.alt != null ? o.alt : altFor(l, idx, kind);
    if (o.cls) im.className = o.cls;
    im.dataset.kind = kind;
    const gen = () => src(l, idx, o);
    if (window.KV_CONFIG.externalPhotos && /github\.io$/.test(location.hostname)) {
      im.src = external(l, idx, o.aspect);
      im.onerror = () => { im.onerror = null; im.src = gen(); };
    } else im.src = gen();
    return im;
  }

  /* ─── hero: fasada 4:5, paleta A ─── */
  function hero() {
    const P = PAL.A; const q = R(RNG(H32('kvadrat-hero')));
    const S = mk(P); S.top = -240; S.minTop = -200;   // 4:5 kadar (viewBox od y=-140) ima svoje nebo, bez ograničenja krova
    facade(S, q, { seed: 'hero', sub: 'stara' }, { litRate: .35, sunOp: .6, sunX: 560, extraFloors: 2 });
    // jača izmaglica + lampa u sredini
    S.b.splice(S.b.length - 2, 0, `<rect x='0' y='-240' width='800' height='840' fill='${P.haze}' opacity='.12'/>`);
    const s = S.out('100 -140 600 750', 'Oglas nedelje — fasada zgrade u zlatni sat', 800, 1000).replace(/ width='800' height='1000'/, '').replace(/id='([a-z]+\d*)'/g, "id='kvh-$1'").replace(/url\(#([a-z]+\d*)\)/g, 'url(#kvh-$1)');
    return s;
  }

  /* ─── gradovi: siluete sa prepoznatljivim motivima ─── */
  const LANDMARKS = {
    beograd: ['river', 'pylon', 'dome', 'genex'], 'novi-sad': ['river', 'fortress-clock', 'church'], nis: ['river', 'fortress-gate', 'church'], kragujevac: ['hills', 'church', 'chimney'],
    subotica: ['cityhall', 'church'], pancevo: ['river', 'chimney', 'church'], cacak: ['hills', 'church'], 'novi-pazar': ['hills', 'minaret', 'minaret'], zrenjanin: ['river', 'cityhall'], kraljevo: ['hills', 'church'],
    leskovac: ['hills', 'church'], krusevac: ['tower', 'church'], smederevo: ['river', 'fortress-wall'], sabac: ['river', 'church'], valjevo: ['hills', 'bridge'], uzice: ['steep', 'tower'],
    'sremska-mitrovica': ['river', 'church'], vranje: ['hills', 'church'], loznica: ['hills', 'church'], sombor: ['cityhall', 'trees'], pozarevac: ['church', 'trees'], jagodina: ['hills', 'church'],
    kikinda: ['cityhall', 'silo'], zajecar: ['hills', 'church'], paracin: ['church', 'chimney'], pirot: ['hills', 'fortress-wall'], ruma: ['church', 'trees'], vrsac: ['hill-tower', 'church'],
    arandjelovac: ['hills', 'pavilion'], prokuplje: ['hills', 'church'], bor: ['hills', 'chimney', 'chimney'], zlatibor: ['mountain', 'chalet'], 'vrnjacka-banja': ['hills', 'pavilion', 'bridge'], kopaonik: ['mountain', 'chalet', 'lift'],
  };
  function city(slug) {
    const P = paletteFor('city:' + slug); const q = R(RNG(H32('city:' + slug)));
    const S = mk(P); const CW = 800, CH = 500, hz = 340;
    const marks = LANDMARKS[slug] || ['hills', 'church'];
    const mountain = marks.includes('mountain'), steep = marks.includes('steep');
    S.lin('s', P.sky[0], P.sky[1]); S.rect(0, 0, CW, hz + 20, 'url(#s)');
    S.glow(q.i(560, 740), hz - 20, 300, P.lit, .5);
    if (mountain) { S.poly([[0, hz], [120, hz - 180], [260, hz - 90], [420, hz - 230], [560, hz - 120], [700, hz - 200], [800, hz - 110], [800, hz]], mix(P.haze, P.glass, .25), op(.9)); S.poly([[300, hz - 90], [420, hz - 230], [500, hz - 150]], PAPER, op(.5)); S.poly([[0, hz], [200, hz - 100], [360, hz - 40], [520, hz - 130], [800, hz - 60], [800, hz]], mix(P.tree, P.haze, .3), op(.95)); }
    else if (marks.includes('hills') || steep) { S.poly([[0, hz - 30], [180, hz - 120], [360, hz - 60], [540, hz - (steep ? 190 : 140)], [700, hz - 80], [800, hz - 120], [800, hz], [0, hz]], P.haze, op(.9)); S.poly([[0, hz - 10], [220, hz - 60], [400, hz - 30], [620, hz - 80], [800, hz - 40], [800, hz], [0, hz]], mix(P.haze, P.tree, .25), op(.9)); }
    else farRow(S, q, hz, 30, 120, .9);
    // glavni red zgrada
    const B = winBatch(); let x = -20;
    const dense = ['beograd', 'novi-sad', 'nis'].includes(slug);
    while (x < CW + 20) {
      const bw = q.i(50, dense ? 150 : 110), bh = q.i(mountain ? 30 : 50, dense ? 230 : steep ? 120 : 160);
      const wall = q.p(P.wall); S.rect(x, hz - bh, bw, bh, wall); S.rect(x, hz - bh, bw * .12, bh, P.vig, op(.12)); S.rect(x, hz - bh, bw, 5, P.roof, op(.8));
      if (mountain) { S.poly([[x - 6, hz - bh], [x + bw / 2, hz - bh - 40], [x + bw + 6, hz - bh]], P.roof, op(.85)); }
      const cols = Math.floor((bw - 10) / 22), rows = Math.floor((bh - 14) / 28);
      for (let r2 = 0; r2 < rows; r2++) for (let c = 0; c < cols; c++) B.list.push({ x: x + 8 + c * 22, y: hz - bh + 12 + r2 * 28, w: 12, h: 16, row: r2, col: c, b: x, lit: q.b(.25) });
      x += bw + q.i(0, 10);
    }
    const br = pickBrand(q, B.list);
    for (const w of B.list) { if (w === br) continue; if (w.lit) B.lit += RP(w.x, w.y, w.w, w.h); else B.g[q.i(0, 3)] += RP(w.x, w.y, w.w, w.h); }
    flushWins(S, B); if (br) brandWin(S, br, true);
    // motivi
    let mx = q.i(120, 300);
    for (const m of marks) {
      const base = hz;
      if (m === 'river') { continue; }
      if (m === 'dome') { S.rect(mx - 70, base - 120, 140, 120, P.wall[3]); S.rect(mx - 70, base - 120, 16, 120, P.vig, op(.12)); S.add(`<path d='M${mx - 60} ${base - 120}a60 60 0 0 1 120 0z' fill='#5E7A6A'/>`); S.rect(mx - 2, base - 210, 4, 36, P.lit); S.rect(mx - 10, base - 200, 20, 3, P.lit); for (let i = 0; i < 4; i++) S.rect(mx - 50 + i * 30, base - 90, 14, 40, P.glass, op(.8)); S.rect(mx - 110, base - 70, 40, 70, P.wall[3]); S.rect(mx + 70, base - 70, 40, 70, P.wall[3]); }
      else if (m === 'pylon') { const px = q.i(520, 640); S.rect(px - 8, base - 300, 16, 300, PAPER, op(.95)); let dd = ''; for (let i = 1; i < 9; i++) dd += `M${px} ${base - 290 + i * 20}L${px + 40 + i * 30} ${base - 30}M${px} ${base - 290 + i * 20}L${px - 40 - i * 30} ${base - 30}`; S.lines(dd, PAPER, 1, op(.8)); S.rect(px - 300, base - 34, 600, 8, P.roof, op(.85)); }
      else if (m === 'genex') { const gx = 680; S.rect(gx, base - 260, 46, 260, P.wall[1]); S.rect(gx + 70, base - 300, 46, 300, P.wall[1]); S.rect(gx + 40, base - 290, 36, 24, P.wall[2]); S.circle(gx + 93, base - 312, 22, P.roof, op(.85)); let dd = ''; for (let i = 0; i < 20; i++) dd += RP(gx + 8, base - 250 + i * 12, 30, 4) + RP(gx + 78, base - 290 + i * 14, 30, 4); S.path(dd, P.glass, op(.6)); }
      else if (m === 'fortress-clock') { const fx = 520; S.poly([[fx - 160, base], [fx - 100, base - 90], [fx + 140, base - 90], [fx + 200, base]], mix(P.wall[2], P.tree, .3)); S.rect(fx - 90, base - 120, 220, 30, P.wall[2]); let dd = ''; for (let i = 0; i < 9; i++) dd += RP(fx - 86 + i * 26, base - 128, 12, 8); S.path(dd, P.wall[2]); S.rect(fx - 14, base - 200, 28, 90, P.wall[3]); S.poly([[fx - 18, base - 200], [fx, base - 230], [fx + 18, base - 200]], P.roof); S.circle(fx, base - 180, 8, PAPER); S.rect(fx - 1, base - 186, 2, 6, P.roof); }
      else if (m === 'fortress-gate' || m === 'fortress-wall') { const fx = q.i(60, 200); S.rect(fx, base - 70, 300, 70, P.wall[2]); let dd = ''; for (let i = 0; i < 12; i++) dd += RP(fx + 4 + i * 26, base - 80, 14, 10); S.path(dd, P.wall[2]); for (let i = 0; i < 3; i++) S.rect(fx + i * 130, base - 110, 40, 110, mix(P.wall[2], P.vig, .15)); if (m === 'fortress-gate') S.add(`<path d='M${fx + 130} ${base}v-40a20 20 0 0 1 40 0v40z' fill='${P.vig}' opacity='.7'/>`); }
      else if (m === 'cityhall') { const cx = q.i(300, 480); S.rect(cx - 120, base - 110, 240, 110, P.wall[3]); S.rect(cx - 120, base - 110, 28, 110, P.vig, op(.12)); S.rect(cx - 24, base - 230, 48, 120, P.wall[3]); S.poly([[cx - 30, base - 230], [cx, base - 300], [cx + 30, base - 230]], '#5E7A6A'); S.rect(cx - 4, base - 310, 8, 14, P.roof); S.circle(cx, base - 250, 7, PAPER); let dd = ''; for (let i = 0; i < 7; i++) dd += RP(cx - 108 + i * 32, base - 90, 14, 30) + RP(cx - 108 + i * 32, base - 50, 14, 30); S.path(dd, P.glass, op(.75)); S.rect(cx - 120, base - 118, 240, 8, P.roof, op(.8)); }
      else if (m === 'church') { const cx = q.i(80, 720); S.rect(cx - 30, base - 90, 60, 90, P.wall[3]); S.rect(cx - 12, base - 160, 24, 70, P.wall[3]); S.poly([[cx - 16, base - 160], [cx, base - 210], [cx + 16, base - 160]], '#5E7A6A'); S.rect(cx - 1, base - 222, 2, 14, P.roof); S.rect(cx - 5, base - 218, 10, 2, P.roof); S.add(`<path d='M${cx - 6} ${base - 140}v-6a6 6 0 0 1 12 0v6z' fill='${P.glass}'/>`); }
      else if (m === 'minaret') { const cx = mx + q.i(0, 300); S.rect(cx - 5, base - 170, 10, 170, PAPER); S.rect(cx - 10, base - 130, 20, 6, P.roof); S.poly([[cx - 7, base - 170], [cx, base - 192], [cx + 7, base - 170]], P.roof); S.rect(cx - 40, base - 80, 80, 80, P.wall[3]); S.add(`<path d='M${cx - 30} ${base - 80}a30 30 0 0 1 60 0z' fill='#5E7A6A'/>`); }
      else if (m === 'tower') { const cx = q.i(200, 600); S.rect(cx - 26, base - 150, 52, 150, mix(P.wall[2], P.vig, .2)); S.rect(cx - 30, base - 160, 60, 10, P.roof); let dd = ''; for (let i = 0; i < 4; i++) dd += RP(cx - 20 + i * 12, base - 150, 6, 8); S.path(dd, P.roof); }
      else if (m === 'hill-tower') { S.poly([[400, base], [560, base - 220], [800, base - 120], [800, base]], mix(P.haze, P.tree, .4), op(.95)); S.rect(548, base - 290, 24, 72, P.wall[2]); S.rect(544, base - 296, 32, 6, P.roof); }
      else if (m === 'chimney') { const cx = q.i(500, 760); S.rect(cx, base - 220, 18, 220, mix(P.wall[2], P.vig, .25)); S.rect(cx - 2, base - 226, 22, 6, P.roof); S.ell(cx + 30, base - 250, 30, 14, PAPER, op(.35)); S.ell(cx + 70, base - 275, 40, 16, PAPER, op(.25)); }
      else if (m === 'silo') { for (let i = 0; i < 4; i++) S.rect(600 + i * 34, base - 140, 30, 140, mix(P.wall[1], PAPER, .3), ` rx='6'`); S.rect(596, base - 150, 140, 10, P.roof, op(.8)); }
      else if (m === 'chalet') { for (let i = 0; i < 3; i++) { const cx = 120 + i * 260 + q.i(-40, 40); S.rect(cx - 50, base - 60, 100, 60, '#8E6E52'); S.poly([[cx - 64, base - 60], [cx, base - 120], [cx + 64, base - 60]], P.roof, op(.9)); S.rect(cx - 10, base - 40, 20, 24, P.lit); } S.rect(0, base, CW, 160, '#8C9A6E', op(.5)); }
      else if (m === 'lift') { let dd = 'M60 ' + (base - 40) + 'L740 ' + (base - 300); S.lines(dd, P.roof, 1.5, op(.6)); for (let i = 0; i < 5; i++) { const t = i / 4; const x = 100 + t * 600, y = base - 50 - t * 250; S.rect(x - 2, y - 60, 4, 60, P.roof, op(.7)); S.rect(x - 8, y + 10, 16, 14, P.roof, ` rx='3'`); } }
      else if (m === 'pavilion') { const cx = q.i(240, 560); S.rect(cx - 70, base - 60, 140, 60, PAPER, op(.95)); S.poly([[cx - 84, base - 60], [cx, base - 100], [cx + 84, base - 60]], '#5E7A6A'); let dd = ''; for (let i = 0; i < 5; i++) dd += RP(cx - 60 + i * 30, base - 50, 6, 50); S.path(dd, P.wall[2]); }
      else if (m === 'bridge') { S.rect(0, base + 36, CW, 8, P.roof, op(.8)); S.add(`<path d='M60 ${base + 44}a60 40 0 0 1 120 0M180 ${base + 44}a60 40 0 0 1 120 0M300 ${base + 44}a60 40 0 0 1 120 0' fill='none' stroke='${P.wall[2]}' stroke-width='10'/>`); }
      else if (m === 'trees') { for (let i = 0; i < 6; i++) tree(S, q, q.i(0, 800), base + 10 + q.i(0, 20), q.f(.5, .9), i % 2); }
      mx += 180;
    }
    // tlo / reka
    if (marks.includes('river')) { S.lin('w', P.sky[1], P.sky[0], .9, 1); S.rect(0, hz, CW, CH - hz, '#C5D5DA'); S.rect(0, hz, CW, CH - hz, 'url(#w)', op(.5)); let dd = ''; for (let i = 0; i < 30; i++) dd += RP(q.i(0, 800), hz + 10 + q.i(0, 140), q.i(20, 80), 2); S.path(dd, PAPER, op(.45)); dd = ''; x = 0; while (x < CW) { const w = q.i(20, 60); dd += RP(x, hz, w, q.i(10, 60)); x += w; } S.path(dd, P.vig, op(.1)); S.rect(0, CH - 40, CW, 40, mix(P.ground, P.tree, .4)); }
    else { S.rect(0, hz, CW, CH - hz, mountain ? '#8C9A6E' : P.ground); if (!mountain) { S.rect(0, hz, CW, 24, mix(P.ground, '#ffffff', .15)); S.rect(0, hz + 23, CW, 3, P.roof, op(.3)); S.rect(0, hz + 26, CW, CH - hz - 26, mix(P.ground, P.vig, .15)); } for (let i = 0; i < 4; i++) tree(S, q, q.i(0, 800), hz + 30 + q.i(0, 40), q.f(.7, 1.2), i % 2); }
    S.lin('hz', P.haze, P.haze, 0, .5); S.rect(0, hz - 160, CW, 160, 'url(#hz)');
    // finiš na 800×500
    S.def(`<radialGradient id='v' r='.72'><stop offset='.55' stop-color='${P.vig}' stop-opacity='0'/><stop offset='1' stop-color='${P.vig}' stop-opacity='.32'/></radialGradient>`);
    S.def(`<filter id='g' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='.3 .3 .3 0 .25 .3 .3 .3 0 .25 .3 .3 .3 0 .25 0 0 0 0 .18'/></filter>`);
    S.rect(-10, -10, CW + 20, CH + 20, 'url(#v)'); S.rect(0, 0, CW, CH, '#000', ` filter='url(#g)' opacity='.5'`);
    const name = (typeof D !== 'undefined' && D && D.cities && (D.cities.find((c) => c.s === slug) || {}).n) || slug;
    return uri(S.out('0 0 800 500', 'Silueta grada — ' + name, 800, 500));
  }

  /* ─── članci: apstraktna editorijalna ilustracija ─── */
  function article(slug) {
    const a = (typeof D !== 'undefined' && D && D.articles && D.articles.find((x) => x.s === slug)) || { s: slug, c: 'saveti', t: slug };
    const P = paletteFor('article:' + slug); const q = R(RNG(H32('article:' + slug)));
    const S = mk(P); const CW = 800, CH = 500;
    const paper = q.p([P.haze, P.wall[0], P.wall[3], mix(P.haze, '#ffffff', .4)]);
    S.rect(0, 0, CW, CH, paper);
    S.glow(q.i(500, 720), q.i(80, 200), 260, P.lit, .5);
    const ink = q.p([P.roof, P.glass, P.vig]);
    const c = a.c || 'saveti';
    let dd = '';
    if (c === 'trziste') { // stubići + linija
      const n = 9; for (let i = 0; i < n; i++) { const h = 60 + q.i(0, 220); S.rect(90 + i * 70, 400 - h, 44, h, i === q.i(0, 8) ? PINE : q.p([P.wall[1], P.wall[2], ink]), op(.9)); }
      S.lines(`M90 ${q.i(150, 250)}C250 ${q.i(80, 300)} 450 ${q.i(80, 300)} 720 ${q.i(60, 180)}`, PINE, 4); S.circle(720, 120, 8, PINE); S.circle(720, 120, 4, paper);
      S.rect(90, 400, 630, 2, ink, op(.6));
    } else if (c === 'kredit') { // koncentrični lukovi + kvadrati
      for (let i = 0; i < 5; i++) S.add(`<circle cx='560' cy='300' r='${60 + i * 42}' fill='none' stroke='${i === 2 ? PINE : ink}' stroke-width='${i === 2 ? 10 : 2}' opacity='${i === 2 ? .95 : .35}'/>`);
      S.rect(110, 120, 110, 110, P.wall[2]); S.rect(150, 160, 110, 110, PINE, op(.9)); S.rect(190, 200, 110, 110, ink, op(.85));
      S.rect(110, 380, 300, 2, ink, op(.5));
    } else if (c === 'pravni-saveti') { // dokument + pečat
      S.rect(150, 70, 320, 400, PAPER); S.rect(160, 82, 320, 400, P.vig, op(.08)); S.rect(150, 70, 320, 400, PAPER);
      for (let i = 0; i < 11; i++) dd += RP(186, 120 + i * 28, i % 4 === 3 ? 120 : 250, 5); S.path(dd, ink, op(.55));
      S.add(`<circle cx='520' cy='380' r='64' fill='none' stroke='${PINE}' stroke-width='8' opacity='.9'/><circle cx='520' cy='380' r='46' fill='none' stroke='${PINE}' stroke-width='2' opacity='.7'/>`); S.rect(500, 372, 40, 16, PINE, op(.9));
      S.rect(560, 120, 150, 150, P.wall[1], op(.8));
    } else if (c === 'vodici') { // koraci / staza
      S.lines('M80 420C200 420 220 180 360 180S520 320 700 100', PINE, 6);
      for (let i = 0; i < 4; i++) { const pts = [[80, 420], [360, 180], [520, 320], [700, 100]][i]; S.rect(pts[0] - 24, pts[1] - 24, 48, 48, i === 3 ? PINE : paper); S.add(`<rect x='${pts[0] - 24}' y='${pts[1] - 24}' width='48' height='48' fill='none' stroke='${ink}' stroke-width='2'/>`); }
      S.rect(560, 360, 160, 100, P.wall[2], op(.8)); S.rect(100, 90, 180, 60, P.wall[1], op(.8));
    } else { // saveti: kontrolna lista
      for (let i = 0; i < 5; i++) { const y = 90 + i * 76; S.rect(110, y, 36, 36, i < 3 ? PINE : paper); S.add(`<rect x='110' y='${y}' width='36' height='36' fill='none' stroke='${i < 3 ? PINE : ink}' stroke-width='2'/>`); if (i < 3) S.lines(`M118 ${y + 18}l9 9l16 -18`, PAPER, 3); dd += RP(170, y + 14, 180 + q.i(0, 200), 6); }
      S.path(dd, ink, op(.6));
      S.rect(560, 100, 150, 220, P.wall[1], op(.85)); S.rect(590, 140, 150, 220, P.wall[2], op(.75)); S.rect(620, 180, 150, 220, ink, op(.7));
    }
    S.rect(0, 0, CW * .1, CH, P.vig, op(.08));
    S.def(`<radialGradient id='v' r='.72'><stop offset='.55' stop-color='${P.vig}' stop-opacity='0'/><stop offset='1' stop-color='${P.vig}' stop-opacity='.2'/></radialGradient>`);
    S.def(`<filter id='g' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='.3 .3 .3 0 .25 .3 .3 .3 0 .25 .3 .3 .3 0 .25 0 0 0 0 .18'/></filter>`);
    S.rect(-10, -10, CW + 20, CH + 20, 'url(#v)'); S.rect(0, 0, CW, CH, '#000', ` filter='url(#g)' opacity='.5'`);
    return uri(S.out('0 0 800 500', a.t || slug, 800, 500));
  }

  /* ─── agencija: monogram pločica ─── */
  const STOP = /^(nekretnine|real|estate|invest|dom|rezidencij\w*|d\.o\.o\.?)$/i;
  function mark(a) {
    const ag = typeof a === 'string' ? ((typeof D !== 'undefined' && D && D.agencies && D.agencies.find((x) => x.s === a)) || { s: a, n: a }) : (a || { s: 'x', n: 'Agencija' });
    const words = String(ag.n || ag.s || 'A').split(/[\s-]+/).filter(Boolean);
    const sig = words.filter((w) => !STOP.test(w)); const use = (sig.length ? sig : words).slice(0, 2);
    const ini = use.map((w) => w[0].toUpperCase()).join('');
    const P = paletteFor('mark:' + ag.s); const q = R(RNG(H32('mark:' + ag.s)));
    const S = mk(P);
    const bg = q.p([P.wall[0], P.wall[3], P.haze, '#E2EEE7', P.wall[1], mix(P.haze, '#ffffff', .4)]);
    S.rect(0, 0, 200, 200, bg);
    const motif = q.i(0, 3);
    if (motif === 0) S.rect(176, 0, 24, 24, PINE);
    else if (motif === 1) S.rect(24, 156, 152, 3, PINE);
    else if (motif === 2) S.poly([[0, 200], [200, 0], [200, 200]], P.vig, op(.06));
    else S.add(`<rect x='8' y='8' width='184' height='184' fill='none' stroke='${INK}' stroke-width='2' opacity='.5'/>`);
    S.text(100, ini.length > 1 ? 132 : 134, ini, ` font-family='Fraunces,Georgia,Times New Roman,serif' font-weight='600' font-size='${ini.length > 1 ? 84 : 100}' fill='${INK}' text-anchor='middle' letter-spacing='-4'`);
    return uri(S.out('0 0 200 200', 'Logo — ' + (ag.n || ag.s), 200, 200));
  }

  const api = { src, el, kinds, hero, city, article, mark, uri, palette: paletteFor, scene: (l, kind, idx = 0) => scene(l.s, kind, idx, l).out('0 0 800 600', altFor(l, idx, kind), 800, 600), PAL, KIND_ALT };
  return api;
})();
window.img = img;
