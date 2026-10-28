/* Kvadrat.rs — stranica: agencije (agencyCard, viewAgencies). */
'use strict';

/* ─────────── agencije ─────────── */
function agencyCard(a) {
  return el('article', { class: 'agc' },
    el('span', { class: 'agc-logo', style: `--h:${hash(a.s) % 360}` }, a.n.split(' ').slice(0, 2).map((w) => w[0]).join('')),
    el('div', { class: 'agc-b' },
      el('h3', {}, a.n, a.v ? el('span', { class: 'verif', title: 'Verifikovana agencija', html: icon('check', 13) }) : null),
      el('p', { class: 'muted small' }, a.c, a.y ? ` · od ${a.y}.` : ''),
      el('p', { class: 'rate' }, el('span', { class: 'stars', html: icon('star', 14).repeat(Math.round(a.r)) }),
        a.r.toFixed(1), el('span', { class: 'muted' }, ` (${a.rc})`)),
      el('p', { class: 'muted small' }, `${a.lc} ${oglasa(a.lc)} · ${a.ac} ${plural(a.ac, 'agent', 'agenta', 'agenata')}`)),
  );
}
function viewAgencies() {
  const sorted = [...D.agencies].sort((a, b) => (b.v - a.v) || (b.lc - a.lc));
  return el('div', { class: 'wrap block' },
    el('div', { class: 'head' }, el('div', {},
      el('h1', {}, 'Agencije za nekretnine'),
      el('p', {}, `${D.agencies.length} registrovanih agencija sa aktivnim oglasima na portalu.`))),
    el('div', { class: 'grid3' }, sorted.map((a) => el('div', { class: 'agc-wrap' }, agencyCard(a),
      el('p', { class: 'agc-d' }, a.d),
      el('a', { class: 'btn btn-outline w-full', href: '#/pretraga?' + new URLSearchParams({ loc: '' }) }, 'Pogledaj oglase')))),
  );
}
