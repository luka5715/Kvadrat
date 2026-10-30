/* Kvadrat.rs — ljuska aplikacije: tabela ruta, preusmerenja, render(), naslovi, skrol, granica grešaka, pokretanje.
   Učitava se poslednji. Stranice su u js/pages/*.js i izvoze view<Ime>(q) funkcije; ljuska ih traži po imenu u trenutku
   crtanja (window[name]), pa modul koji nedostaje daje uređenu stranicu „u izradi“, a greška u modulu blok greške — nikad prazan ekran.
   render() = ui.header(navPath) + <main id="main"> view(q) + ui.footer(); donja navigacija dolazi uz header (≤860px).
   Ista ruta sa drugim parametrima: root.update(q, path) ako ga pogled nudi (rezultati), inače ponovni render uz zadržan skrol. */
'use strict';

(function () {
  const S = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const G = () => window.KVG || null;
  const SITE = 'Kvadrat.rs';
  const parse = (h) => S(() => parseHash(h), null) || (() => {
    const raw = String(h != null ? h : location.hash || '').replace(/^#/, ''); const i = raw.indexOf('?');
    return { path: (i >= 0 ? raw.slice(0, i) : raw) || '/', q: new URLSearchParams(i >= 0 ? raw.slice(i + 1) : '') };
  })();
  const build = (path, params) => S(() => buildHash(path, params), null) || ('#' + path + (params && Object.keys(params).length ? '?' + new URLSearchParams(params) : ''));
  const qObj = (q) => { const o = {}; q.forEach((v, k) => { o[k] = v; }); return o; };

  /* ───────────────────────── naslovi ───────────────────────── */
  const city = (cs) => S(() => find.city(cs), null);
  const mun = (ms) => S(() => find.mun(ms), null);
  function resultsTitle(q) {
    const f = S(() => paramsToFilters(q), null);
    if (!f) return 'Pretraga nekretnina';
    const pts = f.pt || [];
    const c = f.c ? city(f.c) : null;
    const m = (f.m || []).length === 1 ? mun(f.m[0]) : null;
    const where = c ? ' u ' + (c.loc || c.n) : m ? ', ' + m.n : '';
    const nb = (f.co || []).includes('novogradnja') || f.newbuild;
    let s;
    if (nb && f.t !== 'izdavanje') s = 'Novogradnja' + where;
    else {
      const noun = pts.length === 1 ? S(() => typeOf(pts[0]).pl, 'nekretnina') : 'nekretnina';
      s = (f.t === 'izdavanje' ? 'Izdavanje ' : 'Prodaja ') + noun + where;
    }
    if (m && c) s += ' · ' + m.n;
    return s;
  }
  const listingTitle = (q) => { const l = S(() => find.listing(q.get('s')), null); return l ? (S(() => KX.titleOf(l), null) || l.ti) : 'Oglas nije pronađen'; };
  const agencyTitle = (q) => S(() => find.agency(q.get('s')).n, null) || 'Agencija nije pronađena';
  const articleTitle = (q) => S(() => find.article(q.get('s')).t, null) || 'Tekst nije pronađen';

  /* navPath: koja stavka glavne i donje navigacije je aktivna (ui.header gleda prefiks putanje) */
  function resultsNav(q) {
    const f = S(() => paramsToFilters(q), {}) || {};
    if (((f.co || []).includes('novogradnja') || f.newbuild) && f.t !== 'izdavanje') return '/novogradnja';
    return f.t === 'izdavanje' ? '/izdavanje' : '/prodaja';
  }
  const listingNav = (q) => { const l = S(() => find.listing(q.get('s')), null); return l && l.t === 'izdavanje' ? '/izdavanje' : '/prodaja'; };

  /* ───────────────────────── tabela ruta ─────────────────────────
     view: ime globalne funkcije · title(q) · nav(q) · id: parametar koji određuje „istu stranicu“ (drugačiji → skrol na vrh) */
  const ROUTES = {
    '/': { view: 'viewHome', name: 'Početna', title: () => null, desc: 'Stanovi, kuće i poslovni prostori u Srbiji — cena po m² uz svaki oglas i poređenje sa prosekom kraja.' },
    '/pretraga': { view: 'viewResults', name: 'Pretraga', title: resultsTitle, nav: resultsNav, args: (q, path) => [q, path] },
    '/oglas': { view: 'viewListing', name: 'Oglas', title: listingTitle, nav: listingNav, id: 's' },
    '/mapa': { view: 'viewMap', name: 'Mapa', title: (q) => (q.get('m') === 'budzet' ? 'Šta dobijam za svoj budžet' : 'Mapa nekretnina'), nav: () => '/mapa' },
    '/agencije': { view: 'viewAgencies', name: 'Agencije', title: () => 'Agencije za nekretnine' },
    '/agencija': { view: 'viewAgency', name: 'Agencija', title: agencyTitle, nav: () => '/agencije', id: 's' },
    '/novogradnja': { view: 'viewProjects', name: 'Novogradnja', title: () => 'Novogradnja — projekti i stanovi od investitora' },
    '/projekat': { view: 'viewProject', name: 'Projekat novogradnje', title: () => 'Projekat novogradnje', nav: () => '/novogradnja', id: 's' },
    '/saveti': { view: 'viewArticles', name: 'Saveti', title: () => 'Saveti za kupce i zakupce' },
    '/savet': { view: 'viewArticle', name: 'Savet', title: articleTitle, nav: () => '/saveti', id: 's' },
    '/kalkulator': { view: 'viewCalc', name: 'Kalkulator', title: () => 'Kalkulator kredita i troškova kupovine' },
    '/procena': { view: 'viewValuation', name: 'Procena vrednosti', title: () => 'Procena vrednosti nekretnine' },
    '/trziste': { view: 'viewMarket', name: 'Tržište', title: () => 'Cene nekretnina po opštinama' },
    '/uporedi': { view: 'viewCompare', name: 'Uporedi', title: () => 'Uporedi oglase' },
    '/sacuvani': { view: 'viewSaved', name: 'Sačuvano', title: () => 'Sačuvani oglasi i pretrage', nav: () => '/sacuvano' },
    '/moja-mesta': { view: 'viewPlaces', name: 'Moja mesta', title: () => 'Moja mesta', nav: () => '/profil' },
    '/postavi': { view: 'viewPost', name: 'Postavi oglas', title: () => 'Postavi oglas' },
    '/kako-racunamo': { view: 'viewLedger', name: 'Kako računamo', title: () => 'Kako računamo' },
  };
  ['/privatnost', '/uslovi', '/pomoc', '/kontakt', '/prijava'].forEach((p) => {
    const t = { '/privatnost': 'Privatnost', '/uslovi': 'Uslovi korišćenja', '/pomoc': 'Pomoć i česta pitanja', '/kontakt': 'Kontakt', '/prijava': 'Prijavi oglas' }[p];
    ROUTES[p] = { view: 'viewInfo', name: t, title: () => t, args: (q, path) => [q, path] };
  });

  /* ───────────────────────── preusmerenja (stare i „lepe“ adrese) ───────────────────────── */
  const PT_PATH = { stanovi: 'stan', stan: 'stan', kuce: 'kuca', kuca: 'kuca', 'poslovni-prostori': 'poslovni-prostor', lokali: 'poslovni-prostor', zemljista: 'zemljiste', placevi: 'zemljiste', garaze: 'garaza', sobe: 'soba', vikendice: 'vikendica' };
  function pathParams(path) {
    const fn = window.resultsParamsFromPath;
    const seg = path.split('/').filter(Boolean);
    const out = {};
    if (seg[0] === 'prodaja' || seg[0] === 'izdavanje') out.t = seg[0];
    if (seg[0] === 'novogradnja-pretraga') { out.t = 'prodaja'; out.co = 'novogradnja'; }
    if (seg[1] && PT_PATH[seg[1]]) out.pt = PT_PATH[seg[1]];
    const rest = typeof fn === 'function' ? S(() => fn(path), {}) : {};
    if (rest.c) out.c = rest.c; if (rest.m) out.m = rest.m;
    if (!rest.c && seg[2]) { const c = city(seg[2]); if (c) out.c = c.s; else { const m = mun(seg[2]); if (m) { out.m = m.s; out.c = m.cs; } } }
    return out;
  }
  function redirect(path, q) {
    if (/^\/(prodaja|izdavanje|novogradnja-pretraga)(\/|$)/.test(path)) {
      const p = pathParams(path); const o = qObj(q);
      for (const k of Object.keys(p)) if (!(k in o)) o[k] = p[k];
      return build('/pretraga', o);
    }
    let m;
    if ((m = path.match(/^\/oglasi?\/(.+)$/))) return build('/oglas', { ...qObj(q), s: decodeURIComponent(m[1]) });
    if ((m = path.match(/^\/agencij[ae]\/(.+)$/))) return build('/agencija', { ...qObj(q), s: decodeURIComponent(m[1]) });
    if ((m = path.match(/^\/(savet|saveti)\/(.+)$/))) return build('/savet', { ...qObj(q), s: decodeURIComponent(m[2]) });
    if ((m = path.match(/^\/(projekat|novogradnja)\/(.+)$/))) return build('/projekat', { ...qObj(q), s: decodeURIComponent(m[2]) });
    if (path === '/sacuvano' || path === '/omiljeni') return build('/sacuvani', qObj(q));
    if (path === '/profil') return build('/moja-mesta', qObj(q));
    if (path === '/budzet') return build('/mapa', { ...qObj(q), m: 'budzet' });
    /* stari ključ mode=budzet (paleta, stari linkovi) → m=budzet */
    if (path === '/mapa' && q.get('mode') === 'budzet' && !q.get('m')) { const o = qObj(q); delete o.mode; return build('/mapa', { ...o, m: 'budzet' }); }
    if (path.length > 1 && path.endsWith('/')) return build(path.replace(/\/+$/, ''), qObj(q));
    return null;
  }

  /* ───────────────────────── crtanje ───────────────────────── */
  let cur = { key: null, path: null, root: null };
  let booted = false;
  let DESC0 = null;

  function keyOf(path, q, route) { return path + (route && route.id ? '?' + route.id + '=' + (q.get(route.id) || '') : ''); }
  function setMeta(path, q, route) {
    const t = route ? S(() => route.title(q), null) : 'Stranica nije pronađena';
    document.title = t ? `${t} · ${SITE}` : `${SITE} — nekretnine u Srbiji`;
    const d = document.querySelector('meta[name="description"]');
    if (d) { if (DESC0 == null) DESC0 = d.getAttribute('content') || ''; d.setAttribute('content', (route && route.desc) || (t ? `${t} — ${DESC0}` : DESC0)); }
  }
  function closeOverlays() {
    S(() => G().palette.close());
    document.querySelectorAll('.modal .hd button, .sheet .hd button').forEach((b) => S(() => b.click()));
    document.querySelectorAll('.lightbox').forEach((n) => S(() => { const b = n.querySelector('[aria-label="Zatvori"]'); if (b) b.click(); else n.remove(); }));
  }
  function fallbackHeader() {
    return el('header', { class: 'hdr' }, el('div', { class: 'wrap' }, el('a', { class: 'logo', href: '#/' }, 'Kvadrat', el('small', {}, '.rs'))));
  }
  /* zaglavlje: ui.header + dugme brze pretrage (⌘K) ispred prekidača teme; ui-ov skip link se uklanja jer stalni stoji u <body> */
  function makeHeader(navPath) {
    const h = S(() => header(navPath), null) || fallbackHeader();
    S(() => { const sk = h.querySelector('.skip'); if (sk && document.querySelector('body > .kv-skip')) sk.remove(); });
    S(() => {
      const r = h.querySelector('.hdr-r');
      if (!r || r.querySelector('.kv-search')) return;
      const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
      const b = el('button', { class: 'iconbtn kv-search', type: 'button', 'aria-label': 'Brza pretraga', 'aria-keyshortcuts': mac ? 'Meta+K' : 'Control+K', title: 'Brza pretraga (' + (mac ? '⌘K' : 'Ctrl+K') + ')', onclick: () => S(() => G().palette.open()) },
        S(() => icon('search'), null), el('span', { class: 'kv-search-l' }, 'Pretraga'), el('kbd', { class: 'kv-search-k' }, mac ? '⌘K' : 'Ctrl K'));
      r.insertBefore(b, r.firstChild);
    });
    /* centar obaveštenja (global.js): zvonce ispred „Sačuvani oglasi“ */
    S(() => {
      const r = h.querySelector('.hdr-r');
      if (!r || r.querySelector('.kv-bell')) return;
      const b = G().notif.button();
      const fav = r.querySelector('a.iconbtn[href="#/sacuvani"]') || r.querySelector('.btn-ink');
      r.insertBefore(b, fav || null);
    });
    return h;
  }
  /* podnožje: statični „Srpski (latinica)“ postaje prekidač Latinica / Ћирилица (global.js → kv.script) */
  function makeFooter() {
    const f = S(() => footer(), null) || el('footer', { class: 'ftr' }, el('div', { class: 'wrap' }, '© 2026 Kvadrat.rs'));
    S(() => {
      const nav = f.querySelector('nav[aria-label="Jezik"]'); if (!nav) return;
      nav.setAttribute('aria-label', 'Pismo i pravila');
      const old = [...nav.children].find((n) => n.tagName === 'SPAN' && /latinica/i.test(n.textContent));
      const ctl = G().script.control();
      if (old) old.replaceWith(ctl); else nav.insertBefore(ctl, nav.firstChild);
    });
    return f;
  }

  function viewFor(path, q, route) {
    const views = S(() => G().views, {}) || {};
    if (!route) return views.notFound ? views.notFound(q, path) : el('div', { class: 'wrap' }, el('h1', { class: 't-h1' }, 'Stranica nije pronađena'));
    const fn = window[route.view];
    if (typeof fn !== 'function') {
      if (views.placeholder) return views.placeholder(q, path, route.name);
      return el('div', { class: 'wrap' }, el('h1', { class: 't-h1' }, 'Stranica je u izradi'), el('a', { class: 'btn btn-primary', href: '#/' }, 'Na početnu'));
    }
    const node = fn(...(route.args ? route.args(q, path) : [q]));
    if (!(node instanceof Node)) throw new Error(`${route.view}() nije vratio DOM čvor`);
    return node;
  }
  function errorBlock(err, path) {
    S(() => console.error('[Kvadrat] greška u ruti #' + path, err));
    const v = S(() => G().views.error, null);
    return (v && S(() => v(err, path), null)) || el('div', { class: 'wrap kv-state' }, el('h1', { class: 't-h1' }, 'Nešto je pošlo naopako'), el('p', { class: 'lede' }, String(err && err.message || err)));
  }

  function render(r, opts = {}) {
    r = r || parse();
    /* sidro bez rute (#main, #sadrzaj): ostaje tekuća stranica, adresa se vraća */
    if (!String(r.path).startsWith('/')) {
      const target = S(() => document.getElementById(r.path), null);
      if (booted && cur.hash) { S(() => history.replaceState(history.state, '', cur.hash)); if (target) S(() => target.scrollIntoView()); return; }
      S(() => history.replaceState(null, '', '#/')); r = parse('#/');
    }
    const red = redirect(r.path, r.q);
    if (red) { S(() => history.replaceState(history.state, '', red)); r = parse(red); }
    const { path, q } = r;
    const route = ROUTES[path] || null;
    const key = keyOf(path, q, route);
    const same = !opts.force && booted && key === cur.key && cur.root && cur.root.isConnected;

    /* ista stranica, drugi parametri: pogled se sam osvežava (bez skrola i gubitka fokusa) */
    if (same && typeof cur.root.update === 'function') {
      try {
        cur.root.update(q, path); cur.hash = location.hash; setMeta(path, q, route);
        /* aktivna stavka navigacije zavisi od parametara (prodaja/izdavanje/novogradnja) — zaglavlje se menja u mestu */
        const navPath = route && route.nav ? S(() => route.nav(q), path) : path;
        if (navPath !== cur.navPath) {
          S(() => {
            const old = document.querySelector('#app > .hdr'); if (!old) return;
            /* fokus u starom zaglavlju (klik/Enter na stavku) prelazi na istu stavku u novom */
            const fa = old.contains(document.activeElement) ? document.activeElement : null;
            const fh = fa && fa.getAttribute('href'); const fNav = fa && fa.closest('.nav, .bnav');
            const nh = makeHeader(navPath); old.replaceWith(nh);
            if (fh && fNav) { const t = [...nh.querySelectorAll('.' + (fNav.classList.contains('bnav') ? 'bnav' : 'nav') + ' a')].find((x) => x.getAttribute('href') === fh); if (t) t.focus({ preventScroll: true }); }
          });
          cur.navPath = navPath;
        }
        after(path, false); return;
      }
      catch (e) { S(() => console.error('[Kvadrat] update nije uspeo, pun render', e)); }
    }
    /* skrol: ista stranica zadržava položaj; nazad/napred vraća položaj sačuvan u history.state.kvY
       (unosi nastali klikom na link ili location.hash= imaju prazan state → na vrh) */
    const y0 = !same ? S(() => (history.state && typeof history.state.kvY === 'number' ? history.state.kvY : null), null) : null;
    const y = same ? window.scrollY : 0;
    if (!same) closeOverlays();
    if (!same) { document.body.removeAttribute('data-bnav'); document.body.classList.remove('modal-open', 'sheet-open'); }

    let body;
    try { body = viewFor(path, q, route); } catch (e) { body = errorBlock(e, path); }
    const navPath = route && route.nav ? S(() => route.nav(q), path) : path;
    const main = el('main', { id: 'main', tabindex: '-1', 'data-route': path }, body);
    const app = document.getElementById('app');
    try { app.replaceChildren(makeHeader(navPath), main, makeFooter()); }
    catch (e) { app.replaceChildren(el('main', { id: 'main' }, errorBlock(e, path))); }
    cur = { key, path, root: body, hash: location.hash || '#/', navPath };
    setMeta(path, q, route);
    window.scrollTo(0, y);
    if (y0 > 0) restoreScroll(y0);
    else if (!same && booted && !opts.silent) S(() => main.focus({ preventScroll: true }));
    after(path, !same);
  }
  /* vraćanje skrola posle crtanja: dva okvira (raspored), pa još nekoliko ako stranica još nije dovoljno visoka */
  let restoreTok = 0;
  function restoreScroll(y0) {
    const tok = ++restoreTok; let tries = 0;
    const attempt = () => {
      if (tok !== restoreTok) return;
      window.scrollTo(0, y0);
      if (Math.abs(window.scrollY - y0) > 2 && ++tries < 12) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(() => requestAnimationFrame(attempt));
  }
  /* pamćenje skrola u tekućem unosu istorije (prigušeno na 250 ms; klik pre navigacije upisuje odmah) */
  let saveT = 0;
  function saveScroll() {
    clearTimeout(saveT); saveT = 0;
    if (!booted || !cur.hash || location.hash !== cur.hash) return;
    S(() => { const st = history.state && typeof history.state === 'object' ? history.state : {}; if (st.kvY === window.scrollY) return; history.replaceState({ ...st, kvY: window.scrollY }, '', location.hash); });
  }
  function after(path, isNew) {
    S(() => G().onRoute(path));
    /* ćirilica: preslovljavanje novog sadržaja (posle crtanja; kasnije izmene hvata MutationObserver u global.js) */
    S(() => G().script.apply());
    /* donja navigacija: stranica sa .cta-bar je gasi (body[data-bnav=off]); sigurnosna provera posle montiranja */
    if (isNew) requestAnimationFrame(() => requestAnimationFrame(() => {
      const bar = document.querySelector('.cta-bar');
      if (bar && !document.body.hasAttribute('data-bnav') && getComputedStyle(bar).display !== 'none') document.body.setAttribute('data-bnav', 'off');
    }));
  }

  /* ───────────────────────── pokretanje ───────────────────────── */
  function boot() {
    S(() => { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; });
    /* KX.enrich() jednom pre prvog crtanja: indeksi, duplikati, ponovljeni oglasi (demo) — engine.js ih je dodao pri učitavanju */
    S(() => KX.enrich());
    if (!location.hash || location.hash === '#') S(() => history.replaceState(null, '', '#/'));
    /* stalni skip link (u <body>): ne menja hash, samo fokusira sadržaj */
    S(() => document.querySelector('body > .kv-skip').addEventListener('click', (e) => {
      e.preventDefault(); const m = document.getElementById('main'); if (m) { m.focus(); m.scrollIntoView(); }
    }));
    /* router.onChange pokriva i 'hashchange' i setHash(…, true); bez core rutera — sirov hashchange */
    const viaRouter = S(() => { router.onChange((rr, o) => render(rr, o || {})); return true; }, false);
    if (!viaRouter) window.addEventListener('hashchange', () => render());
    /* brojači u zaglavlju (Sačuvano) se sami osvežavaju preko store.on u ui.js; fioku „Uporedi“ osvežava global.js; ljuska prati profil bez punog crtanja */
    window.addEventListener('scroll', () => { if (!saveT) saveT = setTimeout(saveScroll, 250); }, { passive: true });
    document.addEventListener('click', () => { if (saveT) saveScroll(); }, true);
    window.addEventListener('pagehide', () => { if (saveT) saveScroll(); });
    S(() => KX.profile.on(() => { const pal = S(() => G().palette, null); if (pal && pal.isOpen()) { const inp = document.querySelector('.kp-input'); if (inp) inp.dispatchEvent(new Event('input')); } }));
    render(null, { silent: true });
    booted = true;
    S(() => G().notice.show());
  }

  window.KVApp = { render: (r, o) => render(r, o || {}), routes: ROUTES, redirect, title: (h) => { const r = parse(h); const rt = ROUTES[r.path]; return rt ? rt.title(r.q) : null; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
