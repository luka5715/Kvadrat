/* Kvadrat.rs — stranica: početna (viewHome). */
'use strict';

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
