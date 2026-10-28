/* Kvadrat.rs — stranica: mapa (viewMap). */
'use strict';

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
