/* Kvadrat.rs — globalni slojevi ljuske (učitava se posle svih stranica, pre app.js).
   1) Brza pretraga ⌘K / Ctrl+K / „/” (KX.parseQuery → čipovi, živi broj, predlozi, strelice, Enter → #/pretraga)
   2) Fioka „Uporedi” (store.compare, vidljiva na rezultatima, mapi i oglasu)
   3) Obaveštenje o privatnosti (ZZPL), jednom, pamti se u kv.privacy
   4) „Kako računamo” — viewLedger(q) iz KX.ledger + formule + izvori
   5) Tastatura: ⌘K / Ctrl+K, „/”, Esc (bez drugih globalnih prečica); 6) online/offline obaveštenja; 7) 404, „u izradi”, blok greške, info stranice (privatnost, uslovi, pomoć, kontakt, prijava).
   Izvozi: window.KVG = { palette, tray, notice, keys, views… } i globalne viewLedger / viewInfo / viewNotFound.
   Zavisi (meko, sve kroz S()) od core.js, ui.js, images.js, engine.js. Nikad ne baca. */
'use strict';

(function () {
  const S = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const X = () => (typeof KX !== 'undefined' && KX) || null;
  const has = (name) => typeof window[name] === 'function';
  const ic = (name, size) => S(() => icon(name, size), null);
  const N0 = (n) => S(() => fmt.num(n), String(n));
  const plural = (n, a, b, c) => S(() => fmt.plural(n, a, b, c), c);
  const results = (n) => `${N0(n)} ${plural(n, 'rezultat', 'rezultata', 'rezultata')}`;
  const oglasa = (n) => `${N0(n)} ${plural(n, 'oglas', 'oglasa', 'oglasa')}`;
  const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const href = (path, params) => S(() => router.href(path, params || {}), '#' + path);
  const isTyping = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const isMac = S(() => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), false);
  const fullFilters = (f) => S(() => ({ ...FILTER_DEFAULTS, ...(f || {}) }), f || {});
  const countOf = (f) => {
    const k = S(() => X().count(f || {}), null);
    if (typeof k === 'number') return k;
    return S(() => applyFilters(fullFilters(f)).length, 0);
  };
  const filterList = (f) => S(() => X().filter(f || {}), null) || S(() => applyFilters(fullFilters(f)), []);
  const paramsCount = (params) => S(() => countOf(paramsToFilters(new URLSearchParams((buildHash('/pretraga', params).split('?')[1]) || ''))), 0);
  const findL = (s) => S(() => find.listing(s), null) || S(() => D.listings.find((x) => x.s === s), null);
  const titleOf = (l) => S(() => X().titleOf(l), null) || (l && l.ti) || 'Oglas';
  const priceOf = (l) => S(() => fmt.price(l.p, l.t), (l && l.p) + ' €');
  const placeOf = (l) => [l.n, l.m && l.m !== l.n ? l.m : null, l.c && l.c !== l.m ? l.c : null].filter(Boolean).join(', ');
  const thumb = (l, size) => S(() => { const im = img.el(l, 0, { aspect: '1:1', alt: '' }); im.width = size; im.height = size; return im; }, null) || el('span', { class: 'kv-ph' });
  const go = (h) => { if (location.hash === h) { S(() => window.KVApp && window.KVApp.render()); return; } location.hash = h; };

  /* ───────────────────────── brze pretrage (dele ih paleta, 404 i „u izradi”) ───────────────────────── */
  const QUICK = [
    { label: 'Dvosobni stanovi u Beogradu', params: { t: 'prodaja', pt: ['stan'], c: 'beograd', ro: ['2'] } },
    { label: 'Garsonjere za izdavanje u Novom Sadu', params: { t: 'izdavanje', pt: ['stan'], c: 'novi-sad', ro: ['0.5'] } },
    { label: 'Novogradnja u Beogradu', params: { t: 'prodaja', c: 'beograd', co: ['novogradnja'] } },
    { label: 'Od vlasnika, bez provizije', params: { t: 'prodaja', advertiser: 'vlasnik' } },
    { label: 'Ispod proseka opštine za 5 % i više', params: { t: 'prodaja', pt: ['stan'], deltaMax: '-5' } },
    { label: 'Kuće do 100.000 €', params: { t: 'prodaja', pt: ['kuca'], pmax: '100000' } },
  ];
  const GOTO = [
    { label: 'Mapa oglasa', h: '#/mapa', icon: 'map', words: 'mapa' },
    { label: 'Šta dobijam za svoj budžet', h: '#/mapa?m=budzet', icon: 'euro', words: 'budzet budzeta novac' },
    { label: 'Kalkulator kredita i troškova', h: '#/kalkulator', icon: 'calc', words: 'kalkulator kredit rata troskovi' },
    { label: 'Procena vrednosti stana', h: '#/procena', icon: 'ruler', words: 'procena vrednost koliko vredi' },
    { label: 'Tržište i cene po opštinama', h: '#/trziste', icon: 'blocks', words: 'trziste cene statistika' },
    { label: 'Uporedi oglase', h: '#/uporedi', icon: 'compare', words: 'uporedi poredjenje' },
    { label: 'Sačuvano', h: '#/sacuvani', icon: 'heart', words: 'sacuvani sacuvano omiljeni' },
    { label: 'Moja mesta', h: '#/moja-mesta', icon: 'pin', words: 'moja mesta posao' },
    { label: 'Kako računamo', h: '#/kako-racunamo', icon: 'info', words: 'kako racunamo metodologija formule' },
  ];
  function quickList(cls) {
    return el('ul', { class: cls || 'kv-quick' }, QUICK.map((qk) => el('li', {},
      el('a', { href: href('/pretraga', qk.params) }, el('span', {}, qk.label), el('span', { class: 'n num' }, oglasa(paramsCount(qk.params))), ic('chev-r', 16)))));
  }

  /* ═════════════════════════ 1) BRZA PRETRAGA ═════════════════════════ */
  const RECENT_KEY = 'kv.recentq';
  const recentQ = () => (lsGet(RECENT_KEY, []) || []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 5);
  const pushRecentQ = (t) => { t = String(t || '').trim(); if (!t) return; lsSet(RECENT_KEY, [t, ...recentQ().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 5)); };

  const palette = (function () {
    let api = null;            /* otvoren modal */
    let st = null;             /* stanje otvorene palete */

    const fold = (s) => S(() => fmt.fold(s), String(s || '').toLowerCase());
    function parse(text) {
      const t = String(text || '').trim();
      if (!t) return { filters: {}, chips: [], unparsed: [], count: null, route: null };
      const r = S(() => X().parseQuery(t), null);
      if (r) return r;
      /* bez engine-a: običan tekst */
      return { filters: { q: t }, chips: [{ label: 'tekst: ' + t, key: 'q', value: t }], unparsed: [t], count: countOf({ q: t }), route: null };
    }
    /* × na čipu briše reči koje su ga proizvele: najkraći uzastopni niz reči čije uklanjanje skida baš taj čip */
    function removeChip(text, chip) {
      const words = String(text).trim().split(/\s+/);
      const sig = (c) => c.key + '=' + JSON.stringify(c.value);
      const target = sig(chip);
      const others = (parse(text).chips || []).map(sig).filter((x) => x !== target).sort().join('|');
      const without = (i, len) => words.slice(0, i).concat(words.slice(i + len)).join(' ');
      const sameOthers = (t) => (parse(t).chips || []).map(sig).sort().join('|') === others;
      for (let len = 1; len <= Math.min(5, words.length); len++) {
        for (let i = 0; i + len <= words.length; i++) {
          if ((parse(without(i, len)).chips || []).map(sig).includes(target)) continue;
          /* proširi na susedne veznike („do”, „od”, „€”…) dok ostali čipovi ostaju isti */
          let a = i, b = i + len;
          while (a > 0 && sameOthers(without(a - 1, b - a + 1))) a--;
          while (b < words.length && sameOthers(without(a, b - a + 1))) b++;
          return without(a, b - a);
        }
      }
      return '';
    }

    function close() { if (api) { const a = api; api = null; a.close(); } }
    function open(opts = {}) {
      if (api) { S(() => st.input.focus()); return api; }
      const input = el('input', {
        class: 'kp-input', type: 'search', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'kp-list', 'aria-autocomplete': 'list',
        autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search',
        placeholder: 'npr. dvosoban vračar do 150k uknjižen', 'aria-label': 'Šta tražite',
      });
      const chips = el('div', { class: 'kp-chips', 'aria-label': 'Prepoznato' });
      const count = el('p', { class: 'kp-count', role: 'status', 'aria-live': 'polite' });
      const list = el('div', { class: 'kp-list', id: 'kp-list', role: 'listbox', 'aria-label': 'Predlozi' });
      const hints = el('p', { class: 'kp-hints' },
        el('span', {}, el('kbd', {}, '↑'), el('kbd', {}, '↓'), ' birajte'), el('span', {}, el('kbd', {}, 'Enter'), opts.pick ? ' dodajte' : ' otvorite'),
        opts.pick ? null : el('span', {}, el('kbd', {}, isMac ? '⌘' : 'Ctrl'), el('kbd', {}, 'Enter'), ' svi rezultati'), el('span', {}, el('kbd', {}, 'Esc'), ' zatvorite'));
      const body = el('div', { class: 'kp' },
        el('div', { class: 'kp-box' }, ic('search', 20), input),
        chips, count, list, hints);
      const goBtn = el('button', { class: 'btn btn-ink kp-go', type: 'button', onclick: () => apply() }, 'Prikaži rezultate');
      st = { input, chips, count, list, goBtn, items: [], cur: -1, parsed: null, pick: opts.pick || null };
      api = S(() => modal(opts.pick ? 'Dodaj oglas u poređenje' : 'Brza pretraga', body, { footer: [goBtn], onClose: () => { api = null; st = null; } }), null);
      if (!api) { st = null; return null; }
      api.el.classList.add('kp-dlg');
      input.addEventListener('input', () => paint());
      input.addEventListener('keydown', onKey);
      if (opts.text) input.value = opts.text;
      paint();
      setTimeout(() => S(() => { input.focus({ preventScroll: true }); if (opts.text) input.select(); }), 40);
      return api;
    }

    function onKey(e) {
      if (!st) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = st.items.length; if (!n) return;
        move(st.cur < 0 ? (e.key === 'ArrowDown' ? 0 : n - 1) : (st.cur + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if ((e.metaKey || e.ctrlKey) && !st.pick) { apply(); return; }
        if (st.cur >= 0 && st.items[st.cur]) { activate(st.items[st.cur]); return; }
        apply();
      } else if (e.key === 'Home' && st.items.length && !st.input.value) { e.preventDefault(); move(0); }
    }
    function move(i) {
      st.cur = i;
      st.items.forEach((it, j) => { it.node.classList.toggle('on', j === i); it.node.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      const it = st.items[i];
      if (it) { st.input.setAttribute('aria-activedescendant', it.node.id); it.node.scrollIntoView({ block: 'nearest' }); }
      else st.input.removeAttribute('aria-activedescendant');
    }
    function activate(it) {
      if (it.fill != null) { st.input.value = it.fill; paint(); st.input.focus(); return; }
      if (it.slug && st.pick) { const pick = st.pick; close(); S(() => pick(it.slug)); return; }
      if (it.recent) pushRecentQ(st.input.value);
      const h = it.h; close(); if (h) go(h);
    }
    /* režim izbora (Uporedi → „Dodaj još jedan”): nikad ne napušta stranicu — Enter / dugme dodaju prvi pronađeni oglas */
    const firstPick = () => (st ? st.items.find((it) => it.slug) : null);
    function apply() {
      if (!st) return;
      if (st.pick) { const it = firstPick(); if (it) activate(it); else S(() => st.input.focus()); return; }
      const text = st.input.value.trim();
      const p = st.parsed || parse(text);
      if (!text) { close(); go(href('/pretraga', { t: 'prodaja' })); return; }
      pushRecentQ(text);
      if (p.route && !Object.keys(p.filters || {}).length) { close(); go(p.route); return; }
      const params = S(() => filtersToParams(fullFilters(p.filters)), {});
      close(); go(href('/pretraga', params));
    }

    function opt(kind, node, data) {
      const id = 'kp-o-' + (st.items.length + 1);
      node.id = id; node.setAttribute('role', 'option'); node.setAttribute('aria-selected', 'false'); node.tabIndex = -1;
      node.classList.add('kp-opt', 'kp-' + kind);
      const it = { node, ...data };
      node.addEventListener('click', (e) => { e.preventDefault(); activate(it); });
      node.addEventListener('mousemove', () => { const j = st.items.indexOf(it); if (j !== st.cur) move(j); });
      st.items.push(it);
      return node;
    }
    const group = (title, nodes) => (nodes.length ? el('div', { class: 'kp-grp', role: 'group', 'aria-label': title }, el('p', { class: 'kp-t' }, title), nodes) : null);

    function paint() {
      if (!st) return;
      const text = st.input.value;
      const p = parse(text);
      st.parsed = p; st.items = []; st.cur = -1;
      st.input.removeAttribute('aria-activedescendant');
      /* čipovi */
      st.chips.replaceChildren(...(p.chips || []).map((c) => {
        const removable = c.key !== 'route' && c.key !== 'info';
        return el('span', { class: 'tag kp-chip' + (removable ? '' : ' static') }, c.label,
          removable ? el('button', { type: 'button', 'aria-label': 'Ukloni ' + c.label, onclick: () => { st.input.value = removeChip(st.input.value, c); paint(); st.input.focus(); } }, ic('x')) : null);
      }));
      st.chips.hidden = !(p.chips && p.chips.length);
      const groups = [];
      const hasFilters = Object.keys(p.filters || {}).length > 0;
      if (text.trim()) {
        const n = typeof p.count === 'number' ? p.count : countOf(p.filters);
        st.count.replaceChildren(el('b', { class: 'num' }, results(n)),
          el('span', {}, hasFilters ? (p.filters.t === 'izdavanje' ? ' · izdavanje' : ' · prodaja') : p.route ? ' · prečica' : ''));
        st.count.hidden = false;
        st.goBtn.textContent = n ? `Prikaži ${oglasa(n)}` : 'Prikaži pretragu';
        st.goBtn.disabled = false;
        if (p.route) {
          const g = GOTO.find((x) => x.h === p.route);
          const lbl = (p.chips.find((c) => c.key === 'route') || {}).label || (g && g.label) || 'Otvori';
          groups.push(group('Prečica', [opt('cmd', el('a', { href: p.route }, ic(g ? g.icon : 'arrow-right'), el('span', { class: 'l' }, lbl), el('span', { class: 'r' }, 'Enter')), { h: p.route })]));
        }
        if (hasFilters || !p.route) {
          const found = n ? filterList(p.filters).slice(0, 5) : [];
          groups.push(group(st.pick ? 'Izaberite oglas' : 'Oglasi', found.map((l) => opt('l', el('a', { href: '#/oglas?s=' + encodeURIComponent(l.s) },
            thumb(l, 48),
            el('span', { class: 'm' }, el('span', { class: 'l' }, titleOf(l)), el('span', { class: 's' }, placeOf(l))),
            el('span', { class: 'p num' }, priceOf(l))), { h: '#/oglas?s=' + encodeURIComponent(l.s), slug: l.s, recent: true }))));
          if (n > 5 && !st.pick) groups.push(group('', [opt('all', el('a', { href: '#' }, ic('list'), el('span', { class: 'l' }, `Svih ${oglasa(n)} u rezultatima`), el('span', { class: 'r' }, isMac ? '⌘ Enter' : 'Ctrl Enter')), { h: href('/pretraga', S(() => filtersToParams(fullFilters(p.filters)), {})), recent: true })]));
          if (!n && hasFilters) {
            const rel = (S(() => X().relax(fullFilters(p.filters)), []) || []).filter((r) => r && r.count > 0).slice(0, 3);
            st.count.appendChild(el('span', { class: 'kp-zero' }, rel.length ? ' — najmanja promena koja daje oglase:' : ' — pokušajte šire.'));
            groups.push(group('Najmanja promena', rel.map((r) => opt('relax', el('a', { href: '#' }, ic('refresh'), el('span', { class: 'l' }, r.label), el('span', { class: 'r num' }, oglasa(r.count))),
              { h: href('/pretraga', S(() => filtersToParams(fullFilters(r.filters)), {})), recent: true }))));
          }
        }
        const words = fold(text).split(/\s+/).filter((w) => w.length > 2);
        const gotos = GOTO.filter((g) => g.h !== p.route && words.some((w) => fold(g.label + ' ' + g.words).includes(w))).slice(0, 3);
        groups.push(group('Idi na', gotos.map((g) => opt('cmd', el('a', { href: g.h }, ic(g.icon), el('span', { class: 'l' }, g.label)), { h: g.h }))));
      } else {
        st.count.hidden = true;
        st.goBtn.textContent = 'Sve nekretnine na prodaju';
        const rec = recentQ();
        groups.push(group('Nedavne pretrage', rec.map((t) => opt('rec', el('button', { type: 'button' }, ic('clock'), el('span', { class: 'l' }, t), el('span', { class: 'r' }, 'dopuni')), { fill: t }))));
        const saved = (S(() => store.searches, []) || []).slice(0, 4);
        groups.push(group('Sačuvane pretrage', saved.map((s) => opt('saved', el('a', { href: href('/pretraga', s.params) }, ic('bookmark'), el('span', { class: 'l' }, s.name || 'Pretraga'), el('span', { class: 'r num' }, oglasa(paramsCount(s.params)))), { h: href('/pretraga', s.params) }))));
        groups.push(group('Brze pretrage', QUICK.map((qk) => opt('quick', el('a', { href: href('/pretraga', qk.params) }, ic('search'), el('span', { class: 'l' }, qk.label), el('span', { class: 'r num' }, oglasa(paramsCount(qk.params)))), { h: href('/pretraga', qk.params) }))));
        groups.push(group('Idi na', GOTO.slice(0, 6).map((g) => opt('cmd', el('a', { href: g.h }, ic(g.icon), el('span', { class: 'l' }, g.label)), { h: g.h }))));
      }
      if (st.pick) {
        /* u režimu izbora samo oglasi: bez prečica i „idi na” (vode van stranice) */
        for (let i = groups.length - 1; i >= 0; i--) if (groups[i] && !groups[i].querySelector('.kp-l,.kp-rec')) groups.splice(i, 1);
        st.items = st.items.filter((it) => it.slug || it.fill != null);
        const f = firstPick();
        st.goBtn.textContent = f ? 'Dodaj prvi oglas' : 'Upišite oglas koji dodajete';
        st.goBtn.disabled = !f;
      }
      st.list.replaceChildren(...groups.filter(Boolean));
      if (!st.items.length && st.pick && !text.trim()) st.list.appendChild(el('p', { class: 'kp-none' }, 'Upišite naselje, strukturu, cenu ili šifru oglasa — npr. „dvosoban vračar” — pa izaberite oglas koji dodajete u poređenje.'));
      else if (!st.items.length) st.list.appendChild(el('p', { class: 'kp-none' }, 'Nismo prepoznali nijednu reč. Probajte grad, opštinu, strukturu ili cenu — npr. „trosoban novi sad do 120k”.'));
    }

    return { open, close, isOpen: () => !!api, parse, removeChip };
  })();

  /* ═════════════════════════ 2) FIOKA „UPOREDI” ═════════════════════════ */
  const tray = (function () {
    const ROUTES = ['/pretraga', '/mapa', '/oglas'];
    let node = null, path = '/', collapsed = null, shownPath = null, lastAdder = null;
    const items = () => (S(() => store.compare, []) || []).map(findL).filter(Boolean);
    function ensure() {
      if (node && node.isConnected) return node;
      node = el('aside', { class: 'kv-tray', 'aria-label': 'Uporedi oglase', hidden: true });
      document.body.appendChild(node);
      return node;
    }
    /* koji kontrol u fioci ima fokus (da ga posle ponovnog crtanja vratimo na isto mesto) */
    function focusSpot(n) {
      const a = document.activeElement;
      if (!n || !a || !n.contains(a)) return null;
      for (const k of ['x', 'th']) { const all = [...n.querySelectorAll('.kv-tray-' + k)]; const i = all.indexOf(a); if (i >= 0) return { k, i }; }
      const c = ['go', 'clear', 'trash', 'fold', 'min'].find((k) => a.classList.contains('kv-tray-' + k));
      return { k: c || 'other', i: 0 };
    }
    function refocus(n, spot) {
      const q = (k) => [...n.querySelectorAll('.kv-tray-' + k)];
      let t = null;
      if (spot.k === 'x' || spot.k === 'th') { const all = q(spot.k); t = all[Math.min(spot.i, all.length - 1)] || null; }
      else if (spot.k === 'min') t = q('fold')[0] || q('x')[0] || null;
      else if (spot.k === 'fold') t = q('min')[0] || null;
      else t = q(spot.k)[0] || null;
      t = t || q('x')[0] || q('go')[0] || q('min')[0];
      if (t) S(() => t.focus({ preventScroll: true }));
    }
    function focusAway() {
      const t = (lastAdder && lastAdder.isConnected && !node.contains(lastAdder)) ? lastAdder : document.getElementById('main');
      if (t) S(() => t.focus({ preventScroll: true }));
    }
    const clearAll = () => { S(() => store.clearCompare()); S(() => toast('Poređenje je ispražnjeno')); };
    function update(p) {
      if (p != null) path = p;
      const list = items();
      const show = list.length > 0 && ROUTES.includes(path);
      const n = ensure();
      const spot = focusSpot(n);
      n.hidden = !show;
      document.body.classList.toggle('has-tray', show);
      if (!show) { n.replaceChildren(); if (spot) focusAway(); return; }
      const phone = S(() => matchMedia('(max-width:600px)').matches, false);
      if (collapsed === null || path !== shownPath) collapsed = phone && path === '/mapa';   /* mapa na telefonu: skupljeno, da ne pokrije karusel */
      if (!phone) collapsed = false;
      shownPath = path;
      n.classList.toggle('is-min', !!collapsed);
      n.classList.toggle('on-map', path === '/mapa');
      const ids = list.map((l) => l.s).join(',');
      const cmpHref = '#/uporedi?ids=' + ids;
      const label = `Uporedi (${list.length})`;
      if (collapsed) {
        n.replaceChildren(el('button', { class: 'kv-tray-min', type: 'button', 'aria-expanded': 'false', 'aria-label': `Uporedi, ${oglasa(list.length)} — otvori fioku`, onclick: () => { collapsed = false; update(); } },
          ic('compare'), el('span', {}, 'Uporedi'), el('b', { class: 'num' }, String(list.length))));
        if (spot) refocus(n, spot);
        return;
      }
      n.replaceChildren(
        el('div', { class: 'kv-tray-in' },
          el('p', { class: 'kv-tray-t' }, el('b', {}, 'Uporedi'), el('span', { class: 'num' }, `${list.length} od 4`)),
          el('ul', { class: 'kv-tray-list' }, list.map((l) => el('li', {},
            el('a', { class: 'kv-tray-th', href: '#/oglas?s=' + encodeURIComponent(l.s), title: titleOf(l) }, thumb(l, 48), el('span', { class: 'sr' }, titleOf(l))),
            el('button', { class: 'kv-tray-x', type: 'button', 'aria-label': 'Ukloni iz poređenja: ' + titleOf(l), onclick: () => S(() => store.toggleCompare(l.s)) }, ic('x', 14)))),
          Array.from({ length: Math.max(0, Math.min(4, 4 - list.length)) }, () => el('li', { class: 'kv-tray-empty', 'aria-hidden': 'true' }))),
          el('div', { class: 'kv-tray-act' },
            el('button', { class: 'btn btn-ghost btn-sm kv-tray-clear', type: 'button', onclick: clearAll }, 'Isprazni'),
            list.length < 2
              ? el('button', { class: 'btn btn-primary btn-sm kv-tray-go', type: 'button', disabled: true, 'aria-disabled': 'true', title: 'Za poređenje su potrebna bar dva oglasa' }, label)
              : el('a', { class: 'btn btn-primary btn-sm kv-tray-go', href: cmpHref }, label),
            phone ? el('button', { class: 'iconbtn kv-tray-trash', type: 'button', 'aria-label': 'Isprazni poređenje', onclick: clearAll }, ic('trash')) : null,
            phone ? el('button', { class: 'iconbtn kv-tray-fold', type: 'button', 'aria-label': 'Skupi fioku', 'aria-expanded': 'true', onclick: () => { collapsed = true; update(); } }, ic('chev-d')) : null)),
        ...(list.length < 2 ? [el('p', { class: 'kv-tray-hint' }, 'Dodajte još jedan oglas da biste uporedili.')] : []));
      if (spot) refocus(n, spot);
    }
    /* ko je poslednji dodao u poređenje (dugme na kartici/oglasu): tamo vraćamo fokus kad se fioka isprazni */
    S(() => store.on((what) => {
      if (what !== 'compare') return;
      const a = document.activeElement;
      if (a && a !== document.body && !(node && node.contains(a))) lastAdder = a;
    }));
    S(() => store.on((what) => { if (what === 'compare') update(); }));
    return { update, items };
  })();

  /* ═════════════════════════ 3) PRIVATNOST (ZZPL) ═════════════════════════ */
  const NOTICE_KEY = 'kv.privacy';
  const notice = (function () {
    let node = null;
    let ro = null;
    const measure = () => S(() => { if (node) document.body.style.setProperty('--kv-notice-h', Math.ceil(node.getBoundingClientRect().height) + 'px'); });
    /* nikad preko donje trake sa pozivom (.cta-bar), fioke „Uporedi” ni donje navigacije: obaveštenje se slaže iznad
       najvišeg takvog elementa koji se horizontalno preklapa sa njim (telefon i desktop) */
    let mo = null, raf = 0;
    function place() {
      raf = 0;
      if (!node) return;
      S(() => {
        node.style.bottom = '';
        const vh = window.innerHeight, base = node.getBoundingClientRect();
        let minTop = Infinity;
        document.querySelectorAll('.cta-bar, .kv-tray, .bnav').forEach((o) => {
          if (o.hidden || !o.isConnected) return;
          const cs = getComputedStyle(o); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position !== 'fixed') return;
          const r = o.getBoundingClientRect();
          if (!r.height || r.top < vh / 2 || r.right <= base.left || r.left >= base.right) return;
          if (r.top < minTop) minTop = r.top;
        });
        if (minTop < base.bottom + 8) node.style.bottom = Math.ceil(vh - minTop + 8) + 'px';
        const b = node.getBoundingClientRect();
        document.body.style.setProperty('--kv-notice-b', Math.max(0, Math.round(vh - b.bottom)) + 'px');
      });
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
    function dismiss() {
      lsSet(NOTICE_KEY, { ok: 1, at: new Date().toISOString().slice(0, 10) });
      S(() => ro && ro.disconnect()); ro = null;
      S(() => mo && mo.disconnect()); mo = null; window.removeEventListener('resize', schedule);
      S(() => document.body.style.removeProperty('--kv-notice-b'));
      if (node) { node.remove(); node = null; }
      document.body.classList.remove('has-notice'); S(() => document.body.style.removeProperty('--kv-notice-h'));
    }
    function show() {
      if (node || lsGet(NOTICE_KEY, null)) return;
      node = el('section', { class: 'kv-notice', role: 'region', 'aria-label': 'Privatnost' },
        el('p', {}, el('b', {}, 'Bez kolačića za praćenje. '),
          'Sačuvane oglase, pretrage i podešavanja čuvamo samo u ovom pregledaču, u skladu sa Zakonom o zaštiti podataka o ličnosti. ',
          el('a', { class: 'link', href: '#/privatnost', onclick: () => dismiss() }, 'Šta tačno čuvamo')),
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: dismiss }, 'Razumem'));
      document.body.appendChild(node);
      document.body.classList.add('has-notice');
      measure();
      S(() => { ro = new ResizeObserver(() => { measure(); schedule(); }); ro.observe(node); });   /* obaveštenja (toast) idu iznad njega */
      /* promena stranice, fioke ili donje trake → ponovo složi */
      S(() => { mo = new MutationObserver(schedule); mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-bnav'] }); mo.observe(document.getElementById('app') || document.body, { childList: true }); });
      window.addEventListener('resize', schedule, { passive: true });
      schedule(); setTimeout(schedule, 300);
    }
    return { show, dismiss, place: schedule };
  })();

  /* ═════════════════════════ 5) TASTATURA ═════════════════════════ */
  const keys = (function () {
    /* samo ⌘K / Ctrl+K, „/” i Esc — bez drugih globalnih prečica (istraživanje: bez j/k/f/h i sekvenci) */
    const openOverlays = () => [...document.querySelectorAll('.modal.in,.sheet.in,.lightbox')];
    function closeTop(top) {
      if (top.classList.contains('kp-dlg') && palette.isOpen()) { palette.close(); return true; }
      const btn = top.querySelector('.hd button, .lb-close, [aria-label="Zatvori"]');
      if (btn) { btn.click(); return true; }
      return false;
    }
    /* faza hvatanja: kad su dva sloja jedan preko drugog (npr. paleta preko lista), Esc zatvara samo gornji */
    function onEscCapture(e) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const open = openOverlays();
      if (open.length < 2) return;
      if (closeTop(open[open.length - 1])) { e.preventDefault(); e.stopImmediatePropagation(); }
    }
    function onKey(e) {
      if (e.defaultPrevented) return;
      const k = e.key;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (k === 'k' || k === 'K')) { e.preventDefault(); palette.isOpen() ? palette.close() : palette.open(); return; }
      if (k === 'Escape') {
        /* rezervni Esc: ui.modal/sheet ga već obrađuju (preventDefault); ovde samo ono što ostane otvoreno */
        const top = openOverlays().pop();
        if (top && closeTop(top)) e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.body.classList.contains('modal-open') || document.body.classList.contains('sheet-open')) return;
      if (k === '/') { e.preventDefault(); palette.open(); }
    }
    document.addEventListener('keydown', onEscCapture, true);
    document.addEventListener('keydown', onKey);
    return { onKey };
  })();

  /* ═════════════════════════ 6) MREŽA ═════════════════════════ */
  window.addEventListener('offline', () => S(() => toast('Nema veze sa internetom. Kvadrat i dalje radi — svi oglasi su već u pregledaču.')));
  window.addEventListener('online', () => S(() => toast('Veza sa internetom je ponovo uspostavljena.')));

  /* ═════════════════════════ 4) KAKO RAČUNAMO ═════════════════════════ */
  const SOURCES = [
    ['RGZ — eKatastar (javni uvid)', 'https://katastar.rgz.gov.rs/eKatastarPublic/', 'Provera uknjiženosti, tereta i površine po adresi ili broju parcele. Na nju vodi dugme „Proveri u eKatastru” na oglasu.'],
    ['RGZ — Registar cena nepokretnosti', 'https://katastar.rgz.gov.rs/RegistarCenaNepokretnosti/', 'Ostvarene (ugovorene) cene prometa. Naše cene su tražene cene iz oglasa i po pravilu su 10–30 % više.'],
    ['Republički geodetski zavod', 'https://www.rgz.gov.rs/', 'Kvartalni indeks cena stanova i besplatna procena vrednosti iz katastra.'],
    ['Narodna banka Srbije', 'https://www.nbs.rs/', 'Pravila za stambene kredite: učešće najmanje 20 %, odnosno 10 % za prvi stan; rata do 60 % primanja (banke najčešće traže 50 %).'],
    ['Poreska uprava', 'https://www.purs.gov.rs/', 'Porez na prenos apsolutnih prava (2,5 %), povraćaj PDV-a za prvi stan (obrazac RFN), porez na imovinu.'],
    ['Zakon o posebnim uslovima za evidentiranje i upis prava na nepokretnostima (Sl. glasnik RS 91/2025)', 'https://www.paragraf.rs/propisi_download/zakon-o-posebnim-uslovima-za-evidentiranje-i-upis-prava-na-nepokretnostima.pdf', 'Novo pravno stanje „upisano po posebnom zakonu”, bez garancije bezbednosti objekta; banke ga finansiraju po sopstvenoj proceni.'],
  ];
  function formulas() {
    const ex = (fn) => S(fn, null);
    const rata = ex(() => fmt.price(KX.annuity(80000, 5, 25), 'izdavanje').replace('/mes', ' mesečno'))
      || ex(() => fmt.price(mortgage(80000, 5, 25).monthly, 'izdavanje').replace('/mes', ' mesečno')) || '468 € mesečno';
    return [
      { t: 'Porez na prenos apsolutnih prava', p: 'Kod kupovine stana od fizičkog lica (starogradnja) plaća se 2,5 % od ugovorene cene. Zakonski obveznik je prodavac, ali se ugovorom gotovo uvek prebacuje na kupca — zato ga računamo kupcu, a u profilu možete da promenite ko plaća. Poreska uprava u roku od 60 dana može da utvrdi veću, tržišnu osnovicu.',
        f: 'porez = 2,5 % × cena', e: 'Stan od 100.000 € → 2.500 € poreza. Kupac prvog stana ne plaća porez na 40 m² + 15 m² za svakog sledećeg člana domaćinstva; za stan od 60 m² i dvočlano domaćinstvo oslobođeno je 55 od 60 m².' },
      { t: 'PDV u novogradnji', p: 'Investitori oglašavaju cene sa uračunatim PDV-om, pa ga ne dodajemo ponovo. Ako oglas kaže da je cena bez PDV-a, prekidačem na oglasu dodajete 10 %. Kupac prvog stana od investitora ima pravo na povraćaj PDV-a za isti broj kvadrata; novac stiže oko 45 dana posle kupovine, pa ga ne odbijamo od iznosa potrebnog na dan kupovine, već ga prikazujemo kao kasniji priliv.',
        f: 'neto cena = cena ÷ 1,10 · povraćaj = neto cena × 10 % × (oslobođeni m² ÷ m²)', e: 'Uslovi: prva kupovina od investitora, državljanin Srbije koji od 1. jula 2006. nije imao stan, članovi domaćinstva prijavljeni na istoj adresi, cela cena plaćena na račun prodavca.' },
      { t: 'Provizija agencije', p: 'Zakon ne propisuje iznos provizije. U praksi je 2–3 % od cene plus PDV od 20 %, a plaća je onaj ko je potpisao posrednički ugovor; agencija je dužna da jasno objavi iznos i ko plaća. Kod zakupa je uobičajeno 40–50 % jedne kirije, a u Beogradu je često plaća vlasnik.',
        f: 'provizija = procenat × cena × 1,20', e: 'Stan od 100.000 € uz 2 % → 2.000 € + 400 € PDV = 2.400 €. Oglas vlasnika: 0 €.' },
      { t: 'Rata kredita', p: 'Računamo standardni anuitet. Učešće je podrazumevano 20 % (10 % za prvi stan, kako NBS dozvoljava), kamata 5 %, rok 25 godina — sve se menja u profilu i kalkulatoru. Banka finansira uknjiženu nepokretnost; za stan u procesu uknjižavanja ili upisan po Zakonu iz 2025. odluka zavisi od banke, a neuknjižen ili u postupku ozakonjenja kupuje se samo kešom.',
        f: 'rata = kredit × i ÷ (1 − (1 + i)^−n), i = godišnja kamata ÷ 12, n = godine × 12', e: `Kredit od 80.000 € na 25 godina uz 5 % → ${rata}.` },
      { t: 'Δ naspram proseka opštine', p: 'Uz svaku cenu po kvadratu stoji čip koji kaže koliko je oglas iznad ili ispod medijane iste opštine, za isti tip nekretnine. Unutar ±1,5 % smatramo da je u proseku. Kada u opštini nema bar 5 uporedivih oglasa, čip ne prikazujemo.',
        f: 'Δ = (€/m² oglasa ÷ medijana €/m² opštine − 1) × 100 %', e: 'Stan od 2.800 €/m² u opštini sa medijanom 2.555 €/m² → +9,6 %.' },
      { t: 'Fer cena', p: 'Za svaki oglas biramo do 8 najsličnijih oglasa istog tipa u istom gradu (blizina, kvadratura, broj soba, naselje). Medijana njihove cene po m² — ponderisana blizinom i korigovana za sprat, stanje, grejanje, terasu i energetski razred — daje procenu sa opsegom ±6 %. Ispod 5 uporedivih oglasa ne izričemo ocenu.',
        f: 'procena = medijana(€/m² uporedivih) × korekcije × m² · opseg ±6 %', e: 'Ako je oglas 8 % iznad gornje granice, pregovarač to navodi kao prvi argument za nižu ponudu.' },
      { t: 'Semafor poverenja', p: 'Za prodaju boja zavisi od pravnog stanja: uknjiženo, u procesu uknjižavanja, upisano po posebnom zakonu iz 2025, u postupku ozakonjenja i neuknjiženo — uz zastavice kao što su hipoteka i suvlasništvo. Za zakup sabiramo znake rizika od prevare (kirija mnogo ispod proseka, malo fotografija, uplata unapred, vlasnik u inostranstvu…).',
        f: 'zakup: zbir bodova < 20 zeleno · 20–44 žuto · ≥ 45 crveno', e: 'Pravno stanje u demo podacima je simulirano — pre kapare uvek proverite list nepokretnosti u eKatastru.' },
    ];
  }

  function viewLedger() {
    const rows = (S(() => X().ledger, null) || []).filter((r) => r && r.feature);
    const nReal = rows.filter((r) => r.real).length, nDemo = rows.length - nReal;
    let mode = 'sve';
    const statusTag = (real) => el('span', { class: 'kr-st ' + (real ? 'is-real' : 'is-demo') }, real ? 'Iz podataka' : 'Demo procena');
    const tbody = el('tbody');
    const paintRows = () => tbody.replaceChildren(...rows.filter((r) => mode === 'sve' || (mode === 'real') === !!r.real).map((r) =>
      el('tr', {}, el('th', { scope: 'row' }, r.feature), el('td', { class: 'kr-stc' }, statusTag(r.real)), el('td', {}, r.how))));
    paintRows();
    const filter = S(() => pills([{ v: 'sve', l: `Sve · ${rows.length}` }, { v: 'real', l: `Iz podataka · ${nReal}` }, { v: 'demo', l: `Demo · ${nDemo}` }], ['sve'],
      (v, on, all) => { mode = (all && all[0]) || v || 'sve'; paintRows(); }, { single: true }), null);
    const table = rows.length
      ? el('div', { class: 'kr-tablewrap' }, el('table', { class: 'table kr-table' },
        el('caption', { class: 'sr' }, 'Šta se računa iz podataka, a šta je demo procena'),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Funkcija'), el('th', { scope: 'col' }, 'Poreklo'), el('th', { scope: 'col' }, 'Kako'))), tbody))
      : el('p', { class: 'kr-note' }, 'Spisak funkcija trenutno nije dostupan (modul za proračune nije učitan). Formule ispod važe za ceo sajt.');
    /* opštine u kojima postoji medijana (bar 5 oglasa) — samo tamo se prikazuje čip Δ */
    const nMed = S(() => { const c = {}; D.listings.forEach((l) => { c[l.ms] = (c[l.ms] || 0) + 1; }); return D.muns.filter((m) => (c[m.s] || 0) >= 5).length; }, 0);
    const tilesNode = S(() => tiles([
      { v: N0(S(() => D.listings.length, 660)), l: 'oglasa u bazi' },
      { v: String(nReal || '—'), l: 'funkcija iz podataka' },
      { v: String(nDemo || '—'), l: 'demo procena' },
      { v: N0(nMed), l: `${plural(nMed, 'opština', 'opštine', 'opština')} sa medijanom (≥ 5 oglasa)` },
    ]), null);

    return el('div', { class: 'wrap kr' },
      S(() => crumbs([{ label: 'Početna', href: '#/' }, { label: 'Kako računamo' }]), null),
      el('header', { class: 'kr-head' },
        el('p', { class: 'eyebrow' }, 'Metodologija'),
        el('h1', { class: 't-h1' }, 'Kako računamo'),
        el('p', { class: 'lede' }, 'Svaki broj na Kvadratu ima poreklo. Ovde piše šta je izračunato iz oglasa, šta je demo procena i po kojoj formuli — da biste mogli da proverite, a ne da verujete na reč.'),
        tilesNode),
      el('section', { class: 'section kr-sec' },
        S(() => sectionHead('Šta je stvarno, a šta procena', 'Oznaka „Iz podataka” znači da broj nastaje iz polja oglasa ili statistike nad svih ' + N0(S(() => D.listings.filter((l) => !l.syn).length, 660)) + ' oglasa (bez ponovljenih). „Demo procena” je deterministička simulacija tamo gde pravi podaci ne postoje u ovoj verziji.'), el('h2', { class: 't-h2' }, 'Šta je stvarno, a šta procena')),
        filter ? el('div', { class: 'kr-filter', role: 'group', 'aria-label': 'Prikaži' }, filter) : null,
        table),
      el('section', { class: 'section kr-sec' },
        S(() => sectionHead('Formule', 'Napisane običnim jezikom, sa primerom. Isti proračuni stoje iza oglasa, kalkulatora i poređenja.'), el('h2', { class: 't-h2' }, 'Formule')),
        el('div', { class: 'kr-forms' }, formulas().map((x) => el('article', { class: 'kr-f' },
          el('h3', { class: 't-h3' }, x.t), el('p', {}, x.p),
          el('p', { class: 'kr-eq' }, x.f),
          el('p', { class: 'kr-ex' }, el('span', { class: 'label' }, 'Primer'), ' ', x.e))))),
      el('section', { class: 'section kr-sec' },
        S(() => sectionHead('Izvori', 'Zvanični izvori na koje se oslanjamo i gde možete sami da proverite podatke.'), el('h2', { class: 't-h2' }, 'Izvori')),
        el('ol', { class: 'kr-src' }, SOURCES.map(([n, u, d]) => el('li', {},
          el('a', { class: 'kr-src-a', href: u, target: '_blank', rel: 'noopener noreferrer' }, el('span', {}, n), ic('external', 16)),
          el('p', { class: 'meta' }, d),
          el('p', { class: 'kr-url' }, el('span', { class: 'kr-u' }, u), S(() => copyButton(u, { label: 'Kopiraj adresu' }), null))))),
        el('p', { class: 'kr-note' }, 'Oglasi, agencije i cene na ovom sajtu su generisani za potrebe prikaza. Formule i propisi su stvarni; iznosi u primerima su zaokruženi.')));
  }

  /* ═════════════════════════ 7) 404, U IZRADI, GREŠKA ═════════════════════════ */
  function frame(cls, eyebrow, title, text, actions, extra) {
    return el('div', { class: 'wrap kv-state ' + cls },
      el('div', { class: 'kv-state-in' },
        el('p', { class: 'eyebrow' }, eyebrow),
        el('h1', { class: 't-h1' }, title),
        el('p', { class: 'lede' }, text),
        actions ? el('div', { class: 'btn-row kv-state-act' }, actions) : null),
      extra || null);
  }
  const quickBlock = (title) => el('section', { class: 'kv-state-more' }, el('p', { class: 'label' }, title || 'Brze pretrage'), quickList());
  const paletteBtn = (label) => el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => palette.open() }, ic('search'), label || 'Brza pretraga');

  function viewNotFound(q, path) {
    const p = path || S(() => parseHash().path, '');
    return frame('kv-404', 'Greška 404', 'Ova stranica ne postoji',
      ['Adresa ', el('b', { class: 'kv-path' }, '#' + p), ' ne vodi nigde. Možda je link zastareo ili u njemu postoji greška u kucanju.'],
      [el('a', { class: 'btn btn-primary', href: '#/' }, 'Na početnu'), paletteBtn('Potraži nekretninu')],
      quickBlock());
  }
  function viewPlaceholder(q, path, name) {
    return frame('kv-wip', 'U izradi', 'Stranica je u izradi',
      ['Deo ', el('b', { class: 'kv-path' }, name || ('#' + (path || ''))), ' još pravimo. Do tada su vam na raspolaganju pretraga, mapa i alati.'],
      [el('a', { class: 'btn btn-primary', href: '#/' }, 'Na početnu'), paletteBtn()],
      quickBlock('Probajte umesto toga'));
  }
  function viewError(err, path) {
    const msg = String((err && (err.message || err)) || 'Nepoznata greška').slice(0, 300);
    const report = () => [`Kvadrat.rs — prijava greške`, `Ruta: ${location.hash || '#/'}`, `Greška: ${msg}`,
      `Stek: ${String((err && err.stack) || '').split('\n').slice(0, 4).join(' | ')}`, `Pregledač: ${S(() => navigator.userAgent, '')}`, `Vreme: ${new Date().toISOString()}`].join('\n');
    const copyBtn = el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(report()); ok = true; } catch (e) { ok = false; }
      if (!ok) { const ta = node.querySelector('.kv-err-raw'); if (ta) { ta.hidden = false; ta.select(); } }
      S(() => toast(ok ? 'Opis greške je kopiran — pošaljite ga na podrska@kvadrat.rs' : 'Kopiranje nije uspelo — označen je tekst ispod, kopirajte ga ručno'));
    } }, ic('copy'), 'Prijavi grešku');
    const node = frame('kv-err', 'Greška na stranici', 'Nešto je pošlo naopako',
      ['Stranica ', el('b', { class: 'kv-path' }, '#' + (path || '')), ' nije mogla da se prikaže. Vaši sačuvani oglasi i pretrage su netaknuti.'],
      [copyBtn, el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => S(() => window.KVApp.render(null, { force: true })) }, ic('refresh'), 'Pokušajte ponovo'), el('a', { class: 'btn btn-ghost', href: '#/' }, 'Na početnu')],
      el('div', { class: 'kv-err-box' }, el('p', { class: 'label' }, 'Tehnički opis'), el('p', { class: 'kv-err-msg' }, msg),
        el('textarea', { class: 'input kv-err-raw', readonly: true, hidden: true, rows: 5, 'aria-label': 'Opis greške za kopiranje' }, report())));
    return node;
  }

  /* ═════════════════════════ info stranice (linkovi iz podnožja) ═════════════════════════ */
  const STORE_KEYS = [
    ['kv.favs', 'Sačuvani oglasi'], ['kv.compare', 'Oglasi za poređenje'], ['kv.recent', 'Nedavno pogledani oglasi'], ['kv.searches', 'Sačuvane pretrage'],
    ['kv.recentq', 'Nedavne brze pretrage'], ['kv.notes', 'Vaše beleške uz oglase'], ['kv.profile', 'Budžet, primanja i moja mesta'], ['kv.checks', 'Čekirane provere na oglasima'],
    ['kv.messages', 'Poruke poslate oglašivačima'], ['kv.viewings', 'Zakazani obilasci'], ['kv.reports', 'Vaše prijave oglasa'], ['kv.draft', 'Nacrt oglasa u izradi'],
    ['kv.ratings', 'Vaše ocene oglasa'], ['kv.agencyReviews', 'Vaše ocene agencija'], ['kv.recentSearches', 'Nedavne pretrage sa početne'], ['kv.searchMeta', 'Podaci o sačuvanim pretragama'],
    ['kv.theme', 'Svetla ili tamna tema'], ['kv.privacy', 'Da ste pročitali ovo obaveštenje'],
  ];
  function lsSize(k) { try { const v = localStorage.getItem(k); return v == null ? null : v.length; } catch (e) { return null; } }
  function allKvKeys() { try { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('kv.')) out.push(k); } return out; } catch (e) { return []; } }

  function privacyBody() {
    const tbl = el('tbody');
    const paint = () => {
      const known = new Set(STORE_KEYS.map((x) => x[0]));
      const rows = STORE_KEYS.concat(allKvKeys().filter((k) => !known.has(k)).map((k) => [k, 'Podešavanje stranice']));
      tbl.replaceChildren(...rows.map(([k, l]) => { const n = lsSize(k); return el('tr', {}, el('th', { scope: 'row' }, l), el('td', {}, el('span', { class: 'kv-key' }, k)), el('td', { class: 'num' }, n == null ? 'ništa' : `${N0(n)} znakova`)); }));
    };
    paint();
    const confirmRow = el('div', { class: 'kv-confirm', hidden: true },
      el('p', {}, 'Brišemo sačuvane oglase, pretrage, beleške, poruke, zakazane obilaske, nacrt oglasa, profil i podešavanja iz ovog pregledača. Ovo ne može da se vrati.'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => {
          allKvKeys().forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* */ } });
          S(() => { [...store.favs].forEach((s) => store.toggleFav(s)); });
          S(() => store.clearCompare());
          S(() => { (store.searches || []).slice().forEach((x) => store.removeSearch(x.id)); });
          S(() => { Object.keys(store.notes || {}).forEach((s) => store.setNote(s, '')); });
          S(() => { if (Array.isArray(store.recent)) store.recent.length = 0; });
          S(() => X().profile.reset());
          allKvKeys().forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* */ } });
          confirmRow.hidden = true; paint(); S(() => toast('Vaši podaci su obrisani iz ovog pregledača.'));
        } }, 'Da, obrišite sve'),
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { confirmRow.hidden = true; } }, 'Odustani')));
    return [
      el('p', {}, 'Kvadrat.rs nema korisničke naloge, ne koristi kolačiće za praćenje, oglašivačke mreže ni analitiku. Sve što sačuvate ostaje u lokalnoj memoriji vašeg pregledača (localStorage) i nikada ne napušta vaš uređaj.'),
      el('p', {}, 'Ovo je spisak onoga što je sačuvano upravo sada:'),
      el('div', { class: 'kr-tablewrap' }, el('table', { class: 'table kv-keys' }, el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Šta'), el('th', { scope: 'col' }, 'Ključ'), el('th', { scope: 'col', class: 'num' }, 'Veličina'))), tbl)),
      el('div', { class: 'btn-row kv-gap' }, el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { confirmRow.hidden = false; } }, ic('trash'), 'Obriši moje podatke')),
      confirmRow,
      el('h2', { class: 't-h2s' }, 'Vaša prava'),
      el('p', {}, 'Prema Zakonu o zaštiti podataka o ličnosti imate pravo na uvid, ispravku i brisanje podataka. Pošto podatke ne prikupljamo na serveru, sve to radite sami — dugmetom iznad ili brisanjem podataka sajta u podešavanjima pregledača.'),
    ];
  }
  const contact = (label, value) => el('div', { class: 'kv-contact' }, el('p', { class: 'label' }, label), el('p', { class: 'kv-cv' }, el('span', { class: 'num' }, value), S(() => copyButton(value, { label: 'Kopiraj' }), null)));
  function reportBody() {
    const ref = el('input', { class: 'input', id: 'kv-rep-ref', placeholder: 'npr. KV-1112899', autocomplete: 'off' });
    const err = el('p', { class: 'help err', id: 'kv-rep-err', hidden: true }, 'Unesite šifru oglasa (npr. KV-1112899) ili link.');
    const setErr = (on) => { err.hidden = !on; if (on) { ref.setAttribute('aria-invalid', 'true'); ref.setAttribute('aria-describedby', 'kv-rep-err'); } else { ref.removeAttribute('aria-invalid'); ref.removeAttribute('aria-describedby'); } };
    ref.addEventListener('input', () => { if (ref.value.trim()) setErr(false); });
    const txt = el('textarea', { class: 'input kv-ta', id: 'kv-rep-txt', rows: 4, placeholder: 'Šta nije u redu sa oglasom?' });
    let reason = 'netacno';
    const reasons = [{ v: 'netacno', l: 'Netačni podaci' }, { v: 'prodato', l: 'Već prodato ili izdato' }, { v: 'agencija', l: 'Agencija se predstavlja kao vlasnik' }, { v: 'prevara', l: 'Sumnja na prevaru' }, { v: 'duplikat', l: 'Isti oglas više puta' }];
    const done = el('p', { class: 'kv-done', role: 'status', hidden: true });
    const reasonPills = S(() => pills(reasons, [reason], (v, on, all) => { reason = (all && all[0]) || v; }, { single: true }), null);
    S(() => reasonPills.setAttribute('aria-labelledby', 'kv-rep-why'));
    const form = el('form', { class: 'kv-form', onsubmit: (e) => {
      e.preventDefault();
      const r = ref.value.trim();
      if (!r) { setErr(true); ref.focus(); return; }
      setErr(false);
      const list = lsGet('kv.reports', []) || []; list.unshift({ ref: r, reason, text: txt.value.trim(), at: new Date().toISOString() }); lsSet('kv.reports', list.slice(0, 20));
      done.hidden = false; done.textContent = `Hvala. Prijava za ${r} je zabeležena (u ovoj demo verziji ostaje u vašem pregledaču). Moderatori odgovaraju u roku od 24 sata.`;
      form.reset(); reason = 'netacno'; S(() => reasonPills.set([reason]));
    } },
      el('div', {}, S(() => field('Šifra ili link oglasa', ref), el('label', {}, 'Šifra oglasa', ref)), err),
      el('div', { class: 'kv-fld' }, el('p', { class: 'label', id: 'kv-rep-why' }, 'Razlog'), reasonPills),
      S(() => field('Opis (nije obavezno)', txt), txt),
      el('div', { class: 'btn-row' }, el('button', { class: 'btn btn-primary', type: 'submit' }, 'Pošalji prijavu')),
      done);
    return [el('p', {}, 'Prijavite oglas koji je netačan, zastareo ili sumnjiv. Za prijavu nije potreban nalog.'), form];
  }
  const INFO = {
    '/privatnost': { eyebrow: 'Privatnost', title: 'Šta čuvamo i gde', lede: 'Kratko i bez sitnih slova: ništa o vama ne šaljemo na server.', body: privacyBody },
    '/uslovi': { eyebrow: 'Uslovi korišćenja', title: 'Uslovi korišćenja', lede: 'Pravila za korišćenje Kvadrat.rs u ovoj demo verziji.', body: () => [
      el('p', {}, 'Kvadrat.rs je demonstracija portala za nekretnine. Oglasi, agencije, kontakti i cene su generisani i ne predstavljaju stvarne ponude. Ne uplaćujte novac i ne zakazujte obilaske na osnovu ovih oglasa.'),
      el('h2', { class: 't-h2s' }, 'Procene i proračuni'),
      el('p', {}, ['Troškovi kupovine, rata kredita, fer cena i semafor poverenja su informativne procene, a ne pravni ili finansijski savet. Formule su objavljene na stranici ', el('a', { class: 'link', href: '#/kako-racunamo' }, 'Kako računamo'), '. Pre kupovine proverite list nepokretnosti u eKatastru i posavetujte se sa advokatom ili bankom.']),
      el('h2', { class: 't-h2s' }, 'Oglašivači'),
      el('p', {}, 'Agencije su dužne da u oglasu jasno navedu iznos provizije i ko je plaća, kao i broj iz Registra posrednika. Oglasi koji se lažno predstavljaju kao oglasi vlasnika uklanjaju se po prijavi.'),
    ] },
    '/pomoc': { eyebrow: 'Pomoć', title: 'Česta pitanja', lede: 'Najkraći put do odgovora — i prečice koje štede vreme.', body: () => [
      ...[
        ['Kako da pretražujem rečima?', ['Pritisnite ', el('kbd', {}, isMac ? '⌘ K' : 'Ctrl K'), ' ili ', el('kbd', {}, '/'), ' i ukucajte npr. „dvosoban vračar do 150k uknjižen”. Videćete prepoznate filtere i broj oglasa pre nego što pritisnete Enter.']],
        ['Šta znači čip pored cene po m²?', ['Koliko je oglas iznad (↑) ili ispod (↓) medijane cene po m² u istoj opštini. Detalji su na stranici ', el('a', { class: 'link', href: '#/kako-racunamo' }, 'Kako računamo'), '.']],
        ['Kako da uporedim stanove?', 'Na kartici ili oglasu dodajte do četiri oglasa u poređenje. Fioka „Uporedi” se pojavljuje pri dnu ekrana; dugme „Uporedi” otvara tabelu u kojoj je označeno ko pobeđuje u kom redu.'],
        ['Da li su oglasi stvarni?', 'Ne. Ovo je demo verzija sa ' + N0(S(() => D.listings.length, 660)) + ' generisanih oglasa u ' + N0(S(() => D.cities.length, 34)) + ' grada; proračuni i formule su stvarni.'],
        ['Gde se čuvaju moji podaci?', ['Samo u vašem pregledaču. Spisak i dugme za brisanje su na stranici ', el('a', { class: 'link', href: '#/privatnost' }, 'Privatnost'), '.']],
      ].map(([t, b], i) => S(() => accordion(t, el('p', {}, b), i === 0), el('div', {}, el('h3', { class: 't-h3' }, t), el('p', {}, b)))),
      el('h2', { class: 't-h2s kv-gap' }, 'Prečice sa tastature'),
      el('dl', { class: 'kv-keys-dl' },
        [[isMac ? '⌘ K' : 'Ctrl K', 'Brza pretraga'], ['/', 'Brza pretraga (kad ne kucate u polje)'], ['Esc', 'Zatvara prozor ili list (samo gornji, ako ih je više)']]
          .map(([k, d]) => el('div', {}, el('dt', {}, el('kbd', {}, k)), el('dd', {}, d)))),
    ] },
    '/kontakt': { eyebrow: 'Kontakt', title: 'Pišite nam', lede: 'Odgovaramo radnim danima od 9 do 17 h, najčešće istog dana.', body: () => [
      el('div', { class: 'kv-contacts' }, contact('Podrška korisnicima', 'podrska@kvadrat.rs'), contact('Oglašavanje za agencije', 'agencije@kvadrat.rs'), contact('Telefon', '011 400 12 34')),
      el('p', { class: 'kr-note' }, 'Kontakti su demo — adrese i broj nisu aktivni. Prikazani su kao tekst koji možete da označite i kopirate.'),
    ] },
    '/prijava': { eyebrow: 'Prijavi oglas', title: 'Prijavi oglas', lede: 'Pomozite nam da oglasi ostanu tačni.', body: reportBody },
  };
  function viewInfo(q, path) {
    const p = INFO[path];
    if (!p) return viewNotFound(q, path);
    return el('div', { class: 'wrap kv-info' },
      S(() => crumbs([{ label: 'Početna', href: '#/' }, { label: p.eyebrow }]), null),
      el('header', { class: 'kr-head' }, el('p', { class: 'eyebrow' }, p.eyebrow), el('h1', { class: 't-h1' }, p.title), el('p', { class: 'lede' }, p.lede)),
      el('div', { class: 'prose kv-info-body' }, S(() => p.body(q), [])),
      el('nav', { class: 'kv-info-nav', 'aria-label': 'Pomoć i pravila' }, Object.keys(INFO).filter((k) => k !== path).map((k) => el('a', { class: 'link', href: '#' + k }, INFO[k].eyebrow))));
  }

  /* ═════════════════════════ izvoz ═════════════════════════ */
  window.viewLedger = viewLedger;
  window.viewInfo = viewInfo;
  window.viewNotFound = viewNotFound;
  window.KVG = {
    palette, tray, notice, keys, quickList, QUICK, GOTO,
    views: { ledger: viewLedger, info: viewInfo, notFound: viewNotFound, placeholder: viewPlaceholder, error: viewError },
    INFO_PATHS: Object.keys(INFO),
    onRoute(path) { S(() => tray.update(path)); S(() => notice.place()); setTimeout(() => S(() => notice.place()), 120); },
  };
})();
