/* Kvadrat.rs — stranica: detalj oglasa (viewListing, miniMap). */
'use strict';

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
