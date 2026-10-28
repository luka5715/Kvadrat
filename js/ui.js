/* Kvadrat.rs — ui: ikone (ICON/icon), kartica oglasa (card), stat/head, panel pretrage, NAV, header, footer. */
'use strict';

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

const stat = (v, l) => el('div', { class: 'stat' }, el('strong', {}, v), el('span', {}, l));
const head = (t, s, href) => el('div', { class: 'head' },
  el('div', {}, el('h2', {}, t), s ? el('p', {}, s) : null),
  href ? el('a', { class: 'more', href }, 'Prikaži sve ', el('span', { html: icon('chev', 15) })) : null,
);

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

/* ─────────── ljuska: navigacija, zaglavlje, podnožje ─────────── */
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
