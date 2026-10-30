/* Kvadrat.rs — sadržaj: Novogradnja (projekti) i Saveti (članci).
   Izvoz: viewProjects(q) #/novogradnja · viewProject(q) #/projekat?s=id · viewArticles(q) #/saveti · viewArticle(q) #/savet?s=slug.
   Projekti se izvode deterministički iz oglasa (prodaja, co ∈ novogradnja|u-izgradnji, agencija) grupisanih po (ags, ns) — isto kao početna.
   Demo (deklarisano na stranici i u izveštaju): prodate/rezervisane jedinice zgrade, tok izgradnje, istorija isporuke, plan plaćanja. */
(function () {
  'use strict';
  const S = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const qget = (q, k) => (q && typeof q.get === 'function' ? q.get(k) : typeof q === 'string' ? q : q && q[k]) || '';
  const plu = (n, a, b, c) => S(() => fmt.plural(n, a, b, c), c);
  const isNew = (l) => l.co === 'novogradnja' || l.co === 'u-izgradnji';
  /* u projekte zgrade ulaze samo stanovi, kuće i lokali; vikendice, garaže i placevi ostaju obični oglasi */
  const PJ_PT = new Set(['stan', 'kuca', 'poslovni-prostor']);
  const R = {
    listing: (s) => '#/oglas?s=' + encodeURIComponent(s),
    project: (id) => '#/projekat?s=' + encodeURIComponent(id),
    projects: (p) => S(() => router.href('/novogradnja', p || {}), '#/novogradnja'),
    article: (s) => '#/savet?s=' + encodeURIComponent(s),
    articles: (k) => '#/saveti' + (k ? '?k=' + k : ''),
    search: (f) => S(() => router.href('/pretraga', filtersToParams({ ...FILTER_DEFAULTS, ...f })), '#/pretraga'),
  };
  const replaceUrl = (path, params) => { try { history.replaceState(null, '', R[path] ? R[path](params) : S(() => router.href('/' + path, params), location.hash)); } catch (e) { /* artifact iframe */ } };
  const MON = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
  const monthLabel = (d) => `${MON[d.getMonth()]} ${d.getFullYear()}.`;
  const addMonths = (d, m) => { const x = new Date(d.getTime()); x.setMonth(x.getMonth() + Math.round(m)); return x; };
  const sec = (title, sub, ...kids) => el('section', { class: 'ct-sec' }, el('div', { class: 'ct-sh' }, el('h2', { class: 't-h2s' }, title), sub ? el('p', { class: 'meta' }, sub) : null), ...kids);
  /* jedinica m² ne sme u verzal (M² je druga oznaka): span bez text-transform */
  const unitM2 = () => el('span', { class: 'ct-u' }, 'm²');
  const demoTag = (txt) => el('span', { class: 'ct-demo' }, txt || 'demo prikaz');

  /* mapa se gradi tek kad je čvor u dokumentu i ima širinu; uništava se kad nestane */
  function whenMounted(node, fn) {
    let n = 0;
    const tick = () => { if (node.isConnected && node.offsetWidth > 0) { fn(); return; } if (++n < 240) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  function mountMap(box, listings, sel) {
    if (typeof mapView !== 'function') { box.append(el('p', { class: 'meta ct-nomap' }, 'Mapa trenutno nije dostupna.')); return; }
    whenMounted(box, () => {
      const api = S(() => mapView(box, { listings, selected: sel.s, interactive: false, drawTool: false, showAreaButton: false, legend: false, popover: false, labels: true, view: { lat: sel.lat, lng: sel.lng, zoom: 14 } }), null);
      if (!api) return;
      /* mapa je samo prikaz (interactive:false): pinovi ne smeju biti tab-stanice */
      box.inert = true; box.setAttribute('role', 'img'); box.setAttribute('aria-label', `Mapa: ${sel.n || sel.c}, ${sel.c} i okolna novogradnja`);
      const mo = new MutationObserver(() => { if (!box.isConnected) { mo.disconnect(); S(() => api.destroy()); } });
      mo.observe(document.body, { childList: true, subtree: true });
    });
  }

  /* ═════════════════════════ NOVOGRADNJA ═════════════════════════ */
  const KINDS = ['Residence', 'Park', 'Vista', 'Kvart'];
  const SUFFIX = ['I', 'II', 'III', 'A', 'B', '2'];
  function rokOf(l) {
    const m = S(() => String(KX.titleOf(l)).match(/rok (Q\d \d{4})/), null);
    if (m) return m[1];
    const r = rng(hash(l.s + ':rok')); const y = 2027 + Math.floor(r() * 2); return 'Q' + (1 + Math.floor(r() * 4)) + ' ' + y;
  }
  let PJ = null;
  function projects() {
    if (PJ) return PJ;
    const g = new Map();
    for (const l of D.listings) {
      if (l.t !== 'prodaja' || !l.ags || !isNew(l) || !PJ_PT.has(l.pt)) continue;
      const id = l.ags + '--' + l.ns;
      if (!g.has(id)) g.set(id, []);
      g.get(id).push(l);
    }
    const names = new Set();
    PJ = [...g.entries()].map(([id, list]) => {
      const u = list.slice().sort((a, b) => a.p - b.p);
      const cover = u[0], h = hash(id);
      const building = u.find((x) => x.co === 'u-izgradnji');
      const rok = building ? rokOf(building) : null;
      const base = /centar/i.test(cover.n || '') ? cover.c : (cover.n || cover.m);
      let k = h % SUFFIX.length, name;
      do { name = `${base} ${KINDS[(h >>> 4) % KINDS.length]} ${SUFFIX[k % SUFFIX.length]}`; k++; } while (names.has(name) && k < 40);
      names.add(name);
      const flats = u.every((x) => x.pt === 'stan');
      const tf = Math.max(1, ...u.map((x) => x.tf || 1));
      const perFloor = flats && tf >= 3 ? Math.max(2, Math.min(4 - (h % 2), Math.floor(44 / tf))) : 0;
      const am = new Set(u.flatMap((x) => x.am || []));
      return {
        id, name, units: u, cover, rok, status: building ? 'gradnja' : 'useljivo', ags: cover.ags, ag: S(() => find.agency(cover.ags), null),
        agency: cover.ag, agv: !!cover.agv, c: cover.c, cs: cover.cs, m: cover.m, n: cover.n, from: cover.p,
        fromPpm: Math.min(...u.map((x) => x.ppm || Infinity)), aMin: Math.min(...u.map((x) => x.a)), aMax: Math.max(...u.map((x) => x.a)),
        roMin: Math.min(...u.map((x) => x.ro ?? 99)), roMax: Math.max(...u.map((x) => x.ro ?? 0)), flats, tf, perFloor,
        /* broj jedinica zgrade = broj redova unitRows (availOf(P).total); ovo je samo gruba procena pre rasporeda */
        total: perFloor ? Math.max(u.length, perFloor * tf) : u.length, views: u.reduce((s, x) => s + (x.v || 0), 0),
        rate: !!building && hash(id + ':rate') % 2 === 0, parking: am.has('hasGarage') ? 'Garaža u objektu' : am.has('hasParking') ? 'Parking mesto' : 'Nije navedeno',
        rokKey: rok ? +rok.slice(3) * 10 + +rok[1] : 0, dz: Math.min(...u.map((x) => x.dz || 0)),
        ppmUnit: u.reduce((b, x) => (x.ppm && (!b || x.ppm < b.ppm) ? x : b), null),
      };
    });
    PJ.sort((a, b) => b.units.length - a.units.length || (a.rok ? 0 : 1) - (b.rok ? 0 : 1) || b.views - a.views || (a.id < b.id ? -1 : 1));
    return PJ;
  }
  const findProject = (id) => projects().find((p) => p.id === id) || null;
  const statusLabel = (p) => (p.status === 'gradnja' ? `U izgradnji · rok ${p.rok}` : 'Useljivo odmah');
  const roomsSpan = (p) => roomsSpan0(p).replace(/(\d[\d,]*\+?) (sob)/g, '$1\u00a0$2');
  const roomsSpan0 = (p) => {
    if (!p.flats || p.roMin === 99) return [...new Set(p.units.map((x) => TYPES_LABEL(x.pt)))].join(' i ');
    const n = (r) => S(() => fmt.roomsN(r), String(r));
    if (p.roMin === p.roMax) return p.roMin === 0.5 ? 'garsonjera' : S(() => fmt.roomsText(p.roMin), '');
    return p.roMin === 0.5 ? `garsonjera do ${S(() => fmt.roomsText(p.roMax), '')}` : `${n(p.roMin)}–${n(p.roMax)} sobe`;
  };
  const TYPES_LABEL = (pt) => S(() => typeOf(pt).s.toLowerCase(), pt);
  const areaSpan = (p) => (p.aMin === p.aMax ? fmt.m2(p.aMin) : `${fmt.num(p.aMin)}–${fmt.m2(p.aMax)}`);

  /* jedinice zgrade: stvarni oglasi su uvek „Dostupno“ (sa cenom i linkom). Demo raspored ostatka zgrade prati tok gradnje:
     u izgradnji prodato ≈ 20–55 % (raste sa % izgrađenosti), rezervisano 5–10 %; useljivo prodato 70–85 %; ostalo dostupno, „cena na upit“. */
  function unitRows(P) {
    if (P._rows) return P._rows;
    const unitCode = (fl, k) => `A-${fl < 0 ? 'S' : fl === 0 ? 'P' : fl}.${k}`;
    const used = {};
    const rows = P.units.map((l) => {
      const fl = l.fl ?? 0; used[fl] = (used[fl] || 0) + 1;
      return { real: true, l, code: unitCode(fl, used[fl]), ro: l.pt === 'stan' ? l.ro : null, a: l.a, fl, tf: l.tf, or: l.or, p: l.p, ppm: l.ppm, st: 'dos' };
    });
    if (P.perFloor) {
      const r = rng(hash(P.id + ':units'));
      const OR = Object.keys(S(() => ORIENT, { jug: 1, istok: 1, zapad: 1, sever: 1 }));
      const RO = [1, 1.5, 2, 2, 2.5, 3, 3, 4];
      const demo = [];
      for (let fl = 1; fl <= P.tf; fl++) {
        for (let k = (used[fl] || 0) + 1; k <= P.perFloor; k++) {
          const ro = fl === P.tf && r() < 0.6 ? 4 : RO[Math.floor(r() * RO.length)];
          const a = Math.round(22 + ro * 17 + r() * 9);
          demo.push({ real: false, code: unitCode(fl, k), ro, a, fl, tf: P.tf, or: OR[Math.floor(r() * OR.length)], p: null, ppm: null, st: 'dos', k: 0 });
        }
      }
      const total = rows.length + demo.length;
      const pct = P.status === 'gradnja' ? S(() => timeline(P).pct, 0.3) : 1;
      const soldF = P.status === 'gradnja' ? 0.2 + 0.35 * pct : 0.7 + 0.15 * r();
      const rezF = P.status === 'gradnja' ? 0.05 + 0.05 * r() : 0.03 + 0.03 * r();
      const nSold = Math.min(demo.length, Math.round(total * soldF));
      const nRez = Math.min(demo.length - nSold, Math.round(total * rezF));
      demo.forEach((d) => { d.k = r(); });
      demo.slice().sort((x, y) => x.k - y.k).forEach((d, i) => { d.st = i < nSold ? 'pro' : i < nSold + nRez ? 'rez' : 'dos'; });
      rows.push(...demo);
    }
    const ord = { dos: 0, rez: 1, pro: 2 };
    rows.sort((x, y) => ord[x.st] - ord[y.st] || (x.real ? 0 : 1) - (y.real ? 0 : 1) || x.fl - y.fl || (x.code < y.code ? -1 : 1));
    rows.forEach((x, i) => { x.i = i; });
    P._rows = rows;
    return rows;
  }
  const availOf = (P) => { const R0 = unitRows(P); return { dos: R0.filter((x) => x.st === 'dos').length, total: R0.length }; };
  /* Δ čip za €/m²: stvarna jedinica (stats.delta), null kad je uzorak < 5 */
  const ppmDelta = (l) => (l ? S(() => deltaChip(l), null) : null);
  const ST = { dos: 'Dostupno', rez: 'Rezervisano', pro: 'Prodato' };

  function timeline(P) {
    const today = new Date(), h = hash(P.id + ':tl'), dur = 24 + (h % 15);
    let end;
    if (P.rok) end = new Date(+P.rok.slice(3), +P.rok[1] * 3 - 2, 15);
    else { end = new Date(Math.min(P.cover.y || 2025, 2026), 2 + (h % 6), 15); if (end > today) end = addMonths(today, -4); }
    const start = addMonths(end, -dur);
    const legal = S(() => KX.trust(P.cover).legal, 'uknjizeno');
    const M = [['Građevinska dozvola', -0.1], ['Početak radova', 0], [P.flats ? 'Temelji i podzemna garaža' : 'Temelji', 0.16], ['Konstrukcija do poslednje ploče', 0.52],
      ['Krov, fasada i stolarija', 0.72], ['Instalacije i unutrašnji radovi', 0.87], ['Tehnički prijem i upotrebna dozvola', 1], ['Upis u katastar i predaja ključeva', 1.14]];
    let cur = -1;
    const items = M.map(([label, f], i) => {
      const d = addMonths(start, f * dur);
      let done = d <= today;
      if (i === M.length - 1 && !P.rok) done = legal === 'uknjizeno';
      return { label, d, done };
    });
    cur = items.findIndex((x) => !x.done);
    const pct = Math.max(0, Math.min(1, (today - start) / (end - start)));
    return { items, cur, pct, start, end };
  }

  function record(P) {
    const h = hash(P.ags + ':rec'), past = 2 + (h % 3), late = (h >>> 5) % 4 === 0 ? 1 : 0;
    const city = P.ag ? P.ag.c : P.c;
    const pool = [...new Set(D.listings.filter((l) => l.c === city && l.n && !/centar/i.test(l.n) && l.ns !== P.cover.ns).map((l) => l.n))];
    const items = [], r = rng(h), seen = new Set();
    /* isporuke samo iz godina dok agencija postoji (od a.y do 2025.) */
    const y0 = Math.max(2017, (P.ag && +P.ag.y) || 2017), span = Math.max(1, 2025 - y0), nPast = y0 >= 2025 ? 1 : past;
    for (let i = 0; i < nPast; i++) {
      let n = city, t = 0;
      while (pool.length && t++ < 12) { n = pool[Math.floor(r() * pool.length)]; if (!seen.has(n)) break; }
      seen.add(n);
      items.push({ name: `${n} ${KINDS[Math.floor(r() * KINDS.length)]}`, year: Math.min(2025, y0 + Math.floor(r() * span)), delay: i === 0 && late ? 3 + (h % 5) : 0, units: 12 + Math.floor(r() * 60) });
    }
    items.sort((a, b) => b.year - a.year);
    return { items, onTime: items.filter((x) => !x.delay).length, active: projects().filter((x) => x.ags === P.ags).length };
  }

  /* ───── kartica projekta (indeks, „ostali projekti") ───── */
  function projectCard(P, compact) {
    const av = availOf(P);
    return el('article', { class: 'pj-card' + (compact ? ' pj-card-s' : '') },
      el('a', { class: 'ph r16', href: R.project(P.id), 'aria-label': P.name },
        img.el(P.cover, 0, { aspect: '16:10', alt: '' }),
        el('div', { class: 'badges' }, badge('novogradnja'))),
      el('div', { class: 'pj-cb' },
        el('p', { class: 'eyebrow' + (P.status === 'gradnja' ? ' pj-eb-on' : '') }, statusLabel(P)),
        el('h3', { class: 'pj-name' }, el('a', { href: R.project(P.id) }, P.name)),
        el('p', { class: 'pj-loc' }, `${P.m && P.m !== P.n ? P.m + ' · ' : ''}${P.n}, ${P.c}`),
        el('div', { class: 'pricerow' }, el('span', { class: 'pj-od' }, 'od'), el('span', { class: 'price' }, fmt.price(P.from)),
          el('span', { class: 'ctx' }, el('span', { class: 'ppm' }, 'od ' + fmt.ppm(P.fromPpm)), ppmDelta(P.ppmUnit))),
        el('div', { class: 'facts' }, el('span', { class: 'fact' }, `${P.units.length} ${plu(P.units.length, 'jedinica', 'jedinice', 'jedinica')} u ponudi`),
          el('span', { class: 'fact' }, areaSpan(P)), el('span', { class: 'fact' }, roomsSpan(P))),
        compact ? null : el('div', { class: 'foot' }, el('span', { class: 'ag' }, el('span', {}, P.agency), P.agv ? icon('check', 14) : null),
          el('span', { class: 'pj-av' }, P.perFloor ? `dostupno ${av.dos} od ${av.total}` : 'cena sa PDV-om'))));
  }

  function viewProjects(q) {
    const all = projects();
    const STR = [{ v: '', l: 'Sve' }, { v: '1', l: 'Garsonjere i jednosobni', t: (ro) => ro <= 1.5 }, { v: '2', l: 'Dvosobni', t: (ro) => ro >= 2 && ro < 3 }, { v: '3', l: 'Trosobni i veći', t: (ro) => ro >= 3 }];
    const ROKS = [{ v: '', l: 'Rok: bilo koji' }, { v: 'odmah', l: 'Useljivo odmah' }, { v: '2027', l: 'Rok do kraja 2027.' }, { v: '2028', l: 'Rok do kraja 2028.' }];
    const st = { c: qget(q, 'c'), s: qget(q, 'st'), ro: qget(q, 'ro'), rok: qget(q, 'rok'), sort: qget(q, 'sort') || 'rel', shown: 12 };
    if (!STR.some((x) => x.v === st.ro)) st.ro = '';
    if (!ROKS.some((x) => x.v === st.rok)) st.rok = '';
    const roOk = (p) => { const f = (STR.find((x) => x.v === st.ro) || {}).t; return !f || p.units.some((u) => u.pt === 'stan' && u.ro != null && f(u.ro)); };
    const rokOk = (p) => !st.rok || p.status === 'useljivo' || (st.rok !== 'odmah' && p.rokKey > 0 && p.rokKey <= +st.rok * 10 + 4);
    const cityCount = {}; all.forEach((p) => { cityCount[p.cs] = (cityCount[p.cs] || 0) + 1; });
    const cities = Object.keys(cityCount).sort((a, b) => cityCount[b] - cityCount[a] || (a < b ? -1 : 1));
    const cname = (cs) => S(() => find.city(cs).n, cs);
    const top = cities.slice(0, 5);
    const SORTS = [{ v: 'rel', l: 'Preporučeno' }, { v: 'p', l: 'Najniža cena' }, { v: 'ppm', l: 'Najniža cena po m²' }, { v: 'rok', l: 'Najskorije useljenje' }, { v: 'u', l: 'Najviše jedinica' }];
    const list = el('div', { class: 'pj-grid' });
    const count = el('p', { class: 'pj-count', 'aria-live': 'polite' });
    const more = el('div', { class: 'pj-more' });
    const otherSel = select([{ v: '', l: 'Drugi grad…' }, ...cities.slice(5).map((cs) => ({ v: cs, l: `${cname(cs)} (${cityCount[cs]})` }))], top.includes(st.c) ? '' : st.c,
      (v) => { st.c = v; cityPills.set(v ? [] : ['']); update(); }, { inline: true, label: 'Drugi grad' });
    const cityPills = pills([{ v: '', l: 'Svi gradovi', n: all.length }, ...top.map((cs) => ({ v: cs, l: cname(cs), n: cityCount[cs] }))], [top.includes(st.c) || !st.c ? st.c : '__'],
      (v) => { st.c = v; otherSel.value = ''; update(); }, { single: true });
    const stPills = pills([{ v: '', l: 'Svi' }, { v: 'gradnja', l: 'U izgradnji' }, { v: 'useljivo', l: 'Useljivo' }], [st.s], (v) => { st.s = v; update(); }, { single: true });
    const roPills = pills(STR.map((x) => ({ v: x.v, l: x.l })), [st.ro], (v) => { st.ro = v; update(); }, { single: true });
    const rokSel = select(ROKS, st.rok, (v) => { st.rok = v; update(); }, { inline: true, label: 'Rok useljenja' });
    const sortSel = select(SORTS, st.sort, (v) => { st.sort = v; update(); }, { inline: true, label: 'Sortiraj projekte' });
    function filtered() {
      let L = all.filter((p) => (!st.c || p.cs === st.c) && (!st.s || p.status === st.s) && roOk(p) && rokOk(p));
      const by = { p: (a, b) => a.from - b.from, ppm: (a, b) => a.fromPpm - b.fromPpm, rok: (a, b) => a.rokKey - b.rokKey || a.from - b.from, u: (a, b) => availOf(b).total - availOf(a).total || b.units.length - a.units.length };
      if (by[st.sort]) L = L.slice().sort(by[st.sort]);
      return L;
    }
    function update(keepShown) {
      if (!keepShown) st.shown = 12;
      const L = filtered();
      count.textContent = `${L.length} ${plu(L.length, 'projekat', 'projekta', 'projekata')}${st.c ? ' · ' + cname(st.c) : ''}`;
      list.innerHTML = '';
      if (!L.length) list.append(empty('Nema projekata za ovaj izbor', 'Probaj drugi grad ili ukloni filtere statusa, strukture i roka.', 'Prikaži sve projekte', null, { onClick: () => { st.c = ''; st.s = ''; st.ro = ''; st.rok = ''; cityPills.set(['']); stPills.set(['']); roPills.set(['']); rokSel.value = ''; otherSel.value = ''; update(); } }));
      L.slice(0, st.shown).forEach((p) => list.append(projectCard(p)));
      more.innerHTML = '';
      if (L.length > st.shown) more.append(el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { st.shown += 12; update(true); } }, `Prikaži još projekata (${L.length - st.shown})`));
      replaceUrl('projects', { c: st.c, st: st.s, ro: st.ro, rok: st.rok, sort: st.sort === 'rel' ? '' : st.sort });
    }
    update();
    whenMounted(cityPills, () => { const on = cityPills.querySelector('.chip.on'), rail = cityPills.parentNode; if (on && rail && on.offsetLeft + on.offsetWidth > rail.clientWidth) rail.scrollLeft = on.offsetLeft - 16; });
    const nGr = all.filter((p) => p.status === 'gradnja').length;
    const medPpm = S(() => stats.median(all.map((p) => p.fromPpm)), 0);
    return el('div', { class: 'wrap ct pj' },
      crumbs([{ label: 'Početna', href: '#/' }, { label: 'Novogradnja', href: '#/novogradnja' }]),
      el('header', { class: 'pj-head' },
        el('p', { class: 'eyebrow' }, 'Novogradnja · Srbija'),
        el('h1', { class: 't-h1' }, 'Novi stanovi, sa rokom i cenom koja uključuje PDV'),
        el('p', { class: 'lede' }, `${all.length} ${plu(all.length, 'projekat', 'projekta', 'projekata')} u ${cities.length} ${plu(cities.length, 'grad', 'grada', 'gradova')}. Za svaki projekat: dostupne jedinice, tok izgradnje, plan plaćanja i koliko vam se vraća kao prvom kupcu.`),
        tiles([{ v: fmt.num(all.length), l: plu(all.length, 'projekat', 'projekta', 'projekata') }, { v: fmt.num(nGr), l: 'u izgradnji' }, { v: fmt.num(all.length - nGr), l: 'useljivo odmah' }, { v: fmt.ppm(medPpm), l: 'medijana početnih cena po m²' }])),
      el('div', { class: 'pj-bar', role: 'search' },
        el('div', { class: 'pj-row' }, el('span', { class: 'label' }, 'Grad'), el('div', { class: 'rail pj-rail' }, cityPills, cities.length > 5 ? otherSel : null)),
        el('div', { class: 'pj-row' }, el('span', { class: 'label' }, 'Struktura'), el('div', { class: 'rail pj-rro' }, roPills)),
        el('div', { class: 'pj-row' }, el('span', { class: 'label' }, 'Status'), stPills, rokSel, el('span', { class: 'spacer' }),
          el('label', { class: 'pj-sort' }, el('span', { class: 'meta' }, 'Sortiraj:'), sortSel))),
      count, list, more,
      el('section', { class: 'section pj-explain' },
        sectionHead('Kako čitati cene novogradnje', 'Tri stvari koje oglasi investitora retko kažu jasno.'),
        el('ol', { class: 'pj-three' },
          el('li', {}, el('b', {}, 'PDV je već u ceni.'), ' Investitori oglašavaju cene sa PDV-om od 10 %. Porez na prenos od 2,5 % se kod prve prodaje novogradnje ne plaća.'),
          el('li', {}, el('b', {}, 'Prvi stan vraća deo PDV-a.'), ' Za do 40 m² i još 15 m² po članu domaćinstva — ali novac stiže oko 45 dana posle isplate, ne na dan kupovine.'),
          el('li', {}, el('b', {}, 'Rok nije upotrebna dozvola.'), ' Pitajte šta ugovor kaže ako investitor kasni i kada se očekuje upis u katastar.')),
        el('p', { class: 'meta pj-xl' }, el('a', { class: 'link', href: R.article('kako-kupiti-prvi-stan-u-srbiji') }, 'Vodič: kako kupiti prvi stan'), ' · ',
          el('a', { class: 'link', href: R.search({ t: 'prodaja', newbuild: true }) }, 'Svi oglasi novogradnje'))));
  }

  /* ───── stranica projekta ───── */
  const unitType = (r) => (r.real && r.l.pt !== 'stan' ? typeOf(r.l.pt).s : S(() => fmt.rooms(r.ro), '')) || '—';
  const unitVal = (r) => (r.real ? r.l.s : 'u:' + r.code);

  /* kontakt: oglašivač je agencija koja prodaje stanove investitora (isto kao početna: „Prodaje: …“) */
  function contactPanel(P, ctx) {
    const a = P.ag || { n: P.agency, ph: '', em: '', v: P.agv, y: '' };
    const phone = a.ph || '011 000 00 00', mail = a.em || 'info@kvadrat.rs';
    const mask = (s, keep) => s.slice(0, keep) + s.slice(keep).replace(/[^\s@.]/g, '·');
    const reveal = (txt, keep, label, ic) => {
      const out = el('span', { class: 'ct-val' });
      const b = el('button', { class: ic === 'phone' ? 'btn btn-primary btn-lg' : 'btn btn-secondary', type: 'button' });
      const paint = (on) => { b.innerHTML = ''; b.append(...[icon(ic), el('span', { class: 'mask' }, on ? txt : mask(txt, keep)), on ? null : el('span', { class: 'rev' }, label)].filter(Boolean)); };
      paint(false);
      b.addEventListener('click', () => { if (b.dataset.on) return; b.dataset.on = '1'; paint(true); out.append(copyButton(txt, { label: 'Kopiraj', outline: true })); S(() => toast(ic === 'phone' ? 'Broj je prikazan — pomenite Kvadrat.rs' : 'Adresa je prikazana')); });
      return el('div', { class: 'ct-rev' }, b, out);
    };
    const avail = unitRows(P).filter((r) => r.st === 'dos');
    const opts = [{ v: '', l: 'Bilo koja dostupna jedinica' }, ...avail.map((r) => ({ v: unitVal(r), l: `${r.code} · ${unitType(r)}, ${fmt.m2(r.a)} · ${r.real ? fmt.price(r.p) : 'cena na upit'}` }))];
    const nameI = el('input', { class: 'input', type: 'text', autocomplete: 'name', placeholder: 'Ime i prezime' });
    const contI = el('input', { class: 'input', type: 'text', autocomplete: 'email', placeholder: 'Telefon ili e-pošta' });
    const msgFor = (v) => { const r = avail.find((x) => unitVal(x) === v);
      return r ? `Poštovani, zanima me jedinica ${r.code} (${unitType(r).toLowerCase()}, ${fmt.m2(r.a)}) u projektu ${P.name}, ${P.n}. Molim raspored, ${r.real ? 'potvrdu cene' : 'cenu'} i plan plaćanja.`
        : `Poštovani, zanima me projekat ${P.name} (${P.n}, ${P.c}). Molim raspored, cene i plan plaćanja.`; };
    let auto = msgFor('');
    const msgI = el('textarea', { class: 'input', rows: '4' }, auto);
    const unitS = select(opts, '', (v) => { if (msgI.value === auto) { auto = msgFor(v); msgI.value = auto; } }, { label: 'Jedinica' });
    const fName = field('Ime', nameI), fCont = field('Kontakt', contI);
    const form = el('form', { class: 'ct-form stack', novalidate: true }, fName, fCont, field('Interesuje me', unitS), field('Poruka', msgI),
      el('button', { class: 'btn btn-secondary btn-block', type: 'submit' }, 'Pošalji upit prodavcu'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const errs = [[nameI, nameI.value.trim().length < 2, 'Upišite ime.'], [contI, !/(@.+\.)|(\d{6,})/.test(contI.value.replace(/[\s/-]/g, '')), 'Upišite telefon ili e-poštu.']];
      let bad = null;
      errs.forEach(([inp, err, msg]) => { inp.setAttribute('aria-invalid', err ? 'true' : 'false'); const h = inp.parentNode.querySelector('.help'); if (h) h.remove(); if (err) { inp.after(el('p', { class: 'help err' }, msg)); bad = bad || inp; } });
      if (bad) { bad.focus(); return; }
      form.replaceWith(el('div', { class: 'ct-sent', role: 'status' }, icon('check-circle'), el('div', {}, el('b', {}, 'Upit je zabeležen'),
        el('p', {}, `${a.n} obično odgovara u toku jednog radnog dana. Demo: poruka nije stvarno poslata.`))));
    });
    const wrap = formWrap(form);
    /* „Upit“ iz tabele jedinica: izabere jedinicu u formi, otvori je i prebaci fokus */
    if (ctx) ctx.ask = (r) => {
      if (!form.isConnected) { S(() => wrap.scrollIntoView({ block: 'center' })); S(() => toast('Upit je već zabeležen — prodavac će vas kontaktirati')); return; }
      const v = unitVal(r);
      unitS.value = v; if (msgI.value === auto) { auto = msgFor(v); msgI.value = auto; }
      wrap.open();
      const smooth = !S(() => matchMedia('(prefers-reduced-motion: reduce)').matches, false);
      S(() => form.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' }));
      nameI.focus({ preventScroll: true });
      S(() => toast(`Jedinica ${r.code} je izabrana u upitu`));
    };
    const rec = record(P);
    return el('aside', { class: 'contact pj-contact', 'aria-label': 'Kontakt prodavca' },
      el('div', { class: 'who' }, el('span', { class: 'ava' }, el('img', { src: S(() => img.mark(a.s || P.ags), ''), alt: '', width: 52, height: 52 })),
        el('div', { style: 'min-width:0' }, el('b', {}, el('span', {}, a.n), a.v ? icon('check') : null), el('small', {}, `Prodaje za investitora${a.y ? ' · agencija od ' + a.y + '.' : ''}`))),
      el('div', { class: 'rating' }, el('span', {}, el('b', {}, String(rec.active)), ' ', plu(rec.active, 'projekat', 'projekta', 'projekata')),
        el('span', {}, el('b', {}, String(P.units.length)), ' u ponudi'), a.r ? el('span', {}, el('b', {}, S(() => fmt.num(a.r, 1), a.r)), ` ocena (${a.rc || 0})`) : null),
      reveal(phone, 7, 'prikaži broj', 'phone'), reveal(mail, 3, 'prikaži e-poštu', 'mail'),
      wrap,
      el('p', { class: 'note' }, P.status === 'gradnja' ? 'Kod kupovine u izgradnji uplaćujte samo na račun investitora naveden u ugovoru overenom kod javnog beležnika, nikad u gotovini. Provizija agencije se plaća posebno, po posredničkom ugovoru.'
        : 'Kaparu i cenu uplaćujte samo na račun prodavca naveden u ugovoru overenom kod javnog beležnika, nikad u gotovini.'));
  }

  function formWrap(form) {
    const narrow = S(() => matchMedia('(max-width: 860px)').matches, false);
    const w = el('div', { class: 'ct-fwrap' }, form);
    w.open = () => {};
    if (!narrow) return w;
    form.hidden = true;
    const b = el('button', { class: 'btn btn-secondary btn-block', type: 'button', 'aria-expanded': 'false' }, icon('mail'), 'Pošalji upit prodavcu');
    w.open = () => { form.hidden = false; if (b.isConnected) b.remove(); };
    b.addEventListener('click', () => { w.open(); const f = form.querySelector('input'); if (f) f.focus(); });
    w.prepend(b);
    return w;
  }

  function unitsSection(P, ctx) {
    const rows = unitRows(P);
    const cnt = { dos: 0, rez: 0, pro: 0 }; rows.forEach((r) => cnt[r.st]++);
    const total = rows.length;
    let onlyAvail = cnt.pro > 0;
    const sort = { k: '', dir: 1 };
    const ORD = { dos: 0, rez: 1, pro: 2 };
    const KEY = { a: (r) => r.a, fl: (r) => r.fl, p: (r) => r.p, st: (r) => ORD[r.st] };
    const sorted = () => {
      const L = rows.filter((r) => !onlyAvail || r.st !== 'pro');
      if (!KEY[sort.k]) return L;
      const f = KEY[sort.k];
      return L.slice().sort((x, y) => { const a = f(x), b = f(y); if (a == null || b == null) return (a == null) - (b == null) || x.i - y.i; return (a - b) * sort.dir || x.i - y.i; });
    };
    const ask = (r) => el('button', { class: 'btn btn-secondary btn-sm', type: 'button', 'aria-label': `Pošalji upit za jedinicu ${r.code}`, onclick: () => ctx && ctx.ask && ctx.ask(r) }, 'Upit');
    const priceEl = (r) => (r.real ? el('span', { class: 'price' }, fmt.price(r.p)) : r.st === 'dos' ? el('span', { class: 'pj-ask' }, 'cena na upit') : '—');
    const ppmEl = (r) => (r.real && r.ppm ? el('span', { class: 'pj-ppm' }, el('span', { class: 'ppm' }, fmt.ppm(r.ppm)), ppmDelta(r.l)) : '—');
    const COLS = [['Jedinica'], ['Struktura · strana'], [() => [unitM2()], 'a', 'num'], ['Sprat', 'fl'], ['Cena', 'p', 'num'], [() => ['€/', unitM2(), ' · Δ'], null, 'num'], ['Status', 'st'], ['Akcije', null, 'num sr-th']];
    const headRow = el('tr');
    const paintHead = (focusKey) => {
      headRow.innerHTML = '';
      COLS.forEach(([label0, k, cls]) => {
        const label = typeof label0 === 'function' ? label0() : label0;
        const on = k && sort.k === k;
        headRow.append(el('th', { scope: 'col', class: cls || null, 'aria-sort': k ? (on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none') : null },
          k ? el('button', { type: 'button', 'data-k': k, onclick: () => { if (sort.k === k) sort.dir = -sort.dir; else { sort.k = k; sort.dir = 1; } usort.value = sort.k ? sort.k + (sort.dir > 0 ? '' : '-d') : ''; paint(k); } },
            label, on ? icon(sort.dir > 0 ? 'arrow-up' : 'arrow-down') : null) : cls && cls.includes('sr-th') ? el('span', { class: 'sr' }, label) : label));
      });
      if (focusKey) { const b = headRow.querySelector(`button[data-k="${focusKey}"]`); if (b) b.focus(); }
    };
    const tbody = el('tbody'), ul = el('ul', { class: 'pj-ul' });
    const paint = (focusKey) => {
      paintHead(focusKey);
      tbody.innerHTML = ''; ul.innerHTML = '';
      sorted().forEach((r) => {
        const t = unitType(r);
        const flr = r.fl != null ? S(() => fmt.floor(r.fl, r.tf), String(r.fl)) : '—', ori = r.or ? S(() => ORIENT[r.or], r.or) : '';
        const stEl = () => el('span', { class: 'pj-st pj-st-' + r.st }, ST[r.st]);
        const code = () => (r.real ? el('a', { class: 'ttl', href: R.listing(r.l.s) }, r.code) : el('span', { class: 'ttl' }, r.code));
        ul.append(el('li', { class: 'pj-u-' + r.st },
          el('div', { class: 'pj-ul-a' }, code(), stEl()),
          el('p', { class: 'pj-ul-f' }, [t, fmt.m2(r.a), flr, ori].filter(Boolean).join(' · ')),
          r.st === 'dos' ? el('div', { class: 'pj-ul-p' }, priceEl(r), r.real ? ppmEl(r) : null,
            el('span', { class: 'pj-acts' }, r.real ? el('a', { class: 'btn btn-secondary btn-sm', href: R.listing(r.l.s) }, 'Oglas') : null, ask(r))) : null));
        tbody.append(el('tr', { class: 'pj-u-' + r.st + (r.real ? ' pj-real' : '') },
          el('td', {}, code()),
          el('td', {}, el('span', { class: 'pj-t' }, t), ori ? el('span', { class: 'pj-or' }, ori) : null), el('td', { class: 'num' }, fmt.m2(r.a)), el('td', { class: 'pj-fl' }, flr),
          el('td', { class: 'num' }, r.real ? el('a', { class: 'pj-pl', href: R.listing(r.l.s), 'aria-label': `Oglas ${r.code}, ${fmt.price(r.p)}` }, priceEl(r)) : priceEl(r)), el('td', { class: 'num' }, ppmEl(r)),
          el('td', {}, stEl()),
          el('td', { class: 'num' }, r.st === 'dos' ? ask(r) : null)));
      });
    };
    const usort = select([{ v: '', l: 'Redosled: dostupne prvo' }, { v: 'p', l: 'Cena rastuće' }, { v: 'p-d', l: 'Cena opadajuće' }, { v: 'a', l: 'Kvadratura rastuće' }, { v: 'a-d', l: 'Kvadratura opadajuće' }, { v: 'fl', l: 'Sprat rastuće' }, { v: 'fl-d', l: 'Sprat opadajuće' }, { v: 'st', l: 'Status: dostupne → prodate' }, { v: 'st-d', l: 'Status: prodate → dostupne' }], '',
      (v) => { sort.k = v.replace('-d', ''); sort.dir = /-d$/.test(v) ? -1 : 1; paint(); }, { inline: true, label: 'Redosled jedinica' });
    paint();
    const seg = (k) => (cnt[k] ? el('span', { class: 'pj-ab-' + k, style: `flex:${cnt[k]}` }) : null);
    return sec('Dostupne jedinice', P.perFloor ? `${total} ${plu(total, 'stan', 'stana', 'stanova')} u zgradi · ${P.units.length} ${plu(P.units.length, 'oglas', 'oglasa', 'oglasa')} na Kvadrat.rs` : 'Jedinice ovog projekta u ponudi',
      el('div', { class: 'pj-avail' }, el('div', { class: 'pj-ab', role: 'img', 'aria-label': `Dostupno ${cnt.dos}, rezervisano ${cnt.rez}, prodato ${cnt.pro}` }, seg('dos'), seg('rez'), seg('pro')),
        el('p', { class: 'pj-al' }, el('span', { class: 'k dos' }, el('b', {}, String(cnt.dos)), ' dostupno'), cnt.rez ? el('span', { class: 'k rez' }, el('b', {}, String(cnt.rez)), ' rezervisano') : null,
          cnt.pro ? el('span', { class: 'k pro' }, el('b', {}, String(cnt.pro)), ' prodato') : null)),
      el('div', { class: 'pj-uctl' }, cnt.pro ? toggle(onlyAvail, (on) => { onlyAvail = on; paint(); }, { label: 'Sakrij prodate jedinice' }) : null, el('span', { class: 'pj-usort' }, usort)),
      el('div', { class: 'table-wrap pj-tw' }, el('table', { class: 'table pj-table' }, el('thead', {}, headRow), tbody)), ul,
      el('p', { class: 'meta pj-foot' }, P.perFloor ? 'Podvučene šifre su stvarni oglasi sa cenom; ostale jedinice su demo prikaz rasporeda zgrade. Cene uključuju PDV.' : 'Cene su iz oglasa i uključuju PDV.'));
  }

  function timelineSection(P) {
    const T = timeline(P);
    return sec('Tok izgradnje', null,
      el('div', { class: 'pj-tl-top' }, P.rok ? el('p', { class: 'pj-prog' }, el('b', { class: 'num' }, Math.round(T.pct * 100) + ' %'), el('span', {}, `izgrađeno · početak ${monthLabel(T.start)} · rok ${P.rok}`))
        : el('p', { class: 'pj-prog' }, el('b', {}, 'Završeno'), el('span', {}, `upotrebna dozvola ${monthLabel(T.end)}`)), demoTag('demo prikaz — datumi nisu od investitora')),
      el('div', { class: 'pj-pb', role: 'img', 'aria-label': `Izgrađeno ${Math.round(T.pct * 100)} %` }, el('span', { style: `width:${(T.pct * 100).toFixed(1)}%` })),
      el('ol', { class: 'pj-tl' }, T.items.map((m, i) => el('li', { class: m.done ? 'done' : i === T.cur ? 'cur' : '' },
        el('span', { class: 'mk', 'aria-hidden': 'true' }, m.done ? icon('check', 14) : null), el('span', { class: 'tl-l' }, m.label),
        el('time', { class: 'num' }, m.done ? monthLabel(m.d) : i === T.cur ? (m.d < new Date() ? `u toku · očekuje se ${monthLabel(addMonths(new Date(), 2))}` : `u toku · ${monthLabel(m.d)}`) : `plan · ${monthLabel(m.d)}`)))));
  }

  function paySection(P) {
    const l = P.cover;
    if (P.rate) {
      const T = timeline(P), months = Math.max(3, Math.round((T.end - new Date()) / 2.63e9));
      const p1 = Math.round(l.p * 0.2 / 100) * 100, p3 = Math.round(l.p * 0.3 / 100) * 100, p2 = l.p - p1 - p3;
      return sec('Plan plaćanja', 'Prodaja na rate kod investitora — primer za najjeftiniju jedinicu',
        el('ol', { class: 'pj-pay' },
          el('li', {}, el('span', { class: 'label' }, 'Pri potpisu ugovora'), el('b', { class: 'price' }, fmt.price(p1)), el('span', { class: 'meta' }, '20 %')),
          el('li', {}, el('span', { class: 'label' }, `U ${months} ${plu(months, 'mesečnu ratu', 'mesečne rate', 'mesečnih rata')}`), el('b', { class: 'price' }, fmt.price(Math.round(p2 / months)) + '/mes'), el('span', { class: 'meta' }, `50 % · ukupno ${fmt.price(p2)}`)),
          el('li', {}, el('span', { class: 'label' }, 'Pri tehničkom prijemu'), el('b', { class: 'price' }, fmt.price(p3)), el('span', { class: 'meta' }, '30 %'))),
        el('p', { class: 'meta pj-foot' }, demoTag(), ' Bez kamate dok traje gradnja; tačan plan je u ugovoru sa investitorom. Kredit banke se može kombinovati sa poslednjom ratom.'));
    }
    return sec('Plan plaćanja', null, el('p', { class: 'pj-p' }, P.status === 'gradnja'
      ? 'Investitor ne nudi plaćanje na rate. Kupovina je moguća odjednom ili kreditom; kredit za stan u izgradnji odobravaju samo neke banke, uz hipoteku na objekat u izgradnji.'
      : S(() => KX.trust(l).legal, '') === 'uknjizeno' ? 'Useljivo odmah: plaćanje odjednom ili stambenim kreditom. Jedinica je uknjižena, pa banka može da odobri kredit uz svoju procenu.'
        : `Useljivo odmah: plaćanje odjednom ili stambenim kreditom. Pravni status: ${S(() => KX.trust(l).legalLabel.toLowerCase(), 'proverite list nepokretnosti')} — od toga zavisi da li banka odobrava kredit.`),
    el('p', { class: 'meta pj-foot' }, P.status === 'gradnja' ? 'Uslovi plaćanja su demo podatak, ne ponuda investitora.' : 'Investitor ne nudi plaćanje na rate (demo podatak).'));
  }

  function vatSection(P) {
    const units = P.units.filter((l) => l.pt === 'stan' || l.pt === 'kuca');
    if (!units.length) return sec('PDV i prvi stan', null, el('p', { class: 'pj-p' }, 'Cene uključuju PDV od 10 %. Povraćaj PDV-a za prvog kupca važi samo za stan ili kuću, pa ga za ovu jedinicu ne računamo.'));
    let pick = units[0], hh = 1;
    const out = el('div', { class: 'pj-vat-out' });
    const paint = () => {
      /* oglašivač je agencija: provizija 2 % + PDV ostaje i imenuje se; PDV je u ceni (eksplicitno, ne iz sačuvanog profila) */
      const l = pick, c = S(() => KX.cost(l, { firstHome: true, household: hh, financing: 'kes', vatIncluded: true, agencyFeePct: 2, agencyPayer: 'kupac' }), null);
      const prov = c ? (c.lines.find((x) => x.key === 'provizija') || {}).amount || 0 : 0;
      const vat = c ? (c.lines.find((x) => x.key === 'pdv') || {}).inPrice || Math.round(l.p - l.p / 1.1) : Math.round(l.p - l.p / 1.1);
      const back = c ? c.laterInflow || 0 : Math.round(vat * Math.min(1, (40 + 15 * (hh - 1)) / l.a));
      const day = c ? c.onPurchase : l.p;
      const fh = c && c.firstHome ? c.firstHome : { eligibleM2: Math.min(l.a, 40 + 15 * (hh - 1)) };
      out.innerHTML = '';
      out.append(
        el('dl', { class: 'pj-vat-t' },
          el('div', {}, el('dt', {}, 'Cena iz oglasa'), el('dd', { class: 'price' }, fmt.price(l.p)), el('p', { class: 'meta' }, `uključuje PDV ${fmt.price(vat)}`)),
          el('div', {}, el('dt', {}, 'Potrebno na dan kupovine'), el('dd', { class: 'price' }, fmt.price(day)), el('p', { class: 'meta' }, prov ? `sa overom i upisom; uključuje proviziju agencije 2 % + PDV: ${fmt.price(prov)}; bez kredita` : 'sa overom i upisom; bez provizije i bez kredita')),
          el('div', { class: 'in' }, el('dt', {}, 'Vraća se posle ≈ 45 dana'), el('dd', { class: 'price' }, '−' + fmt.price(back)), el('p', { class: 'meta' }, `PDV na ${fmt.m2(fh.eligibleM2)} od ${fmt.m2(l.a)}`))),
        el('p', { class: 'pj-p' }, `Stvarni trošak posle povraćaja: `, el('b', {}, fmt.price(day - back)), '. Povraćaj ne smanjuje novac koji vam treba na dan kupovine — planirajte ga kao priliv kasnije.'));
    };
    paint();
    const hhSel = select([1, 2, 3, 4, 5, 6].map((n) => ({ v: n, l: n === 1 ? 'Samo ja' : `${n} člana domaćinstva`.replace(/^(5|6) člana/, '$1 članova') })), 1, (v) => { hh = +v; paint(); }, { label: 'Domaćinstvo' });
    const uSel = units.length > 1 ? select(units.map((l) => ({ v: l.s, l: `${fmt.m2(l.a)} · ${fmt.price(l.p)}` })), pick.s, (v) => { pick = units.find((x) => x.s === v) || pick; paint(); }, { label: 'Jedinica' }) : null;
    return sec('PDV i prvi stan', 'Cena uključuje PDV — evo koliko se vraća kupcu prvog stana',
      el('div', { class: 'pj-vat-in' }, uSel ? field('Jedinica', uSel) : null, field('Domaćinstvo', hhSel)), out,
      el('p', { class: 'note-rule pj-cond' }, 'Uslovi: prva kupovina stana od investitora, državljanin sa prebivalištem u Srbiji koji od 1. jula 2006. nije imao stan, članovi domaćinstva prijavljeni na istoj adresi, cela cena plaćena na račun prodavca. Zahtev se podnosi jednom, na obrascu RFN. Povraćaj se računa na cenu bez PDV-a, za 40 m² + 15 m² po svakom sledećem članu.'));
  }

  function recordSection(P) {
    const r = record(P);
    return sec('Isporuka na vreme', null,
      el('div', { class: 'pj-rec' }, el('p', { class: 'pj-rec-n' }, el('b', { class: 'num' }, `${r.onTime}/${r.items.length}`), el('span', {}, `ranijih projekata iz ponude agencije ${P.agency} predato je u ugovorenom roku`)), demoTag()),
      el('ul', { class: 'pj-recl' }, r.items.map((x) => el('li', {}, el('span', { class: 'tl-l' }, x.name, el('small', {}, ` · ${x.units} ${plu(x.units, 'stan', 'stana', 'stanova')}`)), el('span', { class: 'num' }, `${x.year}.`),
        el('span', { class: 'pj-st ' + (x.delay ? 'pj-st-rez' : 'pj-st-dos') }, x.delay ? `kasnio ${x.delay} ${plu(x.delay, 'mesec', 'meseca', 'meseci')}` : 'na vreme')))),
      el('p', { class: 'meta pj-foot' }, 'Pre potpisa tražite građevinsku dozvolu, broj predmeta i rok za upotrebnu dozvolu u ugovoru, kao i ugovornu kaznu za kašnjenje.'));
  }

  function viewProject(q) {
    const pid = qget(q, 's');
    const P = findProject(pid);
    if (!P) {
      /* id grupe koja nije projekat zgrade (npr. samo vikendice ili garaže iz novogradnje): ponudi oglas */
      const loose = D.listings.filter((x) => x.t === 'prodaja' && isNew(x) && x.ags && x.ags + '--' + x.ns === pid).sort((a, b) => a.p - b.p);
      if (loose.length) return el('div', { class: 'wrap ct' }, empty('Ovo nije projekat zgrade', `${loose.length === 1 ? 'Ova ponuda je pojedinačan oglas' : 'Ove ponude su pojedinačni oglasi'} novogradnje (${S(() => typeOf(loose[0].pt).s.toLowerCase(), loose[0].pt)}), bez rasporeda zgrade.`, 'Svi projekti novogradnje', '#/novogradnja', { icon: 'empty-search', primary: { href: R.listing(loose[0].s), label: 'Pogledaj oglas' } }));
      return el('div', { class: 'wrap ct' }, empty('Projekat nije pronađen', 'Moguće je da je projekat rasprodat ili da je link pogrešan.', 'Svi projekti novogradnje', '#/novogradnja'));
    }
    const l = P.cover;
    const others = projects().filter((x) => x.id !== P.id && x.ags === P.ags).slice(0, 3);
    const near = others.length ? others : projects().filter((x) => x.id !== P.id && x.cs === P.cs).slice(0, 3);
    const street = S(() => mock.street(l), '');
    const box = el('div', { class: 'pj-map' });
    mountMap(box, [...new Set([...P.units, ...D.listings.filter((x) => x.cs === P.cs && x.t === 'prodaja' && isNew(x))])], l);
    const thumb = (i) => el('button', { class: 'ph r16 pj-th', type: 'button', 'aria-label': `Fotografija ${i + 1}`, onclick: () => S(() => lightbox(l, i)) }, img.el(l, i, { aspect: '16:10', alt: '' }));
    const T0 = timeline(P), permitY = T0.items[0].d.getFullYear();
    const permit = `ROP-${(P.cs || 'srb').replace(/[^a-z]/g, '').slice(0, 3).toUpperCase()}-${10000 + (hash(P.id + ':rop') % 89999)}-GR-1/${permitY}`;
    const facts = [['Prodaje', P.agency], ['Status', P.status === 'gradnja' ? 'U izgradnji' : 'Useljivo'], ['Rok završetka', P.rok || (l.y ? `završeno ${l.y}.` : 'završeno')],
      [P.flats ? 'Broj stanova' : 'Broj jedinica', P.perFloor ? String(availOf(P).total) : `${P.units.length} u ponudi`], ['Spratnost', P.flats ? `P+${P.tf}` : P.tf > 1 ? `P+${P.tf - 1}` : 'P'], ['Grejanje', S(() => HEAT[l.he], '') || 'Nije navedeno'],
      ['Parking', P.parking], ['Prodaja na rate', P.rate ? 'Da' : 'Ne']];
    if (l.en) facts.push(['Energetski razred', l.en]);
    facts.push(['Građevinska dozvola br.', [el('span', { class: 'num' }, permit), ' ', demoTag('demo')], 'pj-kf-w']);
    const ctx = {};
    return el('div', { class: 'wrap ct pj pj-page' },
      crumbs([{ label: 'Novogradnja', href: '#/novogradnja' }, { label: P.c, href: R.projects({ c: P.cs }) }, { label: P.name }]),
      el('header', { class: 'pj-phead' },
        el('div', { class: 'dmeta' }, el('span', { class: 'eyebrow' }, 'Novogradnja · ' + P.c), el('span', { class: 'dot' }), el('span', {}, statusLabel(P))),
        el('h1', { class: 't-h1' }, P.name),
        el('p', { class: 'dloc' }, icon('pin'), el('span', { class: 'pj-addr' }, `${street ? street + ', ' : ''}${P.n}${P.m && P.m !== P.n ? ', ' + P.m : ''}, ${P.c}`))),
      el('div', { class: 'pj-hero' },
        el('button', { class: 'ph r16 pj-main', type: 'button', 'aria-label': 'Otvori fotografije', onclick: () => S(() => lightbox(l, 0)) }, img.el(l, 0, { aspect: '16:10', alt: `${P.name} — zgrada` }),
          el('div', { class: 'badges' }, badge('novogradnja'), P.status === 'gradnja' ? badge('u-izgradnji', 'U izgradnji') : null)),
        (l.im || 1) > 2 ? el('div', { class: 'pj-side' }, thumb(1), thumb(2)) : null),
      el('div', { class: 'pj-layout' },
        el('div', { class: 'pj-top' },
          el('div', { class: 'pj-price' }, el('p', { class: 'label' }, 'Cena od'), el('p', { class: 'price pj-big' }, fmt.price(P.from)),
            el('p', { class: 'small' }, el('b', {}, 'od ' + fmt.ppm(P.fromPpm)), ppmDelta(P.ppmUnit) ? [' ', ppmDelta(P.ppmUnit)] : null, ' · cene sa PDV-om · ', `${areaSpan(P)} · ${roomsSpan(P)}`)),
          el('dl', { class: 'keyfacts pj-kf' }, facts.map(([k, v, cls]) => el('div', { class: 'kf' + (cls ? ' ' + cls : '') }, el('dt', {}, k), el('dd', {}, v))))),
        el('div', { class: 'pj-aside' }, contactPanel(P, ctx)),
        el('div', { class: 'pj-rest' }, unitsSection(P, ctx), timelineSection(P), paySection(P), vatSection(P), recordSection(P),
          sec('Lokacija', `${P.n}, ${P.c} · tačna adresa se potvrđuje na obilasku`, box,
            el('p', { class: 'meta pj-foot' }, el('a', { class: 'link', href: S(() => router.href('/mapa', { c: P.cs, newbuild: 1 }), '#/mapa') }, 'Novogradnja na mapi'), ' · ',
              el('a', { class: 'link', href: R.search({ t: 'prodaja', c: P.cs, newbuild: true }) }, `Svi oglasi novogradnje — ${P.c}`))))),
      near.length ? el('section', { class: 'section pj-others' }, (others.length ? sectionHead(`Ostali projekti — ${P.agency}`, null, '#/agencija?s=' + encodeURIComponent(P.ags), 'Sve od agencije') : sectionHead(`Još novogradnje — ${P.c}`, null, R.projects({ c: P.cs }), `Svi projekti — ${P.c}`)),
        el('div', { class: 'pj-grid pj-grid-3' }, near.map((x) => projectCard(x, true)))) : null);
  }

  /* ═════════════════════════ SAVETI ═════════════════════════ */
  const CATS = [{ v: '', l: 'Sve' }, { v: 'saveti', l: 'Saveti' }, { v: 'vodici', l: 'Vodiči' }, { v: 'zakon', l: 'Zakon' }, { v: 'finansije', l: 'Finansije' }, { v: 'trziste', l: 'Tržište' }, { v: 'iznajmljivanje', l: 'Iznajmljivanje' }];
  const CMAP = { saveti: 'saveti', vodici: 'vodici', 'pravni-saveti': 'zakon', kredit: 'finansije', trziste: 'trziste' };
  const tagsOf = (a) => { const t = [CMAP[a.c] || 'saveti']; if (/izda|zakup|kirij|prinos/i.test(a.t + ' ' + a.s)) t.push('iznajmljivanje'); return t; };
  const catLabel = (a) => (CATS.find((c) => c.v === tagsOf(a)[0]) || CATS[1]).l;
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
  const artImg = (a, eager) => el('img', { src: S(() => img.article(a.s), ''), alt: '', width: 800, height: 500, decoding: 'async', loading: eager ? null : 'lazy' });
  const byline = (a) => el('p', { class: 'ar-by' }, el('span', { class: 'ar-av', 'aria-hidden': 'true' }, initials(a.au)), el('span', {}, el('b', {}, a.au), ` · ${a.rm} min čitanja`));

  /* CTA po temi: [label, filteri | href] */
  const UKS = ['uknjižen stan na prodaju', 'uknjižena stana na prodaju', 'uknjiženih stanova na prodaju'];
  const CTA = {
    'sta-proveriti-pri-obilasku-stana-checklist': [['stan na prodaju', 'stana na prodaju', 'stanova na prodaju'], { t: 'prodaja', pt: ['stan'] }],
    'kako-kupiti-prvi-stan-u-srbiji': [UKS, { t: 'prodaja', pt: ['stan'], reg: true }],
    'kako-izdati-stan-bez-problema': [['stan za izdavanje', 'stana za izdavanje', 'stanova za izdavanje'], { t: 'izdavanje', pt: ['stan'] }],
    'cene-stanova-u-beogradu-2026': [['stan na prodaju u Beogradu', 'stana na prodaju u Beogradu', 'stanova na prodaju u Beogradu'], { t: 'prodaja', pt: ['stan'], c: 'beograd' }],
    'stambeni-kredit-korak-po-korak': [['uknjižen stan — može na kredit', 'uknjižena stana — mogu na kredit', 'uknjiženih stanova — mogu na kredit'], { t: 'prodaja', pt: ['stan'], reg: true }],
    'kako-napisati-oglas-i-fotografisati-stan': ['Postavi oglas', '#/postavi'],
    'provera-uknjizenosti-i-list-nepokretnosti': [['uknjižena nekretnina na prodaju', 'uknjižene nekretnine na prodaju', 'uknjiženih nekretnina na prodaju'], { t: 'prodaja', reg: true }],
    'useljenje-i-prenos-brojila-na-novog-vlasnika': [UKS, { t: 'prodaja', pt: ['stan'], reg: true }],
    'subvencionisani-stambeni-krediti-za-mlade': [['uknjižen stan do 120.000 €', 'uknjižena stana do 120.000 €', 'uknjiženih stanova do 120.000 €'], { t: 'prodaja', pt: ['stan'], reg: true, pmax: 120000 }],
    'trziste-nekretnina-u-novom-sadu-2026': [['stan na prodaju u Novom Sadu', 'stana na prodaju u Novom Sadu', 'stanova na prodaju u Novom Sadu'], { t: 'prodaja', pt: ['stan'], c: 'novi-sad' }],
    'ugovor-o-kupoprodaji-i-overa-kod-javnog-beleznika': [UKS, { t: 'prodaja', pt: ['stan'], reg: true }],
    'investiranje-u-nekretnine-i-prinos-od-izdavanja': [['oglas za garsonjere i jednosobne stanove', 'oglasa za garsonjere i jednosobne stanove', 'oglasa za garsonjere i jednosobne stanove'], { t: 'prodaja', pt: ['stan'], ro: [0.5, 1] }],
  };
  function ctaBlock(a) {
    const [lbl, f] = CTA[a.s] || [['oglas na prodaju', 'oglasa na prodaju', 'oglasa na prodaju'], { t: 'prodaja' }];
    if (typeof f === 'string') return el('div', { class: 'ar-cta' }, el('p', { class: 'eyebrow' }, 'Spremni?'), el('p', { class: 'ar-cta-t' }, 'Oglas sa tačnom kvadraturom, iskrenim opisom i osam dobrih fotografija.'), el('a', { class: 'btn btn-primary', href: f }, lbl));
    /* isti tok kao rezultati pretrage: bez sekundarnih duplikata i bez sakrivenih oglasa */
    const n = S(() => KX.count({ ...f, dup: true, hidden: true }), S(() => applyFilters({ ...FILTER_DEFAULTS, ...f }).length, null));
    return el('div', { class: 'ar-cta' }, el('p', { class: 'eyebrow' }, 'Iz ponude na Kvadrat.rs'),
      el('p', { class: 'ar-cta-t' }, n != null ? el('b', { class: 'num' }, fmt.num(n)) : null, ' ', n != null ? plu(n, lbl[0], lbl[1], lbl[2]) : lbl[2]),
      el('a', { class: 'btn btn-primary', href: R.search(f) }, 'Pogledaj oglase', icon('arrow-right')));
  }

  /* mini-markup tela: "## naslov", "- stavka", "1. stavka", "> izdvojeno", "[[bars:grad]]", ostalo = pasus; **masno** */
  function inline(txt) {
    return txt.split(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g).flatMap((s, i, arr) => (i % 3 === 1 ? [el('a', { href: arr[i + 1], target: '_blank', rel: 'noopener' }, s)] : i % 3 === 2 ? []
      : s.split(/\*\*(.+?)\*\*/g).map((t, j) => (j % 2 ? el('b', {}, t) : t))));
  }
  function renderBody(src) {
    const out = [], toc = [];
    let list = null;
    src.trim().split('\n').map((s) => s.trim()).filter(Boolean).forEach((line) => {
      const ol = line.match(/^(\d+)\.\s+(.*)$/), ul = line.match(/^-\s+(.*)$/);
      if (ol || ul) {
        const tag = ol ? 'ol' : 'ul';
        if (!list || list.tagName.toLowerCase() !== tag) { list = el(tag, ol ? { start: ol[1], style: 'counter-reset:ar ' + (ol[1] - 1) } : {}); out.push(list); }
        list.append(el('li', {}, inline(ol ? ol[2] : ul[1]))); return;
      }
      list = null;
      if (line.startsWith('## ')) { const id = 'ar-' + (toc.length + 1); toc.push({ id, t: line.slice(3) }); out.push(el('h2', { id }, line.slice(3))); }
      else if (line.startsWith('> ')) out.push(el('aside', { class: 'ar-callout' }, el('p', {}, inline(line.slice(2)))));
      else if (/^\[\[bars:([\w-]+)\]\]$/.test(line)) out.push(dataFigure(line.match(/^\[\[bars:([\w-]+)\]\]$/)[1]));
      else out.push(el('p', {}, inline(line)));
    });
    if (out[0] && out[0].tagName === 'P') out[0].classList.add('ar-first');
    return { nodes: out, toc };
  }
  function dataFigure(cs) {
    const rows = S(() => stats.munIndex(cs, 'prodaja', 'stan').filter((r) => r.n >= 3), []);
    if (!rows.length) return null;
    const city = S(() => find.city(cs), { n: cs, loc: cs });
    return el('figure', { class: 'ar-fig' }, el('figcaption', { class: 'eyebrow' }, 'Stanovi, prodaja · medijana €/', unitM2(), ` · ${city.n}`),
      bars(rows.map((r) => ({ label: r.m, value: r.ppm, n: r.n })), { format: (v) => fmt.ppm(v) }),
      el('p', { class: 'meta' }, `Izvor: oglasi na Kvadrat.rs danas (n = broj oglasa; prikazani delovi grada sa najmanje 3 oglasa). Tražene, ne ostvarene cene.`));
  }

  function articleCard(a, size) {
    return el('article', { class: 'ar-card' + (size ? ' ar-card-' + size : '') },
      el('a', { class: 'ph r16', href: R.article(a.s), tabindex: '-1', 'aria-hidden': 'true' }, artImg(a, size === 'lead')),
      el('div', { class: 'ar-cb' }, el('p', { class: 'eyebrow' }, catLabel(a)),
        el(size === 'lead' ? 'h2' : 'h3', { class: 'ar-t' }, el('a', { href: R.article(a.s) }, a.t)),
        el('p', { class: 'ar-ex' }, a.e), byline(a)));
  }

  function viewArticles(q) {
    const A = D.articles || [];
    let k = qget(q, 'k');
    if (!CATS.some((c) => c.v === k)) k = '';
    const holder = el('div', { class: 'ar-list' });
    const counts = {}; A.forEach((a) => tagsOf(a).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    const paint = () => {
      const L = A.filter((a) => !k || tagsOf(a).includes(k));
      const lead = L.find((a) => a.f) || L[0];
      const side = L.filter((a) => a !== lead && a.f).slice(0, 2);
      const rest = L.filter((a) => a !== lead && !side.includes(a));
      holder.innerHTML = '';
      if (!lead) { holder.append(empty('Nema tekstova u ovoj kategoriji', 'Pogledajte sve savete.', 'Svi saveti', '#/saveti')); return; }
      holder.append(el('div', { class: 'ar-feat' + (side.length ? '' : ' solo') }, articleCard(lead, 'lead'), side.length ? el('div', { class: 'ar-side' }, side.map((a) => articleCard(a, 'side'))) : null));
      if (rest.length) holder.append(el('div', { class: 'ar-grid' }, rest.map((a) => articleCard(a))));
      replaceUrl('articles', k);
    };
    const cats = pills(CATS.filter((c) => !c.v || counts[c.v]).map((c) => ({ v: c.v, l: c.l, n: c.v ? counts[c.v] : A.length })), [k], (v) => { k = v; paint(); }, { single: true });
    paint();
    return el('div', { class: 'wrap ct ar' },
      crumbs([{ label: 'Početna', href: '#/' }, { label: 'Saveti', href: '#/saveti' }]),
      el('header', { class: 'ar-head' }, el('p', { class: 'eyebrow' }, 'Saveti · vodiči · zakon'),
        el('h1', { class: 't-h1' }, 'Kupovina, zakup i papiri — bez iznenađenja'),
        el('p', { class: 'lede' }, 'Praktični tekstovi o porezu, kreditu, ugovoru i proveri u katastru. Pisani za 2026. i proveravani uz propise, sa brojevima koje možete da ponovite.')),
      el('div', { class: 'rail ar-cats', role: 'group', 'aria-label': 'Kategorije' }, cats),
      holder,
      el('p', { class: 'meta ar-tools' }, 'Alati uz tekstove: ', el('a', { class: 'link', href: '#/kalkulator' }, 'kalkulator kredita i troškova'), ' · ',
        el('a', { class: 'link', href: '#/procena' }, 'procena vrednosti'), ' · ', el('a', { class: 'link', href: '#/kako-racunamo' }, 'kako računamo')));
  }

  function viewArticle(q) {
    const A = D.articles || [];
    const a = A.find((x) => x.s === qget(q, 's'));
    if (!a) return el('div', { class: 'wrap ct' }, empty('Tekst nije pronađen', 'Link je možda zastareo.', 'Svi saveti', '#/saveti'));
    const { nodes, toc } = renderBody(BODY[a.s] || a.e);
    const tg = tagsOf(a);
    const rel = A.filter((x) => x !== a).map((x) => ({ x, sc: (tagsOf(x).some((t) => tg.includes(t)) ? 2 : 0) + (x.c === a.c ? 1 : 0) })).sort((p, r) => r.sc - p.sc || (p.x.s < r.x.s ? -1 : 1)).slice(0, 3).map((o) => o.x);
    return el('div', { class: 'wrap ct ar ar-page' },
      crumbs([{ label: 'Saveti', href: '#/saveti' }, catLabel(a) === 'Saveti' ? null : { label: catLabel(a), href: R.articles(tg[0]) }, { label: a.t }].filter(Boolean)),
      el('div', { class: 'ar-grid2' },
        el('article', { class: 'ar-main' },
          el('header', { class: 'ar-ah' }, el('p', { class: 'eyebrow' }, catLabel(a)), el('h1', { class: 't-h1' }, a.t), el('p', { class: 't-desc-lede ar-lede' }, a.e), byline(a)),
          el('div', { class: 'ph r16 ar-hero' }, artImg(a, true)),
          el('div', { class: 'ar-body' }, nodes),
          ctaBlock(a)),
        toc.length ? el('aside', { class: 'ar-aside' }, el('nav', { class: 'ar-toc', 'aria-label': 'Sadržaj teksta' }, el('p', { class: 'label' }, 'U ovom tekstu'),
          el('ol', {}, toc.map((t) => el('li', {}, el('a', { href: '#' + t.id, onclick: (e) => { e.preventDefault(); const h = document.getElementById(t.id); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, t.t)))))) : null),
      el('section', { class: 'section ar-rel' }, sectionHead('Povezani saveti', null, '#/saveti', 'Svi saveti'), el('div', { class: 'ar-grid' }, rel.map((x) => articleCard(x)))));
  }

  /* ───── tela članaka (2026, Srbija) ───── */
  const BODY = {
    'sta-proveriti-pri-obilasku-stana-checklist': `
Prvi obilazak traje dvadesetak minuta, a odluka se nosi decenijama. Zato na gledanje stana ne idite samo sa utiskom, nego sa spiskom. Lista je podeljena u četiri celine po deset tačaka — otvorite je na telefonu i prođite redom, bez preskakanja.
## Stan iznutra
1. Mrlje i tragovi vlage na plafonu, u uglovima i iza nameštaja.
2. Miris buđi u ormarima, ostavi i kupatilu.
3. Stolarija: zaptivanje, okovi, kondenz između stakala.
4. Ravnost poda — dovoljna je libela na telefonu.
5. Pukotine na zidovima, naročito kose iznad vrata i prozora.
6. Pritisak vode: pustite istovremeno tuš i sudoperu.
7. Odvodi: koliko brzo voda otiče iz kade i lavaboa.
8. Električna tabla: automatski osigurači ili stari topljivi umeci.
9. Broj utičnica u kuhinji i sobama.
10. Stvarna površina i visina plafona — ponesite metar.
## Grejanje i troškovi
11. Vrsta grejanja i starost kotla ili radijatora.
12. Računi za grejanje i struju za prošlu zimu.
13. Da li se grejanje plaća po m² ili po utrošku.
14. Dugovanja za Infostan, struju i vodu — tražite potvrde.
15. Mesečno izdvajanje za stambenu zajednicu.
16. Izolacija fasade i debljina spoljnog zida.
17. Klima uređaji: starost i gde je spoljna jedinica.
18. Energetski razred, ako postoji pasoš.
19. Orijentacija: kada sunce ulazi u dnevnu sobu.
20. Hladni zidovi i promaja u spavaćim sobama.
## Zgrada
21. Stanje ulaza, stepeništa i krova.
22. Lift: da li radi i ko ga održava.
23. Tragovi curenja na poslednjem spratu.
24. Podrum i ostava: vlaga i da li pripadaju stanu.
25. Ko je upravnik zgrade i kako se dolazi do njega.
26. Planirani radovi i stanje fonda za održavanje.
27. Parking: ulica, dvorište ili garaža, i da li je zona naplate.
28. Zvučna izolacija — zamolite da neko hoda u stanu iznad.
29. Broj stanova na spratu i šta je preko zida.
30. Interfon, brava na ulazu, osvetljenje stepeništa.
## Papiri i okolina
31. List nepokretnosti: ko je upisan kao vlasnik.
32. Da li je površina iz lista ista kao u oglasu.
33. Tereti: hipoteka, zabeležba spora, zakup.
34. Da li su sve izmene legalne — zatvorena terasa, pripojen hodnik.
35. Lična karta prodavca u odnosu na ime u listu.
36. Buka sa ulice ujutru i uveče — dođite dvaput.
37. Put do posla u vreme gužve.
38. Škola, vrtić, pijaca i dom zdravlja na pešačkoj udaljenosti.
39. Šta se gradi na susednim placevima.
40. Mobilni signal i internet u zgradi.
> Ne dajte kaparu na dan prvog obilaska. Uzmite broj lista nepokretnosti, proverite ga u [eKatastru](https://katastar.rgz.gov.rs/eKatastarPublic/) i tek onda razgovarajte o ceni.
Ako na više od pet tačaka dobijete odgovor „ne znam“, to nije razlog da odustanete, ali jeste razlog da pitanja pošaljete pismeno i odgovore sačuvate.`,

    'kako-kupiti-prvi-stan-u-srbiji': `
Kupovina prvog stana ima pet faza: budžet, izbor, provera papira, ugovor i upis. Svaka ima svoju zamku, a skupe greške najčešće nastaju kada se neka faza preskoči.
## 1. Realan budžet, a ne cena iz oglasa
Uz cenu računajte porez na prenos apsolutnih prava od 2,5 % kod starogradnje — zakonski ga duguje prodavac, ali se ugovorom gotovo uvek prebacuje na kupca. Dodajte proviziju agencije od 2 do 3 % + PDV ako ste potpisali posrednički ugovor, overu kod javnog beležnika i upis u katastar. Kod novogradnje od investitora PDV od 10 % je već u ceni, a porez na prenos se ne plaća.
Za stambeni kredit banke najčešće traže 20 % učešća. Za prvi stan propisi dozvoljavaju i 10 %, ali to nudi manji broj banaka.
## 2. Olakšice za prvi stan
- **Starogradnja:** oslobođenje od poreza na prenos za do 40 m² i još 15 m² za svakog člana domaćinstva. Smanjuje novac potreban na dan kupovine.
- **Novogradnja:** povraćaj PDV-a za istu kvadraturu, računat na cenu bez PDV-a. Zahtev se podnosi posle isplate cele cene na račun prodavca, a novac stiže tridesetak do četrdeset pet dana kasnije — na dan kupovine ga nemate.
Uslov je u oba slučaja sličan: punoletni ste državljanin sa prebivalištem u Srbiji i od 1. jula 2006. niste imali stan u vlasništvu. Kod povraćaja PDV-a članovi domaćinstva moraju biti prijavljeni na istoj adresi.
## 3. Provera pre kapare
Tražite broj lista nepokretnosti i proverite ga u [eKatastru](https://katastar.rgz.gov.rs/eKatastarPublic/): ko je vlasnik, kolika je površina i ima li tereta. Pitajte za dugovanja za komunalije i stambenu zajednicu i tražite potvrde.
> Kapara je uobičajeno 10 % cene. Ako odustane kupac, gubi je; ako odustane prodavac, vraća je dvostruko. Zato se daje tek posle provere papira, uz pisani predugovor.
## 4. Ugovor i overa
Ugovor o kupoprodaji mora da potvrdi (solemnizuje) javni beležnik. Cena se plaća sa računa na račun, a ugovor treba da sadrži rok predaje stana i saglasnost prodavca za upis kupca u katastar.
## 5. Upis i useljenje
Javni beležnik po službenoj dužnosti šalje ugovor katastru i Poreskoj upravi. Kada stignu rešenje o upisu i rešenje o porezu, stan je i formalno vaš. Na primopredaji zapišite stanje brojila i u roku od 30 dana prijavite porez na imovinu.`,

    'kako-izdati-stan-bez-problema': `
Izdavanje stana je posao, čak i kada izdajete samo jedan. Dobar zakupac, jasan ugovor i prijavljen prihod štede više novca nego nekoliko evra veća kirija.
## Priprema stana
Pre fotografisanja popravite sitnice koje zakupac primeti na prvom obilasku: slavine koje kaplju, pregorele sijalice, silikon u kupatilu. Napravite spisak opreme sa fotografijama — on postaje prilog ugovoru.
## Izbor zakupca
- Tražite ličnu kartu i pitajte gde je osoba ranije stanovala.
- Proverite da li je kirija razumna u odnosu na primanja; dobar okvir je da ne prelazi trećinu.
- Ne žurite: prazan stan nedelju dana duže košta manje od zakupca koji ne plaća.
Prvi razgovor vodite u stanu, ne preko poruka. Zakupac koji pita za račune, komšije i otkazni rok obično i plaća na vreme.
## Šta mora u ugovor
- Visina kirije, rok i način plaćanja — na račun, a ne u gotovini bez potvrde.
- Trajanje zakupa i otkazni rok za obe strane.
- Ko plaća Infostan, struju, grejanje i stambenu zajednicu.
- Iznos depozita i uslovi za njegov povraćaj.
- Pravila o ljubimcima, pušenju i podzakupu.
- Zapisnik o primopredaji sa stanjem brojila, kao prilog.
## Depozit
Uobičajen je depozit u visini jedne kirije, a za namešten stan ili stan sa ljubimcima i dve. Depozit nije poslednja kirija: pokriva štetu i neplaćene račune i vraća se po iseljenju, umanjen samo za ono što je zapisnički utvrđeno.
> Zapisnik o primopredaji sa datumom, fotografijama i stanjem svih brojila najjeftinija je zaštita i za vlasnika i za zakupca. Potpisuju ga obe strane, pri useljenju i pri iseljenju.
## Porez na prihod od izdavanja
Prihod od izdavanja stana oporezuje se po stopi od 20 %, uz priznate normirane troškove od 25 %, pa je stvarno opterećenje 15 % kirije. Kada zakupac nije firma, vlasnik sam podnosi poresku prijavu u roku od 30 dana od dana kada je primio kiriju (obrazac PPDG-1S, preko portala ePorezi).
Ako izdajete preko agencije, provizija je obično od 40 do 50 % jedne kirije. U Beogradu je sve češće plaća vlasnik, a agencija je dužna da unapred jasno navede iznos i ko ga plaća.`,

    'cene-stanova-u-beogradu-2026': `
Beograd je i dalje najskuplje tržište u Srbiji, ali razlike između opština veće su od razlika između gradova. Ispod je presek oglasa za prodaju stanova na Kvadrat.rs: medijana cene po kvadratu za svaku opštinu sa dovoljno oglasa.
[[bars:beograd]]
## Centar i Novi Beograd
Savski venac, Vračar i Stari grad drže vrh, uz Beograd na vodi kao posebno tržište sa sopstvenim cenama. Novi Beograd je između: stari blokovi iz sedamdesetih i nove zgrade uz bulevare ponekad se razlikuju i za trećinu po kvadratu, iako su na istoj adresi u pretrazi.
## Gde se cene najbrže menjaju
Najbrže se pomeraju delovi grada koji se popunjavaju novogradnjom — Zvezdara, Voždovac, Palilula prema Borči i Zemun prema Altini. Tamo nova zgrada podiže prosek celog naselja, pa medijana raste i kada starije stanove niko ne preprodaje skuplje.
Prema indeksu cena Republičkog geodetskog zavoda, stanovi u Srbiji su u poslednjem tromesečju 2025. bili oko 5,7 % skuplji nego godinu dana ranije.
## Tražena i ostvarena cena
Oglasi pokazuju tražene cene. Ostvarene cene iz ugovora, koje RGZ objavljuje u registru cena nepokretnosti, po pravilu su niže — razlika je često 10 do 30 %, najviše kod stanova koji dugo stoje na oglasu.
## Šta to znači za kupca
- Poredite stan sa oglasima iz istog naselja i iste vrste zgrade, ne sa prosekom cele opštine.
- Novogradnja u istom kraju po pravilu je 15 do 30 % skuplja po kvadratu od starogradnje.
- Stan koji je na oglasu duže od tri meseca gotovo uvek ima prostor za pregovor.
- Sprat bez lifta, TA peć ili neuknjižen status opravdavaju nižu ponudu.
## Kirija ili kupovina
U centralnim opštinama godišnja kirija iznosi orijentaciono 4 do 5 % cene stana; na obodu grada odnos je povoljniji za kupca koji izdaje, ali je tražnja sporija.
> Medijana nije cena vašeg stana. Sprat, lift, grejanje i papiri pomeraju cenu i do 15 % u istoj ulici — za konkretan stan gledajte uporedive oglase, a ne prosek opštine.`,

    'stambeni-kredit-korak-po-korak': `
Stambeni kredit u Srbiji se odobrava u šest koraka. Najviše vremena ne odnosi banka, već papiri za stan — zato ih pripremite pre nego što date kaparu.
## 1. Kreditna sposobnost
Banka računa koliku ratu možete da nosite: najčešće do oko polovine redovnih mesečnih primanja domaćinstva, umanjeno za postojeće rate. Pripremite potvrdu o zaradi i izvod sa računa za poslednjih šest meseci.
Ako imate drugi kredit, karticu ili dozvoljeni minus, banka ih računa kao obavezu čak i kada ih ne koristite — zatvorite ih pre zahteva.
## 2. Učešće
Standard je 20 % cene. Za prvi stan propisi dozvoljavaju i 10 %, a država povremeno ima i programe za mlade sa još nižim učešćem. Učešće uplaćujete sami, pre isplate kredita.
## 3. Procena i papiri
Banka angažuje ovlašćenog procenitelja (orijentaciono 100–150 €) i odobrava kredit na manji iznos od procenjene vrednosti i cene. Stan mora biti uknjižen; za stan u procesu uknjižavanja ili upisan po zakonu iz 2025. odluka zavisi od banke.
## 4. Osiguranje kod NKOSK
Neke banke traže osiguranje kredita kod Nacionalne korporacije za osiguranje stambenih kredita. Premija se plaća jednom i iznosi približno 1,5 do 3,5 % iznosa kredita — što je učešće manje, premija je veća. Zauzvrat banka obično nudi nižu kamatu.
## 5. Kamata i troškovi
Krediti su vezani za evro. Promenljiva kamata je EURIBOR plus marža banke; fiksna je na početku viša, ali se rata ne menja. Upoređujte efektivnu kamatnu stopu (EKS), jer ona uključuje i troškove:
- obradu kredita, do oko 0,5 % iznosa,
- upis hipoteke i overu založne izjave,
- osiguranje nekretnine i, često, životno osiguranje dužnika.
Primer: za kredit od 100.000 € na 25 godina rata je oko 585 € uz kamatu od 5 %, a oko 528 € uz 4 %. Jedan procentni poen razlike znači oko 17.000 € za ceo period.
## 6. Ugovor i isplata
Posle overe kupoprodajnog ugovora i upisa hipoteke, banka isplaćuje novac direktno na račun prodavca. Vi dobijate ključeve, a banka zalogu dok se kredit ne otplati.
> Pre kapare uzmite od banke pismenu preliminarnu ponudu za konkretan iznos. Ako kredit ne bude odobren, kapara se gubi — osim ako u predugovoru ne piše drugačije.`,

    'kako-napisati-oglas-i-fotografisati-stan': `
Dobar oglas ne prodaje stan, nego obilazak. Cilj je da vas zovu ljudi kojima stan zaista odgovara, a da ostali odustanu pre poziva.
## Naslov: struktura, kvadratura, mesto
„Dvosoban stan, 58 m², Zvezdara · Lion“ radi bolje od „PRELEP STAN, HITNO!!!“. Kupci pretražuju po strukturi i naselju, a velika slova i uzvičnici deluju kao preprodavac.
## Opis koji odgovara na pitanja
- Prva rečenica: šta je najbolje — pogled, mirna strana, renoviranje iz 2024.
- Sprat i lift, grejanje, orijentacija i godina zgrade.
- Pravni status: uknjiženo, bez tereta.
- Troškovi: Infostan zimi i leti, stambena zajednica.
- Šta ostaje u stanu, a šta nosite.
Opis pišite u punim rečenicama, bez skraćenica kao „CG, PVC, VPR“ — kupac sa telefona čita brzo, a nejasan oglas preskače.
Iskreno navedite i mane — „prozori iz 1985.“ — jer ih kupac ionako vidi na obilasku, a iskren oglas privlači ozbiljnije pozive.
## Fotografije
- Snimajte danju, sa upaljenim svetlima i razmaknutim zavesama.
- Horizontalno, iz ugla prostorije, sa visine grudi.
- Sklonite sitnice sa pultova, iz kupatila i sa stočića.
- Prva fotografija je najsvetlija prostorija ili zgrada spolja.
- Najmanje osam fotografija i tlocrt, makar ručno nacrtan.
- Bez filtera i širokougaonih trikova: kupac koji na obilasku vidi manji stan nego na slikama odlazi razočaran.
## Posle objave
- Odgovarajte na poruke istog dana; prvi dani donose najviše upita.
- Zapišite pitanja koja se ponavljaju i odgovor dodajte u opis.
- Na obilasku imajte list nepokretnosti i poslednje račune pri ruci.
- Ne podižite oglas bez razloga — kupci vide koliko dugo je stan na tržištu.
## Cena
Proverite cene po kvadratu u svom naselju i krenite od realne cene. Oglas koji posle mesec dana dobije oznaku „snižena cena“ deluje lošije od tačne cene od prvog dana.
> Navedite tačnu kvadraturu iz lista nepokretnosti. Razlika između oglasa i lista je prvo što kupac i njegov advokat primete.
Ako stan prodajete preko agencije, tražite da vidite tekst i fotografije pre objave. Oglas je vaša izjava o stanu, bez obzira na to ko ga je napisao.`,

    'provera-uknjizenosti-i-list-nepokretnosti': `
List nepokretnosti je jedini dokument koji pokazuje ko je vlasnik stana i šta na njemu ima. Čita se za pet minuta, ako znate gde da gledate.
## Gde ga naći
U [eKatastru](https://katastar.rgz.gov.rs/eKatastarPublic/) svako može besplatno da pronađe nepokretnost po katastarskoj opštini i broju parcele ili po adresi i vidi osnovne podatke i terete. Za kupovinu tražite svež izvod — ne stariji od nekoliko dana — koji pribavlja prodavac ili javni beležnik.
Sam broj lista nije dovoljan: tražite i broj posebnog dela, jer u istoj zgradi na istoj parceli može biti stotinak stanova.
## Četiri dela lista
- **A list** — parcela: broj, površina, vrsta zemljišta.
- **B list** — imaoci prava na parceli.
- **V list** — zgrada i posebni delovi: ovde je vaš stan, sa brojem, spratom, površinom i vlasnikom.
- **G list** — tereti i ograničenja: hipoteka, zabeležbe, zakup, spor.
## Šta mora da se poklapa
- Ime vlasnika u V listu i lična karta prodavca.
- Površina u listu, u oglasu i u ugovoru.
- Udeo: 1/1 znači jednog vlasnika; 1/2 znači da potpisuju oba.
- Prazan G list, ili hipoteka koja se briše isplatom na dan overe.
## Statusi koje ćete sresti
- **Uknjiženo** — pravo svojine je upisano i banka može da kreditira.
- **U procesu uknjižavanja** — tipično za novogradnju posle upotrebne dozvole.
- **Upisano po zakonu iz 2025.** — Zakon o posebnim uslovima za evidentiranje i upis prava na nepokretnostima omogućio je upis objekata bez dozvole; upis ne potvrđuje da je objekat bezbedan, a banke takve stanove procenjuju pojedinačno.
- **U postupku ozakonjenja** — nema upisa dok ne postane pravosnažno rešenje.
- **Nije upisano** — kupujete rizik, ne stan.
## Kada nešto ne štima
Ako se ime u listu razlikuje od imena prodavca, tražite osnov: ugovor, rešenje o nasleđivanju ili presudu koji još nisu upisani. Takav stan može da se kupi, ali tek kada prodavac prvo upiše svoje pravo — kapara pre toga je rizik koji ne treba preuzimati.
> Zabeležba u G listu nije formalnost. Ako piše „zabeležba spora“ ili „zabrana otuđenja“, ne dajte kaparu dok advokat ne pročita predmet.`,

    'useljenje-i-prenos-brojila-na-novog-vlasnika': `
Ključevi su predati, ali posao nije gotov. U prvih mesec dana treba preneti račune na sebe i prijaviti porez — inače stižu opomene za tuđe dugove i kazne za zakašnjenje.
## Na dan primopredaje
- Zapisnik: datum, stanje brojila struje, vode, gasa i kalorimetra, broj ključeva, oprema koja ostaje.
- Fotografije svih brojila, sa vidljivim brojem.
- Potvrde da nema dugovanja za Infostan, struju i stambenu zajednicu.
Ako prodavac duguje, dug ne prelazi automatski na vas, ali brojilo ostaje blokirano dok se ne razjasni — zato potvrde tražite pre isplate poslednjeg dela cene.
## Prvih 30 dana
1. Struja: promena kupca kod snabdevača, uz ugovor o kupoprodaji i zapisnik.
2. Infostan, odnosno komunalno preduzeće u vašem gradu: prijava novog vlasnika za grejanje, vodu i odnošenje smeća.
3. Gas, ako ga ima: distributer u vašem mestu.
4. Porez na imovinu: prijava lokalnoj poreskoj administraciji u roku od 30 dana od sticanja (obrazac PPI-2).
5. Prebivalište: prijava nove adrese u policijskoj stanici.
6. Stambena zajednica: javite se upravniku, upišite se u spisak vlasnika i dogovorite plaćanje održavanja.
Rokovi nisu formalnost: kazna za neprijavljen porez na imovinu i kamata na zakasnelo plaćanje stižu godinama kasnije, a račun za grejanje stiže na ime onoga ko je upisan kod Infostana, bez obzira ko stanuje.
Za svaku prijavu ponesite ličnu kartu, kopiju overenog ugovora i zapisnik; većina preduzeća prima zahteve i elektronski.
## Posle toga
Prebacite internet i televiziju, ugovorite osiguranje stana (banka ga traži ako imate kredit) i promenite bravu na ulaznim vratima — ne znate koliko je ključeva bilo u opticaju.
> Ne potpisujte zapisnik bez stanja brojila. Bez toga se račun prethodnog vlasnika lako prelije na vas, a dokazivanje traje mesecima.
Sačuvajte sve potvrde u jednoj fascikli: ugovor, rešenje o upisu, rešenje o porezu i zapisnik. Trebaće vam pri prodaji ili za kredit.
Ako u stanu ostaje zakupac prethodnog vlasnika, tražite njegov ugovor pre primopredaje: zakup se ne raskida sam od sebe prodajom, pa uslove treba dogovoriti pisanim putem.`,

    'subvencionisani-stambeni-krediti-za-mlade': `
Država je 2025. pokrenula program stambenih kredita za mlade: manje učešće, uz garanciju države, preko poslovnih banaka. Uslovi se menjaju od faze do faze, zato ovde objašnjavamo kako program radi i šta treba proveriti, a ne konačne brojke.
## Kome je namenjen
- Mladima do 35 godina koji kupuju prvu nekretninu.
- Kupcu koji nema stan ili kuću u vlasništvu — banka to proverava u katastru.
- Kupovini stana ili kuće u Srbiji, uz uslove banke za kreditnu sposobnost.
## Šta donosi
Glavna olakšica je učešće — u prvoj fazi programa svega 1 % cene, umesto uobičajenih 20 %. Država garantuje deo kredita, pa banka prihvata veći iznos u odnosu na vrednost stana. Sam kupoprodajni postupak je isti kao kod običnog kredita: procena, overa ugovora, upis hipoteke i isplata prodavcu.
## Kada se isplati
Niže učešće znači veći kredit i više plaćene kamate. Primer za stan od 100.000 € na 30 godina uz kamatu od 5 %:
- sa 1 % učešća kredit je 99.000 €, a rata oko 531 € mesečno;
- sa 20 % učešća kredit je 80.000 €, a rata oko 429 € mesečno;
- razlika je oko 100 € mesečno i oko 17.700 € kamate za ceo period.
Ako vam bez programa treba još pet godina štednje za učešće, a cene u međuvremenu rastu, program se isplati. Ako učešće već imate, nižu ratu donosi veće učešće.
## Kako se prijaviti
1. Proverite kod dve ili tri banke da li učestvuju u programu i koliki kredit možete da dobijete.
2. Pronađite stan koji je uknjižen ili za koji banka prihvata procenu.
3. Predajte zahtev sa dokumentacijom o primanjima; banka proverava uslove programa.
4. Posle odobrenja potpisujete kupoprodajni ugovor, a banka isplaćuje prodavca.
## Na šta da pazite
- Da li je kamata fiksna ceo period ili samo prvih godina.
- Da li banka uz program traži i životno osiguranje ili prenos zarade.
- Olakšice za prvi stan — povraćaj PDV-a ili oslobođenje od poreza — proverite da li se mogu kombinovati sa programom.
> Najveća zamka nije kamata, već troškovi oko kupovine. Čak i uz 1 % učešća potrebno vam je između 3 i 6 % cene u gotovini za porez, proviziju, overu i selidbu.`,

    'trziste-nekretnina-u-novom-sadu-2026': `
Novi Sad je drugo tržište u Srbiji po ceni kvadrata i prvo po udelu novogradnje u ponudi. Studenti, mladi iz cele Vojvodine i kupci iz Beograda drže tražnju stabilnom i van sezone.
[[bars:novi-sad]]
## Naselja
Centar i Stari grad su najskuplji, ali sa najmanje ponude. Grbavica, Liman i Detelinara su najtraženiji spoj cene i lokacije: kraći put do centra i fakulteta, dosta novih zgrada. Telep, Salajka i Podbara su jeftiniji, sa mešavinom kuća i manjih stambenih zgrada, a Veternik i Futog nude najviše prostora za isti novac uz duži put do grada.
Razlike unutar istog naselja su velike: nova zgrada uz bulevar i stara kuća dve ulice dalje mogu se razlikovati i za polovinu cene po kvadratu, pa medijanu čitajte samo kao orijentir.
## Studentska tražnja
Oko univerzitetskog kampusa na Limanu jednosobni stanovi i garsonjere izdaju se gotovo bez praznog meseca. Najveća potražnja je krajem leta i u septembru, pa se ugovori o zakupu najčešće potpisuju na jednu akademsku godinu.
## Novogradnja
Veliki deo ponude čine stanovi od investitora, često sa rokom useljenja od godinu ili dve. Cene uključuju PDV od 10 %, a kupac prvog stana može da traži povraćaj za odgovarajuću kvadraturu. Pre potpisa proverite građevinsku dozvolu i šta ugovor kaže o kašnjenju.
## Na šta da pazite
- Isti naziv naselja pokriva vrlo različite ulice — Liman 1 i Liman 4 nemaju istu cenu.
- Kuće na Telepu i Veterniku često nisu potpuno uknjižene; proverite list pre kapare.
- Za stan koji izdajete studentima računajte na leto bez zakupca.
## Novi Sad ili Beograd
Kvadrat u Novom Sadu je i dalje jeftiniji nego u većini beogradskih opština, ali razlika se poslednjih godina smanjuje. Kirija je takođe niža, pa je odnos kirije i cene sličan. Za kupca koji radi od kuće ili putuje u Beograd jednom nedeljno, isti budžet u Novom Sadu kupuje jednu sobu više.
> Novogradnja sa rokom „Q4“ nije useljiva u oktobru. Računajte na tehnički prijem, upotrebnu dozvolu i priključke — realno tri do šest meseci posle roka.`,

    'ugovor-o-kupoprodaji-i-overa-kod-javnog-beleznika': `
Ugovor o kupoprodaji nepokretnosti važi tek kada ga potvrdi javni beležnik. To je dobra vest: beležnik proverava identitet i vlasništvo, ali sadržaj ugovora ipak morate da proverite sami.
## Šta ugovor mora da sadrži
- Ugovorne strane, sa JMBG i adresama.
- Opis stana tačno kao u listu nepokretnosti: adresa, broj posebnog dela, sprat, površina, parcela i katastarska opština.
- Cena, rokovi i način plaćanja — sa računa na račun; kapara i kako se uračunava.
- Izjava prodavca o teretima, ili kako se hipoteka briše iz cene.
- Rok predaje stana i ko plaća račune do tada.
- Ko plaća porez na prenos: zakonski prodavac, ugovorom najčešće kupac.
- Saglasnost prodavca za upis kupca u katastar, bezuslovna ili posle isplate cene.
Pre zakazivanja termina pošaljite nacrt ugovora i drugoj strani i javnom beležniku. Izmene na dan potpisa su moguće, ali nepripremljen termin često se završi odlaganjem.
## Solemnizacija
Javni beležnik proverava lične isprave i vlasništvo, čita ugovor naglas i potvrđuje da strane razumeju posledice. Potom po službenoj dužnosti šalje ugovor katastru radi upisa i podatke Poreskoj upravi radi utvrđivanja poreza.
## Šta poneti
- Lične karte, a stranci pasoš.
- Dokaz o vlasništvu i osnov sticanja: prethodni ugovor ili rešenje o nasleđivanju.
- Saglasnost bračnog druga prodavca ako je stan stečen u braku.
- Punomoćje overeno kod javnog beležnika, ako potpisuje neko drugi.
- Kod novogradnje: ugovor sa investitorom i dokaz o isplati.
## Posle overe
Kupac dobija primerak potvrđenog ugovora odmah, a rešenje o upisu iz katastra obično u roku od nekoliko nedelja. Rešenje o porezu na prenos stiže na adresu onoga ko ga ugovorom plaća; rok za plaćanje je naveden u rešenju.
## Koliko košta
Nagrada javnog beležnika zavisi od vrednosti ugovora; za stan od 100.000 € računajte orijentaciono 200 do 400 €. Ko je plaća, dogovarate u ugovoru.
> Ne potpisujte ugovor u kome je cena niža od one koju stvarno plaćate. Ostajete bez dokaza o isplati ako posao padne, a Poreska uprava ionako može da poveća osnovicu na tržišnu vrednost.`,

    'investiranje-u-nekretnine-i-prinos-od-izdavanja': `
Stan za izdavanje je ulaganje sa sporim novcem i stvarnim poslom. Pre kupovine izračunajte neto prinos — ono što ostaje posle poreza, praznih meseci i održavanja.
## Bruto prinos
Bruto prinos je godišnja kirija podeljena cenom stana. Primer: stan od 90.000 € sa kirijom od 450 € donosi 5.400 € godišnje, odnosno 6,0 %. Ovaj broj se citira u oglasima, ali ništa od njega ne stiže u celosti na vaš račun.
## Neto prinos
Od istog primera oduzmite:
- jedan prazan mesec godišnje: ostaje 4.950 €;
- porez od 15 % kirije (20 % uz normirane troškove od 25 %): −743 €;
- održavanje i zamenu opreme, oko 1 % vrednosti: −900 €;
- porez na imovinu i osiguranje: −250 €;
- proviziju agencije pri promeni zakupca, raspoređenu po godinama: −225 €.
Ostaje 2.832 €. Uz to ste pri kupovini platili porez, proviziju i overu — oko 5.000 € — pa je stvarno uloženo 95.000 €. Neto prinos je oko 3,0 %, upola manje od bruto broja.
Isti obračun napravite i za svoj konkretan stan, sa stvarnom kirijom iz oglasa u istom naselju — ne sa kirijom koju biste voleli da dobijete.
## Šta podiže prinos
- Manji stanovi: garsonjere i jednosobni stanovi imaju veći prinos po kvadratu.
- Lokacija uz fakultete, bolnice i poslovne zone, gde je malo praznih meseci.
- Namešten stan i jasna pravila u ugovoru.
- Dugoročan zakupac: godina bez promene vredi više od nešto veće kirije sa tri selidbe.
## Rizici koje formula ne vidi
- Zakupac koji ne plaća: iseljenje sudskim putem može da traje mesecima.
- Veliki popravci zgrade — krov, fasada, lift — koje plaćaju svi vlasnici.
- Promena propisa o porezu ili kratkoročnom izdavanju.
- Pad kirija u kraju kada se useli nova zgrada od nekoliko stotina stanova.
## Sa čim upoređivati
Neto prinos uporedite sa sigurnim ulaganjem, poput štednje u evrima. Razlika je naknada za vaš rad, rizik i to što stan ne možete da prodate preko noći. Deo zarade može doći i od rasta cene, ali on nije zagarantovan.
> Ako se računica isplati samo kada je stan izdat svih dvanaest meseci i ništa se ne kvari, ne isplati se.`,
  };

  /* contentProjects() — isti izvedeni projekti (id, name, status, rok, from…) za početnu ili mapu, da nazivi budu svuda isti */
  Object.assign(window, { viewProjects, viewProject, viewArticles, viewArticle, contentProjects: projects });
})();
