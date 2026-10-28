/* Kvadrat.rs — images: proceduralna SVG grafika (PALETTES, scene, kindFor, heroArt, cityArt). */
'use strict';

/* ─────────── deterministička grafika ─────────── */
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
