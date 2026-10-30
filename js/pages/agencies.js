/* Kvadrat.rs — stranice agencija: imenik (viewAgencies) i profil agencije (viewAgency). Spec §6.5, §5.24, §5.11, §5.20.
   Rute: #/agencije?q=&c=&sort=&ver=1 → viewAgencies(q) · #/agencija?s=slug&tab=oglasi|o-agenciji|agenti|ocene&t=&pt=&sort=&page= → viewAgency(q)
   Zavisi od: core.js (D, el, fmt, hash, rng, find, applyFilters, FILTER_DEFAULTS, TYPES, stats, router, toast, store),
   images.js (img.mark, img.el), ui.js (agencyCard, card, tabs, pills, segmented, select, check, pager, empty, crumbs, tiles,
   bars, badge, sheet, copyButton, icon, field), map.js (mapView). Svaki spoljni poziv je u S() — stranica ne puca ako modul fali.
   Demo podaci (deterministički iz hash(slug)) — deklarisano u izveštaju i u napomenama na stranici:
   broj registra posrednika, licence agenata, tim (3 osobe), telefoni agenata, jezici, radno vreme, vreme odgovora,
   pojedinačne recenzije i podocene (zbir recenzija = a.r × a.rc), lokacija kancelarije (centar grada + mali pomak). */
'use strict';

