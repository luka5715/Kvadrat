/* Kvadrat.rs — stranica: sačuvani oglasi (viewSaved). */
'use strict';

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
