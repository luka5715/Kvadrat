/* Kvadrat.rs — app: ruter/render(), lastPath, boot(). Učitava se poslednji. */
'use strict';

/* ─────────── render ─────────── */
function render() {
  const { path, q } = parseHash();
  const app = $('#app');
  const prevScroll = path === lastPath ? window.scrollY : 0;
  lastPath = path;

  let body;
  if (path === '/' || path === '') body = viewHome();
  else if (path === '/pretraga') { F = paramsToFilters(q); body = viewResults(F); }
  else if (path === '/oglas') body = viewListing(q.get('s'));
  else if (path === '/mapa') body = viewMap(q.get('c'));
  else if (path === '/agencije') body = viewAgencies();
  else if (path === '/kalkulator') body = viewCalc();
  else if (path === '/sacuvani') body = viewSaved();
  else body = el('div', { class: 'wrap block' }, el('h1', {}, 'Stranica nije pronađena'),
    el('a', { class: 'btn btn-primary', href: '#/' }, 'Nazad na početnu'));

  app.innerHTML = '';
  app.append(header(path), el('main', { id: 'main' }, body), footer());
  window.scrollTo({ top: prevScroll, behavior: 'instant' in window ? 'auto' : 'auto' });
}
let lastPath = null;

/* ─────────── start ─────────── */
(function boot() {
  try {
    const saved = localStorage.getItem(LS.theme);
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch {}
  if (!location.hash) history.replaceState(null, '', '#/');
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
  render();
})();