(function () {
  const S = (fn, fb = null) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const has = (name) => typeof window[name] === 'function';
  const DATA = () => (typeof D !== 'undefined' && D) || window.KV || { listings: [], cities: [], agencies: [] };
  const H = (s) => S(() => hash(String(s)), 0) >>> 0;
  const plu = (n, a, b, c) => S(() => fmt.plural(n, a, b, c), (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c));
  const num = (n, d = 0) => S(() => fmt.num(n, d), String(n));
  const ico = (n, sz) => S(() => icon(n, sz), null);
  const fold = (s) => S(() => fmt.fold(s), String(s || '').toLowerCase());
  const NOW_YEAR = new Date().getFullYear();

  /* ───────── rute ───────── */
  const R = {
    index: (p) => '#/agencije' + qs(p),
    agency: (s, p) => '#/agencija' + qs({ s, ...(p || {}) }),
    search: (p) => S(() => router.href('/pretraga', p), '#/pretraga' + qs(p)),
  };
  function qs(p) {
    if (!p) return '';
    const u = new URLSearchParams();
    Object.keys(p).forEach((k) => { const v = p[k]; if (v === '' || v == null || v === false || (Array.isArray(v) && !v.length)) return; u.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v)); });
    const s = u.toString().replace(/%2C/g, ',');
    return s ? '?' + s : '';
  }
  /* URL se ažurira bez ponovnog renderovanja (kucanje u pretrazi ne gubi fokus) */
  function replaceUrl(h) { S(() => { if (location.hash !== h) history.replaceState(history.state, '', h); }); }

  /* ───────── localStorage (try/catch) ───────── */
  const LS_REV = 'kv.agencyReviews';
  const ls = {
    get(k, fb) { try { const v = window.localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  /* ocene korisnika: localStorage, a ako je blokiran — memorija do osvežavanja */
  const MEM_REV = {};
  const revAll = () => { const v = ls.get(LS_REV, null); return v && typeof v === 'object' ? { ...MEM_REV, ...v } : { ...MEM_REV }; };
  const revSave = (all) => { Object.keys(MEM_REV).forEach((k) => delete MEM_REV[k]); Object.assign(MEM_REV, all); return ls.set(LS_REV, all); };

  /* ───────── deterministički „demo“ podaci agencije ───────── */
  const cityOfAgency = (a) => S(() => DATA().cities.find((c) => c.n === a.c), null);
  const listingsOf = (a) => DATA().listings.filter((l) => l.ags === a.s);

  function regNo(a) { return a.v ? String(120 + (H(a.s + '#reg') % 1880)) : null; }

  const FIRST_F = ['Jelena', 'Milica', 'Ana', 'Tamara', 'Ivana', 'Marija', 'Jovana', 'Dragana', 'Snežana', 'Katarina', 'Nevena', 'Bojana'];
  const FIRST_M = ['Nikola', 'Marko', 'Stefan', 'Nemanja', 'Vladimir', 'Miloš', 'Dušan', 'Aleksandar', 'Petar', 'Uroš', 'Bojan', 'Zoran'];
  const LAST = ['Perić', 'Marković', 'Ilić', 'Stanković', 'Jovanović', 'Petrović', 'Đorđević', 'Lukić', 'Radovanović', 'Kostić', 'Pavlović', 'Simić', 'Todorović', 'Nikolić'];
  const LANGS = ['engleski', 'nemački', 'ruski', 'italijanski', 'francuski', 'mađarski'];

  /* tim od 3 osobe: prvih a.ac su licencirani posrednici (poklapa se sa „N agenata“ na kartici), ostali saradnici */
  const TEAM = new Map();
  function agencyTeam(a) {
    if (!a) return [];
    if (TEAM.has(a.s)) return TEAM.get(a.s);
    const r = S(() => rng(H(a.s + '#team')), Math.random);
    const licensed = Math.max(1, Math.min(3, a.ac || 1));
    const used = new Set();
    const team = [0, 1, 2].map((i) => {
      let name, f, tries = 0;
      do {
        f = r() < 0.5;
        const first = (f ? FIRST_F : FIRST_M)[Math.floor(r() * 12)];
        name = first + ' ' + LAST[Math.floor(r() * LAST.length)];
      } while (used.has(name.split(' ')[0]) && tries++ < 12);
      used.add(name.split(' ')[0]);
      const lic = i < licensed;
      const role = i === 0 ? (f ? 'Direktorka · licencirana posrednica' : 'Direktor · licencirani posrednik')
        : lic ? (f ? 'Licencirana posrednica · prodaja' : 'Licencirani posrednik · prodaja')
          : (i === 2 ? (f ? 'Saradnica za izdavanje' : 'Saradnik za izdavanje') : (f ? 'Asistentkinja prodaje' : 'Asistent prodaje'));
      const h = H(a.s + '#ph' + i);
      const phone = `06${(h % 6) + 1} ${String(100 + ((h >>> 4) % 900))} ${String(1000 + ((h >>> 14) % 9000))}`;
      const langs = LANGS.filter((_, k) => ((h >>> (k + 3)) & 3) === 0).slice(0, 2);
      return { id: a.s + '-' + i, s: a.s + '-agent-' + i, n: name, role, licensed: lic, licNo: lic ? String(1000 + (h % 8900)).padStart(4, '0') : null, phone, langs: langs.length ? langs : ['engleski'], female: f, weight: lic ? 3 : 1, count: 0 };
    });
    /* raspodela stvarnih oglasa agencije po osobama (težinski, deterministički) */
    const tw = team.reduce((s, m) => s + m.weight, 0);
    listingsOf(a).forEach((l) => { let x = H(l.s + '#agent') % tw; for (const m of team) { if (x < m.weight) { m.count++; break; } x -= m.weight; } });
    TEAM.set(a.s, team);
    return team;
  }
  function agencyAgentFor(l) {
    const a = l && l.ags ? S(() => find.agency(l.ags), null) : null;
    if (!a) return null;
    const team = agencyTeam(a), tw = team.reduce((s, m) => s + m.weight, 0);
    let x = H(l.s + '#agent') % tw;
    for (const m of team) { if (x < m.weight) return m; x -= m.weight; }
    return team[0];
  }
  /* iste reči na kartici i na profilu: „2 licencirana posrednika · 1 saradnik“ */
  const licText = (n) => `${num(n)} ${plu(n, 'licencirani posrednik', 'licencirana posrednika', 'licenciranih posrednika')}`;
  const assocText = (n) => `${num(n)} ${plu(n, 'saradnik', 'saradnika', 'saradnika')}`;
  function teamSplit(team) { const lic = team.filter((m) => m.licensed).length; return { lic, assoc: team.length - lic }; }
  const responseHours = (a) => 1 + (H(a.s + '#resp') % (a.v ? 3 : 6));
  const hoursText = (a) => {
    const h = H(a.s + '#hrs') % 3;
    return ['pon–pet 9–17 h · sub 10–14 h', 'pon–pet 9–18 h · sub po dogovoru', 'pon–pet 10–18 h · sub 10–13 h'][h];
  };

  /* recenzije: rc komada, zbir ocena = round(r × rc) */
  /* [tekst, vrsta posla] — posao prati tekst da recenzija bude dosledna */
  const REV_TXT = {
    5: [
      ['Od prvog razgovora do primopredaje sve je išlo po dogovoru. Agent je unapred poslao list nepokretnosti i proverio teret u katastru, tako da smo kod notara samo potpisali.', 'Kupovina stana'],
      ['Tražili smo dvosoban stan blizu škole i dobili smo uži izbor od četiri stana, svaki sa tlocrtom i realnom procenom troškova. Bez pritiska i bez nepotrebnih obilazaka.', 'Kupovina stana'],
      ['Odgovarali su i vikendom, a kaparu smo dali tek kada su svi papiri bili provereni. Preporučujem svakome ko kupuje prvi stan.', 'Kupovina stana'],
      ['Prodali smo stan za šest nedelja, po ceni koju su nam predložili na početku. Fotografije i opis su bili pošteni, pa su dolazili samo ozbiljni kupci.', 'Prodaja stana'],
      ['Stan smo iznajmili za deset dana. Proverili su zakupca, sastavili ugovor i zapisnik o stanju stana sa fotografijama.', 'Izdavanje stana'],
    ],
    4: [
      ['Profesionalni i dobro poznaju kraj. Jedino nam je trebalo malo više vremena da dobijemo povratnu informaciju posle drugog obilaska.', 'Kupovina stana'],
      ['Stan je bio tačno onakav kao na fotografijama. Provizija je bila jasno navedena u ugovoru, a agent nam je pomogao i oko prijave za Infostan.', 'Zakup stana'],
      ['Korektna saradnja, dogovor oko cene je prošao bez stresa. Ugovor o posredovanju je mogao biti objašnjen detaljnije.', 'Prodaja stana'],
    ],
    3: [
      ['Sam stan je bio dobar, ali smo na termin obilaska čekali skoro nedelju dana. Komunikacija se popravila kada smo prešli na poziv umesto poruka.', 'Zakup stana'],
      ['Agent je ljubazan, ali nismo unapred dobili podatke o troškovima zgrade, pa smo ih saznali tek na obilasku.', 'Kupovina stana'],
    ],
    2: [['Oglas je bio aktivan i posle nego što je stan izdat, pa smo uzalud zakazali obilazak. Izvinili su se, ali je trebalo da ga ranije uklone.', 'Zakup stana']],
    1: [['Provizija nam nije pomenuta pre obilaska, već tek pri potpisivanju ugovora. Na kraju smo odustali.', 'Kupovina stana']],
  };
  const MONTHS_G = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
  const dateText = (d) => `${d.getDate()}. ${MONTHS_G[d.getMonth()]} ${d.getFullYear()}.`;

  function reviewScores(a) {
    const n = Math.max(0, a.rc || 0);
    if (!n) return [];
    const target = Math.round((a.r || 0) * n);
    const sc = Array(n).fill(5);
    let excess = Math.max(0, 5 * n - target);
    while (excess > 0) { let moved = false; for (let i = n - 1; i >= 0 && excess > 0; i--) if (sc[i] > 1) { sc[i]--; excess--; moved = true; } if (!moved) break; }
    return sc;
  }
  function agencyReviews(a) {
    const scores = reviewScores(a);
    const L = listingsOf(a);
    /* mesta iz grada agencije; tek ako ih nema — sva mesta iz njenih oglasa */
    const local = [...new Set(L.filter((l) => l.c === a.c).map((l) => l.m).filter(Boolean))];
    const places = local.length ? local : [...new Set(L.map((l) => l.m).filter(Boolean))];
    const used = new Set();
    return scores.map((st, i) => {
      const h = H(a.s + '#rev' + i);
      const pool = REV_TXT[st];
      let k = h % pool.length; while (used.has(st + ':' + k) && used.size < 12) k = (k + 1) % pool.length; used.add(st + ':' + k);
      const f = (h >>> 5) & 1;
      const first = (f ? FIRST_F : FIRST_M)[(h >>> 7) % 12];
      const last = LAST[(h >>> 11) % LAST.length];
      const days = 9 + i * 41 + ((h >>> 13) % 37);
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - days);
      const sub = [0, 1, 2].map((j) => Math.max(1, Math.min(5, st - (H(a.s + '#sub' + i + '-' + j) % 5 === 0 ? 1 : 0))));
      return { who: `${first} ${last[0]}.`, stars: st, text: pool[k][0], date: d, days, deal: pool[k][1], place: places.length ? places[(h >>> 3) % places.length] : a.c, sub };
    });
  }
  const SUBS = ['Stručnost', 'Poznavanje kraja', 'Komunikacija'];
  function subScores(a, revs) {
    return SUBS.map((label, j) => {
      const base = revs.length ? revs.reduce((s, r) => s + r.sub[j], 0) / revs.length : a.r || 0;
      return { label, v: Math.round(base * 10) / 10 };
    });
  }

  /* ───────── mali gradivni blokovi ───────── */
  /* ocena kao 5 kvadrata (pine = pun, pola = .25–.75); boja nije jedini signal: aria-label + broj pored */
  function squares(v, size = '') {
    v = Math.max(0, Math.min(5, +v || 0));
    const full = Math.floor(v + 0.25), fr = v - Math.floor(v), half = fr >= 0.25 && fr < 0.75 ? full + 1 : 0;
    return el('span', { class: 'ag-sq' + (size ? ' ' + size : ''), role: 'img', 'aria-label': `Ocena ${num(v, v % 1 ? 1 : 0)} od 5` },
      [1, 2, 3, 4, 5].map((k) => el('i', { class: k <= full ? 'on' : k === half ? 'half' : null })));
  }
  function markTile(a, cls) {
    const src = S(() => img.mark(a), null);
    return el('span', { class: cls, 'aria-hidden': 'true' }, src ? el('img', { src, alt: '', width: 96, height: 96, decoding: 'async' }) : (a.n || '?').slice(0, 2));
  }
  function revealPhone(number, o = {}) {
    /* dugme „Prikaži broj“ → selektabilan broj + kopiraj (tel: nije pouzdan u artifact-u) */
    const wrap = el('span', { class: 'ag-phone' + (o.cls ? ' ' + o.cls : '') });
    const masked = number.replace(/\d(?=\d?$)/g, '·');
    const btn = el('button', { class: 'btn ' + (o.primary ? 'btn-primary' : 'btn-secondary btn-sm'), type: 'button', 'aria-label': o.label ? `Pozovi — prikaži broj telefona ${o.who || ''}`.trim() : `Prikaži broj telefona ${o.who || ''}`.trim(),
      onclick: () => {
        wrap.innerHTML = '';
        const t = el('span', { class: 'ag-num num', tabindex: '-1' }, number);
        wrap.append(ico('phone', 16), t, S(() => copyButton(number, { outline: true, label: 'Kopiraj broj' }), null));
        S(() => t.focus({ preventScroll: true }));
        S(() => window.getSelection().selectAllChildren(t));
        if (o.onReveal) o.onReveal();
      } }, ico('phone', 16), o.label || el('span', {}, el('span', { class: 'num' }, masked), el('span', { class: 'ag-rev' }, ' prikaži broj')));
    wrap.append(btn);
    return wrap;
  }
  function demoTag(txt = 'demo prikaz') { return el('span', { class: 'ag-demo' }, txt); }

  /* ═════════════════════════ IMENIK  #/agencije ═════════════════════════ */
  const SORTS_AG = [{ v: 'oglasi', l: 'Broj oglasa' }, { v: 'ocena', l: 'Ocena' }, { v: 'najnovije', l: 'Najnovije' }];

  function viewAgencies(q) {
    q = q instanceof URLSearchParams ? q : new URLSearchParams(q || '');
    const all = DATA().agencies || [];
    const st = { q: q.get('q') || '', c: q.get('c') || '', sort: SORTS_AG.some((s) => s.v === q.get('sort')) ? q.get('sort') : 'oglasi', ver: q.get('ver') === '1' };
    const cityRows = (() => {
      const m = new Map();
      all.forEach((a) => { const c = cityOfAgency(a); const k = c ? c.s : fold(a.c); if (!m.has(k)) m.set(k, { v: k, l: a.c, n: 0 }); m.get(k).n++; });
      return [...m.values()].sort((x, y) => y.n - x.n || x.l.localeCompare(y.l, 'sr'));
    })();
    if (st.c && !cityRows.some((r) => r.v === st.c)) st.c = '';
    const nVer = all.filter((a) => a.v).length;
    const nList = all.reduce((s, a) => s + (a.lc || 0), 0);

    const grid = el('div', { class: 'agencies ag-grid' });
    const count = el('p', { class: 'ag-count', 'aria-live': 'polite' });
    const input = el('input', { class: 'input', type: 'search', placeholder: 'Naziv agencije ili grad', 'aria-label': 'Pretraži agencije po nazivu ili gradu', value: st.q, autocomplete: 'off',
      oninput: (e) => { st.q = e.target.value; paint(); } });
    const cityPills = S(() => pills([{ v: '', l: 'Svi gradovi' }, ...cityRows], [st.c], (v) => { st.c = v; paint(); }, { single: true }), el('div'));
    const sortSel = S(() => select(SORTS_AG, st.sort, (v) => { st.sort = v; paint(); }, { inline: true, label: 'Sortiraj agencije' }), null);
    const verCheck = S(() => check('Samo proverene', st.ver, (on) => { st.ver = on; paint(); }, { count: nVer }), null);

    function list() {
      const words = fold(st.q).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      let L = all.filter((a) => {
        if (st.ver && !a.v) return false;
        if (st.c) { const c = cityOfAgency(a); if ((c ? c.s : fold(a.c)) !== st.c) return false; }
        if (words.length) { const toks = fold(a.n + ' ' + a.c + ' ' + (a.ad || '')).split(/[^\p{L}\p{N}]+/u).filter(Boolean); if (!words.every((w) => toks.some((t) => t.startsWith(w)))) return false; }
        return true;
      });
      const by = {
        oglasi: (x, y) => (y.lc || 0) - (x.lc || 0) || (y.r || 0) - (x.r || 0),
        ocena: (x, y) => (y.r || 0) - (x.r || 0) || (y.rc || 0) - (x.rc || 0) || (y.lc || 0) - (x.lc || 0),
        najnovije: (x, y) => (y.y || 0) - (x.y || 0) || (y.lc || 0) - (x.lc || 0),
      }[st.sort];
      return L.sort((x, y) => by(x, y) || x.n.localeCompare(y.n, 'sr'));
    }
    function cardFor(a) {
      const c = S(() => agencyCard(a), null) || el('article', { class: 'agency' }, el('p', { class: 'nm' }, a.n));
      const to = R.agency(a.s);
      /* naziv postaje link preko cele kartice; dugme vodi na oglase agencije */
      const nm = c.querySelector('.nm span');
      if (nm) nm.replaceWith(el('a', { class: 'ag-cardlink', href: to }, a.n));
      const btn = c.querySelector('.btn');
      if (btn) { btn.setAttribute('href', R.agency(a.s, { tab: 'oglasi' })); btn.textContent = `Pogledaj ${num(a.lc || 0)} ${plu(a.lc || 0, 'oglas', 'oglasa', 'oglasa')}`; }
      const reg = regNo(a);
      const kpi = c.querySelector('.kpi');
      /* broj agenata istim rečima kao tab „Tim“ na profilu */
      const agSpan = kpi && kpi.lastElementChild;
      if (agSpan && /agen/.test(agSpan.textContent)) { const sp = teamSplit(agencyTeam(a)); agSpan.textContent = ''; agSpan.append(el('b', {}, num(sp.lic)), ' ' + licText(sp.lic).replace(/^\S+\s/, '')); }
      const regLine = el('p', { class: 'ag-reg' }, reg ? [ico('check-circle', 14), `Reg. br. posrednika ${reg}`] : [ico('info', 14), 'Broj registra nije dostavljen']);
      if (kpi) kpi.after(regLine); else c.append(regLine);
      /* provizija kod izdavanja: ko plaća (isto kao KX.cost i tab „O agenciji“) */
      regLine.after(el('p', { class: 'ag-reg ag-fee' }, ico('info', 14), a.pm ? 'Izdavanje: provizija 50 % kirije, plaća zakupac' : 'Izdavanje: proviziju plaća vlasnik'));
      if (!a.v) c.classList.add('ag-unver');
      return c;
    }
    let ready = false;
    function paint() {
      const L = list();
      grid.innerHTML = '';
      if (!L.length) {
        grid.append(S(() => empty('Nema agencija za ovu pretragu', st.q ? `Nijedna agencija ne odgovara upitu „${st.q}“${st.c ? ' u izabranom gradu' : ''}.` : 'Probajte drugi grad ili isključite „Samo proverene“.', 'Prikaži sve agencije', null,
          { onClick: () => { st.q = ''; st.c = ''; st.ver = false; input.value = ''; S(() => cityPills.set([''])); const cb = verCheck && verCheck.querySelector('input'); if (cb) cb.checked = false; paint(); } }), el('p', {}, 'Nema agencija.')));
        grid.classList.add('is-empty');
      } else { grid.classList.remove('is-empty'); L.forEach((a) => grid.append(cardFor(a))); }
      const lc = L.reduce((s, a) => s + (a.lc || 0), 0);
      count.textContent = `${L.length} ${plu(L.length, 'agencija', 'agencije', 'agencija')} · ${num(lc)} ${plu(lc, 'aktivan oglas', 'aktivna oglasa', 'aktivnih oglasa')}`;
      if (ready) replaceUrl(R.index({ q: st.q.trim(), c: st.c, sort: st.sort === 'oglasi' ? '' : st.sort, ver: st.ver }));
    }

    const page = el('div', { class: 'wrap agx' },
      S(() => crumbs([{ label: 'Početna', href: '#/' }, { label: 'Agencije' }]), null),
      el('header', { class: 'agx-head' },
        el('p', { class: 'eyebrow' }, 'Imenik posrednika'),
        el('h1', { class: 't-h1' }, 'Agencije za nekretnine'),
        el('p', { class: 'lede' }, `${all.length} ${plu(all.length, 'agencija', 'agencije', 'agencija')} iz ${cityRows.length} ${plu(cityRows.length, 'grada', 'grada', 'gradova')}, sa ukupno ${num(nList)} ${plu(nList, 'aktivnim oglasom', 'aktivna oglasa', 'aktivnih oglasa')}. ${nVer} ${plu(nVer, 'je proverena', 'su proverene', 'je provereno')}: imaju broj u Registru posrednika i licenciranog posrednika.`)),
      el('div', { class: 'agx-bar', role: 'search' },
        el('div', { class: 'input-wrap agx-q' }, ico('search'), input),
        el('div', { class: 'agx-tools' }, verCheck, el('label', { class: 'agx-sort' }, el('span', { class: 'meta' }, 'Sortiraj'), sortSel))),
      el('div', { class: 'agx-cities rail' }, cityPills),
      count,
      grid,
      el('aside', { class: 'agx-note', 'aria-labelledby': 'agx-note-h' },
        el('p', { class: 'eyebrow', id: 'agx-note-h' }, 'Kako biramo proverene agencije', demoTag()),
        el('div', { class: 'note-rule agx-note-b' },
          el('p', {}, 'Oznaku „Verifikovana agencija“ dobija posrednik koji ispunjava oba uslova: upisan je u Registar posrednika u prometu i zakupu nepokretnosti (vodi ga ministarstvo nadležno za trgovinu) i ima bar jednog zaposlenog sa položenim stručnim ispitom za posrednika (licenca).'),
          el('p', {}, 'Broj registra pišemo na kartici i na profilu, da ga možete sami proveriti. Agencije bez potvrđenog broja ostaju na portalu, ali bez oznake. Ocene ostavljaju klijenti; u ovoj demo verziji brojevi registra, licence i pojedinačne recenzije su ilustrativni.'))));
    paint(); ready = true;
    return page;
  }

  /* ═════════════════════════ PROFIL  #/agencija?s=slug ═════════════════════════ */
  const TABS = ['oglasi', 'o-agenciji', 'agenti', 'ocene'];
  const SORTS_L = [{ v: 'rel', l: 'Preporučeno' }, { v: 'new', l: 'Najnovije' }, { v: 'p-asc', l: 'Cena rastuće' }, { v: 'p-desc', l: 'Cena opadajuće' }, { v: 'ppm-asc', l: '€/m² rastuće' }];
  const PER = 12;

  function viewAgency(q) {
    q = q instanceof URLSearchParams ? q : new URLSearchParams(typeof q === 'string' && !q.includes('=') ? 's=' + q : q || '');
    const slug = q.get('s') || '';
    const a = S(() => find.agency(slug), null) || (DATA().agencies || []).find((x) => x.s === slug);
    if (!a) {
      return el('div', { class: 'wrap agp' },
        S(() => crumbs([{ label: 'Početna', href: '#/' }, { label: 'Agencije', href: R.index() }, { label: 'Nije pronađeno' }]), null),
        S(() => empty('Agencija nije pronađena', 'Možda je promenila naziv ili više nema aktivnih oglasa na Kvadratu.', 'Sve agencije', R.index(), { icon: 'building' }), el('p', {}, 'Agencija nije pronađena.')));
    }
    const L = listingsOf(a);
    const team = agencyTeam(a);
    const revs = agencyReviews(a);
    const reg = regNo(a);
    const city = cityOfAgency(a);
    const resp = responseHours(a);
    const st = {
      tab: TABS.includes(q.get('tab')) ? q.get('tab') : 'oglasi',
      t: q.get('t') === 'izdavanje' || q.get('t') === 'prodaja' ? q.get('t') : null,
      pt: q.get('pt') || '',
      sort: SORTS_L.some((s) => s.v === q.get('sort')) ? q.get('sort') : 'rel',
      page: Math.max(1, parseInt(q.get('page'), 10) || 1),
    };
    const nT = { prodaja: L.filter((l) => l.t === 'prodaja').length, izdavanje: L.filter((l) => l.t === 'izdavanje').length };
    const defT = nT.prodaja >= nT.izdavanje ? 'prodaja' : 'izdavanje';
    if (!st.t) st.t = defT;
    /* prvi prikaz ne menja URL; t se piše samo kad se razlikuje od podrazumevanog */
    let ready = false;
    const syncUrl = () => ready && replaceUrl(R.agency(a.s, { tab: st.tab === 'oglasi' ? '' : st.tab, t: st.tab === 'oglasi' && st.t !== defT ? st.t : '', pt: st.tab === 'oglasi' ? st.pt : '', sort: st.tab === 'oglasi' && st.sort !== 'rel' ? st.sort : '', page: st.tab === 'oglasi' && st.page > 1 ? st.page : '' }));

    /* ── poruka (forma na stranici) ── */
    const msg = messageBlock(a);

    /* ── zaglavlje ── */
    const meta = el('p', { class: 'agp-meta num' },
      el('span', {}, `od ${a.y}.`), el('span', {}, a.c),
      el('span', {}, `${num(a.lc || L.length)} ${plu(a.lc || L.length, 'oglas', 'oglasa', 'oglasa')}`),
      a.rc ? el('a', { class: 'agp-rate', href: '#agp-tabs', onclick: (e) => { e.preventDefault(); tabsEl && tabsEl.select('ocene'); scrollToTabs(); } }, squares(a.r, 'sm'), el('b', {}, num(a.r, 1)), ` (${a.rc})`) : el('span', {}, 'još bez ocena'));
    const actions = el('div', { class: 'agp-actions' },
      revealPhone(a.ph, { primary: true, label: el('span', {}, 'Pozovi'), who: a.n, cls: 'agp-call' }),
      el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => msg.open() }, ico('mail', 16), 'Pošalji poruku'));
    const head = el('header', { class: 'agp-head' },
      markTile(a, 'agp-mark'),
      el('div', { class: 'agp-id' },
        el('p', { class: 'eyebrow' }, 'Agencija za nekretnine · ' + a.c),
        el('h1', { class: 't-h1' }, a.n),
        el('p', { class: 'agp-reg' },
          a.v ? S(() => badge('verifikovan', 'Verifikovana agencija'), null) : el('span', { class: 'badge' }, 'Nije verifikovana'),
          resp <= 2 ? el('span', { class: 'badge', title: `Odgovara na poruke za ~${resp} h radnim danima` }, 'Brzo odgovara (demo)') : null,
          reg ? el('span', { class: 'num' }, `Reg. br. posrednika ${reg}`) : el('span', {}, 'Broj registra nije dostavljen')),
        meta),
      actions);

    /* KPI pločice (§5.20) */
    const saleFlats = L.filter((l) => l.t === 'prodaja' && l.pt === 'stan' && l.ppm > 0);
    const medPpm = saleFlats.length ? S(() => stats.median(saleFlats.map((l) => l.ppm)), null) : null;
    const medDz = L.length ? S(() => stats.median(L.map((l) => l.dz)), null) : null;
    const kpis = S(() => tiles([
      { v: num(L.length), l: `${plu(L.length, 'aktivan oglas', 'aktivna oglasa', 'aktivnih oglasa')} · ${nT.prodaja} na prodaju, ${nT.izdavanje} za izdavanje` },
      medPpm ? { v: S(() => fmt.ppm(medPpm), num(medPpm)), l: `medijana za stanove na prodaju · n=${saleFlats.length}` } : null,
      medDz != null ? { v: `${num(Math.round(medDz))} ${plu(Math.round(medDz), 'dan', 'dana', 'dana')}`, l: 'medijana starosti oglasa' } : null,
      { v: `~${resp} h`, l: 'prosečno vreme odgovora (demo)' },
    ].filter(Boolean)), null);

    /* ── tabovi ── */
    const panels = {
      oglasi: listingsPanel(a, L, st, nT, syncUrl),
      'o-agenciji': aboutPanel(a, city, reg, resp),
      agenti: agentsPanel(a, team),
      ocene: reviewsPanel(a, revs),
    };
    let tabsEl = null;
    const scrollToTabs = () => S(() => { const t = document.getElementById('agp-tabs'); if (t) t.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
    tabsEl = S(() => tabs([
      { id: 'oglasi', label: `Oglasi (${L.length})`, panel: panels.oglasi.el },
      { id: 'o-agenciji', label: 'O agenciji', panel: panels['o-agenciji'].el },
      { id: 'agenti', label: `Tim (${team.length})`, panel: panels.agenti },
      { id: 'ocene', label: `Ocene (${a.rc || 0})`, panel: panels.ocene },
    ], { active: st.tab, onChange: (id) => { st.tab = id; syncUrl(); if (id === 'o-agenciji') panels['o-agenciji'].mount(); } }), null);
    if (tabsEl) { tabsEl.id = 'agp-tabs'; tabsEl.classList.add('agp-tabs'); }
    if (st.tab === 'o-agenciji') panels['o-agenciji'].mount();
    ready = true;

    /* ── lepljiva traka na telefonu ── */
    const cta = el('div', { class: 'cta-bar ag-cta' },
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => callSheet(a) }, ico('phone', 16), 'Pozovi'),
      el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => msg.open() }, 'Poruka'));
    bnavOff(cta);

    return el('div', { class: 'wrap agp' },
      S(() => crumbs([{ label: 'Početna', href: '#/' }, { label: 'Agencije', href: R.index() }, { label: a.n }]), null),
      head,
      msg.el,
      kpis ? el('div', { class: 'agp-kpis' }, kpis) : null,
      tabsEl || el('div', {}, panels.oglasi.el),
      cta);
  }

  /* bnav se sakriva dok je traka u dokumentu (body[data-bnav="off"]), vraća se kad stranica ode */
  function bnavOff(node) {
    let was = false;
    const check = () => {
      if (node.isConnected) { was = true; document.body.setAttribute('data-bnav', 'off'); document.body.classList.add('ag-has-cta'); }
      else if (was) { mo.disconnect(); if (document.body.getAttribute('data-bnav') === 'off' && !document.querySelector('.cta-bar')) document.body.removeAttribute('data-bnav'); document.body.classList.remove('ag-has-cta'); }
    };
    const mo = new MutationObserver(check);
    S(() => mo.observe(document.body, { childList: true, subtree: true }));
    requestAnimationFrame(check);
  }

  function callSheet(a) {
    const body = el('div', { class: 'ag-callsheet' },
      el('p', { class: 'meta' }, `${a.n} · ${hoursText(a)}`),
      el('p', { class: 'ag-bignum num' }, el('span', { class: 'ag-num' }, a.ph), S(() => copyButton(a.ph, { outline: true, label: 'Kopiraj broj' }), null)),
      el('p', { class: 'note-rule' }, 'Pomenite da ste oglas našli na Kvadratu. Kaparu ne dajte pre nego što vidite list nepokretnosti.'));
    S(() => sheet('Pozovi agenciju', body, {}));
  }

  /* ── forma za poruku (u stranici, bez modala) ── */
  function messageBlock(a) {
    let sent = false;
    const box = el('section', { class: 'agp-msg', hidden: true, 'aria-labelledby': 'agp-msg-h', id: 'agp-msg' });
    let topic = 'kupujem';
    function form() {
      const name = el('input', { class: 'input', type: 'text', autocomplete: 'name', placeholder: 'Ime i prezime' });
      const contact = el('input', { class: 'input', type: 'text', autocomplete: 'email', placeholder: 'Telefon ili e-pošta' });
      const text = el('textarea', { class: 'input agp-ta', rows: '4' }, `Poštovani, zanima me saradnja sa agencijom ${a.n}. Molim vas da me kontaktirate.`);
      const fName = S(() => field('Ime', name), name), fContact = S(() => field('Kako da vas kontaktiraju', contact, 'Broj ili adresa vide se samo agenciji.'), contact), fText = S(() => field('Poruka', text), text);
      const err = (inp, wrapNode, msgTxt) => {
        inp.setAttribute('aria-invalid', 'true');
        let h = wrapNode.querySelector('.help');
        if (!h) { h = el('p', { class: 'help', id: inp.id + '-h' }); wrapNode.append(h); inp.setAttribute('aria-describedby', h.id); }
        h.classList.add('err'); h.textContent = msgTxt;
      };
      const ok = (inp, wrapNode, txt) => { inp.removeAttribute('aria-invalid'); const h = wrapNode.querySelector('.help'); if (h) { h.classList.remove('err'); h.textContent = txt || ''; } };
      const f = el('form', { class: 'agp-form', novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        let bad = null;
        if (name.value.trim().length < 2) { err(name, fName, 'Upišite ime.'); bad = bad || name; } else ok(name, fName);
        const c = contact.value.trim();
        if (!(/@.+\./.test(c) || c.replace(/\D/g, '').length >= 6)) { err(contact, fContact, 'Upišite broj telefona ili e-poštu.'); bad = bad || contact; } else ok(contact, fContact, 'Broj ili adresa vide se samo agenciji.');
        if (text.value.trim().length < 5) { err(text, fText, 'Napišite kratku poruku.'); bad = bad || text; } else ok(text, fText);
        if (bad) { bad.focus(); return; }
        sent = true; paint(name.value.trim());
      } },
      el('fieldset', { class: 'agp-topic' }, el('legend', { class: 'label' }, 'Tema'),
        el('div', { class: 'agp-topic-o' }, [{ v: 'kupujem', l: 'Kupujem' }, { v: 'prodajem', l: 'Prodajem' }, { v: 'iznajmljujem', l: 'Tražim stan za zakup' }, { v: 'izdajem', l: 'Izdajem' }]
          .map((o) => S(() => check(o.l, topic === o.v, (on, v) => { if (on) topic = v; }, { type: 'radio', name: 'agp-topic-' + a.s, value: o.v }), null)))),
      el('div', { class: 'agp-form-row' }, fName, fContact),
      fText,
      el('div', { class: 'btn-row agp-form-ft' },
        el('button', { class: 'btn btn-ink', type: 'submit' }, 'Pošalji poruku'),
        el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => api.close() }, 'Odustani'),
        el('p', { class: 'meta' }, `Obično odgovara za ~${responseHours(a)} h radnim danima (demo).`)));
      return f;
    }
    function paint(who) {
      box.innerHTML = '';
      box.append(el('div', { class: 'agp-msg-hd' }, el('h2', { class: 't-h2s', id: 'agp-msg-h' }, sent ? 'Poruka je poslata' : `Poruka za ${a.n}`),
        el('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Zatvori poruku', onclick: () => api.close() }, ico('x'))));
      if (sent) {
        box.append(el('div', { class: 'agp-sent', role: 'status' },
          el('p', {}, ico('check-circle', 18), el('span', {}, `Hvala${who ? ', ' + who.split(' ')[0] : ''}. Agencija ${a.n} je dobila vašu poruku i javiće se na kontakt koji ste ostavili.`)),
          el('p', { class: 'meta' }, 'Demo: poruka se ne šalje stvarnoj agenciji i ne čuva se na serveru.'),
          el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => { sent = false; paint(); } }, 'Nova poruka')));
      } else box.append(form());
    }
    const api = {
      el: box,
      open() {
        if (box.hidden) { paint(); box.hidden = false; }
        S(() => box.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
        const first = box.querySelector('input, textarea, button.btn'); if (first) S(() => first.focus({ preventScroll: true }));
      },
      close() { box.hidden = true; },
    };
    return api;
  }

  /* ── tab: Oglasi ── */
  function listingsPanel(a, L, st, nT, syncUrl) {
    const root = el('div', { class: 'agp-ls' });
    const bar = el('div', { class: 'agp-bar' });
    const out = el('div', { class: 'agp-out' });
    const meta = el('p', { class: 'ag-count', 'aria-live': 'polite' });
    function typesFor(t) {
      const m = new Map();
      L.filter((l) => l.t === t).forEach((l) => m.set(l.pt, (m.get(l.pt) || 0) + 1));
      const T = S(() => TYPES, []);
      return [...m.entries()].map(([v, n]) => ({ v, l: (T.find((x) => x.v === v) || {}).l || v, n })).sort((x, y) => y.n - x.n);
    }
    function results() {
      const f = { ...S(() => FILTER_DEFAULTS, {}), agency: a.s, t: st.t, pt: st.pt ? [st.pt] : [], sort: st.sort };
      const r = S(() => applyFilters(f), null);
      if (r) return r;
      return L.filter((l) => l.t === st.t && (!st.pt || l.pt === st.pt));
    }
    function paintBar() {
      bar.innerHTML = '';
      const tps = typesFor(st.t);
      if (st.pt && !tps.some((x) => x.v === st.pt)) st.pt = '';
      bar.append(
        S(() => segmented([{ v: 'prodaja', l: `Prodaja · ${nT.prodaja}` }, { v: 'izdavanje', l: `Izdavanje · ${nT.izdavanje}` }], st.t, (v) => { st.t = v; st.pt = ''; st.page = 1; paintBar(); paint(); }), null),
        el('div', { class: 'agp-types rail' }, S(() => pills([{ v: '', l: 'Svi tipovi' }, ...tps], [st.pt], (v) => { st.pt = v; st.page = 1; paint(); }, { single: true }), null)),
        el('label', { class: 'agp-sort' }, el('span', { class: 'meta' }, 'Sortiraj'), S(() => select(SORTS_L, st.sort, (v) => { st.sort = v; st.page = 1; paint(); }, { inline: true, label: 'Sortiraj oglase' }), null)));
    }
    function paint(scroll) {
      const list = results();
      const pages = Math.max(1, Math.ceil(list.length / PER));
      if (st.page > pages) st.page = pages;
      const from = (st.page - 1) * PER;
      const slice = list.slice(from, from + PER);
      out.innerHTML = '';
      const tl = st.t === 'prodaja' ? 'na prodaju' : 'za izdavanje';
      meta.textContent = list.length ? `${num(list.length)} ${plu(list.length, 'oglas', 'oglasa', 'oglasa')} ${tl}${pages > 1 ? ` · prikazano ${from + 1}–${from + slice.length}` : ''}` : '';
      if (!list.length) {
        out.append(S(() => empty('Agencija trenutno nema ovakvih oglasa', st.t === 'prodaja' && nT.izdavanje ? `Pogledajte ${nT.izdavanje} ${plu(nT.izdavanje, 'oglas', 'oglasa', 'oglasa')} za izdavanje.` : 'Pogledajte druge tipove nekretnina.', 'Svi tipovi', null,
          { onClick: () => { st.pt = ''; st.page = 1; paintBar(); paint(); } }), el('p', {}, 'Nema oglasa.')));
      } else {
        out.append(el('div', { class: 'cards' }, slice.map((l) => S(() => card(l, 'grid'), el('a', { href: '#/oglas?s=' + l.s }, l.ti)))));
        if (pages > 1) out.append(S(() => pager(st.page, pages, (p) => { st.page = p; paint(true); }), null));
      }
      out.append(el('p', { class: 'agp-more' }, el('a', { class: 'btn btn-link', href: R.search({ agency: a.s, t: st.t, pt: st.pt || '' }) }, 'Otvori u pretrazi sa filterima'), ico('arrow-right', 16)));
      syncUrl();
      if (scroll) S(() => { const top = root.getBoundingClientRect().top + window.scrollY - 140; if (window.scrollY > top) window.scrollTo({ top, behavior: 'auto' }); });
    }
    root.append(bar, meta, out);
    paintBar(); paint();
    return { el: root };
  }

  /* ── tab: O agenciji ── */
  function aboutPanel(a, city, reg, resp) {
    const paras = String(a.d || '').split(/\n+/).filter(Boolean);
    const sentences = paras.length === 1 ? paras[0].split(/(?<=\.)\s+/) : null;
    const lede = sentences ? sentences[0] : paras[0];
    const rest = sentences ? [sentences.slice(1).join(' ')].filter(Boolean) : paras.slice(1);
    const comm = a.pm ? 'Kod izdavanja proviziju plaća zakupac (do 50 % prve kirije).' : 'Kod izdavanja proviziju plaća vlasnik — zakupac ne plaća.';
    const facts = [
      ['Adresa', `${a.ad || '—'}, ${a.c}`],
      ['Telefon', el('span', { class: 'ag-numrow' }, el('span', { class: 'ag-num num' }, a.ph), S(() => copyButton(a.ph, { label: 'Kopiraj broj' }), null))],
      ['E-pošta', el('span', { class: 'ag-numrow' }, el('span', { class: 'ag-num' }, a.em || '—'), a.em ? S(() => copyButton(a.em, { label: 'Kopiraj e-poštu' }), null) : null)],
      ['Radno vreme', hoursText(a)],
      ['Registar posrednika', reg ? `br. ${reg} · ${licText(Math.max(1, Math.min(3, a.ac || 1)))}` : 'broj nije dostavljen'],
      ['Posluje od', `${a.y}. (${NOW_YEAR - a.y} ${plu(NOW_YEAR - a.y, 'godina', 'godine', 'godina')})`],
      ['Provizija', `Kod prodaje uobičajeno 2 % + PDV; ko plaća piše u ugovoru o posredovanju. ${comm}`],
      ['Odgovor na poruke', `~${resp} h radnim danima (demo)`],
    ];
    const office = { s: 'kancelarija-' + a.s, pt: 'poslovni-prostor', im: 1, ti: 'Kancelarija ' + a.n, co: 'dobro-stanje', y: 2008 + (H(a.s) % 14), ms: '', ns: '', n: a.c, t: 'izdavanje' };
    const photo = el('figure', { class: 'agp-photo' },
      el('div', { class: 'ph' }, S(() => img.el(office, 0, { aspect: '4:3', alt: `Zgrada u kojoj je kancelarija agencije ${a.n} (ilustracija)` }), null)),
      el('figcaption', { class: 'meta' }, `Kancelarija · ${a.ad || a.c} (ilustracija)`));
    const mapBox = el('div', { class: 'agp-map' });
    const h = H(a.s + '#loc');
    const lat = (city ? city.lat : 44.7866) + (((h % 1000) / 1000) - 0.5) * 0.008;
    const lng = (city ? city.lng : 20.4489) + ((((h >>> 10) % 1000) / 1000) - 0.5) * 0.011;
    const mapWrap = el('figure', { class: 'agp-mapwrap' },
      el('div', { class: 'agp-mapbox' }, mapBox,
        el('div', { class: 'agp-pin', 'aria-hidden': 'true' }, el('span', { class: 'p' }, ico('building', 14), a.n), el('span', { class: 's' }))),
      el('figcaption', { class: 'meta' }, `Približna lokacija kancelarije · ${a.c}`));
    let api = null, mounted = false;
    function mount() {
      if (mounted) return; mounted = true;
      let tries = 120;
      const go = () => {
        if (!(mapBox.isConnected && mapBox.clientWidth > 0)) { if (tries-- > 0) requestAnimationFrame(go); else mounted = false; return; }
        if (typeof mapView !== 'function') { mapBox.classList.add('agp-map-off'); mapBox.append(el('p', { class: 'meta' }, a.ad ? `${a.ad}, ${a.c}` : a.c)); return; }
        api = S(() => mapView(mapBox, { listings: [], city: city ? city.s : undefined, interactive: false, drawTool: false, legend: false, showAreaButton: false, popover: false, labels: true, view: { lat, lng, zoom: 14 } }), null);
        if (!api) { mapBox.classList.add('agp-map-off'); return; }
        const mo = new MutationObserver(() => { if (!mapWrap.isConnected) { mo.disconnect(); S(() => api.destroy()); } });
        S(() => mo.observe(document.body, { childList: true, subtree: true }));
      };
      requestAnimationFrame(go);
    }
    const root = el('div', { class: 'agp-about' },
      el('div', { class: 'agp-about-text' },
        el('p', { class: 't-desc-lede' }, lede),
        rest.length ? el('div', { class: 'prose' }, rest.map((p) => el('p', {}, p))) : null,
        el('dl', { class: 'agp-facts' }, facts.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v))))),
      el('div', { class: 'agp-about-media' }, photo, mapWrap));
    return { el: root, mount };
  }

  /* ── tab: Agenti ── */
  function agentsPanel(a, team) {
    const sp = teamSplit(team);
    return el('div', { class: 'agp-agents-wrap' },
      el('p', { class: 'agp-team-sum num' }, el('b', {}, licText(sp.lic)), sp.assoc ? ` · ${assocText(sp.assoc)}` : null,
        el('span', { class: 'meta' }, ' — na kartici agencije brojimo samo licencirane posrednike.')),
      el('div', { class: 'agp-agents' }, team.map((m) => el('article', { class: 'agp-agent' + (m.licensed ? '' : ' is-assoc') },
        el('div', { class: 'agp-agent-top' },
          markTile({ s: m.s, n: m.n }, 'agp-ava'),
          el('div', { class: 'agp-agent-id' },
            el('h3', {}, m.n),
            el('p', { class: 'meta' }, m.role))),
        el('p', { class: 'agp-agent-kpi num' },
          el('span', {}, el('b', {}, num(m.count)), ' ', plu(m.count, 'oglas', 'oglasa', 'oglasa')),
          el('span', {}, 'govori ', m.langs.join(', '))),
        el('p', { class: 'agp-lic' }, m.licensed ? [ico('check-circle', 14), `Licenca posrednika br. ${m.licNo}`] : [ico('info', 14), 'Radi uz licenciranog posrednika']),
        revealPhone(m.phone, { who: m.n })))),
      el('p', { class: 'note-rule agp-agents-note' }, 'Brojevi licenci, telefoni i raspored oglasa po agentima su demo prikaz. Na pravom portalu licencu možete proveriti u Registru posrednika.'));
  }

  /* ── tab: Ocene ── */
  const SCORE_L = { 5: 'odlično', 4: 'vrlo dobro', 3: 'dobro', 2: 'loše', 1: 'vrlo loše' };
  function reviewsPanel(a, revs) {
    const dist = [5, 4, 3, 2, 1].map((k) => ({ k, n: revs.filter((r) => r.stars === k).length }));
    const subs = subScores(a, revs);
    const mine = el('div', { class: 'agp-mine' });
    const summary = el('div', { class: 'agp-sum' },
      el('div', { class: 'agp-big' },
        el('b', { class: 'num' }, a.rc ? num(a.r, 1) : '—'),
        el('div', {}, a.rc ? squares(a.r) : null, el('p', { class: 'meta' }, a.rc ? `${a.rc} ${plu(a.rc, 'ocena', 'ocene', 'ocena')} klijenata` : 'Još nema ocena'))),
      S(() => bars(dist.map((d) => ({ label: `${d.k} · ${SCORE_L[d.k]}`, value: d.n })), { format: (v) => String(v), max: Math.max(1, ...dist.map((d) => d.n)) }), null),
      el('dl', { class: 'agp-subs' }, subs.map((s) => el('div', {}, el('dt', {}, s.label), el('dd', {}, squares(s.v, 'sm'), el('b', { class: 'num' }, num(s.v, 1)))))),
      el('p', { class: 'note-rule' }, 'Demo prikaz: pojedinačne ocene su izvedene iz prosečne ocene agencije. Na pravom portalu ocenu može da ostavi samo klijent posle obilaska ili potpisanog ugovora, a agencija može javno da odgovori.'));
    const list = el('ol', { class: 'agp-revs' }, revs.slice().sort((x, y) => x.days - y.days).map((r) => el('li', { class: 'agp-rev' },
      el('div', { class: 'agp-rev-hd' }, squares(r.stars, 'sm'), el('b', {}, r.who), el('time', { class: 'meta', datetime: r.date.toISOString().slice(0, 10) }, dateText(r.date))),
      el('p', { class: 'agp-rev-ctx meta' }, `${r.deal} · ${r.place}`),
      el('p', { class: 'agp-rev-t' }, r.text))));
    const formWrap = el('div', { class: 'agp-rf' });
    function readMine() { return revAll()[a.s] || null; }
    function paintMine() {
      mine.innerHTML = '';
      const m = readMine();
      if (!m) return;
      const d = new Date(m.date || Date.now());
      mine.append(el('div', { class: 'agp-rev agp-rev-mine' },
        el('p', { class: 'eyebrow' }, 'Vaša ocena'),
        el('div', { class: 'agp-rev-hd' }, squares(m.stars, 'sm'), el('b', {}, m.name || 'Vi'), el('time', { class: 'meta', datetime: d.toISOString().slice(0, 10) }, dateText(d))),
        m.text ? el('p', { class: 'agp-rev-t' }, m.text) : null,
        el('p', { class: 'meta' }, 'Sačuvano samo u ovom pregledaču; ne ulazi u prosek dok je ne potvrdimo.'),
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { const all = revAll(); delete all[a.s]; revSave(all); paintMine(); paintForm(); } }, ico('trash', 16), 'Obriši moju ocenu')));
    }
    function paintForm() {
      formWrap.innerHTML = '';
      const m = readMine();
      let stars = m ? m.stars : 0;
      const picks = [1, 2, 3, 4, 5].map((k) => el('button', { type: 'button', class: 'agp-star', role: 'radio', 'aria-checked': 'false', 'aria-label': `${k} — ${SCORE_L[k]}`, tabindex: '-1', onclick: () => setStars(k),
        onkeydown: (e) => {
          /* ARIA radio: strelica pomera od fokusiranog dugmeta (ne od izabrane vrednosti) */
          const cur = picks.indexOf(e.currentTarget) + 1 || stars || 1;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStars(cur >= 5 ? 1 : cur + 1, true); }
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStars(cur <= 1 ? 5 : cur - 1, true); }
          else if (e.key === 'Home') { e.preventDefault(); setStars(1, true); }
          else if (e.key === 'End') { e.preventDefault(); setStars(5, true); } } }, el('i'), el('span', {}, String(k))));
      const capt = el('span', { class: 'meta agp-star-l' });
      const group = el('div', { class: 'agp-stars', role: 'radiogroup', 'aria-label': 'Vaša ocena od 1 do 5' }, picks, capt);
      function setStars(k, focus) {
        stars = k;
        picks.forEach((b, i) => { b.classList.toggle('on', i < k); b.setAttribute('aria-checked', i + 1 === k ? 'true' : 'false'); b.tabIndex = i + 1 === (k || 1) ? 0 : -1; });
        capt.textContent = k ? SCORE_L[k] : 'izaberite ocenu';
        if (focus) picks[k - 1].focus();
        errStars.hidden = true;
      }
      const errStars = el('p', { class: 'help err', hidden: true }, 'Izaberite ocenu od 1 do 5.');
      const name = el('input', { class: 'input', type: 'text', placeholder: 'Npr. Marija P.', value: m ? m.name || '' : '', autocomplete: 'given-name' });
      const text = el('textarea', { class: 'input agp-ta', rows: '3', placeholder: 'Kako je izgledala saradnja? Obilazak, papiri, provizija…' }, m ? m.text || '' : '');
      const f = el('form', { class: 'agp-form', novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        if (!stars) { errStars.hidden = false; picks[0].focus(); return; }
        const all = revAll();
        all[a.s] = { stars, name: name.value.trim().slice(0, 40), text: text.value.trim().slice(0, 600), date: new Date().toISOString() };
        const okSave = revSave(all);
        paintMine(); paintForm();
        S(() => toast(okSave ? 'Hvala — vaša ocena je sačuvana' : 'Ocena je prikazana, ali pregledač ne dozvoljava čuvanje'));
      } },
      el('h3', { class: 't-h3' }, m ? 'Izmenite svoju ocenu' : 'Ostavite ocenu'),
      el('p', { class: 'meta' }, `Sarađivali ste sa agencijom ${a.n}? Ocena pomaže drugima da izaberu posrednika.`),
      group, errStars,
      S(() => field('Ime (prikazuje se skraćeno)', name), name),
      S(() => field('Utisak', text), text),
      el('div', { class: 'btn-row' }, el('button', { class: 'btn btn-secondary', type: 'submit' }, m ? 'Sačuvaj izmene' : 'Pošalji ocenu')));
      setStars(stars);
      formWrap.append(f);
    }
    paintMine(); paintForm();
    return el('div', { class: 'agp-reviews' },
      el('div', { class: 'agp-rv-hd' }, el('h2', { class: 't-h2s' }, 'Ocene klijenata'), demoTag()),
      el('div', { class: 'agp-rv-grid' },
        summary,
        el('div', { class: 'agp-rv-main' }, mine, revs.length ? list : el('p', { class: 'meta' }, 'Agencija još nema ocena.'), formWrap)));
  }

  Object.assign(window, { viewAgencies, viewAgency, agencyTeam, agencyAgentFor, agencyRegNo: regNo });
})();
