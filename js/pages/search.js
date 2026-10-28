/* Kvadrat.rs — stranica: rezultati pretrage (PER_PAGE, viewResults, rail). */
'use strict';

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
